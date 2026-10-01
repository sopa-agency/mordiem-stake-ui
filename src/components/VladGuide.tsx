'use client';
// Vlad closes every page: a speech bubble over his avatar (the vlad.skatehive.app device) that explains the
// tab you are on as if you were five. The line types itself when the section scrolls into view.
// Mounted with key={pathname} so a new tab remounts it and the typing starts over.
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useReducedMotion } from 'motion/react';
import { SCHEDULED_RESERVE_CHANGE } from '@/lib/contracts';

const HOME = 'https://skatehive.app';

/** Plain words, short sentences, one idea each. */
export function explain(path: string, nowSec: number): string {
  const before = nowSec < SCHEDULED_RESERVE_CHANGE.executableAt;
  if (path.startsWith('/stake/pools')) {
    return 'The capital pools take USDC, wstETH, MOR or VVV. Your principal stays yours. The yield those assets earn goes to the protocol, and you are paid in MDM from the capital half of the emission, in proportion to the real yield your pool brought in over the last 90 days. Withdrawals thaw for 7 days; MOR and VVV can add their venue’s own waiting windows.';
  }
  if (path.startsWith('/stake')) {
    return 'Staking turns MDM into sMDM one to one. Free sMDM earns the full staker share of the emission; sMDM locked behind MCU earns half. To leave, request an unstake and wait 7 days; it stops earning the moment you ask. Rewards accrue continuously and you can claim them whenever you like.';
  }
  if (path.startsWith('/mcu')) {
    const rate = before
      ? 'Today one MCU takes about 250 MDM; after Oct 4 the reserve change brings that to about 12.5.'
      : 'One MCU takes about 12.5 MDM now.';
    return `Checking out MCU locks part of your free sMDM on the bonding curve: the more MCU already out, the more sMDM each new one needs. It is a loan, not a sale: check the MCU back in and you get exactly the sMDM you locked. ${rate} Locked sMDM earns half, so weigh the credit against the rewards you give up.`;
  }
  if (path.startsWith('/credit')) {
    return 'Stake MCU in the vault and each one becomes $1 of API credit per day. Credit is set at midnight UTC from the MCU you had staked at that moment. Request an unstake and that MCU leaves eligibility immediately; after 24 hours you can claim it back. New stake during a thaw only counts from the next midnight.';
  }
  if (path.startsWith('/protocol')) {
    return 'Emission follows a fixed curve from genesis: day n issues about n MDM, so the daily amount grows by one each day. Half goes to sMDM stakers, half to capital providers, weighted by the real USDC yield each pool delivered over the last 90 days. The treasury can buy MDM with that yield and burn it, on its own schedule.';
  }
  return 'Here is the whole thing. Stake MDM and it becomes sMDM, which earns a share of the daily emission. Lock sMDM to check out MCU; each MCU you stake in the vault is $1 of Mordiem API credit per day. Every number on this site comes straight from the contracts on Base, including what each move costs you.';
}

export function VladGuide() {
  const pathname = usePathname() ?? '/';
  const reduce = useReducedMotion();
  const [now] = useState(() => Math.floor(Date.now() / 1000));
  const line = explain(pathname, now);
  const [seen, setSeen] = useState(false);
  const [typedCount, setTypedCount] = useState(0);
  const ref = useRef<HTMLElement | null>(null);

  // start typing once the section is in view (observer callbacks are async, so setting state here is fine)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!seen || reduce) return;
    const id = setInterval(() => setTypedCount((n) => (n + 1 >= line.length ? (clearInterval(id), line.length) : n + 1)), 22);
    return () => clearInterval(id);
  }, [seen, line, reduce]);

  const typed = reduce ? line.length : typedCount;
  const done = typed >= line.length;

  return (
    <section ref={ref} aria-labelledby="vlad-title" className="mt-2 flex w-full max-w-[600px] flex-col items-start gap-4 pb-2 pt-4 min-[720px]:mt-4">
      <div className="relative w-full rounded-[14px] border border-charge bg-sheet-2 px-5 py-4 edge" role="status" aria-live="polite">
        <p id="vlad-title" className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-charge">Vlad explains</p>
        <p className="min-h-[3.6em] text-[14px] leading-[1.5] text-ink">
          <span className="sr-only">{line}</span>
          <span aria-hidden>{line.slice(0, typed)}</span>
          {!done && <span aria-hidden className="ml-px inline-block animate-pulse text-charge">▌</span>}
        </p>
        <span aria-hidden className="absolute -bottom-2 left-8 h-3.5 w-3.5 rotate-45 border-b border-r border-charge bg-sheet-2" />
      </div>
      <div className="ml-4 flex items-end gap-3 min-[720px]:ml-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/vlad-head.png" alt="Vlad, in a hi-vis vest and beanie" width={460} height={520} className="block h-auto w-[150px] select-none min-[720px]:w-[220px]" draggable={false} />
        <a href={HOME} target="_blank" rel="noopener noreferrer" className="mb-3 text-[12px] text-ink-3 underline-offset-2 hover:text-ink-2 hover:underline">skatehive.app ↗</a>
      </div>
    </section>
  );
}
