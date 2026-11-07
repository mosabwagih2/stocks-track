import { Fragment, useEffect, useState, type ReactNode } from 'react';

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, o?: { timeout?: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/** Runs `step` once the browser has painted and is quiet, always within `timeout` ms. */
export function whenIdle(step: () => void, timeout = 120): () => void {
  const w = window as IdleWindow;
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(step, { timeout });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = setTimeout(step, 50);
  return () => clearTimeout(id);
}

/** true once the page has painted and the browser had a quiet moment */
export function useIdle(timeout = 150): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => whenIdle(() => setReady(true), timeout), [timeout]);
  return ready;
}

/**
 * How many of `total` items to render right now. The first `chunk` appear immediately,
 * the rest are added a chunk per quiet moment, so opening a long page never blocks the screen.
 */
export function useProgressive(total: number, chunk = 6): number {
  const [n, setN] = useState(() => Math.min(chunk, total));
  // a new (filtered) list starts over from the first chunk
  useEffect(() => setN(Math.min(chunk, total)), [total, chunk]);
  useEffect(() => {
    if (n >= total) return;
    return whenIdle(() => setN((x) => Math.min(total, x + chunk)));
  }, [n, total, chunk]);
  return n;
}

/** Shows an empty box of roughly the right size, then the real content once the browser is quiet. */
export function Deferred({ children, minHeight = 260, className }: { children: ReactNode; minHeight?: number; className?: string }) {
  const ready = useIdle();
  if (ready) return <>{children}</>;
  return <div aria-hidden="true" className={className} style={{ minHeight }} />;
}

/** Renders a long list a few items per quiet moment, so a long page never blocks the screen when it opens. */
export function Progressive<T>({ items, chunk = 6, render }: { items: T[]; chunk?: number; render: (item: T, i: number) => ReactNode }) {
  const n = useProgressive(items.length, chunk);
  return <>{items.slice(0, n).map((it, i) => <Fragment key={i}>{render(it, i)}</Fragment>)}</>;
}
