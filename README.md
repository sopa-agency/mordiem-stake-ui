# Mordiem Stake

A community dashboard for the [Mordiem](https://mordiem.com) protocol on Base: stake MDM, check MCU out and in, stake MCU for daily API credit, and lend to the capital pools. Every number is read from the contracts; every cost of a move is shown before you sign.

**Live:** https://mordiem-stake-ui.vercel.app

## What it does

| Tab | What you can do |
|---|---|
| Overview | Countdown to the midnight-UTC epoch, today's credit, your statement (staked, free, locked, rewards, capital, thawing) and your MCU positions |
| Stake · MDM | Stake MDM (1:1 into sMDM), request unstake (7-day thaw), claim thawed MDM, claim rewards |
| Stake · Capital pools | Deposit USDC, wstETH, MOR or VVV, request withdraw (7 days), claim, claim MDM rewards; each pool's share of the capital emission |
| MCU | Check MCU out against free sMDM on the live bonding curve (drawn to scale), check it back in; shows what the lock gives up in staking rewards |
| Credit | Stake MCU in the vault ($1 of API credit per MCU per day), request unstake (24 h), claim |
| Protocol | Emission, staking totals, curve and reserves, market, buyback, pause flags |
| `/a/<address>` | Read-only view of any wallet |

Transactions are simulated before the wallet opens, so a revert comes back as a plain sentence ("You only have 0.54 sMDM free; the rest is locked behind MCU"). Approvals are exact by default, with an "unlimited" opt-in.

## Contracts (Base, chain id 8453)

| | Address |
|---|---|
| MDM | `0xe2eF6eA8cB5ef092f068416Ff8f9727EB2586ec9` |
| MCU | `0xfF54ad785ffCc0F8D11EF13D43EA297D729FD5d3` |
| MordiemCore (sMDM staking, emission, check-out curve) | `0x0ed8f4b731EF82E89e18E5aab5Bf8dF4EB36c30d` |
| MCUVault (daily credit) | `0xB6765cE268e0A4b5966062F7c22B4418eE086962` |
| CapitalManager (capital pools) | `0x6b6c05ee7F49d00E63e74A9426D74EF9614F6a0f` |
| Aerodrome vAMM USDC/MDM (price) | `0x4f4f9ce72933292958E7CdE445Bc57F889378085` |

ABIs in `src/lib/contracts/abis/` come from the verified implementations behind the proxies. The protocol math in `src/lib/protocol.ts` (emission `t(t+1)/2`, the curve quote with the contract's ceil rounding, thaw math) is unit-tested against the verified sources.

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # vitest: protocol math, error mapping, transaction plans
pnpm build
```

Optional `.env.local`:

```
NEXT_PUBLIC_RPC_URLS=https://your-rpc,https://mainnet.base.org   # tried in order; public Base RPCs by default
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...                           # enables WalletConnect (QR); injected and Coinbase wallets work without it
```

Browser checks (desktop and phone, both surfaces, no console errors, no overflow, live numbers):

```bash
node tests/e2e.mjs http://localhost:3000
```

## Stack

Next.js 16 (App Router), TypeScript, Tailwind v4, wagmi 3 + viem 2, Motion. No backend: the browser reads Base directly through one multicall per screen, every 12 s. Components are ports of [ReactBits](https://reactbits.dev) ideas restyled to the project's tokens; Night (true black) and Day surfaces.

## Honest by design

- Free and locked sMDM are shown separately; locked earns half.
- The check-out panel shows the staking rewards you give up while sMDM is locked, at the live price.
- The scheduled reserve change (Timelock, +28,500 MCU) is shown on the curve until it executes.
- No venue APYs are invented for the capital pools; you see each pool's share of the emission and its MDM per day.

## Not financial advice

This is an independent, read-and-sign interface to publicly deployed contracts. It holds no keys and takes no fees. Smart contracts can have bugs and parameters can change through the protocol's timelock; read the contracts and the [Mordiem docs](https://mordiem.com) before committing funds.

## License

MIT.
