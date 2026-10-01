'use client';
// Credit tab: the MCU vault. Battery + $/day as the main number, a small countdown to the 00:00 UTC refill,
// stake MCU / request unstake, and the 24 h queue when it has content.
import { useId, useMemo, useState } from 'react';
import { Battery, Button, Chip, CountUp, Field, Segmented, SplitFlap } from '@/components/ui';
import { buildVaultClaimPlan, buildVaultStakePlan, buildVaultUnstakePlan, needsApprove } from '@/lib/plans';
import { fmtAmount, mcuPerDayCreditUsd, parseAmount, secondsToMidnightUtc } from '@/lib/protocol';
import { Checkbox, ConnectPrompt, Details, Note, PageHeader, Stat, hms, toNum, useNow, weiToInput, type PanelProps } from './common';
import { QueueList } from './Queues';
import { TxProgress, useTxFlow } from './TxFlow';

type Mode = 'stake' | 'unstake';
const ZERO = BigInt(0);

export function CreditPanel({ protocol, account, connected }: PanelProps) {
  const id = useId();
  const now = useNow();
  const [mode, setMode] = useState<Mode>('stake');
  const [amount, setAmount] = useState('');
  const [unlimited, setUnlimited] = useState(false);
  const tx = useTxFlow(() => setAmount(''));

  const clock = now === null ? '00:00:00' : hms(secondsToMidnightUtc(new Date(now * 1000)));

  const eligible = account?.vault.eligible ?? ZERO;
  const thawing = account?.vault.thawing ?? ZERO;
  const wallet = account?.mcuBalance ?? ZERO;
  const max = mode === 'stake' ? wallet : eligible;
  const eligibleNum = toNum(eligible);
  const thawingNum = toNum(thawing);
  const everyone = toNum(protocol?.totalEligible);
  const cells = connected ? Math.max(1, Math.ceil(eligibleNum + thawingNum)) : Math.max(1, Math.ceil(everyone));
  const filled = connected ? eligibleNum : everyone;

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
  const claiming = tx.busy && tx.state.verb.startsWith('Claim');
  const hasQueue = !!account && (account.vault.queue.length > 0 || account.vault.matured > ZERO);
  const stat = (x: bigint) => (connected ? (account ? fmtAmount(x) : '…') : '—');

  return (
    <>
      <PageHeader
        eyebrow="Credit"
        title="Stake MCU for daily credit"
        aside={
          <>
            {paused && <Chip>MCU staking paused; exits still work</Chip>}
            <Segmented
              aria-label="Stake or unstake MCU"
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

      <div className="grid gap-8 min-[960px]:grid-cols-[1.15fr_1fr] min-[960px]:gap-12">
        <section aria-label="Today's credit" className="edge flex flex-col gap-6 rounded-sheet bg-sheet p-5 ring-1 ring-inset ring-rule min-[720px]:p-6">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{connected ? 'Your API credit' : 'Credit scheduled for everyone'}</span>
              <span className="font-display num text-[44px] font-semibold leading-none text-charge min-[720px]:text-[52px]">
                <CountUp to={mcuPerDayCreditUsd(filled)} decimals={2} prefix="$" suffix=" / day" />
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Refills in</span>
              <SplitFlap value={clock} aria-label="Time until the next 00:00 UTC credit refill" className="text-[26px]" />
            </div>
          </div>
          <Battery cells={Math.min(cells, 10_000)} filled={filled} label={connected ? 'Eligible today' : 'Everyone today'} />
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Eligible">{stat(eligible)} <span className="text-[13px] text-ink-3">MCU</span></Stat>
            <Stat label="Thawing">{stat(thawing)} <span className="text-[13px] text-ink-3">MCU</span></Stat>
            <Stat label="In wallet">{stat(wallet)} <span className="text-[13px] text-ink-3">MCU</span></Stat>
          </div>
        </section>

        <section aria-label={mode === 'stake' ? 'Stake MCU form' : 'Unstake MCU form'} className="flex flex-col gap-4">
          <Field
            id={`${id}-amount`}
            label={mode === 'stake' ? 'MCU to stake' : 'MCU to unstake'}
            token="MCU"
            value={amount}
            onChange={setAmount}
            onMax={connected ? () => setAmount(weiToInput(max)) : undefined}
            helper={connected && account ? (mode === 'stake' ? `Wallet ${fmtAmount(wallet)} MCU` : `Eligible ${fmtAmount(eligible)} MCU`) : undefined}
            error={fieldError}
            disabled={!connected || tx.busy}
          />
          {connected ? (
            <>
              <Button magnet spark fullWidth size="lg" variant={mode === 'stake' ? 'primary' : 'secondary'} loading={tx.busy && !claiming} disabled={!plan || !!reason || tx.busy} disabledReason={reason} onClick={() => plan && tx.run(plan)}>
                {label}
              </Button>
              {mode === 'stake' && plan && needsApprove(plan) && (
                <Checkbox id={`${id}-unlimited`} checked={unlimited} onChange={setUnlimited} disabled={tx.busy}>
                  Approve unlimited MCU so future stakes skip the approve step
                </Checkbox>
              )}
              <TxProgress state={tx.state} />
            </>
          ) : (
            <ConnectPrompt action="stake MCU" />
          )}
          <Note>{mode === 'stake' ? 'Each staked MCU earns $1 of API credit a day, refilled at 00:00 UTC.' : 'Unstaked MCU stops earning credit immediately; it is yours again after 24 h.'}</Note>
          <Details>
            <p>Staking needs a one-time MCU approval to the vault; exact amount by default. Eligible MCU is what counts at the next refill; MCU in the 24 h queue is &quot;thawing&quot; and earns nothing.</p>
            <p>To check MCU back in on the MCU tab it must be in your wallet, so unstake it here first.</p>
          </Details>

          {hasQueue && account && (
            <div className="mt-2 flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">Unstake queue</h2>
                <span className="text-[12px] text-ink-3">24 h from request</span>
              </div>
              <QueueList
                items={account.vault.queue}
                thawSec={protocol?.mcuThawSec ?? 86400}
                token="MCU"
                now={now}
                matured={account.vault.matured}
                onClaim={() => tx.run(buildVaultClaimPlan(account.vault.matured))}
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
