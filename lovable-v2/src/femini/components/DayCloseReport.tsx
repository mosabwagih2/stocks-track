import { LOC_AR } from '@/femini/domain/constants';
import type { Snapshot } from '@/femini/domain/types';
import { dayReport } from '@/femini/domain/reports';
import { dayLabel } from '@/femini/domain/dates';
import { Alert, Button, Kpi, TableWrap, th, td } from './ui';
import { exportExcel, type ExportSheet } from '@/femini/insights-tools';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { fmt } from '@/femini/cn';
import { useToast } from './toast';

export const DAY_LABELS: Record<string, string> = { requested: 'قطع مطلوبة', shipped: 'قطع مشحونة (صافي)', returned: 'مرتجعات القنوات', received: 'استلام توريد', ready: 'جاهز نهاية اليوم', damaged: 'رصيد الهالك والمفقود' };
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
export function DayCloseReport({ s, date }: { s: Snapshot; date: string }) {
  const r = dayReport(s, date); const toast = useToast();
  const closed = s.closes.filter((c) => c.date === date && c.status === 'closed').at(-1);
  const summary = closed?.summary ?? r.summary;
  const details = closed?.report ?? r;
  const status = closed ? `مقفول بواسطة ${closed.by} · ${new Date(closed.at).toLocaleString('ar-EG-u-nu-latn')}` : 'معاينة قبل القفل';
  const sheets: ExportSheet[] = [{ name: 'ملخص اليوم', rows: [['الحالة', status], ['المؤشر', 'العدد'], ...Object.entries(summary).map(([k, n]) => [DAY_LABELS[k] ?? k, n]), ['أوردرات واردة', details.requestedOrders], ['أوردرات مفتوحة بنهاية اليوم', details.open], ['أوردرات متوقفة', details.blocked]] }, { name: 'الفريق', rows: [['الموظف', 'صافي القطع المشحونة'], ...details.team] }, { name: 'الحركات', rows: [['رقم الحركة', 'المستند', 'الصنف', 'من', 'إلى', 'الكمية', 'الموظف'], ...r.moves.map((m) => [m.id, m.doc, m.sku, m.from, m.to, m.qty, m.by])] }];
  const print = () => {
    const w = window.open('', '_blank'); if (!w) { toast('اسمح بفتح نافذة التقرير للطباعة', { tone: 'err' }); return; }
    const styles = Array.from(document.querySelectorAll('style,link[rel="stylesheet"]')).map((e) => e.outerHTML).join('');
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>قفل يوم ${esc(date)} · Fémini Stock</title>${styles}</head><body class="bg-surface text-ink p-8"><header class="mb-6 border-b border-line pb-4"><h1 class="text-2xl font-semibold">Fémini Stock · تقرير قفل اليوم</h1><p>${esc(dayLabel(date))}</p><p>${esc(status)}</p></header>${sheets.map((sheet) => `<section class="mb-6"><h2 class="mb-3 text-lg font-semibold">${esc(sheet.name)}</h2><table class="w-full text-sm"><tbody>${sheet.rows.map((row) => `<tr>${row.map((cell) => `<td class="border-b border-line px-3 py-2 text-start">${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`).join('')}<p class="text-xs text-muted">الحركات حسب تاريخ التسجيل الفعلي. الحالات التاريخية للأوردرات بحسب المعلومات المحفوظة؛ قد يكون تاريخ العكس غير مكتمل في النسخ القديمة.</p></body></html>`);
    w.document.close(); w.onload = () => { void w.document.fonts.ready.then(() => w.print()); };
  };
  return <section className="grid gap-4" aria-label="ملخص قفل اليوم">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">{dayLabel(date)}</h3><p className="mt-1 text-xs text-muted">{status}</p></div><div className="flex gap-2"><Button onClick={print}><FileDown className="size-4" />طباعة / PDF</Button><Button onClick={() => exportExcel({ section: 'قفل اليوم', period: date, filters: status, date: s.today }, sheets).then(() => toast('تم تصدير تقرير اليوم'), () => toast('تعذّر التصدير', { tone: 'err' }))}><FileSpreadsheet className="size-4" />Excel</Button></div></div>
    <div className="grid grid-cols-2 gap-3">{Object.entries(summary).map(([k, n]) => <Kpi key={k} label={DAY_LABELS[k] ?? k} value={fmt(n)} />)}</div>
    <Alert tone={details.open || details.blocked ? 'warn' : 'good'}>{details.requestedOrders} أوردر وارد · {details.open} مفتوح بنهاية اليوم · {details.blocked} متوقف بسبب المخزون</Alert>
    <p className="text-xs text-muted">الشحن حسب يوم الخروج الفعلي لا تاريخ البيك أب. الحالات التاريخية للأوردرات بحسب المعلومات المحفوظة؛ قد يكون تاريخ العكس غير مكتمل في النسخ القديمة.</p>
    <TableWrap><table className="text-sm"><thead><tr><th className={th}>الموظف</th><th className={th}>صافي القطع المشحونة</th></tr></thead><tbody>{details.team.map(([name,n]) => <tr key={name}><td className={td}>{name}</td><td className={td}>{fmt(n)}</td></tr>)}</tbody></table></TableWrap>
    <details><summary className="cursor-pointer font-semibold">حركات اليوم ({r.moves.length})</summary><TableWrap className="mt-3"><table className="text-sm"><thead><tr>{['المستند','الصنف','من','إلى','قطع','بواسطة'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead><tbody>{r.moves.map((m) => <tr key={m.id}><td className={td}>{m.doc}</td><td className={td}>{m.sku}</td><td className={td}>{LOC_AR[m.from] ?? m.from}</td><td className={td}>{LOC_AR[m.to] ?? m.to}</td><td className={td}>{m.qty}</td><td className={td}>{m.by}</td></tr>)}</tbody></table></TableWrap></details>
  </section>;
}