import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Alert, Button, Chip, Field, Pill, Sheet, TableWrap, th, td, Empty } from './ui';
import { Thumb } from './Thumb';
import { useAct } from '@/hooks/data';
import type { Derived } from '@/hooks/data';
import { repo } from '@/data';
import { totalOwned } from '@/domain/ledger';
import { cn, fmt } from '@/lib/cn';

const SW: Record<string, string> = { اسود: '#1e1b24', ابيض: '#ffffff', احمر: '#d9262e', بيج: '#ead9be', رمادي: '#bdbcc4', برتقالي: '#f07a2b', زيتى: '#6f7a3c', فوشيا: '#c2317a', اصفر: '#f2c230', 'مينت جرين': '#8fd3b6', 'بيبي بلو': '#a9cbe8', كحلي: '#1f2a5a', بينك: '#f4b6c8', سيمون: '#f3a28c', روز: '#e58fa8', 'احمر تطعيم اسود': '#a3262c' };
const Dotc = ({ c }: { c: string }) => <i className="inline-block size-3 rounded-full border border-line2 align-[-1px]" style={{ background: SW[c] ?? '#cfc2ec' }} />;
const addTo = (a: string[], v: string) => (a.includes(v) ? a : [...a, v]);
const toggle = (a: string[], v: string) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);

/** + New model */
export function NewModelSheet({ d, onClose, onCreated }: { d: Derived; onClose: () => void; onCreated: (code: string) => void }) {
  const act = useAct();
  const [code, setCode] = useState(''); const [name, setName] = useState(''); const [min, setMin] = useState('');
  const known = useMemo(() => [...new Set(d.snap.colors.map((c) => c.ar).concat(d.snap.skus.map((s) => s.color)))], [d]);
  const [colors, setColors] = useState<string[]>([]); const [sizes, setSizes] = useState<string[]>([]);
  const [extraC, setExtraC] = useState<string[]>([]); const [extraS, setExtraS] = useState<string[]>([]); const [nc, setNc] = useState(''); const [ns, setNs] = useState('');
  const allC = [...known, ...extraC.filter((c) => !known.includes(c))]; const allS = [...d.snap.sizes, ...extraS.filter((z) => !d.snap.sizes.includes(z))];
  const codeU = code.trim().toUpperCase(); const exists = d.modelMap.has(codeU) || d.snap.archivedSkus.some((s) => s.model === codeU);
  const codeOk = /^[A-Z][A-Z0-9]{0,9}$/.test(codeU); const n = colors.length * sizes.length;
  const err = !codeU ? '' : !codeOk ? 'كود الموديل حروف إنجليزية وأرقام ويبدأ بحرف (مثل PAN6)' : exists ? 'كود الموديل موجود أو سبقت إزالته. استعده من «كل الأصناف ← مؤرشف»' : '';
  return (
    <Sheet title="موديل جديد" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="كود الموديل"><input dir="ltr" className="font-mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="PAN6" /></Field>
        <Field label="النوع / الاسم"><input list="mnames" value={name} onChange={(e) => setName(e.target.value)} placeholder="بانتي" /></Field>
        <datalist id="mnames">{[...new Set(d.snap.models.map((m) => m.name))].map((x) => <option key={x} value={x} />)}</datalist>
      </div>
      {err && <Alert tone="crit">{err}</Alert>}
      <div><div className="mb-1.5 text-xs font-medium text-muted">الألوان</div>
        <div className="flex flex-wrap gap-1.5">{allC.map((c) => <Chip key={c} pressed={colors.includes(c)} onClick={() => setColors((a) => toggle(a, c))}><Dotc c={c} />{c}</Chip>)}</div>
        <div className="mt-2 flex gap-2"><input value={nc} onChange={(e) => setNc(e.target.value)} placeholder="لون جديد" className="max-w-44" /><Button size="sm" onClick={() => { const v = nc.trim(); if (v) { setExtraC((a) => addTo(a, v)); setColors((a) => addTo(a, v)); setNc(''); } }}><Plus className="size-3.5" /> لون</Button></div></div>
      <div><div className="mb-1.5 text-xs font-medium text-muted">المقاسات</div>
        <div className="flex flex-wrap gap-1.5">{allS.map((z) => <Chip key={z} pressed={sizes.includes(z)} onClick={() => setSizes((a) => toggle(a, z))}>{z}</Chip>)}</div>
        <div className="mt-2 flex gap-2"><input dir="ltr" value={ns} onChange={(e) => setNs(e.target.value)} placeholder="مقاس جديد (5XL)" className="max-w-40" /><Button size="sm" onClick={() => { const v = ns.trim().toUpperCase(); if (v) { setExtraS((a) => addTo(a, v)); setSizes((a) => addTo(a, v)); setNs(''); } }}><Plus className="size-3.5" /> مقاس</Button></div></div>
      <Field label="حد أدنى للتنبيه (اختياري)"><input type="number" min={0} value={min} onChange={(e) => setMin(e.target.value)} className="w-full text-start" /></Field>
      <Alert tone={n ? 'neutral' : 'warn'}>{n ? <>سيتم إضافة <b>{n}</b> صنف جديد برصيد صفر.</> : 'اختر لونًا ومقاسًا على الأقل.'}</Alert>
      <Button variant="primary" disabled={!codeOk || exists || !name.trim() || !n} onClick={async () => { const r = await act(() => repo.catalogNewModel({ code: codeU, name, colors, sizes, minAlert: Math.floor(+min) || 0 }), (x) => `تمت إضافة الموديل ${x.model} (${x.skus} صنف)`); if (r) { onCreated(r.model); onClose(); } }}>إضافة {n || ''} صنف</Button>
      <p className="text-xs text-muted">يبدأ الصنف برصيد صفر. سجّل الرصيد من «العمليات ← استلام توريد».</p>
    </Sheet>
  );
}

/** Edit: rename a model, toggle its color x size variants on/off, add colors/sizes, or remove the whole model. */
export function EditCatalogSheet({ d, initial, onClose }: { d: Derived; initial: string; onClose: () => void }) {
  const act = useAct();
  const [model, setModel] = useState(initial);
  const models = useMemo(() => [...d.snap.models].map((m) => m.code).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), [d]);
  const m = d.modelMap.get(model); const ms = useMemo(() => d.snap.skus.filter((s) => s.model === model), [d, model]);
  const [name, setName] = useState(m?.name ?? ''); const [want, setWant] = useState<Record<string, boolean>>(() => Object.fromEntries(ms.map((s) => [`${s.color}|${s.size}`, true])));
  const [extraC, setExtraC] = useState<string[]>([]); const [extraS, setExtraS] = useState<string[]>([]); const [nc, setNc] = useState(''); const [ns, setNs] = useState(''); const [confirmRm, setConfirmRm] = useState(false);
  const pick = (code: string) => { const x = d.snap.skus.filter((s) => s.model === code); setModel(code); setName(d.modelMap.get(code)?.name ?? ''); setWant(Object.fromEntries(x.map((s) => [`${s.color}|${s.size}`, true]))); setExtraC([]); setExtraS([]); setConfirmRm(false); };
  const colors = [...new Set(ms.map((s) => s.color).concat(extraC))]; const sizes = [...new Set(d.snap.sizes.filter((z) => ms.some((s) => s.size === z)).concat(extraS))].sort((a, b) => d.snap.sizes.indexOf(a) - d.snap.sizes.indexOf(b));
  const by = new Map(ms.map((s) => [`${s.color}|${s.size}`, s])); const busy = (id: string) => totalOwned(d.snap.balances, id) !== 0 || (d.demand[id] ?? 0) !== 0;
  const add: { color: string; size: string }[] = []; const remove: string[] = []; let locked = 0;
  for (const c of colors) for (const z of sizes) { const s = by.get(`${c}|${z}`); const on = !!want[`${c}|${z}`]; if (s) { if (busy(s.id)) locked++; else if (!on) remove.push(s.id); } else if (on) add.push({ color: c, size: z }); }
  const nameChanged = name.trim() !== (m?.name ?? ''); const dirty = add.length || remove.length || nameChanged;
  const blockers = ms.filter((s) => busy(s.id)); const bTot = blockers.reduce((a, s) => a + totalOwned(d.snap.balances, s.id), 0); const bDem = blockers.reduce((a, s) => a + (d.demand[s.id] ?? 0), 0);
  if (!m) return null;
  return (
    <Sheet title="تعديل المخزون" onClose={onClose}>
      <Field label="الموديل"><select value={model} onChange={(e) => pick(e.target.value)}>{models.map((c) => <option key={c} value={c}>{c} · {d.modelMap.get(c)?.name}</option>)}</select></Field>
      <div className="flex items-center gap-3"><Thumb model={m} size={48} /><Field label="النوع / الاسم" className="flex-1"><input value={name} onChange={(e) => setName(e.target.value)} /></Field></div>
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
        <div className="flex gap-2"><input list="catc" value={nc} onChange={(e) => setNc(e.target.value)} placeholder="لون جديد" /><datalist id="catc">{d.snap.colors.map((c) => c.ar).filter((c) => !colors.includes(c)).map((c) => <option key={c} value={c} />)}</datalist>
          <Button size="sm" onClick={() => { const v = nc.trim(); if (!v || colors.includes(v)) return; setExtraC((a) => [...a, v]); setWant((w) => { const x = { ...w }; for (const z of sizes) x[`${v}|${z}`] = true; return x; }); setNc(''); }}>+ لون</Button></div>
        <div className="flex gap-2"><input dir="ltr" list="cats" value={ns} onChange={(e) => setNs(e.target.value)} placeholder="مقاس جديد" /><datalist id="cats">{d.snap.sizes.filter((z) => !sizes.includes(z)).map((z) => <option key={z} value={z} />)}</datalist>
          <Button size="sm" onClick={() => { const v = ns.trim().toUpperCase(); if (!v || sizes.includes(v)) return; setExtraS((a) => [...a, v]); setWant((w) => { const x = { ...w }; for (const c of colors) x[`${c}|${v}`] = true; return x; }); setNs(''); }}>+ مقاس</Button></div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted"><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-ready" />موجود</span><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-factory" />جديد</span><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-scrap" />سيُزال</span><span>محجوز = عليه رصيد أو طلب</span></div>
      <Alert>{dirty ? <>التعديلات: {add.length ? <b>+{add.length} صنف جديد </b> : null}{remove.length ? <b>−{remove.length} صنف سيُزال </b> : null}{nameChanged ? 'تغيير الاسم' : ''}</> : 'لا توجد تعديلات بعد.'}</Alert>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={!dirty} onClick={async () => { const r = await act(() => repo.catalogEditModel({ code: model, name, add, remove }), (x) => `تم حفظ التعديل (+${x.added} / −${x.removed})`); if (r) onClose(); }}>حفظ التعديلات</Button>
        <Button variant="danger" onClick={() => setConfirmRm(true)}>إزالة الموديل بالكامل</Button>
      </div>
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
      const gone = !d.modelMap.has(model);
      return (
        <div key={model} className="rounded-xl border border-line bg-surface p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="font-display font-semibold">{model}{gone && <Pill tone="lost">الموديل كله مُزال</Pill>}</h3>
            <Button size="sm" variant="primary" onClick={() => act(() => repo.catalogRestore({ model }), (n) => `تمت استعادة ${n} صنف من ${model}`)}>{gone ? 'استعادة الموديل كله' : 'استعادة الكل'}</Button></div>
          <TableWrap><table className="text-sm"><thead><tr><th className={th}>الصنف</th><th className={th} /></tr></thead><tbody>{list.map((s) => <tr key={s.id}><td className={td}><Dotc c={s.color} /> {s.color} · {s.size}</td><td className={td}><Button size="sm" onClick={() => act(() => repo.catalogRestore({ model, sku: s.id }), 'تمت الاستعادة')}>استعادة</Button></td></tr>)}</tbody></table></TableWrap>
        </div>);
    })}</div>
  );
}
