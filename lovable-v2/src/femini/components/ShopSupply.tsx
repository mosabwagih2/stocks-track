import { useMemo, useState } from 'react';
import type { Derived } from '@/femini/hooks/data';
import { shopFlow, type ShopDoc } from '@/femini/domain/shop';
import { LOC_AR } from '@/femini/domain/constants';
import { cn, fmt } from '@/femini/cn';
import { Alert, Card, Empty, Kpi, Pill, Seg, TableWrap, th, td } from './ui';
import { C, TrendArea } from './charts';
import { DocDetails } from './DocDetails';
import { Progressive } from './Deferred';
import type { ExportSheet } from '@/femini/insights-tools';

const money = (n: number) => new Intl.NumberFormat('ar-EG-u-nu-latn', { maximumFractionDigits: 0 }).format(n);
/** a money figure as a card value: the number, then «جنيه», in Arabic order */
const Egp = ({ v }: { v: number }) => <span dir="rtl" className="inline-flex items-baseline gap-1.5"><span className="num">{money(v)}</span><span className="font-sans text-sm font-medium text-muted">جنيه</span></span>;

/**
 * «توريد المحل»: what went to the shop and what came back, in the page's dates, valued at the cost recorded now.
 * Every supply / return is a card; a card opens its document.
 */
export function ShopSupplyView({ d, from, to }: { d: Derived; from: string; to: string }) {
  const r = useMemo(() => shopFlow(d.snap, from, to), [d, from, to]);
  const [open, setOpen] = useState<string | null>(null); const [f, setF] = useState<'all' | 'out' | 'back'>('all'); const [unit, setUnit] = useState<'value' | 'pieces'>('value');
  const openDoc = open ? d.snap.docs.find((x) => x.no === open) : undefined;
  const list = r.docs.filter((x) => f === 'all' || x.kind === f);
  const noCost = r.out.noCost + r.back.noCost;
  const shops = Object.entries(r.shops).sort((a, b) => b[1].out - a[1].out);
  const net = r.out.value - r.back.value;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="اتورّد للمحل" value={<Egp v={r.out.value} />} sub={`${fmt(r.out.n)} توريدة · ${fmt(r.out.pieces)} قطعة`} onClick={() => setF('out')} />
        <Kpi label="مرتجع من المحل" value={<Egp v={r.back.value} />} sub={`${fmt(r.back.n)} مرتجع · ${fmt(r.back.pieces)} قطعة${r.out.pieces ? ` · ${Math.round((r.back.pieces / r.out.pieces) * 100)}% من المورّد` : ''}`} tone={r.back.pieces ? 'warn' : undefined} onClick={() => setF('back')} />
        <Kpi label="صافي اللي راح" value={<Egp v={net} />} sub={`${fmt(r.out.pieces - r.back.pieces)} قطعة في الفترة`} tone="good" />
        <Kpi label="عند المحل دلوقتي" value={<span dir="rtl" className="inline-flex items-baseline gap-1.5"><span className="num">{fmt(r.atShop.pieces)}</span><span className="font-sans text-sm font-medium text-muted">قطعة</span></span>} sub={`بالتكلفة ${money(r.atShop.value)} جنيه · من أول توريدة`} />
      </div>
      {noCost > 0 && <Alert tone="warn">{fmt(noCost)} قطعة من موديلات مالهاش تكلفة متسجّلة: محسوبة في القطع، ومش في الفلوس. سجّل التكلفة من الإعدادات ← «تكلفة القطعة وسعر البيع».</Alert>}

      <Card title="التوريد والمرتجع كل يوم" hint={unit === 'value' ? 'جنيه بالتكلفة · بتاريخ الورقة' : 'قطع · بتاريخ الورقة'} action={<span className="print:hidden"><Seg value={unit} onChange={setUnit} options={[['value', 'جنيه'], ['pieces', 'قطع']]} /></span>}>
        <TrendArea bars money={unit === 'value'} data={r.days} series={unit === 'value'
          ? [{ key: 'outValue', name: 'توريد', color: C.accent }, { key: 'backValue', name: 'مرتجع', color: C.scrap }]
          : [{ key: 'out', name: 'توريد', color: C.accent }, { key: 'back', name: 'مرتجع', color: C.scrap }]} />
      </Card>

      <Card title={`التوريدات والمرتجعات (${fmt(list.length)})`} hint="الأحدث أول · اضغط على أي واحدة لتفاصيلها"
        action={<span className="print:hidden"><Seg value={f} onChange={setF} options={[['all', 'الكل'], ['out', `توريد ${r.out.n}`], ['back', `مرتجع ${r.back.n}`]]} /></span>}>
        {!list.length ? <Empty>مفيش {f === 'back' ? 'مرتجع' : f === 'out' ? 'توريد' : 'توريد ولا مرتجع'} في الفترة دي.</Empty> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Progressive items={list} chunk={12} render={(x) => <DocCard x={x} onOpen={() => setOpen(x.doc.no)} />} />
          </div>
        )}
      </Card>

      {shops.length > 1 && <Card title="حسب المحل" hint="كل الوقت">
        <TableWrap><table className="text-sm"><thead><tr>{['المحل', 'اتورّد', 'مرتجع', 'عنده دلوقتي', 'بالتكلفة'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{shops.map(([s, v]) => <tr key={s}><td className={td}>{s}</td><td className={td + ' num'}>{fmt(v.out)}</td><td className={td + ' num'}>{fmt(v.back)}</td><td className={td + ' num font-semibold'}>{fmt(v.out - v.back)}</td><td className={td + ' num'}>{money(v.outValue - v.backValue)}</td></tr>)}</tbody></table></TableWrap>
      </Card>}

      {openDoc && <DocDetails key={openDoc.no} d={d} doc={openDoc} onClose={() => setOpen(null)} onOpen={setOpen} />}
    </div>
  );
}

function DocCard({ x, onOpen }: { x: ShopDoc; onOpen: () => void }) {
  const out = x.kind === 'out'; const delivered = !!x.doc.hdr.delivered;
  return (
    <button type="button" onClick={onOpen} className={cn('fade-up grid content-start gap-2 rounded-2xl border bg-surface p-4 text-start shadow-card transition hover:-translate-y-0.5 hover:border-accent/50', out ? 'border-line' : 'border-crit-line')}>
      <span className="flex flex-wrap items-center gap-2">
        <Pill tone={out ? 'info' : 'crit'}>{out ? 'توريد' : 'مرتجع'}</Pill>
        <b className="font-mono text-xs">{x.doc.no}</b>
        <span className="num ms-auto text-xs text-muted">{x.doc.date}</span>
      </span>
      <span className="flex items-baseline gap-1.5"><b className="num text-2xl leading-none font-semibold">{money(x.value)}</b><span className="text-xs text-muted">جنيه</span></span>
      <span className="text-xs text-muted"><b className="num text-ink">{fmt(x.pieces)}</b> قطعة · {x.shop}{x.noCost ? ` · ${fmt(x.noCost)} قطعة من غير تكلفة` : ''}</span>
      {out
        ? <span className="text-xs">{delivered ? <Pill tone="good">اتسلّم</Pill> : <Pill tone="warn">لسه ما اتسلّمش</Pill>}</span>
        : <span className="flex flex-wrap gap-1.5 text-xs">{Object.entries(x.states).map(([loc, n]) => <span key={loc} className="rounded-full border border-line px-2 py-0.5">{LOC_AR[loc] ?? loc} <b className="num">{fmt(n)}</b></span>)}</span>}
    </button>
  );
}

/** The Excel sheets of «توريد المحل»: every supply / return of the period, and the totals. */
export function shopSheets(d: Derived, from: string, to: string): ExportSheet[] {
  const r = shopFlow(d.snap, from, to);
  return [
    { name: 'توريد المحل', rows: [['النوع', 'الرقم', 'التاريخ', 'المحل', 'قطع', 'القيمة بالتكلفة', 'قطع من غير تكلفة', 'الحالة'],
      ...r.docs.map((x) => [x.kind === 'out' ? 'توريد' : 'مرتجع', x.doc.no, x.doc.date, x.shop, x.pieces, Math.round(x.value), x.noCost, x.kind === 'out' ? (x.doc.hdr.delivered ? 'اتسلّم' : 'لسه') : Object.entries(x.states).map(([l, n]) => `${LOC_AR[l] ?? l} ${n}`).join('، ')]),
      ['الإجمالي', '', '', '', '', '', '', ''],
      ['توريد', `${r.out.n} توريدة`, '', '', r.out.pieces, Math.round(r.out.value), r.out.noCost, ''],
      ['مرتجع', `${r.back.n} مرتجع`, '', '', r.back.pieces, Math.round(r.back.value), r.back.noCost, ''],
      ['عند المحل دلوقتي', 'من أول توريدة', '', '', r.atShop.pieces, Math.round(r.atShop.value), '', '']] },
  ];
}
