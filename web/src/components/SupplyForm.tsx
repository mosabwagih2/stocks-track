import { useState } from 'react';
import { Alert, Button, Field, Sheet } from './ui';
import { useAct } from '@/hooks/data';
import type { Derived } from '@/hooks/data';
import { repo } from '@/data';
import type { Supply, SupplyRule } from '@/domain/types';

type Kind = SupplyRule['kind'];
const KIND_AR: Record<Kind, string> = { none: 'يدوي: بدون خصم تلقائي', order: 'كمية ثابتة لكل أوردر (مثل الفلاير)', pieces: 'كمية لكل قطعة في الأوردر (مثل الكاسات)', range: 'لكل أوردر حسب عدد القطع (مثل حجم التغليف)' };

/** Add or edit a supply: name, unit, pack (bag/box), alert threshold and the automatic consumption rule. */
export function SupplyFormSheet({ d, supply, onClose }: { d: Derived; supply?: Supply; onClose: () => void }) {
  const act = useAct();
  const r0 = supply?.rule ?? { kind: 'none' as const };
  const [name, setName] = useState(supply?.name ?? ''); const [unit, setUnit] = useState(supply?.unit ?? 'قطعة'); const [pack, setPack] = useState(supply && supply.pack > 1 ? String(supply.pack) : '');
  const [packName, setPackName] = useState(supply?.packName ?? ''); const [min, setMin] = useState(supply?.minAlert ? String(supply.minAlert) : ''); const [note, setNote] = useState(supply?.note ?? '');
  const [kind, setKind] = useState<Kind>(r0.kind); const [qty, setQty] = useState(String('qty' in r0 ? r0.qty : 1)); const [model, setModel] = useState(r0.kind === 'pieces' ? r0.model ?? '' : '');
  const [from, setFrom] = useState(String(r0.kind === 'range' ? r0.from : 1)); const [to, setTo] = useState(r0.kind === 'range' && r0.to ? String(r0.to) : ''); const [open, setOpen] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false); const [busy, setBusy] = useState(false);
  const rule: SupplyRule = kind === 'none' ? { kind } : kind === 'order' ? { kind, qty: +qty } : kind === 'pieces' ? { kind, qty: +qty, model } : { kind, qty: +qty, from: Math.floor(+from), to: Math.floor(+to) || 0 };
  const err = !name.trim() ? 'أدخل اسم المستلزم' : kind !== 'none' && !(+qty > 0) ? 'يجب أن تكون الكمية في القاعدة أكبر من صفر' : kind === 'range' && !(+from >= 1) ? '«من عدد قطع» يجب أن يكون 1 أو أكثر' : kind === 'range' && +to && +to < +from ? '«لحد» يجب أن يكون أكبر من أو يساوي «من»' : '';
  const models = [...d.snap.models].map((m) => m.code).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return (
    <Sheet title={supply ? `إعدادات ${supply.name}` : 'إضافة مستلزم'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="الاسم" className="col-span-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: فلاير الشحن" /></Field>
        <Field label="الوحدة"><input list="units" value={unit} onChange={(e) => setUnit(e.target.value)} /></Field><datalist id="units">{['قطعة', 'كاسة', 'لفة', 'كيس', 'علبة'].map((u) => <option key={u} value={u} />)}</datalist>
        <Field label="حد التنبيه (أقل رصيد)"><input type="number" min={0} value={min} onChange={(e) => setMin(e.target.value)} className="w-full text-start" /></Field>
        <Field label="عدد الوحدات في العبوة (اختياري)"><input type="number" min={0} value={pack} onChange={(e) => setPack(e.target.value)} placeholder="مثل 24" className="w-full text-start" /></Field>
        <Field label="اسم العبوة"><input value={packName} onChange={(e) => setPackName(e.target.value)} placeholder="كيس" /></Field>
        <Field label="ملاحظة" className="col-span-2"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {!supply && <Field label="الرصيد الحالي (اختياري)" className="col-span-2"><input type="number" min={0} value={open} onChange={(e) => setOpen(e.target.value)} className="w-full text-start" /></Field>}
      </div>
      <div className="grid gap-3 rounded-xl border border-line bg-lav p-3">
        <h3 className="font-display font-semibold">الخصم التلقائي مع الشحن</h3>
        <Field label="القاعدة"><select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>{(Object.keys(KIND_AR) as Kind[]).map((k) => <option key={k} value={k}>{KIND_AR[k]}</option>)}</select></Field>
        {kind !== 'none' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={kind === 'pieces' ? 'الكمية لكل قطعة' : 'الكمية لكل أوردر'}><input type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} className="w-full text-start" /></Field>
            {kind === 'pieces' && <Field label="الموديل"><select value={model} onChange={(e) => setModel(e.target.value)}><option value="">أي موديل</option>{models.map((m) => <option key={m} value={m}>{m} · {d.modelMap.get(m)?.name}</option>)}</select></Field>}
            {kind === 'range' && <><Field label="من عدد قطع"><input type="number" min={1} value={from} onChange={(e) => setFrom(e.target.value)} className="w-full text-start" /></Field><Field label="لحد عدد قطع (فارغ = بدون حد)" className="col-span-2"><input type="number" min={0} value={to} onChange={(e) => setTo(e.target.value)} className="w-full text-start" /></Field></>}
          </div>
        )}
      </div>
      {err && <Alert tone="crit">{err}</Alert>}
      <Button variant="primary" disabled={!!err || busy} onClick={async () => {
        setBusy(true);
        const r = await act(() => repo.supplySave({ id: supply?.id, name, unit, pack: Math.floor(+pack) || 1, packName, minAlert: Math.floor(+min) || 0, note, rule, open: Math.floor(+open) || 0 }), supply ? 'تم حفظ التعديل' : 'تمت إضافة المستلزم');
        setBusy(false); if (r) onClose();
      }}>{supply ? 'حفظ التعديلات' : 'إضافة المستلزم'}</Button>
      {supply && (
        <div className="rounded-xl border border-line p-3"><h3 className="mb-1 font-display font-semibold">إخفاء المستلزم</h3>
          <p className="mb-2 text-muted">الأرشفة تخفيه وتوقف خصمه التلقائي. تبقى الحركات القديمة ويمكن استعادته في أي وقت.</p>
          {confirmArchive ? <Alert tone="crit">سيتم أرشفة «{supply.name}». هل أنت متأكد؟<div className="mt-2 flex gap-2"><Button variant="danger" size="sm" onClick={async () => { await act(() => repo.supplyArchive(supply.id, true), 'تمت الأرشفة'); onClose(); }}>نعم، أرشف</Button><Button size="sm" onClick={() => setConfirmArchive(false)}>لا</Button></div></Alert>
            : <Button variant="danger" size="sm" onClick={() => setConfirmArchive(true)}>أرشفة المستلزم</Button>}
        </div>
      )}
    </Sheet>
  );
}
