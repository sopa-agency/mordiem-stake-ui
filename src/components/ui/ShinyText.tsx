'use client';
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from './cn';

export type ShinyTextProps = {
  children: ReactNode;
  tone?: 'ink' | 'good' | 'charge' | 'signal';
  /** Seconds per sweep. */
  speed?: number;
  className?: string;
};

const base: Record<NonNullable<ShinyTextProps['tone']>, string> = {
  ink: 'var(--ink-2)',
  good: 'var(--good)',
  charge: 'var(--charge)',
  signal: 'var(--signal)',
};

/** Text with a light sweep moving across it ("Ready to claim"). Plain colored text under reduced motion. */
export function ShinyText({ children, tone = 'ink', speed = 2.6, className }: ShinyTextProps) {
  const reduce = useReducedMotion();
  const c = base[tone];
  // Same markup with and without reduced motion (hydration-safe); the sweep simply does not run.
  return (
    <motion.span
      className={cn('inline-block bg-clip-text font-medium text-transparent', className)}
      style={{
        backgroundImage: `linear-gradient(110deg, ${c} 40%, color-mix(in srgb, ${c} 35%, white) 50%, ${c} 60%)`,
        backgroundSize: '250% 100%',
        WebkitBackgroundClip: 'text',
      }}
      initial={{ backgroundPositionX: '100%' }}
      animate={reduce ? undefined : { backgroundPositionX: ['100%', '-50%'] }}
      transition={{ duration: speed, repeat: Infinity, repeatDelay: 0.8, ease: 'linear' }}
    >
      {children}
    </motion.span>
  );
}
