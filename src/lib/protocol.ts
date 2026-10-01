/**
 * Pure protocol math and formatting for the Mordiem Stake UI.
 *
 * No React, no viem, no chain access. Every formula mirrors the verified
 * MordiemCore / MCUVault sources; the comments cite the contract where a
 * rounding or weighting choice is not obvious.
 *
 * Note: tsconfig targets ES2017, so this file uses `BigInt(...)` instead of
 * bigint literals.
 */

// ───────────────────────────── constants ─────────────────────────────

/** Genesis / go-live: 2026-09-16 00:00 UTC. Emission is indexed from here. */
export const GENESIS_TS = 1789516800;

export const MDM_DECIMALS = 18;
export const MCU_DECIMALS = 18;
export const USDC_DECIMALS = 6;

/**
 * Documented contract constants (MordiemCore). The live values are also read
 * on-chain (`MIN_CHECKOUT`, `MAX_POSITIONS`, `MDM_THAW`); these exist so copy
 * and validation can be written before the first read resolves.
 */
export const MIN_CHECKOUT = 0.01; // MCU
export const MAX_POSITIONS = 100;
export const MDM_THAW_SECONDS = 7 * 86400; // MordiemCore.MDM_THAW
export const MCU_THAW_SECONDS = 86400; // MCUVault 24 h queue

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TEN = BigInt(10);
const SECONDS_PER_DAY = 86400;

const pow10 = (n: number): bigint => TEN ** BigInt(n);

// ───────────────────────────── emission ──────────────────────────────

/** Fractional days since genesis, never negative. */
export function daysSinceGenesis(nowSec: number, genesisSec: number = GENESIS_TS): number {
  return Math.max(0, (nowSec - genesisSec) / SECONDS_PER_DAY);
}

/**
 * Instantaneous emission rate in MDM/day at day `t`: dE/dt of t(t+1)/2.
 * Half goes to the capital pools, half to the staker pool (see `_updatePool`).
 */
export function emissionPerDay(tDays: number): number {
  return tDays + 0.5;
}

/** Total MDM emitted by day `t`: E(t) = t(t+1)/2 (MordiemCore.cumulativeEmitted). */
export function cumulativeEmitted(tDays: number): number {
  if (tDays <= 0) return 0;
  return (tDays * (tDays + 1)) / 2;
}

/** MDM emitted between day `t0` and day `t1`. */
export function emissionBetween(t0Days: number, t1Days: number): number {
  return cumulativeEmitted(t1Days) - cumulativeEmitted(t0Days);
}

/** The staker pool's share of the daily emission (the other half goes to capital). */
function stakerPerDay(tDays: number): number {
  return emissionPerDay(tDays) / 2;
}

/**
 * Snapshot APR (%) for free sMDM: today's staker-pool emission, annualised
 * over `totalStakedMdm`. Because emission grows linearly the realised yearly
 * figure is higher; this is the honest "right now" rate.
 *
 * Nuance ignored here on purpose: the accumulator is spread over TOTAL staked
 * (free + locked), locked sMDM earns 0.5x and the forfeited half goes to the
 * treasury, not to other stakers (`_updatePool`). So free sMDM really earns
 * exactly this rate and locked sMDM earns half of it.
 */
export function stakerAprPct(totalStakedMdm: number, tDays: number): number {
  if (!(totalStakedMdm > 0)) return 0;
  return ((stakerPerDay(tDays) * 365) / totalStakedMdm) * 100;
}

/**
 * MDM/day a user gives up by holding `lockedMdm` behind MCU positions:
 * their pro-rata staker share on that stake, halved (locked earns 0.5x).
 */
export function forgoneRewardsPerDay(
  lockedMdm: number,
  totalStakedMdm: number,
  tDays: number,
): number {
  if (!(totalStakedMdm > 0) || !(lockedMdm > 0)) return 0;
  return (lockedMdm / totalStakedMdm) * stakerPerDay(tDays) * 0.5;
}

/** `forgoneRewardsPerDay` priced in USD. */
export function forgoneRewardsUsdPerDay(
  lockedMdm: number,
  totalStakedMdm: number,
  tDays: number,
  priceUsd: number,
): number {
  return forgoneRewardsPerDay(lockedMdm, totalStakedMdm, tDays) * priceUsd;
}

// ─────────────────────────────── curve ───────────────────────────────

/**
 * MDM required to check out `q` MCU on the constant-product curve, in whole
 * units (floats, for the simulator and the curve drawing):
 *   reserveMcu * reserveMdm / (reserveMcu - q) - reserveMdm
 * Returns Infinity when `q >= reserveMcu` (contract reverts ExceedsReserve)
 * and 0 for `q <= 0`.
 */
export function quoteCheckOut(reserveMdm: number, reserveMcu: number, q: number): number {
  if (!(q > 0)) return 0;
  if (!(reserveMcu > 0) || q >= reserveMcu) return Infinity;
  return (reserveMcu * reserveMdm) / (reserveMcu - q) - reserveMdm;
}

/**
 * Exact integer twin of `MordiemCore.quoteCheckOut`:
 *   Math.mulDiv(reserveMDM, reserveMCU, reserveMCU - q, Ceil) - reserveMDM
 * Rounds UP so the pool never under-collects. Throws RangeError when
 * `q >= reserveMcu`, matching the contract's ExceedsReserve revert.
 */
export function quoteCheckOutWei(reserveMdm: bigint, reserveMcu: bigint, q: bigint): bigint {
  if (q >= reserveMcu) throw new RangeError("ExceedsReserve: q >= reserveMcu");
  if (q <= ZERO) return ZERO;
  const newReserveMcu = reserveMcu - q;
  const product = reserveMdm * reserveMcu;
  let out = product / newReserveMcu;
  if (product % newReserveMcu !== ZERO) out += ONE;
  return out - reserveMdm;
}

/** Daily API credit in USD for `eligibleMcu` staked MCU: $1 per MCU per day. */
export function mcuPerDayCreditUsd(eligibleMcu: number): number {
  return eligibleMcu * 1;
}

// ─────────────────────────────── epoch ───────────────────────────────

/** The next 00:00 UTC strictly after `now` (a full day away at exactly midnight). */
export function nextMidnightUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

/** Whole seconds until the next 00:00 UTC, in 1..86400 (rounded up, never 0). */
export function secondsToMidnightUtc(now: Date): number {
  const ms = nextMidnightUtc(now).getTime() - now.getTime();
  return Math.min(SECONDS_PER_DAY, Math.max(1, Math.ceil(ms / 1000)));
}

// ─────────────────────────────── stake ───────────────────────────────

/** sMDM not collateralising any MCU position; never negative. */
export function freeStake(amount: bigint, locked: bigint): bigint {
  return amount > locked ? amount - locked : ZERO;
}

/** MDM price in USD from the Aerodrome USDC/MDM reserves (USDC 6 dp, MDM 18 dp). */
export function mdmPriceUsd(usdcReserve: bigint, mdmReserve: bigint): number {
  if (mdmReserve <= ZERO) return 0;
  return Number(usdcReserve) / 10 ** USDC_DECIMALS / (Number(mdmReserve) / 10 ** MDM_DECIMALS);
}

// ─────────────────────────────── queues ──────────────────────────────

/** One unstake request as returned by `unstakeQueueOf` (Core and Vault). */
export type QueueItem = { amount: bigint; unlockTimestamp: bigint };

/** Items from `head` onwards (the ones not yet claimed). Safe for any head. */
export function pendingQueue<T extends QueueItem>(queue: readonly T[], head: bigint): T[] {
  if (head <= ZERO) return queue.slice();
  if (head >= BigInt(queue.length)) return [];
  return queue.slice(Number(head));
}

/**
 * Total claimable now: pending items whose `unlockTimestamp <= nowSec`
 * (`claimUnstaked` uses `<=`).
 */
export function maturedTotal(queue: readonly QueueItem[], head: bigint, nowSec: number): bigint {
  const now = BigInt(Math.floor(nowSec));
  let total = ZERO;
  for (const item of pendingQueue(queue, head)) {
    if (item.unlockTimestamp <= now) total += item.amount;
  }
  return total;
}

/** The pending item with the earliest `unlockTimestamp > nowSec`, or null. */
export function nextUnlock<T extends QueueItem>(
  queue: readonly T[],
  head: bigint,
  nowSec: number,
): T | null {
  const now = BigInt(Math.floor(nowSec));
  let best: T | null = null;
  for (const item of pendingQueue(queue, head)) {
    if (item.unlockTimestamp > now && (best === null || item.unlockTimestamp < best.unlockTimestamp)) {
      best = item;
    }
  }
  return best;
}

/** Fraction of the thaw elapsed for an item unlocking at `unlockTs`, clamped 0..1. */
export function thawProgress(unlockTs: bigint | number, thawSeconds: number, nowSec: number): number {
  if (!(thawSeconds > 0)) return 1;
  const unlock = Number(unlockTs);
  const start = unlock - thawSeconds;
  const p = (nowSec - start) / thawSeconds;
  return Math.min(1, Math.max(0, p));
}

// ──────────────────────────── formatting ─────────────────────────────

const group = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/**
 * Token amount from wei: en-US grouping, up to `maxFrac` decimals (half-up),
 * trailing zeros trimmed, "<0.0001" (per `maxFrac`) for tiny non-zero values.
 */
export function fmtAmount(x: bigint, decimals: number = 18, maxFrac: number = 4): string {
  const negative = x < ZERO;
  const abs = negative ? -x : x;
  const scale = pow10(decimals);
  const fracScale = pow10(maxFrac);
  // round half up to maxFrac decimals
  const half = decimals > 0 ? scale / BigInt(2) : ZERO;
  const rounded = (abs * fracScale + half) / scale;
  if (rounded === ZERO) {
    if (abs === ZERO) return "0";
    return maxFrac > 0 ? `<0.${"0".repeat(maxFrac - 1)}1` : "<1";
  }
  const intPart = group((rounded / fracScale).toString());
  let frac = maxFrac > 0 ? (rounded % fracScale).toString().padStart(maxFrac, "0") : "";
  frac = frac.replace(/0+$/, "");
  const body = frac ? `${intPart}.${frac}` : intPart;
  return negative ? `-${body}` : body;
}

/** Plain number with en-US grouping; "—" for NaN, "∞" for infinities. */
export function fmtNumber(n: number, maxFrac: number = 2): string {
  if (Number.isNaN(n)) return "—";
  if (n === Infinity) return "∞";
  if (n === -Infinity) return "-∞";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: maxFrac,
    minimumFractionDigits: 0,
  }).format(n);
}

/** USD: no cents at $100 and above ("$1,234"), two decimals below, "<$0.01" for tiny positives. */
export function fmtUsd(n: number): string {
  if (Number.isNaN(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs === Infinity) return `${sign}$∞`;
  if (abs > 0 && abs < 0.005) return "<$0.01";
  const roundedToCents = Math.round(abs * 100) / 100;
  if (roundedToCents >= 100) return `${sign}$${fmtNumber(abs, 0)}`;
  return `${sign}$${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs)}`;
}

/** Percentage with up to `maxFrac` decimals and a trailing "%". */
export function fmtPct(n: number, maxFrac: number = 2): string {
  return `${fmtNumber(n, maxFrac)}%`;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** "4d 11h" above a day, "11h 02m" above an hour, "02:17" (mm:ss) below. */
export function fmtDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  if (s >= SECONDS_PER_DAY) {
    const d = Math.floor(s / SECONDS_PER_DAY);
    const h = Math.floor((s % SECONDS_PER_DAY) / 3600);
    return `${d}d ${pad2(h)}h`;
  }
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${pad2(m)}m`;
  }
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sun, Oct 5, 02:17 UTC" */
export function fmtUtc(tsSec: number | bigint): string {
  const d = new Date(Number(tsSec) * 1000);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${pad2(
    d.getUTCHours(),
  )}:${pad2(d.getUTCMinutes())} UTC`;
}

/** Same shape as `fmtUtc` in the user's zone, with the zone's short name ("GMT-3", "BRT", ...). */
export function fmtLocal(tsSec: number | bigint): string {
  const d = new Date(Number(tsSec) * 1000);
  let zone = "";
  try {
    zone =
      new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
        .formatToParts(d)
        .find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    zone = "";
  }
  if (!zone) {
    const off = -d.getTimezoneOffset();
    const sign = off >= 0 ? "+" : "-";
    const a = Math.abs(off);
    zone = `GMT${sign}${Math.floor(a / 60)}${a % 60 ? `:${pad2(a % 60)}` : ""}`;
  }
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${pad2(d.getHours())}:${pad2(
    d.getMinutes(),
  )} ${zone.replace(/\s+/g, "")}`;
}

/**
 * Parse user input into wei. Accepts "10", "10.5", "10,5", ".5", "5.".
 * Returns null for anything else: empty, negative, exponent notation,
 * multiple separators, or more fraction digits than `decimals`.
 */
export function parseAmount(input: string, decimals: number = 18): bigint | null {
  const s = input.trim().replace(",", ".");
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const [intRaw, fracRaw = ""] = s.split(".");
  if (fracRaw.length > decimals) return null;
  const intPart = intRaw === "" ? ZERO : BigInt(intRaw);
  const fracPart = fracRaw === "" ? ZERO : BigInt(fracRaw.padEnd(decimals, "0"));
  return intPart * pow10(decimals) + fracPart;
}
