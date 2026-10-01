'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from './cn';

export type ToastTone = 'neutral' | 'good' | 'bad' | 'charge' | 'thaw';

export type ToastOptions = {
  title: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
  tone?: ToastTone;
  /** ms; defaults to 5000. 0 keeps it until dismissed. */
  duration?: number;
};

type ToastItem = ToastOptions & { id: number };

type ToastContextValue = {
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX = 3;
const dot: Record<ToastTone, string> = { neutral: 'bg-ink-3', good: 'bg-good', bad: 'bg-bad', charge: 'bg-charge', thaw: 'bg-thaw' };

export type ToastProviderProps = {
  children: ReactNode;
  /** Extra bottom offset in px (e.g. to clear the Dock on phones). */
  offset?: number;
};

export function ToastProvider({ children, offset = 16 }: ToastProviderProps) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const reduce = useReducedMotion();

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((list) => list.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = ++seq.current;
      setItems((list) => [...list, { ...options, id }].slice(-MAX));
      const duration = options.duration ?? 5000;
      if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4"
        style={{ paddingBottom: `calc(${offset}px + env(safe-area-inset-bottom))` }}
      >
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              role="status"
              layout={!reduce}
              initial={{ y: 24, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { y: 12, opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32, mass: 0.7 }}
              className="edge lift pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-control bg-sheet-2 py-2.5 pl-4 pr-2 text-[13px] text-ink ring-1 ring-inset ring-rule"
            >
              <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', dot[t.tone ?? 'neutral'])} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{t.title}</span>
                {t.description && <span className="block truncate text-[12px] text-ink-3">{t.description}</span>}
              </span>
              {t.href && (
                <a
                  href={t.href}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-[6px] px-1.5 py-1 text-[12px] font-medium text-signal hover:text-signal-2"
                >
                  {t.hrefLabel ?? 'View'} ↗
                </a>
              )}
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="grid size-7 shrink-0 place-items-center rounded-[7px] text-ink-3 transition-colors hover:bg-sheet-3 hover:text-ink"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
