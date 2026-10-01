'use client';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import { cn } from './cn';

export type MagnetProps = {
  children: ReactNode;
  /** Max lean in px toward the cursor. */
  strength?: number;
  /** Distance (px) around the element where the magnet still pulls. */
  padding?: number;
  disabled?: boolean;
  className?: string;
};

/** The wrapped element leans toward the cursor while it is near and springs back when it leaves. */
export function Magnet({ children, strength = 6, padding = 28, disabled, className }: MagnetProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const x = useSpring(rx, { stiffness: 320, damping: 22, mass: 0.6 });
  const y = useSpring(ry, { stiffness: 320, damping: 22, mass: 0.6 });
  const off = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    off.current?.();
    off.current = null;
    rx.set(0);
    ry.set(0);
  }, [rx, ry]);

  useEffect(() => () => off.current?.(), []);

  const onEnter = () => {
    if (disabled || reduce || off.current) return;
    if (typeof window !== 'undefined' && !window.matchMedia('(hover: hover)').matches) return;
    const onMove = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const inside =
        e.clientX > r.left - padding && e.clientX < r.right + padding && e.clientY > r.top - padding && e.clientY < r.bottom + padding;
      if (!inside) return stop();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      rx.set(((e.clientX - cx) / (r.width / 2 + padding)) * strength);
      ry.set(((e.clientY - cy) / (r.height / 2 + padding)) * strength);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    off.current = () => window.removeEventListener('pointermove', onMove);
  };

  return (
    <motion.span ref={ref} onPointerEnter={onEnter} style={{ x, y }} className={cn('relative inline-flex', className)}>
      {children}
    </motion.span>
  );
}
