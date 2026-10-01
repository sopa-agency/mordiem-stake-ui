'use client';
// Protocol page: a bento of spotlight cards, every number live from useProtocol.
import type { ReactNode } from 'react';
import { Chip, CountUp, SpotlightCard, cn } from '@/components/ui';
import { useProtocol } from '@/hooks/useProtocol';
import { ADDR, SCHEDULED_RESERVE_CHANGE, addrUrl } from '@/lib/contracts/addresses';
import { cumulativeEmitted, emissionPerDay, fmtDuration, fmtLocal, fmtUtc, mdmPriceUsd, quoteCheckOut, stakerAprPct } from '@/lib/protocol';
import { Note, dayIndex, reserveChangePending, shortDateLocal, toNum, useNow } from './common';

export function ProtocolView() {
  const now = useNow();
  const { data: p, error } = useProtocol();
  const t = dayIndex(p, now);
  const rMdm = toNum(p?.reserveMdm);
  const rMcu = toNum(p?.reserveMcu);
  const rate = p ? quoteCheckOut(rMdm, rMcu, 1) : 0;
  const pending = reserveChangePending(now) && !!p;
  const rateAfter = pending ? quoteCheckOut(rMdm, rMcu + SCHEDULED_RESERVE_CHANGE.deltaMcu, 1) : 0;
  const price = p ? mdmPriceUsd(p.poolUsdc, p.poolMdm) : 0;
  const totalStaked = toNum(p?.totalStaked);
  const changeDay = shortDateLocal(SCHEDULED_RESERVE_CHANGE.executableAt);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Protocol</div>
          <h1 className="font-display text-[28px] font-semibold leading-tight text-ink">Mordiem on Base, live</h1>
        </div>
        <p className="num text-[12px] text-ink-3">{p ? `Day ${t.toFixed(2)} since genesis · read ${fmtLocal(Math.floor(p.readAt / 1000))}` : 'Reading Base…'}</p>
      </div>
      {error && !p && <Note tone="bad">Could not reach Base right now; figures will appear when a node answers.</Note>}

      <div className="grid gap-4 min-[600px]:grid-cols-2 min-[1000px]:grid-cols-4">
        <Card title="Emission" span={2} note="E(t) = t(t+1)/2 MDM; half to stakers, half to the capital pools.">
          <Big label="Today" value={<CountUp to={emissionPerDay(t)} decimals={2} />} unit="MDM / day" />
          <Row label="Cumulative on chain" value={<CountUp to={toNum(p?.cumulativeEmitted)} decimals={2} suffix=" MDM" />} />
          <Row label="Cumulative by formula" value={<CountUp to={cumulativeEmitted(t)} decimals={2} suffix=" MDM" />} />
        </Card>

        <Card title="Staking" span={2}>
          <Big label="Staked by everyone" value={<CountUp to={totalStaked} decimals={2} />} unit="sMDM" />
          <Row label="Locked behind MCU" value={<CountUp to={toNum(p?.totalLocked)} decimals={2} suffix=" sMDM" />} />
          <Row label="Snapshot APR for free sMDM" value={<CountUp to={p ? stakerAprPct(totalStaked, t) : 0} decimals={1} suffix="%" />} />
        </Card>

        <Card title="Check-out curve" span={2} note="MDM to lock = reserveMCU × reserveMDM ÷ (reserveMCU − q) − reserveMDM, rounded up.">
          <Big
            label="Locks per MCU today"
            value={<CountUp to={Number.isFinite(rate) ? rate : 0} decimals={2} />}
            unit="MDM"
            aside={pending && <Chip>{rateAfter.toFixed(2)} from {changeDay}</Chip>}
          />
          <Row label="Reserve MCU" value={<CountUp to={rMcu} decimals={3} suffix=" MCU" />} />
          <Row label="Reserve MDM" value={<CountUp to={rMdm} decimals={0} suffix=" MDM" />} />
          {pending && (
            <Row
              label={`Scheduled +${SCHEDULED_RESERVE_CHANGE.deltaMcu.toLocaleString('en-US')} MCU reserve`}
              value={<span className="num text-right text-[13px] text-ink-2">{fmtLocal(SCHEDULED_RESERVE_CHANGE.executableAt)}<span className="block text-ink-3">({fmtUtc(SCHEDULED_RESERVE_CHANGE.executableAt)})</span></span>}
            />
          )}
        </Card>

        <Card title="MDM price" span={2} note={<a href={addrUrl(ADDR.Pool)} target="_blank" rel="noreferrer" className="hover:text-ink-2">Aerodrome vAMM USDC/MDM ↗</a>}>
          <Big label="Spot from pool reserves" value={<CountUp to={price} decimals={2} prefix="$" />} />
          <Row label="USDC in the pool" value={<CountUp to={toNum(p?.poolUsdc, 6)} decimals={0} prefix="$" />} />
          <Row label="MDM in the pool" value={<CountUp to={toNum(p?.poolMdm)} decimals={2} suffix=" MDM" />} />
        </Card>

        <Card title="Supply" note="Circulating is not shown: the treasury balance is not read.">
          <Big label="Total supply" value={<CountUp to={toNum(p?.totalSupply)} decimals={0} />} unit="MDM" />
          <Row label="Burned by buyback" value={<CountUp to={toNum(p?.burnedMdm)} decimals={2} suffix=" MDM" />} />
        </Card>

        <Card title="Buyback">
          <Big label="USDC executed" value={<CountUp to={toNum(p?.buybackUsdc, 6)} decimals={0} prefix="$" />} />
          <Row label="Cash waiting" value={<CountUp to={toNum(p?.buybackCashUsdc, 6)} decimals={0} prefix="$" />} />
          <Row label="MDM burned" value={<CountUp to={toNum(p?.burnedMdm)} decimals={2} suffix=" MDM" />} />
        </Card>

        <Card title="Status">
          <div className="flex flex-wrap gap-2">
            <Chip tone={p?.paused.stake ? 'neutral' : 'good'}>{p?.paused.stake ? 'MDM staking paused' : 'MDM staking open'}</Chip>
            <Chip tone={p?.paused.checkOut ? 'neutral' : 'good'}>{p?.paused.checkOut ? 'Check-out paused' : 'Check-out open'}</Chip>
            <Chip tone={p?.paused.stakeMcu ? 'neutral' : 'good'}>{p?.paused.stakeMcu ? 'MCU staking paused' : 'MCU staking open'}</Chip>
            <Chip tone={p ? (p.solvent ? 'good' : 'neutral') : 'neutral'}>{p ? (p.solvent ? 'Solvent' : 'Solvency check failed') : 'Checking…'}</Chip>
          </div>
          <Row label="Live since" value={<span className="num text-right text-[13px] text-ink-2">{p ? fmtUtc(p.goLiveTs) : '…'}</span>} />
          <Row label="MCU earning credit today" value={<CountUp to={toNum(p?.totalEligible)} decimals={2} suffix=" MCU" />} />
        </Card>

        <Card title="Limits">
          <Row label="MDM thaw" value={<span className="num">{p ? fmtDuration(p.mdmThawSec) : '…'}</span>} />
          <Row label="MCU thaw" value={<span className="num">{p ? fmtDuration(p.mcuThawSec) : '…'}</span>} />
          <Row label="Minimum check-out" value={<CountUp to={toNum(p?.minCheckout)} decimals={2} suffix=" MCU" />} />
          <Row label="Max open positions" value={<CountUp to={p?.maxPositions ?? 0} decimals={0} />} />
        </Card>
      </div>
    </>
  );
}

function Card({ title, span, note, children }: { title: string; span?: 2; note?: ReactNode; children: ReactNode }) {
  return (
    <SpotlightCard as="section" className={cn('flex flex-col p-5', span === 2 && 'min-[600px]:col-span-2')}>
      <div className="flex flex-col gap-4">
        <h2 className="font-display text-[16px] font-semibold text-ink">{title}</h2>
        <div className="flex flex-col gap-2">{children}</div>
        {note && <p className="text-[11px] leading-snug text-ink-3">{note}</p>}
      </div>
    </SpotlightCard>
  );
}

function Big({ label, value, unit, aside }: { label: string; value: ReactNode; unit?: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 pb-2">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{label}</span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-display num text-[32px] font-semibold leading-none text-ink">
          {value}
          {unit && <span className="ml-1.5 text-[14px] font-medium text-ink-3">{unit}</span>}
        </span>
        {aside}
      </span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-rule-2 pt-2 text-[13px]">
      <span className="text-ink-2">{label}</span>
      <span className="font-display num text-[15px] font-medium text-ink">{value}</span>
    </div>
  );
}
