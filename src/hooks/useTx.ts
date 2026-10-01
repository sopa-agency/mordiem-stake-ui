'use client';
// One state machine for every write: ensure Base → (per step) simulate → sign → wait for 1 confirmation → next;
// then invalidate every wagmi read so account and protocol figures refresh. Errors become sentences via explainError.
import { useCallback, useRef, useState } from 'react';
import { useConfig } from 'wagmi';
import { getChainId, getConnection, simulateContract, switchChain, waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import { useQueryClient } from '@tanstack/react-query';
import type { Abi, Address, Hex } from 'viem';
import { CHAIN_ID, txUrl } from '@/lib/contracts/addresses';
import { explainError, type ErrorContext } from '@/lib/errors';

export type TxStep = {
  label: string;
  kind: 'approve' | 'action';
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  /** Skipped steps (e.g. approve when the allowance already covers the amount) are shown but never sent. */
  skip?: boolean;
};

export type TxPlan = {
  /** Button verb, reused in the toast: "Stake" → "Staked". */
  verb: string;
  steps: TxStep[];
  /** Amounts for the error sentences ("You only have X sMDM free"). */
  errorContext?: ErrorContext;
};

export type TxStepStatus = 'todo' | 'active' | 'done' | 'skipped' | 'error';
export type TxStatus = 'idle' | 'simulating' | 'signing' | 'pending' | 'done' | 'error';

export type TxState = {
  status: TxStatus;
  /** Index of the step being worked on (or the one that failed). */
  stepIndex: number;
  steps: { label: string; status: TxStepStatus }[];
  /** Hash of the most recent transaction sent (the action's, once it is sent). */
  hash?: Hex;
  explorerUrl?: string;
  error?: string;
  verb: string;
};

export const IDLE: TxState = { status: 'idle', stepIndex: 0, steps: [], verb: '' };

export function useTx(): { state: TxState; run: (plan: TxPlan) => Promise<void>; reset: () => void } {
  const config = useConfig();
  const queryClient = useQueryClient();
  const [state, setState] = useState<TxState>(IDLE);
  // A run id lets reset() (or a newer run) orphan an in-flight run so it stops touching state.
  const runId = useRef(0);

  const reset = useCallback(() => {
    runId.current += 1;
    setState(IDLE);
  }, []);

  const run = useCallback(async (plan: TxPlan) => {
    const id = ++runId.current;
    const live = () => runId.current === id;
    const patch = (p: Partial<TxState> | ((s: TxState) => Partial<TxState>)) => {
      if (!live()) return;
      setState((s) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));
    };
    const setStep = (i: number, status: TxStepStatus) =>
      patch((s) => ({ steps: s.steps.map((st, j) => (j === i ? { ...st, status } : st)) }));

    const steps = plan.steps.map((st) => ({ label: st.label, status: (st.skip ? 'skipped' : 'todo') as TxStepStatus }));
    const first = plan.steps.findIndex((st) => !st.skip);
    setState({ status: 'simulating', stepIndex: Math.max(first, 0), steps, verb: plan.verb });

    if (first === -1) {
      patch({ status: 'done' });
      return;
    }

    const fail = (i: number, e: unknown) => {
      setStep(i, 'error');
      patch({ status: 'error', stepIndex: i, error: explainError(e, plan.errorContext) });
    };

    // 0. Wallet connected and on Base.
    try {
      const conn = getConnection(config);
      if (conn.status !== 'connected' || !conn.address) throw new Error('Connect a wallet first.');
      if (getChainId(config) !== CHAIN_ID || conn.chainId !== CHAIN_ID) {
        await switchChain(config, { chainId: CHAIN_ID });
      }
    } catch (e) {
      fail(first, e);
      return;
    }

    for (let i = first; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      if (step.skip) continue;
      if (!live()) return;
      patch({ status: 'simulating', stepIndex: i, error: undefined });
      setStep(i, 'active');

      // 1. Simulate so a revert becomes a sentence before the wallet opens.
      let request;
      try {
        const sim = await simulateContract(config, {
          address: step.address,
          abi: step.abi,
          functionName: step.functionName,
          args: step.args ?? [],
          chainId: CHAIN_ID,
        });
        request = sim.request;
      } catch (e) {
        fail(i, e);
        return;
      }
      if (!live()) return;

      // 2. Sign and send.
      let hash: Hex;
      try {
        patch({ status: 'signing' });
        hash = await writeContract(config, request);
      } catch (e) {
        fail(i, e);
        return;
      }
      if (!live()) return;
      patch({ status: 'pending', hash, explorerUrl: txUrl(hash) });

      // 3. One confirmation.
      try {
        const receipt = await waitForTransactionReceipt(config, { hash, chainId: CHAIN_ID, confirmations: 1 });
        if (receipt.status !== 'success') throw new Error('The transaction reverted on chain.');
      } catch (e) {
        fail(i, e);
        return;
      }
      if (!live()) return;
      setStep(i, 'done');
      // Refresh reads between steps too, so an approve immediately updates the allowance.
      void queryClient.invalidateQueries();
    }

    patch({ status: 'done' });
    void queryClient.invalidateQueries();
  }, [config, queryClient]);

  return { state, run, reset };
}
