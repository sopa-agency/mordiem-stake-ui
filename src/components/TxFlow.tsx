'use client';
// useTx + toasts + the Stepper under a button. Button verb → toast verb ("Stake 10.00 MDM" → "Staked 10.00 MDM").
import { useEffect, useRef } from 'react';
import { Stepper, useToast, type Step } from '@/components/ui';
import { useTx, type TxState } from '@/hooks/useTx';
import { doneTitle } from '@/lib/plans';
import { cn } from '@/components/ui';

const DONE_VISIBLE_MS = 4000;

export function useTxFlow(onDone?: () => void) {
  const tx = useTx();
  const { toast } = useToast();
  const prev = useRef<TxState['status']>('idle');
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const { status, verb, explorerUrl, error } = tx.state;
  const reset = tx.reset;
  useEffect(() => {
    if (status === prev.current) return;
    prev.current = status;
    if (status === 'done') {
      toast({ title: doneTitle(verb), href: explorerUrl, hrefLabel: 'Basescan', tone: 'good' });
      onDoneRef.current?.();
      const t = setTimeout(reset, DONE_VISIBLE_MS);
      return () => clearTimeout(t);
    }
    if (status === 'error' && error) toast({ title: error, tone: 'bad', duration: 7000 });
  }, [status, verb, explorerUrl, error, toast, reset]);

  const busy = status === 'simulating' || status === 'signing' || status === 'pending';
  return { ...tx, busy };
}

const statusCopy: Record<TxState['status'], string> = {
  idle: '',
  simulating: 'Checking with the contract…',
  signing: 'Confirm in your wallet.',
  pending: 'Waiting for Base to confirm…',
  done: 'Confirmed on Base.',
  error: '',
};

/** Stepper plus a status line; renders nothing while idle. */
export function TxProgress({ state, className }: { state: TxState; className?: string }) {
  if (state.status === 'idle') return null;
  const steps: Step[] = [
    ...state.steps.map((s) => ({ label: s.label, status: s.status })),
    { label: 'Confirmed', status: state.status === 'done' ? 'done' : 'todo', detail: state.hash ? `${state.hash.slice(0, 6)}…${state.hash.slice(-4)}` : undefined },
  ];
  return (
    <div className={cn('edge flex flex-col gap-3 rounded-control bg-sheet-2 px-4 py-4 ring-1 ring-inset ring-rule-2', className)} aria-live="polite">
      <Stepper steps={steps} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <span className={state.status === 'error' ? 'text-bad' : 'text-ink-3'}>{state.status === 'error' ? state.error : statusCopy[state.status]}</span>
        {state.explorerUrl && (
          <a href={state.explorerUrl} target="_blank" rel="noreferrer" className="font-medium text-signal hover:text-signal-2">
            Basescan ↗
          </a>
        )}
      </div>
    </div>
  );
}
