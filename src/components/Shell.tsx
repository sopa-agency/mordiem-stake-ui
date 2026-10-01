'use client';
// App shell: wordmark + PillNav (Dock on phones), surface toggle, wallet; toasts; footer with the live price and contract links.
import { useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dock, PillNav, SurfaceToggle, ToastProvider } from '@/components/ui';
import { WalletMenu } from '@/components/wallet/WalletMenu';
import { useProtocol } from '@/hooks/useProtocol';
import { useSurface } from '@/hooks/useSurface';
import { ADDR, addrUrl } from '@/lib/contracts/addresses';
import { mdmPriceUsd } from '@/lib/protocol';

const NAV = [
  { href: '/', label: 'Stake', icon: <IconStake /> },
  { href: '/positions', label: 'Positions', icon: <IconPositions /> },
  { href: '/protocol', label: 'Protocol', icon: <IconProtocol /> },
];

const MQ = '(min-width: 720px)';
const subscribeMq = (cb: () => void) => {
  const m = window.matchMedia(MQ);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
/** Toast offset: clear the Dock on phones. */
const useToastOffset = () => useSyncExternalStore(subscribeMq, () => (window.matchMedia(MQ).matches ? 16 : 88), () => 88);

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const { surface, toggle } = useSurface();
  const offset = useToastOffset();
  return (
    <ToastProvider offset={offset}>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 border-b border-rule-2 bg-paper/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-4 min-[720px]:px-8">
            <div className="flex min-w-0 items-center gap-5">
              <Link href="/" className="font-display shrink-0 text-[18px] font-bold tracking-tight text-ink">
                Mordiem Stake
              </Link>
              <PillNav items={NAV} current={pathname} className="hidden min-[720px]:block" />
            </div>
            <div className="flex items-center gap-2.5 min-[720px]:gap-3">
              <SurfaceToggle surface={surface} onToggle={toggle} />
              <WalletMenu />
            </div>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-8 px-4 pb-10 pt-6 min-[720px]:px-8 min-[720px]:gap-10 min-[720px]:pt-8">{children}</main>
        <Footer />
        <Dock items={NAV} current={pathname} />
      </div>
    </ToastProvider>
  );
}

function Footer() {
  const { data } = useProtocol();
  const price = data ? mdmPriceUsd(data.poolUsdc, data.poolMdm) : null;
  const links: [string, string][] = [
    ['MDM', ADDR.MDM],
    ['MCU', ADDR.MCU],
    ['Core', ADDR.Core],
    ['Vault', ADDR.Vault],
  ];
  return (
    <footer className="border-t border-rule-2">
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pb-28 pt-5 text-[12px] text-ink-3 min-[720px]:px-8 min-[720px]:pb-6">
        <p className="num">
          Reads Base every 12 s · MDM {price !== null ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '…'} (Aerodrome pool) · Open source
        </p>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {links.map(([name, addr]) => (
            <li key={name}>
              <a href={addrUrl(addr)} target="_blank" rel="noreferrer" className="num hover:text-ink-2">
                {name} <span className="text-ink-3/70">{addr.slice(0, 6)}…{addr.slice(-4)}</span> ↗
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}

function IconStake() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 13l7 4 7-4M3 9l7 4 7-4M3 5l7 4 7-4" />
    </svg>
  );
}
function IconPositions() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="14" height="12" rx="2" />
      <path d="M3 9h14M8 9v7" />
    </svg>
  );
}
function IconProtocol() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 16c4-9 10-9 14-1" />
      <circle cx="10" cy="10" r="7" />
    </svg>
  );
}
