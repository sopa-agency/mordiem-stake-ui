# Mordiem Stake: design spec

Status: approved in chat on 2026-10-01 (direction "instrument", tactile finish, ReactBits set approved).
Reference to beat: https://mordiem.com/token (the official MDM token dashboard).

## Goal
A standalone dashboard on Vercel where a Mordiem holder stakes MDM, checks MCU out and in, and stakes MCU for daily API credit, with real transactions on Base. It must read as the best-crafted interface in the Mordiem community: clear about queues and epochs, honest about costs, alive without being noisy.

## Scope (v1)
In: wallet connect on Base; MDM stake / request unstake / claim unstaked / claim rewards; MCU check-out (with curve simulator) and check-in; MCU vault stake / request unstake (24 h) / claim; positions and queues; protocol page (emission, reserves, totals); read-only view of any address.
Out: capital pools (USDC, wstETH, MOR, VVV), buyback admin, mobile app, accounts, analytics.

## Contracts (Base, chainId 8453; verified ABIs copied from the whale monitor)
- MDM `0xe2eF6eA8cB5ef092f068416Ff8f9727EB2586ec9` (ERC-20 + permit)
- MCU `0xfF54ad785ffCc0F8D11EF13D43EA297D729FD5d3` (ERC-20 + permit; Core is sole minter/burner)
- MordiemCore `0x0ed8f4b731EF82E89e18E5aab5Bf8dF4EB36c30d`: `stake(amount)`, `requestUnstake(amount)`, `claimUnstaked()`, `claimRewards()`, `checkOut(mcu) -> positionId`, `checkIn(mcu)`; reads `stakes(u) -> (amount, lockedAmount, rewardDebt, pending)`, `pendingRewards(u)`, `positionsOf(u) -> {mcuOutstanding, mdmLocked, checkoutRate}[]`, `unstakeQueueOf(u)` + `unstakeQueueHead(u)`, `quoteCheckOut(mcu)`, `reserveMCU`, `reserveMDM`, `totalStaked`, `totalLocked`, `cumulativeEmitted`, `MDM_THAW`, `MIN_CHECKOUT`, `MAX_POSITIONS`, `isPaused(flag)`, `FLAG_STAKE`, `FLAG_CHECKOUT`, `goLiveTimestamp`, `genesisRestricted(u)`.
- MCUVault `0xB6765cE268e0A4b5966062F7c22B4418eE086962`: `stake(amount)`, `requestUnstake(amount)`, `claimUnstaked()`; reads `stakedMCU(u)`, `eligibleBalance(u)`, `thawingBalance(u)`, `unstakeQueueOf(u)` + head, `totalEligible`, `isPaused(FLAG_STAKE_MCU)`.
- Price: Aerodrome vAMM USDC/MDM `0x4f4f9ce72933292958E7CdE445Bc57F889378085` (`getReserves`; token0 USDC 6 dp, token1 MDM). ETH/USD not needed in v1.

### Transaction flows
1. Stake MDM: if `MDM.allowance(user, Core) < amount` → `MDM.approve(Core, amount)` (exact by default, "unlimited" opt-in) → `Core.stake(amount)`.
2. Unstake MDM: `requestUnstake(amount)` where `amount ≤ stakes.amount − stakes.lockedAmount`; show `unlockTimestamp`; `claimUnstaked()` once any item matured (claims all matured).
3. Claim rewards: `claimRewards()` when `pendingRewards > 0`.
4. Check out: amount ≥ `MIN_CHECKOUT` (0.01), `quoteCheckOut(mcu) ≤ free sMDM`, positions < `MAX_POSITIONS`; `checkOut(mcu)`.
5. Check in: `mcu ≤ MCU.balanceOf(user)` and user has open positions; `checkIn(mcu)` (best rate first, releases the recorded sMDM).
6. Stake MCU: approve MCU to Vault if needed → `Vault.stake(amount)`. Unstake: `requestUnstake(amount)` (≤ eligible), 24 h, `claimUnstaked()`.
Every write: simulate first (`simulateContract`) so revert names become plain sentences before the wallet opens; show a stepper Approve → Action → Confirmed; refresh reads on receipt; toast with Basescan link, same verb as the button ("Stake" → "Staked").

### Error copy (contract error → sentence)
InsufficientFreeStake "You only have X sMDM free; the rest is locked behind MCU." · BelowMinimumCheckout "Check out at least 0.01 MCU." · ExceedsReserve / ReserveTooThin "The curve cannot supply that much MCU right now." · TooManyPositions "You already have 100 open positions; check some in first." · NoOpenPositions "You have no MCU positions to check in." · GenesisRestrictedAccount "This wallet cannot stake or check out." · PausedFlag "Staking is paused by the guardian; exits still work." · NothingToClaim "Nothing has finished thawing yet." · NotLive "The protocol is not live yet." · ERC20InsufficientBalance "You do not have that much." · InsufficientStake (vault) "You only have X MCU eligible."

## Design
- Direction: the dashboard as a compute instrument. Hero = epoch meter: split-flap countdown to 00:00 UTC + today's credit battery (one cell per staked MCU, `eligibleBalance`). Below: MDM as a ledger with hairline rules (no card grid); MCU check-out with the bonding curve drawn to scale from live reserves; MCU vault; queues as draining rings.
- Surfaces: Night (true black `#000`, sheets `#0C0D12` / `#15161D`) is the default; Day (cool paper `#EEF2F7`, ink `#0B1B3F`) toggle. Signal ultramarine (`#0A3DFF` day / `#5B86FF` night) only for actions; amber (`#F5B300` / `#FFC53D`) only for credit/energy; ice blue for thawing; green/red semantic.
- Type: Bricolage Grotesque (display, numbers) + Instrument Sans (body); tabular numerals everywhere.
- Finish: "Object" (tactile): 10 px radius on controls, 1 px top light, colored shadow under the primary button, hover lift, spring on press. Focus ring visible. `prefers-reduced-motion` turns all animation off.
- Honesty features that beat the reference: free vs locked sMDM shown separately; the forgone-rewards cost of a check-out shown live ("gives up about $X/day of staking rewards"); rate change scheduled for Oct 4 shown on the curve; queue items with exact unlock time in the user's zone and UTC; paused flags surfaced.
- ReactBits set (ported into the repo, TS + Tailwind variants, Motion for springs): Split Flap Text (clock), Count Up / Counter (numbers), Elastic Slider (amounts), Stepper (tx flow), Spotlight Card (position cards), Star Border (Claim when rewards > 0), Magnet + Click Spark (primary buttons), Animated List (queues, history), Pill Nav (top nav; Dock on phones), Magic Bento (Protocol page), Dot Field + Noise (hero texture), Shiny Text ("Ready to claim"). Excluded: cursors, aurora/liquid backgrounds, glitch texts, heavy 3D.

## Architecture
- Next.js 16 (App Router, TypeScript, Tailwind v4), wagmi v2 + viem + TanStack Query, RainbowKit for wallet connect (Base only), Motion (framer-motion v12) for springs. No backend: all reads via multicall against a fallback list of public Base RPCs (`NEXT_PUBLIC_RPC_URLS`, comma-separated; an Alchemy URL first when available).
- `src/lib/contracts/` addresses + ABIs; `src/lib/protocol.ts` pure math (curve quote, emission, APR, forgone rewards, epoch countdown) with unit tests; `src/hooks/` typed read hooks (one multicall per screen, refetch every 12 s and on receipt) and write hooks (simulate → write → wait → invalidate); `src/components/ui/` the ReactBits ports and base controls; `src/app/` routes: `/` (Stake + MCU, the hero), `/positions`, `/protocol`, `/a/[address]` read-only.
- Env: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_RPC_URLS`.

## Verification
Unit tests for `protocol.ts` (vitest). Playwright: pages render at 1300 and 390 px, light and dark, no console errors, no horizontal overflow, wallet-less read-only view of a real address shows live numbers. Manual: one real transaction of each kind from the owner's wallet on the Vercel deployment, checked on Basescan.

## Deploy
Vercel project `mordiem-stake-ui` from the GitHub repo (new repo under the owner's account), production from `main`; preview per branch.
