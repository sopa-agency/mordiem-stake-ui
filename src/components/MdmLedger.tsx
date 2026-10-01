'use client';
// Stake tab: MDM only. Ledger rows on the left, the Stake | Unstake form on the right, the 7-day queue when it has content.
import { useId, useMemo, useState } from 'react';
import { Button, Chip, ElasticSlider, Field, Segmented, StarBorder } from '@/components/ui';
import { buildClaimRewardsPlan, buildClaimUnstakedPlan, buildStakePlan, buildUnstakePlan, needsApprove } from '@/lib/plans';
import { fmtAmount, fmtPct, parseAmount, stakerAprPct } from '@/lib/protocol';
import { Checkbox, ConnectPrompt, Dash, Details, LedgerRow, Note, PageHeader, dayIndex, toNum, useNow, weiToInput, type PanelProps } from './common';
import { QueueList } from './Queues';
import { TxProgress, useTxFlow } from './TxFlow';

type Mode = 'stake' | 'unstake';
const ZERO = BigInt(0);

export function MdmLedger({ protocol, account, connected }: PanelProps) {
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
  const claiming = tx.busy && tx.state.verb.startsWith('Claim');
  const hasQueue = !!account && (account.mdmQueue.length > 0 || account.mdmMatured > ZERO);
  const value = (x: bigint) => (connected ? (account ? fmtAmount(x) : '…') : <Dash />);

  return (
    <>
      <PageHeader
        eyebrow="Stake"
        title="Stake MDM"
        aside={
          <>
            {pausedStake && <Chip>Staking paused; exits still work</Chip>}
            {account?.genesisRestricted && <Chip>Genesis-restricted wallet</Chip>}
            <Segmented
              aria-label="Stake or unstake"
              value={mode}
              onChange={switchMode}
              options={[
                { value: 'stake', label: 'Stake' },
                { value: 'unstake', label: 'Unstake' },
              ]}
            />
          </>
        }
      />

      <div className="grid gap-10 min-[960px]:grid-cols-[1.1fr_1fr] min-[960px]:gap-12">
        <section aria-label="MDM ledger" className="flex flex-col">
          <LedgerRow
            big
            label="Staked"
            value={value(account?.stakedAmount ?? ZERO)}
            unit="sMDM"
            sub={protocol ? `Free sMDM earns about ${fmtPct(apr, 1)} a year at today's emission (${fmtAmount(protocol.totalStaked, 18, 2)} MDM staked by everyone).` : undefined}
          />
          <LedgerRow label="In your wallet" value={value(balance)} unit="MDM" />
          <LedgerRow label="Free to use" value={value(free)} unit="sMDM" />
          <LedgerRow label="Locked behind MCU" sub="Earns half while locked." value={value(account?.lockedAmount ?? ZERO)} unit="sMDM" to={{ href: '/mcu', label: 'MCU' }} />
          <LedgerRow
            label="Rewards to claim"
            value={value(pending)}
            unit="MDM"
            action={
              connected && pending > ZERO ? (
                <StarBorder>
                  <Button variant="secondary" spark loading={claiming} disabled={tx.busy} onClick={() => tx.run(buildClaimRewardsPlan(pending))}>
                    Claim
                  </Button>
                </StarBorder>
              ) : connected && account ? (
                <Button variant="secondary" disabled>
                  Claim
                </Button>
              ) : undefined
            }
          />
        </section>

        <section aria-label={mode === 'stake' ? 'Stake form' : 'Unstake form'} className="flex flex-col gap-4">
          <Field
            id={`${id}-amount`}
            label={mode === 'stake' ? 'Amount to stake' : 'Amount to unstake'}
            token={mode === 'stake' ? 'MDM' : 'sMDM'}
            value={amount}
            onChange={setAmount}
            onMax={connected ? () => setAmount(weiToInput(max)) : undefined}
            helper={connected && account ? (mode === 'stake' ? `Wallet ${fmtAmount(balance)} MDM` : `Free ${fmtAmount(free)} sMDM`) : undefined}
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
            <>
              <Button magnet spark fullWidth size="lg" loading={tx.busy && !claiming} disabled={!canSend} disabledReason={reason} onClick={() => plan && tx.run(plan)}>
                {label}
              </Button>
              {mode === 'stake' && plan && needsApprove(plan) && (
                <Checkbox id={`${id}-unlimited`} checked={unlimited} onChange={setUnlimited} disabled={tx.busy}>
                  Approve unlimited MDM so future stakes skip the approve step
                </Checkbox>
              )}
              <TxProgress state={tx.state} />
            </>
          ) : (
            <ConnectPrompt action="stake" />
          )}
          <Note>{mode === 'stake' ? 'Stakes 1:1 into sMDM and starts earning on the next emission tick. Unstaking waits 7 days.' : 'Moves free sMDM into the 7-day queue; it stops earning now and is yours again when it thaws.'}</Note>
          <Details>
            <p>sMDM is not transferable. Half of each day&apos;s emission goes to stakers pro rata; sMDM locked behind an MCU position earns half of that share, and the other half goes to the treasury.</p>
            <p>Stake needs a one-time MDM approval to the Core contract; exact amount by default. Unstake requests queue in order and claimUnstaked pays every item that has thawed.</p>
          </Details>

          {hasQueue && account && (
            <div className="mt-2 flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">Unstake queue</h2>
                <span className="text-[12px] text-ink-3">7 days from request</span>
              </div>
              <QueueList
                items={account.mdmQueue}
                thawSec={protocol?.mdmThawSec ?? 7 * 86400}
                token="MDM"
                now={now}
                matured={account.mdmMatured}
                onClaim={() => tx.run(buildClaimUnstakedPlan(account.mdmMatured))}
                busy={tx.busy}
                empty=""
              />
            </div>
          )}
        </section>
      </div>
    </>
  );
}
