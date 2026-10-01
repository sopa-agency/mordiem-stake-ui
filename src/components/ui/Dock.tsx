'use client';
import { useId } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from './cn';
import { isCurrentPath, type NavItem } from './PillNav';

export type DockProps = {
  items: NavItem[];
  /** Current pathname. */
  current: string;
  className?: string;
};

/** Bottom dock for phones (< 720px): fixed, safe-area aware, sliding pill under the current item. Hidden on wider screens. */
export function Dock({ items, current, className }: DockProps) {
  const id = useId();
  const reduce = useReducedMotion();
  return (
    <nav
      aria-label="Primary"
      className={cn('fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 min-[720px]:hidden', className)}
      style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}
    >
      <ul className="edge lift flex w-full max-w-[420px] items-stretch gap-1 rounded-[18px] bg-sheet-2/90 p-1.5 ring-1 ring-inset ring-rule backdrop-blur-md">
        {items.map((it) => {
          const active = isCurrentPath(it.href, current);
          return (
            <li key={it.href} className="relative flex-1">
              {active && (
                <motion.span
                  layoutId={`${id}-dock`}
                  aria-hidden
                  className="edge absolute inset-0 rounded-[13px] bg-sheet-3"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }}
                />
              )}
              <Link
                href={it.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-[13px] text-[11px] font-medium transition-[color,transform] duration-150 active:scale-[0.94] motion-reduce:active:scale-100',
                  active ? 'text-ink' : 'text-ink-3',
                )}
              >
                {it.icon && <span className={cn('inline-flex size-5 items-center justify-center [&>svg]:size-5', active && 'text-signal')}>{it.icon}</span>}
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
