import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="edge mx-auto my-10 flex w-full max-w-[560px] flex-col gap-4 rounded-sheet bg-sheet p-8 ring-1 ring-inset ring-rule" aria-label="Not found">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Nothing here</div>
      <h1 className="font-display text-[28px] font-semibold leading-tight text-ink">That address does not resolve</h1>
      <p className="text-[14px] text-ink-2">
        To view a wallet, use <span className="num text-ink">/a/0x…</span> with the full 42-character address. Anything else on this site lives on the three pages below.
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-[14px] font-medium">
        <Link href="/" className="text-signal hover:text-signal-2">Stake</Link>
        <Link href="/positions" className="text-signal hover:text-signal-2">Positions</Link>
        <Link href="/protocol" className="text-signal hover:text-signal-2">Protocol</Link>
      </div>
    </section>
  );
}
