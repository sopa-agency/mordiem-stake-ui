'use client';
import { useId } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from './cn';

export type NavItem = { href: string; label: string; icon?: React.ReactNode };

export type PillNavProps = {
  items: NavItem[];
  /** Current pathname. */
  current: string;
  className?: string;
};

export function isCurrentPath(href: string, current: string): boolean {
  if (href === '/') return current === '/';
  return current === href || current.startsWith(`${href}/`);
}

/** Top navigation with a sliding pill under the current item. */
export function PillNav({ items, current, className }: PillNavProps) {
  const id = useId();
  const reduce = useReducedMotion();
  return (
    <nav aria-label="Primary" className={className}>
      <ul className="edge inline-flex items-center gap-0.5 rounded-full bg-sheet-2 p-1 ring-1 ring-inset ring-rule-2">
        {items.map((it) => {
          const active = isCurrentPath(it.href, current);
          return (
            <li key={it.href} className="relative">
              {active && (
                <motion.span
                  layoutId={`${id}-pill`}
                  aria-hidden
                  className="edge lift absolute inset-0 rounded-full bg-sheet-3"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }}
                />
              )}
              <Link
                href={it.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors duration-150',
                  active ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
                )}
              >
                {it.icon && <span className="inline-flex size-4 items-center justify-center [&>svg]:size-4">{it.icon}</span>}
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
