import { useDeferredValue, useMemo, useState } from 'react';
import { useDerived, useAct } from '@/hooks/data';
import { PageHead } from '@/components/PageHead';
import { Alert, Button, Card, Chip, Dot, Empty, Field, Kpi, Pill, Seg, Sheet, TableWrap, th, td } from '@/components/ui';
import { ErrorBox } from '@/components/shared';
import { Spinner } from '@/components/Spinner';
import { LOCS, LOC_AR, LOC_COLOR, LOC_HINT } from '@/domain/constants';
import { locTotal, qty, totalOwned } from '@/domain/ledger';
import { cellInfo } from '@/domain/stock';
import { cn, fmt } from '@/lib/cn';
import { skuLabel } from '@/domain/orders';
import { repo } from '@/data';
import type { Derived } from '@/hooks/data';
import type { Loc, Sku } from '@/domain/types';

const SW: Record<string, string> = { اسود: '#1e1b24', ابيض: '#ffffff', احمر: '#d9262e', بيج: '#ead9be', رمادي: '#bdbcc4', برتقالي: '#f07a2b', زيتى: '#6f7a3c', فوشيا: '#c2317a', اصفر: '#f2c230', 'مينت جرين': '#8fd3b6', 'بيبي بلو': '#a9cbe8', كحلي: '#1f2a5a', بينك: '#f4b6c8', سيمون: '#f3a28c', روز: '#e58fa8', 'احمر تطعيم اسود': '#a3262c' };
const Swatch = ({ c }: { c: string }) => <i className="inline-block size-3 rounded-full border border-line2 align-[-1px]" style={{ background: SW[c] ?? '#cfc2ec' }} />;
const lineOf = (m: string) => (/^PAN/.test(m) ? 'بانتي' : /^BR/.test(m) ? 'برا' : /^SH/.test(m) ? 'شورت' : 'موديلات تانية');
const LINES = ['بانتي', 'برا', 'شورت', 'موديلات تانية'];

function Matrix({ d, model, loc, onCell }: { d: Derived; model: string; loc: Loc; onCell: (s: Sku) => void }) {
  const skus = d.snap.skus.filter((s) => s.model === model);
  const colors = [...new Set(skus.map((s) => s.color))]; const sizes = d.snap.sizes.filter((z) => skus.some((s) => s.size === z));
  const by = new Map(skus.map((s) => [`${s.color}|${s.size}`, s]));
  return (
    <div className="overflow-x-auto rounded-xl border border-line p-2">
      <table className="border-separate border-spacing-1 w-auto">
        <thead><tr><th />{sizes.map((z) => <th key={z} className="px-1.5 py-1 text-center text-xs font-semibold text-muted">{z}</th>)}<th className="px-1.5 text-xs text-muted">إجمالي</th></tr></thead>
        <tbody>
          {colors.map((c) => {
            let row = 0;
            return (
              <tr key={c}>
                <td className="whitespace-nowrap ps-1 pe-2 font-medium"><Swatch c={c} /> {c}</td>
                {sizes.map((z) => {
                  const s = by.get(`${c}|${z}`); if (!s) return <td key={z} />;
                  const v = qty(d.snap.balances, s.id, loc); row += v; const info = cellInfo(s, d.snap.balances, d.demand, d.velocity, d.velocityOK, 14);
                  const lvl = loc === 'READY' ? (v < 0 ? 'crit' : info.level) : v === 0 ? 'z' : '';
                  return (
                    <td key={z}>
                      <button type="button" onClick={() => onCell(s)} aria-label={`${skuLabel(d.skuMap, s.id)}: ${v}`}
                        title={`${LOCS.filter((l) => qty(d.snap.balances, s.id, l)).map((l) => `${LOC_AR[l]} ${qty(d.snap.balances, s.id, l)}`).join(' · ') || 'مفيش رصيد'}${info.demand ? `\nطلب مفتوح ${info.demand}` : ''}`}
                        className={cn('relative grid h-11 min-w-14 place-items-center rounded-[10px] border border-transparent font-mono text-[15px] font-medium hover:border-accent',
                          lvl === 'crit' ? 'bg-crit-bg text-crit border-crit-line' : lvl === 'warn' ? 'bg-warn-bg text-warn border-warn-line' : v === 0 ? 'bg-grid text-muted' : 'bg-lav')}>
                        {v}
                        {loc === 'READY' && info.demand > 0 && <small className="absolute inset-x-0 bottom-0.5 text-center font-sans text-[9.5px] leading-none opacity-80">طلب {info.demand}</small>}
                        {loc === 'READY' && qty(d.snap.balances, s.id, 'DIRTY') > 0 && <i className="absolute end-1 top-1 size-1.5 rounded-full bg-dirty" />}
                      </button>
                    </td>
                  );
                })}
                <td className="px-2 text-center font-mono font-semibold">{fmt(row)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SkuSheet({ d, sku, onClose }: { d: Derived; sku: Sku; onClose: () => void }) {
  const act = useAct(); const b = d.snap.balances; const info = cellInfo(sku, b, d.demand, d.velocity, d.velocityOK, 14);
  const [from, setFrom] = useState<Loc>('READY'); const [to, setTo] = useState<Loc>('DIRTY'); const [q, setQ] = useState(1); const [reason, setReason] = useState('');
  const moves = d.snap.moves.filter((m) => m.sku === sku.id).slice(0, 10);
  const have = qty(b, sku.id, from);
  return (
    <Sheet title={skuLabel(d.skuMap, sku.id)} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="جاهز للبيع" value={fmt(info.ready)} tone={info.ready < 0 ? 'crit' : undefined} /><Kpi label="مطلوب (مفتوح)" value={fmt(info.demand)} tone={info.demand > info.ready ? 'crit' : undefined} />
        <Kpi label="سرعة السحب" value={info.velocity ? info.velocity.toFixed(1) : '—'} sub="قطعة / يوم" /><Kpi label="يغطّي" value={info.cover != null ? Math.floor(info.cover) : '—'} sub="يوم" />
      </div>
      <TableWrap><table className="text-sm"><tbody>
        {LOCS.map((l) => <tr key={l}><td className={td}><Dot className={LOC_COLOR[l]} /> {LOC_AR[l]} <span className="text-xs text-muted">{LOC_HINT[l]}</span></td><td className={td + ' font-mono'}>{fmt(qty(b, sku.id, l))}</td></tr>)}
        <tr><td className={td}><b>الإجمالي في ملكنا</b></td><td className={td + ' font-mono font-semibold'}>{fmt(totalOwned(b, sku.id))}</td></tr>
      </tbody></table></TableWrap>
      <Card title="نقل بين الحالات" hint="مثلًا: جاهز ← هالك نظافة">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="من"><select value={from} onChange={(e) => setFrom(e.target.value as Loc)}>{LOCS.map((l) => <option key={l} value={l}>{LOC_AR[l]}</option>)}</select></Field>
          <Field label="إلى"><select value={to} onChange={(e) => setTo(e.target.value as Loc)}>{LOCS.filter((l) => l !== from).map((l) => <option key={l} value={l}>{LOC_AR[l]}</option>)}</select></Field>
          <Field label="الكمية"><input type="number" min={1} value={q} onChange={(e) => setQ(Math.max(1, Math.floor(+e.target.value || 1)))} /></Field>
          <Field label="السبب"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="بقعة..." /></Field>
        </div>
        <p className="mt-2 text-sm">الرصيد دلوقتي <b className="font-mono">{have}</b> · هيبقى <b className="font-mono">{have - q}</b> {q > have && <Pill tone="crit">مفيش كفاية</Pill>}</p>
        <div className="mt-3"><Button variant="primary" disabled={from === to || q > have || q < 1} onClick={async () => { const r = await act(() => repo.moveState({ lines: [{ sku: sku.id, qty: q }], from, to, reason }), (x) => `اتسجّلت ${x.doc}`); if (r) onClose(); }}>تأكيد النقل</Button></div>
      </Card>
      <h3 className="font-display font-semibold">آخر الحركات</h3>
      {moves.length ? <TableWrap><table className="text-sm"><tbody>{moves.map((m) => <tr key={m.id}><td className={td + ' font-mono text-muted'}>{m.date}</td><td className={td}>{m.note || m.type}<div className="text-xs text-muted">من {LOC_AR[m.from]} إلى {LOC_AR[m.to]}</div></td><td className={td + ' font-mono'}>{m.qty}</td></tr>)}</tbody></table></TableWrap> : <Empty>مفيش حركات.</Empty>}
    </Sheet>
  );
}

export default function Stock() {
  const { d, isLoading, error } = useDerived();
  const [view, setView] = useState<'all' | 'one' | 'table'>('all'); const [loc, setLoc] = useState<Loc>('READY');
  const [model, setModel] = useState('BR2'); const [line, setLine] = useState('all'); const [sort, setSort] = useState<'pull' | 'alpha'>('pull');
  const [q, setQ] = useState(''); const dq = useDeferredValue(q); const [flt, setFlt] = useState<'all' | 'low' | 'neg' | 'dem'>('all'); const [sku, setSku] = useState<Sku | null>(null);
  const [list, setList] = useState(true);
  const order = useMemo(() => (d ? (sort === 'pull' ? d.modelsByPull : [...d.snap.models].map((m) => m.code).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) : []), [d, sort]);
  const rows = useMemo(() => {
    if (!d || view !== 'table') return [];
    const w = dq.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return d.snap.skus.filter((s) => {
      const c = cellInfo(s, d.snap.balances, d.demand, d.velocity, d.velocityOK, 14);
      if (flt === 'low' && !c.level) return false; if (flt === 'neg' && c.ready >= 0) return false; if (flt === 'dem' && !c.demand) return false;
      return !w.length || w.every((x) => `${s.id} ${s.color} ${s.size}`.toLowerCase().includes(x));
    }).sort((a, b) => { const x = cellInfo(a, d.snap.balances, d.demand, d.velocity, d.velocityOK, 14), y = cellInfo(b, d.snap.balances, d.demand, d.velocity, d.velocityOK, 14); const r = (c: typeof x) => (c.level === 'crit' ? 0 : c.level === 'warn' ? 1 : 2); return r(x) - r(y) || a.id.localeCompare(b.id, 'en', { numeric: true }); });
  }, [d, view, dq, flt]);
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !d) return <Spinner />;
  const mName = (c: string) => `${c} · ${d.modelMap.get(c)?.name ?? ''}`;
  const modelSum = (m: string, l: Loc) => d.snap.skus.reduce((a, s) => a + (s.model === m ? qty(d.snap.balances, s.id, l) : 0), 0);
  const modelDemand = (m: string) => d.snap.skus.reduce((a, s) => a + (s.model === m ? d.demand[s.id] ?? 0 : 0), 0);
  const shown = order.filter((c) => line === 'all' || lineOf(c) === line);
  const head = (c: string) => (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="font-display text-base font-semibold">{mName(c)}</h2><span className="text-muted">{LOC_AR[loc]}: <b className="font-mono">{fmt(modelSum(c, loc))}</b> قطعة · طلب مفتوح <span className="font-mono">{fmt(modelDemand(c))}</span></span></div>
      <Pill>{d.pull[c] ? `سُحب ${fmt(d.pull[c])} قطعة` : 'مفيش سحب'}</Pill>
    </div>
  );
  return (
    <>
      <PageHead title="المخزون" sub="كل صنف (موديل × لون × مقاس) وحالته. اضغط أي خانة تفتح تفاصيلها.">
        <Seg value={view} onChange={setView} options={[['all', 'كل الموديلات'], ['one', 'موديل واحد'], ['table', 'كل الأصناف']]} label="العرض" />
      </PageHead>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {LOCS.map((l) => <Chip key={l} pressed={loc === l} onClick={() => setLoc(l)}><Dot className={LOC_COLOR[l]} />{LOC_AR[l]} <span className="font-mono text-xs opacity-75">{fmt(locTotal(d.snap.balances, l))}</span></Chip>)}
      </div>
      {view === 'table' ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {([['all', 'الكل'], ['low', 'قرب يخلص'], ['neg', 'بالسالب'], ['dem', 'عليه طلب مفتوح']] as const).map(([v, l]) => <Chip key={v} pressed={flt === v} onClick={() => setFlt(v)}>{l}</Chip>)}
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث: BR2 احمر L" className="min-w-52 max-w-xs flex-1" aria-label="بحث" />
          </div>
          <TableWrap><table className="text-sm"><thead><tr>{['الصنف', 'جاهز', 'هالك نظافة', 'عند المصنع', 'مفقود', 'طلب مفتوح', 'يغطّي (يوم)', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{rows.slice(0, 200).map((s) => { const c = cellInfo(s, d.snap.balances, d.demand, d.velocity, d.velocityOK, 14); return (
              <tr key={s.id} className="cursor-pointer hover:bg-lav" onClick={() => setSku(s)}>
                <td className={td}><Swatch c={s.color} /> <b className="font-mono">{s.model}</b> {s.color} · {s.size}</td><td className={td + ' font-mono'}>{fmt(c.ready)}</td>
                <td className={td + ' font-mono'}>{qty(d.snap.balances, s.id, 'DIRTY')}</td><td className={td + ' font-mono'}>{qty(d.snap.balances, s.id, 'FACTORY')}</td><td className={td + ' font-mono'}>{qty(d.snap.balances, s.id, 'LOST')}</td>
                <td className={td + ' font-mono'}>{c.demand}</td><td className={td + ' font-mono'}>{c.cover != null ? Math.floor(c.cover) : '—'}</td>
                <td className={td}>{c.ready < 0 ? <Pill tone="crit">بالسالب</Pill> : c.level === 'crit' ? <Pill tone="crit">هيخلص</Pill> : c.level === 'warn' ? <Pill tone="warn">قرب</Pill> : null}</td></tr>); })}
              {!rows.length && <tr><td colSpan={8}><Empty>مفيش أصناف بالفلتر ده.</Empty></td></tr>}</tbody></table></TableWrap>
          {rows.length > 200 && <p className="mt-2 text-muted">أول 200 من {fmt(rows.length)}. ضيّق البحث.</p>}
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {view === 'all' && ['all', ...LINES].map((l) => <Chip key={l} pressed={line === l} onClick={() => setLine(l)}>{l === 'all' ? 'كل الموديلات' : l}</Chip>)}
            <Seg value={sort} onChange={setSort} options={[['pull', 'الأكتر سحبًا'], ['alpha', 'أبجدي']]} label="الترتيب" />
            {view === 'one' && <Button size="sm" onClick={() => setList((x) => !x)}>{list ? 'إخفاء قايمة الموديلات' : 'إظهار قايمة الموديلات'}</Button>}
          </div>
          {view === 'all' ? (
            <div className="grid gap-4">{shown.map((c) => <Card key={c}>{head(c)}<Matrix d={d} model={c} loc={loc} onCell={setSku} /></Card>)}</div>
          ) : (
            <div className={cn('grid items-start gap-4', list && 'md:grid-cols-[260px_minmax(0,1fr)]')}>
              {list && (
                <nav aria-label="الموديلات" className="grid max-h-[calc(100vh-220px)] gap-0.5 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5">
                  {LINES.filter((l) => order.some((c) => lineOf(c) === l)).map((l) => (
                    <div key={l}><div className="px-2.5 pt-2.5 pb-1 text-[11px] font-bold tracking-wider text-muted">{l}</div>
                      {order.filter((c) => lineOf(c) === l).map((c) => (
                        <button key={c} type="button" aria-current={c === model} onClick={() => setModel(c)} className={cn('grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-xl px-2.5 py-2 text-start', c === model ? 'bg-ink text-page dark:bg-accent dark:text-on-accent' : 'hover:bg-lav')}>
                          <span><b className="font-mono text-[13px]">{c}</b> <small className="opacity-70">{d.modelMap.get(c)?.name}</small></span><span className="font-mono text-sm">{fmt(modelSum(c, loc))}</span>
                        </button>))}
                    </div>))}
                </nav>
              )}
              <Card>{head(model)}<Matrix d={d} model={model} loc={loc} onCell={setSku} /></Card>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted"><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-crit" />الطلب أكبر من الجاهز</span><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-warn" />قرب يخلص</span><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-dirty" />فيه هالك نظافة</span></div>
        </>
      )}
      {sku && <SkuSheet d={d} sku={sku} onClose={() => setSku(null)} />}
      <Alert className="mt-6">إضافة وتعديل الموديلات والأصناف (الكتالوج) بتتم دلوقتي من جداول <span className="font-mono">models / skus</span> في Supabase، وشاشتها جاية في الخطوة الجاية.</Alert>
    </>
  );
}
