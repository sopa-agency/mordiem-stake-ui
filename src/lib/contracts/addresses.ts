// Mordiem protocol on Base (chainId 8453). Verified against Blockscout on 2026-09-25 (whale monitor recon).
import type { Address } from 'viem';

export const CHAIN_ID = 8453;

export const ADDR = {
  MDM: '0xe2eF6eA8cB5ef092f068416Ff8f9727EB2586ec9' as Address, // ERC-20 + permit; emission + buyback burn
  MCU: '0xfF54ad785ffCc0F8D11EF13D43EA297D729FD5d3' as Address, // ERC-20 + permit; Core mints on check-out, burns on check-in
  Core: '0x0ed8f4b731EF82E89e18E5aab5Bf8dF4EB36c30d' as Address, // MordiemCore: sMDM staking, emission, check-out curve
  Vault: '0xB6765cE268e0A4b5966062F7c22B4418eE086962' as Address, // MCUVault: stake MCU for daily credit, 24 h thaw
  Treasury: '0x4Fc939f9F80025FE022410dd628ea404b7F0012F' as Address,
  Ledger: '0x1d18476ca88a3C1B35BF83fF2dB4ac5648Ec59eb' as Address, // BuybackLedger (burn totals)
  Pool: '0x4f4f9ce72933292958E7CdE445Bc57F889378085' as Address, // Aerodrome vAMM USDC/MDM: token0 USDC (6 dp), token1 MDM
  CapitalManager: '0x6b6c05ee7F49d00E63e74A9426D74EF9614F6a0f' as Address, // capital pools: deposit, 7-day withdraw thaw, MDM rewards
  Multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11' as Address,
} as const;

export const BASESCAN = 'https://basescan.org';
export const txUrl = (hash: string) => `${BASESCAN}/tx/${hash}`;
export const addrUrl = (a: string) => `${BASESCAN}/address/${a}`;

/** The one scheduled change we know about: Timelock adjustReserve(+28,500 MCU), executable 2026-10-04 00:05:27 UTC. */
export const SCHEDULED_RESERVE_CHANGE = { deltaMcu: 28_500, executableAt: 1791072327 } as const;

/** Capital pool assets in CapitalManager order. wstETH principal is kept in stETH-wei by the contract (the adapter converts). */
export const CAPITAL_ASSETS = [
  { sym: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address, decimals: 6, venue: 'Aave V3 on Base', adapter: '0x5E52E70f98E0d963060a97E2e833fFd3bD65163A' as Address },
  { sym: 'wstETH', address: '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452' as Address, decimals: 18, venue: 'Held in contract (Lido rate)', adapter: '0x9970111aF532E5D2114A15372D2371BEC401278a' as Address },
  { sym: 'MOR', address: '0x7431ada8a591c955a994a21710752ef9b882b8e3' as Address, decimals: 18, venue: 'Morpheus builder subnets (weekly rotation)', adapter: '0xd0CC02C9820037D905876d44929B76a02678B8F4' as Address },
  { sym: 'VVV', address: '0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf' as Address, decimals: 18, venue: 'Venice staking (one shared cooldown)', adapter: '0x8527cD2AB44de200E3C548b5DE6C78Bb9D3C2521' as Address },
] as const;
export type CapitalSym = (typeof CAPITAL_ASSETS)[number]['sym'];
