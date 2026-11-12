import { useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import type { Derived } from '@/femini/hooks/data';
import { countReport, type CountDoc } from '@/femini/domain/countReport';
import { costOf } from '@/femini/domain/shop';
import { addDays } from '@/femini/domain/dates';
import { LOC_AR } from '@/femini/domain/constants';
import { skuLabel } from '@/femini/domain/orders';
import { cn, fmt } from '@/femini/cn';
import { Button, Card, Chip, Empty, Kpi, Pill, Seg, Sheet, TableWrap, th, td } from './ui';
import { HBars, C } from './charts';
import { exportExcel } from '@/femini/insights-tools';
import { useToast } from './toast';

const money = (n: number) => new Intl.NumberFormat('ar-EG-u-nu-latn', { maximumFractionDigits: 0 }).format(Math.round(n));
const Egp = ({ v }: { v: number }) => <span dir="rtl" className="inline-flex items-baseline gap-1.5"><span className="num">{money(v)}</span><span className="font-sans text-sm font-medium text-muted">جنيه</span></span>;
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : '0');
type Span = '30' | '90' | 'all';

/** «تقرير الجرد»: every count, what was more, what was less, what matched, at cost. A count opens item by item. */
export function CountReport({ d }: { d: Derived }) {
  const [span, setSpan] = useState<Span>('all'); const [open, setOpen] = useState<string | null>(null);
  const toast = useToast();
  const from = span === 'all' ? '0000-01-01' : addDays(d.today, -(Number(span) - 1));
  const r = useMemo(() => countReport(d.snap, from, d.today), [d, from]);
  const cost = useMemo(() => costOf(d.snap), [d]);
  const name = (s: string) => skuLabel(d.skuMap, s);
  const topLess = [...r.bySku].filter(([, e]) => e.less > 0).sort((a, b) => b[1].less - a[1].less).slice(0, 10);
  const topMore = [...r.bySku].filter(([, e]) => e.more > 0).sort((a, b) => b[1].more - a[1].more).slice(0, 10);
  const models = Object.entries(r.byModel).filter(([, x]) => x.more || x.less).sort((a, b) => b[1].less - a[1].less || b[1].more - a[1].more);
  const net = r.more.value - r.less.value;
  const cur = r.counts.find((x) => x.doc.no === open);
  const excel = () => exportExcel({ section: 'تقرير الجرد', period: span === 'all' ? 'من أول جرد' : `آخر ${span} يوم`, filters: 'بدون', date: d.today }, [
    { name: 'مرات الجرد', rows: [['الرقم', 'التاريخ', 'سجّلها', 'الحالة', 'اتعدّ', 'مطابق', 'أصناف زادت', 'قطع زيادة', 'قيمة الزيادة', 'أصناف نقصت', 'قطع عجز', 'قيمة العجز', 'الصافي'],
      ...r.counts.map((c) => [c.doc.no, c.doc.date, c.doc.by, LOC_AR[c.state] ?? c.state, c.items, c.matched, c.more.items, c.more.pieces, Math.round(c.more.value), c.less.items, c.less.pieces, Math.round(c.less.value), Math.round(c.more.value - c.less.value)])] },
    { name: 'كل الأصناف', rows: [['الرقم', 'التاريخ', 'الصنف', 'على السيستم', 'اتعدّ', 'الفرق', 'القيمة بالتكلفة'],
      ...r.counts.flatMap((c) => c.lines.map((l) => [c.doc.no, c.doc.date, name(l.sku), l.system ?? '', l.counted ?? '', l.diff, Math.round(l.diff * cost(l.sku))]))] },
    { name: 'حسب الموديل', rows: [['الموديل', 'أصناف', 'زيادة', 'عجز', 'الصافي بالتكلفة'], ...models.map(([m, x]) => [m, x.items, x.more, x.less, Math.round(x.value)])] },
  ]).then(() => toast('تم تصدير ملف Excel'), () => toast('تعذّر التصدير', { tone: 'err' }));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">كل مرة جرد: اللي زاد واللي نقص واللي طابق، بالتكلفة المسجلة حاليًا.</p>
        <span className="flex flex-wrap items-center gap-2 print:hidden">
          <Seg<Span> label="الفترة" value={span} onChange={setSpan} options={[['30', '30 يوم'], ['90', '90 يوم'], ['all', 'من أول جرد']]} />
          <Button onClick={excel} disabled={!r.counts.length}><FileSpreadsheet className="size-4" /> Excel</Button>
        </span>
      </div>
      {!r.counts.length ? <Card><Empty>مفيش جرد اتسجّل في الفترة دي.</Empty></Card> : <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="مرات الجرد" value={fmt(r.counts.length)} sub={`آخر جرد ${r.counts[0].doc.date} · ${fmt(r.items)} صنف اتعدّ`} />
          <Kpi label="مطابق" value={`${r.items ? Math.round((r.matched / r.items) * 100) : 0}%`} sub={`${fmt(r.matched)} صنف من ${fmt(r.items)}`} tone="good" />
          <Kpi label="زيادة" value={<Egp v={r.more.value} />} sub={`${fmt(r.more.pieces)} قطعة في ${fmt(r.more.items)} صنف`} tone="warn" />
          <Kpi label="عجز" value={<Egp v={r.less.value} />} sub={`${fmt(r.less.pieces)} قطعة في ${fmt(r.less.items)} صنف · الصافي ${net >= 0 ? '+' : '−'}${money(Math.abs(net))} جنيه`} tone={r.less.pieces ? 'crit' : 'good'} />
        </div>

        <Card title={`كل مرة جرد (${fmt(r.counts.length)})`} hint="الأحدث أول · اضغط على أي جرد لتفاصيله صنف صنف">
          <TableWrap><table className="text-sm"><thead><tr>{['الرقم', 'التاريخ', 'سجّلها', 'الحالة', 'اتعدّ', 'مطابق', 'زيادة', 'عجز', 'الصافي'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{r.counts.map((c) => (
              <tr key={c.doc.no} className="cursor-pointer hover:bg-lav" onClick={() => setOpen(c.doc.no)}>
                <td className={td + ' font-mono text-accent'}>{c.doc.no}</td><td className={td + ' num'}>{c.doc.date}</td><td className={td}>{c.doc.by}</td><td className={td}>{LOC_AR[c.state] ?? c.state}</td>
                <td className={td + ' num'}>{fmt(c.items)}</td><td className={td + ' num'}>{fmt(c.matched)}</td>
                <td className={td}>{c.more.pieces ? <Pill tone="warn">+{fmt(c.more.pieces)} · {fmt(c.more.items)} صنف</Pill> : <span className="text-muted">—</span>}</td>
                <td className={td}>{c.less.pieces ? <Pill tone="crit">−{fmt(c.less.pieces)} · {fmt(c.less.items)} صنف</Pill> : <span className="text-muted">—</span>}</td>
                <td className={td + ' num font-semibold'}>{money(c.more.value - c.less.value)}</td>
              </tr>))}</tbody></table></TableWrap>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="أكتر أصناف فيها عجز" hint="مجموع العجز في كل مرات الجرد">{topLess.length ? <HBars rows={topLess.map(([s, e]) => ({ label: name(s), value: e.less }))} color={C.scrap} unit="قطع" /> : <Empty>مفيش عجز.</Empty>}</Card>
          <Card title="أكتر أصناف فيها زيادة" hint="مجموع الزيادة في كل مرات الجرد">{topMore.length ? <HBars rows={topMore.map(([s, e]) => ({ label: name(s), value: e.more }))} color={C.dirty} unit="قطع" /> : <Empty>مفيش زيادة.</Empty>}</Card>
        </div>

        {models.length > 0 && <Card title="حسب الموديل" hint="الموديلات اللي فيها فرق، الأكتر عجزًا أول">
          <TableWrap><table className="text-sm"><thead><tr>{['الموديل', 'أصناف اتعدّت', 'زيادة', 'عجز', 'الصافي بالتكلفة'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{models.map(([m, x]) => <tr key={m}><td className={td + ' font-mono font-semibold'}>{m}</td><td className={td + ' num'}>{fmt(x.items)}</td><td className={td + ' num'}>{x.more ? `+${fmt(x.more)}` : '—'}</td><td className={td + ' num'}>{x.less ? `−${fmt(x.less)}` : '—'}</td><td className={cn(td, 'num font-semibold', x.value < 0 ? 'text-crit' : '')}>{money(x.value)}</td></tr>)}</tbody></table></TableWrap>
        </Card>}
      </>}
      {cur && <CountSheet d={d} c={cur} cost={cost} onClose={() => setOpen(null)} />}
    </div>
  );
}

function CountSheet({ d, c, cost, onClose }: { d: Derived; c: CountDoc; cost: (sku: string) => number; onClose: () => void }) {
  const [f, setF] = useState<'all' | 'less' | 'more' | 'same'>(c.less.items ? 'less' : c.more.items ? 'more' : 'all');
  const rows = c.lines.filter((l) => f === 'all' || (f === 'less' ? l.diff < 0 : f === 'more' ? l.diff > 0 : l.diff === 0));
  return (
    <Sheet title={`جرد ${c.doc.no} · ${c.doc.date}`} onClose={onClose} wide>
      <p className="text-sm text-muted">{LOC_AR[c.state] ?? c.state} · سجّله {c.doc.by} · اتعدّ {fmt(c.items)} صنف: {fmt(c.matched)} مطابق، {fmt(c.more.items)} زاد ({fmt(c.more.pieces)} قطعة · {money(c.more.value)} جنيه)، {fmt(c.less.items)} نقص ({fmt(c.less.pieces)} قطعة · {money(c.less.value)} جنيه).</p>
      <div className="flex flex-wrap gap-2">
        <Chip pressed={f === 'less'} onClick={() => setF('less')}>عجز · {fmt(c.less.items)}</Chip>
        <Chip pressed={f === 'more'} onClick={() => setF('more')}>زيادة · {fmt(c.more.items)}</Chip>
        <Chip pressed={f === 'same'} onClick={() => setF('same')}>مطابق · {fmt(c.matched)}</Chip>
        <Chip pressed={f === 'all'} onClick={() => setF('all')}>الكل · {fmt(c.items)}</Chip>
      </div>
      {!rows.length ? <Empty>مفيش أصناف هنا.</Empty> : (
        <TableWrap className="max-h-[60vh]"><table className="text-sm"><thead><tr>{['الصنف', 'على السيستم', 'اتعدّ', 'الفرق', 'القيمة بالتكلفة'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((l) => <tr key={l.sku}>
            <td className={td}>{skuLabel(d.skuMap, l.sku)}</td><td className={td + ' num'}>{l.system ?? '—'}</td><td className={td + ' num'}>{l.counted ?? '—'}</td>
            <td className={td}>{l.diff === 0 ? <Pill tone="good">مطابق</Pill> : <Pill tone={l.diff < 0 ? 'crit' : 'warn'}>{signed(l.diff)}</Pill>}</td>
            <td className={cn(td, 'num', l.diff < 0 && 'text-crit')}>{l.diff ? money(l.diff * cost(l.sku)) : '—'}</td></tr>)}</tbody></table></TableWrap>
      )}
      <p className="text-[11px] text-muted">«على السيستم» = الرصيد وقت بداية الجرد. «الفرق» = اللي اتسجّل فعلًا في المخزون (لو الرصيد اتغيّر وانت بتعدّ، الفرق بيتحسب على الرصيد وقت التأكيد).</p>
    </Sheet>
  );
}
