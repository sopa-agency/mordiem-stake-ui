'use client';
import { useId, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from './cn';

export type RingTone = 'thaw' | 'signal' | 'charge';

export type RingProps = {
  /** 0..1 */
  progress: number;
  /** Text inside the ring, e.g. "4d". */
  label?: ReactNode;
  /** Accessible description, e.g. "Thawing, 36% done". Defaults to the percentage. */
  title?: string;
  size?: number;
  stroke?: number;
  tone?: RingTone;
  className?: string;
};

const toneVar: Record<RingTone, string> = { thaw: '--thaw', signal: '--signal', charge: '--charge' };

/** Circular progress with a gradient stroke that animates to its value. */
export function Ring({ progress, label, title, size = 56, stroke = 5, tone = 'thaw', className }: RingProps) {
  const id = useId();
  const reduce = useReducedMotion();
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const r = (size - stroke) / 2;
  const c = `var(${toneVar[tone]})`;
  const pct = Math.round(p * 100);

  return (
    <span
      role="img"
      aria-label={title ?? `${pct}%`}
      className={cn('relative inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: `color-mix(in srgb, ${c} 55%, white)` }} />
            <stop offset="100%" style={{ stopColor: c }} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-rule" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id}-g)`}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: p }}
          transition={reduce ? { duration: 0 } : { duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      {label !== undefined && (
        <span
          className="font-display num absolute inset-0 grid place-items-center font-semibold text-ink"
          style={{ fontSize: Math.max(11, Math.round(size * 0.22)) }}
        >
          {label}
        </span>
      )}
    </span>
  );
}
