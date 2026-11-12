import { useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ExternalLink, Package, Pencil, Plus, Scale, Trash2, X } from 'lucide-react';
import { Alert, Button, Card, Chip, Empty, Field, Kpi, Pill, Seg, Sheet, TableWrap, th, td } from '@/femini/components/ui';
import { useImageUrl } from '@/femini/components/Thumb';
import { BUNDLES } from '@/femini/data/bundles.generated';
import { repo } from '@/femini/data';
import { bundleBySize, bundleLine, bundleModels, bundleTotal, normColor, type Bundle, type BundleComp, type SizeResult, type Stockroom } from '@/femini/domain/bundles';
import { balanced, plan, productsOf, sharing, supplyOf } from '@/femini/domain/bundlePlan';
import { qty } from '@/femini/domain/ledger';
import { cn, fmt } from '@/femini/cn';
import { useAct, type Derived } from '@/femini/hooks/data';

/** a count of orders: red none, amber a few, green enough */
const tone = (n: number) => (n <= 0 ? 'bg-crit-bg text-crit' : n <= 3 ? 'bg-warn-bg text-warn' : 'bg-good-bg text-ink');

/** the stock as the bundles see it: (model, color, size) → the pieces ready to sell */
function useRoom(d: Derived): Stockroom {
  return useMemo(() => {
    const by = new Map<string, string>(); const colors = new Map<string, string[]>();
    for (const s of d.snap.skus) {
      by.set(`${s.model}|${normColor(s.color)}|${s.size}`, s.id);
      const l = colors.get(s.model) ?? []; if (!l.includes(s.color)) l.push(s.color); colors.set(s.model, l);
    }
    return {
      colorsOf: (m) => colors.get(m) ?? [],
      have: (m, c, z) => { const id = by.get(`${m}|${normColor(c)}|${z}`); return id ? qty(d.snap.balances, id, 'READY') : null; },
    };
  }, [d]);
}

/** the store's bundles, with the ones made here: one made here with a store bundle's id replaces it */
function useBundles(d: Derived): Bundle[] {
  return useMemo(() => {
    const mine = new Map(d.snap.bundles.map((b) => [b.id, b]));
    return [...BUNDLES.map((b) => mine.get(b.id) ?? b), ...d.snap.bundles.filter((b) => !BUNDLES.some((x) => x.id === b.id))];
  }, [d.snap.bundles]);
}

/** a bundle's picture: the one set here, else the store's, else a tile */
function BundlePic({ d, b, size }: { d: Derived; b: Bundle; size: number }) {
  const own = useImageUrl(d.snap.bundleImages[b.id]);
  const file = b.img ?? BUNDLES.find((x) => x.id === b.id)?.img;
  const url = own ?? (file ? `${import.meta.env.BASE_URL}bundles/${file}` : null);
  const st = { width: size, height: size };
  return url
    ? <img src={url} alt="" loading="lazy" style={st} className="shrink-0 rounded-xl border border-line bg-surface object-cover" />
    : <span style={st} className="grid shrink-0 place-items-center rounded-xl border border-line bg-lav text-accent"><Package className="size-1/3" /></span>;
}

/** hover a size: a small card with the pieces of that size, by model and color (like the stock map's) */
function useTip() {
  const [tip, setTip] = useState<{ rect: DOMRect; r: SizeResult } | null>(null);
  return { tip, show: (e: MouseEvent | { currentTarget: Element }, r: SizeResult) => setTip({ rect: e.currentTarget.getBoundingClientRect(), r }), hide: () => setTip(null) };
}
function SizeTip({ tip }: { tip: { rect: DOMRect; r: SizeResult } | null }) {
  if (!tip) return null;
  const { rect, r } = tip;
  // the pieces of the size, merged over the color combinations: model → color → pieces
  const models = new Map<string, { qty: number; colors: Map<string, number>; weakest: boolean }>();
  for (const v of r.variants) for (const c of v.comps) {
    const m = models.get(c.comp.model) ?? { qty: c.comp.qty, colors: new Map<string, number>(), weakest: false };
    for (const col of c.colors) m.colors.set(col, c.have[col]);
    if (r.best?.limiting === c) m.weakest = true;
    models.set(c.comp.model, m);
  }
  const w = 224; const vw = document.documentElement.clientWidth;
  const left = Math.max(8, Math.min(rect.left + rect.width / 2 - w / 2, vw - w - 8));
  const below = rect.top < 220;
  const pos = below ? { top: rect.bottom + 8 } : { bottom: window.innerHeight - rect.top + 8 };
  return createPortal(
    <div role="tooltip" dir="rtl" className="pointer-events-none fixed z-[60] max-h-[70vh] overflow-hidden rounded-2xl border border-line bg-surface p-3 text-sm shadow-card" style={{ left, width: w, ...pos }}>
      <div className="mb-1.5 flex items-center justify-between font-semibold"><span>مقاس {r.size}</span><span className="num text-muted">{fmt(r.max)} أوردر</span></div>
      {[...models].map(([model, m]) => (
        <div key={model} className="mb-1.5 border-t border-grid pt-1.5 first:border-0 first:pt-0">
          <div className={cn('mb-0.5 flex items-center justify-between text-xs font-semibold', m.weakest && 'text-warn')}><span className="font-mono">{model}</span><span className="num font-normal text-muted">{m.qty} في الأوردر{m.weakest ? ' · الأضعف' : ''}</span></div>
          {[...m.colors].sort((a, b) => b[1] - a[1]).map(([col, n]) => <div key={col} className="flex items-center justify-between gap-3"><b className={cn('num', n <= 0 && 'text-crit')}>{fmt(n)}</b><span>{col}</span></div>)}
        </div>
      ))}
    </div>, document.body);
}

/** the bundles, each with the orders the stock can fill: the scarcest piece decides */
export function BundlesView({ d, q }: { d: Derived; q: string }) {
  const [open, setOpen] = useState<Bundle | null>(null); const [edit, setEdit] = useState<Bundle | 'new' | null>(null); const [list, setList] = useState<ListKind | null>(null);
  const room = useRoom(d); const all = useBundles(d); const tip = useTip(); const [order, setOrder] = useState<'most' | 'least'>('most'); const [planner, setPlanner] = useState(false);
  const share = useMemo(() => sharing(all, room, 'M'), [all, room]);
  const rows = useMemo(() => all.map((b) => { const by = b.unknown ? [] : bundleBySize(b, room); return { b, by, total: bundleTotal(by) }; }), [all, room]);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = rows.filter(({ b }) => !words.length || words.every((w) => `${b.title} ${bundleModels(b).join(' ')}`.toLowerCase().includes(w))).sort((a, c) => (a.b.unknown ? 1 : 0) - (c.b.unknown ? 1 : 0) || (order === 'most' ? c.total - a.total : a.total - c.total));
  const known = rows.filter((r) => !r.b.unknown);
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="باندلز" value={fmt(all.length)} sub={`${fmt(d.snap.bundles.filter((b) => b.custom).length)} اتعملت هنا`} onClick={() => setList('all')} />
        <Kpi label="تقدر تطلّع منها" value={fmt(known.filter((r) => r.total > 0).length)} sub="باندل فيه مخزون يكفي أوردر" tone="good" onClick={() => setList('ok')} />
        <Kpi label="خلصت" value={fmt(known.filter((r) => r.total === 0).length)} sub="ولا أوردر يتطلّع منها" tone={known.some((r) => r.total === 0) ? 'crit' : undefined} onClick={() => setList('out')} />
        <Kpi label="تركيبتها مش واضحة" value={fmt(all.filter((b) => b.unknown).length)} sub="مش محسوبة" tone={all.some((b) => b.unknown) ? 'warn' : undefined} onClick={() => setList('unknown')} />
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2"><Seg label="الترتيب" value={order} onChange={setOrder} options={[['most', 'الأكتر أوردرات أول'], ['least', 'الأقل أول (على وشك الخلاص)']]} /></div>
        <div className="flex flex-wrap gap-2"><Button onClick={() => setPlanner(true)}><Scale className="size-4" />وزّع المخزون على الباندلز</Button><Button variant="primary" onClick={() => setEdit('new')}><Plus className="size-4" />باندل جديد</Button></div>
      </div>
      <Alert tone="warn" className="mb-3">رقم كل باندل = اللي تقدر تطلّعه منه <b>لو بعت الباندل ده لوحده</b>. الباندلز بتسحب من نفس القطع (مثلًا BR1 داخل في أكتر من باندل)، فالأرقام <b>مش بتتجمع</b>. لو هتبيع أكتر من باندل مع بعض استخدم «وزّع المخزون» تشوف الرقم الحقيقي.</Alert>
      <p className="mb-3 text-xs text-muted">الأرقام من الجاهز للبيع، لكل باندل لوحده؛ القطع مشتركة بين الباندلز، فمتجمعش الأرقام. وقّف على أي مقاس تشوف القطع المتوفرة بألوانها.</p>
      {!shown.length ? <Empty>مفيش باندل مطابق للبحث.</Empty> : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map(({ b, by, total }) => (
            <button key={b.id} type="button" onClick={() => setOpen(b)} className="rounded-2xl border border-line bg-surface p-4 text-start shadow-card transition hover:border-accent focus-visible:ring-2 focus-visible:ring-accent">
              <div className="flex items-start gap-3">
                <BundlePic d={d} b={b} size={64} />
                <div className="min-w-0 flex-1">
                  <b className="block break-words text-sm leading-snug">{b.title}</b>
                  {b.unknown ? <span className="mt-1 block text-xs text-muted">{b.unknown}</span> : <span className="num mt-1 block break-words text-xs text-muted" dir="ltr">{bundleLine(b.variants[0])}{b.variants.length > 1 ? ` · ${b.variants.length} تركيبة ألوان` : ''}</span>}
                  <span className="mt-1 flex flex-wrap gap-1">{(share.get(b.id)?.length ?? 0) > 0 && <Pill tone="warn" title={share.get(b.id)!.map((x) => x.title).join('\n')}>بيشارك قطعه مع {share.get(b.id)!.length} باندل</Pill>}{b.custom && <Pill>اتعمل هنا</Pill>}{b.available === false && <Pill>غير متاح في الموقع</Pill>}</span>
                </div>
                {b.unknown ? <Pill tone="warn">مش محسوب</Pill> : <div className={cn('shrink-0 rounded-xl px-3 py-1.5 text-center', tone(total))}><div className="num text-xl font-semibold leading-none">{fmt(total)}</div><div className="mt-0.5 text-[10px] leading-tight">أوردر<br />لوحده</div></div>}
              </div>
              {!b.unknown && (
                <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${by.length}, minmax(0, 1fr))` }} aria-label="الأوردرات لكل مقاس">
                  {by.map((r) => <div key={r.size} onMouseEnter={(e) => tip.show(e, r)} onMouseLeave={tip.hide} className="grid justify-items-center gap-1 text-center"><span className="text-[11px] font-semibold text-muted">{r.size}</span><span className={cn('num w-full rounded-lg py-1 text-sm', tone(r.max))}>{fmt(r.max)}</span></div>)}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      {list && <BundleList d={d} kind={list} rows={rows} onOpen={setOpen} onClose={() => setList(null)} />}
      <SizeTip tip={tip.tip} />
      {planner && <BundlePlanner d={d} all={all} room={room} onClose={() => setPlanner(false)} />}
      {open && <BundleSheet d={d} b={open} room={room} shared={share.get(open.id) ?? []} onClose={() => setOpen(null)} onEdit={() => { setEdit(open); setOpen(null); }} />}
      {edit && <BundleEditor d={d} initial={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

type ListKind = 'all' | 'ok' | 'out' | 'unknown';
type BundleRow = { b: Bundle; by: ReturnType<typeof bundleBySize>; total: number };
const LISTS: Record<ListKind, { title: string; hint: string; empty: string }> = {
  all: { title: 'كل الباندلز', hint: 'الأكتر أوردرات الأول. اضغط على باندل تشوف اللي جواه.', empty: 'مفيش باندلز.' },
  ok: { title: 'الباندلز اللي تقدر تطلّع منها', hint: 'فيها مخزون يكفي أوردر على الأقل. الأكتر أوردرات الأول.', empty: 'ولا باندل فيه مخزون يكفي.' },
  out: { title: 'الباندلز اللي خلصت', hint: 'ولا مقاس منها يتطلّع أوردر. تحت كل واحد المقاس والموديل اللي ناقص.', empty: 'ولا باندل خلص.' },
  unknown: { title: 'باندلز تركيبتها مش واضحة', hint: 'مش محسوبة لأن الموقع مش مفصّل اللي جواها. افتح الباندل واضغط «حدد التركيبة».', empty: 'كل الباندلز تركيبتها واضحة.' },
};
/** the bundles behind one of the cards above, each opening its own details */
function BundleList({ d, kind, rows, onOpen, onClose }: { d: Derived; kind: ListKind; rows: BundleRow[]; onOpen: (b: Bundle) => void; onClose: () => void }) {
  const m = LISTS[kind];
  const list = rows.filter(({ b, total }) => (kind === 'all' ? true : kind === 'unknown' ? !!b.unknown : kind === 'ok' ? !b.unknown && total > 0 : !b.unknown && total === 0)).sort((a, c) => c.total - a.total);
  return (
    <Sheet wide title={`${m.title} (${fmt(list.length)})`} onClose={onClose}>
      <p className="text-sm text-muted">{m.hint}</p>
      {!list.length ? <Empty>{m.empty}</Empty> : (
        <div className="grid gap-2">
          {list.map(({ b, by, total }) => {
            const short = by.filter((r) => r.max === 0).map((r) => `${r.size}${r.best?.limiting ? ` ← ${r.best.limiting.comp.model}` : ''}`);
            return (
              <button key={b.id} type="button" onClick={() => onOpen(b)} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 text-start transition hover:border-accent">
                <BundlePic d={d} b={b} size={48} />
                <span className="min-w-0 flex-1">
                  <b className="block break-words text-sm leading-snug">{b.title}</b>
                  {b.unknown ? <span className="text-xs text-muted">{b.unknown}</span> : <span className="num block break-words text-xs text-muted" dir="ltr">{bundleLine(b.variants[0])}</span>}
                  {!b.unknown && short.length > 0 && total > 0 && <span className="mt-0.5 block text-xs text-crit">ناقص في: {short.join('، ')}</span>}
                  {kind === 'out' && short.length > 0 && <span className="mt-0.5 block text-xs text-crit">{short.slice(0, 8).join('، ')}</span>}
                </span>
                {b.unknown ? <Pill tone="warn">مش محسوب</Pill> : <span className={cn('shrink-0 rounded-xl px-3 py-1.5 text-center', tone(total))}><span className="num block text-lg font-semibold leading-none">{fmt(total)}</span><span className="block text-[10px]">أوردر</span></span>}
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

function BundleSheet({ d, b, room, shared, onClose, onEdit }: { d: Derived; b: Bundle; room: Stockroom; shared: Bundle[]; onClose: () => void; onEdit: () => void }) {
  const act = useAct(); const file = useRef<HTMLInputElement>(null); const tip = useTip();
  const by = useMemo(() => (b.unknown ? [] : bundleBySize(b, room)), [b, room]);
  const first = by.find((r) => r.max > 0) ?? by[0];   // opens on the weakest combination of the first size that has orders
  const [vi, setVi] = useState(() => Math.max(0, first?.best ? first.variants.indexOf(first.best) : 0)); const [size, setSize] = useState(() => first?.size ?? b.sizes[0] ?? '');
  const sel = by.find((r) => r.size === size)?.variants[vi] ?? by[0]?.variants[0];
  const mine = d.snap.bundles.some((x) => x.id === b.id);
  return (
    <Sheet wide title={b.title} onClose={onClose}>
      <div className="flex flex-wrap items-start gap-3">
        <BundlePic d={d} b={b} size={160} />
        <div className="grid min-w-0 flex-1 gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {b.custom ? <Pill>اتعمل هنا</Pill> : <Pill tone={b.available ? 'good' : 'neutral'}>{b.available ? 'متاح في الموقع' : 'غير متاح في الموقع'}</Pill>}
            {b.url && <a className="inline-flex items-center gap-1 text-sm text-accent underline-offset-2 hover:underline" href={b.url} target="_blank" rel="noreferrer noopener">صفحة الباندل <ExternalLink className="size-3.5" /></a>}
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) await act(() => repo.setModelImage(`bundle:${b.id}`, f), 'تم حفظ الصورة'); }} />
            <Button onClick={() => file.current?.click()}><Camera className="size-4" />{d.snap.bundleImages[b.id] ? 'تغيير الصورة' : 'رفع صورة'}</Button>
            {d.snap.bundleImages[b.id] && <Button onClick={() => act(() => repo.setModelImage(`bundle:${b.id}`, null), 'تمت إزالة الصورة')}><X className="size-4" />إزالة صورتي</Button>}
            {(b.custom || b.unknown) && <Button onClick={onEdit}><Pencil className="size-4" />{b.unknown ? 'حدد التركيبة' : 'تعديل'}</Button>}
            {mine && <Button variant="danger" onClick={async () => { if (window.confirm(b.custom && !BUNDLES.some((x) => x.id === b.id) ? 'تحذف الباندل ده؟' : 'تشيل تركيبتك وترجع للي في الموقع؟')) { await act(() => repo.bundleRemove(b.id), 'تم'); onClose(); } }}><Trash2 className="size-4" />{BUNDLES.some((x) => x.id === b.id) ? 'رجّع للموقع' : 'حذف'}</Button>}
          </div>
        </div>
      </div>
      {shared.length > 0 && <Alert tone="warn">الأرقام دي لو بعت الباندل ده <b>لوحده</b>. بيسحب من نفس قطع {shared.length} باندل تانيين: {shared.slice(0, 5).map((x) => x.title).join('، ')}{shared.length > 5 ? ` و${shared.length - 5} غيرهم` : ''}. استخدم «وزّع المخزون» للرقم الحقيقي.</Alert>}
      {b.unknown ? <Card><Empty>{b.unknown}<span className="block">اضغط «حدد التركيبة» وسجّل اللي جواه.</span></Empty></Card> : <>
        <Card title="تقدر تطلّع كام أوردر" hint="من الجاهز للبيع. اضغط على رقم تشوف اللي جوه الباندل في المقاس ده.">
          <TableWrap><table className="w-full table-fixed text-sm">
            <thead><tr><th className={th + ' w-28 sm:w-36'}>{b.variants.length > 1 ? 'التركيبة' : ''}</th>{b.sizes.map((z) => <th key={z} className={th + ' text-center'}>{z}</th>)}</tr></thead>
            <tbody>{b.variants.map((v, i) => (
              <tr key={i} className={cn(i === vi && b.variants.length > 1 && 'bg-lav')}>
                <td className={td}>{b.variants.length > 1 ? <button type="button" className="text-start text-xs underline-offset-2 hover:underline" onClick={() => setVi(i)}>{v.label || `تركيبة ${i + 1}`}</button> : <span className="text-muted">كل الباندل</span>}</td>
                {by.map((r) => <td key={r.size} className={td + ' px-1 text-center'}><button type="button" onMouseEnter={(e) => tip.show(e, r)} onMouseLeave={tip.hide} onFocus={(e) => tip.show(e, r)} onBlur={tip.hide} onClick={() => { setSize(r.size); setVi(i); }} className={cn('num w-full rounded-lg py-1', tone(r.variants[i].max), r.size === size && i === vi && 'ring-2 ring-accent')}>{fmt(r.variants[i].max)}</button></td>)}
              </tr>))}
              {b.variants.length > 1 && <tr><td className={td}><b className="text-xs">اللي تضمنه</b><span className="block text-[10px] text-muted">أقل رقم بين التركيبات، لأن العميل يختار أي تركيبة</span></td>{by.map((r) => <td key={r.size} className={td + ' num text-center font-semibold'}>{fmt(r.max)}</td>)}</tr>}
            </tbody></table></TableWrap>
          <p className="num mt-2 text-sm">المجموع على كل المقاسات (لو بعته لوحده): <b>{fmt(bundleTotal(by))}</b> أوردر</p>
        </Card>
        {sel && <Card title={`اللي جوه الباندل · مقاس ${size}${b.variants.length > 1 ? ` · ${b.variants[vi]?.label}` : ''}`} hint="القطعة الأقل رصيدًا هي اللي بتحدد عدد الأوردرات.">
          <TableWrap><table className="text-sm">
            <thead><tr><th className={th}>الموديل</th><th className={th}>في الأوردر</th><th className={th}>الألوان والرصيد (مقاس {size})</th><th className={th}>يكفي</th></tr></thead>
            <tbody>{sel.comps.map((c, i) => (
              <tr key={i} className={c === sel.limiting ? 'bg-warn-bg/40' : ''}>
                <td className={td + ' font-mono font-semibold'}>{c.comp.model}</td>
                <td className={td + ' num'}>{c.comp.qty} قطعة{c.comp.any ? ' (أي لون)' : ''}</td>
                <td className={td}><div className="flex flex-wrap gap-1.5">{c.colors.map((col) => <span key={col} className={cn('num rounded-lg px-2 py-0.5 text-xs', tone(c.have[col]))}>{col} {fmt(c.have[col])}</span>)}{c.missing.length > 0 && <Pill tone="crit" title="مش موجود في الكتالوج">{c.missing.join('، ')} مش في المخزون</Pill>}</div></td>
                <td className={td + ' num font-semibold'}>{fmt(c.max)}</td>
              </tr>))}</tbody></table></TableWrap>
          {sel.limiting && <p className="mt-2 text-sm text-muted">الأضعف: <b className="font-mono text-ink">{sel.limiting.comp.model}</b>{sel.max === 0 ? ' خلص أو ناقص ألوان' : ''}.</p>}
        </Card>}
      </>}
      <SizeTip tip={tip.tip} />
    </Sheet>
  );
}

/** shares the pieces of one size out between the bundles you pick: what each can really fill when they are sold together */
function BundlePlanner({ d, all, room, onClose }: { d: Derived; all: Bundle[]; room: Stockroom; onClose: () => void }) {
  const products = useMemo(() => productsOf(all), [all]);
  const models = useMemo(() => [...new Set(all.flatMap((b) => bundleModels(b)))], [all]);
  const sizes = useMemo(() => d.snap.sizes.filter((z) => z !== 'FREE' && all.some((b) => b.sizes.includes(z))), [d.snap.sizes, all]);
  const [size, setSize] = useState(sizes[0] ?? 'M'); const [rows, setRows] = useState<{ key: string; n: number }[]>([]);
  const supply = useMemo(() => supplyOf(room, size, models), [room, size, models]);
  const res = useMemo(() => plan(products, rows, size, room, supply), [products, rows, size, room, supply]);
  const byKey = new Map(products.map((p) => [p.key, p]));
  const free = products.filter((p) => !rows.some((r) => r.key === p.key));
  return (
    <Sheet wide title="وزّع المخزون على الباندلز" onClose={onClose}>
      <p className="text-sm text-muted">اختار المقاس، وضيف الباندلز اللي هتبيعها مع بعض، واكتب كام أوردر من كل واحد. كل صف بياخد قطعه من نفس المخزون، فبتشوف أقصى رقم ممكن لكل باندل مع الباقي.</p>
      <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted">المقاس</span><Seg label="المقاس" value={size} onChange={(z) => setSize(z)} options={sizes.map((z): [string, string] => [z, z])} /></div>
      <div className="grid gap-2">
        {rows.map((r, i) => {
          const p = byKey.get(r.key); const x = res.rows[i]; if (!p || !x) return null;
          return (
            <div key={r.key} className={cn('grid gap-2 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_6rem_auto]', x.ok ? 'border-line' : 'border-crit-line bg-crit-bg/40')}>
              <div className="min-w-0"><b className="block break-words text-sm leading-snug">{p.title}</b><span className="num text-xs text-muted" dir="ltr">{bundleLine(p.variant)}</span></div>
              <input type="number" min={0} aria-label="عدد الأوردرات" value={r.n} onChange={(e) => setRows((l) => l.map((y, j) => (j === i ? { ...y, n: Math.max(0, Math.floor(+e.target.value || 0)) } : y)))} />
              <div className="flex items-center gap-2"><span className={cn('num rounded-lg px-2 py-1 text-xs', tone(x.max))}>أقصى ممكن مع الباقي: {fmt(x.max)}</span><Button aria-label="شيل" onClick={() => setRows((l) => l.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button></div>
              {!x.ok && <p className="text-xs text-crit sm:col-span-3">المخزون مش بيكفي {fmt(r.n)} أوردر من ده مع اللي فوقه. أقصى ممكن {fmt(x.max)}.</p>}
            </div>
          );
        })}
        {!rows.length && <Empty>لسه ما ضفتش باندلز. اختار من تحت.</Empty>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="إضافة باندل" value="" onChange={(e) => { if (e.target.value) setRows((l) => [...l, { key: e.target.value, n: 0 }]); }} className="min-w-52 max-w-full flex-1">
          <option value="">+ ضيف باندل</option>
          {free.map((p) => <option key={p.key} value={p.key}>{p.title}</option>)}
        </select>
        <Button disabled={rows.length < 2} onClick={() => { const t = balanced(products, rows.map((r) => r.key), size, room, supply); setRows((l) => l.map((r) => ({ ...r, n: t }))); }}>وزّع بالتساوي</Button>
        <Button disabled={!rows.length} onClick={() => setRows([])}>مسح</Button>
      </div>
      <Card title="الإجمالي">
        <p className="num text-sm">مجموع الأوردرات في مقاس {size}: <b className="text-lg">{fmt(res.total)}</b>{rows.some((_, i) => !res.rows[i]?.ok) && <span className="text-crit"> (من غير الصفوف اللي المخزون مش بيكفيها)</span>}</p>
        <p className="mt-1 text-xs text-muted">«وزّع بالتساوي» بيحط نفس العدد لكل الباندلز المختارة، وهو أكبر عدد بيكفيهم كلهم مع بعض.</p>
      </Card>
    </Sheet>
  );
}

type Row = { model: string; qty: number; mode: 'any' | 'all' | 'pick'; colors: string[] };
const toRow = (c: BundleComp): Row => ({ model: c.model, qty: c.qty, mode: c.any ? 'any' : c.colors ? 'pick' : 'all', colors: c.colors ?? [] });

/** a new bundle from any models, or the composition of one the store does not spell out */
function BundleEditor({ d, initial, onClose }: { d: Derived; initial: Bundle | null; onClose: () => void }) {
  const act = useAct();
  const models = d.snap.models; const sizes = d.snap.sizes;
  const colorsOf = (m: string) => [...new Set(d.snap.skus.filter((s) => s.model === m).map((s) => s.color))];
  const [title, setTitle] = useState(initial?.title ?? '');
  const [pick, setPick] = useState<string[]>(initial?.sizes ?? sizes.filter((z) => z !== 'FREE'));
  const [rows, setRows] = useState<Row[]>(initial && initial.variants[0]?.comps.length ? initial.variants[0].comps.map(toRow) : [{ model: models[0]?.code ?? '', qty: 1, mode: 'any', colors: [] }]);
  const set = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const bad = !title.trim() ? 'اكتب اسم الباندل' : !pick.length ? 'اختر مقاسًا واحدًا على الأقل' : rows.some((r) => !r.model || r.qty < 1) ? 'كل قطعة لها موديل وعدد' : rows.some((r) => r.mode === 'pick' && !r.colors.length) ? 'اختر لونًا واحدًا على الأقل أو غيّر الاختيار' : '';
  const save = async () => {
    const comps: BundleComp[] = rows.map((r) => (r.mode === 'any' ? { model: r.model, qty: r.qty, any: true } : r.mode === 'all' ? { model: r.model, qty: r.qty, colors: null } : { model: r.model, qty: r.qty, colors: r.colors }));
    const b: Bundle = { ...(initial ?? {}), id: initial?.id ?? `c-${Date.now().toString(36)}`, title: title.trim(), type: 'custom', price: 0, was: 0, url: initial?.url ?? '', available: initial?.available ?? true, sizes: sizes.filter((z) => pick.includes(z)), variants: [{ label: '', comps }], custom: true, unknown: undefined };
    delete b.unknown;
    const ok = await act(() => repo.bundleSave(b), 'تم حفظ الباندل'); if (ok !== undefined) onClose();
  };
  return (
    <Sheet title={initial ? (initial.unknown ? 'تركيبة الباندل' : 'تعديل الباندل') : 'باندل جديد'} onClose={onClose} footer={<div className="flex items-center gap-2"><Button variant="primary" disabled={!!bad} onClick={save}>حفظ الباندل</Button>{bad && <span className="text-xs text-muted">{bad}</span>}</div>}>
      <Field label="اسم الباندل"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلًا: باندل ٤ قطع برا + ٤ بانتي" /></Field>
      <div>
        <div className="mb-1.5 text-xs font-medium text-muted">المقاسات</div>
        <div className="flex flex-wrap gap-1.5">{sizes.map((z) => <Chip key={z} pressed={pick.includes(z)} onClick={() => setPick((p) => (p.includes(z) ? p.filter((x) => x !== z) : [...p, z]))}>{z}</Chip>)}</div>
      </div>
      <div className="grid gap-3">
        <div className="text-xs font-medium text-muted">اللي جوه الباندل</div>
        {rows.map((r, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-line p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_5rem_auto] items-end gap-2">
              <Field label="الموديل"><select value={r.model} onChange={(e) => set(i, { model: e.target.value, colors: [] })}>{models.map((m) => <option key={m.code} value={m.code}>{m.code} · {m.name}</option>)}</select></Field>
              <Field label="كام قطعة"><input type="number" min={1} value={r.qty} onChange={(e) => set(i, { qty: Math.max(1, Math.floor(+e.target.value || 1)) })} /></Field>
              <Button className="mb-0.5" aria-label="شيل القطعة دي" disabled={rows.length < 2} onClick={() => setRows((x) => x.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip pressed={r.mode === 'any'} onClick={() => set(i, { mode: 'any' })}>أي لون</Chip>
              <Chip pressed={r.mode === 'all'} onClick={() => set(i, { mode: 'all' })}>لون من كل لون</Chip>
              <Chip pressed={r.mode === 'pick'} onClick={() => set(i, { mode: 'pick' })}>ألوان محددة</Chip>
            </div>
            {r.mode === 'pick' && <div className="flex flex-wrap gap-1.5">{colorsOf(r.model).map((c) => <Chip key={c} pressed={r.colors.includes(c)} onClick={() => set(i, { colors: r.colors.includes(c) ? r.colors.filter((x) => x !== c) : [...r.colors, c] })}>{c}</Chip>)}</div>}
          </div>
        ))}
        <Button onClick={() => setRows((r) => [...r, { model: models[0]?.code ?? '', qty: 1, mode: 'any', colors: [] }])}><Plus className="size-4" />قطعة من موديل تاني</Button>
      </div>
      <p className="text-xs text-muted">«أي لون»: أي قطع من الموديل. «لون من كل لون»: قطعة من كل لون في الموديل. «ألوان محددة»: قطعة من كل لون من اللي تختاره.</p>
    </Sheet>
  );
}
