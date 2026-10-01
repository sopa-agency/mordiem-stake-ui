'use client';
// Overview: the epoch hero, a short wallet statement with each row linking to its tab, and open MCU positions.
// Also the read-only layout for /a/[address] (no actions).
import type { ReactNode } from 'react';
import type { Address } from 'viem';
import { Button, Chip, StarBorder } from '@/components/ui';
import { buildClaimRewardsPlan } from '@/lib/plans';
import { fmtAmount, fmtLocal, fmtUsd, fmtUtc, mcuPerDayCreditUsd } from '@/lib/protocol';
import { PositionsList } from './CheckOutPanel';
import { EpochMeter } from './EpochMeter';
import { ConnectPrompt, LedgerRow, Note, shortAddress, toNum, useNow } from './common';
import { TxProgress, useTxFlow } from './TxFlow';
import { useDashboardData } from './useDashboardData';

const ZERO = BigInt(0);

export function Overview({ address, readOnly = false }: { address?: Address; readOnly?: boolean }) {
  const d = useDashboardData(readOnly ? address : undefined);
  const { protocol, account: a, connected } = d;
  const now = useNow();
  const tx = useTxFlow();

  // Thawing across both queues: count, next unlock and which tab owns it.
  const queue = a
    ? [...a.mdmQueue.map((q) => ({ ...q, tab: '/stake', label: 'Stake' })), ...a.vault.queue.map((q) => ({ ...q, tab: '/credit', label: 'Credit' }))]
    : [];
  const next = now === null ? undefined : queue.filter((q) => q.unlockTimestamp > now).sort((x, y) => x.unlockTimestamp - y.unlockTimestamp)[0];
  const readyCount = now === null ? 0 : queue.filter((q) => q.unlockTimestamp <= now).length;
  const pending = a?.pendingRewards ?? ZERO;
  const eligible = toNum(a?.vault.eligible);
  const v = (x: bigint | undefined) => (a ? fmtAmount(x ?? ZERO) : '…');

  return (
    <>
      {readOnly && d.address && (
        <div className="flex flex-wrap items-center gap-3">
          <Chip tone="signal">Viewing {shortAddress(d.address)}</Chip>
          <span className="text-[13px] text-ink-3">Read-only. Connect this wallet to act on it.</span>
        </div>
      )}
      {d.protocolError && !protocol && <Note tone="bad">Could not reach Base right now; figures will appear when a node answers.</Note>}
      <EpochMeter protocol={protocol} account={a} connected={connected} readOnly={readOnly} address={d.address} />

      {!connected ? (
        <ConnectPrompt action="see your statement and positions" />
      ) : (
        <div className="grid gap-10 min-[960px]:grid-cols-[1.15fr_1fr] min-[960px]:gap-12">
          <section aria-label="Your statement" className="flex flex-col">
            <SectionTitle>{readOnly ? 'Statement' : 'Your statement'}</SectionTitle>
            <LedgerRow label="Staked MDM" value={v(a?.stakedAmount)} unit="sMDM" to={{ href: '/stake', label: 'Stake' }} />
            <LedgerRow label="Free sMDM" sub="Not locked behind any MCU." value={v(a?.freeStake)} unit="sMDM" to={{ href: '/stake', label: 'Stake' }} />
            <LedgerRow label="Locked behind MCU" sub="Earns half while locked." value={v(a?.lockedAmount)} unit="sMDM" to={{ href: '/mcu', label: 'MCU' }} />
            <LedgerRow
              label="Rewards to claim"
              value={v(pending)}
              unit="MDM"
              to={{ href: '/stake', label: 'Stake' }}
              action={
                !readOnly && pending > ZERO ? (
                  <StarBorder>
                    <Button variant="secondary" spark loading={tx.busy} onClick={() => tx.run(buildClaimRewardsPlan(pending))}>
                      Claim
                    </Button>
                  </StarBorder>
                ) : undefined
              }
            />
            <LedgerRow label="MCU in wallet" value={v(a?.mcuBalance)} unit="MCU" to={{ href: '/mcu', label: 'MCU' }} />
            <LedgerRow label="MCU eligible today" sub={a ? `${fmtUsd(mcuPerDayCreditUsd(eligible))} of API credit a day` : undefined} value={v(a?.vault.eligible)} unit="MCU" to={{ href: '/credit', label: 'Credit' }} />
            <LedgerRow
              label="Thawing"
              sub={
                !a
                  ? undefined
                  : readyCount > 0
                    ? `${readyCount} ready to claim`
                    : next
                      ? `Next ready ${fmtLocal(next.unlockTimestamp)} (${fmtUtc(next.unlockTimestamp)})`
                      : 'Nothing in either queue.'
              }
              value={a ? String(queue.length) : '…'}
              unit={queue.length === 1 ? 'item' : 'items'}
              to={next ? { href: next.tab, label: next.label } : { href: '/stake', label: 'Stake' }}
            />
            <TxProgress state={tx.state} className="mt-4" />
          </section>

          <section aria-label="Your positions" className="flex flex-col">
            <SectionTitle>{readOnly ? 'Positions' : 'Your positions'}</SectionTitle>
            <PositionsList positions={a?.positions ?? []} loading={!a} />
          </section>
        </div>
      )}
    </>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display mb-1 border-b border-rule pb-2 text-[18px] font-semibold text-ink">{children}</h2>;
}
