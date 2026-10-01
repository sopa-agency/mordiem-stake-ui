# Mordiem Stake UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Vercel-hosted dashboard for staking MDM and checking out / staking MCU on Base, with real transactions and the approved "compute instrument" design.

**Architecture:** Next.js App Router with wagmi/viem for chain access and no backend. A pure `protocol.ts` holds every formula and is unit-tested. Typed read hooks batch one multicall per screen; write hooks simulate, send, wait and invalidate. UI is built from ported ReactBits pieces on a token system (Night black default, Day toggle).

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, wagmi 2, viem 2, @tanstack/react-query 5, @rainbow-me/rainbowkit 2, motion 12, vitest, playwright-core (tests only).

**Spec:** `docs/superpowers/specs/2026-10-01-mordiem-stake-ui-design.md`

## Global Constraints
- Chain: Base (8453) only. Addresses and ABIs exactly as the spec lists; ABIs copied from `/Users/web3warrior/Code/mordiem-whale-monitor/abis/{MDM,MCU,MordiemCore,MCUVault}.json`.
- Every write goes through simulate → write → waitForReceipt → invalidate reads. Contract error names map to the spec's sentences; unknown errors show the short message.
- Default surface Night (`#000`); Day toggle; tokens only (no literal colors in components). Fonts Bricolage Grotesque + Instrument Sans via `next/font/google`. `prefers-reduced-motion` disables animation.
- Copy in English, sentence case, active verbs; button verb equals toast verb.
- Phone width 390 px: no horizontal scroll; hero stacks; Pill Nav becomes a bottom Dock.
- Env names: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_RPC_URLS`. Never commit `.env*`.

## File Structure
- `src/lib/contracts/{addresses.ts, abis/*.json, index.ts}` (Task 1)
- `src/lib/protocol.ts` + `src/lib/protocol.test.ts` (Task 2)
- `src/lib/wagmi.ts`, `src/app/providers.tsx` (Task 1)
- `src/lib/errors.ts` (Task 3)
- `src/hooks/useProtocol.ts`, `useAccountState.ts`, `useTx.ts` (Task 3)
- `src/components/ui/*` ReactBits ports + base controls (Task 4)
- `src/components/{EpochMeter,MdmLedger,CheckOutPanel,VaultPanel,Queues,Nav}.tsx` (Task 5)
- `src/app/{layout,page,positions/page,protocol/page,a/[address]/page}.tsx` (Task 5)
- `tests/e2e.mjs` (Task 6)

---

### Task 1: Scaffold, tokens, wallet
**Files:** project root (Next.js scaffold), `src/app/globals.css`, `src/lib/wagmi.ts`, `src/app/providers.tsx`, `src/lib/contracts/*`, `.env.local`, `.gitignore`.
- [ ] Scaffold Next.js (TS, Tailwind, App Router, src dir), install `wagmi viem @tanstack/react-query @rainbow-me/rainbowkit motion` and dev `vitest @vitejs/plugin-react jsdom`.
- [ ] Copy the four ABIs; write `addresses.ts` with the spec's addresses and the Aerodrome pool.
- [ ] `globals.css`: token system from the spec as CSS variables on `:root[data-surface="night"|"day"]`, Tailwind theme mapping, reduced-motion kill switch.
- [ ] `wagmi.ts`: RainbowKit `getDefaultConfig` for Base with `fallback(transports)` from `NEXT_PUBLIC_RPC_URLS`; `providers.tsx` with QueryClient + WagmiProvider + RainbowKitProvider (theme matching surface).
- [ ] `pnpm build` passes; commit.

### Task 2: Protocol math (TDD)
**Files:** `src/lib/protocol.ts`, `src/lib/protocol.test.ts`.
- [ ] Tests: `quoteCheckOut(reserveMdm, reserveMcu, q)` equals the contract formula (250.17 MDM for 1 MCU at 375003/1499.988; 12.50 after +28500); `emissionPerDay(t)=t+0.5`, `cumulative(t)=t(t+1)/2`; `stakerAprPct(totalStaked, t)`; `forgoneRewardsUsd(lockedMdm, totalStaked, t, price)` (locked earns half); `secondsToMidnightUtc(now)`; `freeStake(amount, locked)`; `formatAmount` helpers; `mdmPriceFromReserves(usdc6, mdm18)`.
- [ ] Implement; `pnpm vitest run` green; commit.

### Task 3: Chain hooks and error mapping
**Files:** `src/hooks/*.ts`, `src/lib/errors.ts`.
- [ ] `useProtocol()`: one multicall (reserves, totals, flags, goLive, MDM_THAW, MIN_CHECKOUT, pool reserves, totalEligible), refetch 12 s.
- [ ] `useAccountState(address)`: balances (MDM, MCU), allowances (MDM→Core, MCU→Vault), `stakes`, `pendingRewards`, `positionsOf`, `unstakeQueueOf`+head, vault `stakedMCU`/`eligibleBalance`/`thawingBalance`/queue+head, `genesisRestricted`; derived free sMDM, matured amounts.
- [ ] `useTx()`: steps state machine (idle → approving → confirming → pending → done | error); `simulateContract` before `writeContract`; maps revert via `errors.ts`; invalidates account + protocol queries on receipt; returns tx hash and Basescan URL.
- [ ] `errors.ts`: decode `ContractFunctionRevertedError` names to the spec sentences (with amounts where available); fallback to `shortMessage`.
- [ ] Typecheck; commit.

### Task 4: UI kit (ReactBits ports + base)
**Files:** `src/components/ui/{Button,Field,Segmented,Chip,Ring,Battery,Stepper,Toast,SplitFlap,CountUp,ElasticSlider,SpotlightCard,StarBorder,Magnet,ClickSpark,AnimatedList,PillNav,Dock,DotField,Noise,ShinyText}.tsx`.
- [ ] Port each ReactBits piece (TS + Tailwind variant, Motion) and restyle to tokens; all honor reduced motion; Button has variants primary/secondary/ghost/destructive and states loading/success/disabled-with-reason.
- [ ] A `/kit` dev route renders every piece in both surfaces for screenshots; commit.

### Task 5: Screens
**Files:** `src/components/*.tsx`, `src/app/**/page.tsx`, `layout.tsx`.
- [ ] `EpochMeter` (SplitFlap countdown, Battery from `eligibleBalance`, network figures with CountUp).
- [ ] `MdmLedger` (staked, free, locked, rewards with StarBorder Claim; Stake/Unstake segmented with Field + ElasticSlider; Stepper; queue rings with exact unlock times; claimUnstaked when matured).
- [ ] `CheckOutPanel` (curve SVG to scale from live reserves, slider, readouts incl. forgone rewards, Oct 4 toggle; Check out / Check in segmented; positions list via AnimatedList).
- [ ] `VaultPanel` (stake MCU with approve step, eligible vs thawing, 24 h queue, claim).
- [ ] Pages: `/` hero + panels; `/positions`; `/protocol` (Magic Bento with emission, reserves, buyback totals); `/a/[address]` read-only; wallet-less state shows live protocol figures and a connect prompt (no empty shells).
- [ ] Mobile: Dock nav, stacked hero, 390 px check; commit.

### Task 6: Verification and deploy
- [ ] `pnpm vitest run`, `pnpm build`, `pnpm lint` green.
- [ ] Playwright (`tests/e2e.mjs`): `/`, `/protocol`, `/a/0x8Bf5941d27176242745B716251943Ae4892a3C26` at 1300 and 390 px, both surfaces: no console errors, no overflow, live numbers present (totalStaked > 0).
- [ ] Create GitHub repo, push `main`; `vercel link` + `vercel env add` (WalletConnect id, RPC URLs) + `vercel --prod`; smoke-test the production URL; hand the link to the owner for the first real transaction (approve + stake), then the others.
