'use client';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from './cn';

export type Surface = 'night' | 'day';

export type SurfaceToggleProps = {
  surface: Surface;
  onToggle: () => void;
  className?: string;
};

/** Day/Night switch. Pure UI: the caller owns the state and storage. */
export function SurfaceToggle({ surface, onToggle, className }: SurfaceToggleProps) {
  const reduce = useReducedMotion();
  const day = surface === 'day';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={day}
      aria-label={day ? 'Switch to night surface' : 'Switch to day surface'}
      onClick={onToggle}
      className={cn('edge relative inline-flex h-8 w-[60px] items-center rounded-full bg-sheet-2 ring-1 ring-inset ring-rule-2', className)}
    >
      <motion.span
        aria-hidden
        className="edge lift absolute left-1 top-1 size-6 rounded-full bg-sheet-3"
        animate={{ x: day ? 28 : 0 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 34 }}
      />
      <span className={cn('relative grid flex-1 place-items-center transition-colors', day ? 'text-ink-3' : 'text-ink')}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
        </svg>
      </span>
      <span className={cn('relative grid flex-1 place-items-center transition-colors', day ? 'text-ink' : 'text-ink-3')}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </span>
    </button>
  );
}
