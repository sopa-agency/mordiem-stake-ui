'use client';
// Everything the wallet holds, as a statement: figures strip, then the MDM ledger, MCU positions (check-in) and the vault.
import { useAccountState } from '@/hooks/useAccountState';
import { useProtocol } from '@/hooks/useProtocol';
import { fmtAmount, fmtDuration, quoteCheckOut } from '@/lib/protocol';
import { CheckOutPanel } from './CheckOutPanel';
import { useViewedAddress } from './Dashboard';
import { MdmLedger } from './MdmLedger';
import { VaultPanel } from './VaultPanel';
import { ConnectPrompt, Dash, Stat, toNum } from './common';

const ZERO = BigInt(0);

export function PositionsView() {
  const viewed = useViewedAddress();
  const protocol = useProtocol();
  const account = useAccountState(viewed);
  const connected = !!viewed;
  const a = account.data;
  const p = protocol.data;
  const panel = { protocol: p, account: a, connected };

  const mdmThawing = a?.mdmQueue.reduce((acc, q) => acc + q.amount, ZERO) ?? ZERO;
  const rate = p ? quoteCheckOut(toNum(p.reserveMdm), toNum(p.reserveMcu), 1) : 0;

  return (
    <>
      <section aria-label="Statement" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Statement</div>
            <h1 className="font-display text-[28px] font-semibold leading-tight text-ink">Your positions</h1>
          </div>
          {p && (
            <p className="num text-[12px] text-ink-3">
              Today 1 MCU locks {rate.toFixed(2)} MDM · MDM thaw {fmtDuration(p.mdmThawSec)} · MCU thaw {fmtDuration(p.mcuThawSec)}
            </p>
          )}
        </div>
        <div className="edge grid grid-cols-2 gap-x-4 gap-y-5 rounded-sheet bg-sheet px-5 py-5 ring-1 ring-inset ring-rule min-[720px]:grid-cols-4 min-[1000px]:grid-cols-7">
          <Figure label="Staked" unit="sMDM" value={a && connected ? fmtAmount(a.stakedAmount) : null} />
          <Figure label="Free" unit="sMDM" value={a && connected ? fmtAmount(a.freeStake) : null} />
          <Figure label="Locked" unit="sMDM" value={a && connected ? fmtAmount(a.lockedAmount) : null} />
          <Figure label="Rewards" unit="MDM" value={a && connected ? fmtAmount(a.pendingRewards) : null} />
          <Figure label="MCU positions" unit={a && a.positions.length === 1 ? 'open' : 'open'} value={a && connected ? String(a.positions.length) : null} />
          <Figure label="MCU eligible" unit="MCU" value={a && connected ? fmtAmount(a.vault.eligible) : null} />
          <Figure label="Thawing" unit="MDM" value={a && connected ? fmtAmount(mdmThawing) : null} sub={a && connected ? `${fmtAmount(a.vault.thawing)} MCU` : undefined} />
        </div>
        {!connected && <ConnectPrompt action="see your positions" />}
      </section>

      <div className="grid gap-8 min-[960px]:grid-cols-2 min-[960px]:gap-10">
        <MdmLedger {...panel} />
        <div className="flex flex-col gap-8 min-[960px]:gap-10">
          <CheckOutPanel {...panel} initialMode="checkin" title="MCU positions" />
          <VaultPanel {...panel} />
        </div>
      </div>
    </>
  );
}

function Figure({ label, value, unit, sub }: { label: string; value: string | null; unit: string; sub?: string }) {
  return (
    <Stat label={label}>
      {value === null ? (
        <Dash />
      ) : (
        <>
          {value} <span className="text-[12px] font-medium text-ink-3">{unit}</span>
          {sub && <span className="block text-[12px] font-medium text-ink-3">{sub}</span>}
        </>
      )}
    </Stat>
  );
}
