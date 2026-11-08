import type { Order } from './types';

/**
 * The channel's settlement sheet (تسوية): one row per order the courier closed, with the amounts, and the totals:
 *   sales (what customers paid) − net = the shipping company's fees; net = Fémini's due + Vendoor's due.
 * Shipped (scanned out) and collected (the money came) are two different things: this is where the second one comes from.
 */
export interface SettleRow {
  ref: string;            // Code = البوليصة
  serial: string;         // Serial = رقم الأوردر
  /** collect: delivered and paid. return: refused, came back (delivery status 5). partial: delivered with a part returned or
   *  exchanged (a return row with status 3, no money on it). adjust: a correction (negative pieces or share, e.g. "فرق تحصيل"):
   *  counted in the money, does not mark an order collected. */
  type: 'collect' | 'return' | 'partial' | 'adjust' | 'other';
  status: number;         // Order delivery status (3 delivered, 5 returned)
  total: number;          // Total amount (paid by the customer)
  fees: number;           // Total fees
  cod: number;            // Cod (net)
  supply: number;         // إجمالي التوريد في الأوردر (your share of this order)
  pieces: number | null;  // عدد القطع في الاوردر
  date: string;           // collect or return date, yyyy-mm-dd
  note: string;           // Statusnote
}
export interface Settlement {
  id: string;             // STL-0001
  date: string;           // the settlement's day: always from its name ("تسوية Femini-G- 5-11-2026", or the file name)
  title: string; source: string; at: string; by: string;
  /** set when the name's date was wrong and the sheet's own line was used */
  dateNote?: string;
  /** sales: customers paid. cod: net after the shipping fees. shipping = sales − cod. due: Fémini's. vendoor: Vendoor's (cod − due). */
  totals: { sales: number; cod: number; shipping: number; due: number; vendoor: number };
  rows: SettleRow[];
}

const MONTHS: Record<string, number> = { يناير: 1, فبراير: 2, مارس: 3, ابريل: 4, مايو: 5, يونيو: 6, يوليو: 7, اغسطس: 8, سبتمبر: 9, اكتوبر: 10, نوفمبر: 11, ديسمبر: 12 };
const num = (v: unknown): number => { if (typeof v === 'number') return v; const n = Number(String(v ?? '').replace(/[,\s\u00a0]/g, '')); return Number.isFinite(n) ? n : 0; };
const txt = (v: unknown): string => String(v ?? '').replace(/\u00a0/g, ' ').trim();
/** "04/11/2026" or "4-11-2026" → "2026-11-04" */
/** a real calendar day (31-11 does not exist) */
const real = (y: number, m: number, d: number) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
export function dayOf(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(+v)) return v.toISOString().slice(0, 10);
  const m = /(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(txt(v)); if (m) return real(+m[3], +m[2], +m[1]) ? iso(+m[3], +m[2], +m[1]) : '';
  const i = /^(\d{4})-(\d{2})-(\d{2})/.exec(txt(v)); return i ? `${i[1]}-${i[2]}-${i[3]}` : '';
}

/** Reads the sheet (rows of cells). Throws with an Arabic message when it is not a settlement sheet. */
export function parseSettlement(aoa: unknown[][], fileName = ''): Omit<Settlement, 'id' | 'source' | 'at' | 'by'> {
  const hi = aoa.findIndex((r) => r.some((c) => txt(c) === 'Code') && r.some((c) => txt(c) === 'Type'));
  if (hi < 0) throw new Error('الملف ده مش شيت تسوية: مفيش أعمدة Code و Type.');
  const head = aoa[hi].map(txt); const col = (name: string) => head.indexOf(name);
  const ix = { code: col('Code'), serial: col('Serial'), type: col('Type'), status: col('Order delivery status'), total: col('Total amount'), fees: col('Total fees'), cod: col('Cod'), cdate: col('Collect date'), rdate: col('Return date'), note: col('Statusnote'),
    pieces: head.findIndex((h) => h.includes('عدد القطع')), supply: head.findIndex((h) => h.includes('إجمالي التوريد')) };
  const rows: SettleRow[] = [];
  for (const r of aoa.slice(hi + 1)) {
    const ref = txt(r[ix.code]); if (!ref) continue;
    const t = txt(r[ix.type]).toLowerCase();
    const pcs = ix.pieces >= 0 ? txt(r[ix.pieces]) : ''; const share = ix.supply >= 0 ? num(r[ix.supply]) : 0;
    const status = num(r[ix.status]);
    const type: SettleRow['type'] = t === 'collect' ? (share < 0 || num(pcs) < 0 ? 'adjust' : 'collect') : t === 'return' ? (status === 3 ? 'partial' : 'return') : 'other';
    rows.push({ ref, serial: txt(r[ix.serial]), type, status, total: num(r[ix.total]), fees: num(r[ix.fees]), cod: num(r[ix.cod]), supply: share,
      pieces: pcs === '' || pcs === '-' ? null : num(pcs), date: dayOf(type === 'return' ? r[ix.rdate] : r[ix.cdate]) || dayOf(r[ix.cdate]) || dayOf(r[ix.rdate]), note: txt(r[ix.note]) });
  }
  if (!rows.length) throw new Error('الشيت مفيهوش أوردرات.');
  // the totals block on the left: a label with its amount on the same row
  const label = (re: RegExp): number | null => { for (const r of aoa) { const i = r.findIndex((c) => re.test(txt(c))); if (i >= 0) { const v = r.slice(0, i).find((c) => typeof c === 'number' || /^-?[\d,.]+$/.test(txt(c))); if (v !== undefined) return num(v); } } return null; };
  const sales = label(/^إجمالي المبيعات$/) ?? rows.reduce((a, x) => a + (x.type === 'collect' ? x.total : 0), 0);
  const cod = rows.reduce((a, x) => a + x.cod, 0);
  const due = label(/^المبلغ المستحق (?!لفيندور)/) ?? label(/^الإجمالي للمبيعات$/) ?? rows.reduce((a, x) => a + x.supply, 0);
  const vendoor = label(/^المبلغ المستحق لفيندور/) ?? cod - due;
  // the settlement's day is in its name: the title cell ("تسوية Femini-G- 5-11-2026"), else the file name ("… 05-11-2026 تسوية …")
  const title = txt(aoa.slice(0, hi).flat().find((c) => /تسوية/.test(txt(c)))) || '';
  // …checked against the sheet's own line "توريد يوم 31 أكتوبر": when the name holds a day that does not exist or another day
  // (a sheet named 31-11 for 31 October), that line wins, with the year of the name
  const named = dayOf(title) || dayOf(fileName);
  const year = Number(/(\d{4})/.exec(`${title} ${fileName}`)?.[1]) || 0;
  const said = (() => {
    const cell = aoa.flat().map(txt).find((c) => /^توريد يوم \d{1,2} /.test(c)); if (!cell || !year) return '';
    const mm = /^توريد يوم (\d{1,2}) (\S+)/.exec(cell)!; const mo = MONTHS[mm[2].replace(/[إأآ]/g, 'ا')];
    return mo && real(year, mo, +mm[1]) ? iso(year, mo, +mm[1]) : '';
  })();
  const date = said && said !== named ? said : named;
  if (!date) throw new Error('مش لاقي تاريخ التسوية في اسم الشيت ولا اسم الملف (زي "تسوية Femini-G- 5-11-2026").');
  const dateNote = said && named && said !== named ? `اسم الشيت فيه ${named}، بس الشيت نفسه بيقول "${aoa.flat().map(txt).find((c) => /^توريد يوم/.test(c))}": اتسجلت بتاريخ ${said}.` : !named && said ? `اسم الشيت فيه تاريخ مش موجود؛ اتسجلت بتاريخ ${said} من الشيت نفسه.` : '';
  return { title, date, dateNote, totals: { sales, cod, shipping: sales - cod, due, vendoor }, rows };
}

/** Per order: collected (with which settlement and how much), or returned per the courier. Later settlements win. */
export interface Collected { stl: string; date: string; cod: number; due: number }
export function collectedOf(settles: Settlement[]): { collected: Map<string, Collected>; returned: Map<string, string> } {
  const collected = new Map<string, Collected>(); const returned = new Map<string, string>();
  for (const s of [...settles].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    for (const r of s.rows) {
      if (r.type === 'collect') {
        const prev = collected.get(r.ref);   // collected once; a second row for the same order adds its amounts
        collected.set(r.ref, prev ? { ...prev, cod: prev.cod + r.cod, due: prev.due + r.supply } : { stl: s.id, date: r.date || s.date, cod: r.cod, due: r.supply });
        returned.delete(r.ref);
      } else if ((r.type === 'return' || r.type === 'partial') && !collected.has(r.ref)) returned.set(r.ref, s.id);
    }
  }
  return { collected, returned };
}

/** What a new sheet would add: orders matched in the system, old orders, unknown codes, and rows already recorded. */
export function previewSettlement(p: Omit<Settlement, 'id' | 'source' | 'at' | 'by'>, orders: Order[], oldRefs: Set<string>, existing: Settlement[]) {
  const byRef = new Map(orders.map((o) => [o.ref, o]));
  const seen = new Set(existing.flatMap((s) => s.rows.map((r) => `${r.ref}|${r.type}|${r.cod}|${r.supply}`)));
  const dup = p.rows.filter((r) => seen.has(`${r.ref}|${r.type}|${r.cod}|${r.supply}`));
  const inSystem = p.rows.filter((r) => byRef.has(r.ref)); const old = p.rows.filter((r) => !byRef.has(r.ref) && oldRefs.has(r.ref));
  const unknown = p.rows.filter((r) => !byRef.has(r.ref) && !oldRefs.has(r.ref));
  const notShipped = inSystem.filter((r) => r.type === 'collect' && byRef.get(r.ref)!.status !== 'shipped');
  const n = (t: SettleRow['type']) => p.rows.filter((r) => r.type === t).length;
  return { rows: p.rows.length, collect: n('collect'), ret: n('return'), partial: n('partial'), adjust: n('adjust'), inSystem: inSystem.length, old: old.length, unknown, notShipped, dup: dup.length, allDup: dup.length === p.rows.length };
}
