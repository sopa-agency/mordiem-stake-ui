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
  Multicall3: '0xcA11bde05977b3631167028862bE2a173976CA11' as Address,
} as const;

export const BASESCAN = 'https://basescan.org';
export const txUrl = (hash: string) => `${BASESCAN}/tx/${hash}`;
export const addrUrl = (a: string) => `${BASESCAN}/address/${a}`;

/** The one scheduled change we know about: Timelock adjustReserve(+28,500 MCU), executable 2026-10-04 00:05:27 UTC. */
export const SCHEDULED_RESERVE_CHANGE = { deltaMcu: 28_500, executableAt: 1791158727 } as const;
