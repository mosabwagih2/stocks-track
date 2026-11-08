import { Link as TLink, useLocation, useNavigate as useTNavigate } from '@tanstack/react-router';
import { useCallback, useMemo, type ReactNode } from 'react';

/** Small bridge so the pages keep their string paths ("/orders?f=wait") on TanStack Router. */
function split(path: string): { to: string; search: Record<string, string> } {
  const [to, q = ''] = path.split('?');
  return { to, search: Object.fromEntries(new URLSearchParams(q)) };
}

export function useNavigate() {
  const nav = useTNavigate();
  return useCallback((path: string) => {
    const { to, search } = split(path);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nav({ to: to as any, search: search as any });
  }, [nav]);
}

export function useSearchParams(): [URLSearchParams, (p: URLSearchParams, o?: { replace?: boolean }) => void] {
  const loc = useLocation();
  const nav = useTNavigate();
  // Read the parsed search, not the raw string: TanStack Router writes a number-like value such as "7" as JSON ("%227%22"),
  // so URLSearchParams on the raw string read back '"7"' and every 7 / 30-day choice fell back to the default.
  const sp = useMemo(() => new URLSearchParams(Object.entries((loc.search ?? {}) as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])), [loc.search]);
  const set = useCallback((p: URLSearchParams, o?: { replace?: boolean }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nav({ to: loc.pathname as any, search: Object.fromEntries(p) as any, replace: o?.replace, resetScroll: false });
  }, [nav, loc.pathname]);
  return [sp, set];
}

export function Link({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  const { to: path, search } = split(to);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <TLink to={path as any} search={search as any} className={className}>{children}</TLink>;
}
