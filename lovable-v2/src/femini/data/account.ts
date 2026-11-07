import { useSyncExternalStore } from 'react';
import { setActor } from './repo';

/** The signed-in team account's name, used as "who did it" on every operation and as the scanning employee.
 * It is a label, not a permission: signing in grants no stock role. Not signed in → null (the old default name is used). */
let current: string | null = null;
const listeners = new Set<() => void>();
let started = false;

type U = { email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined;
const nameOf = (u: U): string | null => {
  const m = u?.user_metadata ?? {};
  const n = [m.full_name, m.name, m.display_name].find((x) => typeof x === 'string' && x.trim()) as string | undefined;
  return (n ?? u?.email ?? '').trim() || null;
};
function set(n: string | null) { current = n; setActor(n); listeners.forEach((f) => f()); }

/** Starts following the sign-in state once, in the browser only (SSR has no session). */
export function startAccount() {
  if (started || typeof window === 'undefined') return; started = true;
  void import('@/integrations/supabase/client').then(({ supabase }) => {
    void supabase.auth.getUser().then(({ data }) => set(nameOf(data.user))).catch(() => set(null));
    supabase.auth.onAuthStateChange((_e, session) => set(nameOf(session?.user)));
  }).catch(() => { /* sign-in not configured: keep the default name */ });
}

export function useAccountName(): string | null {
  startAccount();
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => current, () => null);
}
