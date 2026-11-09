import type { Doc, Move, Order, Snapshot } from './types';
import { TYPE_AR } from './constants';
import { cairoDay } from './dates';

/**
 * The log of one operation: everything the data links to it, in time order, one short line each. Pure. Nothing is
 * stored as a separate log; it is read back from the records the operation left:
 *  - the operation itself (its pieces; where they went only when that is not obvious from its kind)
 *  - supplies taken off by it, orders it shipped / returned / cancelled, waybills it names
 *  - files uploaded for it, the signed shop note, other operations that name it, and its reversal
 */
export type LogKind = 'create' | 'supply' | 'order' | 'file' | 'deliver' | 'reverse' | 'link';
export interface LogEntry { at: string; by: string; kind: LogKind; label: string; detail: string; qty?: number; ref?: string; type?: string }

type Snap = Pick<Snapshot, 'moves' | 'supplyLog' | 'supplies' | 'orders' | 'archivedPickups' | 'files' | 'docs'>;

/** short state names, as in the ledger */
export const SHORT: Record<string, string> = { READY: 'جاهز', DIRTY: 'نظافة', FACTORY: 'المصنع', SCRAP: 'هالك', LOST: 'مفقود', EXT_OPEN: 'افتتاحي', EXT_FACTORY: 'المصنع', EXT_CH: 'العميل', EXT_SHOP: 'المحل', EXT_ADJ: 'جرد', EXT_OFF: 'شطب', EXT_HOLD: 'هولد' };
const short = (l: string) => SHORT[l] ?? l;

/**
 * Where the pieces went, only when it says something: one flow between «جاهز» and an outside place (a shop supply,
 * a receipt, a scan, a customer return) is what the operation's name already says, so it is left out.
 */
export function flowText(moves: { from: string; to: string; qty: number }[]): string {
  const by = new Map<string, number>(); for (const m of moves) by.set(`${m.from}>${m.to}`, (by.get(`${m.from}>${m.to}`) ?? 0) + m.qty);
  const flows = [...by].map(([k, q]) => { const [from, to] = k.split('>'); return { from, to, q }; }).sort((a, b) => b.q - a.q);
  if (!flows.length) return '';
  if (flows.length === 1) {
    const { from, to } = flows[0];
    const obvious = (from === 'READY' && to.startsWith('EXT_')) || (to === 'READY' && from.startsWith('EXT_'));
    return obvious ? '' : `${short(from)} ← ${short(to)}`;
  }
  return flows.slice(0, 3).map((f) => `${short(f.from)} ← ${short(f.to)} ${f.q}`).join('، ') + (flows.length > 3 ? ' …' : '');
}

export function docLog(s: Snap, doc: Doc): LogEntry[] {
  const out: LogEntry[] = []; const rev = `${doc.no} (عكس)`; const kind = TYPE_AR[doc.type] ?? doc.type;
  const moves = s.moves.filter((m) => m.doc === doc.no); const back = s.moves.filter((m) => m.doc === rev);
  const sum = (ms: Move[]) => ms.reduce((a, m) => a + m.qty, 0) / (doc.type === 'SWP' ? 2 : 1);
  // a count's lines hold no quantity: what it moved is the better number
  const pieces = Number(doc.hdr.pieces ?? (moves.length ? sum(moves) : doc.lines.reduce((a, l) => a + l.qty, 0)));
  // its own time; else its first move's, when that is on the same day (a restore can stamp moves later)
  const first = [...moves].sort((a, b) => a.ts.localeCompare(b.ts))[0];
  const at = String(doc.hdr.at ?? (first && cairoDay(first.ts) === doc.date ? first.ts : doc.date));
  out.push({ at, by: doc.by, kind: 'create', label: kind, detail: flowText(moves), qty: pieces, type: doc.type });

  const name = (id: string) => s.supplies.find((x) => x.id === id)?.name ?? id;
  for (const e of s.supplyLog.filter((x) => x.doc === doc.no || x.doc === rev)) {
    out.push({ at: e.date, by: e.by, kind: 'supply', label: e.doc === rev ? 'رجوع مستلزمات' : 'مستلزمات', detail: name(e.item), qty: Math.abs(e.qty) });
  }

  const orders: Order[] = [...s.orders, ...(s.archivedPickups ?? []).flatMap((a) => a.orders)];
  const list = (refs: string[]) => refs.slice(0, 5).join('، ') + (refs.length > 5 ? ` و${refs.length - 5} كمان` : '');
  const shipped = orders.filter((o) => o.shipDoc === doc.no);
  if (shipped.length) {
    const at = shipped.map((o) => o.shippedAt ?? '').filter(Boolean).sort()[0] ?? doc.date;
    out.push({ at, by: shipped[0].shippedBy ?? doc.by, kind: 'order', label: `${shipped.length} أوردر`, detail: list(shipped.map((o) => o.ref)) });
  }
  for (const o of orders.filter((x) => x.returned?.doc === doc.no)) out.push({ at: o.returned!.at, by: doc.by, kind: 'order', label: 'مرتجع', detail: o.ref, ref: o.ref });
  for (const o of orders.filter((x) => x.cancel?.doc === doc.no)) out.push({ at: o.cancel!.at, by: o.cancel!.by, kind: 'order', label: 'إلغاء', detail: o.ref + (o.cancel!.reason ? ` · ${o.cancel!.reason}` : ''), ref: o.ref });
  // waybills the operation names that no order record links back (e.g. a return typed in by hand for an old order)
  const named = new Set([...shipped, ...orders.filter((x) => x.returned?.doc === doc.no || x.cancel?.doc === doc.no)].flatMap((o) => [o.ref, o.waybill]));
  const refs = (Array.isArray(doc.hdr.refs) ? (doc.hdr.refs as unknown[]) : []).map(String).filter((r) => !named.has(r.replace(/^man:/, '')));
  if (refs.length) out.push({ at: String(doc.hdr.at ?? doc.date), by: doc.by, kind: 'order', label: refs.length === 1 ? 'بوليصة' : `${refs.length} بوليصة`, detail: list(refs.map((r) => (r.startsWith('man:') ? `${r.slice(4)} (يدوي)` : r))) });

  for (const f of s.files.filter((x) => x.owner === doc.no)) out.push({ at: f.at, by: '', kind: 'file', label: 'ملف', detail: f.name });
  if (doc.hdr.deliveredAt) out.push({ at: String(doc.hdr.deliveredAt), by: String(doc.hdr.deliveredBy ?? ''), kind: 'deliver', label: 'اتسلم للمحل', detail: 'صورة الإذن الموقّع' });

  for (const x of s.docs) {
    if (x.no === doc.no) continue;
    if (Object.values(x.hdr).some((v) => v === doc.no || (Array.isArray(v) && v.includes(doc.no)))) {
      out.push({ at: String(x.hdr.at ?? x.date), by: x.by, kind: 'link', label: TYPE_AR[x.type] ?? x.type, detail: x.no, ref: x.no, type: x.type });
    }
  }

  if (back.length || doc.status === 'reversed') {
    const at = [...back].sort((a, b) => a.ts.localeCompare(b.ts))[0];
    out.push({ at: at?.ts ?? '', by: at?.by ?? '', kind: 'reverse', label: 'اتعكست', detail: flowText(back), qty: back.length ? sum(back) : undefined });
  }
  // time order; entries with no time keep their place at the end
  return out.map((e, i) => ({ e, i })).sort((a, b) => (a.e.at && b.e.at ? a.e.at.localeCompare(b.e.at) : a.e.at ? -1 : b.e.at ? 1 : 0) || a.i - b.i).map((x) => x.e);
}
