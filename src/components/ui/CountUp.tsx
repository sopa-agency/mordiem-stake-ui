'use client';
import { useEffect, useMemo, useRef } from 'react';
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react';
import { cn } from './cn';

export type CountUpProps = {
  to: number;
  decimals?: number;
  /** Seconds. */
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
};

function formatter(decimals: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Number that eases (ease-out cubic) from its previous value to `to`, on mount and on change. */
export function CountUp({ to, decimals = 0, duration = 1, prefix = '', suffix = '', className }: CountUpProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const fmt = useMemo(() => formatter(decimals), [decimals]);
  const mv = useMotionValue(0);

  useMotionValueEvent(mv, 'change', (v) => {
    if (ref.current) ref.current.textContent = `${prefix}${fmt.format(v)}${suffix}`;
  });

  useEffect(() => {
    if (reduce) {
      mv.set(to);
      if (ref.current) ref.current.textContent = `${prefix}${fmt.format(to)}${suffix}`;
      return;
    }
    const controls = animate(mv, to, { duration, ease: [0.33, 1, 0.68, 1] });
    return () => controls.stop();
  }, [to, duration, reduce, mv, fmt, prefix, suffix]);

  return (
    // Always starts at 0 so server and client markup match; the effect writes the real value (instantly under reduced motion).
    <span ref={ref} className={cn('num tabular-nums', className)}>
      {prefix}
      {fmt.format(0)}
      {suffix}
    </span>
  );
}

export type CounterProps = {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
};

/** Odometer: every digit rolls vertically to its new value. For numbers that tick often. */
export function Counter({ value, decimals = 0, prefix = '', suffix = '', className }: CounterProps) {
  const reduce = useReducedMotion();
  const fmt = useMemo(() => formatter(decimals), [decimals]);
  const text = fmt.format(value);
  return (
    <span className={cn('num inline-flex items-baseline leading-none tabular-nums', className)} aria-label={`${prefix}${text}${suffix}`}>
      {prefix && <span>{prefix}</span>}
      {Array.from(text).map((ch, i) =>
        /\d/.test(ch) ? <Digit key={`${i}-${text.length}`} digit={Number(ch)} reduce={Boolean(reduce)} /> : <span key={`${i}-${text.length}-s`} aria-hidden>{ch}</span>,
      )}
      {suffix && <span>{suffix}</span>}
    </span>
  );
}

function Digit({ digit, reduce }: { digit: number; reduce: boolean }) {
  return (
    <span aria-hidden className="inline-block h-[1em] overflow-hidden align-baseline">
      <motion.span
        className="flex flex-col"
        initial={false}
        animate={{ y: `-${digit}em` }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 30, mass: 0.8 }}
      >
        {Array.from({ length: 10 }, (_, d) => (
          <span key={d} className="block h-[1em] leading-none">
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  );
}
