'use client';
import { useId, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from './cn';

export type SegmentedOption<V extends string> = { value: V; label: string; disabled?: boolean };

export type SegmentedProps<V extends string> = {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  'aria-label'?: string;
  size?: 'md' | 'lg';
  className?: string;
};

/** Radio-group style switch with a sliding indicator (motion layoutId). Arrow keys move the selection. */
export function Segmented<V extends string>({ options, value, onChange, size = 'md', className, ...a11y }: SegmentedProps<V>) {
  const id = useId();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const enabled = options.filter((o) => !o.disabled);
    const i = enabled.findIndex((o) => o.value === value);
    const next = enabled[(i + dir + enabled.length) % enabled.length];
    if (!next) return;
    onChange(next.value);
    ref.current?.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus();
  };

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={a11y['aria-label']}
      onKeyDown={onKeyDown}
      className={cn('edge inline-flex rounded-control bg-sheet-2 p-1 ring-1 ring-inset ring-rule-2', className)}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            data-value={o.value}
            tabIndex={selected ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative rounded-[7px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
              size === 'lg' ? 'h-9 px-4 text-[14px]' : 'h-8 px-3.5 text-[13px]',
              selected ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {selected && (
              <motion.span
                layoutId={`${id}-indicator`}
                aria-hidden
                className="edge lift absolute inset-0 rounded-[7px] bg-sheet-3"
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
