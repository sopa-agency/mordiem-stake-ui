'use client';
// Thin client wrappers: each tab panel receives the viewed address's protocol and account reads.
import { useRouter } from 'next/navigation';
import { Segmented } from '@/components/ui';
import { CapitalPools } from './CapitalPools';
import { CheckOutPanel } from './CheckOutPanel';
import { CreditPanel } from './CreditPanel';
import { MdmLedger } from './MdmLedger';
import { Note } from './common';
import { useDashboardData } from './useDashboardData';

function ChainNote({ error, hasData }: { error?: Error; hasData: boolean }) {
  return error && !hasData ? <Note tone="bad">Could not reach Base right now; figures will appear when a node answers.</Note> : null;
}

type StakeView = 'mdm' | 'pools';

/** Top-level switch inside Stake: the MDM ledger at /stake, the capital pools at /stake/pools (so the path drives Vlad and the nav). */
function StakeSwitch({ view }: { view: StakeView }) {
  const router = useRouter();
  return (
    <div className="-mb-2 flex">
      <Segmented
        aria-label="Stake MDM or deposit into capital pools"
        size="lg"
        value={view}
        onChange={(v) => router.push(v === 'mdm' ? '/stake' : '/stake/pools')}
        options={[
          { value: 'mdm', label: 'MDM' },
          { value: 'pools', label: 'Capital pools' },
        ]}
      />
    </div>
  );
}

export function StakeTab() {
  const d = useDashboardData();
  return (
    <>
      <StakeSwitch view="mdm" />
      <ChainNote error={d.protocolError} hasData={!!d.protocol} />
      <MdmLedger {...d} />
    </>
  );
}

export function PoolsTab() {
  const d = useDashboardData();
  return (
    <>
      <StakeSwitch view="pools" />
      <ChainNote error={d.protocolError} hasData={!!d.protocol} />
      <CapitalPools protocol={d.protocol} connected={d.connected} address={d.address} />
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
