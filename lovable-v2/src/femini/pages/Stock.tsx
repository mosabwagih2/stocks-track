import Supplies from './Supplies';
import { Archive, Check, Pencil, Plus, X } from 'lucide-react';
import { useSearchParams } from '@/femini/router';
import { useDeferredValue, useMemo, useState } from 'react';
import { useDerived, useAct, VELOCITY_DAYS } from '@/femini/hooks/data';
import { PageHead } from '@/femini/components/PageHead';
import { Button, Card, Chip, Dot, Empty, Field, Kpi, Pill, Seg, Sheet, TableWrap, th, td } from '@/femini/components/ui';
import { ErrorBox } from '@/femini/components/shared';
import { ModelImageSheet, Thumb } from '@/femini/components/Thumb';
import { ArchivedList, EditCatalogSheet, NewModelSheet } from '@/femini/components/CatalogSheets';
import { Progressive } from '@/femini/components/Deferred';
import { Heatmap } from '@/femini/components/charts';
import { Spinner } from '@/femini/components/Spinner';
import { LOCS, LOC_AR, LOC_COLOR, LOC_HINT, lineBase } from '@/femini/domain/constants';
import { locTotal, qty, totalOwned } from '@/femini/domain/ledger';
import { cellInfo, coverLabel } from '@/femini/domain/stock';
import { NEXT } from '@/femini/domain/flow';
import { cn, fmt } from '@/femini/cn';
import { skuLabel } from '@/femini/domain/orders';
import { swatchOf } from '@/femini/components/swatch';
import { repo } from '@/femini/data';
import type { Derived } from '@/femini/hooks/data';
import type { Loc, Sku } from '@/femini/domain/types';

const Swatch = ({ c }: { c: string }) => <i className="inline-block size-3 rounded-full border border-line2 align-[-1px]" style={{ background: swatchOf(c) }} />;
const OTHER = 'موديلات أخرى';
const lineOf = (m: string) => { const b = lineBase(m); return /^PAN/.test(b) ? 'بانتي' : /^BR/.test(b) ? 'برا' : /^SH/.test(b) ? 'شورت' : OTHER; };
const LINES = ['بانتي', 'برا', 'شورت'];

/** Cell color = signal. READY: red critical, amber low, green healthy, blue surplus, gray empty. Other states: the state's own color. */
function cellTone(loc: Loc, v: number, info: ReturnType<typeof cellInfo>): string {
  if (loc !== 'READY') {
    if (v <= 0) return 'bg-grid text-muted';
    return { DIRTY: 'bg-warn-bg border-warn-line', FACTORY: 'bg-info-bg border-info-line', SCRAP: 'bg-crit-bg border-crit-line', LOST: 'bg-lost-bg border-lost-bg' }[loc as 'DIRTY'];
  }
  if (v < 0 || info.level === 'crit') return 'bg-crit-bg text-crit border-crit-line';
  if (info.level === 'warn') return 'bg-warn-bg text-warn border-warn-line';
  if (v === 0) return 'bg-grid text-muted';
  if (info.surplus) return 'bg-info-bg border-info-line';
  return 'bg-good-bg border-good-line';
}
const Key = ({ cls, children }: { cls: string; children: string }) => <span className="inline-flex items-center gap-1.5"><i className={`inline-block size-3.5 rounded border ${cls}`} />{children}</span>;

/** a small line in a matrix cell: the number at the right edge, its word at the left edge (so every cell lines up); a text with no number stays centered */
function CellLine({ num, word, text }: { num?: string; word?: string; text?: string }) {
  if (num == null) { const m = /^(~?\+?\d+)\s+(.+)$/.exec(text ?? ''); if (m) { num = m[1]; word = m[2]; } }
  if (num == null) return <small className="whitespace-nowrap text-center font-sans text-[10px] leading-none opacity-80">{text}</small>;
  return <small className="flex w-full items-baseline justify-between gap-1 whitespace-nowrap font-sans text-[10px] leading-none opacity-80"><span className="num">{num}</span><span>{word}</span></small>;
}

function Matrix({ d, model, loc, onCell }: { d: Derived; model: string; loc: Loc; onCell: (s: Sku) => void }) {
  const skus = d.snap.skus.filter((s) => s.model === model);
  const colors = [...new Set(skus.map((s) => s.color))]; const sizes = d.snap.sizes.filter((z) => skus.some((s) => s.size === z));
  const by = new Map(skus.map((s) => [`${s.color}|${s.size}`, s]));
  return (
    <div className="overflow-x-auto rounded-xl border border-line p-2">
      <table className="border-separate border-spacing-1.5 w-auto">
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
                  const tone = cellTone(loc, v, info); const cover = loc === 'READY' ? coverLabel(info, !d.velocityOK) : '';
                  return (
                    <td key={z}>
                      <button type="button" onClick={() => onCell(s)} aria-label={`${skuLabel(d.skuMap, s.id)}: ${v}`}
                        title={`${cover ? `يكفي ${cover.replace('~', 'تقريبًا ')} (سحب ${info.velocity.toFixed(1)} قطعة في اليوم)\n` : ''}${LOCS.filter((l) => qty(d.snap.balances, s.id, l)).map((l) => `${LOC_AR[l]} ${qty(d.snap.balances, s.id, l)}`).join(' · ') || 'لا يوجد رصيد'}${info.demand ? `\nطلب مفتوح ${info.demand}` : ''}`}
                        className={cn('relative flex min-w-16 flex-col items-center justify-center rounded-[10px]', loc === 'READY' ? 'h-16 gap-0.5 px-2' : 'h-11', ' border border-transparent font-mono text-[15px] font-medium hover:border-accent',
                          tone)}>
                        {/* the number first, then the open demand, then how many days it lasts */}
                        <span className="leading-none">{v}</span>
                        {loc === 'READY' && info.demand > 0 && <CellLine num={String(info.demand)} word="طلب" />}
                        {loc === 'READY' && <CellLine text={cover || 'بدون سحب'} />}
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

function SkuSheet({ d, sku, start, onClose }: { d: Derived; sku: Sku; start: Loc; onClose: () => void }) {
  const act = useAct(); const b = d.snap.balances; const info = cellInfo(sku, b, d.demand, d.velocity, d.velocityOK, 14);
  // starts from the state the stock page is showing (or the first one that has pieces), on its usual next step
  const first = qty(b, sku.id, start) > 0 ? start : (LOCS.find((l) => qty(b, sku.id, l) > 0) as Loc | undefined) ?? start;
  const [from, setFromState] = useState<Loc>(first); const [stepI, setStepI] = useState(0); const [q, setQ] = useState(1); const [reason, setReason] = useState('');
  const setFrom = (l: Loc) => { setFromState(l); setStepI(0); setQ(1); };
  const step = NEXT[from][stepI] ?? NEXT[from][0];
  const moves = d.snap.moves.filter((m) => m.sku === sku.id).slice(0, 15);
  const have = qty(b, sku.id, from);
  return (
    <Sheet title={skuLabel(d.skuMap, sku.id)} onClose={onClose}>
      <div className="flex items-center gap-3"><Thumb model={d.modelMap.get(sku.model)} size={104} /><div><b>{sku.model} · {d.modelMap.get(sku.model)?.name}</b><div className="text-muted"><Swatch c={sku.color} /> {sku.color} · مقاس {sku.size}</div></div></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="جاهز للبيع" value={fmt(info.ready)} tone={info.ready < 0 ? 'crit' : undefined} /><Kpi label="مطلوب (مفتوح)" value={fmt(info.demand)} tone={info.demand > info.ready ? 'crit' : undefined} />
        <Kpi label="سرعة السحب" value={info.velocity ? info.velocity.toFixed(1) : '—'} sub="قطعة / يوم" /><Kpi label="يغطّي" value={info.cover != null ? Math.floor(info.cover) : '—'} sub="يوم" />
      </div>
      <TableWrap><table className="text-sm"><tbody>
        {LOCS.map((l) => <tr key={l}><td className={td}><Dot className={LOC_COLOR[l]} /> {LOC_AR[l]} <span className="text-xs text-muted">{LOC_HINT[l]}</span></td><td className={td + ' font-mono'}>{fmt(qty(b, sku.id, l))}</td></tr>)}
        <tr><td className={td}><b>إجمالي الكمية المملوكة</b></td><td className={td + ' font-mono font-semibold'}>{fmt(totalOwned(b, sku.id))}</td></tr>
      </tbody></table></TableWrap>
      <Card title="النقل بين الحالات" hint="كل خطوة بتتسجل بعمليتها (تصنيف، إرسال للمصنع، استلام من المصنع، المفقود)">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="من"><select value={from} onChange={(e) => setFrom(e.target.value as Loc)}>{LOCS.map((l) => <option key={l} value={l}>{LOC_AR[l]}</option>)}</select></Field>
          <Field label="إلى"><select value={stepI} onChange={(e) => setStepI(+e.target.value)}>{NEXT[from].map((x, i) => <option key={i} value={i}>{x.label}</option>)}</select></Field>
          <Field label="الكمية"><input type="number" min={1} max={Math.max(1, have)} value={q} onChange={(e) => setQ(Math.max(1, Math.min(Math.max(1, have), Math.floor(+e.target.value || 1))))} /></Field>
          <Field label="السبب"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="بقعة..." /></Field>
        </div>
        <p className="mt-2 text-sm">{LOC_AR[from]}: <b className="font-mono">{fmt(have)}</b> ← <b className="font-mono">{fmt(have - q)}</b> {q > have && <Pill tone="crit">الكمية غير كافية</Pill>}</p>
        <div className="mt-3"><Button variant="primary" disabled={q > have || q < 1} onClick={async () => { const r = await act(() => repo.postOp({ type: step.op, date: d.today, hdr: step.hdr(reason.trim()), lines: [step.line(sku.id, q)] }), (x) => `تم تسجيل ${x.doc}`); if (r) onClose(); }}>تأكيد: {step.label}</Button></div>
      </Card>
      <h3 className="font-display font-semibold">آخر الحركات</h3>
      {moves.length ? <TableWrap><table className="text-sm"><tbody>{moves.map((m) => <tr key={m.id}><td className={td + ' font-mono text-muted'}>{m.date}</td><td className={td}>{m.note || m.type}<div className="text-xs text-muted">من {LOC_AR[m.from]} إلى {LOC_AR[m.to]} · <span className="font-mono">{m.doc}</span></div></td><td className={td + ' text-xs'}>{m.by}</td><td className={td + ' font-mono'}>{m.qty}</td></tr>)}</tbody></table></TableWrap> : <Empty>لا توجد حركات.</Empty>}
    </Sheet>
  );
}

export default function Stock() {
  const { d, isLoading, error } = useDerived();
  const [sp, setSp] = useSearchParams(); const v0 = sp.get('view'); // (the all-SKUs table was removed: an old link with view=table opens the models)
  const view: 'all' | 'map' | 'supplies' = v0 === 'map' || v0 === 'supplies' ? v0 : 'all';   // an old ?view=waste link lands on all models
  const setView = (v: string) => { const n = new URLSearchParams(sp); if (v === 'all') n.delete('view'); else n.set('view', v); setSp(n, { replace: true }); }; const [loc, setLoc] = useState<Loc>('READY');
  const [line, setLine] = useState('all'); const [otherModel, setOtherModel] = useState('all');
  const [q, setQ] = useState(''); const dq = useDeferredValue(q); const [archOpen, setArchOpen] = useState(false); const [sku, setSku] = useState<Sku | null>(null);
  const [supAdd, setSupAdd] = useState(0); const [supArch, setSupArch] = useState(false); const [imgModel, setImgModel] = useState<string | null>(null); const [catSheet, setCatSheet] = useState<'new' | null>(null); const [editModel, setEditModel] = useState<string | null>(null);
  const order = useMemo(() => (d ? d.modelOrder : []), [d]);
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !d) return <Spinner />;
  const mName = (c: string) => `${c} · ${d.modelMap.get(c)?.name ?? ''}`;
  const modelSum = (m: string, l: Loc) => d.snap.skus.reduce((a, s) => a + (s.model === m ? qty(d.snap.balances, s.id, l) : 0), 0);
  const modelDemand = (m: string) => d.snap.skus.reduce((a, s) => a + (s.model === m ? d.demand[s.id] ?? 0 : 0), 0);
  const words = dq.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const otherCodes = d ? d.modelOrder.filter((c) => lineOf(c) === OTHER) : [];
  const shown = order.filter((c) => (line === 'all' || lineOf(c) === line) && (line !== OTHER || otherModel === 'all' || c === otherModel) && (loc === 'READY' || modelSum(c,loc) !== 0) && (!words.length || d.snap.skus.some((s)=>s.model===c && words.every((w)=>`${c} ${mName(c)} ${s.color} ${s.size}`.toLowerCase().includes(w)))));
  const head = (c: string) => (
    <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={() => setImgModel(c)} aria-label={`صورة ${c}`} title="عرض الصورة أو تغييرها" className="relative"><Thumb model={d.modelMap.get(c)} size={84} /></button>
        <div className="min-w-0"><h2 className="break-words font-display text-base font-semibold">{mName(c)}</h2><span className="text-xs text-muted sm:text-sm">{LOC_AR[loc]}: <b className="font-mono">{fmt(modelSum(c, loc))}</b> قطعة · طلب مفتوح <span className="font-mono">{fmt(modelDemand(c))}</span></span></div>
      </div>
      <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
        <Pill>{d.pull[c] ? `المسحوب ${fmt(d.pull[c])} قطعة` : 'لا يوجد سحب'}</Pill>
        <Button className="h-11 shrink-0 px-3 sm:h-9" aria-label={`تعديل الموديل ${c}`} title={`تعديل الموديل ${c}`} onClick={() => setEditModel(c)}><Pencil className="size-4" /><span>تعديل</span></Button>
      </div>
    </div>
  );
  return (
    <>
      <PageHead title="المخزون" sub="متابعة الموديلات والأصناف ومستلزمات التغليف في مكان واحد." actionsClassName="flex w-full min-w-0 items-center gap-2">
        <div className="min-w-0 overflow-x-auto [&>div]:w-max [&_button]:whitespace-nowrap">
          <Seg value={view} onChange={setView} options={[['all', 'كل الموديلات'], ['supplies', 'المستلزمات'], ['map', 'خريطة المخزون']]} label="العرض" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="w-9">{view === 'supplies' && <Button className="size-9 p-0" aria-label={supArch ? 'المستلزمات الحالية' : `المؤرشفة (${d.snap.supplies.filter((s) => s.archived).length})`} title={supArch ? 'المستلزمات الحالية' : 'المستلزمات المؤرشفة'} onClick={() => setSupArch((x) => !x)}><Archive className="size-4" /></Button>}</div>
          {view !== 'supplies' && d.snap.archivedSkus.length > 0 && <Button onClick={() => setArchOpen(true)}><Archive className="size-4" />الأصناف المؤرشفة ({d.snap.archivedSkus.length})</Button>}
          <Button className="w-32 sm:w-36" variant="primary" onClick={() => view === 'supplies' ? setSupAdd((n) => n + 1) : setCatSheet('new')}><Plus className="size-4 shrink-0" />{view === 'supplies' ? 'إضافة مستلزم' : 'موديل جديد'}</Button>
        </div>
      </PageHead>
      {view === 'supplies' ? <Supplies embedded addSignal={supAdd} arch={supArch} setArch={setSupArch} /> : <>
      <div className="mb-3 border-b border-line pb-3">
        <div role="group" aria-label="حالات المخزون" className="flex flex-wrap gap-2 [&>button]:h-11 [&>button]:whitespace-nowrap">
          {LOCS.map((l) => <Button key={l} aria-pressed={loc === l} variant={loc === l ? 'primary' : 'default'} onClick={(e) => { setLoc(l === loc ? 'READY' : l); e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); }}><Dot className={LOC_COLOR[l]} />{LOC_AR[l]} <span className="font-mono text-xs opacity-75">{fmt(locTotal(d.snap.balances, l))}</span>{loc === l && <Check className="size-4" />}</Button>)}
        </div>
        <div className="mt-2 flex min-h-9 items-center justify-between gap-2 text-xs text-muted">
          <span>الرصيد المعروض: <b className="text-ink">{LOC_AR[loc]}</b></span>
          <Button size="sm" variant="ghost" className="h-9" disabled={loc === 'READY'} onClick={() => setLoc('READY')}><X className="size-3.5" />إلغاء الفلتر</Button>
        </div>
      </div>
      {view === 'map' ? (() => {
        const ms = shown.filter((c) => modelSum(c, loc) !== 0);
        const cell = new Map<string, number>();
        for (const s of d.snap.skus) { const k = `${s.model}|${s.size}`; cell.set(k, (cell.get(k) ?? 0) + qty(d.snap.balances, s.id, loc)); }
        const sizes = d.snap.sizes.filter((z) => ms.some((m) => cell.get(`${m}|${z}`)));
        return ms.length ? <Card title={`خريطة المخزون: الموديل × المقاس`} hint={`${LOC_AR[loc]} · ${ms.length} موديل`}><Heatmap models={ms} sizes={sizes} value={(m, z) => cell.get(`${m}|${z}`) ?? 0} total={(m) => modelSum(m, loc)} breakdown={(m, z) => d.snap.skus.filter((k) => k.model === m && k.size === z).map((k) => ({ label: k.color, n: qty(d.snap.balances, k.id, loc) })).filter((x) => x.n !== 0).sort((a, b) => b.n - a.n)} /></Card> : <Empty>لا يوجد رصيد في هذه الحالة.</Empty>;
      })() : (
        <>
          <input type="search" aria-label="بحث الموديلات" placeholder="بحث بالموديل أو اللون أو المقاس" value={q} onChange={(e)=>setQ(e.target.value)} className="mb-3 w-full sm:max-w-sm" />
          <div role="group" aria-label="فلاتر الموديلات" className="mb-4 flex flex-wrap items-center gap-2 [&>button]:h-9 [&>button]:whitespace-nowrap">
            {['all', ...LINES].map((l) => <Chip key={l} pressed={line === l} onClick={() => setLine(l)}>{l === 'all' ? 'كل الموديلات' : l}</Chip>)}
            <select aria-label="موديلات أخرى" value={line === OTHER ? otherModel : ''} onChange={(e) => { if (e.target.value) { setLine(OTHER); setOtherModel(e.target.value); } else setLine('all'); }}
              className={cn('!h-9 !w-auto shrink-0 !rounded-full !py-0 !ps-3 !pe-8 text-sm !leading-9', line === OTHER && 'border-accent bg-accent !text-white')}>
              <option value="" disabled={line !== OTHER}>{OTHER}</option>
              <option value="all">كل الموديلات الأخرى ({otherCodes.length})</option>
              {otherCodes.map((c) => <option key={c} value={c}>{mName(c)}</option>)}
            </select>
          </div>
          <div className="grid gap-4"><Progressive items={shown} chunk={4} render={(c) => <Card key={c}>{head(c)}<Matrix d={d} model={c} loc={loc} onCell={setSku} /></Card>} /></div>
          {!shown.length && <Empty>لا توجد موديلات مطابقة للحالة والبحث.</Empty>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="دليل الألوان">
            {loc === 'READY' ? (<>
              <Key cls="bg-good-bg border-good-line">كافٍ</Key><Key cls="bg-warn-bg border-warn-line">منخفض (على وشك النفاد)</Key><Key cls="bg-crit-bg border-crit-line">حرج (الطلب أكبر من الجاهز أو رصيد سالب)</Key>
              <Key cls="bg-info-bg border-info-line">فائض (تغطية أكثر من 60 يومًا)</Key><Key cls="bg-grid border-line">صفر</Key><span className="inline-flex items-center gap-1.5"><i className="inline-block size-2 rounded-full bg-dirty" />يوجد هالك نظافة</span><span>تحت الرقم: يكفي كام يوم = الجاهز ÷ معدل السحب (آخر {VELOCITY_DAYS} أيام){d.velocityOK ? '' : '، و~ يعني تقديري'}</span>
            </>) : (<>
              <Key cls={{ DIRTY: 'bg-warn-bg border-warn-line', FACTORY: 'bg-info-bg border-info-line', SCRAP: 'bg-crit-bg border-crit-line', LOST: 'bg-lost-bg border-lost-bg' }[loc as 'DIRTY']}>{LOC_AR[loc]}</Key><Key cls="bg-grid border-line">صفر</Key>
            </>)}
          </div>
        </>
      )}
      </>}
      {archOpen && <Sheet title={`الأصناف المؤرشفة (${d.snap.archivedSkus.length})`} onClose={() => setArchOpen(false)} wide><ArchivedList d={d} /></Sheet>}
      {sku && <SkuSheet d={d} sku={sku} start={loc} onClose={() => setSku(null)} />}
      {catSheet === 'new' && <NewModelSheet d={d} onClose={() => setCatSheet(null)} onCreated={() => setView('all')} />}
      {editModel && <EditCatalogSheet key={editModel} d={d} initial={editModel} onClose={() => setEditModel(null)} />}
      {imgModel && (() => { const model = d.modelMap.get(imgModel); return model ? <ModelImageSheet model={model} onClose={() => setImgModel(null)} /> : null; })()}
    </>
  );
}
