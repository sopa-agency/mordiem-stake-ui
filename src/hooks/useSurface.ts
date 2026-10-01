'use client';
// Night / Day surface. The layout applies the stored value before paint; this hook reads and changes it.
import { useCallback, useSyncExternalStore } from 'react';

export type Surface = 'night' | 'day';

const KEY = 'surface';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(): Surface {
  if (typeof document === 'undefined') return 'night';
  return document.documentElement.dataset.surface === 'day' ? 'day' : 'night';
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Follow changes made elsewhere (another tab, devtools).
  const mo = typeof MutationObserver !== 'undefined'
    ? new MutationObserver(cb)
    : undefined;
  mo?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-surface'] });
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY && (e.newValue === 'day' || e.newValue === 'night')) apply(e.newValue);
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    mo?.disconnect();
    window.removeEventListener('storage', onStorage);
  };
}

function apply(s: Surface) {
  document.documentElement.dataset.surface = s;
  try { localStorage.setItem(KEY, s); } catch { /* private mode */ }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = s === 'day' ? '#EEF2F7' : '#000000';
  emit();
}

export function useSurface(): { surface: Surface; toggle: () => void; set: (s: Surface) => void } {
  const surface = useSyncExternalStore(subscribe, read, () => 'night' as Surface);
  const set = useCallback((s: Surface) => apply(s), []);
  const toggle = useCallback(() => apply(read() === 'day' ? 'night' : 'day'), []);
  return { surface, toggle, set };
}
