'use client';
// MDM as a ledger: staked, wallet, free, locked, rewards; then stake / request unstake with Field + slider; then the 7-day queue.
import { useId, useMemo, useState } from 'react';
import { Button, Chip, ElasticSlider, Field, Segmented, StarBorder } from '@/components/ui';
import { buildClaimRewardsPlan, buildClaimUnstakedPlan, buildStakePlan, buildUnstakePlan, needsApprove } from '@/lib/plans';
import { fmtAmount, fmtPct, parseAmount, stakerAprPct } from '@/lib/protocol';
import { Checkbox, ConnectPrompt, Dash, LedgerRow, Note, Panel, dayIndex, toNum, useNow, weiToInput, type PanelProps } from './common';
import { QueueList } from './Queues';
import { TxProgress, useTxFlow } from './TxFlow';

type Mode = 'stake' | 'unstake';
const ZERO = BigInt(0);

export function MdmLedger({ protocol, account, connected, readOnly }: PanelProps) {
  const id = useId();
  const now = useNow();
  const [mode, setMode] = useState<Mode>('stake');
  const [amount, setAmount] = useState('');
  const [unlimited, setUnlimited] = useState(false);
  const tx = useTxFlow(() => setAmount(''));

  const t = dayIndex(protocol, now);
  const apr = protocol ? stakerAprPct(toNum(protocol.totalStaked), t) : 0;

  const balance = account?.mdmBalance ?? ZERO;
  const free = account?.freeStake ?? ZERO;
  const pending = account?.pendingRewards ?? ZERO;
  const max = mode === 'stake' ? balance : free;
  const maxNum = toNum(max);

  const wei = useMemo(() => (amount.trim() === '' ? null : parseAmount(amount)), [amount]);
  const invalid = amount.trim() !== '' && wei === null;
  const over = wei !== null && wei > max;
  const fieldError = invalid
    ? 'Enter a valid amount.'
    : over
      ? mode === 'stake'
        ? `You only have ${fmtAmount(balance)} MDM.`
        : `You only have ${fmtAmount(free)} sMDM free; the rest is locked behind MCU.`
      : undefined;

  const plan = wei !== null && wei > ZERO
    ? mode === 'stake'
      ? buildStakePlan(wei, { allowance: account?.mdmAllowanceCore ?? ZERO, unlimited })
      : buildUnstakePlan(wei, free)
    : null;

  const pausedStake = Boolean(protocol?.paused.stake);
  const reason = !account
    ? undefined
    : account.genesisRestricted
      ? 'This wallet cannot stake or check out.'
      : mode === 'stake' && pausedStake
        ? 'Staking is paused by the guardian; exits still work.'
        : fieldError;
  const canSend = plan !== null && !reason && !tx.busy;

  const sliderValue = Math.max(0, Math.min(maxNum, Number(amount) || 0));
  const onSlider = (v: number) => {
    if (maxNum <= 0) return;
    setAmount(v >= maxNum ? weiToInput(max) : v.toFixed(2));
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setAmount('');
    tx.reset();
  };

  const label = plan ? plan.verb : mode === 'stake' ? 'Stake MDM' : 'Request unstake';

  return (
    <Panel
      eyebrow="MDM"
      title="Stake MDM"
      aside={
        <>
          {pausedStake && <Chip>Staking paused by the guardian; exits still work</Chip>}
          {account?.genesisRestricted && <Chip>Genesis-restricted wallet</Chip>}
        </>
      }
    >
      <div className="flex flex-col">
        <LedgerRow
          big
          label="Staked"
          value={connected && account ? fmtAmount(account.stakedAmount) : <Dash />}
          unit="sMDM"
          sub={protocol ? `Free sMDM earns about ${fmtPct(apr, 1)} a year at today's emission; locked sMDM earns half.` : undefined}
        />
        <LedgerRow label="In your wallet" value={connected && account ? fmtAmount(balance) : <Dash />} unit="MDM" />
        <LedgerRow label="Free to use" sub="Unlock it any time (7-day thaw) or lock it behind MCU." value={connected && account ? fmtAmount(free) : <Dash />} unit="sMDM" />
        <LedgerRow label="Locked behind MCU" sub="Earns half while locked." value={connected && account ? fmtAmount(account.lockedAmount) : <Dash />} unit="sMDM" />
        <LedgerRow
          label="Rewards to claim"
          value={connected && account ? fmtAmount(pending) : <Dash />}
          unit="MDM"
          action={
            connected && !readOnly ? (
              pending > ZERO ? (
                <StarBorder>
                  <Button variant="secondary" spark loading={tx.busy && tx.state.verb.startsWith('Claim')} disabled={tx.busy} onClick={() => tx.run(buildClaimRewardsPlan(pending))}>
                    Claim {fmtAmount(pending)} MDM
                  </Button>
                </StarBorder>
              ) : (
                <Button variant="secondary" disabledReason="Nothing to claim yet">
                  Claim
                </Button>
              )
            ) : undefined
          }
        />
      </div>

      {!readOnly && (
        <div className="flex flex-col gap-4">
          <Segmented
            aria-label="Stake or unstake"
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
            label={mode === 'stake' ? 'Amount to stake' : 'Amount to unstake'}
            token={mode === 'stake' ? 'MDM' : 'sMDM'}
            value={amount}
            onChange={setAmount}
            onMax={connected ? () => setAmount(weiToInput(max)) : undefined}
            helper={connected && account ? (mode === 'stake' ? `Wallet ${fmtAmount(balance)} MDM` : `Free ${fmtAmount(free)} sMDM`) : 'Connect a wallet'}
            error={fieldError}
            disabled={!connected || tx.busy}
          />
          {connected && (
            <ElasticSlider
              id={`${id}-slider`}
              min={0}
              max={maxNum > 0 ? maxNum : 1}
              step={0.01}
              value={sliderValue}
              onChange={onSlider}
              disabled={maxNum <= 0 || tx.busy}
              format={(v) => (maxNum > 0 ? `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })} of ${maxNum.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : 'Nothing available')}
            />
          )}

          {connected ? (
            <div className="flex flex-col gap-3">
              <Button magnet spark fullWidth size="lg" loading={tx.busy && !tx.state.verb.startsWith('Claim')} disabled={!canSend} disabledReason={reason} onClick={() => plan && tx.run(plan)}>
                {label}
              </Button>
              {mode === 'stake' && plan && needsApprove(plan) && (
                <Checkbox id={`${id}-unlimited`} checked={unlimited} onChange={setUnlimited} disabled={tx.busy}>
                  Approve unlimited MDM so future stakes skip the approve step
                </Checkbox>
              )}
              <Note>
                {mode === 'stake'
                  ? 'Stakes 1:1 into sMDM and starts earning on the next emission tick. Unstaking waits 7 days.'
                  : 'Moves sMDM into the 7-day queue; it stops earning now and is yours again when it thaws. Only free sMDM can leave.'}
              </Note>
              <TxProgress state={tx.state} />
            </div>
          ) : (
            <ConnectPrompt action="stake" />
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[13px] font-medium uppercase tracking-[0.08em] text-ink-3">Unstake queue</h3>
          <span className="text-[12px] text-ink-3">7 days from request</span>
        </div>
        {connected && account ? (
          <QueueList
            items={account.mdmQueue}
            thawSec={protocol?.mdmThawSec ?? 7 * 86400}
            token="MDM"
            now={now}
            matured={account.mdmMatured}
            onClaim={() => tx.run(buildClaimUnstakedPlan(account.mdmMatured))}
            busy={tx.busy}
            readOnly={readOnly}
            empty="Nothing thawing. Unstaked MDM waits here for 7 days before you can claim it."
          />
        ) : (
          <p className="text-[13px] text-ink-3">Connect a wallet to see its queue.</p>
        )}
      </div>
    </Panel>
  );
}
