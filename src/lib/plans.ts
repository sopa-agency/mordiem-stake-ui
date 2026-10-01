// Pure builders for every transaction the screens can send. Each returns a TxPlan for useTx():
// the steps (approve → action), the exact bigint args, the button verb (reused in the toast) and the
// amounts the error sentences need. No React, no wagmi: unit-tested in plans.test.ts.
import { maxUint256, type Address } from 'viem';
import { ADDR } from './contracts/addresses';
import { coreAbi, erc20Abi, vaultAbi } from './contracts/abis';
import { fmtAmount } from './protocol';
import type { TxPlan, TxStep } from '@/hooks/useTx';

export type ApproveOpts = {
  /** Current allowance of the token for the spender. */
  allowance: bigint;
  /** Approve maxUint256 instead of the exact amount (opt-in). */
  unlimited?: boolean;
};

/** "10" → "10.00", "0.5" → "0.50", "0.5424" stays, "<0.0001" stays. Button labels read better with two decimals. */
export function labelAmount(x: bigint, decimals = 18): string {
  const s = fmtAmount(x, decimals, 4);
  if (s.startsWith('<')) return s;
  const [int, frac = ''] = s.split('.');
  return frac.length >= 2 ? s : `${int}.${frac.padEnd(2, '0')}`;
}

/** Past tense of a button verb for the toast: "Stake 10.00 MDM" → "Staked 10.00 MDM". */
export function doneTitle(verb: string): string {
  const rules: [RegExp, string][] = [
    [/^Request unstake of\b/, 'Requested unstake of'],
    [/^Check out\b/, 'Checked out'],
    [/^Check in\b/, 'Checked in'],
    [/^Stake\b/, 'Staked'],
    [/^Claim\b/, 'Claimed'],
    [/^Approve\b/, 'Approved'],
  ];
  for (const [re, past] of rules) if (re.test(verb)) return verb.replace(re, past);
  return `${verb} done`;
}

function approveStep(token: 'MDM' | 'MCU', spender: Address, amount: bigint, { allowance, unlimited }: ApproveOpts): TxStep {
  return {
    label: 'Approve',
    kind: 'approve',
    address: ADDR[token],
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, unlimited ? maxUint256 : amount],
    skip: allowance >= amount,
  };
}

const core = (label: string, functionName: string, args: readonly unknown[] = []): TxStep => ({
  label,
  kind: 'action',
  address: ADDR.Core,
  abi: coreAbi,
  functionName,
  args,
});

const vault = (label: string, functionName: string, args: readonly unknown[] = []): TxStep => ({
  label,
  kind: 'action',
  address: ADDR.Vault,
  abi: vaultAbi,
  functionName,
  args,
});

// ───────────────────────────── MDM (Core) ─────────────────────────────

/** MDM.approve(Core, amount) unless the allowance already covers it, then Core.stake(amount). */
export function buildStakePlan(amount: bigint, opts: ApproveOpts): TxPlan {
  return {
    verb: `Stake ${labelAmount(amount)} MDM`,
    steps: [approveStep('MDM', ADDR.Core, amount, opts), core('Stake', 'stake', [amount])],
  };
}

/** Core.requestUnstake(amount); `freeStake` feeds the InsufficientFreeStake sentence. */
export function buildUnstakePlan(amount: bigint, freeStake: bigint): TxPlan {
  return {
    verb: `Request unstake of ${labelAmount(amount)} MDM`,
    steps: [core('Request unstake', 'requestUnstake', [amount])],
    errorContext: { freeStakeText: fmtAmount(freeStake) },
  };
}

/** Core.claimRewards(). */
export function buildClaimRewardsPlan(pending: bigint): TxPlan {
  return { verb: `Claim ${labelAmount(pending)} MDM`, steps: [core('Claim rewards', 'claimRewards')] };
}

/** Core.claimUnstaked(): pays out every matured MDM queue item. */
export function buildClaimUnstakedPlan(matured: bigint): TxPlan {
  return { verb: `Claim ${labelAmount(matured)} MDM`, steps: [core('Claim unstaked', 'claimUnstaked')] };
}

// ───────────────────────────── MCU (Core) ─────────────────────────────

/** Core.checkOut(mcu); locks the quoted sMDM. */
export function buildCheckOutPlan(mcu: bigint, freeStake: bigint): TxPlan {
  return {
    verb: `Check out ${labelAmount(mcu)} MCU`,
    steps: [core('Check out', 'checkOut', [mcu])],
    errorContext: { freeStakeText: fmtAmount(freeStake) },
  };
}

/** Core.checkIn(mcu); burns MCU best rate first and releases the recorded sMDM. */
export function buildCheckInPlan(mcu: bigint): TxPlan {
  return { verb: `Check in ${labelAmount(mcu)} MCU`, steps: [core('Check in', 'checkIn', [mcu])] };
}

// ───────────────────────────── MCU (Vault) ────────────────────────────

/** MCU.approve(Vault, amount) unless covered, then Vault.stake(amount). */
export function buildVaultStakePlan(amount: bigint, opts: ApproveOpts): TxPlan {
  return {
    verb: `Stake ${labelAmount(amount)} MCU`,
    steps: [approveStep('MCU', ADDR.Vault, amount, opts), vault('Stake', 'stake', [amount])],
  };
}

/** Vault.requestUnstake(amount); `eligible` feeds the InsufficientStake sentence. */
export function buildVaultUnstakePlan(amount: bigint, eligible: bigint): TxPlan {
  return {
    verb: `Request unstake of ${labelAmount(amount)} MCU`,
    steps: [vault('Request unstake', 'requestUnstake', [amount])],
    errorContext: { eligibleText: fmtAmount(eligible) },
  };
}

/** Vault.claimUnstaked(): pays out every matured MCU queue item. */
export function buildVaultClaimPlan(matured: bigint): TxPlan {
  return { verb: `Claim ${labelAmount(matured)} MCU`, steps: [vault('Claim unstaked', 'claimUnstaked')] };
}

/** True when the plan will actually send an approve (so the UI shows the "approve unlimited" option). */
export function needsApprove(plan: TxPlan): boolean {
  return plan.steps.some((s) => s.kind === 'approve' && !s.skip);
}
