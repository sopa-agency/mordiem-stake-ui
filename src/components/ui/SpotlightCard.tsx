'use client';
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from './cn';

export type SpotlightCardProps = {
  children: ReactNode;
  className?: string;
  /** CSS color for the spotlight. Defaults to the soft signal token. */
  color?: string;
  /** Spotlight radius in px. */
  radius?: number;
  as?: 'div' | 'li' | 'article' | 'section';
};

/** Sheet with a radial highlight that follows the cursor (CSS vars, no re-renders). Touch devices get a static soft highlight. */
export function SpotlightCard({ children, className, color = 'var(--signal-soft)', radius = 260, as: Tag = 'div' }: SpotlightCardProps) {
  const ref = useRef<HTMLElement>(null);

  const onPointerMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--sx', `${e.clientX - r.left}px`);
    el.style.setProperty('--sy', `${e.clientY - r.top}px`);
    el.style.setProperty('--so', '1');
  };
  const onPointerLeave = () => ref.current?.style.setProperty('--so', '0');

  return (
    <Tag
      ref={ref as React.Ref<never>}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{ '--sx': '30%', '--sy': '20%', '--so': '0', '--spot': color, '--spot-r': `${radius}px` } as CSSProperties}
      className={cn(
        'edge relative overflow-hidden rounded-sheet bg-sheet ring-1 ring-inset ring-rule',
        'before:pointer-events-none before:absolute before:inset-0 before:opacity-[var(--so)] before:transition-opacity before:duration-300 before:content-[""]',
        'before:[background:radial-gradient(var(--spot-r)_circle_at_var(--sx)_var(--sy),var(--spot),transparent_70%)]',
        '[@media(hover:none)]:[--so:0.7]',
        className,
      )}
    >
      <div className="relative">{children}</div>
    </Tag>
  );
}
