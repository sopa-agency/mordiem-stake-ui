'use client';
import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from './cn';

export type SplitFlapProps = {
  /** e.g. "20:03:29". Alphanumerics get a flap; other characters render as plain separators. */
  value: string;
  /** Classes for the whole display; set the font size here (default 40px). */
  className?: string;
  /** Extra classes for each flap tile. */
  digitClassName?: string;
  'aria-label'?: string;
};

const FLAP = /[0-9A-Za-z]/;
const HALF = 0.17;

/** Split-flap display: each character sits on a tile whose halves flip (rotateX) when it changes. */
export function SplitFlap({ value, className, digitClassName, ...a11y }: SplitFlapProps) {
  const chars = Array.from(value);
  return (
    <span
      role="timer"
      aria-label={a11y['aria-label']}
      aria-live="off"
      className={cn('font-display num inline-flex items-center gap-[0.08em] text-[40px] font-bold leading-none text-ink', className)}
      style={{ perspective: 600 }}
    >
      <span className="sr-only">{value}</span>
      {chars.map((ch, i) =>
        FLAP.test(ch) ? (
          <Flap key={i} char={ch} index={i} className={digitClassName} />
        ) : (
          <span key={i} aria-hidden className="inline-block w-[0.3em] text-center text-ink-3">
            {ch}
          </span>
        ),
      )}
    </span>
  );
}

function Flap({ char, index, className }: { char: string; index: number; className?: string }) {
  const reduce = useReducedMotion();
  const [cur, setCur] = useState(char);
  const [prev, setPrev] = useState(char);
  const [gen, setGen] = useState(0);
  if (char !== cur) {
    setPrev(cur);
    setCur(char);
    setGen((g) => g + 1);
  }
  const flipping = !reduce && prev !== cur;
  const delay = Math.min(index, 8) * 0.03;

  return (
    <span
      aria-hidden
      className={cn('edge relative inline-block h-[1.3em] w-[0.78em] rounded-[0.14em] bg-sheet-2 ring-1 ring-inset ring-rule-2', className)}
      style={{ transformStyle: 'preserve-3d' }}
    >
      <Half pos="top" char={cur} />
      <Half pos="bottom" char={flipping ? prev : cur} />
      {flipping && (
        <>
          <motion.span
            key={`t${gen}`}
            className="absolute inset-x-0 top-0 h-1/2"
            style={{ transformOrigin: '50% 100%', backfaceVisibility: 'hidden' }}
            initial={{ rotateX: 0 }}
            animate={{ rotateX: -90 }}
            transition={{ duration: HALF, delay, ease: 'easeIn' }}
          >
            <Half pos="top" char={prev} absolute={false} />
          </motion.span>
          <motion.span
            key={`b${gen}`}
            className="absolute inset-x-0 bottom-0 h-1/2"
            style={{ transformOrigin: '50% 0%', backfaceVisibility: 'hidden' }}
            initial={{ rotateX: 90 }}
            animate={{ rotateX: 0 }}
            transition={{ duration: HALF, delay: delay + HALF, ease: 'easeOut' }}
          >
            <Half pos="bottom" char={cur} absolute={false} />
          </motion.span>
        </>
      )}
      <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-paper/70" />
    </span>
  );
}

function Half({ pos, char, absolute = true }: { pos: 'top' | 'bottom'; char: string; absolute?: boolean }) {
  return (
    <span
      className={cn(
        'block overflow-hidden rounded-[0.14em]',
        absolute ? 'absolute inset-x-0 h-1/2' : 'h-full w-full',
        absolute && (pos === 'top' ? 'top-0' : 'bottom-0'),
        pos === 'top' ? 'rounded-b-none bg-sheet-3' : 'rounded-t-none bg-sheet-2',
      )}
    >
      <span className={cn('absolute inset-x-0 grid h-[1.3em] place-items-center', pos === 'top' ? 'top-0' : '-top-[0.65em]')}>{char}</span>
    </span>
  );
}
