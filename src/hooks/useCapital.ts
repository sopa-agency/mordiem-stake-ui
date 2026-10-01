'use client';
// Capital pools (CapitalManager) in one multicall over the four assets, refreshed every 12 s.
// Pool totals always; user figures only when an address is given. Values stay bigint.
import { useMemo } from 'react';
import { useReadContracts } from 'wagmi';
import type { Address, Hex } from 'viem';
import { ADDR, CAPITAL_ASSETS, CHAIN_ID, type CapitalSym } from '@/lib/contracts/addresses';
import { adapterAbi, capitalAbi, erc20Abi } from '@/lib/contracts/abis';
import type { QueueItem } from './useAccountState';
import { REFETCH_MS } from './useProtocol';

export type CapitalPool = {
  sym: CapitalSym;
  address: Address;
  decimals: number;
  venue: string;
  adapter: Address;
  /** Principal held for everyone, in the asset's ledger units (token units; wstETH-wei for wstETH). */
  totalPrincipal: bigint;
  /** Realised yield weight (USDC, 6 dp) over the trailing window; drives the pool's share of capital emission. */
  trailingRealised: bigint;
  /** wstETH adapter: stETH per wstETH (18 dp). */
  currentRate?: bigint;
  /** MOR adapter: MOR the weekly withdraw bridge can pay this week. */
  claimableLiquidity?: bigint;
  /** VVV adapter: unix seconds when the shared Venice cooldown ends (0 = none running). */
  cooldownMaturity?: number;
  user?: {
    principal: bigint;
    pending: bigint;
    queue: QueueItem[];
    matured: bigint;
    balance: bigint;
    allowance: bigint;
  };
};

export type CapitalState = {
  pools: CapitalPool[];
  realisedMode: boolean;
  thawSec: number;
  pausedDeposit: boolean;
  readAt: number;
};

type Result = { status: 'success'; result: unknown } | { status: 'failure'; error: Error; result?: undefined };
const big = (r: Result | undefined, fallback = 0n): bigint => (r?.status === 'success' && typeof r.result === 'bigint' ? r.result : fallback);
const bool = (r: Result | undefined, fallback = false): boolean => (r?.status === 'success' && typeof r.result === 'boolean' ? r.result : fallback);
const hex = (r: Result | undefined): Hex | undefined => (r?.status === 'success' && typeof r.result === 'string' ? (r.result as Hex) : undefined);

const cm = { address: ADDR.CapitalManager, abi: capitalAbi, chainId: CHAIN_ID } as const;
const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as Address;

const BASE_COUNT = 3; // realisedMode, CAPITAL_THAW, FLAG_DEPOSIT
const POOL_COUNT = 2; // totalPrincipal, trailingRealised
const EXTRA_COUNT = 3; // wstETH currentRate, MOR claimableLiquidity, VVV cooldownMaturity
const USER_COUNT = 6; // capitalDeposits, pendingCapitalRewards, withdrawQueueOf, withdrawQueueHead, balanceOf, allowance

const wst = CAPITAL_ASSETS.find((a) => a.sym === 'wstETH')!;
const mor = CAPITAL_ASSETS.find((a) => a.sym === 'MOR')!;
const vvv = CAPITAL_ASSETS.find((a) => a.sym === 'VVV')!;

function contractsFor(user?: Address) {
  const list: unknown[] = [
    { ...cm, functionName: 'realisedMode' },
    { ...cm, functionName: 'CAPITAL_THAW' },
    { ...cm, functionName: 'FLAG_DEPOSIT' },
  ];
  for (const a of CAPITAL_ASSETS) {
    list.push({ ...cm, functionName: 'totalPrincipal', args: [a.address] }, { ...cm, functionName: 'trailingRealised', args: [a.address] });
  }
  list.push(
    { address: wst.adapter, abi: adapterAbi, chainId: CHAIN_ID, functionName: 'currentRate' },
    { address: mor.adapter, abi: adapterAbi, chainId: CHAIN_ID, functionName: 'claimableLiquidity' },
    { address: vvv.adapter, abi: adapterAbi, chainId: CHAIN_ID, functionName: 'cooldownMaturity' },
  );
  if (user) {
    for (const a of CAPITAL_ASSETS) {
      list.push(
        { ...cm, functionName: 'capitalDeposits', args: [a.address, user] },
        { ...cm, functionName: 'pendingCapitalRewards', args: [a.address, user] },
        { ...cm, functionName: 'withdrawQueueOf', args: [a.address, user] },
        { ...cm, functionName: 'withdrawQueueHead', args: [a.address, user] },
        { address: a.address, abi: erc20Abi, chainId: CHAIN_ID, functionName: 'balanceOf', args: [user] },
        { address: a.address, abi: erc20Abi, chainId: CHAIN_ID, functionName: 'allowance', args: [user, ADDR.CapitalManager] },
      );
    }
  }
  return list;
}

function queue(r: Result | undefined, head: bigint): QueueItem[] {
  if (r?.status !== 'success' || !Array.isArray(r.result)) return [];
  const all = r.result as readonly { principal: bigint; unlockTimestamp: bigint }[];
  return all.slice(Number(head)).map((q) => ({ amount: q.principal, unlockTimestamp: Number(q.unlockTimestamp) }));
}

export function useCapital(address?: Address): { data?: CapitalState; isLoading: boolean; error?: Error; refetch: () => void } {
  const user = address && address !== ZERO_ADDR ? address : undefined;
  // The list is static for a given address; it only changes when the address does.
  const contracts = useMemo(() => contractsFor(user), [user]);

  const main = useReadContracts({
    // Cast: the list mixes four ABIs, which wagmi's tuple inference cannot follow at this length.
    contracts: contracts as never,
    allowFailure: true,
    multicallAddress: ADDR.Multicall3,
    query: { refetchInterval: REFETCH_MS, staleTime: REFETCH_MS / 2 },
  });
  const results = main.data as readonly Result[] | undefined;
  const flag = hex(results?.[2]);

  const paused = useReadContracts({
    contracts: [{ ...cm, functionName: 'isPaused', args: [flag ?? '0x'] }] as const,
    allowFailure: true,
    multicallAddress: ADDR.Multicall3,
    query: { enabled: !!flag, refetchInterval: REFETCH_MS, staleTime: REFETCH_MS / 2 },
  });
  const pausedResults = paused.data as readonly Result[] | undefined;

  const data = useMemo<CapitalState | undefined>(() => {
    if (!results) return undefined;
    const nowSec = Math.floor(main.dataUpdatedAt / 1000);
    const extrasAt = BASE_COUNT + CAPITAL_ASSETS.length * POOL_COUNT;
    const usersAt = extrasAt + EXTRA_COUNT;
    const pools: CapitalPool[] = CAPITAL_ASSETS.map((a, i) => {
      const p = BASE_COUNT + i * POOL_COUNT;
      const pool: CapitalPool = {
        sym: a.sym,
        address: a.address,
        decimals: a.decimals,
        venue: a.venue,
        adapter: a.adapter,
        totalPrincipal: big(results[p]),
        trailingRealised: big(results[p + 1]),
      };
      if (a.sym === 'wstETH') pool.currentRate = big(results[extrasAt], 10n ** 18n);
      if (a.sym === 'MOR') pool.claimableLiquidity = big(results[extrasAt + 1]);
      if (a.sym === 'VVV') pool.cooldownMaturity = Number(big(results[extrasAt + 2]));
      if (user) {
        const u = usersAt + i * USER_COUNT;
        const dep = results[u];
        const principal = dep?.status === 'success' && Array.isArray(dep.result) ? (dep.result as readonly bigint[])[0] ?? 0n : 0n;
        const q = queue(results[u + 2], big(results[u + 3]));
        pool.user = {
          principal,
          pending: big(results[u + 1]),
          queue: q,
          matured: q.reduce((acc, it) => (it.unlockTimestamp <= nowSec ? acc + it.amount : acc), 0n),
          balance: big(results[u + 4]),
          allowance: big(results[u + 5]),
        };
      }
      return pool;
    });
    return {
      pools,
      realisedMode: bool(results[0], true),
      thawSec: Number(big(results[1], BigInt(7 * 86400))),
      pausedDeposit: bool(pausedResults?.[0]),
      readAt: main.dataUpdatedAt,
    };
  }, [results, pausedResults, user, main.dataUpdatedAt]);

  const error = (main.error ?? paused.error) as Error | null;
  return {
    data,
    isLoading: main.isLoading,
    error: error ?? undefined,
    refetch: () => {
      void main.refetch();
      if (flag) void paused.refetch();
    },
  };
}
