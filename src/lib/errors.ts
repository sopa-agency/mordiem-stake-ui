// Turns contract reverts and wallet errors into the plain sentences from the spec.
// Pure: no React, no wagmi. Safe to unit-test and to call from anywhere.
import {
  BaseError,
  ChainMismatchError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  decodeErrorResult,
  type Abi,
  type Hex,
} from 'viem';

type AbiError = Extract<Abi[number], { type: 'error' }>;
import { coreAbi, mcuAbi, mdmAbi, vaultAbi } from './contracts/abis';

export type ErrorContext = {
  /** Formatted free sMDM, e.g. "12.5" — used by InsufficientFreeStake. */
  freeStakeText?: string;
  /** Formatted eligible MCU, e.g. "3" — used by the vault's InsufficientStake. */
  eligibleText?: string;
};

export const GENERIC_ERROR = 'Something went wrong. Nothing was sent.';
export const CANCELLED_ERROR = 'You cancelled in your wallet.';
export const WRONG_CHAIN_ERROR = 'Switch your wallet to Base and try again.';

/** Contract error name → sentence. Keyed by the error names in the ABIs (Core, Vault, MDM, MCU). */
const SENTENCES: Record<string, (ctx: ErrorContext) => string> = {
  InsufficientFreeStake: ({ freeStakeText }) =>
    freeStakeText !== undefined
      ? `You only have ${freeStakeText} sMDM free; the rest is locked behind MCU.`
      : 'You do not have enough free sMDM; the rest is locked behind MCU.',
  BelowMinimumCheckout: () => 'Check out at least 0.01 MCU.',
  ExceedsReserve: () => 'The curve cannot supply that much MCU right now.',
  ReserveTooThin: () => 'The curve cannot supply that much MCU right now.',
  TooManyPositions: () => 'You already have 100 open positions; check some in first.',
  NoOpenPositions: () => 'You have no MCU positions to check in.',
  GenesisRestrictedAccount: () => 'This wallet cannot stake or check out.',
  PausedFlag: () => 'Staking is paused by the guardian; exits still work.',
  AlreadyPausedFlag: () => 'Staking is paused by the guardian; exits still work.',
  NothingToClaim: () => 'Nothing has finished thawing yet.',
  InsufficientPrincipal: () => 'You do not have that much deposited in this pool.',
  UnknownAsset: () => 'This pool is not enabled in the contract.',
  NotLive: () => 'The protocol is not live yet.',
  ERC20InsufficientBalance: () => 'You do not have that much.',
  ERC20InsufficientAllowance: () => 'Your approval is too small; approve first.',
  InsufficientStake: ({ eligibleText }) =>
    eligibleText !== undefined ? `You only have ${eligibleText} MCU eligible.` : 'You do not have that much MCU eligible.',
  ZeroAmount: () => 'Enter an amount above zero.',
  NonTransferable: () => 'sMDM cannot be transferred.',
  ReentrancyGuardReentrantCall: () => 'The contract rejected a re-entrant call. Try again.',
  SafeERC20FailedOperation: () => 'The token transfer failed.',
};

/** Every `error` item from every ABI we know, so a revert raised by a *called* contract (e.g. MDM inside Core.stake) still decodes. */
const ALL_ERRORS: Abi = (() => {
  const seen = new Set<string>();
  const out: AbiError[] = [];
  for (const abi of [coreAbi, vaultAbi, mdmAbi, mcuAbi] as readonly Abi[]) {
    for (const item of abi) {
      if (item.type !== 'error') continue;
      const key = `${item.name}(${item.inputs.map((i) => i.type).join(',')})`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out;
})();

type Shaped = { name?: unknown; code?: unknown; message?: unknown; shortMessage?: unknown; details?: unknown; cause?: unknown; data?: unknown; raw?: unknown };
const asShaped = (e: unknown): Shaped => (typeof e === 'object' && e !== null ? (e as Shaped) : {});

/** Walks `cause` chains (viem's `BaseError.walk` when available, a manual walk otherwise). */
function walk(e: unknown, pred: (err: unknown) => boolean): unknown {
  if (e instanceof BaseError) return e.walk(pred) ?? undefined;
  let cur: unknown = e;
  for (let depth = 0; depth < 12 && cur !== undefined && cur !== null; depth++) {
    if (pred(cur)) return cur;
    cur = asShaped(cur).cause;
  }
  return undefined;
}

const isRevert = (err: unknown) => err instanceof ContractFunctionRevertedError || asShaped(err).name === 'ContractFunctionRevertedError';

/** The decoded error name of a revert, from `data.errorName` or by decoding `raw` against every ABI we know. */
export function revertErrorName(e: unknown): string | undefined {
  const rev = walk(e, isRevert);
  if (!rev) return undefined;
  const s = asShaped(rev);
  const data = asShaped(s.data);
  const fromData = (data as { errorName?: unknown }).errorName;
  if (typeof fromData === 'string' && fromData) return fromData;
  const raw = s.raw;
  if (typeof raw === 'string' && raw.startsWith('0x') && raw.length >= 10) {
    try {
      return decodeErrorResult({ abi: ALL_ERRORS, data: raw as Hex }).errorName;
    } catch {
      /* unknown selector */
    }
  }
  // Some wallets only pass the revert reason string along.
  const reason = (s as { reason?: unknown }).reason;
  if (typeof reason === 'string' && SENTENCES[reason]) return reason;
  return undefined;
}

const isUserRejection = (err: unknown) => {
  if (err instanceof UserRejectedRequestError) return true;
  const s = asShaped(err);
  if (s.code === 4001 || s.name === 'UserRejectedRequestError') return true;
  const m = typeof s.message === 'string' ? s.message : '';
  return /user (rejected|denied|cancel+ed)|rejected the request/i.test(m);
};

const isChainMismatch = (err: unknown) => {
  if (err instanceof ChainMismatchError) return true;
  const n = asShaped(err).name;
  return n === 'ChainMismatchError' || n === 'ChainNotConfiguredError' || n === 'SwitchChainError' || asShaped(err).code === 4902;
};

/** Map any thrown value to one sentence for the UI. Never throws. */
export function explainError(e: unknown, ctx: ErrorContext = {}): string {
  if (e === undefined || e === null) return GENERIC_ERROR;
  if (typeof e === 'string') return e || GENERIC_ERROR;

  if (walk(e, isUserRejection)) return CANCELLED_ERROR;
  if (walk(e, isChainMismatch)) return WRONG_CHAIN_ERROR;

  const name = revertErrorName(e);
  if (name && SENTENCES[name]) return SENTENCES[name](ctx);
  if (name) return `The contract refused: ${name}.`;

  const s = asShaped(e);
  const text = [s.shortMessage, s.message, s.details].find((v): v is string => typeof v === 'string' && v.length > 0) ?? '';
  if (/insufficient funds/i.test(text)) return 'Not enough ETH on Base to pay for gas.';
  if (/execution reverted/i.test(text)) return 'The contract rejected this transaction.';
  if (/(timeout|timed out)/i.test(text)) return 'The network took too long to answer. Try again.';
  if (/(fetch|network|Failed to fetch|HTTP request failed)/i.test(text)) return 'Could not reach the Base network. Try again.';

  const short = typeof s.shortMessage === 'string' && s.shortMessage ? s.shortMessage : text.split('\n')[0];
  return short ? short.replace(/\.$/, '') + '.' : GENERIC_ERROR;
}
