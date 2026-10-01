'use client';
import type { ReactNode } from 'react';
import { cn } from './cn';

export type FieldProps = {
  /** Stable id; required so label, helper and error are linked for assistive tech. */
  id: string;
  label?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  /** Token suffix, e.g. "MDM". */
  token: string;
  /** Renders a Max button that calls this. */
  onMax?: () => void;
  /** Helper line on the right of the label, usually the balance. */
  helper?: ReactNode;
  /** Error line under the input, in the bad color. Also sets `invalid`. */
  error?: ReactNode;
  invalid?: boolean;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  /** Max decimals accepted while typing. Defaults to 18. */
  decimals?: number;
};

/** Large display-font amount input with token suffix, optional Max, helper and error lines. */
export function Field({ id, label, value, onChange, token, onMax, helper, error, invalid, placeholder = '0.00', disabled, autoFocus, className, decimals = 18 }: FieldProps) {
  const isInvalid = Boolean(invalid || error);
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;

  const handle = (raw: string) => {
    let v = raw.replace(',', '.').replace(/[^\d.]/g, '');
    const dot = v.indexOf('.');
    if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '').slice(0, decimals);
    if (v.startsWith('.')) v = `0${v}`;
    onChange(v);
  };

  return (
    <div className={cn('flex flex-col', className)}>
      {(label || helper) && (
        <div className="mb-2 flex items-baseline justify-between gap-3 text-[12px]">
          {label ? (
            <label htmlFor={id} className="font-medium uppercase tracking-[0.08em] text-ink-3">
              {label}
            </label>
          ) : (
            <span />
          )}
          {helper && (
            <span id={helperId} className="num text-ink-3">
              {helper}
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          'edge flex h-16 items-center gap-3 rounded-control bg-sheet-2 px-4 ring-1 ring-inset transition-[box-shadow,--tw-ring-color] duration-150',
          isInvalid ? 'ring-bad focus-within:ring-2' : 'ring-rule focus-within:ring-2 focus-within:ring-signal',
          disabled && 'opacity-55',
        )}
      >
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(e) => handle(e.target.value)}
          aria-invalid={isInvalid || undefined}
          aria-describedby={[helper ? helperId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined}
          className="font-display num w-0 min-w-0 flex-1 bg-transparent text-[30px] font-medium leading-none text-ink outline-none placeholder:text-ink-3 focus-visible:outline-none"
        />
        <span className="font-display text-[14px] font-medium text-ink-2">{token}</span>
        {onMax && (
          <button
            type="button"
            onClick={onMax}
            disabled={disabled}
            className="edge h-7 rounded-[7px] bg-sheet-3 px-2.5 text-[12px] font-semibold text-signal transition-colors hover:text-signal-2 disabled:cursor-not-allowed"
          >
            Max
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-[12px] leading-snug text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
