'use client';
// The hero: split-flap countdown to the 00:00 UTC credit refill, today's credit battery, and the network's live figures.
import { Battery, Chip, CountUp, DotField, Noise, SplitFlap } from '@/components/ui';
import { SCHEDULED_RESERVE_CHANGE } from '@/lib/contracts/addresses';
import { emissionPerDay, fmtLocal, mcuPerDayCreditUsd, mdmPriceUsd, nextMidnightUtc, quoteCheckOut, secondsToMidnightUtc } from '@/lib/protocol';
import { Stat, dayIndex, hms, reserveChangePending, shortAddress, shortDateUtc, toNum, useNow, type PanelProps } from './common';

export function EpochMeter({ protocol, account, connected, readOnly, address }: PanelProps & { address?: string }) {
  const now = useNow();
  const nowDate = now === null ? null : new Date(now * 1000);
  const clock = nowDate ? hms(secondsToMidnightUtc(nowDate)) : '00:00:00';
  const midnight = nowDate ? nextMidnightUtc(nowDate) : null;

  const t = dayIndex(protocol, now);
  const rMdm = toNum(protocol?.reserveMdm);
  const rMcu = toNum(protocol?.reserveMcu);
  const rate = protocol ? quoteCheckOut(rMdm, rMcu, 1) : 0;
  const pending = reserveChangePending(now) && !!protocol;
  const rateAfter = pending ? quoteCheckOut(rMdm, rMcu + SCHEDULED_RESERVE_CHANGE.deltaMcu, 1) : 0;
  const price = protocol ? mdmPriceUsd(protocol.poolUsdc, protocol.poolMdm) : 0;

  const eligible = toNum(account?.vault.eligible);
  const thawing = toNum(account?.vault.thawing);
  const everyone = toNum(protocol?.totalEligible);
  const cells = connected ? Math.max(1, Math.ceil(eligible + thawing)) : Math.max(1, Math.ceil(everyone));
  const filled = connected ? eligible : everyone;

  return (
    <section className="edge relative overflow-hidden rounded-sheet bg-sheet ring-1 ring-inset ring-rule" aria-label="Epoch meter">
      <DotField />
      <Noise />
      <div className="relative grid gap-8 p-5 min-[900px]:grid-cols-[1.25fr_1fr] min-[900px]:p-8">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">
              {connected && !readOnly ? 'Your API credit refills in' : 'API credit refills in'}
            </span>
            <SplitFlap value={clock} aria-label="Time until the next 00:00 UTC credit refill" className="text-[44px] min-[720px]:text-[64px]" />
            <span className="num text-[13px] text-ink-3">
              Refills at 00:00 UTC{midnight ? ` · ${fmtLocal(Math.floor(midnight.getTime() / 1000))} in your zone` : ''}. Each staked MCU earns $1 of credit a day.
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <Battery
              cells={Math.min(cells, 10_000)}
              filled={filled}
              label={connected ? (readOnly ? `Credit for ${address ? shortAddress(address) : 'this address'} today` : "Today's credit") : 'Credit scheduled for everyone today'}
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="font-display num text-[28px] font-semibold text-charge">
                <CountUp to={mcuPerDayCreditUsd(filled)} decimals={2} prefix="$" suffix=" / day" />
              </span>
              <span className="text-[13px] text-ink-3">
                {connected ? (
                  thawing > 0 ? `${thawing.toLocaleString('en-US', { maximumFractionDigits: 4 })} MCU thawing stopped earning` : 'From MCU staked in the vault'
                ) : (
                  'Connect to see yours'
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-6 self-center min-[900px]:gap-y-9 min-[900px]:border-l min-[900px]:border-rule-2 min-[900px]:pl-8">
          <Stat label="New MDM per day">
            <CountUp to={emissionPerDay(t)} decimals={1} />
            <span className="ml-1.5 font-body text-[13px] font-medium text-ink-3">MDM / day</span>
          </Stat>
          <Stat label="Staked by everyone">
            <CountUp to={toNum(protocol?.totalStaked)} decimals={2} />
            <span className="ml-1.5 font-body text-[13px] font-medium text-ink-3">MDM</span>
          </Stat>
          <Stat label="Locked per MCU">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span><CountUp to={Number.isFinite(rate) ? rate : 0} decimals={2} /><span className="ml-1.5 font-body text-[13px] font-medium text-ink-3">MDM</span></span>
              {pending && <Chip>{rateAfter.toFixed(2)} from {shortDateUtc(SCHEDULED_RESERVE_CHANGE.executableAt)}</Chip>}
            </span>
          </Stat>
          <Stat label="MDM price">
            <CountUp to={price} decimals={2} prefix="$" />
            <span className="ml-1 text-[12px] font-medium text-ink-3">Aerodrome</span>
          </Stat>
        </div>
      </div>
    </section>
  );
}
