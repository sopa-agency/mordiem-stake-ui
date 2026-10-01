'use client';
// The check-out bonding curve drawn to scale from live reserves: MDM to lock (y) against MCU checked out (x, 0..5).
// Today's reserve is the solid line; the scheduled reserve change is the dashed one while it is still pending.
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui';
import { fmtNumber, quoteCheckOut } from '@/lib/protocol';

export type CurveProps = {
  reserveMdm: number;
  reserveMcu: number;
  /** Chosen MCU amount (the point and guides). */
  q: number;
  /** Extra MCU reserve once the scheduled change executes; omit when nothing is scheduled. */
  scheduledDeltaMcu?: number;
  scheduledLabel?: string;
  className?: string;
};

const H = 230;
const PAD = { l: 58, r: 14, t: 14, b: 30 };
const SAMPLES = 72;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(560);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag;
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

export function Curve({ reserveMdm, reserveMcu, q, scheduledDeltaMcu, scheduledLabel, className }: CurveProps) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const ready = reserveMcu > 0 && reserveMdm > 0;
  const xMax = ready ? Math.min(5, reserveMcu * 0.5) : 5;
  const today = (x: number) => quoteCheckOut(reserveMdm, reserveMcu, x);
  const after = scheduledDeltaMcu ? (x: number) => quoteCheckOut(reserveMdm, reserveMcu + scheduledDeltaMcu, x) : undefined;
  const yTop = ready ? Math.max(today(xMax), after ? after(xMax) : 0) : 1;
  const ticks = niceTicks(yTop);
  const yMax = Math.max(ticks[ticks.length - 1], yTop) * 1.04;

  const iw = Math.max(40, width - PAD.l - PAD.r);
  const ih = H - PAD.t - PAD.b;
  const sx = (x: number) => PAD.l + (x / xMax) * iw;
  const sy = (y: number) => PAD.t + ih - (Math.min(y, yMax) / yMax) * ih;

  const path = (fn: (x: number) => number) =>
    Array.from({ length: SAMPLES + 1 }, (_, i) => {
      const x = (i / SAMPLES) * xMax;
      return `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(fn(x)).toFixed(1)}`;
    }).join(' ');

  const qx = Math.max(0, Math.min(xMax, q));
  const qy = ready ? today(qx) : 0;
  const xTicks = Array.from({ length: Math.floor(xMax) + 1 }, (_, i) => i);

  return (
    <div ref={ref} className={cn('relative w-full', className)}>
      <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={`MDM to lock for up to ${xMax} MCU on today's curve${after ? ' and after the scheduled reserve change' : ''}`} className="block overflow-visible">
        {/* grid + y labels */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={PAD.l + iw} y1={sy(t)} y2={sy(t)} className="stroke-rule-2" strokeWidth={1} />
            <text x={PAD.l - 8} y={sy(t) + 3.5} textAnchor="end" className="num fill-ink-3 text-[11px]">
              {fmtNumber(t, 0)}
            </text>
          </g>
        ))}
        {/* x labels */}
        {xTicks.map((t) => (
          <text key={t} x={sx(t)} y={H - 10} textAnchor={t === 0 ? 'start' : t === xTicks[xTicks.length - 1] ? 'end' : 'middle'} className="num fill-ink-3 text-[11px]">
            {t} MCU
          </text>
        ))}
        <text x={PAD.l} y={PAD.t - 3} className="fill-ink-3 text-[10px] font-medium uppercase tracking-[0.08em]">
          MDM to lock
        </text>

        {ready && (
          <>
            {after && <path d={path(after)} fill="none" className="stroke-ink-3" strokeWidth={1.5} strokeDasharray="4 4" />}
            <path d={path(today)} fill="none" className="stroke-ink" strokeWidth={2} strokeLinecap="round" />
            {/* guides + point at q */}
            <line x1={sx(qx)} x2={sx(qx)} y1={sy(qy)} y2={PAD.t + ih} className="stroke-signal" strokeWidth={1} strokeDasharray="2 3" />
            <line x1={PAD.l} x2={sx(qx)} y1={sy(qy)} y2={sy(qy)} className="stroke-signal" strokeWidth={1} strokeDasharray="2 3" />
            <circle cx={sx(qx)} cy={sy(qy)} r={5} className="fill-signal" />
            <circle cx={sx(qx)} cy={sy(qy)} r={9} className="fill-signal/20" />
          </>
        )}
      </svg>
      {ready && (
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded bg-ink" /> Today
          </span>
          {after && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0 w-4 border-t border-dashed border-ink-3" /> {scheduledLabel ?? 'After the scheduled change'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
