'use client';
// Protocol-wide figures in one multicall, refreshed every 12 s. Values stay bigint; the screens format them.
import { useMemo } from 'react';
import { useReadContracts } from 'wagmi';
import type { Hex } from 'viem';
import { ADDR, CHAIN_ID } from '@/lib/contracts/addresses';
import { aeroPoolAbi, coreAbi, erc20Abi, ledgerAbi, vaultAbi } from '@/lib/contracts/abis';

export const REFETCH_MS = 12_000;

export type ProtocolState = {
  reserveMcu: bigint;
  reserveMdm: bigint;
  totalStaked: bigint;
  totalLocked: bigint;
  cumulativeEmitted: bigint;
  /** MDM.totalSupply */
  totalSupply: bigint;
  /** Aerodrome pool reserves: USDC (6 dp) and MDM (18 dp). */
  poolUsdc: bigint;
  poolMdm: bigint;
  /** Unix seconds. */
  genesisTs: number;
  goLiveTs: number;
  /** Thaw durations in seconds (MDM from Core.MDM_THAW, MCU from Vault.MCU_THAW). */
  mdmThawSec: number;
  mcuThawSec: number;
  /** Core.MIN_CHECKOUT in MCU wei (18 dp). */
  minCheckout: bigint;
  maxPositions: number;
  paused: { stake: boolean; checkOut: boolean; stakeMcu: boolean };
  /** Core.checkSolvency() */
  solvent: boolean;
  /** Vault.totalEligible: MCU earning credit today. */
  totalEligible: bigint;
  /** BuybackLedger totals. */
  burnedMdm: bigint;
  buybackUsdc: bigint;
  buybackCashUsdc: bigint;
  /** When this snapshot was read (ms since epoch). */
  readAt: number;
};

const core = { address: ADDR.Core, abi: coreAbi, chainId: CHAIN_ID } as const;
const vault = { address: ADDR.Vault, abi: vaultAbi, chainId: CHAIN_ID } as const;
const ledger = { address: ADDR.Ledger, abi: ledgerAbi, chainId: CHAIN_ID } as const;

// Phase 1: everything that does not depend on another read. Positions are fixed; see the index constants below.
const MAIN_CONTRACTS = [
  { ...core, functionName: 'reserveMCU' },
  { ...core, functionName: 'reserveMDM' },
  { ...core, functionName: 'totalStaked' },
  { ...core, functionName: 'totalLocked' },
  { ...core, functionName: 'cumulativeEmitted' },
  { ...core, functionName: 'genesisTimestamp' },
  { ...core, functionName: 'goLiveTimestamp' },
  { ...core, functionName: 'MDM_THAW' },
  { ...core, functionName: 'MIN_CHECKOUT' },
  { ...core, functionName: 'MAX_POSITIONS' },
  { ...core, functionName: 'FLAG_STAKE' },
  { ...core, functionName: 'FLAG_CHECKOUT' },
  { ...core, functionName: 'checkSolvency' },
  { ...vault, functionName: 'totalEligible' },
  { ...vault, functionName: 'FLAG_STAKE_MCU' },
  { ...vault, functionName: 'MCU_THAW' },
  { address: ADDR.MDM, abi: erc20Abi, chainId: CHAIN_ID, functionName: 'totalSupply' },
  { address: ADDR.Pool, abi: aeroPoolAbi, chainId: CHAIN_ID, functionName: 'getReserves' },
  { ...ledger, functionName: 'totalMdmBurned' },
  { ...ledger, functionName: 'totalExecuted' },
  { ...ledger, functionName: 'unexecutedIntake' },
] as const;

const I = {
  reserveMcu: 0, reserveMdm: 1, totalStaked: 2, totalLocked: 3, cumulativeEmitted: 4, genesisTs: 5, goLiveTs: 6,
  mdmThaw: 7, minCheckout: 8, maxPositions: 9, flagStake: 10, flagCheckout: 11, solvent: 12,
  totalEligible: 13, flagStakeMcu: 14, mcuThaw: 15, totalSupply: 16, poolReserves: 17,
  burned: 18, executed: 19, unexecuted: 20,
} as const;

type Result = { status: 'success'; result: unknown } | { status: 'failure'; error: Error; result?: undefined };

const big = (r: Result | undefined, fallback = 0n): bigint => (r?.status === 'success' && typeof r.result === 'bigint' ? r.result : fallback);
const bool = (r: Result | undefined, fallback = false): boolean => (r?.status === 'success' && typeof r.result === 'boolean' ? r.result : fallback);
const hex = (r: Result | undefined): Hex | undefined => (r?.status === 'success' && typeof r.result === 'string' ? (r.result as Hex) : undefined);
const num = (r: Result | undefined, fallback = 0): number => (r?.status === 'success' && typeof r.result === 'bigint' ? Number(r.result) : fallback);

export function useProtocol(): { data?: ProtocolState; isLoading: boolean; error?: Error; refetch: () => void } {
  const main = useReadContracts({
    contracts: MAIN_CONTRACTS,
    allowFailure: true,
    multicallAddress: ADDR.Multicall3,
    query: { refetchInterval: REFETCH_MS, staleTime: REFETCH_MS / 2 },
  });

  const results = main.data as readonly Result[] | undefined;
  const flagStake = hex(results?.[I.flagStake]);
  const flagCheckout = hex(results?.[I.flagCheckout]);
  const flagStakeMcu = hex(results?.[I.flagStakeMcu]);
  const flagsReady = !!(flagStake && flagCheckout && flagStakeMcu);

  // Phase 2: the pause flags need the bytes32 ids from phase 1. Three tiny reads, same cadence.
  const paused = useReadContracts({
    contracts: [
      { ...core, functionName: 'isPaused', args: [flagStake ?? '0x'] },
      { ...core, functionName: 'isPaused', args: [flagCheckout ?? '0x'] },
      { ...vault, functionName: 'isPaused', args: [flagStakeMcu ?? '0x'] },
    ] as const,
    allowFailure: true,
    multicallAddress: ADDR.Multicall3,
    query: { enabled: flagsReady, refetchInterval: REFETCH_MS, staleTime: REFETCH_MS / 2 },
  });

  const pausedResults = paused.data as readonly Result[] | undefined;

  const data = useMemo<ProtocolState | undefined>(() => {
    if (!results) return undefined;
    const pool = results[I.poolReserves];
    const reserves = pool?.status === 'success' && Array.isArray(pool.result) ? (pool.result as readonly bigint[]) : undefined;
    return {
      reserveMcu: big(results[I.reserveMcu]),
      reserveMdm: big(results[I.reserveMdm]),
      totalStaked: big(results[I.totalStaked]),
      totalLocked: big(results[I.totalLocked]),
      cumulativeEmitted: big(results[I.cumulativeEmitted]),
      totalSupply: big(results[I.totalSupply]),
      poolUsdc: reserves?.[0] ?? 0n,
      poolMdm: reserves?.[1] ?? 0n,
      genesisTs: num(results[I.genesisTs]),
      goLiveTs: num(results[I.goLiveTs]),
      mdmThawSec: num(results[I.mdmThaw], 7 * 24 * 3600),
      mcuThawSec: num(results[I.mcuThaw], 24 * 3600),
      minCheckout: big(results[I.minCheckout], 10n ** 16n),
      maxPositions: num(results[I.maxPositions], 100),
      paused: {
        stake: bool(pausedResults?.[0]),
        checkOut: bool(pausedResults?.[1]),
        stakeMcu: bool(pausedResults?.[2]),
      },
      solvent: bool(results[I.solvent], true),
      totalEligible: big(results[I.totalEligible]),
      burnedMdm: big(results[I.burned]),
      buybackUsdc: big(results[I.executed]),
      buybackCashUsdc: big(results[I.unexecuted]),
      readAt: main.dataUpdatedAt,
    };
  }, [results, pausedResults, main.dataUpdatedAt]);

  const error = (main.error ?? paused.error) as Error | null;
  return {
    data,
    isLoading: main.isLoading || (flagsReady && paused.isLoading),
    error: error ?? undefined,
    refetch: () => {
      void main.refetch();
      if (flagsReady) void paused.refetch();
    },
  };
}
