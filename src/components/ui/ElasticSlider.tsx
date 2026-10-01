'use client';
import { useId, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { cn } from './cn';

export type ElasticSliderProps = {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  /** Formats the readout. Defaults to the plain number. */
  format?: (value: number) => string;
  label?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
};

const MAX_OVERFLOW = 56;
/** Smoothly saturating stretch so a drag far past the end never tears the track. */
const decay = (x: number, max: number) => (x === 0 ? 0 : max * (1 - Math.exp(-Math.abs(x) / max)) * Math.sign(x));

/**
 * Elastic slider: a real <input type="range"> drives the value (so keyboard and screen readers work);
 * the painted track stretches when dragged past the ends and springs back on release.
 */
export function ElasticSlider({ min, max, step, value, onChange, format, label, id: idProp, disabled, className }: ElasticSliderProps) {
  const auto = useId();
  const id = idProp ?? auto;
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const overflow = useMotionValue(0);
  const stretch = useSpring(overflow, { stiffness: 380, damping: 26, mass: 0.6 });
  const scaleX = useTransform(stretch, (s) => {
    const w = trackRef.current?.offsetWidth ?? 1;
    return 1 + Math.abs(s) / w;
  });
  const origin = useTransform(stretch, (s) => (s < 0 ? '100% 50%' : '0% 50%'));
  const shift = useTransform(stretch, (s) => s / 2);
  const readoutScale = useTransform(stretch, (s) => 1 + Math.min(Math.abs(s), MAX_OVERFLOW) / 900);

  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || reduce || disabled) return;
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return;
    const raw = e.clientX < r.left ? e.clientX - r.left : e.clientX > r.right ? e.clientX - r.right : 0;
    overflow.set(decay(raw, MAX_OVERFLOW));
  };
  const release = () => {
    setDragging(false);
    overflow.set(0);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {(label || format) && (
        <div className="flex items-baseline justify-between gap-3">
          {label && (
            <label htmlFor={id} className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">
              {label}
            </label>
          )}
          <motion.output htmlFor={id} className="font-display num text-[15px] font-semibold text-ink" style={{ scale: readoutScale, transformOrigin: '100% 50%' }}>
            {format ? format(value) : value}
          </motion.output>
        </div>
      )}
      <div
        className={cn('group relative flex h-8 items-center rounded-control', 'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-signal', disabled && 'opacity-55')}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        <motion.div
          ref={trackRef}
          aria-hidden
          className={cn(
            'edge relative w-full overflow-hidden rounded-full bg-sheet-3 ring-1 ring-inset ring-rule-2 transition-[height] duration-150',
            dragging ? 'h-3' : 'h-2 group-hover:h-2.5',
          )}
          style={{ scaleX, transformOrigin: origin, x: shift }}
        >
          <span className="absolute inset-y-0 left-0 rounded-full bg-signal [box-shadow:inset_0_1px_0_rgba(255,255,255,0.25)]" style={{ width: `${pct}%` }} />
        </motion.div>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={label ? undefined : 'Amount'}
          aria-valuetext={format ? format(value) : undefined}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerDown={(e) => {
            if (disabled) return;
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 focus-visible:outline-none disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
