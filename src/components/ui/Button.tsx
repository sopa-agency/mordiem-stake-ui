'use client';
import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from './cn';
import { Magnet } from './Magnet';
import { ClickSpark } from './ClickSpark';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'md' | 'lg';

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner in place of the label while keeping the button's width. */
  loading?: boolean;
  /** Draws a check mark, then shows the label next to it. */
  success?: boolean;
  /** Renders the button disabled and prints the reason under it (linked with aria-describedby). */
  disabledReason?: string;
  /** Leans toward the cursor (ReactBits Magnet). */
  magnet?: boolean;
  /** Radial amber sparks on click (ReactBits Click Spark). */
  spark?: boolean;
  /** Stretches the button and its wrappers to the container width. */
  fullWidth?: boolean;
  children: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-signal text-signal-ink [box-shadow:var(--edge),var(--glow)] hover:bg-signal-2 disabled:hover:bg-signal disabled:[box-shadow:var(--edge)]',
  secondary:
    'bg-sheet-2 text-ink [box-shadow:var(--edge),inset_0_0_0_1px_var(--rule)] hover:bg-sheet-3 disabled:hover:bg-sheet-2',
  ghost: 'bg-transparent text-ink-2 hover:bg-sheet-2 hover:text-ink disabled:hover:bg-transparent disabled:hover:text-ink-2',
  destructive:
    'bg-transparent text-bad [box-shadow:inset_0_0_0_1px_var(--bad)] hover:bg-[color-mix(in_srgb,var(--bad)_12%,transparent)] disabled:hover:bg-transparent',
};

const sizes: Record<ButtonSize, string> = {
  md: 'h-10 px-4 text-[14px]',
  lg: 'h-12 px-5 text-[15px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  success = false,
  disabledReason,
  magnet = false,
  spark = false,
  fullWidth = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const reduce = useReducedMotion();
  const reasonId = useId();
  const isDisabled = Boolean(disabled || loading || disabledReason);
  const animated = !reduce && !isDisabled;

  const button = (
    <motion.button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-describedby={disabledReason ? reasonId : rest['aria-describedby']}
      // Always pass gesture props (motion adds tabindex when they exist) so server and client markup match.
      whileHover={{ y: animated && variant === 'primary' ? -1 : 0 }}
      whileTap={{ scale: animated ? 0.97 : 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 520, damping: 26, mass: 0.5 }}
      className={cn(
        'relative inline-flex select-none items-center justify-center gap-2 rounded-control font-medium tracking-[-0.005em] transition-[background-color,color,box-shadow] duration-150',
        'disabled:cursor-not-allowed disabled:opacity-55',
        sizes[size],
        variants[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      <span className="grid place-items-center">
        <span className={cn('col-start-1 row-start-1 inline-flex items-center gap-2', loading && 'invisible')}>
          {success && <Check reduce={Boolean(reduce)} />}
          {success && !reduce ? (
            <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.32, duration: 0.2 }}>
              {children}
            </motion.span>
          ) : (
            <span>{children}</span>
          )}
        </span>
        {loading && (
          <span className="col-start-1 row-start-1 inline-flex items-center" aria-hidden>
            <Spinner />
          </span>
        )}
      </span>
    </motion.button>
  );

  let node = button;
  if (spark) node = <ClickSpark disabled={isDisabled} className={cn(fullWidth && 'w-full')}>{node}</ClickSpark>;
  if (magnet) node = <Magnet disabled={isDisabled} className={cn(fullWidth && 'w-full')}>{node}</Magnet>;

  if (!disabledReason) return node;
  return (
    <span className={cn('inline-flex flex-col items-start gap-1.5', fullWidth && 'w-full')}>
      {node}
      <span id={reasonId} className="text-[12px] leading-snug text-ink-3">
        {disabledReason}
      </span>
    </span>
  );
}

/** 14px ring spinner. Under reduced motion the CSS animation is off and it reads as a static arc. */
export function Spinner({ className }: { className?: string }) {
  return <span className={cn('inline-block size-[14px] animate-spin rounded-full border-2 border-current border-t-transparent', className)} />;
}

function Check({ reduce }: { reduce: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden className="shrink-0">
      <motion.path
        d="M2.5 7.5l3 3 6-6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      />
    </svg>
  );
}
