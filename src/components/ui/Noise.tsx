import { cn } from './cn';

export type NoiseProps = { className?: string };

/** Film grain overlay (the `.grain` class from globals.css). Place inside a positioned parent. */
export function Noise({ className }: NoiseProps) {
  return <div aria-hidden className={cn('grain pointer-events-none absolute inset-0', className)} />;
}
