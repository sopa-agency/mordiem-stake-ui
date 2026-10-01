import { createConfig, fallback, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';

const DEFAULT_RPCS = ['https://mainnet.base.org', 'https://base-rpc.publicnode.com', 'https://base.llamarpc.com'];

/** Comma-separated list in NEXT_PUBLIC_RPC_URLS, tried in order (put a private RPC first when you have one). */
export const rpcUrls = (process.env.NEXT_PUBLIC_RPC_URLS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const urls = rpcUrls.length ? rpcUrls : DEFAULT_RPCS;

const wcId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    injected({ shimDisconnect: true }),
    coinbaseWallet({ appName: 'Mordiem Stake', preference: 'all' }),
    // WalletConnect (QR / mobile) only when a Reown project id is configured
    ...(wcId ? [walletConnect({ projectId: wcId, showQrModal: true, metadata: { name: 'Mordiem Stake', description: 'Stake MDM, check out MCU, earn daily API credit', url: 'https://mordiem-stake.vercel.app', icons: [] } })] : []),
  ],
  transports: {
    [base.id]: fallback(urls.map((u) => http(u, { batch: { batchSize: 64, wait: 16 }, retryCount: 3, timeout: 12_000 })), { rank: false }),
  },
  ssr: true,
});

declare module 'wagmi' {
  interface Register { config: typeof wagmiConfig }
}
