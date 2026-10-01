'use client';
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from './cn';

export type BatteryProps = {
  /** Total cells (one per MCU). Above `maxCells` it becomes a continuous bar. */
  cells: number;
  /** Filled cells. */
  filled: number;
  label?: ReactNode;
  /** Unit shown in the legend, e.g. "MCU". */
  unit?: string;
  maxCells?: number;
  className?: string;
};

/** Today's credit as a battery: amber cells with a top light, filling in a stagger on mount. */
export function Battery({ cells, filled, label, unit = 'MCU', maxCells = 24, className }: BatteryProps) {
  const reduce = useReducedMotion();
  const total = Math.max(0, Math.floor(cells));
  const full = Math.max(0, Math.min(total, Math.floor(filled)));
  const discrete = total > 0 && total <= maxCells;
  const ratio = total === 0 ? 0 : full / total;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {(label || total > 0) && (
        <div className="flex items-baseline justify-between gap-3 text-[12px]">
          <span className="font-medium uppercase tracking-[0.08em] text-ink-3">{label}</span>
          <span className="num text-ink-2">
            <span className="font-display text-[13px] font-semibold text-ink">{full}</span> of {total} {unit}
          </span>
        </div>
      )}
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={full}
        aria-label={typeof label === 'string' ? label : 'Credit cells'}
        className="flex items-center"
      >
        <div className="edge flex h-10 flex-1 gap-1 rounded-[9px] bg-sheet-2 p-1.5 ring-1 ring-inset ring-rule">
          {discrete ? (
            Array.from({ length: total }, (_, i) => {
              const on = i < full;
              return (
                <motion.span
                  key={i}
                  className={cn(
                    'min-w-0 flex-1 rounded-[4px]',
                    on
                      ? 'bg-charge [box-shadow:inset_0_1px_0_rgba(255,255,255,0.45),0_0_10px_-2px_var(--charge)]'
                      : 'bg-sheet-3 ring-1 ring-inset ring-rule-2',
                  )}
                  style={{ transformOrigin: 'bottom' }}
                  initial={on ? { opacity: 0.2, scaleY: 0.4 } : false}
                  animate={{ opacity: 1, scaleY: 1 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.35, delay: 0.05 * i, ease: [0.2, 0.8, 0.2, 1] }}
                />
              );
            })
          ) : (
            <span className="relative block h-full flex-1 overflow-hidden rounded-[4px] bg-sheet-3 ring-1 ring-inset ring-rule-2">
              <motion.span
                className="absolute inset-y-0 left-0 rounded-[4px] bg-charge [box-shadow:inset_0_1px_0_rgba(255,255,255,0.45)]"
                initial={{ width: 0 }}
                animate={{ width: `${ratio * 100}%` }}
                transition={reduce ? { duration: 0 } : { duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
              />
            </span>
          )}
        </div>
        <span aria-hidden className="ml-0.5 h-4 w-1.5 rounded-r-[3px] bg-rule" />
      </div>
    </div>
  );
}
