import type { ReactNode } from 'react';
import { cn } from './cn';

export type ChipTone = 'neutral' | 'good' | 'thaw' | 'charge' | 'signal';

export type ChipProps = {
  tone?: ChipTone;
  /** Pulses the dot (CSS ping; off under reduced motion). */
  pulse?: boolean;
  children: ReactNode;
  className?: string;
};

const dot: Record<ChipTone, string> = {
  neutral: 'bg-ink-3',
  good: 'bg-good',
  thaw: 'bg-thaw',
  charge: 'bg-charge',
  signal: 'bg-signal',
};

const text: Record<ChipTone, string> = {
  neutral: 'text-ink-2',
  good: 'text-good',
  // the Day thaw token is a pale ice blue; keep chip text readable and let the dot carry the tone
  thaw: 'text-ink-2',
  charge: 'text-charge',
  signal: 'text-signal',
};

/** Small status pill with a colored dot. */
export function Chip({ tone = 'neutral', pulse, children, className }: ChipProps) {
  return (
    <span
      className={cn(
        'edge num inline-flex h-6 items-center gap-1.5 rounded-full bg-sheet-2 pl-2 pr-2.5 text-[12px] font-medium ring-1 ring-inset ring-rule-2',
        text[tone],
        className,
      )}
    >
      <span className="relative inline-flex size-1.5">
        {pulse && <span aria-hidden className={cn('absolute inset-0 animate-ping rounded-full opacity-70', dot[tone])} />}
        <span className={cn('relative inline-block size-1.5 rounded-full', dot[tone])} />
      </span>
      {children}
    </span>
  );
}
