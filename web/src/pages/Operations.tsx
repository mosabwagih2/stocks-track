import { useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useAct, useDerived } from '@/hooks/data';
import { PageHead } from '@/components/PageHead';
import { Alert, Button, Card, Empty, Field, Pill, Tabs, TableWrap, th, td } from '@/components/ui';
import { ErrorBox, Photo, PhotoInput } from '@/components/shared';
import { VariantPicker } from '@/components/VariantPicker';
import { Spinner } from '@/components/Spinner';
import { LOCS, LOC_AR, TYPE_AR } from '@/domain/constants';
import { qty } from '@/domain/ledger';
import { skuLabel } from '@/domain/orders';
import { addDays } from '@/domain/dates';
import { fmt } from '@/lib/cn';
import { repo } from '@/data';
import type { Derived } from '@/hooks/data';
import type { Loc } from '@/domain/types';

type Line = { sku: string; qty: number };
const addLine = (ls: Line[], sku: string, q: number): Line[] => (ls.some((l) => l.sku === sku) ? ls.map((l) => (l.sku === sku ? { ...l, qty: l.qty + q } : l)) : [...ls, { sku, qty: q }]);

function LinesTable({ d, lines, setLines, from }: { d: Derived; lines: Line[]; setLines: (l: Line[]) => void; from?: Loc }) {
  if (!lines.length) return <Empty>لا توجد أصناف بعد. اختر الموديل واللون والمقاس ثم أضف.</Empty>;
  return (
    <TableWrap><table className="text-sm"><thead><tr><th className={th}>الصنف</th>{from && <th className={th}>المتاح في {LOC_AR[from]}</th>}<th className={th}>الكمية</th><th className={th} /></tr></thead>
      <tbody>{lines.map((l, i) => (
        <tr key={l.sku}><td className={td}>{skuLabel(d.skuMap, l.sku)}</td>{from && <td className={td + ' font-mono'}>{fmt(qty(d.snap.balances, l.sku, from))}</td>}
          <td className={td}><span className="inline-flex items-center overflow-hidden rounded-lg border border-line2">
            <button type="button" aria-label="نقصان" className="px-2 py-1.5 hover:bg-lav" onClick={() => setLines(lines.map((x, j) => (j === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}><Minus className="size-3.5" /></button>
            <input type="number" min={1} value={l.qty} aria-label="الكمية" className="w-16 border-0 rounded-none py-1" onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: Math.max(1, Math.floor(+e.target.value || 1)) } : x)))} />
            <button type="button" aria-label="زيادة" className="px-2 py-1.5 hover:bg-lav" onClick={() => setLines(lines.map((x, j) => (j === i ? { ...x, qty: x.qty + 1 } : x)))}><Plus className="size-3.5" /></button></span></td>
          <td className={td}><Button size="sm" variant="ghost" aria-label="حذف" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button></td></tr>))}</tbody></table></TableWrap>
  );
}

function Checks({ items }: { items: { ok: boolean; t: string }[] }) {
  return <div className="grid gap-1.5">{items.map((c) => <div key={c.t} className="flex items-start gap-2"><span className={c.ok ? 'text-good' : 'text-crit'}>{c.ok ? '✓' : '●'}</span><span>{c.t}</span></div>)}</div>;
}

function Receipt({ d }: { d: Derived }) {
  const act = useAct(); const [lines, setLines] = useState<Line[]>([]); const [ref, setRef] = useState(''); const [declared, setDeclared] = useState(''); const [photo, setPhoto] = useState<File | null>(null);
  const [date, setDate] = useState(d.today); const [busy, setBusy] = useState(false);
  const total = lines.reduce((a, l) => a + l.qty, 0); const inRange = date <= d.today && date >= addDays(d.today, -3);
  const checks = [
    { ok: total > 0, t: 'تمت إضافة أصناف' }, { ok: !!photo, t: 'تم رفع صورة الورقة الموقّعة' }, { ok: declared !== '', t: 'تم إدخال إجمالي القطع المكتوب في الورقة' },
    ...(declared !== '' ? [{ ok: +declared === total, t: `المكتوب في الورقة (${fmt(+declared)}) = المضاف (${fmt(total)})` }] : []), { ok: inRange, t: 'التاريخ ضمن آخر 3 أيام وليس في المستقبل' },
  ];
  const ok = checks.every((c) => c.ok);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid gap-4">
        <Card title="البيانات"><div className="grid gap-3 sm:grid-cols-3">
          <Field label="التاريخ"><input type="date" value={date} min={addDays(d.today, -3)} max={d.today} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="رقم الإذن / الورقة"><input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
          <Field label="إجمالي القطع المكتوب في الورقة"><input type="number" min={0} value={declared} onChange={(e) => setDeclared(e.target.value)} className="w-full text-start" /></Field>
        </div><div className="mt-3"><PhotoInput file={photo} onChange={setPhoto} label="صورة الورقة الموقّعة من الطرفين" /></div></Card>
        <Card title="الأصناف"><div className="grid gap-3"><VariantPicker d={d} onAdd={(s, q) => setLines((l) => addLine(l, s, q))} /><LinesTable d={d} lines={lines} setLines={setLines} /></div></Card>
      </div>
      <Card title="قبل التأكيد" className="h-fit lg:sticky lg:top-4">
        <Checks items={checks} />
        <Button variant="primary" className="mt-4 w-full" disabled={!ok || busy} onClick={async () => {
          setBusy(true); const r = await act(() => repo.receiveStock({ lines, date, ref, declared: +declared, photo: photo! }), (x) => `تم تأكيد الاستلام ${x.doc} (${fmt(x.pieces)} قطعة)`); setBusy(false);
          if (r) { setLines([]); setRef(''); setDeclared(''); setPhoto(null); }
        }}>تأكيد وتسجيل {fmt(total)} قطعة</Button>
      </Card>
    </div>
  );
}

function MoveState({ d }: { d: Derived }) {
  const act = useAct(); const [lines, setLines] = useState<Line[]>([]); const [from, setFrom] = useState<Loc>('READY'); const [to, setTo] = useState<Loc>('DIRTY'); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  const short = lines.filter((l) => qty(d.snap.balances, l.sku, from) < l.qty);
  const checks = [{ ok: lines.length > 0, t: 'تمت إضافة أصناف' }, { ok: from !== to, t: 'الحالتان مختلفتان' }, { ok: !short.length, t: short.length ? `الكمية غير كافية في ${LOC_AR[from]}: ${short.map((l) => skuLabel(d.skuMap, l.sku)).join('، ')}` : `الكميات متاحة في ${LOC_AR[from]}` }];
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid gap-4">
        <Card title="النقل"><div className="grid gap-3 sm:grid-cols-3">
          <Field label="من حالة"><select value={from} onChange={(e) => { const v = e.target.value as Loc; setFrom(v); if (v === to) setTo(LOCS.find((l) => l !== v)!); }}>{LOCS.map((l) => <option key={l} value={l}>{LOC_AR[l]}</option>)}</select></Field>
          <Field label="إلى حالة"><select value={to} onChange={(e) => setTo(e.target.value as Loc)}>{LOCS.filter((l) => l !== from).map((l) => <option key={l} value={l}>{LOC_AR[l]}</option>)}</select></Field>
          <Field label="السبب (اختياري)"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="بقعة، غسيل..." /></Field></div></Card>
        <Card title="الأصناف"><div className="grid gap-3"><VariantPicker d={d} from={from} onAdd={(s, q) => setLines((l) => addLine(l, s, q))} /><LinesTable d={d} lines={lines} setLines={setLines} from={from} /></div></Card>
      </div>
      <Card title="قبل التأكيد" className="h-fit lg:sticky lg:top-4"><Checks items={checks} />
        <Button variant="primary" className="mt-4 w-full" disabled={!checks.every((c) => c.ok) || busy} onClick={async () => { setBusy(true); const r = await act(() => repo.moveState({ lines, from, to, reason }), (x) => `تم تسجيل ${x.doc} (${fmt(x.pieces)} قطعة)`); setBusy(false); if (r) setLines([]); }}>تأكيد النقل</Button></Card>
    </div>
  );
}

function Docs({ d }: { d: Derived }) {
  const docs = [...d.snap.docs].reverse();
  if (!docs.length) return <Card><Empty>لا توجد عمليات بعد. تظهر هنا عمليات الاستلام وتغيير الحالة. الشحن في صفحة الأوردرات.</Empty></Card>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{docs.map((x) => (
      <Card key={x.no}><div className="mb-2 flex items-center justify-between"><b className="font-mono">{x.no}</b><Pill tone={x.status === 'done' ? 'good' : 'neutral'}>{x.status === 'done' ? 'مؤكد' : 'معكوس'}</Pill></div>
        <div className="mb-2 text-muted">{TYPE_AR[x.type] ?? x.type} · {x.date} · {fmt(x.lines.reduce((a, l) => a + l.qty, 0))} قطعة</div>
        {x.attachment && <Photo path={x.attachment} className="w-full rounded-xl border border-line" />}</Card>))}</div>
  );
}

export default function Operations() {
  const { d, isLoading, error } = useDerived(); const [tab, setTab] = useState<'rcv' | 'mov' | 'docs'>('rcv');
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !d) return <Spinner />;
  return (
    <>
      <PageHead title="العمليات" sub="كل عملية تغيّر المخزون تُسجَّل هنا. الشحن يتم من صفحة الأوردرات." />
      <Tabs value={tab} onChange={setTab} tabs={[['rcv', 'استلام توريد'], ['mov', 'تغيير حالة'], ['docs', 'آخر العمليات']]} />
      {tab === 'rcv' ? <Receipt d={d} /> : tab === 'mov' ? <MoveState d={d} /> : <Docs d={d} />}
      <Alert className="mt-6">ستُضاف المرتجعات والجرد والتوريد للمحل بالأسلوب نفسه (دوال في قاعدة البيانات مع شاشة).</Alert>
    </>
  );
}
