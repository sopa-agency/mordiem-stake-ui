'use client';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from './cn';

export type StepStatus = 'todo' | 'active' | 'done' | 'skipped' | 'error';
export type Step = { label: string; detail?: string; status: StepStatus };

export type StepperProps = {
  steps: Step[];
  className?: string;
};

/** Horizontal transaction progress: check on done, flowing gradient into the active step, error and skipped states. */
export function Stepper({ steps, className }: StepperProps) {
  const reduce = useReducedMotion();
  return (
    <ol className={cn('flex w-full items-start', className)} aria-label="Transaction steps">
      {steps.map((s, i) => {
        const next = steps[i + 1];
        const connector: 'none' | 'rule' | 'flow' | 'done' = !next
          ? 'none'
          : s.status === 'done' && next.status === 'done'
            ? 'done'
            : s.status === 'done' && next.status === 'active'
              ? 'flow'
              : s.status === 'done' && next.status === 'skipped'
                ? 'done'
                : 'rule';
        return (
          <li key={`${s.label}-${i}`} className="relative flex min-w-0 flex-1 flex-col items-center text-center" aria-current={s.status === 'active' ? 'step' : undefined}>
            {connector !== 'none' && (
              <span aria-hidden className="absolute left-[calc(50%+16px)] right-[calc(-50%+16px)] top-[11px] h-0.5 overflow-hidden rounded-full bg-rule">
                {connector === 'done' && <span className="block h-full w-full bg-signal" />}
                {connector === 'flow' && (
                  <motion.span
                    className="block h-full w-full"
                    style={{
                      backgroundImage: 'linear-gradient(90deg, var(--signal) 0%, var(--signal) 35%, var(--signal-2) 50%, var(--rule) 65%, var(--rule) 100%)',
                      backgroundSize: '300% 100%',
                    }}
                    initial={{ backgroundPositionX: '100%' }}
                    animate={reduce ? { backgroundPositionX: '50%' } : { backgroundPositionX: ['100%', '0%'] }}
                    transition={reduce ? { duration: 0 } : { duration: 1.6, repeat: Infinity, ease: 'linear' }}
                  />
                )}
              </span>
            )}
            <Node status={s.status} index={i} reduce={Boolean(reduce)} />
            <span className={cn('mt-2 text-[13px] font-medium', s.status === 'todo' || s.status === 'skipped' ? 'text-ink-3' : s.status === 'error' ? 'text-bad' : 'text-ink')}>
              {s.label}
            </span>
            {s.detail && <span className="num mt-0.5 max-w-full truncate px-1 text-[12px] text-ink-3">{s.detail}</span>}
          </li>
        );
      })}
    </ol>
  );
}

function Node({ status, index, reduce }: { status: StepStatus; index: number; reduce: boolean }) {
  const base = 'relative z-10 grid size-6 place-items-center rounded-full text-[11px] font-semibold';
  if (status === 'done')
    return (
      <span className={cn(base, 'edge bg-signal text-signal-ink')}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <motion.path
            d="M2.5 6.5l2.5 2.5 4.5-5.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={reduce ? { duration: 0 } : { duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          />
        </svg>
        <span className="sr-only">Done</span>
      </span>
    );
  if (status === 'active')
    return (
      <span className={cn(base, 'bg-sheet text-signal ring-2 ring-inset ring-signal')}>
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full ring-2 ring-signal motion-reduce:hidden"
          initial={{ opacity: 0.6, scale: 1 }}
          animate={reduce ? undefined : { opacity: 0, scale: 1.7 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
        />
        <span className="size-2 rounded-full bg-signal" />
        <span className="sr-only">In progress</span>
      </span>
    );
  if (status === 'error')
    return (
      <span className={cn(base, 'bg-sheet text-bad ring-2 ring-inset ring-bad')}>
        !<span className="sr-only">Failed</span>
      </span>
    );
  if (status === 'skipped')
    return (
      <span className={cn(base, 'bg-sheet text-ink-3 ring-1 ring-inset ring-rule [outline:1px_dashed_var(--rule)] [outline-offset:-1px]')}>
        –<span className="sr-only">Skipped</span>
      </span>
    );
  return <span className={cn(base, 'bg-sheet text-ink-3 ring-1 ring-inset ring-rule')}>{index + 1}</span>;
}
