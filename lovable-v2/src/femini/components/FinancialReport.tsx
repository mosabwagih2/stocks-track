import type { Snapshot } from '@/femini/domain/types';
import { financialReport } from '@/femini/domain/reports';
import { Alert, Button, Kpi, TableWrap, th, td } from './ui';
import { fmt } from '@/femini/cn';
import { useNavigate } from '@/femini/router';
import type { ExportSheet } from '@/femini/insights-tools';

const money = (n: number) => new Intl.NumberFormat('ar-EG-u-nu-latn', { maximumFractionDigits: 2 }).format(n);
export function financialSheets(s: Snapshot): ExportSheet[] {
  const r = financialReport(s);
  return [{ name: 'قيمة المخزون', rows: [['التقييم بالتكلفة المسجلة حاليًا؛ ليس أرباحًا ولا تقييمًا تاريخيًا'], ['الموديل', 'التكلفة', 'جاهز', 'نظافة', 'عند المصنع', 'هالك', 'مفقود', 'قيمة الجاهز', 'قيمة الهالك', 'قيمة المفقود'], ...r.rows.map((x) => [x.code, x.cost ?? 'غير مسجلة', x.units.READY, x.units.DIRTY, x.units.FACTORY, x.units.SCRAP, x.units.LOST, x.cost === null ? 'غير محسوبة' : x.units.READY * x.cost, x.cost === null ? 'غير محسوبة' : x.units.SCRAP * x.cost, x.cost === null ? 'غير محسوبة' : x.units.LOST * x.cost])] }, { name: 'بيانات ناقصة', rows: [['البيان', 'التفاصيل'], ...r.missing.map((x) => ['تكلفة غير مسجلة', x.code]), ...r.unknown.map((x) => ['صنف غير معروف', x]), ...r.negative.map((x) => ['رصيد سالب يحتاج مراجعة', x]), ['الأرباح غير محسوبة', 'لا توجد تكلفة تاريخية مؤكدة أو تحصيلات فعلية أو مصروفات شحن وعمولات وضرائب.'], ['المستلزمات', 'غير مشمولة؛ تكلفتها غير مسجلة.']] }];
}
export function FinancialReport({ s }: { s: Snapshot }) {
  const r = financialReport(s); const nav = useNavigate();
  return <div className="grid gap-5">
    <div><h2 className="text-lg font-semibold">قيمة المخزون</h2><p className="mt-1 text-sm text-muted">الرصيد الحالي × تكلفة القطعة المسجلة حاليًا · جنيه مصري</p></div>
    <Alert tone={r.missing.length || r.unknown.length || r.negative.length ? 'warn' : 'info'}>القيم تخص الموديلات ذات التكلفة المسجلة فقط؛ الهالك والمفقود منفصلان عن المخزون القابل للاسترداد. {r.missing.length > 0 && `تكلفة ${r.missing.length} موديل غير مكتملة.`} {r.negative.length > 0 && `${r.negative.length} صنف برصيد سالب يحتاج مراجعة قبل اعتماد التقرير.`} {r.unknown.length > 0 && `${r.unknown.length} صنف غير معروف وغير مشمول بالتقييم.`}</Alert>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['جاهز للبيع', r.ready], ['نظافة وعند المصنع', { units: r.dirty.units + r.factory.units, known: r.dirty.known + r.factory.known, missing: r.dirty.missing + r.factory.missing }], ['هالك بالتكلفة', r.scrap], ['مفقود بالتكلفة', r.lost]].map(([label, value]) => { if (typeof value === 'string' || typeof label !== 'string') return null; return <Kpi key={label} label={label} value={`${money(value.known)} ج.م`} sub={`${fmt(value.units)} قطعة · ${value.missing ? 'تقييم جزئي' : 'بالتكلفة المسجلة'}`} />; })}</div>
    <TableWrap><table className="text-sm"><thead><tr>{['الموديل', 'تكلفة القطعة', 'قيمة الجاهز', 'قيمة الهالك', 'قيمة المفقود'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead><tbody>{r.rows.map((x) => <tr key={x.code}><td className={td}><b>{x.code}</b><span className="block text-xs text-muted">{x.name}</span></td><td className={td}>{x.cost === null ? <span className="text-warn">غير مسجلة</span> : money(x.cost)}</td>{(['READY', 'SCRAP', 'LOST'] as const).map((loc) => <td key={loc} className={td}>{x.cost === null ? '—' : money(x.units[loc] * x.cost)}<span className="block text-xs text-muted">{fmt(x.units[loc])} قطعة</span></td>)}</tr>)}</tbody></table></TableWrap>
    <section className="border-t border-line pt-4"><h3 className="font-semibold">ما ينقص لاعتماد الأرقام</h3><p className="mt-2 text-sm text-muted">الأرباح غير محسوبة: تحصيلات البيع الفعلية، التكلفة التاريخية، الشحن والعمولات والخصومات والضرائب غير متوفرة. المستلزمات غير مشمولة لعدم تسجيل تكلفتها.</p>{r.missing.length > 0 && <p className="my-2 text-sm text-warn">تكلفة ناقصة: {r.missing.map((x) => x.code).join('، ')}</p>}<Button className="mt-3 print:hidden" onClick={() => nav('/settings')}>استكمال تكلفة الموديلات</Button></section>
  </div>;
}