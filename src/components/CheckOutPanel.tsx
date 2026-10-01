'use client';
// MCU tab: check out (curve drawn to scale from live reserves, honest readouts) or check in open positions.
import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatedList, Button, Chip, ElasticSlider, Field, Segmented, SpotlightCard } from '@/components/ui';
import type { Position } from '@/hooks/useAccountState';
import { SCHEDULED_RESERVE_CHANGE } from '@/lib/contracts/addresses';
import { buildCheckInPlan, buildCheckOutPlan } from '@/lib/plans';
import { fmtAmount, fmtUsd, forgoneRewardsUsdPerDay, mcuPerDayCreditUsd, mdmPriceUsd, parseAmount, quoteCheckOut, quoteCheckOutWei } from '@/lib/protocol';
import { Checkbox, ConnectPrompt, Details, Note, PageHeader, Readout, dayIndex, reserveChangePending, shortDateUtc, toNum, useNow, weiToInput, type PanelProps } from './common';
import { Curve } from './Curve';
import { TxProgress, useTxFlow } from './TxFlow';

type Mode = 'checkout' | 'checkin';
const ZERO = BigInt(0);
const Q_MAX = 5;
const Q_MIN = 0.01;

/** Largest q (MCU) whose quote fits in `free` MDM on the constant-product curve. */
function affordable(reserveMdm: number, reserveMcu: number, free: number): number {
  if (!(reserveMcu > 0) || !(free > 0)) return 0;
  return (reserveMcu * free) / (reserveMdm + free);
}

export function CheckOutPanel({ protocol, account, connected }: PanelProps) {
  const id = useId();
  const now = useNow();
  const [mode, setMode] = useState<Mode>('checkout');
  const [q, setQ] = useState('1');
  const [mcuIn, setMcuIn] = useState('');
  const [showAfter, setShowAfter] = useState(true);
  const tx = useTxFlow(() => setMcuIn(''));

  const rMdm = toNum(protocol?.reserveMdm);
  const rMcu = toNum(protocol?.reserveMcu);
  const t = dayIndex(protocol, now);
  const price = protocol ? mdmPriceUsd(protocol.poolUsdc, protocol.poolMdm) : 0;
  const pendingChange = reserveChangePending(now) && !!protocol;
  const changeDay = shortDateUtc(SCHEDULED_RESERVE_CHANGE.executableAt);

  // ── check-out ──
  const free = account?.freeStake ?? ZERO;
  const qCap = connected && account ? Math.min(Q_MAX, Math.floor(affordable(rMdm, rMcu, toNum(free)) * 100) / 100) : Q_MAX;
  const sliderMax = Math.max(Q_MIN, qCap);
  const qNum = Number(q) || 0;
  const qWei = useMemo(() => (q.trim() === '' ? null : parseAmount(q)), [q]);
  const quoteFloat = protocol ? quoteCheckOut(rMdm, rMcu, qNum) : 0;
  const quoteWei = useMemo(() => {
    if (!protocol || qWei === null) return null;
    try {
      return quoteCheckOutWei(protocol.reserveMdm, protocol.reserveMcu, qWei);
    } catch {
      return null;
    }
  }, [protocol, qWei]);
  const quoteAfter = pendingChange ? quoteCheckOut(rMdm, rMcu + SCHEDULED_RESERVE_CHANGE.deltaMcu, qNum) : null;
  const credit = mcuPerDayCreditUsd(qNum);
  const forgone = protocol && Number.isFinite(quoteFloat) ? forgoneRewardsUsdPerDay(quoteFloat, toNum(protocol.totalStaked), t, price) : 0;
  const costly = qNum > 0 && forgone > credit;

  const minCheckout = protocol?.minCheckout ?? BigInt(10) ** BigInt(16);
  const maxPositions = protocol?.maxPositions ?? 100;
  const outReason = !account
    ? undefined
    : account.genesisRestricted
      ? 'This wallet cannot stake or check out.'
      : protocol?.paused.checkOut
        ? 'Check-out is paused by the guardian; check-in still works.'
        : qWei === null || qWei === ZERO
          ? 'Enter an amount of MCU.'
          : qWei < minCheckout
            ? 'Check out at least 0.01 MCU.'
            : account.positions.length >= maxPositions
              ? `You already have ${maxPositions} open positions; check some in first.`
              : quoteWei === null
                ? 'The curve cannot supply that much MCU right now.'
                : free < quoteWei
                  ? `You have ${fmtAmount(free)} sMDM free; this needs ${fmtAmount(quoteWei)}.`
                  : undefined;
  const outPlan = qWei !== null && qWei > ZERO ? buildCheckOutPlan(qWei, free) : null;

  // ── check-in ──
  const positions = account?.positions ?? [];
  const outstanding = positions.reduce((acc, p) => acc + p.mcuOutstanding, ZERO);
  const mcuBalance = account?.mcuBalance ?? ZERO;
  const inWei = useMemo(() => (mcuIn.trim() === '' ? null : parseAmount(mcuIn)), [mcuIn]);
  const inError =
    mcuIn.trim() !== '' && inWei === null
      ? 'Enter a valid amount.'
      : inWei !== null && inWei > mcuBalance
        ? `You only have ${fmtAmount(mcuBalance)} MCU in your wallet.`
        : inWei !== null && inWei > outstanding
          ? `Your positions hold ${fmtAmount(outstanding)} MCU.`
          : undefined;
  const inReason = !account ? undefined : positions.length === 0 ? 'You have no MCU positions to check in.' : inWei === null || inWei === ZERO ? 'Enter an amount of MCU.' : inError;
  const inPlan = inWei !== null && inWei > ZERO ? buildCheckInPlan(inWei) : null;

  const switchMode = (m: Mode) => {
    setMode(m);
    tx.reset();
  };

  return (
    <>
      <PageHeader
        eyebrow="MCU"
        title={mode === 'checkout' ? 'Check out MCU' : 'Check in MCU'}
        aside={
          <>
            {protocol?.paused.checkOut && <Chip>Check-out paused by the guardian</Chip>}
            <Segmented
              aria-label="Check out or check in"
              value={mode}
              onChange={switchMode}
              options={[
                { value: 'checkout', label: 'Check out' },
                { value: 'checkin', label: 'Check in' },
              ]}
            />
          </>
        }
      />

      {mode === 'checkout' ? (
        <div className="grid gap-8 min-[960px]:grid-cols-[1.15fr_1fr] min-[960px]:gap-12">
          <section aria-label="Check-out curve" className="flex flex-col gap-3">
            <Curve
              reserveMdm={rMdm}
              reserveMcu={rMcu}
              q={qNum}
              scheduledDeltaMcu={pendingChange && showAfter ? SCHEDULED_RESERVE_CHANGE.deltaMcu : undefined}
              scheduledLabel={`From ${changeDay} (+${SCHEDULED_RESERVE_CHANGE.deltaMcu.toLocaleString('en-US')} MCU reserve)`}
            />
            {pendingChange && (
              <Checkbox id={`${id}-after`} checked={showAfter} onChange={setShowAfter}>
                Show the curve after {changeDay}
              </Checkbox>
            )}
          </section>

          <section aria-label="Check-out form" className="flex flex-col gap-4">
            <Field
              id={`${id}-q`}
              label="MCU to check out"
              token="MCU"
              value={q}
              onChange={setQ}
              onMax={connected && account ? () => setQ(qCap.toFixed(2)) : undefined}
              helper={connected && account ? `Free ${fmtAmount(free)} sMDM` : undefined}
              error={q.trim() !== '' && qWei === null ? 'Enter a valid amount.' : undefined}
              disabled={tx.busy}
            />
            <ElasticSlider
              id={`${id}-slider`}
              label="Up to"
              min={Q_MIN}
              max={sliderMax}
              step={0.01}
              value={Math.max(Q_MIN, Math.min(sliderMax, qNum || Q_MIN))}
              onChange={(v) => setQ(v.toFixed(2))}
              disabled={tx.busy || sliderMax <= Q_MIN}
              format={(v) => `${v.toFixed(2)} MCU`}
            />
            <div className="grid grid-cols-3 gap-3">
              <Readout k="Locks" v={quoteWei !== null ? `${fmtAmount(quoteWei, 18, 2)} sMDM` : qWei === null ? '—' : 'Beyond the curve'} sub={quoteAfter !== null && Number.isFinite(quoteAfter) ? `${quoteAfter.toFixed(2)} from ${changeDay}` : undefined} />
              <Readout k="Credit" v={`${fmtUsd(credit)} / day`} tone="charge" sub="once staked" />
              <Readout k="Gives up" v={`~${fmtUsd(forgone)} / day`} tone={forgone > 0 ? 'bad' : undefined} sub="locked sMDM earns half" />
            </div>
            {costly && <Note tone="bad">Today that costs more than it pays{pendingChange ? `; the rate drops on ${changeDay}.` : '.'}</Note>}
            {connected ? (
              <>
                <Button magnet spark fullWidth size="lg" loading={tx.busy} disabled={!outPlan || !!outReason || tx.busy} disabledReason={outReason} onClick={() => outPlan && tx.run(outPlan)}>
                  {outPlan ? outPlan.verb : 'Check out MCU'}
                </Button>
                <TxProgress state={tx.state} />
              </>
            ) : (
              <ConnectPrompt action="check out MCU" />
            )}
            <Note>Mints MCU to your wallet and locks the quoted sMDM until you check it back in.</Note>
            <Details>
              <p>The curve is constant-product: MDM to lock = reserveMCU × reserveMDM ÷ (reserveMCU − q) − reserveMDM, rounded up. The quote you sign is computed exactly in wei from the reserves read a few seconds ago; the contract reverts if the pool moved against you.</p>
              <p>Locked sMDM keeps earning half of its staker share. &quot;Gives up&quot; prices that forgone half at the current Aerodrome spot. Stake the MCU on the Credit tab to earn $1 of API credit per MCU per day.</p>
            </Details>
          </section>
        </div>
      ) : (
        <div className="grid gap-8 min-[960px]:grid-cols-[1.15fr_1fr] min-[960px]:gap-12">
          <section aria-label="Open positions">{connected ? <PositionsList positions={positions} loading={!account} /> : <Note>Connect a wallet to see its positions.</Note>}</section>
          <section aria-label="Check-in form" className="flex flex-col gap-4">
            <Field
              id={`${id}-in`}
              label="MCU to check in"
              token="MCU"
              value={mcuIn}
              onChange={setMcuIn}
              onMax={connected ? () => setMcuIn(weiToInput(mcuBalance < outstanding ? mcuBalance : outstanding)) : undefined}
              helper={connected && account ? `Wallet ${fmtAmount(mcuBalance)} MCU · positions ${fmtAmount(outstanding)} MCU` : undefined}
              error={inError}
              disabled={!connected || tx.busy || (!!account && positions.length === 0)}
            />
            {connected ? (
              <>
                <Button variant="destructive" fullWidth size="lg" loading={tx.busy} disabled={!inPlan || !!inReason || tx.busy} disabledReason={inReason} onClick={() => inPlan && tx.run(inPlan)}>
                  {inPlan ? inPlan.verb : 'Check in MCU'}
                </Button>
                <TxProgress state={tx.state} />
              </>
            ) : (
              <ConnectPrompt action="check in MCU" />
            )}
            <Note>Burns MCU from your wallet, best rate first, and releases the sMDM each position recorded.</Note>
            <Details>
              <p>MCU staked in the vault must be unstaked (24 h) before it can be checked in. Check-in walks your positions from the best check-out rate down, so partial amounts always release the most sMDM per MCU first.</p>
            </Details>
          </section>
        </div>
      )}
    </>
  );
}

/** Open MCU positions as compact spotlight cards, best rate first. */
export function PositionsList({ positions, loading, className }: { positions: Position[]; loading?: boolean; className?: string }) {
  const items = positions.map((p, i) => ({ id: `${i}-${p.checkoutRate}-${p.mcuOutstanding}`, index: i, ...p }));
  if (loading) return <p className={className ?? 'text-[13px] text-ink-3'}>Reading positions…</p>;
  return (
    <AnimatedList
      items={items}
      className={className ?? 'grid gap-3 min-[560px]:grid-cols-2'}
      empty={
        <p className="text-[13px] text-ink-3">
          No MCU positions yet. Check out MCU on the{' '}
          <Link href="/mcu" className="font-medium text-signal hover:text-signal-2">
            MCU tab
          </Link>
          .
        </p>
      }
      renderItem={(p) => (
        <SpotlightCard as="div" className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Position #{p.index + 1}</div>
              <div className="font-display num mt-1 text-[24px] font-semibold text-ink">{fmtAmount(p.mcuOutstanding)} MCU</div>
            </div>
            <Chip>Locked</Chip>
          </div>
          <dl className="num mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
            <dt className="text-ink-3">Locked</dt>
            <dd className="text-right text-ink">{fmtAmount(p.mdmLocked)} sMDM</dd>
            <dt className="text-ink-3">Rate</dt>
            <dd className="text-right text-ink">{fmtAmount(p.checkoutRate, 18, 2)} MDM / MCU</dd>
          </dl>
        </SpotlightCard>
      )}
    />
  );
}
