import type { Balances, Loc } from './types';
import { qty } from './ledger';
import { LOCS } from './constants';

/** Hold: pieces leave READY to a person (photoshoot, sample, gift…) and later come back fully, partially, or are written off.
 * Ledger: out READY→EXT_HOLD · return EXT_HOLD→READY/DIRTY/SCRAP · write-off EXT_HOLD→EXT_OFF (proof photo required). */
export type HoldReason = 'shoot' | 'sample' | 'gift' | 'other';
export const HOLD_REASON_AR: Record<HoldReason, string> = { shoot: 'عينات تصوير', sample: 'عينة هترجع', gift: 'هدية / إنفلونسر', other: 'سبب آخر' };
export const HOLD_OVERDUE_DAYS = 7;

export interface HoldLine { sku: string; q: number }
export interface HoldEvent { at: string; by: string; kind: 'out' | 'return' | 'writeoff'; lines: (HoldLine & { to?: Loc })[]; photo: string | null; note: string }
export interface Hold { no: string; who: string; note: string; reason: HoldReason; reasonText: string; at: string; date: string; by: string; lines: HoldLine[]; photo: string; events: HoldEvent[]; status: 'open' | 'closed' }
export interface HoldMove { sku: string; qty: number; from: string; to: string; note: string }

const n = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));

/** pieces still outside per sku */
export function outstanding(h: Pick<Hold, 'events'>): Record<string, number> {
  const o: Record<string, number> = {};
  for (const e of h.events) for (const l of e.lines) o[l.sku] = (o[l.sku] ?? 0) + (e.kind === 'out' ? l.q : -l.q);
  for (const k of Object.keys(o)) if (o[k] <= 0) delete o[k];
  return o;
}
export const outstandingTotal = (h: Pick<Hold, 'events'>) => Object.values(outstanding(h)).reduce((a, b) => a + b, 0);
export const daysOut = (h: Pick<Hold, 'at'>, now: Date = new Date()) => Math.floor((now.getTime() - new Date(h.at).getTime()) / 86400000);
export const isOverdue = (h: Hold, now?: Date) => h.status === 'open' && daysOut(h, now) >= HOLD_OVERDUE_DAYS;

export function buildHoldOut(i: { who: string; reason: HoldReason; reasonText?: string; lines: HoldLine[]; hasPhoto: boolean }, b: Balances, name: (s: string) => string = (s) => s) {
  const err: string[] = []; const moves: HoldMove[] = [];
  if (!i.who.trim()) err.push('اكتب اسم الشخص اللي استلم');
  if (i.reason === 'other' && !(i.reasonText ?? '').trim()) err.push('اكتب السبب');
  if (!i.hasPhoto) err.push('صورة إثبات التسليم إجبارية');
  // the same variant on two lines is one request: checked against READY together
  const want: Record<string, number> = {}; for (const l of i.lines) if (n(l.q) > 0) want[l.sku] = (want[l.sku] ?? 0) + n(l.q);
  if (!Object.keys(want).length) err.push('ضيف قطع');
  for (const [sku, q] of Object.entries(want)) {
    const have = qty(b, sku, 'READY');
    if (have < q) err.push(`${name(sku)}: الجاهز ${have} والمطلوب ${q}`);
    moves.push({ sku, qty: q, from: 'READY', to: 'EXT_HOLD', note: `هولد · ${i.who.trim()}` });
  }
  return { ok: !err.length, err, moves };
}

/** settle part or all of a hold: returned pieces (with state) and/or written-off pieces */
export function buildHoldSettle(h: Hold, i: { ret: (HoldLine & { to: Loc })[]; off: HoldLine[]; hasPhoto: boolean }, name: (s: string) => string = (s) => s) {
  const err: string[] = []; const moves: HoldMove[] = [];
  if (h.status !== 'open') err.push('الهولد ده اتقفل');
  const left = outstanding(h); const use: Record<string, number> = {};
  const ret = i.ret.filter((l) => n(l.q) > 0); const off = i.off.filter((l) => n(l.q) > 0);
  if (!ret.length && !off.length) err.push('حدد الراجع أو المخصوم');
  for (const l of [...ret, ...off]) use[l.sku] = (use[l.sku] ?? 0) + n(l.q);
  for (const s of Object.keys(use)) if (use[s] > (left[s] ?? 0)) err.push(`${name(s)}: الباقي برا ${left[s] ?? 0} بس`);
  if (off.length && !i.hasPhoto) err.push('الخصم النهائي مش بيتقفل غير بصورة إثبات');
  // a returned piece must land in a real warehouse state, or it would vanish from the stock
  for (const l of ret) if (!(LOCS as string[]).includes(l.to)) err.push(`${name(l.sku)}: حالة الرجوع غير معروفة`);
  for (const l of ret) moves.push({ sku: l.sku, qty: n(l.q), from: 'EXT_HOLD', to: l.to, note: `رجوع هولد ${h.no} · ${h.who}` });
  for (const l of off) moves.push({ sku: l.sku, qty: n(l.q), from: 'EXT_HOLD', to: 'EXT_OFF', note: `خصم نهائي هولد ${h.no} · ${h.who}` });
  const remaining = Object.values(left).reduce((a, b) => a + b, 0) - Object.values(use).reduce((a, b) => a + b, 0);
  return { ok: !err.length, err, moves, closes: !err.length && remaining <= 0, remaining: Math.max(0, remaining) };
}
