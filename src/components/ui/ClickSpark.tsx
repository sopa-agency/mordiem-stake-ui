'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from './cn';

export type ClickSparkProps = {
  children: ReactNode;
  /** CSS color of the sparks. Defaults to the charge (amber) token. */
  color?: string;
  count?: number;
  /** Length of each spark in px. */
  size?: number;
  /** Distance the sparks travel in px. */
  radius?: number;
  /** Seconds. */
  duration?: number;
  disabled?: boolean;
  className?: string;
};

type Burst = { id: number; x: number; y: number };

/** Emits a ring of short radial sparks from the click point. */
export function ClickSpark({ children, color = 'var(--charge)', count = 8, size = 9, radius = 26, duration = 0.45, disabled, className }: ClickSparkProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const seq = useRef(0);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const onClickCapture = (e: React.MouseEvent) => {
    if (disabled || reduce) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const id = ++seq.current;
    setBursts((b) => [...b, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
    const t = setTimeout(() => {
      timers.current.delete(t);
      setBursts((b) => b.filter((x) => x.id !== id));
    }, duration * 1000 + 50);
    timers.current.add(t);
  };

  return (
    <span ref={ref} onClickCapture={onClickCapture} className={cn('relative inline-flex', className)}>
      {children}
      {bursts.length > 0 && (
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
          {bursts.map((b) =>
            Array.from({ length: count }, (_, i) => {
              const a = (i / count) * Math.PI * 2;
              return (
                <motion.span
                  key={`${b.id}-${i}`}
                  className="absolute block rounded-full"
                  style={{ left: b.x, top: b.y, width: size, height: 2, background: color, rotate: `${(a * 180) / Math.PI}deg`, transformOrigin: '0 50%' }}
                  initial={{ x: 0, y: 0, opacity: 1, scaleX: 1 }}
                  animate={{ x: Math.cos(a) * radius, y: Math.sin(a) * radius, opacity: 0, scaleX: 0.2 }}
                  transition={{ duration, ease: [0.2, 0.8, 0.2, 1] }}
                />
              );
            }),
          )}
        </span>
      )}
    </span>
  );
}
