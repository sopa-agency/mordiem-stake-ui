'use client';
// Small shared pieces for the screens: a ticking clock store, panel chrome, ledger rows, stats and the connect prompt.
import { useSyncExternalStore, type ReactNode } from 'react';
import { formatUnits } from 'viem';
import { cn } from '@/components/ui';
import { WalletMenu } from '@/components/wallet/WalletMenu';
import type { ProtocolState } from '@/hooks/useProtocol';
import type { AccountState } from '@/hooks/useAccountState';
import { GENESIS_TS, daysSinceGenesis } from '@/lib/protocol';
import { SCHEDULED_RESERVE_CHANGE } from '@/lib/contracts/addresses';

/** What every operation panel receives from the Dashboard. */
export type PanelProps = {
  protocol?: ProtocolState;
  account?: AccountState;
  /** An address is being shown (connected wallet or read-only view). */
  connected: boolean;
  /** Read-only view of another address: figures only, no actions. */
  readOnly?: boolean;
};

/** Fractional days since genesis as of `now` (falls back to the read time, then 0). */
export function dayIndex(protocol: ProtocolState | undefined, now: number | null): number {
  if (!protocol) return 0;
  const nowSec = now ?? Math.floor(protocol.readAt / 1000);
  if (!nowSec) return 0;
  return daysSinceGenesis(nowSec, protocol.genesisTs || GENESIS_TS);
}

/** True while the Timelock's reserve change is still ahead of `now` (null before hydration → false, so server and client agree). */
export function reserveChangePending(now: number | null): boolean {
  return now !== null && now < SCHEDULED_RESERVE_CHANGE.executableAt;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Oct 4" in the user's zone. Only call once `useNow()` is non-null (client), so server and client markup agree. */
export const shortDateLocal = (tsSec: number) => {
  const d = new Date(tsSec * 1000);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

// ───────────────────────────── clock ─────────────────────────────
// One interval for the whole page. Server snapshot is null so the first client paint matches the server
// and nothing time-dependent is computed during render.
let nowSec = Math.floor(Date.now() / 1000);
const subs = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(cb: () => void) {
  subs.add(cb);
  if (!timer) {
    nowSec = Math.floor(Date.now() / 1000);
    timer = setInterval(() => {
      nowSec = Math.floor(Date.now() / 1000);
      subs.forEach((s) => s());
    }, 1000);
  }
  return () => {
    subs.delete(cb);
    if (subs.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** Unix seconds, ticking once a second. `null` on the server and during hydration. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, () => nowSec, () => null);
}

/** False on the server and during hydration, true afterwards. */
export const useMounted = () => useSyncExternalStore(() => () => {}, () => true, () => false);

// ───────────────────────────── numbers ─────────────────────────────

/** bigint token amount → float for charts and CountUp (display only; never for tx args). */
export const toNum = (x: bigint | undefined, decimals = 18): number => (x === undefined ? 0 : Number(x) / 10 ** decimals);

/** Exact decimal string for an input field ("0.5424", "10"); round-trips through parseAmount. */
export const weiToInput = (x: bigint, decimals = 18): string => formatUnits(x, decimals);

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const pad2 = (n: number) => String(n).padStart(2, '0');
/** 7331 → "02:02:11" */
export const hms = (s: number) => `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;

// ───────────────────────────── chrome ─────────────────────────────

export function Panel({ eyebrow, title, aside, children, className }: { eyebrow?: string; title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex min-w-0 flex-col gap-5', className)} aria-label={title}>
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-rule pb-3">
        <div className="min-w-0">
          {eyebrow && <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{eyebrow}</div>}
          <h2 className="font-display text-[22px] font-semibold leading-tight text-ink">{title}</h2>
        </div>
        {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
      </header>
      {children}
    </section>
  );
}

/** Hairline ledger row: label on the left, number on the right (or a big figure when `big`). */
export function LedgerRow({ label, sub, value, unit, big, action, className }: { label: ReactNode; sub?: ReactNode; value: ReactNode; unit?: string; big?: boolean; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-rule-2 py-3', className)}>
      <div className="min-w-0">
        <div className={cn('text-ink-2', big ? 'text-[13px] font-medium uppercase tracking-[0.08em] text-ink-3' : 'text-[14px]')}>{label}</div>
        {sub && <div className="mt-0.5 text-[12px] text-ink-3">{sub}</div>}
      </div>
      <div className="flex min-w-0 items-center gap-4">
        <div className={cn('font-display num text-right text-ink', big ? 'text-[36px] font-semibold leading-none min-[720px]:text-[44px]' : 'text-[17px] font-medium')}>
          {value}
          {unit && <span className={cn('ml-1.5 font-medium text-ink-3', big ? 'text-[16px]' : 'text-[13px]')}>{unit}</span>}
        </div>
        {action}
      </div>
    </div>
  );
}

export function Stat({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{label}</span>
      <span className="font-display num truncate text-[20px] font-semibold text-ink">{children}</span>
    </div>
  );
}

/** Figure cell for readouts: small label, value, optional tone. */
export function Readout({ k, v, sub, tone, className }: { k: ReactNode; v: ReactNode; sub?: ReactNode; tone?: 'bad' | 'good' | 'charge'; className?: string }) {
  return (
    <div className={cn('edge flex min-w-0 flex-col gap-0.5 rounded-control bg-sheet-2 px-3 py-2.5 ring-1 ring-inset ring-rule-2', className)}>
      <span className="text-[11px] uppercase tracking-[0.08em] text-ink-3">{k}</span>
      <span className={cn('num truncate text-[15px] font-medium', tone === 'bad' ? 'text-bad' : tone === 'good' ? 'text-good' : tone === 'charge' ? 'text-charge' : 'text-ink')}>{v}</span>
      {sub && <span className="text-[11px] text-ink-3">{sub}</span>}
    </div>
  );
}

/** Where a form would be when no wallet is connected: one sentence plus the wallet control. */
export function ConnectPrompt({ action, className }: { action: string; className?: string }) {
  return (
    <div className={cn('edge flex flex-wrap items-center justify-between gap-3 rounded-control bg-sheet-2 px-4 py-3 ring-1 ring-inset ring-rule-2', className)}>
      <span className="text-[13px] text-ink-2">Connect wallet to {action}.</span>
      <WalletMenu />
    </div>
  );
}

/** Placeholder for a number that needs a wallet. */
export const Dash = () => <span className="text-ink-3">—</span>;

/** Quiet one-line note. */
export function Note({ children, tone, className }: { children: ReactNode; tone?: 'bad' | 'neutral'; className?: string }) {
  return <p className={cn('text-[12px] leading-snug', tone === 'bad' ? 'text-bad' : 'text-ink-3', className)}>{children}</p>;
}

/** Native checkbox on tokens. */
export function Checkbox({ id, checked, onChange, disabled, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; children: ReactNode }) {
  return (
    <label htmlFor={id} className={cn('inline-flex cursor-pointer select-none items-center gap-2 text-[12px] text-ink-2', disabled && 'cursor-not-allowed opacity-55')}>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-3.5 accent-signal" />
      {children}
    </label>
  );
}
