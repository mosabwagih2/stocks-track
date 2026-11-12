import { useMemo, useState } from 'react';
import type { Derived } from '@/femini/hooks/data';
import { shopFlow, shopMix, type ShopDoc } from '@/femini/domain/shop';
import { lineOf } from '@/femini/domain/lines';
import { addDays, dayDiff } from '@/femini/domain/dates';
import { qty } from '@/femini/domain/ledger';
import { skuLabel } from '@/femini/domain/orders';
import { change } from '@/femini/insights-tools';
import { Deferred } from './Deferred';
import { Thumb } from './Thumb';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { LOC_AR } from '@/femini/domain/constants';
import { cn, fmt } from '@/femini/cn';
import { Alert, Card, Empty, Kpi, Pill, Seg, Sheet, TableWrap, th, td } from './ui';
import { C, Heatmap, LOC_FILL, Pareto, ShareRows, TrendArea } from './charts';
import { DocDetails } from './DocDetails';
import { ItemCard, ItemsDetail } from './DetailSheets';
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
  // the same number of days right before, for the change on the cards (as on the summary)
  const n = dayDiff(from, to) + 1; const pFrom = addDays(from, -n), pTo = addDays(from, -1);
  const p = useMemo(() => shopFlow(d.snap, pFrom, pTo), [d, pFrom, pTo]);
  const [open, setOpen] = useState<string | null>(null); const [day, setDay] = useState<string | null>(null); const [kpi, setKpi] = useState<'all' | 'out' | 'back' | null>(null); const [f, setF] = useState<'all' | 'out' | 'back'>('all'); const [unit, setUnit] = useState<'value' | 'pieces'>('value');
  const openDoc = open ? d.snap.docs.find((x) => x.no === open) : undefined;
  const list = r.docs.filter((x) => f === 'all' || x.kind === f);
  const noCost = r.out.noCost + r.back.noCost;
  const shops = Object.entries(r.shops).sort((a, b) => b[1].out - a[1].out);
  const net = r.out.value - r.back.value;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi label="اتورّد للمحل" value={<Egp v={r.out.value} />} sub={`${fmt(r.out.n)} توريدة · ${fmt(r.out.pieces)} قطعة`} onClick={() => setKpi('out')}><Delta cur={r.out.pieces} prev={p.out.pieces} unit="قطعة" /></Kpi>
        <Kpi label="مرتجع من المحل" value={<Egp v={r.back.value} />} sub={`${fmt(r.back.n)} مرتجع · ${fmt(r.back.pieces)} قطعة${r.out.pieces ? ` · ${Math.round((r.back.pieces / r.out.pieces) * 100)}% من المورّد` : ''}`} tone={r.back.pieces ? 'warn' : undefined} onClick={() => setKpi('back')}><Delta cur={r.back.pieces} prev={p.back.pieces} unit="قطعة" upIsGood={false} /></Kpi>
        <Kpi label="صافي اللي راح" value={<Egp v={net} />} sub={`${fmt(r.out.pieces - r.back.pieces)} قطعة في الفترة`} tone="good" onClick={() => setKpi('all')} />
      </div>
      {noCost > 0 && <Alert tone="warn">{fmt(noCost)} قطعة من موديلات مالهاش تكلفة متسجّلة: محسوبة في القطع، ومش في الفلوس. سجّل التكلفة من الإعدادات ← «تكلفة القطعة وسعر البيع».</Alert>}

      <Card title="التوريد والمرتجع كل يوم" hint={`${unit === 'value' ? 'جنيه بالتكلفة' : 'قطع'} · بتاريخ الورقة · اضغط على أي يوم لتفاصيله`} action={<span className="print:hidden"><Seg value={unit} onChange={setUnit} options={[['value', 'جنيه'], ['pieces', 'قطع']]} /></span>}>
        <TrendArea bars money={unit === 'value'} onPick={(k) => { const xs = r.docs.filter((x) => x.doc.date === k); if (xs.length === 1) setOpen(xs[0].doc.no); else setDay(k); }} data={r.days} series={unit === 'value'
          ? [{ key: 'outValue', name: 'توريد', color: C.accent }, { key: 'backValue', name: 'مرتجع', color: C.scrap }]
          : [{ key: 'out', name: 'توريد', color: C.accent }, { key: 'back', name: 'مرتجع', color: C.scrap }]} />
      </Card>

      <Deferred minHeight={900}><ShopMix d={d} from={from} to={to} onDocs={r.docs} onDoc={setOpen} /></Deferred>

      <Card title={`التوريدات والمرتجعات (${fmt(list.length)})`} hint="الأحدث أول · اضغط على أي واحدة لتفاصيلها"
        action={<span className="print:hidden"><Seg value={f} onChange={setF} options={[['all', 'الكل'], ['out', `توريد ${r.out.n}`], ['back', `مرتجع ${r.back.n}`]]} /></span>}>
        {!list.length ? <Empty>مفيش {f === 'back' ? 'مرتجع' : f === 'out' ? 'توريد' : 'توريد ولا مرتجع'} في الفترة دي.</Empty> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Progressive items={list} chunk={12} render={(x) => <DocCard x={x} onOpen={() => setOpen(x.doc.no)} />} />
          </div>
        )}
      </Card>

      {shops.length > 1 && <Card title="حسب المحل" hint="كل الوقت">
        <TableWrap><table className="text-sm"><thead><tr>{['المحل', 'اتورّد', 'مرتجع', 'الصافي', 'الصافي بالتكلفة'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{shops.map(([s, v]) => <tr key={s}><td className={td}>{s}</td><td className={td + ' num'}>{fmt(v.out)}</td><td className={td + ' num'}>{fmt(v.back)}</td><td className={td + ' num font-semibold'}>{fmt(v.out - v.back)}</td><td className={td + ' num'}>{money(v.outValue - v.backValue)}</td></tr>)}</tbody></table></TableWrap>
      </Card>}

      {kpi && !openDoc && <Sheet title={kpi === 'out' ? 'التوريدات في الفترة' : kpi === 'back' ? 'المرتجعات في الفترة' : 'التوريد والمرتجع في الفترة'} onClose={() => setKpi(null)} wide>
        <p className="text-sm text-muted">اضغط على أي واحدة لتفاصيلها.</p>
        <div className="grid gap-3 sm:grid-cols-2">{r.docs.filter((x) => kpi === 'all' || x.kind === kpi).map((x) => <DocCard key={x.doc.no} x={x} onOpen={() => setOpen(x.doc.no)} />)}</div>
      </Sheet>}
      {day && !openDoc &&<Sheet title={`توريد ومرتجع يوم ${day}`} onClose={() => setDay(null)} wide>
        <p className="text-sm text-muted">اضغط على أي واحدة لتفاصيلها.</p>
        <div className="grid gap-3 sm:grid-cols-2">{r.docs.filter((x) => x.doc.date === day).map((x) => <DocCard key={x.doc.no} x={x} onOpen={() => setOpen(x.doc.no)} />)}</div>
      </Sheet>}
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
  const r = shopFlow(d.snap, from, to); const mix = shopMix(d.snap, from, to);
  const items = [...mix.bySku].sort((a, b) => b[1].out - a[1].out).map(([sku, e]) => [skuLabel(d.skuMap, sku), lineOf(d.skuMap.get(sku)?.model ?? ''), e.out, e.back, e.out ? Math.round((e.back / e.out) * 100) : '', qty(d.snap.balances, sku, 'READY')]);
  return [{ name: 'حسب الصنف', rows: [['الصنف', 'الخط', 'اتورّد', 'مرتجع', 'نسبة المرتجع %', 'جاهز دلوقتي'], ...items] },
    { name: 'توريد المحل', rows: [['النوع', 'الرقم', 'التاريخ', 'المحل', 'قطع', 'القيمة بالتكلفة', 'قطع من غير تكلفة', 'الحالة'],
      ...r.docs.map((x) => [x.kind === 'out' ? 'توريد' : 'مرتجع', x.doc.no, x.doc.date, x.shop, x.pieces, Math.round(x.value), x.noCost, x.kind === 'out' ? (x.doc.hdr.delivered ? 'اتسلّم' : 'لسه') : Object.entries(x.states).map(([l, n]) => `${LOC_AR[l] ?? l} ${n}`).join('، ')]),
      ['الإجمالي', '', '', '', '', '', '', ''],
      ['توريد', `${r.out.n} توريدة`, '', '', r.out.pieces, Math.round(r.out.value), r.out.noCost, ''],
      ['مرتجع', `${r.back.n} مرتجع`, '', '', r.back.pieces, Math.round(r.back.value), r.back.noCost, '']] },
  ];
}

/** Change against the same number of days before (as on the summary). `upIsGood=false` where growth is bad. */
function Delta({ cur, prev, unit, upIsGood = true }: { cur: number; prev: number; unit: string; upIsGood?: boolean }) {
  const c = change(cur, prev);
  if (c === null) return <span className="text-[11px] text-muted">مفيش فترة قبلها للمقارنة</span>;
  const good = c === 0 ? null : (c > 0) === upIsGood; const Icon = c >= 0 ? ArrowUpRight : ArrowDownRight;
  return <span className="flex items-center gap-1.5 text-[11px] text-muted"><span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono font-semibold', good === null ? 'bg-lav text-muted' : good ? 'bg-good-bg text-good' : 'bg-crit-bg text-crit')}><Icon className="size-3" />{c > 0 ? '+' : ''}{c}%</span>مقابل {fmt(prev)} {unit} قبلها</span>;
}

const LINE_COLOR: Record<string, string> = { بانتي: C.accent, برا: C.scrap, شورت: C.factory, 'موديلات أخرى': C.dirty };

/**
 * What the shop takes, the summary's views applied to the shop: by production line, the state the returns came back
 * in, the 80/20 models, the variants with their return rate and what is ready now, and the model × size map.
 */
function byModelBack(rows: { k?: { model: string }; back: number }[]) { const o: Record<string, number> = {}; for (const x of rows) if (x.k && x.back) o[x.k.model] = (o[x.k.model] ?? 0) + x.back; return o; }

function ShopMix({ d, from, to, onDocs, onDoc }: { d: Derived; from: string; to: string; onDocs: ShopDoc[]; onDoc: (no: string) => void }) {
  const mix = useMemo(() => shopMix(d.snap, from, to), [d, from, to]);
  const [lineView, setLineView] = useState<'out' | 'back'>('out');
  // what a click opens: a group of items (a model, or a model's size), a production line, a state the returns came back in, one item
  const [grp, setGrp] = useState<{ title: string; skus: string[] } | null>(null); const [line, setLine] = useState<string | null>(null); const [backLoc, setBackLoc] = useState<string | null>(null); const [item, setItem] = useState<string | null>(null);
  const rows = [...mix.bySku].map(([sku, e]) => ({ sku, k: d.skuMap.get(sku), ...e }));
  const outBy: Record<string, number> = {}; const lineBy = { out: {} as Record<string, number>, back: {} as Record<string, number> };
  const cell: Record<string, Record<string, number>> = {}; const byColor: Record<string, Record<string, number>> = {};
  for (const x of rows) {
    const mdl = x.k?.model ?? '—';
    if (x.out) outBy[mdl] = (outBy[mdl] ?? 0) + x.out;
    const ln = lineOf(mdl); if (x.out) lineBy.out[ln] = (lineBy.out[ln] ?? 0) + x.out; if (x.back) lineBy.back[ln] = (lineBy.back[ln] ?? 0) + x.back;
    if (x.k && x.out) { (cell[mdl] ??= {})[x.k.size] = (cell[mdl][x.k.size] ?? 0) + x.out; const cc = (byColor[`${mdl}|${x.k.size}`] ??= {}); cc[x.k.color] = (cc[x.k.color] ?? 0) + x.out; }
  }
  if (!rows.length) return null;
  const lineRows = Object.entries(lineBy[lineView]).sort((a, b) => b[1] - a[1]).map(([l, v]) => ({ label: l, value: v, color: LINE_COLOR[l] ?? C.dirty }));
  const backRows = Object.entries(mix.backTo).sort((a, b) => b[1] - a[1]).map(([loc, v]) => ({ label: LOC_AR[loc] ?? loc, value: v, color: LOC_FILL[loc as keyof typeof LOC_FILL] ?? C.muted }));
  const totOut = rows.reduce((a, x) => a + x.out, 0); const totBack = rows.reduce((a, x) => a + x.back, 0);
  const top = rows.filter((x) => x.out > 0).sort((a, b) => b.out - a.out || b.back - a.back).slice(0, 40);
  const openModel = (m: string, size?: string) => setGrp({ title: `${m} · ${d.modelMap.get(m)?.name ?? ''}${size ? ` · ${size}` : ''}`, skus: d.snap.skus.filter((k) => k.model === m && (!size || k.size === size) && mix.bySku.has(k.id)).map((k) => k.id) });
  const itemRows = (skus: string[]) => skus.map((s) => ({ sku: s, e: mix.bySku.get(s) ?? { out: 0, back: 0 } })).sort((a, b) => b.e.out - a.e.out || b.e.back - a.e.back).map(({ sku, e }) => ({ sku, cells: [fmt(e.out), e.back ? fmt(e.back) : '—', e.out && e.back ? `${Math.round((e.back / e.out) * 100)}%` : '—', fmt(qty(d.snap.balances, sku, 'READY'))] }));
  const lineModels = line ? Object.keys(outBy).concat(Object.keys(byModelBack(rows))).filter((m, i, a) => a.indexOf(m) === i && lineOf(m) === line) : [];
  const backDocs = backLoc ? onDocs.filter((x) => x.kind === 'back' && (x.states[backLoc] ?? 0) > 0) : [];
  const models = Object.keys(cell).sort((a, b) => (outBy[b] ?? 0) - (outBy[a] ?? 0)).slice(0, 14); const sizes = d.snap.sizes.filter((z) => models.some((x) => cell[x][z]));
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={lineView === 'out' ? 'التوريد حسب خط الإنتاج' : 'المرتجع حسب خط الإنتاج'} hint="قطع في الفترة" action={<Seg value={lineView} onChange={setLineView} options={[['out', 'توريد'], ['back', 'مرتجع']]} />}>
          {lineRows.length ? <ShareRows rows={lineRows} unit="قطعة" onPick={setLine} /> : <Empty>مفيش {lineView === 'out' ? 'توريد' : 'مرتجع'} في الفترة دي.</Empty>}
        </Card>
        <Card title="المرتجع رجع في حالة إيه" hint={totOut ? `نسبة المرتجع ${Math.round((totBack / totOut) * 100)}% من المورّد في الفترة` : ''}>
          {backRows.length ? <ShareRows rows={backRows} unit="قطعة" onPick={(l) => setBackLoc(Object.keys(mix.backTo).find((k) => (LOC_AR[k] ?? k) === l) ?? null)} /> : <Empty>مفيش مرتجع في الفترة دي.</Empty>}
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="باريتو: الموديلات الأكثر توريدًا" hint="قطع اتورّدت للمحل · اضغط على موديل لتفاصيله">{Object.keys(outBy).length ? <Pareto pull={outBy} onPick={(m) => openModel(m)} maxRows={5} /> : <Empty>مفيش توريد في الفترة دي.</Empty>}</Card>
        <Card title="الأصناف الأكثر توريدًا" hint="مع المرتجع منها واللي جاهز دلوقتي في المخزن · اضغط على صنف لتفاصيله">
          <div className="overflow-auto rounded-xl border border-line bg-surface" style={{ maxHeight: '23rem' }}><table className="text-sm"><thead><tr>{['', 'الصنف', 'اتورّد', 'مرتجع', 'نسبة المرتجع', 'جاهز دلوقتي'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{top.map((x, i) => { const rate = Math.round((x.back / x.out) * 100); return (
              <tr key={x.sku} className="cursor-pointer hover:bg-lav" onClick={() => setItem(x.sku)}><td className={td + ' w-10 font-mono text-muted'}>{i + 1}</td>
                <td className={td}><span className="flex items-center gap-2"><Thumb model={x.k ? d.modelMap.get(x.k.model) : undefined} size={32} />{skuLabel(d.skuMap, x.sku)}</span></td>
                <td className={td + ' font-mono font-semibold'}>{fmt(x.out)}</td><td className={td + ' font-mono'}>{x.back ? fmt(x.back) : '—'}</td>
                <td className={td}>{x.back ? <Pill tone={rate >= 30 ? 'crit' : rate >= 10 ? 'warn' : 'good'}>{rate}%</Pill> : <span className="text-muted">—</span>}</td>
                <td className={td + ' font-mono'}>{fmt(qty(d.snap.balances, x.sku, 'READY'))}</td></tr>); })}</tbody></table></div>
        </Card>
      </div>
      {line && <Sheet title={`${line} · التوريد حسب الموديل`} onClose={() => setLine(null)}>
        <p className="text-sm text-muted">اضغط على موديل تشوف أصنافه.</p>
        <TableWrap><table className="text-sm"><thead><tr>{['الموديل', 'اتورّد', 'مرتجع', 'نسبة المرتجع'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{lineModels.map((m) => ({ m, out: outBy[m] ?? 0, back: byModelBack(rows)[m] ?? 0 })).sort((a, b) => b.out - a.out).map((x) => (
            <tr key={x.m} className="cursor-pointer hover:bg-lav" onClick={() => openModel(x.m)}><td className={td + ' font-mono font-semibold'}>{x.m}</td><td className={td + ' font-mono'}>{fmt(x.out)}</td><td className={td + ' font-mono'}>{x.back ? fmt(x.back) : '—'}</td><td className={td + ' font-mono'}>{x.out && x.back ? `${Math.round((x.back / x.out) * 100)}%` : '—'}</td></tr>))}</tbody></table></TableWrap>
      </Sheet>}
      {backLoc && <Sheet title={`مرتجع رجع «${LOC_AR[backLoc] ?? backLoc}»`} onClose={() => setBackLoc(null)} wide>
        <p className="text-sm text-muted">المرتجعات اللي رجع منها قطع في الحالة دي. اضغط على أي واحدة لتفاصيلها.</p>
        <div className="grid gap-3 sm:grid-cols-2">{backDocs.map((x) => <DocCard key={x.doc.no} x={x} onOpen={() => onDoc(x.doc.no)} />)}</div>
      </Sheet>}
      {grp && <ItemsDetail d={d} title={grp.title} hint="الأصناف في الفترة: اتورّد ومرتجع والجاهز دلوقتي. اضغط على صنف لتفاصيله." head={['اتورّد', 'مرتجع', 'نسبة المرتجع', 'جاهز دلوقتي']} rows={itemRows(grp.skus)} onItem={setItem} onClose={() => setGrp(null)} />}
      {item && <ItemCard d={d} sku={item} onClose={() => setItem(null)} />}
      {models.length > 0 && <Card title="خريطة التوريد: الموديل × المقاس" hint="قطع اتورّدت · قف على أي مربع تشوف ألوانه · اضغط عليه لتفاصيله"><Heatmap models={models} sizes={sizes} onPick={(m, z) => openModel(m, z)} value={(x, z) => cell[x][z] ?? 0} total={(x) => outBy[x] ?? 0} breakdown={(x, z) => Object.entries(byColor[`${x}|${z}`] ?? {}).sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, n }))} /></Card>}
    </div>
  );
}
