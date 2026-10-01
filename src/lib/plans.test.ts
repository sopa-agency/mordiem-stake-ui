import { describe, expect, it } from 'vitest';
import { maxUint256 } from 'viem';
import { ADDR } from './contracts/addresses';
import { capitalAbi, coreAbi, erc20Abi, vaultAbi } from './contracts/abis';
import { parseAmount } from './protocol';
import {
  buildCapitalClaimRewardsPlan,
  buildCapitalClaimWithdrawPlan,
  buildCapitalDepositPlan,
  buildCapitalWithdrawPlan,
  buildCheckInPlan,
  buildCheckOutPlan,
  buildClaimRewardsPlan,
  buildClaimUnstakedPlan,
  buildStakePlan,
  buildUnstakePlan,
  buildVaultClaimPlan,
  buildVaultStakePlan,
  buildVaultUnstakePlan,
  doneTitle,
  labelAmount,
  needsApprove,
} from './plans';

const WAD = BigInt(10) ** BigInt(18);
const mdm = (n: number) => BigInt(Math.round(n * 100)) * (WAD / BigInt(100));

describe('labelAmount', () => {
  it('pads to two decimals and keeps more when present', () => {
    expect(labelAmount(mdm(10))).toBe('10.00');
    expect(labelAmount(mdm(0.5))).toBe('0.50');
    expect(labelAmount(BigInt('542446987771818460'))).toBe('0.5424');
    expect(labelAmount(BigInt(1))).toBe('<0.0001');
    expect(labelAmount(BigInt(0))).toBe('0.00');
  });
});

describe('doneTitle', () => {
  it('turns the button verb into the toast verb', () => {
    expect(doneTitle('Stake 10.00 MDM')).toBe('Staked 10.00 MDM');
    expect(doneTitle('Request unstake of 10.00 MDM')).toBe('Requested unstake of 10.00 MDM');
    expect(doneTitle('Claim 3.41 MDM')).toBe('Claimed 3.41 MDM');
    expect(doneTitle('Check out 1.00 MCU')).toBe('Checked out 1.00 MCU');
    expect(doneTitle('Check in 1.00 MCU')).toBe('Checked in 1.00 MCU');
    expect(doneTitle('Stake 1.00 MCU')).toBe('Staked 1.00 MCU');
  });
});

describe('buildStakePlan', () => {
  it('approves the exact amount to Core when the allowance is short, then stakes', () => {
    const plan = buildStakePlan(mdm(10), { allowance: mdm(4) });
    expect(plan.verb).toBe('Stake 10.00 MDM');
    expect(plan.steps).toHaveLength(2);
    const [approve, stake] = plan.steps;
    expect(approve).toMatchObject({ kind: 'approve', address: ADDR.MDM, functionName: 'approve', skip: false });
    expect(approve.abi).toBe(erc20Abi);
    expect(approve.args).toEqual([ADDR.Core, mdm(10)]);
    expect(stake).toMatchObject({ kind: 'action', address: ADDR.Core, functionName: 'stake' });
    expect(stake.abi).toBe(coreAbi);
    expect(stake.args).toEqual([mdm(10)]);
    expect(needsApprove(plan)).toBe(true);
  });

  it('skips the approve when the allowance already covers the amount (equal counts as covered)', () => {
    expect(buildStakePlan(mdm(10), { allowance: mdm(10) }).steps[0].skip).toBe(true);
    expect(buildStakePlan(mdm(10), { allowance: mdm(11) }).steps[0].skip).toBe(true);
    expect(needsApprove(buildStakePlan(mdm(10), { allowance: mdm(10) }))).toBe(false);
  });

  it('approves maxUint256 when unlimited is chosen', () => {
    const plan = buildStakePlan(mdm(10), { allowance: BigInt(0), unlimited: true });
    expect(plan.steps[0].args).toEqual([ADDR.Core, maxUint256]);
    expect(plan.steps[1].args).toEqual([mdm(10)]);
  });
});

describe('MDM exits', () => {
  it('requestUnstake carries the free stake for the error sentence', () => {
    const plan = buildUnstakePlan(mdm(2.5), mdm(8.2));
    expect(plan.verb).toBe('Request unstake of 2.50 MDM');
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]).toMatchObject({ kind: 'action', address: ADDR.Core, functionName: 'requestUnstake' });
    expect(plan.steps[0].args).toEqual([mdm(2.5)]);
    expect(plan.errorContext).toEqual({ freeStakeText: '8.2' });
  });

  it('claimRewards and claimUnstaked take no args', () => {
    const rewards = buildClaimRewardsPlan(mdm(3.41));
    expect(rewards.verb).toBe('Claim 3.41 MDM');
    expect(rewards.steps[0]).toMatchObject({ address: ADDR.Core, functionName: 'claimRewards', args: [] });
    const unstaked = buildClaimUnstakedPlan(mdm(4));
    expect(unstaked.verb).toBe('Claim 4.00 MDM');
    expect(unstaked.steps[0]).toMatchObject({ address: ADDR.Core, functionName: 'claimUnstaked', args: [] });
  });
});

describe('MCU check-out / check-in', () => {
  it('checkOut sends the MCU wei and the free stake context', () => {
    const plan = buildCheckOutPlan(WAD, mdm(300));
    expect(plan.verb).toBe('Check out 1.00 MCU');
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]).toMatchObject({ address: ADDR.Core, functionName: 'checkOut' });
    expect(plan.steps[0].args).toEqual([WAD]);
    expect(plan.errorContext?.freeStakeText).toBe('300');
  });

  it('checkIn sends the MCU wei', () => {
    const plan = buildCheckInPlan(WAD / BigInt(2));
    expect(plan.verb).toBe('Check in 0.50 MCU');
    expect(plan.steps[0]).toMatchObject({ address: ADDR.Core, functionName: 'checkIn' });
    expect(plan.steps[0].args).toEqual([WAD / BigInt(2)]);
  });
});

describe('Capital pools', () => {
  const USDC = { sym: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const, decimals: 6 };
  const MOR = { sym: 'MOR', address: '0x7431ada8a591c955a994a21710752ef9b882b8e3' as const, decimals: 18 };

  it('deposit parses USDC at 6 decimals, approves the asset to CapitalManager when short, then deposits', () => {
    const amount = parseAmount('300', USDC.decimals);
    expect(amount).toBe(BigInt(300_000_000));
    const plan = buildCapitalDepositPlan(USDC, amount!, { allowance: BigInt(0) });
    expect(plan.verb).toBe('Deposit 300.00 USDC');
    const [approve, deposit] = plan.steps;
    expect(approve).toMatchObject({ kind: 'approve', address: USDC.address, functionName: 'approve', skip: false });
    expect(approve.abi).toBe(erc20Abi);
    expect(approve.args).toEqual([ADDR.CapitalManager, BigInt(300_000_000)]);
    expect(deposit).toMatchObject({ kind: 'action', address: ADDR.CapitalManager, functionName: 'deposit' });
    expect(deposit.abi).toBe(capitalAbi);
    expect(deposit.args).toEqual([USDC.address, BigInt(300_000_000)]);
    expect(needsApprove(plan)).toBe(true);
  });

  it('deposit skips the approve when the allowance covers it and honours unlimited', () => {
    expect(buildCapitalDepositPlan(USDC, BigInt(1_000_000), { allowance: BigInt(1_000_000) }).steps[0].skip).toBe(true);
    expect(buildCapitalDepositPlan(MOR, WAD, { allowance: BigInt(0), unlimited: true }).steps[0].args).toEqual([ADDR.CapitalManager, maxUint256]);
    expect(buildCapitalDepositPlan(MOR, WAD, { allowance: BigInt(0) }).verb).toBe('Deposit 1.00 MOR');
  });

  it('withdraw, claim withdraw and claim rewards target the asset', () => {
    const w = buildCapitalWithdrawPlan(MOR, WAD * BigInt(10));
    expect(w.verb).toBe('Request withdraw of 10.00 MOR');
    expect(w.steps[0]).toMatchObject({ address: ADDR.CapitalManager, functionName: 'requestWithdraw' });
    expect(w.steps[0].args).toEqual([MOR.address, WAD * BigInt(10)]);
    expect(doneTitle(w.verb)).toBe('Requested withdraw of 10.00 MOR');

    const c = buildCapitalClaimWithdrawPlan(USDC, BigInt(300_000_000));
    expect(c.verb).toBe('Claim 300.00 USDC');
    expect(c.steps[0]).toMatchObject({ address: ADDR.CapitalManager, functionName: 'claimWithdraw', args: [USDC.address] });

    const r = buildCapitalClaimRewardsPlan(MOR, mdm(0.05));
    expect(r.verb).toBe('Claim 0.05 MDM');
    expect(r.steps[0]).toMatchObject({ address: ADDR.CapitalManager, functionName: 'claimCapitalRewards', args: [MOR.address] });
    expect(doneTitle('Deposit 300.00 USDC')).toBe('Deposited 300.00 USDC');
  });
});

describe('MCU vault', () => {
  it('approves MCU to the Vault when needed, then stakes', () => {
    const plan = buildVaultStakePlan(WAD, { allowance: BigInt(0) });
    expect(plan.verb).toBe('Stake 1.00 MCU');
    const [approve, stake] = plan.steps;
    expect(approve).toMatchObject({ kind: 'approve', address: ADDR.MCU, functionName: 'approve', skip: false });
    expect(approve.args).toEqual([ADDR.Vault, WAD]);
    expect(stake).toMatchObject({ kind: 'action', address: ADDR.Vault, functionName: 'stake' });
    expect(stake.abi).toBe(vaultAbi);
    expect(stake.args).toEqual([WAD]);
  });

  it('skips the approve when covered and honours unlimited', () => {
    expect(buildVaultStakePlan(WAD, { allowance: WAD }).steps[0].skip).toBe(true);
    expect(buildVaultStakePlan(WAD, { allowance: BigInt(0), unlimited: true }).steps[0].args).toEqual([ADDR.Vault, maxUint256]);
  });

  it('requestUnstake carries the eligible balance; claimUnstaked takes no args', () => {
    const plan = buildVaultUnstakePlan(WAD, WAD * BigInt(3));
    expect(plan.verb).toBe('Request unstake of 1.00 MCU');
    expect(plan.steps[0]).toMatchObject({ address: ADDR.Vault, functionName: 'requestUnstake' });
    expect(plan.steps[0].args).toEqual([WAD]);
    expect(plan.errorContext).toEqual({ eligibleText: '3' });
    const claim = buildVaultClaimPlan(WAD);
    expect(claim.verb).toBe('Claim 1.00 MCU');
    expect(claim.steps[0]).toMatchObject({ address: ADDR.Vault, functionName: 'claimUnstaked', args: [] });
  });
});
