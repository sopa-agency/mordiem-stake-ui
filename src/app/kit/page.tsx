'use client';
import { useEffect, useState, type ReactNode } from 'react';
import {
  AnimatedList,
  Battery,
  Button,
  Chip,
  Counter,
  CountUp,
  Dock,
  DotField,
  ElasticSlider,
  Field,
  Noise,
  PillNav,
  Ring,
  Segmented,
  ShinyText,
  SplitFlap,
  SpotlightCard,
  StarBorder,
  Stepper,
  SurfaceToggle,
  ToastProvider,
  useToast,
  type Surface,
  type Step,
} from '@/components/ui';

const NAV = [
  { href: '/', label: 'Stake', icon: <IconStake /> },
  { href: '/positions', label: 'Positions', icon: <IconPositions /> },
  { href: '/protocol', label: 'Protocol', icon: <IconProtocol /> },
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function toMidnightUtc(now: Date) {
  const s = 86400 - (now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds());
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export default function KitPage() {
  return (
    <ToastProvider offset={88}>
      <Kit />
    </ToastProvider>
  );
}

function Kit() {
  const [surface, setSurface] = useState<Surface>('night');
  useEffect(() => {
    document.documentElement.dataset.surface = surface;
  }, [surface]);

  const [clock, setClock] = useState('20:03:29');
  useEffect(() => {
    const t = setInterval(() => setClock(toMidnightUtc(new Date())), 1000);
    return () => clearInterval(t);
  }, []);

  const [amount, setAmount] = useState('10.00');
  const [mode, setMode] = useState<'stake' | 'unstake'>('stake');
  const [mcu, setMcu] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [stepIndex, setStepIndex] = useState(1);
  const [tick, setTick] = useState(250.17);
  const [items, setItems] = useState([
    { id: 1, amount: '4.00', when: 'Unlocks Oct 8, 14:22 (12:22 UTC)' },
    { id: 2, amount: '2.50', when: 'Unlocks Oct 9, 09:10 (07:10 UTC)' },
    { id: 3, amount: '1.00', when: 'Matured' },
  ]);
  const [nav, setNav] = useState('/');
  const { toast } = useToast();

  useEffect(() => {
    const t = setInterval(() => setTick((v) => Math.round((v + 0.37) * 100) / 100), 2000);
    return () => clearInterval(t);
  }, []);

  const steps: Step[] = [
    { label: 'Approve', detail: '10.00 MDM', status: stepIndex > 0 ? 'done' : stepIndex === 0 ? 'active' : 'todo' },
    { label: 'Stake', detail: 'Core.stake', status: stepIndex > 1 ? 'done' : stepIndex === 1 ? 'active' : 'todo' },
    { label: 'Confirmed', detail: stepIndex > 2 ? '0x8f3a…c21e' : undefined, status: stepIndex > 2 ? 'done' : stepIndex === 2 ? 'active' : 'todo' },
  ];

  const amountNum = Number(amount) || 0;
  const invalid = amountNum > 42.5;

  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-10 px-4 pb-32 pt-6 min-[720px]:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="font-display text-[18px] font-bold tracking-tight">Mordiem Stake · kit</span>
          <PillNav items={NAV} current={nav} className="hidden min-[720px]:block" />
        </div>
        <div className="flex items-center gap-3">
          <Segmented
            aria-label="Pretend route"
            options={NAV.map((n) => ({ value: n.href, label: n.label }))}
            value={nav}
            onChange={setNav}
          />
          <SurfaceToggle surface={surface} onToggle={() => setSurface((s) => (s === 'night' ? 'day' : 'night'))} />
        </div>
      </header>

      {/* Hero: epoch meter */}
      <section className="edge relative overflow-hidden rounded-sheet bg-sheet ring-1 ring-inset ring-rule">
        <DotField />
        <Noise />
        <div className="relative grid gap-8 p-6 min-[720px]:grid-cols-[1.2fr_1fr] min-[720px]:p-8">
          <div className="flex flex-col gap-3">
            <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">Next epoch in</span>
            <SplitFlap value={clock} aria-label="Time to next epoch" className="text-[44px] min-[720px]:text-[64px]" />
            <span className="text-[13px] text-ink-3">Credit renews at 00:00 UTC. Rewards accrue per block.</span>
          </div>
          <div className="flex flex-col justify-end gap-5">
            <Battery cells={12} filled={12} label="Today's credit" />
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Total staked">
                <CountUp to={1_284_902.4} decimals={1} suffix=" MDM" />
              </Stat>
              <Stat label="Emission / day">
                <CountUp to={112.5} decimals={1} />
              </Stat>
              <Stat label="Live quote">
                <Counter value={tick} decimals={2} />
              </Stat>
            </div>
          </div>
        </div>
      </section>

      {/* Buttons */}
      <Section title="Button" note="primary · secondary · ghost · destructive — loading, success, disabled with reason, magnet + spark">
        <div className="flex flex-wrap items-start gap-3">
          <Button magnet spark onClick={() => toast({ title: 'Staked 10.00 MDM', href: 'https://basescan.org', hrefLabel: 'Basescan', tone: 'good' })}>
            Stake 10.00 MDM
          </Button>
          <Button variant="secondary">Request unstake</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Check in 1.00 MCU</Button>
          <Button size="lg" magnet spark>
            Check out 1.00 MCU
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-start gap-3">
          <Button loading={loading} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1800); }}>
            Stake 10.00 MDM
          </Button>
          <Button variant="secondary" success={success} onClick={() => { setSuccess(true); setTimeout(() => setSuccess(false), 2200); }}>
            {success ? 'Staked' : 'Stake'}
          </Button>
          <Button disabledReason="You only have 8.20 sMDM free; the rest is locked behind MCU.">Check out 1.00 MCU</Button>
          <StarBorder color="var(--charge)">
            <Button variant="secondary" spark>
              Claim 3.41 MDM
            </Button>
          </StarBorder>
        </div>
      </Section>

      {/* Ledger controls */}
      <Section title="Field · Segmented · Elastic Slider">
        <div className="grid gap-6 min-[720px]:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-4">
            <Segmented
              aria-label="Stake or unstake"
              options={[
                { value: 'stake', label: 'Stake' },
                { value: 'unstake', label: 'Unstake' },
              ]}
              value={mode}
              onChange={setMode}
              size="lg"
            />
            <Field
              id="kit-amount"
              label={mode === 'stake' ? 'Amount to stake' : 'Amount to unstake'}
              value={amount}
              onChange={setAmount}
              token="MDM"
              onMax={() => setAmount('42.50')}
              helper="Balance 42.50 MDM"
              error={invalid ? 'You do not have that much.' : undefined}
            />
            <Field id="kit-smdm" label="Free to check out" value="250.17" onChange={() => {}} token="sMDM" helper="8.20 sMDM locked" disabled />
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            <ElasticSlider min={0.01} max={5} step={0.01} value={mcu} onChange={setMcu} label="Check out" format={(v) => `${v.toFixed(2)} MCU`} />
            <div className="num grid grid-cols-2 gap-3 text-[13px]">
              <Readout k="Costs" v={`${(mcu * 250.17).toFixed(2)} sMDM`} />
              <Readout k="Gives up" v={`about $${(mcu * 0.84).toFixed(2)}/day`} tone="bad" />
            </div>
            <Stepper steps={steps} />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStepIndex((i) => Math.max(0, i - 1))}>
                Back
              </Button>
              <Button variant="secondary" onClick={() => setStepIndex((i) => Math.min(3, i + 1))}>
                Advance
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* Status */}
      <Section title="Chip · Ring · Shiny Text">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="signal">Base</Chip>
          <Chip tone="thaw" pulse>
            Thawing 4d 11h
          </Chip>
          <Chip tone="charge">Locked for MCU</Chip>
          <Chip tone="good" pulse>
            <ShinyText tone="good">Ready to claim</ShinyText>
          </Chip>
          <Chip>Paused by guardian</Chip>
        </div>
        <div className="mt-6 flex flex-wrap items-end gap-8">
          <div className="flex items-center gap-3">
            <Ring progress={0.36} label="4d" title="Thawing, 36% done" />
            <div className="text-[13px]">
              <div className="num font-medium text-ink">4.00 sMDM thawing</div>
              <div className="num text-ink-3">Unlocks Oct 8, 14:22 · 12:22 UTC</div>
            </div>
          </div>
          <Ring progress={0.72} label="17h" tone="signal" size={72} title="MCU unstake, 72% done" />
          <Ring progress={1} label="✓" tone="charge" size={44} title="Credit full" />
          <Ring progress={0.08} size={56} label="7d" />
        </div>
      </Section>

      {/* Lists and cards */}
      <Section title="Spotlight Card · Animated List">
        <div className="grid gap-6 min-[720px]:grid-cols-2">
          <SpotlightCard className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">Position #3</div>
                <div className="font-display num mt-1 text-[28px] font-semibold text-ink">1.00 MCU</div>
              </div>
              <Chip tone="charge">Locked for MCU</Chip>
            </div>
            <dl className="num mt-4 grid grid-cols-2 gap-y-1 text-[13px]">
              <dt className="text-ink-3">Locked</dt>
              <dd className="text-right text-ink">250.17 sMDM</dd>
              <dt className="text-ink-3">Rate</dt>
              <dd className="text-right text-ink">250.17 MDM / MCU</dd>
              <dt className="text-ink-3">Opened</dt>
              <dd className="text-right text-ink">Sep 28, 2026</dd>
            </dl>
            <div className="mt-4 flex gap-2">
              <Button variant="destructive" size="md">
                Check in
              </Button>
            </div>
          </SpotlightCard>
          <div className="flex flex-col gap-3">
            <AnimatedList
              items={items}
              renderItem={(it) => (
                <div className="edge flex items-center justify-between gap-3 rounded-control bg-sheet-2 px-4 py-3 ring-1 ring-inset ring-rule-2">
                  <div className="num text-[13px]">
                    <div className="font-medium text-ink">{it.amount} sMDM</div>
                    <div className="text-ink-3">{it.when}</div>
                  </div>
                  {it.when === 'Matured' ? <Chip tone="good">Ready</Chip> : <Ring progress={0.36} size={28} tone="thaw" />}
                </div>
              )}
              empty={<div className="text-[13px] text-ink-3">Nothing in the queue.</div>}
            />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setItems((l) => [...l, { id: Date.now(), amount: (Math.random() * 5 + 0.5).toFixed(2), when: 'Unlocks in 7 days' }])}>
                Add
              </Button>
              <Button variant="ghost" onClick={() => setItems((l) => l.slice(1))}>
                Remove first
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Toast" note="bottom-center, spring in, 5 s, stack of 3">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => toast({ title: 'Staked 10.00 MDM', href: 'https://basescan.org', hrefLabel: 'Basescan', tone: 'good' })}>
            Toast: staked
          </Button>
          <Button variant="secondary" onClick={() => toast({ title: 'Unstake requested', description: 'Unlocks Oct 8, 14:22', tone: 'thaw' })}>
            Toast: thawing
          </Button>
          <Button variant="secondary" onClick={() => toast({ title: 'You do not have that much.', tone: 'bad' })}>
            Toast: error
          </Button>
        </div>
      </Section>

      <Section title="Battery over 24 cells" note="switches to a continuous bar with a legend">
        <Battery cells={120} filled={83} label="Today's credit" />
      </Section>

      <Dock items={NAV} current={nav} />
    </main>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-rule-2 pb-2">
        <h2 className="font-display text-[16px] font-semibold text-ink">{title}</h2>
        {note && <span className="text-[12px] text-ink-3">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{label}</span>
      <span className="font-display truncate text-[18px] font-semibold text-ink">{children}</span>
    </div>
  );
}

function Readout({ k, v, tone }: { k: string; v: string; tone?: 'bad' }) {
  return (
    <div className="edge flex flex-col gap-0.5 rounded-control bg-sheet-2 px-3 py-2 ring-1 ring-inset ring-rule-2">
      <span className="text-[11px] uppercase tracking-[0.08em] text-ink-3">{k}</span>
      <span className={tone === 'bad' ? 'font-medium text-bad' : 'font-medium text-ink'}>{v}</span>
    </div>
  );
}

function IconStake() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 13l7 4 7-4M3 9l7 4 7-4M3 5l7 4 7-4" />
    </svg>
  );
}
function IconPositions() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="14" height="12" rx="2" />
      <path d="M3 9h14M8 9v7" />
    </svg>
  );
}
function IconProtocol() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 16c4-9 10-9 14-1" />
      <circle cx="10" cy="10" r="7" />
    </svg>
  );
}
