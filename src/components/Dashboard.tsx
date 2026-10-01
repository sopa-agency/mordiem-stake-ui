'use client';
// Home composition: hero + MDM ledger (left) + MCU check-out and vault (right). Also the read-only view of any address.
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { Chip } from '@/components/ui';
import { useAccountState } from '@/hooks/useAccountState';
import { useProtocol } from '@/hooks/useProtocol';
import { CheckOutPanel } from './CheckOutPanel';
import { EpochMeter } from './EpochMeter';
import { MdmLedger } from './MdmLedger';
import { VaultPanel } from './VaultPanel';
import { Note, shortAddress } from './common';

export function useViewedAddress(readOnlyAddress?: Address): Address | undefined {
  const conn = useConnection();
  if (readOnlyAddress) return readOnlyAddress;
  return conn.status === 'connected' ? conn.address : undefined;
}

export function Dashboard({ address, readOnly = false }: { address?: Address; readOnly?: boolean }) {
  const viewed = useViewedAddress(readOnly ? address : undefined);
  const protocol = useProtocol();
  const account = useAccountState(viewed);
  const connected = !!viewed;
  const panel = { protocol: protocol.data, account: account.data, connected, readOnly };

  return (
    <>
      {readOnly && viewed && (
        <div className="flex flex-wrap items-center gap-3">
          <Chip tone="signal">Viewing {shortAddress(viewed)}</Chip>
          <span className="text-[13px] text-ink-3">Read-only. Connect this wallet to act on it.</span>
        </div>
      )}
      {protocol.error && !protocol.data && <Note tone="bad">Could not reach Base right now; figures will appear when a node answers.</Note>}
      <EpochMeter {...panel} address={viewed} />
      <div className="grid gap-8 min-[960px]:grid-cols-2 min-[960px]:gap-10">
        <MdmLedger {...panel} />
        <div className="flex flex-col gap-8 min-[960px]:gap-10">
          <CheckOutPanel {...panel} />
          <VaultPanel {...panel} />
        </div>
      </div>
    </>
  );
}
