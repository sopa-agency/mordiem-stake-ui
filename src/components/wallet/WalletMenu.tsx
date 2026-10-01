'use client';
// Wallet control, dependency-free (no RainbowKit). Tokens only: sheet / ink / rule / signal.
// Disconnected: "Connect wallet" → sheet listing connectors. Connected: address chip (copy) → menu.
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from 'wagmi';
import type { Connector } from 'wagmi';
import { CHAIN_ID, addrUrl } from '@/lib/contracts/addresses';
import { explainError } from '@/lib/errors';

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Human name for a connector; the generic injected one reads "Browser wallet". */
function connectorLabel(c: Connector): string {
  if (c.id === 'injected' || c.name === 'Injected') return 'Browser wallet';
  return c.name;
}

/** Hide the generic injected entry when EIP-6963 already announced named browser wallets. */
function visibleConnectors(all: readonly Connector[]): Connector[] {
  const named = all.filter((c) => c.type === 'injected' && c.id !== 'injected');
  return all.filter((c) => !(c.id === 'injected' && named.length > 0));
}

// SSR renders the disconnected control; this guard keeps the first client paint identical.
const useMounted = () => useSyncExternalStore(() => () => {}, () => true, () => false);

const control =
  'inline-flex h-10 items-center gap-2 rounded-control px-3.5 text-[13px] font-medium transition ' +
  'duration-200 ease-[var(--ease-out)] select-none focus-visible:outline-2 focus-visible:outline-signal ' +
  'disabled:opacity-60 disabled:pointer-events-none';
const primary = `${control} bg-signal text-signal-ink edge shadow-[var(--glow)] hover:bg-signal-2 hover:-translate-y-px active:translate-y-0`;
const secondary = `${control} bg-sheet-2 text-ink border border-rule edge hover:bg-sheet-3 hover:-translate-y-px active:translate-y-0`;
const sheet = 'absolute right-0 z-50 mt-2 min-w-[260px] rounded-[var(--radius-sheet)] border border-rule bg-sheet p-1.5 text-ink lift edge';
const item = 'flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-[13px] text-ink hover:bg-sheet-2 focus-visible:bg-sheet-2 transition';

export function WalletMenu({ className = '' }: { className?: string }) {
  const mounted = useMounted();
  const conn = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Close on outside click and Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onConnect = useCallback((c: Connector) => {
    setError(undefined);
    connect.mutate({ connector: c, chainId: CHAIN_ID }, {
      onError: (e) => setError(explainError(e)),
      onSuccess: () => setOpen(false),
    });
  }, [connect]);

  const onCopy = useCallback(async () => {
    if (!conn.address) return;
    if (await copyText(conn.address)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    }
  }, [conn.address]);

  const onSwitch = useCallback(() => {
    setError(undefined);
    switchChain.mutate({ chainId: CHAIN_ID }, { onError: (e) => setError(explainError(e)) });
  }, [switchChain]);

  const connected = mounted && conn.status === 'connected' && !!conn.address;
  const wrongChain = connected && conn.chainId !== CHAIN_ID;

  // Disconnected (and SSR / first paint)
  if (!connected) {
    const busy = mounted && (conn.status === 'connecting' || conn.status === 'reconnecting' || connect.isPending);
    return (
      <div ref={rootRef} className={`relative ${className}`}>
        <button
          type="button"
          className={primary}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          aria-busy={busy || undefined}
          disabled={!mounted}
          onClick={() => setOpen((v) => !v)}
        >
          <Dot className={busy ? 'bg-signal-ink/60 animate-pulse' : 'bg-signal-ink/60'} />
          {busy && conn.status === 'reconnecting' ? 'Reconnecting…' : connect.isPending ? 'Confirm in wallet…' : 'Connect wallet'}
        </button>
        {open && (
          <div id={menuId} role="menu" className={sheet}>
            <p className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-[0.08em] text-ink-3">Connect with</p>
            {visibleConnectors(connectors).map((c) => (
              <button key={c.uid} type="button" role="menuitem" className={item} onClick={() => onConnect(c)} disabled={connect.isPending}>
                {c.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.icon} alt="" width={20} height={20} className="h-5 w-5 rounded-[5px]" />
                ) : (
                  <span className="grid h-5 w-5 place-items-center rounded-[5px] bg-sheet-3 text-[10px] font-semibold text-ink-2">
                    {connectorLabel(c).slice(0, 1)}
                  </span>
                )}
                <span className="flex-1">{connectorLabel(c)}</span>
                {connect.isPending && connect.variables?.connector === c && <span className="text-[11px] text-ink-3">Waiting…</span>}
              </button>
            ))}
            {visibleConnectors(connectors).length === 0 && (
              <p className="px-3 py-2 text-[13px] text-ink-2">No wallet found. Install a browser wallet or open this page inside one.</p>
            )}
            <div className="mt-1 flex items-center gap-2 border-t border-rule-2 px-3 pb-1.5 pt-2.5 text-[12px] text-ink-3">
              <Dot className="bg-signal" />
              Base network
            </div>
            {error && <p role="alert" className="px-3 pb-2 text-[12px] text-bad">{error}</p>}
          </div>
        )}
      </div>
    );
  }

  // Connected
  const address = conn.address as `0x${string}`;
  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        {wrongChain ? (
          <button type="button" className={primary} onClick={onSwitch} disabled={switchChain.isPending} aria-busy={switchChain.isPending || undefined}>
            <Dot className="bg-signal-ink/60" />
            {switchChain.isPending ? 'Confirm in wallet…' : 'Switch to Base'}
          </button>
        ) : (
          <button type="button" className={`${secondary} num`} onClick={onCopy} title="Copy address" aria-live="polite">
            <Dot className="bg-good" />
            {copied ? 'Copied' : shortAddress(address)}
          </button>
        )}
        <button
          type="button"
          className={`${secondary} w-10 justify-center px-0`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label="Wallet menu"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="text-ink-2">
            <path d="M3 5.5 7 9.5l4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {open && (
        <div id={menuId} role="menu" className={sheet}>
          <div className="px-3 pb-2 pt-2">
            <p className="text-[11px] uppercase tracking-[0.08em] text-ink-3">{conn.connector?.name ?? 'Wallet'}</p>
            <p className="num mt-0.5 break-all text-[12px] text-ink-2">{address}</p>
          </div>
          {wrongChain && (
            <button type="button" role="menuitem" className={`${item} text-signal`} onClick={onSwitch}>
              Switch to Base
            </button>
          )}
          <button type="button" role="menuitem" className={item} onClick={onCopy}>
            {copied ? 'Copied' : 'Copy address'}
          </button>
          <a role="menuitem" className={item} href={addrUrl(address)} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
            View on Basescan
            <span aria-hidden="true" className="ml-auto text-ink-3">↗</span>
          </a>
          <button
            type="button"
            role="menuitem"
            className={`${item} text-bad`}
            onClick={() => { disconnect.mutate(undefined, { onSettled: () => setOpen(false) }); }}
          >
            Disconnect
          </button>
          {error && <p role="alert" className="px-3 pb-2 pt-1 text-[12px] text-bad">{error}</p>}
        </div>
      )}
    </div>
  );
}

function Dot({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block h-1.5 w-1.5 rounded-full ${className}`} />;
}

export default WalletMenu;
