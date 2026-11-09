import { collectedOf } from '@/femini/domain/settle';
import { serverEdition } from '@/femini/data';
import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { repo } from '@/femini/data';
import { useToast } from '@/femini/components/toast';
import { allocate } from '@/femini/domain/orders';
import { addDays, cairoToday } from '@/femini/domain/dates';
import { friendlyError } from '@/femini/data/errors';
import type { Balances, Model, Order, Snapshot, Sku } from '@/femini/domain/types';

export const SNAP_KEY = ['snapshot'] as const;

export function useSnapshot() {
  // server edition: other people's work shows up by itself every 15 s (one small pull of what changed)
  return useQuery({ queryKey: SNAP_KEY, queryFn: () => repo.snapshot(), staleTime: 15_000, refetchOnWindowFocus: true, refetchInterval: serverEdition ? 15_000 : false });
}

/** Today in Cairo. Re-checked every 30 s so the work day rolls over at midnight by itself. */
export function useToday(): string {
  const qc = useQueryClient();
  const { data } = useSnapshot();
  const now = cairoToday();
  useEffect(() => {
    const t = setInterval(() => { if (cairoToday() !== now) qc.invalidateQueries({ queryKey: SNAP_KEY }); }, 30_000);
    return () => clearInterval(t);
  }, [now, qc]);
  return data?.today && data.today > now ? data.today : now;
}

export interface Derived {
  snap: Snapshot;
  today: string;
  skuMap: Map<string, Sku>;
  modelMap: Map<string, Model>;
  orderMap: Map<string, Order>;
  pickupDate: Map<string, string>;
  /** orders the channel's settlement sheets say were collected (the money came), and returned per the courier */
  collected: Map<string, import('@/femini/domain/settle').Collected>; settleReturned: Map<string, string>;
  open: Order[];
  blocked: ReturnType<typeof allocate>['blocked'];
  demand: Record<string, number>;
  /** pieces per day per sku over the lookback window */
  velocity: Record<string, number>;
  velocityOK: boolean;
  days: number;
  /** models sorted by pieces requested (most pulled first) */
  modelsByPull: string[];
  /** every model, grouped by product line (PAN, SH, BR…) and ordered by what is pulled: for the model pickers */
  modelOrder: string[];
  pull: Record<string, number>;
}

export function useDerived(): { d: Derived | null; isLoading: boolean; error: unknown } {
  const { data, isLoading, error } = useSnapshot();
  const today = useToday();
  const d = useMemo<Derived | null>(() => {
    if (!data) return null;
    const skuMap = new Map(data.skus.map((s) => [s.id, s]));
    const modelMap = new Map(data.models.map((m) => [m.code, m]));
    const orderMap = new Map(data.orders.map((o) => [o.ref, o]));
    const pickupDate = new Map(data.pickups.map((p) => [p.id, p.date]));
    const open = data.orders.filter((o) => o.status === 'open');
    const { blocked, demand } = allocate(open, data.pickups, data.balances);
    const from = addDays(today, -13); const dset = new Set<string>(); const velocity: Record<string, number> = {}; const pull: Record<string, number> = {};
    for (const o of data.orders) {
      if (o.status === 'cancelled') continue;
      const dt = pickupDate.get(o.pickupId); if (!dt || dt > today || dt < from) continue;
      dset.add(dt);
      for (const s of o.lines) { velocity[s] = (velocity[s] ?? 0) + 1; const m = skuMap.get(s)?.model; if (m) pull[m] = (pull[m] ?? 0) + 1; }
    }
    const days = dset.size; const span = days ? Math.max(1, Math.round((Date.parse(today) - Date.parse([...dset].sort()[0])) / 864e5) + 1) : 1;
    for (const k in velocity) velocity[k] /= span;
    const modelsByPull = data.models.map((m) => m.code).sort((a, b) => (pull[b] ?? 0) - (pull[a] ?? 0) || a.localeCompare(b, 'en', { numeric: true }));
    const modelOrder = orderModels(data.models.map((m) => m.code), pull, stockOf(data.skus, data.balances));
    const { collected, returned: settleReturned } = collectedOf(data.settles ?? []);
    return { snap: data, today, skuMap, modelMap, orderMap, pickupDate, collected, settleReturned, open, blocked, demand, velocity, velocityOK: days >= 3, days, modelsByPull, modelOrder, pull };
  }, [data, today]);
  return { d, isLoading, error };
}

/** Runs a command, refreshes the data, and reports the result as a toast. Safe to call after the caller unmounted (toast undo). */
export function useAct() {
  const qc = useQueryClient();
  const toast = useToast();
  return useCallback(
    async <T,>(fn: () => Promise<T>, ok: string | ((r: T) => string), opts?: { undo?: (r: T) => void }): Promise<T | undefined> => {
      try {
        const r = await fn();
        await qc.invalidateQueries({ queryKey: SNAP_KEY });
        toast(typeof ok === 'function' ? ok(r) : ok, opts?.undo ? { undo: () => opts.undo!(r) } : undefined);
        return r;
      } catch (e) {
        toast(friendlyError(e), { tone: 'err' });
        return undefined;
      }
    },
    [qc, toast],
  );
}

/** Ready-to-sell pieces per model. */
function stockOf(skus: { id: string; model: string }[], balances: Balances) {
  const r: Record<string, number> = {};
  for (const k of skus) r[k.model] = (r[k.model] ?? 0) + Math.max(0, balances[k.id]?.READY ?? 0);
  return r;
}

/** The product line of a model code: its letters before the number ("PAN6" → PAN, "BR12" → BR, "A1" → A). */
export const lineCode = (m: string) => /^[A-Z]+/.exec(m)?.[0] ?? m;

/** Models grouped by line, the most pulled line first; inside a line the most pulled first, then stock, then the number. */
export function orderModels(codes: string[], pull: Record<string, number>, stock: Record<string, number>) {
  const linePull: Record<string, number> = {}; const lineStock: Record<string, number> = {};
  for (const c of codes) { const l = lineCode(c); linePull[l] = (linePull[l] ?? 0) + (pull[c] ?? 0); lineStock[l] = (lineStock[l] ?? 0) + (stock[c] ?? 0); }
  const num = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });
  return [...codes].sort((a, b) => {
    const la = lineCode(a); const lb = lineCode(b);
    if (la !== lb) return (linePull[lb] ?? 0) - (linePull[la] ?? 0) || (lineStock[lb] ?? 0) - (lineStock[la] ?? 0) || num(la, lb);
    return (pull[b] ?? 0) - (pull[a] ?? 0) || (stock[b] ?? 0) - (stock[a] ?? 0) || num(a, b);
  });
}
