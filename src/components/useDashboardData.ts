'use client';
// The address being shown (connected wallet, or a read-only address) plus its protocol and account reads.
import type { Address } from 'viem';
import { useConnection } from 'wagmi';
import { useAccountState } from '@/hooks/useAccountState';
import { useProtocol } from '@/hooks/useProtocol';
import type { PanelProps } from './common';

export function useViewedAddress(readOnlyAddress?: Address): Address | undefined {
  const conn = useConnection();
  if (readOnlyAddress) return readOnlyAddress;
  return conn.status === 'connected' ? conn.address : undefined;
}

export function useDashboardData(readOnlyAddress?: Address): PanelProps & { address?: Address; protocolError?: Error } {
  const viewed = useViewedAddress(readOnlyAddress);
  const protocol = useProtocol();
  const account = useAccountState(viewed);
  return { protocol: protocol.data, account: account.data, connected: !!viewed, readOnly: !!readOnlyAddress, address: viewed, protocolError: protocol.error };
}
