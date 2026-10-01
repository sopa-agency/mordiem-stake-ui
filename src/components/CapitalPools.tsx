'use client';
// Stake → Capital pools: USDC, wstETH, MOR, VVV deposits that earn MDM from the capital half of the emission.
// One SpotlightCard per asset: totals, your principal, MDM to claim, pool MDM/day and yours, deposit / withdraw, queue.
import { useId, useMemo, useState } from 'react';
import type { Address } from 'viem';
import { Button, Chip, Field, Segmented, SpotlightCard, StarBorder } from '@/components/ui';
import { useCapital, type CapitalPool } from '@/hooks/useCapital';
import type { ProtocolState } from '@/hooks/useProtocol';
import { buildCapitalClaimRewardsPlan, buildCapitalClaimWithdrawPlan, buildCapitalDepositPlan, buildCapitalWithdrawPlan, needsApprove } from '@/lib/plans';
import { emissionPerDay, fmtAmount, fmtLocal, fmtNumber, fmtPct, fmtUsd, fmtUtc, mdmPriceUsd, parseAmount } from '@/lib/protocol';
import { Checkbox, ConnectPrompt, Details, Note, PageHeader, dayIndex, toNum, useNow, weiToInput } from './common';
import { QueueList } from './Queues';
import { TxProgress, useTxFlow } from './TxFlow';

const ZERO = BigInt(0);

/** The capital half of today's emission, split by each pool's realised-yield weight (realisedMode). */
export function poolMdmPerDay(pool: CapitalPool, pools: CapitalPool[], tDays: number, realisedMode: boolean): number {
  const sum = pools.reduce((acc, p) => acc + toNum(p.trailingRealised, 6), 0);
  if (!realisedMode || !(sum > 0)) return 0;
  return (emissionPerDay(tDays) / 2) * (toNum(pool.trailingRealised, 6) / sum);
}

export function CapitalPools({ protocol, connected, readOnly, address }: { protocol?: ProtocolState; connected: boolean; readOnly?: boolean; address?: Address }) {
  const now = useNow();
  const cap = useCapital(connected ? address : undefined);
  const t = dayIndex(protocol, now);
  const price = protocol ? mdmPriceUsd(protocol.poolUsdc, protocol.poolMdm) : 0;
  const c = cap.data;

  return (
    <>
      <PageHeader eyebrow="Stake" title="Capital pools" aside={c?.pausedDeposit && <Chip>Deposits paused by the guardian; withdrawals still work</Chip>}>
        <Note>Lend USDC, wstETH, MOR or VVV; the protocol keeps the venue yield and pays you MDM from half of each day&apos;s emission. Principal comes back after a 7-day thaw.</Note>
      </PageHeader>
      {cap.error && !c && <Note tone="bad">Could not read the capital pools right now.</Note>}
      {!connected && <ConnectPrompt action="deposit into a pool" />}

      <div className="grid gap-4 min-[840px]:grid-cols-2 min-[840px]:gap-6">
        {(c?.pools ?? []).map((pool) => (
          <PoolCard key={pool.sym} pool={pool} pools={c!.pools} realisedMode={c!.realisedMode} thawSec={c!.thawSec} pausedDeposit={c!.pausedDeposit} t={t} price={price} now={now} connected={connected} readOnly={readOnly} />
        ))}
        {!c && !cap.error && <p className="text-[13px] text-ink-3">Reading the pools…</p>}
      </div>
    </>
  );
}

type Mode = 'deposit' | 'withdraw';

function PoolCard({ pool, pools, realisedMode, thawSec, pausedDeposit, t, price, now, connected, readOnly }: { pool: CapitalPool; pools: CapitalPool[]; realisedMode: boolean; thawSec: number; pausedDeposit: boolean; t: number; price: number; now: number | null; connected: boolean; readOnly?: boolean }) {
  const id = useId();
  const [mode, setMode] = useState<Mode>('deposit');
  const [amount, setAmount] = useState('');
  const [unlimited, setUnlimited] = useState(false);
  const tx = useTxFlow(() => setAmount(''));

  const u = pool.user;
  const d = pool.decimals;
  const isUsdc = pool.sym === 'USDC';
  const isWst = pool.sym === 'wstETH';
  const approx = isWst ? '≈ ' : '';
  const fmt = (x: bigint, frac = 4) => fmtAmount(x, d, frac);

  const perDayPool = poolMdmPerDay(pool, pools, t, realisedMode);
  const share = u && pool.totalPrincipal > ZERO ? toNum(u.principal, d) / toNum(pool.totalPrincipal, d) : 0;
  const perDayYours = perDayPool * share;
  const principalUsd = isUsdc && u ? toNum(u.principal, 6) : 0;
  const aprMdm = isUsdc && principalUsd > 0 ? ((perDayYours * price * 365) / principalUsd) * 100 : null;

  const max = mode === 'deposit' ? (u?.balance ?? ZERO) : (u?.principal ?? ZERO);
  const wei = useMemo(() => (amount.trim() === '' ? null : parseAmount(amount, d)), [amount, d]);
  const invalid = amount.trim() !== '' && wei === null;
  const over = wei !== null && wei > max;
  const fieldError = invalid ? `Enter a valid amount (up to ${d} decimals).` : over ? (mode === 'deposit' ? `You only have ${fmt(max)} ${pool.sym}.` : `You only have ${approx}${fmt(max)} ${pool.sym} deposited.`) : undefined;
  const plan = wei !== null && wei > ZERO
    ? mode === 'deposit'
      ? buildCapitalDepositPlan(pool, wei, { allowance: u?.allowance ?? ZERO, unlimited })
      : buildCapitalWithdrawPlan(pool, wei)
    : null;
  const reason = !u ? undefined : mode === 'deposit' && pausedDeposit ? 'Deposits are paused by the guardian; withdrawals still work.' : fieldError;
  const claiming = tx.busy && tx.state.verb.startsWith('Claim');
  const hasQueue = !!u && (u.queue.length > 0 || u.matured > ZERO);

  const switchMode = (m: Mode) => {
    setMode(m);
    setAmount('');
    tx.reset();
  };

  return (
    <SpotlightCard as="section" className="flex flex-col p-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-[22px] font-semibold leading-tight text-ink">{pool.sym}</h2>
            <p className="truncate text-[12px] text-ink-3">{pool.venue}</p>
          </div>
          <Chip className="shrink-0">{realisedMode ? `${fmtPct(pools.reduce((a, p) => a + toNum(p.trailingRealised, 6), 0) > 0 ? (toNum(pool.trailingRealised, 6) / pools.reduce((a, p) => a + toNum(p.trailingRealised, 6), 0)) * 100 : 0, 0)} share` : 'Bootstrap mode'}</Chip>
        </div>

        <dl className="num grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
          <Fig label="Pool total" value={`${fmt(pool.totalPrincipal, 2)} ${pool.sym}`} sub={isUsdc ? fmtUsd(toNum(pool.totalPrincipal, 6)) : undefined} />
          <Fig label="Pool MDM / day" value={`${perDayPool.toFixed(2)} MDM`} sub={price > 0 ? `${fmtUsd(perDayPool * price)} at spot` : undefined} />
          <Fig label="Your principal" value={connected ? (u ? `${approx}${fmt(u.principal)} ${pool.sym}` : '…') : '—'} sub={isWst ? 'Paid back as the same stETH value' : undefined} />
          <Fig label="Yours / day" value={connected ? (u ? `${perDayYours.toFixed(4)} MDM` : '…') : '—'} sub={u && perDayYours > 0 ? `${fmtUsd(perDayYours * price)} at spot${aprMdm !== null ? ` · ${fmtPct(aprMdm, 1)} APR, paid in MDM` : ''}` : undefined} />
        </dl>

        {connected && u && (
          <div className="flex items-center justify-between gap-3 border-t border-rule-2 pt-3">
            <div className="num text-[13px]">
              <span className="text-ink-2">MDM to claim</span> <span className="font-display ml-2 text-[17px] font-medium text-ink">{fmtAmount(u.pending)}</span>
            </div>
            {!readOnly &&
              (u.pending > ZERO ? (
                <StarBorder>
                  <Button variant="secondary" spark loading={claiming} disabled={tx.busy} onClick={() => tx.run(buildCapitalClaimRewardsPlan(pool, u.pending))}>
                    Claim
                  </Button>
                </StarBorder>
              ) : (
                <Button variant="secondary" disabled>
                  Claim
                </Button>
              ))}
          </div>
        )}

        {!readOnly && (
          <div className="flex flex-col gap-3 border-t border-rule-2 pt-4">
            <Segmented
              aria-label={`Deposit or withdraw ${pool.sym}`}
              value={mode}
              onChange={switchMode}
              options={[
                { value: 'deposit', label: 'Deposit' },
                { value: 'withdraw', label: 'Withdraw' },
              ]}
            />
            <Field
              id={`${id}-amount`}
              label={mode === 'deposit' ? `${pool.sym} to deposit` : `${pool.sym} to withdraw`}
              token={pool.sym}
              value={amount}
              onChange={setAmount}
              decimals={d}
              onMax={connected && u ? () => setAmount(weiToInput(max, d)) : undefined}
              helper={connected && u ? (mode === 'deposit' ? `Wallet ${fmt(u.balance)} ${pool.sym}` : `Deposited ${approx}${fmt(u.principal)} ${pool.sym}`) : undefined}
              error={fieldError}
              disabled={!connected || tx.busy}
            />
            {connected ? (
              <>
                <Button magnet spark fullWidth variant={mode === 'deposit' ? 'primary' : 'secondary'} loading={tx.busy && !claiming} disabled={!plan || !!reason || tx.busy} disabledReason={reason} onClick={() => plan && tx.run(plan)}>
                  {plan ? plan.verb : mode === 'deposit' ? `Deposit ${pool.sym}` : 'Request withdraw'}
                </Button>
                {mode === 'deposit' && plan && needsApprove(plan) && (
                  <Checkbox id={`${id}-unlimited`} checked={unlimited} onChange={setUnlimited} disabled={tx.busy}>
                    Approve unlimited {pool.sym} so future deposits skip the approve step
                  </Checkbox>
                )}
                <TxProgress state={tx.state} />
              </>
            ) : null}
            <Note>{mode === 'deposit' ? `Deposits start earning MDM on the next emission tick; the venue yield goes to the protocol.` : `Moves principal into the 7-day queue; it stops earning MDM now.`}</Note>
            <Details>
              <p>{detailLine(pool, now)}</p>
            </Details>
          </div>
        )}
        {readOnly && (
          <Details>
            <p>{detailLine(pool, now)}</p>
          </Details>
        )}

        {hasQueue && u && (
          <div className="flex flex-col gap-3 border-t border-rule-2 pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">Withdraw queue</h3>
              <span className="text-[12px] text-ink-3">7 days from request</span>
            </div>
            <QueueList items={u.queue} thawSec={thawSec} token={pool.sym} decimals={d} now={now} matured={u.matured} onClaim={() => tx.run(buildCapitalClaimWithdrawPlan(pool, u.matured))} busy={tx.busy} readOnly={readOnly} empty="" />
          </div>
        )}
      </div>
    </SpotlightCard>
  );
}

function detailLine(pool: CapitalPool, now: number | null): string {
  switch (pool.sym) {
    case 'USDC':
      return 'Aave V3, instant at the venue; 7-day thaw.';
    case 'wstETH':
      return `You get back the same stETH value, slightly fewer wstETH tokens as the Lido rate rises; 7 days.${pool.currentRate ? ` 1 wstETH = ${fmtNumber(toNum(pool.currentRate), 4)} stETH now.` : ''}`;
    case 'MOR':
      return `7 days, then only the weekly withdraw bridge pays out: it has ${pool.claimableLiquidity !== undefined ? fmtAmount(pool.claimableLiquidity, 18, 0) : '…'} MOR available this week.`;
    case 'VVV': {
      const m = pool.cooldownMaturity ?? 0;
      const running = m > 0 && (now === null || m > now);
      return `7 days; Venice allows one shared cooldown, a request during one waits for the next batch. ${running ? `The current one ends ${fmtLocal(m)} (${fmtUtc(m)}).` : 'No cooldown is running now.'}`;
    }
    default:
      return '';
  }
}

function Fig({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{label}</dt>
      <dd className="font-display truncate text-[17px] font-medium text-ink">{value}</dd>
      {sub && <dd className="truncate text-[11px] text-ink-3">{sub}</dd>}
    </div>
  );
}
