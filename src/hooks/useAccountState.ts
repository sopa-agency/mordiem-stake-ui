'use client';
// Everything the dashboard shows for one wallet, in one multicall, refreshed every 12 s. Values stay bigint.
import { useMemo } from 'react';
import { useReadContracts } from 'wagmi';
import type { Address } from 'viem';
import { ADDR, CHAIN_ID } from '@/lib/contracts/addresses';
import { coreAbi, erc20Abi, vaultAbi } from '@/lib/contracts/abis';
import { REFETCH_MS } from './useProtocol';

export type QueueItem = { amount: bigint; unlockTimestamp: number };
export type Position = { mcuOutstanding: bigint; mdmLocked: bigint; checkoutRate: bigint };

export type AccountState = {
  mdmBalance: bigint;
  mcuBalance: bigint;
  mdmAllowanceCore: bigint;
  mcuAllowanceVault: bigint;
  /** Core.stakes(user).amount: all sMDM, free + locked. */
  stakedAmount: bigint;
  /** sMDM locked behind open MCU positions. */
  lockedAmount: bigint;
  /** stakedAmount − lockedAmount, floored at 0. */
  freeStake: bigint;
  pendingRewards: bigint;
  positions: Position[];
  /** Pending MDM unstake requests from the queue head on (oldest first). */
  mdmQueue: QueueItem[];
  /** Sum of queue items whose unlock time has passed (claimable with claimUnstaked). */
  mdmMatured: bigint;
  vault: {
    staked: bigint;
    eligible: bigint;
    thawing: bigint;
    queue: QueueItem[];
    matured: bigint;
  };
  genesisRestricted: boolean;
  readAt: number;
};

type Result = { status: 'success'; result: unknown } | { status: 'failure'; error: Error; result?: undefined };
const big = (r: Result | undefined): bigint => (r?.status === 'success' && typeof r.result === 'bigint' ? r.result : 0n);
const bool = (r: Result | undefined): boolean => (r?.status === 'success' && typeof r.result === 'boolean' ? r.result : false);

function queue(r: Result | undefined, head: bigint): QueueItem[] {
  if (r?.status !== 'success' || !Array.isArray(r.result)) return [];
  const all = r.result as readonly { amount: bigint; unlockTimestamp: bigint }[];
  return all.slice(Number(head)).map((q) => ({ amount: q.amount, unlockTimestamp: Number(q.unlockTimestamp) }));
}

const maturedOf = (items: QueueItem[], nowSec: number) => items.reduce((acc, q) => (q.unlockTimestamp <= nowSec ? acc + q.amount : acc), 0n);

const ZERO = '0x0000000000000000000000000000000000000000' as Address;

export function useAccountState(address?: Address): { data?: AccountState; isLoading: boolean; error?: Error; refetch: () => void } {
  const user = address ?? ZERO;
  const core = { address: ADDR.Core, abi: coreAbi, chainId: CHAIN_ID } as const;
  const vault = { address: ADDR.Vault, abi: vaultAbi, chainId: CHAIN_ID } as const;

  const q = useReadContracts({
    contracts: [
      { address: ADDR.MDM, abi: erc20Abi, chainId: CHAIN_ID, functionName: 'balanceOf', args: [user] }, // 0
      { address: ADDR.MDM, abi: erc20Abi, chainId: CHAIN_ID, functionName: 'allowance', args: [user, ADDR.Core] }, // 1
      { address: ADDR.MCU, abi: erc20Abi, chainId: CHAIN_ID, functionName: 'balanceOf', args: [user] }, // 2
      { address: ADDR.MCU, abi: erc20Abi, chainId: CHAIN_ID, functionName: 'allowance', args: [user, ADDR.Vault] }, // 3
      { ...core, functionName: 'stakes', args: [user] }, // 4 → [amount, lockedAmount, rewardDebt, pending]
      { ...core, functionName: 'pendingRewards', args: [user] }, // 5
      { ...core, functionName: 'positionsOf', args: [user] }, // 6
      { ...core, functionName: 'unstakeQueueOf', args: [user] }, // 7
      { ...core, functionName: 'unstakeQueueHead', args: [user] }, // 8
      { ...core, functionName: 'genesisRestricted', args: [user] }, // 9
      { ...vault, functionName: 'stakedMCU', args: [user] }, // 10
      { ...vault, functionName: 'eligibleBalance', args: [user] }, // 11
      { ...vault, functionName: 'thawingBalance', args: [user] }, // 12
      { ...vault, functionName: 'unstakeQueueOf', args: [user] }, // 13
      { ...vault, functionName: 'unstakeQueueHead', args: [user] }, // 14
    ] as const,
    allowFailure: true,
    multicallAddress: ADDR.Multicall3,
    query: { enabled: !!address, refetchInterval: REFETCH_MS, staleTime: REFETCH_MS / 2 },
  });

  const results = q.data as readonly Result[] | undefined;

  const data = useMemo<AccountState | undefined>(() => {
    if (!address || !results) return undefined;
    // "Matured" is judged as of the snapshot time; the 12 s refetch keeps it current without impure reads in render.
    const nowSec = Math.floor(q.dataUpdatedAt / 1000);

    const stakes = results[4];
    const [stakedAmount, lockedAmount] = stakes?.status === 'success' && Array.isArray(stakes.result)
      ? (stakes.result as unknown as readonly [bigint, bigint, bigint, bigint])
      : [0n, 0n];

    const pos = results[6];
    const positions: Position[] = pos?.status === 'success' && Array.isArray(pos.result)
      ? (pos.result as readonly Position[]).map((p) => ({ mcuOutstanding: p.mcuOutstanding, mdmLocked: p.mdmLocked, checkoutRate: p.checkoutRate }))
      : [];

    const mdmQueue = queue(results[7], big(results[8]));
    const vaultQueue = queue(results[13], big(results[14]));

    return {
      mdmBalance: big(results[0]),
      mdmAllowanceCore: big(results[1]),
      mcuBalance: big(results[2]),
      mcuAllowanceVault: big(results[3]),
      stakedAmount,
      lockedAmount,
      freeStake: stakedAmount > lockedAmount ? stakedAmount - lockedAmount : 0n,
      pendingRewards: big(results[5]),
      positions,
      mdmQueue,
      mdmMatured: maturedOf(mdmQueue, nowSec),
      vault: {
        staked: big(results[10]),
        eligible: big(results[11]),
        thawing: big(results[12]),
        queue: vaultQueue,
        matured: maturedOf(vaultQueue, nowSec),
      },
      genesisRestricted: bool(results[9]),
      readAt: q.dataUpdatedAt,
    };
  }, [address, results, q.dataUpdatedAt]);

  return {
    data,
    isLoading: !!address && q.isLoading,
    error: (q.error as Error | null) ?? undefined,
    refetch: () => { void q.refetch(); },
  };
}
