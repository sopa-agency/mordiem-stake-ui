'use client';
// MCU vault: stake MCU for $1/day of API credit per MCU, request unstake (24 h), claim.
import { useId, useMemo, useState } from 'react';
import { Button, Chip, Field, Segmented } from '@/components/ui';
import { buildVaultClaimPlan, buildVaultStakePlan, buildVaultUnstakePlan, needsApprove } from '@/lib/plans';
import { fmtAmount, parseAmount } from '@/lib/protocol';
import { Checkbox, ConnectPrompt, Dash, Note, Panel, Stat, toNum, useNow, weiToInput, type PanelProps } from './common';
import { QueueList } from './Queues';
import { TxProgress, useTxFlow } from './TxFlow';

type Mode = 'stake' | 'unstake';
const ZERO = BigInt(0);

export function VaultPanel({ protocol, account, connected, readOnly }: PanelProps) {
  const id = useId();
  const now = useNow();
  const [mode, setMode] = useState<Mode>('stake');
  const [amount, setAmount] = useState('');
  const [unlimited, setUnlimited] = useState(false);
  const tx = useTxFlow(() => setAmount(''));

  const eligible = account?.vault.eligible ?? ZERO;
  const thawing = account?.vault.thawing ?? ZERO;
  const wallet = account?.mcuBalance ?? ZERO;
  const max = mode === 'stake' ? wallet : eligible;

  const wei = useMemo(() => (amount.trim() === '' ? null : parseAmount(amount)), [amount]);
  const invalid = amount.trim() !== '' && wei === null;
  const over = wei !== null && wei > max;
  const fieldError = invalid ? 'Enter a valid amount.' : over ? (mode === 'stake' ? `You only have ${fmtAmount(wallet)} MCU in your wallet.` : `You only have ${fmtAmount(eligible)} MCU eligible.`) : undefined;

  const plan = wei !== null && wei > ZERO
    ? mode === 'stake'
      ? buildVaultStakePlan(wei, { allowance: account?.mcuAllowanceVault ?? ZERO, unlimited })
      : buildVaultUnstakePlan(wei, eligible)
    : null;

  const paused = Boolean(protocol?.paused.stakeMcu);
  const reason = !account ? undefined : mode === 'stake' && paused ? 'MCU staking is paused by the guardian; exits still work.' : fieldError;

  const switchMode = (m: Mode) => {
    setMode(m);
    setAmount('');
    tx.reset();
  };

  const label = plan ? plan.verb : mode === 'stake' ? 'Stake MCU' : 'Request unstake';
  const creditPerDay = toNum(eligible);

  return (
    <Panel eyebrow="MCU vault" title="Stake MCU for daily credit" aside={paused && <Chip>MCU staking paused by the guardian; exits still work</Chip>}>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Eligible">
          {connected && account ? (
            <>
              {fmtAmount(eligible)} <span className="text-[13px] text-ink-3">MCU</span>
            </>
          ) : (
            <Dash />
          )}
        </Stat>
        <Stat label="Thawing">
          {connected && account ? (
            <>
              {fmtAmount(thawing)} <span className="text-[13px] text-ink-3">MCU</span>
            </>
          ) : (
            <Dash />
          )}
        </Stat>
        <Stat label="In wallet">
          {connected && account ? (
            <>
              {fmtAmount(wallet)} <span className="text-[13px] text-ink-3">MCU</span>
            </>
          ) : (
            <Dash />
          )}
        </Stat>
      </div>
      {connected && account && (
        <Note>
          Earning <span className="num font-medium text-charge">${creditPerDay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> of API credit a day, refilled at 00:00 UTC.
        </Note>
      )}

      {!readOnly && (
        <div className="flex flex-col gap-4">
          <Segmented
            aria-label="Stake or unstake MCU"
            size="lg"
            value={mode}
            onChange={switchMode}
            options={[
              { value: 'stake', label: 'Stake' },
              { value: 'unstake', label: 'Unstake' },
            ]}
          />
          <Field
            id={`${id}-amount`}
            label={mode === 'stake' ? 'MCU to stake' : 'MCU to unstake'}
            token="MCU"
            value={amount}
            onChange={setAmount}
            onMax={connected ? () => setAmount(weiToInput(max)) : undefined}
            helper={connected && account ? (mode === 'stake' ? `Wallet ${fmtAmount(wallet)} MCU` : `Eligible ${fmtAmount(eligible)} MCU`) : 'Connect a wallet'}
            error={fieldError}
            disabled={!connected || tx.busy}
          />
          {connected ? (
            <div className="flex flex-col gap-3">
              <Button magnet spark fullWidth size="lg" variant={mode === 'stake' ? 'primary' : 'secondary'} loading={tx.busy && !tx.state.verb.startsWith('Claim')} disabled={!plan || !!reason || tx.busy} disabledReason={reason} onClick={() => plan && tx.run(plan)}>
                {label}
              </Button>
              {mode === 'stake' && plan && needsApprove(plan) && (
                <Checkbox id={`${id}-unlimited`} checked={unlimited} onChange={setUnlimited} disabled={tx.busy}>
                  Approve unlimited MCU so future stakes skip the approve step
                </Checkbox>
              )}
              <Note>
                {mode === 'stake'
                  ? 'Staked MCU earns $1 of API credit per MCU per day, refilled at 00:00 UTC.'
                  : 'Unstaked MCU stops earning credit immediately; it is yours again after 24 h.'}
              </Note>
              <TxProgress state={tx.state} />
            </div>
          ) : (
            <ConnectPrompt action="stake MCU" />
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[13px] font-medium uppercase tracking-[0.08em] text-ink-3">Unstake queue</h3>
          <span className="text-[12px] text-ink-3">24 h from request</span>
        </div>
        {connected && account ? (
          <QueueList
            items={account.vault.queue}
            thawSec={protocol?.mcuThawSec ?? 86400}
            token="MCU"
            now={now}
            matured={account.vault.matured}
            onClaim={() => tx.run(buildVaultClaimPlan(account.vault.matured))}
            busy={tx.busy}
            readOnly={readOnly}
            empty="Nothing thawing. Unstaked MCU waits here for 24 h before you can claim it."
          />
        ) : (
          <p className="text-[13px] text-ink-3">Connect a wallet to see its queue.</p>
        )}
      </div>
    </Panel>
  );
}
