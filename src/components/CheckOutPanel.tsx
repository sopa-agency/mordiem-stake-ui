'use client';
// MCU check-out with the curve drawn to scale from live reserves (and the forgone-rewards cost), and check-in of open positions.
import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatedList, Button, Chip, ElasticSlider, Field, Segmented, SpotlightCard } from '@/components/ui';
import type { Position } from '@/hooks/useAccountState';
import { SCHEDULED_RESERVE_CHANGE } from '@/lib/contracts/addresses';
import { buildCheckInPlan, buildCheckOutPlan } from '@/lib/plans';
import { fmtAmount, fmtUsd, forgoneRewardsUsdPerDay, mcuPerDayCreditUsd, mdmPriceUsd, parseAmount, quoteCheckOut, quoteCheckOutWei } from '@/lib/protocol';
import { Checkbox, ConnectPrompt, Note, Panel, Readout, dayIndex, reserveChangePending, shortDateLocal, toNum, useNow, weiToInput, type PanelProps } from './common';
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

export function CheckOutPanel({ protocol, account, connected, readOnly, initialMode = 'checkout', title }: PanelProps & { initialMode?: Mode; title?: string }) {
  const id = useId();
  const now = useNow();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [q, setQ] = useState('1');
  const [mcuIn, setMcuIn] = useState('');
  const [showAfter, setShowAfter] = useState(true);
  const tx = useTxFlow(() => {
    if (mode === 'checkin') setMcuIn('');
  });

  const rMdm = toNum(protocol?.reserveMdm);
  const rMcu = toNum(protocol?.reserveMcu);
  const t = dayIndex(protocol, now);
  const price = protocol ? mdmPriceUsd(protocol.poolUsdc, protocol.poolMdm) : 0;
  const pendingChange = reserveChangePending(now) && !!protocol;
  const changeDay = shortDateLocal(SCHEDULED_RESERVE_CHANGE.executableAt);

  // ── check-out ──
  const free = account?.freeStake ?? ZERO;
  const freeNum = toNum(free);
  const qCap = connected && account ? Math.min(Q_MAX, Math.floor(affordable(rMdm, rMcu, freeNum) * 100) / 100) : Q_MAX;
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
  const inInvalid = mcuIn.trim() !== '' && inWei === null;
  const inError = inInvalid
    ? 'Enter a valid amount.'
    : inWei !== null && inWei > mcuBalance
      ? `You only have ${fmtAmount(mcuBalance)} MCU in your wallet.`
      : inWei !== null && inWei > outstanding
        ? `Your positions hold ${fmtAmount(outstanding)} MCU.`
        : undefined;
  const inReason = !account
    ? undefined
    : positions.length === 0
      ? 'You have no MCU positions to check in.'
      : inWei === null || inWei === ZERO
        ? 'Enter an amount of MCU.'
        : inError;
  const inPlan = inWei !== null && inWei > ZERO ? buildCheckInPlan(inWei) : null;

  const switchMode = (m: Mode) => {
    setMode(m);
    tx.reset();
  };

  return (
    <Panel
      eyebrow="MCU"
      title={title ?? 'Check out MCU'}
      aside={
        <>
          {protocol?.paused.checkOut && <Chip>Check-out paused by the guardian</Chip>}
          {!readOnly && (
            <Segmented
              aria-label="Check out or check in"
              value={mode}
              onChange={switchMode}
              options={[
                { value: 'checkout', label: 'Check out' },
                { value: 'checkin', label: 'Check in' },
              ]}
            />
          )}
        </>
      }
    >
      {mode === 'checkout' || readOnly ? (
        <div className="flex flex-col gap-5">
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

          {readOnly && <PositionsList positions={positions} connected={connected} />}

          {!readOnly && (
            <>
              <div className="grid gap-4 min-[560px]:grid-cols-[1fr_1fr]">
                <Field
                  id={`${id}-q`}
                  label="MCU to check out"
                  token="MCU"
                  value={q}
                  onChange={setQ}
                  onMax={connected && account ? () => setQ(qCap.toFixed(2)) : undefined}
                  helper={connected && account ? `Free ${fmtAmount(free)} sMDM` : 'Quote only until you connect'}
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
                  className="self-end pb-1"
                />
              </div>

              <div className="grid gap-3 min-[560px]:grid-cols-3">
                <Readout k="Locks" v={quoteWei !== null ? `${fmtAmount(quoteWei)} sMDM` : qWei === null ? '—' : 'More than the curve holds'} sub={quoteAfter !== null && Number.isFinite(quoteAfter) ? `${quoteAfter.toFixed(2)} from ${changeDay}` : 'Released when you check in'} />
                <Readout k="Credit once staked" v={`${fmtUsd(credit)} / day`} tone="charge" sub="$1 per MCU per day" />
                <Readout k="Gives up" v={`about ${fmtUsd(forgone)} / day`} tone={forgone > 0 ? 'bad' : undefined} sub="locked sMDM earns half" />
              </div>
              {costly && (
                <Note tone="bad">
                  Today that costs more than it pays{pendingChange ? `; the rate drops on ${changeDay}.` : '.'}
                </Note>
              )}

              {connected ? (
                <div className="flex flex-col gap-3">
                  <Button magnet spark fullWidth size="lg" loading={tx.busy} disabled={!outPlan || !!outReason || tx.busy} disabledReason={outReason} onClick={() => outPlan && tx.run(outPlan)}>
                    {outPlan ? outPlan.verb : 'Check out MCU'}
                  </Button>
                  <Note>Mints MCU to your wallet and locks the quoted sMDM until you check it back in. Stake the MCU in the vault to start earning credit.</Note>
                  <TxProgress state={tx.state} />
                </div>
              ) : (
                <ConnectPrompt action="check out MCU" />
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <PositionsList positions={positions} connected={connected} />
          {connected ? (
            <div className="flex flex-col gap-3">
              <Field
                id={`${id}-in`}
                label="MCU to check in"
                token="MCU"
                value={mcuIn}
                onChange={setMcuIn}
                onMax={() => setMcuIn(weiToInput(mcuBalance < outstanding ? mcuBalance : outstanding))}
                helper={`Wallet ${fmtAmount(mcuBalance)} MCU · positions ${fmtAmount(outstanding)} MCU`}
                error={inError}
                disabled={tx.busy || positions.length === 0}
              />
              <Button variant="destructive" fullWidth size="lg" loading={tx.busy} disabled={!inPlan || !!inReason || tx.busy} disabledReason={inReason} onClick={() => inPlan && tx.run(inPlan)}>
                {inPlan ? inPlan.verb : 'Check in MCU'}
              </Button>
              <Note>Burns MCU from your wallet, best rate first, and releases the sMDM each position recorded. MCU staked in the vault must be unstaked first.</Note>
              <TxProgress state={tx.state} />
            </div>
          ) : (
            <ConnectPrompt action="check in MCU" />
          )}
        </div>
      )}
    </Panel>
  );
}

/** Open MCU positions as spotlight cards, best rate first. */
export function PositionsList({ positions, connected, className }: { positions: Position[]; connected: boolean; className?: string }) {
  const items = positions.map((p, i) => ({ id: `${i}-${p.checkoutRate}-${p.mcuOutstanding}`, index: i, ...p }));
  return (
    <div className={className}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-medium uppercase tracking-[0.08em] text-ink-3">Open positions</h3>
        {positions.length > 0 && <span className="text-[12px] text-ink-3">Check-in takes the best rate first</span>}
      </div>
      {!connected ? (
        <p className="text-[13px] text-ink-3">Connect a wallet to see its positions.</p>
      ) : (
        <AnimatedList
          items={items}
          className="grid gap-3 min-[560px]:grid-cols-2"
          empty={
            <p className="text-[13px] text-ink-3">
              No MCU positions yet. Check out MCU from the <Link href="/" className="font-medium text-signal hover:text-signal-2">Stake page</Link>.
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
      )}
    </div>
  );
}
