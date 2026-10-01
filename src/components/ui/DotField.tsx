'use client';
import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from './cn';

export type DotFieldProps = {
  className?: string;
  /** Grid spacing in px. */
  gap?: number;
  /** Peak dot opacity 0..1. */
  intensity?: number;
};

/**
 * Subtle animated dot grid on a canvas. DPR capped at 2, pauses when offscreen or the tab is hidden,
 * static under reduced motion, follows the surface's ink color.
 */
export function DotField({ className, gap = 22, intensity = 0.22 }: DotFieldProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let visible = true;
    let ink = '242, 244, 248';
    const start = performance.now();

    const readInk = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
      const m = /^#([0-9a-f]{6})$/i.exec(v);
      if (m) {
        const n = parseInt(m[1], 16);
        ink = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
      }
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      const t = reduce ? 0 : (now - start) / 1000;
      ctx.clearRect(0, 0, w, h);
      const cols = Math.ceil(w / gap) + 1;
      const rows = Math.ceil(h / gap) + 1;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * gap + gap / 2;
          const y = j * gap + gap / 2;
          const wave = 0.5 + 0.5 * Math.sin(i * 0.35 + t * 0.9) * Math.cos(j * 0.3 - t * 0.6);
          const a = 0.04 + wave * intensity;
          const rad = 0.8 + wave * 0.9;
          ctx.fillStyle = `rgba(${ink}, ${a.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const loop = (now: number) => {
      draw(now);
      if (!reduce && visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const resume = () => {
      cancelAnimationFrame(raf);
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    readInk();
    resize();
    resume();

    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) draw(performance.now());
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e?.isIntersecting ?? true;
      resume();
    });
    io.observe(canvas);
    const mo = new MutationObserver(() => {
      readInk();
      if (reduce) draw(performance.now());
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-surface'] });
    document.addEventListener('visibilitychange', resume);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener('visibilitychange', resume);
    };
  }, [gap, intensity, reduce]);

  return <canvas ref={ref} aria-hidden className={cn('pointer-events-none absolute inset-0 h-full w-full', className)} />;
}
