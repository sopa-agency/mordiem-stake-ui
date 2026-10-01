'use client';
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from './cn';

export type StarBorderProps = {
  children: ReactNode;
  /** CSS color of the traveling light. Defaults to signal-2. */
  color?: string;
  /** Seconds per lap. */
  speed?: number;
  className?: string;
};

/** A light that travels around the edge of its child (used on Claim when rewards are ready). Static ring under reduced motion. */
export function StarBorder({ children, color = 'var(--signal-2)', speed = 5, className }: StarBorderProps) {
  const reduce = useReducedMotion();
  return (
    <span className={cn('relative inline-flex', className)}>
      {/* Same markup either way: under reduced motion the blobs are hidden by CSS and a static ring shows instead. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-px overflow-hidden rounded-[11px] motion-reduce:[box-shadow:inset_0_0_0_1px_var(--star-ring)]"
        style={{ '--star-ring': `color-mix(in srgb, ${color} 55%, transparent)` } as React.CSSProperties}
      >
        <motion.span
          className="absolute bottom-[-12px] left-0 h-1/2 w-[300%] rounded-full motion-reduce:hidden"
          style={{ background: `radial-gradient(circle, ${color}, transparent 12%)`, opacity: 0.9 }}
          initial={{ x: '-100%' }}
          animate={reduce ? undefined : { x: ['-100%', '0%'] }}
          transition={{ duration: speed, repeat: Infinity, ease: 'linear' }}
        />
        <motion.span
          className="absolute left-0 top-[-12px] h-1/2 w-[300%] rounded-full motion-reduce:hidden"
          style={{ background: `radial-gradient(circle, ${color}, transparent 12%)`, opacity: 0.9 }}
          initial={{ x: '0%' }}
          animate={reduce ? undefined : { x: ['0%', '-100%'] }}
          transition={{ duration: speed, repeat: Infinity, ease: 'linear' }}
        />
      </span>
      <span className="relative inline-flex rounded-control bg-paper">{children}</span>
    </span>
  );
}
