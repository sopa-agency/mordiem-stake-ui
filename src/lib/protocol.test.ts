import { describe, expect, it } from "vitest";
import {
  GENESIS_TS,
  MAX_POSITIONS,
  MCU_DECIMALS,
  MDM_DECIMALS,
  MIN_CHECKOUT,
  USDC_DECIMALS,
  cumulativeEmitted,
  daysSinceGenesis,
  emissionBetween,
  emissionPerDay,
  fmtAmount,
  fmtDuration,
  fmtLocal,
  fmtNumber,
  fmtPct,
  fmtUsd,
  fmtUtc,
  forgoneRewardsPerDay,
  forgoneRewardsUsdPerDay,
  freeStake,
  maturedTotal,
  mcuPerDayCreditUsd,
  mdmPriceUsd,
  nextMidnightUtc,
  nextUnlock,
  parseAmount,
  pendingQueue,
  quoteCheckOut,
  quoteCheckOutWei,
  secondsToMidnightUtc,
  stakerAprPct,
  thawProgress,
  type QueueItem,
} from "./protocol";

// tsconfig targets ES2017, so no bigint literals here.
const B = (v: string | number) => BigInt(v);
const WAD = B(10) ** B(18);
const wad = (v: string | number) => B(v) * WAD;

describe("constants", () => {
  it("genesis is 2026-09-16 00:00 UTC", () => {
    expect(GENESIS_TS).toBe(1789516800);
    expect(new Date(GENESIS_TS * 1000).toISOString()).toBe("2026-09-16T00:00:00.000Z");
  });
  it("decimals and limits", () => {
    expect(MDM_DECIMALS).toBe(18);
    expect(MCU_DECIMALS).toBe(18);
    expect(USDC_DECIMALS).toBe(6);
    expect(MIN_CHECKOUT).toBe(0.01);
    expect(MAX_POSITIONS).toBe(100);
  });
});

describe("daysSinceGenesis", () => {
  it("is fractional days", () => {
    expect(daysSinceGenesis(GENESIS_TS + 86400 * 2.5)).toBeCloseTo(2.5, 10);
  });
  it("clamps to 0 before genesis", () => {
    expect(daysSinceGenesis(GENESIS_TS - 10)).toBe(0);
    expect(daysSinceGenesis(GENESIS_TS)).toBe(0);
  });
  it("accepts a custom genesis", () => {
    expect(daysSinceGenesis(86400 * 3, 86400)).toBe(2);
  });
});

describe("emission", () => {
  it("emissionPerDay(t) = t + 0.5", () => {
    expect(emissionPerDay(0)).toBe(0.5);
    expect(emissionPerDay(10)).toBe(10.5);
    expect(emissionPerDay(2.5)).toBe(3);
  });
  it("cumulativeEmitted(t) = t(t+1)/2", () => {
    expect(cumulativeEmitted(0)).toBe(0);
    expect(cumulativeEmitted(1)).toBe(1);
    expect(cumulativeEmitted(10)).toBe(55);
    expect(cumulativeEmitted(2.5)).toBeCloseTo(4.375, 10);
  });
  it("cumulativeEmitted clamps negative t to 0", () => {
    expect(cumulativeEmitted(-3)).toBe(0);
  });
  it("emissionBetween is the difference of cumulatives", () => {
    expect(emissionBetween(10, 11)).toBeCloseTo(11, 10); // 66 - 55
    expect(emissionBetween(0, 10)).toBe(55);
    expect(emissionBetween(10, 10)).toBe(0);
  });
  it("emissionBetween integrates emissionPerDay over one day", () => {
    // integral of (t + 0.5) from 10 to 11 = 10.5 + 0.5 = 11
    expect(emissionBetween(10, 11)).toBeCloseTo(11, 10);
  });
});

describe("stakerAprPct", () => {
  it("annualises half of the daily emission over total staked", () => {
    // t = 15 -> 15.5 MDM/day emitted, 7.75 to stakers; 7.75*365/1000 = 2.82875 -> 282.875 %
    expect(stakerAprPct(1000, 15)).toBeCloseTo(282.875, 6);
  });
  it("is 0 when nothing is staked", () => {
    expect(stakerAprPct(0, 15)).toBe(0);
    expect(stakerAprPct(-1, 15)).toBe(0);
  });
});

describe("forgone rewards", () => {
  it("locked sMDM gives up half of its staker share", () => {
    // t = 15 -> stakerPerDay 7.75; locked 100 of 1000 -> 0.775 MDM/day earned at 1x, half forgone
    expect(forgoneRewardsPerDay(100, 1000, 15)).toBeCloseTo(0.3875, 10);
  });
  it("is 0 when totalStaked is 0 or lockedMdm is 0", () => {
    expect(forgoneRewardsPerDay(100, 0, 15)).toBe(0);
    expect(forgoneRewardsPerDay(0, 1000, 15)).toBe(0);
  });
  it("converts to USD", () => {
    expect(forgoneRewardsUsdPerDay(100, 1000, 15, 2)).toBeCloseTo(0.775, 10);
  });
});

describe("quoteCheckOut (float)", () => {
  it("matches the contract curve at live-like reserves", () => {
    expect(quoteCheckOut(375003, 1499.988, 1)).toBeCloseTo(250.17, 2);
  });
  it("gets cheaper after the Oct 4 reserve adjustment", () => {
    expect(quoteCheckOut(375003, 1499.988 + 28500, 1)).toBeCloseTo(12.5, 2);
  });
  it("returns Infinity when q >= reserveMcu", () => {
    expect(quoteCheckOut(375003, 1499.988, 1499.988)).toBe(Infinity);
    expect(quoteCheckOut(375003, 1499.988, 2000)).toBe(Infinity);
  });
  it("returns Infinity on zero reserves and 0 for q <= 0", () => {
    expect(quoteCheckOut(375003, 0, 1)).toBe(Infinity);
    expect(quoteCheckOut(0, 1500, 1)).toBe(0);
    expect(quoteCheckOut(375003, 1500, 0)).toBe(0);
    expect(quoteCheckOut(375003, 1500, -1)).toBe(0);
  });
});

describe("quoteCheckOutWei", () => {
  it("rounds up like Math.mulDiv(..., Ceil)", () => {
    // reserveMDM 10, reserveMCU 3, q 1 -> 10*3/2 = 15 exactly -> 5
    expect(quoteCheckOutWei(B(10), B(3), B(1))).toBe(B(5));
    // reserveMDM 10, reserveMCU 3, q 2 -> 10*3/1 = 30 -> 20
    expect(quoteCheckOutWei(B(10), B(3), B(2))).toBe(B(20));
    // reserveMDM 7, reserveMCU 5, q 2 -> 35/3 = 11.67 -> ceil 12 -> 5
    expect(quoteCheckOutWei(B(7), B(5), B(2))).toBe(B(5));
    // floor would give 4 here
  });
  it("agrees with the float quote at 18 decimals", () => {
    const got = quoteCheckOutWei(wad(375003), B("1499988000000000000000"), wad(1));
    expect(Number(got) / 1e18).toBeCloseTo(250.17, 2);
  });
  it("returns 0 for q = 0", () => {
    expect(quoteCheckOutWei(wad(375003), wad(1500), B(0))).toBe(B(0));
  });
  it("throws RangeError when q >= reserveMcu (contract: ExceedsReserve)", () => {
    expect(() => quoteCheckOutWei(wad(375003), wad(1500), wad(1500))).toThrow(RangeError);
    expect(() => quoteCheckOutWei(wad(375003), B(0), B(0))).toThrow(RangeError);
  });
});

describe("mcuPerDayCreditUsd", () => {
  it("is $1 per eligible MCU per day", () => {
    expect(mcuPerDayCreditUsd(0)).toBe(0);
    expect(mcuPerDayCreditUsd(12.5)).toBe(12.5);
  });
});

describe("midnight UTC", () => {
  it("nextMidnightUtc is the following 00:00 UTC", () => {
    const now = new Date("2026-10-05T02:17:00Z");
    expect(nextMidnightUtc(now).toISOString()).toBe("2026-10-06T00:00:00.000Z");
  });
  it("at exactly midnight the next midnight is a full day away", () => {
    const now = new Date("2026-10-05T00:00:00Z");
    expect(nextMidnightUtc(now).toISOString()).toBe("2026-10-06T00:00:00.000Z");
    expect(secondsToMidnightUtc(now)).toBe(86400);
  });
  it("secondsToMidnightUtc counts whole seconds remaining", () => {
    expect(secondsToMidnightUtc(new Date("2026-10-05T23:59:59Z"))).toBe(1);
    expect(secondsToMidnightUtc(new Date("2026-10-05T23:59:59.400Z"))).toBe(1);
    expect(secondsToMidnightUtc(new Date("2026-10-05T12:00:00Z"))).toBe(43200);
  });
  it("crosses month and year boundaries", () => {
    expect(nextMidnightUtc(new Date("2026-12-31T23:00:00Z")).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
    expect(secondsToMidnightUtc(new Date("2026-12-31T23:00:00Z"))).toBe(3600);
  });
});

describe("freeStake", () => {
  it("is amount minus locked", () => {
    expect(freeStake(wad(10), wad(3))).toBe(wad(7));
  });
  it("never goes negative", () => {
    expect(freeStake(wad(3), wad(10))).toBe(B(0));
    expect(freeStake(B(0), B(0))).toBe(B(0));
  });
});

describe("mdmPriceUsd", () => {
  it("divides USDC (6 dp) by MDM (18 dp)", () => {
    // 50,000 USDC / 100,000 MDM = $0.50
    expect(mdmPriceUsd(B(50_000) * B(1_000_000), wad(100_000))).toBeCloseTo(0.5, 12);
  });
  it("is 0 when the MDM reserve is 0", () => {
    expect(mdmPriceUsd(B(1_000_000), B(0))).toBe(0);
  });
});

describe("queues", () => {
  const q = (items: [number, number][]): QueueItem[] =>
    items.map(([a, t]) => ({ amount: wad(a), unlockTimestamp: B(t) }));
  const queue = q([
    [1, 1000],
    [2, 2000],
    [3, 3000],
  ]);

  it("pendingQueue returns items from head on", () => {
    expect(pendingQueue(queue, B(0))).toEqual(queue);
    expect(pendingQueue(queue, B(1))).toEqual(queue.slice(1));
    expect(pendingQueue(queue, B(3))).toEqual([]);
  });
  it("pendingQueue handles empty queue and head beyond length", () => {
    expect(pendingQueue([], B(0))).toEqual([]);
    expect(pendingQueue(queue, B(99))).toEqual([]);
  });
  it("maturedTotal sums items with unlockTimestamp <= now", () => {
    expect(maturedTotal(queue, B(0), 2000)).toBe(wad(3));
    expect(maturedTotal(queue, B(0), 1999)).toBe(wad(1));
    expect(maturedTotal(queue, B(1), 2000)).toBe(wad(2));
    expect(maturedTotal(queue, B(0), 999)).toBe(B(0));
    expect(maturedTotal([], B(0), 5000)).toBe(B(0));
    expect(maturedTotal(queue, B(10), 5000)).toBe(B(0));
  });
  it("nextUnlock is the earliest future item or null", () => {
    expect(nextUnlock(queue, B(0), 1500)).toEqual(queue[1]);
    expect(nextUnlock(queue, B(0), 0)).toEqual(queue[0]);
    expect(nextUnlock(queue, B(0), 3000)).toBeNull();
    expect(nextUnlock(queue, B(2), 1000)).toEqual(queue[2]);
    expect(nextUnlock([], B(0), 0)).toBeNull();
    expect(nextUnlock(queue, B(7), 0)).toBeNull();
  });
  it("nextUnlock does not assume the queue is sorted", () => {
    const unsorted = q([
      [1, 3000],
      [2, 1500],
    ]);
    expect(nextUnlock(unsorted, B(0), 1000)).toEqual(unsorted[1]);
  });
  it("thawProgress is clamped to 0..1", () => {
    const thaw = 7 * 86400;
    const unlock = 1_000_000;
    expect(thawProgress(unlock, thaw, unlock - thaw)).toBe(0);
    expect(thawProgress(unlock, thaw, unlock - thaw / 2)).toBeCloseTo(0.5, 10);
    expect(thawProgress(unlock, thaw, unlock)).toBe(1);
    expect(thawProgress(unlock, thaw, unlock + 5)).toBe(1);
    expect(thawProgress(unlock, thaw, unlock - thaw - 5)).toBe(0);
    expect(thawProgress(B(unlock), thaw, unlock - thaw / 4)).toBeCloseTo(0.75, 10);
    expect(thawProgress(unlock, 0, unlock - 1)).toBe(1);
  });
});

describe("fmtAmount", () => {
  it("formats with en-US grouping and trims trailing zeros", () => {
    expect(fmtAmount(wad(1234567))).toBe("1,234,567");
    expect(fmtAmount(B("1500000000000000000"))).toBe("1.5");
    expect(fmtAmount(B("1234567890000000000000"))).toBe("1,234.5679");
    expect(fmtAmount(B(0))).toBe("0");
  });
  it("rounds half up at maxFrac", () => {
    expect(fmtAmount(B("1999950000000000000"))).toBe("2");
    expect(fmtAmount(B("1999949999999999999"))).toBe("1.9999");
  });
  it("shows <0.0001 for tiny non-zero values", () => {
    expect(fmtAmount(B(1))).toBe("<0.0001");
    expect(fmtAmount(B("49999999999999"))).toBe("<0.0001");
    expect(fmtAmount(B("50000000000000"))).toBe("0.0001");
    expect(fmtAmount(B(1), 18, 2)).toBe("<0.01");
  });
  it("respects decimals and maxFrac", () => {
    expect(fmtAmount(B(1_234_560), 6)).toBe("1.2346");
    expect(fmtAmount(B(1_234_560), 6, 2)).toBe("1.23");
    expect(fmtAmount(B(1_234_560), 6, 0)).toBe("1");
    expect(fmtAmount(B(12), 0)).toBe("12");
  });
  it("handles negatives", () => {
    expect(fmtAmount(-wad(5))).toBe("-5");
  });
});

describe("fmtNumber / fmtPct / fmtUsd", () => {
  it("fmtNumber groups and limits fraction digits", () => {
    expect(fmtNumber(1234.567)).toBe("1,234.57");
    expect(fmtNumber(1234.5, 0)).toBe("1,235");
    expect(fmtNumber(0.123456, 4)).toBe("0.1235");
    expect(fmtNumber(NaN)).toBe("—");
    expect(fmtNumber(Infinity)).toBe("∞");
  });
  it("fmtPct appends a percent sign", () => {
    expect(fmtPct(282.875)).toBe("282.88%");
    expect(fmtPct(0)).toBe("0%");
  });
  it("fmtUsd drops cents at 100 and above, keeps them below", () => {
    expect(fmtUsd(1234)).toBe("$1,234");
    expect(fmtUsd(1234.56)).toBe("$1,235");
    expect(fmtUsd(100)).toBe("$100");
    expect(fmtUsd(99.999)).toBe("$100"); // rounds to cents first, so "$100.00" never appears
    expect(fmtUsd(99.994)).toBe("$99.99");
    expect(fmtUsd(12.5)).toBe("$12.50");
    expect(fmtUsd(0.3875)).toBe("$0.39");
    expect(fmtUsd(0)).toBe("$0.00");
  });
  it("fmtUsd shows <$0.01 for tiny positive values and handles negatives", () => {
    expect(fmtUsd(0.004)).toBe("<$0.01");
    expect(fmtUsd(-12.5)).toBe("-$12.50");
    expect(fmtUsd(-1234)).toBe("-$1,234");
  });
});

describe("fmtDuration", () => {
  it("uses days and hours above a day", () => {
    expect(fmtDuration(4 * 86400 + 11 * 3600 + 59 * 60)).toBe("4d 11h");
    expect(fmtDuration(86400)).toBe("1d 00h");
  });
  it("uses hours and minutes above an hour", () => {
    expect(fmtDuration(11 * 3600 + 2 * 60 + 59)).toBe("11h 02m");
    expect(fmtDuration(3600)).toBe("1h 00m");
  });
  it("uses mm:ss below an hour", () => {
    expect(fmtDuration(2 * 60 + 17)).toBe("02:17");
    expect(fmtDuration(59 * 60 + 59)).toBe("59:59");
    expect(fmtDuration(5)).toBe("00:05");
  });
  it("clamps zero and negatives", () => {
    expect(fmtDuration(0)).toBe("00:00");
    expect(fmtDuration(-10)).toBe("00:00");
  });
});

describe("fmtUtc / fmtLocal", () => {
  const ts = Math.floor(Date.UTC(2026, 9, 5, 2, 17, 45) / 1000); // 2026-10-05 is a Monday
  it("fmtUtc renders weekday, month, day and hh:mm UTC", () => {
    expect(fmtUtc(Date.UTC(2026, 9, 4, 2, 17) / 1000)).toBe("Sun, Oct 4, 02:17 UTC");
    expect(fmtUtc(ts)).toBe("Mon, Oct 5, 02:17 UTC");
    expect(fmtUtc(Date.UTC(2027, 0, 1, 0, 0) / 1000)).toBe("Fri, Jan 1, 00:00 UTC");
  });
  it("fmtUtc accepts bigint seconds", () => {
    expect(fmtUtc(B(ts))).toBe("Mon, Oct 5, 02:17 UTC");
  });
  it("fmtLocal has the same shape in the user's zone", () => {
    const d = new Date(ts * 1000);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const prefix = `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${hh}:${mm}`;
    const out = fmtLocal(ts);
    expect(out.startsWith(prefix)).toBe(true);
    // zone label after the time, e.g. "GMT-3" or "BRT" or "UTC"
    expect(out).toMatch(/^\w{3}, \w{3} \d{1,2}, \d{2}:\d{2} \S+$/);
  });
});

describe("parseAmount", () => {
  it("parses integers and decimals with dot or comma", () => {
    expect(parseAmount("10")).toBe(wad(10));
    expect(parseAmount("10.5")).toBe(B("10500000000000000000"));
    expect(parseAmount("10,5")).toBe(B("10500000000000000000"));
    expect(parseAmount(" 0.25 ")).toBe(B("250000000000000000"));
    expect(parseAmount(".5")).toBe(B("500000000000000000"));
    expect(parseAmount("5.")).toBe(wad(5));
    expect(parseAmount("0")).toBe(B(0));
  });
  it("respects decimals", () => {
    expect(parseAmount("12.345678", 6)).toBe(B(12_345_678));
    expect(parseAmount("1", 0)).toBe(B(1));
  });
  it("returns null for junk, negatives and too many decimals", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-1")).toBeNull();
    expect(parseAmount("1e5")).toBeNull();
    expect(parseAmount("1.2.3")).toBeNull();
    expect(parseAmount("1,000.5")).toBeNull();
    expect(parseAmount(".")).toBeNull();
    expect(parseAmount("0x10")).toBeNull();
    expect(parseAmount("1.1234567", 6)).toBeNull();
    expect(parseAmount("1.5", 0)).toBeNull();
  });
});
