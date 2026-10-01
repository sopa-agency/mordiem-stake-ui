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
  if (path.startsWith('/stake')) {
    return 'Staking is putting your MDM coins in a piggy bank. Every day the bank adds a few more coins to yours. When you want coins back, you ask and wait 7 days. That wait is the bank making sure nobody runs off in a hurry. Coins you used for an MCU battery only earn half while they are busy.';
  }
  if (path.startsWith('/mcu')) {
    return `An MCU is a battery. While it is plugged in, it gives you $1 of AI every day. To get one you lock some MDM coins, like a deposit at the library. Give the battery back and every coin comes home. Right now one battery needs about 250 coins${before ? '; from Oct 4 it will need only 12 and a half.' : '.'}`;
  }
  if (path.startsWith('/credit')) {
    return 'This is where you plug in your MCU batteries. Every midnight (UTC time) each plugged battery fills up with $1 of AI for the day. Unplug one and its juice stops right away. You get the battery back in your hands one day later.';
  }
  if (path.startsWith('/protocol')) {
    return 'Every day the game prints new MDM coins. Half go to the people with coins in the piggy bank. Half go to people who lent other things to the game. It prints one more coin each day than the day before, so your slice gets a little thinner unless the piggy bank grows too.';
  }
  return 'Think of MDM as your coins. Put them in the piggy bank (that is staking) and you get a few more coins every day. If you want to use the Mordiem AI, you trade some coins for a little battery called MCU. Everything on this site is just those two things, with every cost written on the screen.';
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
