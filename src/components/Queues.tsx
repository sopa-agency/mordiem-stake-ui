'use client';
// Unstake queues as draining rings, with exact unlock times in the user's zone and UTC. Used for MDM (7 d) and MCU (24 h).
import { AnimatedList, Button, Chip, Ring, ShinyText } from '@/components/ui';
import type { QueueItem } from '@/hooks/useAccountState';
import { fmtAmount, fmtDuration, fmtLocal, fmtUtc, thawProgress } from '@/lib/protocol';

export type QueueListProps = {
  items: QueueItem[];
  thawSec: number;
  token: 'MDM' | 'MCU';
  /** Unix seconds; null before hydration. */
  now: number | null;
  /** Sum of matured items (claimable now). */
  matured: bigint;
  onClaim?: () => void;
  busy?: boolean;
  readOnly?: boolean;
  empty: string;
};

const ringLabel = (remaining: number) => {
  if (remaining >= 86400) return `${Math.floor(remaining / 86400)}d`;
  if (remaining >= 3600) return `${Math.floor(remaining / 3600)}h`;
  return `${Math.max(1, Math.ceil(remaining / 60))}m`;
};

export function QueueList({ items, thawSec, token, now, matured, onClaim, busy, readOnly, empty }: QueueListProps) {
  const rows = items.map((q, i) => ({ id: `${q.unlockTimestamp}-${i}`, ...q }));
  const sym = token === 'MDM' ? 'sMDM' : 'MCU';
  return (
    <div className="flex flex-col gap-3">
      <AnimatedList
        items={rows}
        empty={<p className="text-[13px] text-ink-3">{empty}</p>}
        renderItem={(q) => {
          const ready = now !== null && q.unlockTimestamp <= now;
          const remaining = now === null ? thawSec : Math.max(0, q.unlockTimestamp - now);
          const progress = now === null ? 0 : thawProgress(q.unlockTimestamp, thawSec, now);
          return (
            <div className="edge flex items-center justify-between gap-3 rounded-control bg-sheet-2 px-4 py-3 ring-1 ring-inset ring-rule-2">
              <div className="num min-w-0 text-[13px]">
                <div className="font-medium text-ink">
                  {fmtAmount(q.amount)} {sym} {ready ? 'ready' : 'thawing'}
                </div>
                <div className="truncate text-ink-3">
                  {ready ? 'Since' : 'Ready'} {fmtLocal(q.unlockTimestamp)} <span className="text-ink-3/80">({fmtUtc(q.unlockTimestamp)})</span>
                </div>
              </div>
              {ready ? (
                <Chip tone="good" pulse>
                  <ShinyText tone="good">Ready</ShinyText>
                </Chip>
              ) : (
                <Ring progress={progress} size={40} stroke={4} tone="thaw" label={ringLabel(remaining)} title={`Thawing, ${Math.round(progress * 100)}% done, ${fmtDuration(remaining)} left`} />
              )}
            </div>
          );
        }}
      />
      {matured > BigInt(0) && !readOnly && onClaim && (
        <Button magnet spark fullWidth loading={busy} onClick={onClaim}>
          Claim {fmtAmount(matured)} {token}
        </Button>
      )}
    </div>
  );
}
