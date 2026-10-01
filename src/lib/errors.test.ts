import { describe, expect, it } from 'vitest';
import {
  BaseError,
  ChainMismatchError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  encodeErrorResult,
  parseAbi,
} from 'viem';
import { base } from 'viem/chains';
import { coreAbi, mdmAbi, vaultAbi } from './contracts/abis';
import { CANCELLED_ERROR, GENERIC_ERROR, WRONG_CHAIN_ERROR, explainError, revertErrorName } from './errors';

/** Wraps a revert the way viem's simulateContract does: ExecutionError → cause RevertedError. */
function revertFrom(abi: typeof coreAbi | typeof vaultAbi | typeof mdmAbi, errorName: string, args: readonly unknown[] = [], functionName = 'stake') {
  const data = encodeErrorResult({ abi, errorName, args } as Parameters<typeof encodeErrorResult>[0]);
  const reverted = new ContractFunctionRevertedError({ abi, data, functionName });
  return new ContractFunctionExecutionError(reverted, { abi, functionName, args: [] });
}

/** A revert whose selector the *calling* contract's ABI does not know (e.g. MDM revert raised inside Core.stake). */
function foreignRevert(errorName: string, args: readonly unknown[] = []) {
  const data = encodeErrorResult({ abi: mdmAbi, errorName, args } as Parameters<typeof encodeErrorResult>[0]);
  const reverted = new ContractFunctionRevertedError({ abi: coreAbi, data, functionName: 'stake' });
  return new ContractFunctionExecutionError(reverted, { abi: coreAbi, functionName: 'stake', args: [] });
}

describe('explainError: contract error names', () => {
  it('InsufficientFreeStake with and without the free amount', () => {
    const e = revertFrom(coreAbi, 'InsufficientFreeStake', [], 'checkOut');
    expect(explainError(e, { freeStakeText: '12.5' })).toBe('You only have 12.5 sMDM free; the rest is locked behind MCU.');
    expect(explainError(e)).toBe('You do not have enough free sMDM; the rest is locked behind MCU.');
  });

  it.each([
    ['BelowMinimumCheckout', 'Check out at least 0.01 MCU.'],
    ['ExceedsReserve', 'The curve cannot supply that much MCU right now.'],
    ['ReserveTooThin', 'The curve cannot supply that much MCU right now.'],
    ['TooManyPositions', 'You already have 100 open positions; check some in first.'],
    ['NoOpenPositions', 'You have no MCU positions to check in.'],
    ['GenesisRestrictedAccount', 'This wallet cannot stake or check out.'],
    ['NothingToClaim', 'Nothing has finished thawing yet.'],
    ['NotLive', 'The protocol is not live yet.'],
    ['ZeroAmount', 'Enter an amount above zero.'],
  ])('%s', (name, sentence) => {
    expect(explainError(revertFrom(coreAbi, name))).toBe(sentence);
  });

  it('PausedFlag carries a bytes32 argument', () => {
    const flag = `0x${'ab'.repeat(32)}` as const;
    expect(explainError(revertFrom(coreAbi, 'PausedFlag', [flag]))).toBe('Staking is paused by the guardian; exits still work.');
  });

  it('vault InsufficientStake uses the eligible amount when given', () => {
    const e = revertFrom(vaultAbi, 'InsufficientStake', [], 'requestUnstake');
    expect(explainError(e, { eligibleText: '3' })).toBe('You only have 3 MCU eligible.');
    expect(explainError(e)).toBe('You do not have that much MCU eligible.');
  });

  it('ERC-20 errors raised by the token (decoded with the token ABI)', () => {
    const addr = '0x8Bf5941d27176242745B716251943Ae4892a3C26';
    expect(explainError(revertFrom(mdmAbi, 'ERC20InsufficientBalance', [addr, 1n, 2n], 'transferFrom'))).toBe('You do not have that much.');
    expect(explainError(revertFrom(mdmAbi, 'ERC20InsufficientAllowance', [addr, 1n, 2n], 'transferFrom'))).toBe('Your approval is too small; approve first.');
  });

  it('decodes a foreign selector (MDM error inside Core.stake) by scanning all known ABIs', () => {
    const addr = '0x8Bf5941d27176242745B716251943Ae4892a3C26';
    const e = foreignRevert('ERC20InsufficientBalance', [addr, 1n, 2n]);
    expect(revertErrorName(e)).toBe('ERC20InsufficientBalance');
    expect(explainError(e)).toBe('You do not have that much.');
  });

  it('names an unknown-but-decoded error instead of hiding it', () => {
    expect(explainError(revertFrom(coreAbi, 'BadMinReserve'))).toBe('The contract refused: BadMinReserve.');
  });

  it('accepts a minimal shaped object with data.errorName', () => {
    const shaped = { name: 'ContractFunctionExecutionError', cause: { name: 'ContractFunctionRevertedError', data: { errorName: 'TooManyPositions', args: [] } } };
    expect(explainError(shaped)).toBe('You already have 100 open positions; check some in first.');
  });

  it('gives up gracefully on an unknown selector', () => {
    const reverted = new ContractFunctionRevertedError({ abi: parseAbi(['error Nope()']), data: '0xdeadbeef', functionName: 'x' });
    expect(revertErrorName(reverted)).toBeUndefined();
    const text = explainError(reverted);
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toBe(GENERIC_ERROR);
  });
});

describe('explainError: wallet and chain errors', () => {
  it('user rejection (viem class, nested, EIP-1193 code, and message text)', () => {
    const rej = new UserRejectedRequestError(new Error('User rejected the request.'));
    expect(explainError(rej)).toBe(CANCELLED_ERROR);
    expect(explainError(new BaseError('Request failed', { cause: rej }))).toBe(CANCELLED_ERROR);
    expect(explainError({ code: 4001, message: 'MetaMask Tx Signature: User denied transaction signature.' })).toBe(CANCELLED_ERROR);
    expect(explainError(new Error('User denied transaction signature'))).toBe(CANCELLED_ERROR);
  });

  it('chain mismatch', () => {
    expect(explainError(new ChainMismatchError({ chain: base, currentChainId: 1 }))).toBe(WRONG_CHAIN_ERROR);
    expect(explainError({ name: 'ChainNotConfiguredError', message: 'Chain not configured.' })).toBe(WRONG_CHAIN_ERROR);
    expect(explainError({ code: 4902, message: 'Unrecognized chain' })).toBe(WRONG_CHAIN_ERROR);
  });

  it('gas and network messages', () => {
    expect(explainError(new Error('insufficient funds for gas * price + value'))).toBe('Not enough ETH on Base to pay for gas.');
    expect(explainError(new Error('HTTP request failed. URL: https://x'))).toBe('Could not reach the Base network. Try again.');
  });

  it('falls back to the short message, then to the generic sentence', () => {
    expect(explainError(new BaseError('Nonce too low'))).toBe('Nonce too low.');
    expect(explainError(new Error('boom'))).toBe('boom.');
    expect(explainError(undefined)).toBe(GENERIC_ERROR);
    expect(explainError({})).toBe(GENERIC_ERROR);
    expect(explainError('Custom text')).toBe('Custom text');
  });
});
