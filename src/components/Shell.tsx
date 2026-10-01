'use client';
// App shell: wordmark + PillNav (Dock on phones), surface toggle, wallet; toasts; one-line footer.
import { useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dock, PillNav, SurfaceToggle, ToastProvider } from '@/components/ui';
import { WalletMenu } from '@/components/wallet/WalletMenu';
import { VladGuide } from '@/components/VladGuide';
import { useProtocol } from '@/hooks/useProtocol';
import { useSurface } from '@/hooks/useSurface';
import { ADDR, addrUrl } from '@/lib/contracts/addresses';
import { mdmPriceUsd } from '@/lib/protocol';

const NAV = [
  { href: '/', label: 'Overview', icon: <IconOverview /> },
  { href: '/stake', label: 'Stake', icon: <IconStake /> },
  { href: '/mcu', label: 'MCU', icon: <IconMcu /> },
  { href: '/credit', label: 'Credit', icon: <IconCredit /> },
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
        <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-8 px-4 pb-10 pt-6 min-[720px]:px-8 min-[720px]:gap-10 min-[720px]:pt-8">
          {children}
          <VladGuide key={pathname} />
        </main>
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
      <p className="num mx-auto w-full max-w-[1200px] px-4 pb-28 pt-5 text-[12px] leading-relaxed text-ink-3 min-[720px]:px-8 min-[720px]:pb-6">
        Reads Base every 12 s · MDM {price !== null ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '…'} (Aerodrome pool) · <a href="https://github.com/sopa-agency/mordiem-stake-ui" target="_blank" rel="noreferrer" className="hover:text-ink-2">Open source ↗</a> · Contracts on Basescan:{' '}
        {links.map(([name, addr], i) => (
          <span key={name}>
            {i > 0 && ' · '}
            <a href={addrUrl(addr)} target="_blank" rel="noreferrer" className="hover:text-ink-2">
              {name} ↗
            </a>
          </span>
        ))}
      </p>
    </footer>
  );
}

const icon = { viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

function IconOverview() {
  return (
    <svg {...icon}>
      <rect x="3" y="3" width="6" height="6" rx="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1.5" />
    </svg>
  );
}
function IconStake() {
  return (
    <svg {...icon}>
      <path d="M3 13l7 4 7-4M3 9l7 4 7-4M3 5l7 4 7-4" />
    </svg>
  );
}
function IconMcu() {
  return (
    <svg {...icon}>
      <rect x="5" y="5" width="10" height="10" rx="2" />
      <path d="M8 2v3M12 2v3M8 15v3M12 15v3M2 8h3M2 12h3M15 8h3M15 12h3" />
    </svg>
  );
}
function IconCredit() {
  return (
    <svg {...icon}>
      <path d="M11 2L4 11h6l-1 7 7-9h-6l1-7z" />
    </svg>
  );
}
function IconProtocol() {
  return (
    <svg {...icon}>
      <path d="M3 16c4-9 10-9 14-1" />
      <circle cx="10" cy="10" r="7" />
    </svg>
  );
}
