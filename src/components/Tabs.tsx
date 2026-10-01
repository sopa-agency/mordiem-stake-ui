'use client';
// Thin client wrappers: each tab panel receives the viewed address's protocol and account reads.
import { CheckOutPanel } from './CheckOutPanel';
import { CreditPanel } from './CreditPanel';
import { MdmLedger } from './MdmLedger';
import { Note } from './common';
import { useDashboardData } from './useDashboardData';

function ChainNote({ error, hasData }: { error?: Error; hasData: boolean }) {
  return error && !hasData ? <Note tone="bad">Could not reach Base right now; figures will appear when a node answers.</Note> : null;
}

export function StakeTab() {
  const d = useDashboardData();
  return (
    <>
      <ChainNote error={d.protocolError} hasData={!!d.protocol} />
      <MdmLedger {...d} />
    </>
  );
}

export function McuTab() {
  const d = useDashboardData();
  return (
    <>
      <ChainNote error={d.protocolError} hasData={!!d.protocol} />
      <CheckOutPanel {...d} />
    </>
  );
}

export function CreditTab() {
  const d = useDashboardData();
  return (
    <>
      <ChainNote error={d.protocolError} hasData={!!d.protocol} />
      <CreditPanel {...d} />
    </>
  );
}
