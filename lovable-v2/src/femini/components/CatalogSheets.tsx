import { useMemo, useState } from 'react';
import { Check, LoaderCircle, Plus, Save, X } from 'lucide-react';
import { Alert, Button, Chip, Field, Pill, Sheet, TableWrap, th, td, Empty } from './ui';
import { Thumb } from './Thumb';
import { useAct } from '@/femini/hooks/data';
import type { Derived } from '@/femini/hooks/data';
import { repo } from '@/femini/data';
import { totalOwned } from '@/femini/domain/ledger';
import { cn, fmt } from '@/femini/cn';
import { friendlyError } from '@/femini/data/errors';
import { normalizeModelCode, validateNewModel } from './catalog-validation';
import { rememberSwatch, swatchOf } from './swatch';

const Dotc = ({ c }: { c: string }) => <i className="inline-block size-3 rounded-full border border-line2 align-[-1px]" style={{ background: swatchOf(c) }} />;
/** Colour square: pick a colour by its code/shade, kept for the dot of the colour being added. */
const HexPick = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <input type="color" aria-label="اختيار لون بالكود" title="اختيار لون بالكود" value={value} onChange={(e) => onChange(e.target.value)} className="!h-9 !w-9 shrink-0 cursor-pointer !p-0.5" />;;
const addTo = (a: string[], v: string) => (a.includes(v) ? a : [...a, v]);
const toggle = (a: string[], v: string) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);

/** + New model */
export function NewModelSheet({ d, onClose, onCreated, prefill }: { d: Derived; onClose: () => void; onCreated: (code: string) => void; prefill?: { code: string; color?: string; size?: string; colors?: string[]; sizes?: string[] } }) {
  const act = useAct();
  const [code, setCode] = useState(prefill?.code ?? ''); const [name, setName] = useState(''); const [min, setMin] = useState('');
  const [tried, setTried] = useState(false); const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState('');
  const known = useMemo(() => [...new Set(d.snap.colors.map((c) => c.ar).concat(d.snap.skus.map((s) => s.color)))], [d]);
  const pc = prefill?.colors ?? (prefill?.color ? [prefill.color] : []); const ps = prefill?.sizes ?? (prefill?.size ? [prefill.size] : []);   // what the pickup used for this model
  const [colors, setColors] = useState<string[]>(pc); const [sizes, setSizes] = useState<string[]>(ps);
  const [extraC, setExtraC] = useState<string[]>(pc.filter((c) => !known.includes(c))); const [extraS, setExtraS] = useState<string[]>(ps.filter((z) => !d.snap.sizes.includes(z))); const [nc, setNc] = useState(''); const [ns, setNs] = useState('');
  const allC = [...known, ...extraC.filter((c) => !known.includes(c))]; const allS = [...d.snap.sizes, ...extraS.filter((z) => !d.snap.sizes.includes(z))];
  const [nh, setNh] = useState('#7c5cff');
  const codeU = normalizeModelCode(code); const exists = d.modelMap.has(codeU) || d.snap.archivedSkus.some((s) => s.model === codeU);
  const n = colors.length * sizes.length;
  const errors = validateNewModel({ code, name, min, colors, sizes }, exists);
  const close = () => { if (!saving) onClose(); };
  const save = async () => {
    setTried(true); setSaveError('');
    if (saving || Object.keys(errors).length) return;
    setSaving(true);
    try {
      const r = await act(async () => {
        try { return await repo.catalogNewModel({ code: codeU, name: name.trim(), colors, sizes, minAlert: Number(min) || 0 }); }
        catch (e) { setSaveError(friendlyError(e)); throw e; }
      }, (x) => `تمت إضافة الموديل ${x.model} بنجاح (${x.skus} صنف)`);
      if (r) { onCreated(r.model); onClose(); }
    } finally { setSaving(false); }
  };
  return (
    <Sheet title="موديل جديد" onClose={close} footer={<div className="grid gap-3">
      {saveError && <div role="alert"><Alert tone="crit">{saveError}</Alert></div>}
      <div className="flex items-center gap-2"><Button className="h-11 flex-1" variant="primary" disabled={saving} onClick={save}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}{saving ? 'جارٍ الحفظ…' : 'حفظ الموديل'}</Button><Button className="h-11" disabled={saving} onClick={close}><X className="size-4" />إلغاء</Button></div>
    </div>}>
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-accent-soft font-mono font-semibold text-accent">{codeU || <Plus className="size-6" />}</div>
        <div className="min-w-0 flex-1"><h3 className="break-words font-display font-semibold">{name.trim() || 'موديل جديد'}</h3><p className="mt-1 text-xs text-muted">{colors.length} ألوان · {sizes.length} مقاسات · {n} صنف</p></div><Pill>رصيد صفر</Pill>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="كود الموديل"><input id="new-model-code" data-autofocus autoComplete="off" aria-label="كود الموديل" aria-invalid={tried && !!errors.code} aria-describedby={tried && errors.code ? 'new-code-error' : undefined} dir="ltr" className="font-mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="PAN6" />{tried && errors.code && <small id="new-code-error" className="text-crit">{errors.code}</small>}</Field>
        <Field label="النوع / الاسم"><input aria-label="النوع / الاسم" aria-invalid={tried && !!errors.name} list="mnames" value={name} onChange={(e) => setName(e.target.value)} placeholder="بانتي" />{tried && errors.name && <small className="text-crit">{errors.name}</small>}</Field>
        <datalist id="mnames">{[...new Set(d.snap.models.map((m) => m.name))].map((x) => <option key={x} value={x} />)}</datalist>
      </div>
      <div><div className="mb-1.5 text-xs font-medium text-muted">الألوان</div>
        {tried && errors.colors && <p className="mb-2 text-xs text-crit" role="alert">{errors.colors}</p>}
        <div className="flex flex-wrap gap-1.5">{allC.map((c) => <Chip key={c} pressed={colors.includes(c)} onClick={() => setColors((a) => toggle(a, c))}><Dotc c={c} />{c}</Chip>)}</div>
        <div className="mt-2 flex gap-2"><input value={nc} onChange={(e) => setNc(e.target.value)} placeholder="لون جديد" className="max-w-44" /><HexPick value={nh} onChange={setNh} /><Button size="sm" onClick={() => { const v = nc.trim(); if (v) { rememberSwatch(v, nh); setExtraC((a) => addTo(a, v)); setColors((a) => addTo(a, v)); setNc(''); } }}><Plus className="size-3.5" /> لون</Button></div></div>
      <div><div className="mb-1.5 text-xs font-medium text-muted">المقاسات</div>
        {tried && errors.sizes && <p className="mb-2 text-xs text-crit" role="alert">{errors.sizes}</p>}
        <div className="flex flex-wrap gap-1.5">{allS.map((z) => <Chip key={z} pressed={sizes.includes(z)} onClick={() => setSizes((a) => toggle(a, z))}>{z}</Chip>)}</div>
        <div className="mt-2 flex gap-2"><input dir="ltr" value={ns} onChange={(e) => setNs(e.target.value)} placeholder="مقاس جديد (5XL)" className="max-w-40" /><Button size="sm" onClick={() => { const v = ns.trim().toUpperCase(); if (v) { setExtraS((a) => addTo(a, v)); setSizes((a) => addTo(a, v)); setNs(''); } }}><Plus className="size-3.5" /> مقاس</Button></div></div>
      <Field label="حد أدنى للتنبيه (اختياري)"><input aria-label="حد أدنى للتنبيه (اختياري)" aria-invalid={tried && !!errors.min} type="number" min={0} step={1} value={min} onChange={(e) => setMin(e.target.value)} className="w-full text-start" />{tried && errors.min && <small className="text-crit">{errors.min}</small>}</Field>
      <Alert tone={n ? 'neutral' : 'warn'}>{n ? <>سيتم إضافة <b>{n}</b> صنف جديد برصيد صفر.</> : 'اختر لونًا ومقاسًا على الأقل.'}</Alert>
      <p className="text-xs text-muted">يبدأ الصنف برصيد صفر. سجّل الرصيد من «العمليات ← استلام توريد».</p>
    </Sheet>
  );
}

/** Edit: rename a model, toggle its color x size variants on/off, add colors/sizes, or remove the whole model. */
export function EditCatalogSheet({ d, initial, onClose, addVariant, addVariants }: { d: Derived; initial: string; onClose: () => void; addVariant?: { color: string; size: string }; addVariants?: { color: string; size: string }[] }) {
  const adds = addVariants ?? (addVariant ? [addVariant] : []);   // colour x size the pickup uses and the model lacks
  const act = useAct();
  const [saving, setSaving] = useState(false); const [tried, setTried] = useState(false); const [saveError, setSaveError] = useState('');
  const [model, setModel] = useState(initial); const [nh, setNh] = useState('#7c5cff');
  const models = d.modelOrder;
  const m = d.modelMap.get(model); const ms = useMemo(() => d.snap.skus.filter((s) => s.model === model), [d, model]);
  const [name, setName] = useState(m?.name ?? ''); const [want, setWant] = useState<Record<string, boolean>>(() => ({ ...Object.fromEntries(ms.map((s) => [`${s.color}|${s.size}`, true])), ...Object.fromEntries(adds.map((v) => [`${v.color}|${v.size}`, true])) }));
  const [extraC, setExtraC] = useState<string[]>([...new Set(adds.filter((v) => !ms.some((s) => s.color === v.color)).map((v) => v.color))]); const [extraS, setExtraS] = useState<string[]>([...new Set(adds.filter((v) => !ms.some((s) => s.size === v.size)).map((v) => v.size))]); const [nc, setNc] = useState(''); const [ns, setNs] = useState(''); const [confirmRm, setConfirmRm] = useState(false);
  const pick = (code: string) => { const x = d.snap.skus.filter((s) => s.model === code); setModel(code); setName(d.modelMap.get(code)?.name ?? ''); setWant(Object.fromEntries(x.map((s) => [`${s.color}|${s.size}`, true]))); setExtraC([]); setExtraS([]); setConfirmRm(false); setTried(false); setSaveError(''); };
  const colors = [...new Set(ms.map((s) => s.color).concat(extraC))]; const sizes = [...new Set(d.snap.sizes.filter((z) => ms.some((s) => s.size === z)).concat(extraS))].sort((a, b) => d.snap.sizes.indexOf(a) - d.snap.sizes.indexOf(b));
  const by = new Map(ms.map((s) => [`${s.color}|${s.size}`, s])); const busy = (id: string) => totalOwned(d.snap.balances, id) !== 0 || (d.demand[id] ?? 0) !== 0;
  const add: { color: string; size: string }[] = []; const remove: string[] = []; let locked = 0;
  for (const c of colors) for (const z of sizes) { const s = by.get(`${c}|${z}`); const on = !!want[`${c}|${z}`]; if (s) { if (busy(s.id)) locked++; else if (!on) remove.push(s.id); } else if (on) add.push({ color: c, size: z }); }
  const nameChanged = name.trim() !== (m?.name ?? ''); const dirty = add.length || remove.length || nameChanged;
  const blockers = ms.filter((s) => busy(s.id)); const bTot = blockers.reduce((a, s) => a + totalOwned(d.snap.balances, s.id), 0); const bDem = blockers.reduce((a, s) => a + (d.demand[s.id] ?? 0), 0);
  if (!m) return null;
  const close = () => { if (!saving) onClose(); };
  const save = async () => {
    setTried(true); setSaveError('');
    if (!name.trim() || !dirty || saving) return;
    setSaving(true);
    try {
      const r = await act(async () => {
        try { return await repo.catalogEditModel({ code: model, name: name.trim(), add, remove }); }
        catch (e) { setSaveError(friendlyError(e)); throw e; }
      }, () => `تم حفظ تعديلات الموديل ${model} بنجاح`);
      if (r) onClose();
    } finally { setSaving(false); }
  };
  return (
    <Sheet title={`تعديل الموديل ${model}`} onClose={close} footer={<div className="grid gap-3">
      {saveError && <div role="alert"><Alert tone="crit">{saveError}</Alert></div>}
      <div className="flex items-center gap-2"><Button className="h-11 flex-1" variant="primary" disabled={!dirty || saving} onClick={save}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{saving ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}</Button><Button className="h-11" disabled={saving} onClick={close}><X className="size-4" />إلغاء</Button></div>
    </div>}>
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card"><Thumb model={m} size={80} /><div className="min-w-0 flex-1"><h3 className="break-words font-display font-semibold">{model} · {m.name}</h3><p className="mt-1 text-xs text-muted">{ms.length} صنف · {colors.length} ألوان · {sizes.length} مقاسات</p></div><Check className="size-4 shrink-0 text-good" /></div>
      <Field label="الموديل"><select aria-label="الموديل" disabled={saving} value={model} onChange={(e) => pick(e.target.value)}>{models.map((c) => <option key={c} value={c}>{c} · {d.modelMap.get(c)?.name}</option>)}</select></Field>
      <Field label="النوع / الاسم"><input aria-label="النوع / الاسم" aria-invalid={tried && !name.trim()} value={name} onChange={(e) => setName(e.target.value)} />{tried && !name.trim() && <small role="alert" className="text-crit">أدخل اسم الموديل قبل الحفظ.</small>}</Field>
      <div><div className="mb-1.5 text-xs font-medium text-muted">الأصناف (لون × مقاس). اضغط الخانة للإضافة أو الإزالة.</div>
        <div className="overflow-x-auto rounded-xl border border-line p-2"><table className="border-separate border-spacing-1 w-auto"><thead><tr><th />{sizes.map((z) => <th key={z} className="px-1 text-center text-xs text-muted">{z}</th>)}</tr></thead>
          <tbody>{colors.map((c) => (
            <tr key={c}><td className="whitespace-nowrap pe-2 ps-1 font-medium"><Dotc c={c} /> {c}</td>
              {sizes.map((z) => {
                const s = by.get(`${c}|${z}`); const on = !!want[`${c}|${z}`];
                if (s && busy(s.id)) return <td key={z}><span title={`لا يمكن إزالته: رصيد ${totalOwned(d.snap.balances, s.id)} · طلب ${d.demand[s.id] ?? 0}`} className="relative grid h-11 min-w-14 cursor-not-allowed place-items-center rounded-[10px] border border-line bg-lav font-mono text-sm text-muted">{fmt(totalOwned(d.snap.balances, s.id))}<small className="absolute inset-x-0 bottom-0.5 text-center font-sans text-[9px]">محجوز</small></span></td>;
                const tone = on ? (s ? 'bg-good-bg border-good-line text-good' : 'bg-info-bg border-info-line text-info') : s ? 'bg-crit-bg border-crit-line text-crit' : 'bg-grid border-transparent text-muted opacity-75';
                return <td key={z}><button type="button" aria-pressed={on} aria-label={`${c} ${z}`} onClick={() => setWant((w) => ({ ...w, [`${c}|${z}`]: !on }))} className={cn('relative grid h-11 min-w-14 place-items-center rounded-[10px] border text-base', tone)}>{on ? (s ? '✓' : '+') : s ? '−' : ''}<small className="absolute inset-x-0 bottom-0.5 text-center text-[9px]">{on ? (s ? 'موجود' : 'جديد') : s ? 'سيُزال' : ''}</small></button></td>;
              })}</tr>))}</tbody></table></div></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 gap-2"><input className="min-w-0 flex-1" list="catc" value={nc} onChange={(e) => setNc(e.target.value)} placeholder="لون جديد" /><datalist id="catc">{d.snap.colors.map((c) => c.ar).filter((c) => !colors.includes(c)).map((c) => <option key={c} value={c} />)}</datalist>
          <HexPick value={nh} onChange={setNh} />
          <Button size="sm" onClick={() => { const v = nc.trim(); if (!v || colors.includes(v)) return; rememberSwatch(v, nh); setExtraC((a) => [...a, v]); setWant((w) => { const x = { ...w }; for (const z of sizes) x[`${v}|${z}`] = true; return x; }); setNc(''); }}>+ لون</Button></div>
        <div className="flex min-w-0 gap-2"><input className="min-w-0 flex-1" dir="ltr" list="cats" value={ns} onChange={(e) => setNs(e.target.value)} placeholder="مقاس جديد" /><datalist id="cats">{d.snap.sizes.filter((z) => !sizes.includes(z)).map((z) => <option key={z} value={z} />)}</datalist>
          <Button size="sm" onClick={() => { const v = ns.trim().toUpperCase(); if (!v || sizes.includes(v)) return; setExtraS((a) => [...a, v]); setWant((w) => { const x = { ...w }; for (const c of colors) x[`${c}|${v}`] = true; return x; }); setNs(''); }}>+ مقاس</Button></div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted"><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-ready" />موجود</span><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-factory" />جديد</span><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-scrap" />سيُزال</span><span>محجوز = عليه رصيد أو طلب</span></div>
      <Alert>{dirty ? <>التعديلات: {add.length ? <b>+{add.length} صنف جديد </b> : null}{remove.length ? <b>−{remove.length} صنف سيُزال </b> : null}{nameChanged ? 'تغيير الاسم' : ''}</> : 'لا توجد تعديلات بعد.'}</Alert>
      <div><Button variant="danger" disabled={saving} onClick={() => setConfirmRm(true)}>إزالة الموديل بالكامل</Button></div>
      {confirmRm && (blockers.length
        ? <Alert tone="warn"><b>لا يمكن إزالة الموديل الآن.</b> عليه {bTot ? <>رصيد <b>{fmt(bTot)}</b> قطعة</> : null}{bTot && bDem ? ' و' : ''}{bDem ? <>طلب مفتوح <b>{fmt(bDem)}</b></> : null}. صفّر الرصيد (بجرد أو شطب أو تسليم للمصنع) وأنهِ الأوردرات المفتوحة أولًا.</Alert>
        : <Alert tone="crit">سيتم إزالة <b>{model}</b> بكل أصنافه ({ms.length}) من المخزون وقوائم الاختيار. تبقى الحركات القديمة في السجل ويمكن استعادته من «كل الأصناف ← مؤرشف». هل أنت متأكد؟
          <div className="mt-2 flex gap-2"><Button variant="danger" size="sm" onClick={async () => { const r = await act(() => repo.catalogRemoveModel(model), (x) => `تمت إزالة الموديل ${model} (${x} صنف)`); if (r !== undefined) onClose(); }}>نعم، أزل الموديل</Button><Button size="sm" onClick={() => setConfirmRm(false)}>لا</Button></div></Alert>)}
    </Sheet>
  );
}

/** Removed models/variants, grouped by model, with restore. */
export function ArchivedList({ d }: { d: Derived }) {
  const act = useAct();
  const by = new Map<string, typeof d.snap.archivedSkus>(); for (const s of d.snap.archivedSkus) by.set(s.model, [...(by.get(s.model) ?? []), s]);
  if (!by.size) return <Empty>لا توجد موديلات أو أصناف مؤرشفة.</Empty>;
  return (
    <div className="grid gap-3">{[...by.entries()].map(([model, list]) => {
      const gone = !d.modelMap.has(model); const mo = d.modelMap.get(model) ?? d.snap.archivedModels?.find((x) => x.code === model);
      return (
        <div key={model} className="rounded-xl border border-line bg-surface p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-3"><Thumb model={mo ?? { code: model, image: null }} size={64} /><div><h3 className="font-display font-semibold">{model} <span className="text-sm font-normal text-muted">{mo?.name ?? ''}</span>{gone && <Pill tone="lost">الموديل كله مُزال</Pill>}</h3>
            {(() => { const who = [...new Set(list.map((s) => d.snap.archivedSkuBy[s.id]).filter(Boolean))]; return <p className="text-xs text-muted">{who.length ? `أرشفه ${who.join('، ')}` : 'أرشفه: مش متسجّل (قبل التحديث)'}</p>; })()}</div></div>
            <Button size="sm" variant="primary" onClick={() => act(() => repo.catalogRestore({ model }), (n) => `تمت استعادة ${n} صنف من ${model}`)}>{gone ? 'استعادة الموديل كله' : 'استعادة الكل'}</Button></div>
          <TableWrap><table className="text-sm"><thead><tr><th className={th}>الصنف</th><th className={th} /></tr></thead><tbody>{list.map((s) => <tr key={s.id}><td className={td}><Dotc c={s.color} /> {s.color} · {s.size}</td><td className={td}><Button size="sm" onClick={() => act(() => repo.catalogRestore({ model, sku: s.id }), 'تمت الاستعادة')}>استعادة</Button></td></tr>)}</tbody></table></TableWrap>
        </div>);
    })}</div>
  );
}
