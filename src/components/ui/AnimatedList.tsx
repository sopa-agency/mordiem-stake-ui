'use client';
import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from './cn';

export type AnimatedListProps<T extends { id: string | number }> = {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  itemClassName?: string;
  /** Seconds between items on mount. */
  stagger?: number;
  /** Rendered when `items` is empty. */
  empty?: ReactNode;
};

/** List whose items slide and fade in and out (AnimatePresence), with a stagger on first mount only. */
export function AnimatedList<T extends { id: string | number }>({ items, renderItem, className, itemClassName, stagger = 0.05, empty }: AnimatedListProps<T>) {
  const reduce = useReducedMotion();
  // Only the items present at mount get the stagger; later arrivals enter right away.
  const [initialIds] = useState(() => new Set<string | number>(items.map((it) => it.id)));

  if (items.length === 0 && empty !== undefined) return <div className={className}>{empty}</div>;

  return (
    <ul className={cn('flex flex-col gap-2', className)}>
      <AnimatePresence initial>
        {items.map((item, i) => (
          <motion.li
            key={item.id}
            layout={!reduce}
            initial={{ opacity: 0, y: 12 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30, delay: initialIds.has(item.id) ? i * stagger : 0 },
            }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: -16, transition: { duration: 0.18 } }}
            className={itemClassName}
          >
            {renderItem(item, i)}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
