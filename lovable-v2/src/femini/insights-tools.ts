import { addDays } from '@/femini/domain/dates';
import { locTotal, qty } from '@/femini/domain/ledger';
import { dailyUse, supplyBalance, supplyStatus } from '@/femini/domain/supplies';
import { skuLabel } from '@/femini/domain/orders';
import type { Derived } from '@/femini/hooks/data';

export const PERIODS = [7, 14, 30] as const;
export type Period = (typeof PERIODS)[number];

const cairoDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date(iso));

export interface Window { from: string; to: string; orders: number; pieces: number; shipped: number; shippedPcs: number; cancelled: number; rate: number }
export interface DayRow { day: string; req: number; pcs: number; ship: number; shipPcs: number }

/** Requested = orders whose pickup falls in the window; shipped = orders scanned in the window. */
function windowStats(d: Derived, from: string, to: string): { w: Window; days: DayRow[] } {
  const n = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
  const rows: Record<string, DayRow> = {};
  for (let i = 0; i < n; i++) { const k = addDays(from, i); rows[k] = { day: k, req: 0, pcs: 0, ship: 0, shipPcs: 0 }; }
  let cancelled = 0;
  for (const o of d.snap.orders) {
    const pd = d.pickupDate.get(o.pickupId);
    if (o.status === 'cancelled') { if (pd && rows[pd]) cancelled++; continue; }
    if (pd && rows[pd]) { rows[pd].req++; rows[pd].pcs += o.lines.length; }
    if (o.status === 'shipped' && o.shippedAt) { const sd = cairoDay(o.shippedAt); if (rows[sd]) { rows[sd].ship++; rows[sd].shipPcs += o.lines.length; } }
  }
  const days = Object.values(rows);
  const sum = (k: keyof Omit<DayRow, 'day'>) => days.reduce((a, r) => a + r[k], 0);
  const orders = sum('req'), shipped = sum('ship');
  return { w: { from, to, orders, pieces: sum('pcs'), shipped, shippedPcs: sum('shipPcs'), cancelled, rate: orders ? Math.round((Math.min(shipped, orders) / orders) * 100) : 0 }, days };
}

/** a chosen window of days (both ends included) */
export type { Range } from './domain/range';
import type { Range } from './domain/range';
export const rangeDays = (r: Range) => Math.round((Date.parse(r.to) - Date.parse(r.from)) / 864e5) + 1;
export const lastDays = (today: string, n: number): Range => ({ from: addDays(today, -(n - 1)), to: today });

/** the chosen window against the same number of days right before it */
export function comparePeriods(d: Derived, p: Period | Range) {
  const r = typeof p === 'number' ? lastDays(d.today, p) : p; const n = rangeDays(r);
  const curFrom = r.from; const prevTo = addDays(curFrom, -1); const prevFrom = addDays(prevTo, -(n - 1));
  const cur = windowStats(d, curFrom, r.to); const prev = windowStats(d, prevFrom, prevTo);
  return { cur: cur.w, prev: prev.w, curDays: cur.days, prevDays: prev.days };
}

/** % change, or null when the previous period has nothing to compare with. */
export const change = (cur: number, prev: number): number | null => (prev ? Math.round(((cur - prev) / prev) * 100) : null);

export type AlertLevel = 'crit' | 'warn' | 'info';
export interface RiskAlert { level: AlertLevel; title: string; body: string; to: string; cta: string }

/**
 * An alert opens the exact work, not a page to search in: the operation already filled with the items it is about
 * (Operations reads `skus`). Capped so the address stays short; the form shows the rest are not included.
 */
export const OP_PREFILL_MAX = 80;
export const opLink = (op: string, skus: string[]) => `/operations?op=${op}&skus=${encodeURIComponent(skus.slice(0, OP_PREFILL_MAX).join(','))}`;
const inLoc = (d: Derived, loc: 'LOST' | 'DIRTY') => [...d.snap.skus, ...(d.snap.archivedSkus ?? [])].filter((s) => qty(d.snap.balances, s.id, loc) > 0).map((s) => s.id);

/** Signals that need a quick decision. Uses the same rules as the rest of the app (ledger balances, allocation, supply status). */
export function riskAlerts(d: Derived, cmp: ReturnType<typeof comparePeriods>): RiskAlert[] {
  const out: RiskAlert[] = [];
  const b = d.snap.balances;
  const neg = d.snap.skus.filter((s) => qty(b, s.id, 'READY') < 0);
  if (neg.length) out.push({ level: 'crit', title: `رصيد سالب في ${neg.length} صنف`, body: `شُحن أكثر من الموجود، مثل ${skuLabel(d.skuMap, neg[0].id)}. أجرِ جردًا وصحّح الرصيد.`, to: opLink('CNT', neg.map((x) => x.id)), cta: 'جرد الأصناف دي' });
  if (d.blocked.size) out.push({ level: 'crit', title: `${d.blocked.size} أوردر متوقف بسبب نقص الرصيد`, body: 'كل أوردر يُشحن كاملًا، فنقص قطعة واحدة يوقفه.', to: '/orders?f=blocked', cta: 'عرض الأوردرات' });
  const out0 = d.snap.skus.filter((s) => qty(b, s.id, 'READY') <= 0 && (d.demand[s.id] ?? 0) > 0);
  if (out0.length) out.push({ level: 'crit', title: `${out0.length} صنف نفد وعليه طلب مفتوح`, body: out0.slice(0, 3).map((s) => skuLabel(d.skuMap, s.id)).join('، '), to: '/insights?sheet=out', cta: 'عرض الأصناف' });
  const low = d.snap.skus.filter((s) => { const r = qty(b, s.id, 'READY'); const v = d.velocity[s.id] ?? 0; return r > 0 && v > 0 && r / v < 3; });
  if (low.length) out.push({ level: 'warn', title: `${low.length} صنف يكفي أقل من 3 أيام`, body: `بحسب سرعة السحب الحالية${d.velocityOK ? '' : ' (تقديرية)'}: ${low.slice(0, 3).map((s) => skuLabel(d.skuMap, s.id)).join('، ')}.`, to: '/insights?sheet=low', cta: 'عرض الأصناف' });
  const supLow = d.snap.supplies.filter((s) => !s.archived && supplyStatus(s, supplyBalance(d.snap.supplyLog, s.id), dailyUse(d.snap.supplyLog, s.id, d.today)) !== 'good');
  if (supLow.length) out.push({ level: supLow.some((s) => supplyBalance(d.snap.supplyLog, s.id) <= 0) ? 'crit' : 'warn', title: `مستلزمات منخفضة: ${supLow.map((s) => s.name).join('، ')}`, body: 'تحت حد التنبيه أو تكفي أقل من 7 أيام.', to: '/stock?view=supplies', cta: 'المستلزمات' });
  const old = d.open.filter((o) => (d.pickupDate.get(o.pickupId) ?? d.today) < addDays(d.today, -1));
  if (old.length) out.push({ level: 'warn', title: `${old.length} أوردر عمره أكثر من يوم ولم يُشحن`, body: 'راجع سبب التأخير قبل أن يُلغى من القناة.', to: '/orders?f=wait', cta: 'الأوردرات المنتظرة' });
  const lost = locTotal(b, 'LOST'); if (lost > 0) out.push({ level: 'warn', title: `${lost} قطعة مفقودة بانتظار التسوية`, body: 'قرّر: وُجدت أم تُشطب نهائيًا.', to: opLink('LOS', inLoc(d, 'LOST')), cta: 'معالجة المفقود' });
  const dirty = locTotal(b, 'DIRTY'); if (dirty > 0) out.push({ level: 'info', title: `${dirty} قطعة هالك نظافة`, body: 'أرسلها للمصنع للغسيل لتعود جاهزة للبيع.', to: opLink('FSD', inLoc(d, 'DIRTY')), cta: 'إرسال للمصنع' });
  if (cmp.prev.pieces && cmp.cur.pieces > cmp.prev.pieces * 1.5) out.push({ level: 'info', title: 'قفزة في الطلب', body: `الطلب زاد ${change(cmp.cur.pieces, cmp.prev.pieces)}% عن الفترة السابقة. تأكد من كفاية المخزون.`, to: '/insights?tab=demand', cta: 'تحليل الطلب' });
  if (cmp.prev.orders && cmp.cur.rate < cmp.prev.rate - 15) out.push({ level: 'warn', title: 'انخفاض نسبة الشحن', body: `${cmp.cur.rate}% مقابل ${cmp.prev.rate}% في الفترة السابقة.`, to: '/orders?f=wait', cta: 'الأوردرات المنتظرة' });
  const order = { crit: 0, warn: 1, info: 2 };
  return out.sort((a, b2) => order[a.level] - order[b2.level]);
}

export interface ExportSheet { name: string; rows: (string | number)[][] }

/** Builds the Excel workbook in the browser. The first sheet always carries the period and the active filters. */
export async function exportExcel(meta: { section: string; period: string; filters: string; date: string }, sheets: ExportSheet[]) {
  const X = await import('xlsx');
  const wb = X.utils.book_new();
  const info = X.utils.aoa_to_sheet([['تقرير تحليلات Fémini Stock'], [], ['القسم', meta.section], ['الفترة', meta.period], ['الفلاتر', meta.filters], ['تاريخ التصدير', meta.date]]);
  info['!cols'] = [{ wch: 16 }, { wch: 48 }];
  X.utils.book_append_sheet(wb, info, 'معلومات التقرير');
  for (const s of sheets) {
    const ws = X.utils.aoa_to_sheet(s.rows);
    ws['!cols'] = (s.rows[0] ?? []).map((_, i) => ({ wch: Math.min(40, Math.max(10, ...s.rows.map((r) => String(r[i] ?? '').length + 2))) }));
    X.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  wb.Workbook = { Views: [{ RTL: true }] };
  X.writeFile(wb, `femini-analytics-${meta.date}.xlsx`);
}
