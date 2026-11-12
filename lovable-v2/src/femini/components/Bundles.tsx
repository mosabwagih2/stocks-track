import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Card, Empty, Kpi, Pill, Seg, Sheet, TableWrap, th, td } from '@/femini/components/ui';
import { BUNDLES } from '@/femini/data/bundles.generated';
import { bundleBySize, bundleLine, bundleModels, bundleTotal, normColor, type Bundle, type Stockroom } from '@/femini/domain/bundles';
import { qty } from '@/femini/domain/ledger';
import { cn, fmt } from '@/femini/cn';
import type { Derived } from '@/femini/hooks/data';

/** a count of orders: red none, amber a few, green enough */
const tone = (n: number) => (n <= 0 ? 'bg-crit-bg text-crit' : n <= 3 ? 'bg-warn-bg text-warn' : 'bg-good-bg text-ink');

type Basis = 'ready' | 'net';

/** the stock as the bundles see it: (model, color, size) → the pieces ready, less the open orders' when asked */
function useRoom(d: Derived, basis: Basis): Stockroom {
  return useMemo(() => {
    const by = new Map<string, string>(); const colors = new Map<string, string[]>();
    for (const s of d.snap.skus) {
      by.set(`${s.model}|${normColor(s.color)}|${s.size}`, s.id);
      const l = colors.get(s.model) ?? []; if (!l.includes(s.color)) l.push(s.color); colors.set(s.model, l);
    }
    return {
      colorsOf: (m) => colors.get(m) ?? [],
      have: (m, c, z) => { const id = by.get(`${m}|${normColor(c)}|${z}`); if (!id) return null; const r = qty(d.snap.balances, id, 'READY'); return basis === 'net' ? r - (d.demand[id] ?? 0) : r; },
    };
  }, [d, basis]);
}

/** the bundles of the store, each with the orders the stock can fill: the scarcest piece decides */
export function BundlesView({ d, q }: { d: Derived; q: string }) {
  const [basis, setBasis] = useState<Basis>('ready'); const [open, setOpen] = useState<Bundle | null>(null);
  const room = useRoom(d, basis);
  const rows = useMemo(() => BUNDLES.map((b) => { const by = b.unknown ? [] : bundleBySize(b, room); return { b, by, total: bundleTotal(by) }; }), [room]);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = rows.filter(({ b }) => !words.length || words.every((w) => `${b.title} ${bundleModels(b).join(' ')}`.toLowerCase().includes(w))).sort((a, c) => (a.b.unknown ? 1 : 0) - (c.b.unknown ? 1 : 0) || c.total - a.total);
  const known = rows.filter((r) => !r.b.unknown);
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="باندلز في الموقع" value={fmt(BUNDLES.length)} sub={`${fmt(BUNDLES.filter((b) => b.available).length)} متاح للبيع`} />
        <Kpi label="تقدر تطلّع منها" value={fmt(known.filter((r) => r.total > 0).length)} sub="باندل فيه مخزون يكفي أوردر" tone="good" />
        <Kpi label="خلصت" value={fmt(known.filter((r) => r.total === 0).length)} sub="ولا أوردر يتطلّع منها" tone={known.some((r) => r.total === 0) ? 'crit' : undefined} />
        <Kpi label="تركيبتها مش واضحة" value={fmt(BUNDLES.filter((b) => b.unknown).length)} sub="مش محسوبة" tone={BUNDLES.some((b) => b.unknown) ? 'warn' : undefined} />
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Seg label="حساب الأوردرات" value={basis} onChange={setBasis} options={[['ready', 'من الجاهز'], ['net', 'بعد الطلب المفتوح']]} />
        <p className="text-xs text-muted">الرقم لكل باندل لوحده؛ القطع مشتركة بين الباندلز، فمتجمعش الأرقام.</p>
      </div>
      {!shown.length ? <Empty>مفيش باندل مطابق للبحث.</Empty> : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map(({ b, by, total }) => (
            <button key={b.id} type="button" onClick={() => setOpen(b)} className="rounded-2xl border border-line bg-surface p-4 text-start shadow-card transition hover:border-accent focus-visible:ring-2 focus-visible:ring-accent">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <b className="block break-words text-sm leading-snug">{b.title}</b>
                  <span className="num mt-1 block text-xs text-muted">{fmt(b.price)} جنيه{b.was > b.price ? <> · بدل <s>{fmt(b.was)}</s></> : null}{!b.available && ' · غير متاح في الموقع'}</span>
                </div>
                {b.unknown ? <Pill tone="warn">مش محسوب</Pill> : <div className={cn('shrink-0 rounded-xl px-3 py-1.5 text-center', tone(total))}><div className="num text-xl font-semibold leading-none">{fmt(total)}</div><div className="mt-0.5 text-[10px]">أوردر</div></div>}
              </div>
              {b.unknown ? <p className="mt-2 text-xs text-muted">{b.unknown}</p> : <>
                <p className="num mt-2 break-words text-xs text-muted" dir="ltr">{bundleLine(b.variants[0])}{b.variants.length > 1 ? ` · ${b.variants.length} تركيبة ألوان` : ''}</p>
                <div className="mt-3 flex flex-wrap gap-1.5" aria-label="الأوردرات لكل مقاس">
                  {by.map((r) => <span key={r.size} className={cn('num rounded-lg px-2 py-1 text-xs', tone(r.max))}><b className="font-semibold">{r.size}</b> {fmt(r.max)}</span>)}
                </div>
              </>}
            </button>
          ))}
        </div>
      )}
      {open && <BundleSheet d={d} b={open} room={room} basis={basis} onClose={() => setOpen(null)} />}
    </>
  );
}

function BundleSheet({ b, room, basis, onClose }: { d: Derived; b: Bundle; room: Stockroom; basis: Basis; onClose: () => void }) {
  const by = useMemo(() => (b.unknown ? [] : bundleBySize(b, room)), [b, room]);
  const [vi, setVi] = useState(0); const [size, setSize] = useState(() => by.find((r) => r.max > 0)?.size ?? b.sizes[0] ?? '');
  const sel = by.find((r) => r.size === size)?.variants[vi] ?? by[0]?.variants[0];
  return (
    <Sheet wide title={b.title} onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={b.available ? 'good' : 'neutral'}>{b.available ? 'متاح في الموقع' : 'غير متاح في الموقع'}</Pill>
        <span className="num text-sm">{fmt(b.price)} جنيه{b.was > b.price ? <> · بدل <s className="text-muted">{fmt(b.was)}</s></> : null}</span>
        <a className="ms-auto inline-flex items-center gap-1 text-sm text-accent underline-offset-2 hover:underline" href={b.url} target="_blank" rel="noreferrer noopener">صفحة الباندل <ExternalLink className="size-3.5" /></a>
      </div>
      {b.unknown ? <Card><Empty>{b.unknown}<span className="block">لو بعتّلي تركيبته أحسبه.</span></Empty></Card> : <>
        <Card title="تقدر تطلّع كام أوردر" hint={basis === 'net' ? 'من الجاهز بعد خصم الطلب المفتوح' : 'من الجاهز للبيع'}>
          <TableWrap><table className="text-sm">
            <thead><tr><th className={th}>{b.variants.length > 1 ? 'التركيبة' : ''}</th>{b.sizes.map((z) => <th key={z} className={th + ' text-center'}>{z}</th>)}</tr></thead>
            <tbody>{b.variants.map((v, i) => (
              <tr key={i} className={cn(i === vi && b.variants.length > 1 && 'bg-lav')}>
                <td className={td}>{b.variants.length > 1 ? <button type="button" className="text-start underline-offset-2 hover:underline" onClick={() => setVi(i)}>{v.label || `تركيبة ${i + 1}`}</button> : <span className="text-muted">كل الباندل</span>}</td>
                {by.map((r) => <td key={r.size} className={td + ' text-center'}><button type="button" onClick={() => { setSize(r.size); setVi(i); }} className={cn('num min-w-10 rounded-lg px-2 py-1', tone(r.variants[i].max), r.size === size && i === vi && 'ring-2 ring-accent')}>{fmt(r.variants[i].max)}</button></td>)}
              </tr>))}
              {b.variants.length > 1 && <tr><td className={td}><b>أحسن تركيبة</b></td>{by.map((r) => <td key={r.size} className={td + ' num text-center font-semibold'}>{fmt(r.max)}</td>)}</tr>}
            </tbody></table></TableWrap>
          <p className="num mt-2 text-sm">المجموع على كل المقاسات: <b>{fmt(bundleTotal(by))}</b> أوردر</p>
        </Card>
        {sel && <Card title={`اللي جوه الباندل · مقاس ${size}${b.variants.length > 1 ? ` · ${b.variants[vi]?.label}` : ''}`} hint="القطعة الأقل رصيدًا هي اللي بتحدد عدد الأوردرات.">
          <TableWrap><table className="text-sm">
            <thead><tr><th className={th}>الموديل</th><th className={th}>في الأوردر</th><th className={th}>الألوان والرصيد (مقاس {size})</th><th className={th}>يكفي</th></tr></thead>
            <tbody>{sel.comps.map((c, i) => (
              <tr key={i} className={c === sel.limiting && sel.max < 1e9 ? 'bg-warn-bg/40' : ''}>
                <td className={td + ' font-mono font-semibold'}>{c.comp.model}</td>
                <td className={td + ' num'}>{c.comp.qty} قطعة{c.comp.any ? ' (أي لون)' : ''}</td>
                <td className={td}><div className="flex flex-wrap gap-1.5">{c.colors.map((col) => <span key={col} className={cn('num rounded-lg px-2 py-0.5 text-xs', tone(c.have[col]))}>{col} {fmt(c.have[col])}</span>)}{c.missing.length > 0 && <Pill tone="crit" title="مش موجود في الكتالوج">{c.missing.join('، ')} مش في المخزون</Pill>}</div></td>
                <td className={td + ' num font-semibold'}>{fmt(c.max)}</td>
              </tr>))}</tbody></table></TableWrap>
          {sel.limiting && sel.max < 1e9 && <p className="mt-2 text-sm text-muted">الأضعف: <b className="font-mono text-ink">{sel.limiting.comp.model}</b>{sel.max === 0 ? ' خلص أو ناقص ألوان' : ''}.</p>}
        </Card>}
      </>}
    </Sheet>
  );
}
