import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAct, useDerived } from '@/hooks/data';
import { PageHead } from '@/components/PageHead';
import { Alert, Button, Card, Empty, Field, Kpi, Pill, Sheet, TableWrap, Tabs, th, td } from '@/components/ui';
import { ErrorBox, Photo } from '@/components/shared';
import { Spinner } from '@/components/Spinner';
import { CHANNELS, channelName, TYPE_AR } from '@/domain/constants';
import { repo } from '@/data';
import { fmt } from '@/lib/cn';
import type { Derived } from '@/hooks/data';
import type { Doc, Pickup } from '@/domain/types';

function PickupSheet({ d, p, onClose }: { d: Derived; p: Pickup; onClose: () => void }) {
  const act = useAct(); const nav = useNavigate();
  const [label, setLabel] = useState(p.label); const [date, setDate] = useState(p.date); const [channel, setChannel] = useState(p.channel); const [del, setDel] = useState(false);
  const os = d.snap.orders.filter((o) => o.pickupId === p.id); const shipped = os.filter((o) => o.status === 'shipped').length;
  return (
    <Sheet title={p.label} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3"><Kpi label="أوردرات" value={os.length} sub={`${fmt(os.reduce((a, o) => a + o.lines.length, 0))} قطعة`} /><Kpi label="مشحون" value={shipped} tone={shipped ? 'good' : undefined} /></div>
      <p className="text-[13px] text-muted">الملف الأصلي: <b>{p.source || '—'}</b></p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="اسم البيك أب" className="col-span-2"><input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
        <Field label="التاريخ"><input type="date" value={date} max={d.today} onChange={(e) => setDate(e.target.value > d.today ? d.today : e.target.value)} /></Field>
        <Field label="القناة"><select value={channel} onChange={(e) => setChannel(e.target.value)}>{CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      </div>
      <div className="flex gap-2"><Button variant="primary" disabled={!label.trim()} onClick={async () => { const r = await act(() => repo.pickupUpdate({ id: p.id, label, date, channel }).then(() => true), 'تم حفظ التعديل'); if (r) onClose(); }}>حفظ التعديل</Button><Button onClick={() => { onClose(); nav(`/orders?pk=${p.id}`); }}>عرض أوردراته</Button></div>
      <div className="rounded-xl border border-line p-3"><h3 className="mb-1 font-display font-semibold">حذف البيك أب</h3>
        {shipped ? <Alert tone="warn">لا يمكن الحذف لأن فيه {shipped} أوردر مشحون (خُصم رصيده). اعكس ملفات الشحن أولًا من تبويب «ملفات الشحن».</Alert>
          : del ? <Alert tone="crit">سيتم حذف {os.length} أوردر من «{p.label}» ولن تُحتسب طلبًا. لا يتأثر المخزون لأن البيك أب لا يخصم. هل أنت متأكد؟<div className="mt-2 flex gap-2"><Button variant="danger" size="sm" onClick={async () => { const r = await act(() => repo.pickupDelete(p.id), (n) => `تم حذف ${p.label} (${n} أوردر)`); if (r !== undefined) onClose(); }}>نعم، احذف</Button><Button size="sm" onClick={() => setDel(false)}>لا</Button></div></Alert>
          : <Button variant="danger" size="sm" onClick={() => setDel(true)}>حذف البيك أب</Button>}
      </div>
    </Sheet>
  );
}

function ShipmentSheet({ d, doc, onClose }: { d: Derived; doc: Doc; onClose: () => void }) {
  const act = useAct(); const [emp, setEmp] = useState(String(doc.hdr.employee ?? doc.by)); const [rev, setRev] = useState(false);
  const refs = d.snap.orders.filter((o) => o.shipDoc === doc.no); const done = doc.status === 'done';
  return (
    <Sheet title={`ملف شحن ${doc.no}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3"><Kpi label="أوردرات" value={Number(doc.hdr.orders ?? refs.length)} sub={`${fmt(Number(doc.hdr.pieces ?? 0))} قطعة`} /><Kpi label="الحالة" value={<span className="font-sans text-lg">{done ? 'مؤكد' : 'معكوس'}</span>} /></div>
      <p className="text-[13px] text-muted">{doc.date} · الملف الأصلي: <b>{String(doc.hdr.source ?? '—')}</b></p>
      {done ? (
        <>
          <Field label="اسم الموظف"><input value={emp} onChange={(e) => setEmp(e.target.value)} /></Field>
          <div><Button variant="primary" disabled={!emp.trim() || emp.trim() === String(doc.hdr.employee ?? doc.by)} onClick={async () => { const r = await act(() => repo.renameShipmentEmployee(doc.no, emp), 'تم تحديث اسم الموظف'); if (r !== undefined) onClose(); }}>حفظ اسم الموظف</Button>
            <p className="mt-1 text-xs text-muted">يحدّث الأوردرات وإحصائيات الموظفين. تبقى حركات المخزون القديمة كما هي في السجل.</p></div>
          <div className="rounded-xl border border-line p-3"><h3 className="mb-1 font-display font-semibold">عكس الملف كله</h3>
            {rev ? <Alert tone="crit">سيعيد الأوردرات إلى «بانتظار الشحن» ويعيد القطع إلى المخزون والمستلزمات. هل أنت متأكد؟<div className="mt-2 flex gap-2"><Button variant="danger" size="sm" onClick={async () => { await act(() => repo.reverseShipment(doc.no), 'تم عكس الملف'); onClose(); }}>نعم، اعكس</Button><Button size="sm" onClick={() => setRev(false)}>لا</Button></div></Alert>
              : <><p className="mb-2 text-muted">استخدمه إذا رُفع الملف بالخطأ. يُسجَّل بحركة عكسية ولا يُحذف القديم.</p><Button variant="danger" size="sm" onClick={() => setRev(true)}>عكس الملف</Button></>}
          </div>
        </>
      ) : <Alert>تم عكس هذا الملف.</Alert>}
    </Sheet>
  );
}

export default function Files() {
  const { d, isLoading, error } = useDerived(); const act = useAct(); const nav = useNavigate();
  const [tab, setTab] = useState<'pk' | 'sc' | 'ph' | 'cx'>('pk'); const [pk, setPk] = useState<Pickup | null>(null); const [sc, setSc] = useState<Doc | null>(null);
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !d) return <Spinner />;
  const ships = d.snap.docs.filter((x) => x.type === 'SCN').slice().reverse(); const rcv = d.snap.docs.filter((x) => x.type === 'RCV').slice().reverse();
  const cx = d.snap.orders.filter((o) => o.status === 'cancelled' && o.cancel).sort((a, b) => b.cancel!.at.localeCompare(a.cancel!.at));
  return (
    <>
      <PageHead title="الملفات" sub="كل ما رُفع أو سُجّل: ملفات البيك أب والشحن، وصور الورق الموقّع، والأوردرات الملغاة. من هنا تعدّلها أو تحذفها أو تعكسها." />
      <Alert className="mb-4"><b>أين تُحفظ ملفاتي؟</b><br />لا يُخزَّن ملف Excel أو CSV نفسه. يقرؤه النظام ويحفظ البيانات المستخرجة منه (الأوردرات والكميات) واسم الملف كمرجع. أما صور الورق الموقّع والبوليصات الملغاة فتُحفظ {repo.mode === 'supabase' ? 'في تخزين Supabase' : 'في هذا المتصفح فقط'}.</Alert>
      <Tabs value={tab} onChange={setTab} tabs={[['pk', 'ملفات البيك أب'], ['sc', 'ملفات الشحن'], ['ph', 'صور المستندات'], ['cx', 'الإلغاءات']]} />
      {tab === 'pk' && (d.snap.pickups.length ? <TableWrap><table className="text-sm"><thead><tr>{['البيك أب', 'الملف', 'التاريخ', 'القناة', 'أوردرات', 'مشحون', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>{[...d.snap.pickups].reverse().map((p) => { const os = d.snap.orders.filter((o) => o.pickupId === p.id && o.status !== 'cancelled'); return <tr key={p.id}><td className={td}><b>{p.label}</b></td><td className={td + ' text-muted'}>{p.source}</td><td className={td + ' font-mono'}>{p.date}</td><td className={td}>{channelName(p.channel)}</td><td className={td + ' font-mono'}>{os.length}</td><td className={td + ' font-mono'}>{os.filter((o) => o.status === 'shipped').length}</td><td className={td}><Button size="sm" onClick={() => setPk(p)}>تعديل</Button></td></tr>; })}</tbody></table></TableWrap> : <Card><Empty>لا توجد ملفات بيك أب بعد. ارفع ملفًا من صفحة الأوردرات.</Empty></Card>)}
      {tab === 'sc' && (ships.length ? <TableWrap><table className="text-sm"><thead><tr>{['الرقم', 'الموظف', 'الملف', 'التاريخ', 'أوردرات', 'قطع', 'الحالة', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>{ships.map((x) => <tr key={x.no}><td className={td + ' font-mono'}>{x.no}</td><td className={td}>{String(x.hdr.employee ?? x.by)}</td><td className={td + ' text-muted'}>{String(x.hdr.source ?? '')}</td><td className={td + ' font-mono'}>{x.date}</td><td className={td + ' font-mono'}>{String(x.hdr.orders ?? '')}</td><td className={td + ' font-mono'}>{String(x.hdr.pieces ?? '')}</td><td className={td}>{x.status === 'done' ? <Pill tone="good">مؤكد</Pill> : <Pill>معكوس</Pill>}</td><td className={td}><Button size="sm" onClick={() => setSc(x)}>{x.status === 'done' ? 'تعديل' : 'عرض'}</Button></td></tr>)}</tbody></table></TableWrap> : <Card><Empty>لا توجد ملفات شحن بعد. ارفع ملف السكان من صفحة الأوردرات.</Empty></Card>)}
      {tab === 'ph' && (rcv.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rcv.map((x) => <Card key={x.no}><div className="mb-2 flex items-center justify-between"><b className="font-mono">{x.no}</b><Pill tone="good">مؤكد</Pill></div><div className="mb-2 text-muted">{TYPE_AR[x.type] ?? x.type} · {x.date} · {fmt(x.lines.reduce((a, l) => a + l.qty, 0))} قطعة</div><Photo path={x.attachment} className="w-full rounded-xl border border-line" /></Card>)}</div> : <Card><Empty>لا توجد صور بعد. تُرفق الصورة مع عملية الاستلام.</Empty></Card>)}
      {tab === 'cx' && (cx.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cx.map((o) => <Card key={o.ref}><Photo path={o.cancel!.attachment} className="mb-2 w-full rounded-xl border border-line" /><div className="flex items-center justify-between"><b className="font-mono">{o.ref}</b><Pill tone="lost">ملغي</Pill></div><div className="my-1 text-xs text-muted">شحن {o.waybill} · {o.lines.length} قطعة · {o.cancel!.at.slice(0, 10)} · {o.cancel!.by}{o.cancel!.reason ? <><br />{o.cancel!.reason}</> : null}{o.cancel!.returned ? <><br />أُعيدت القطع للمخزون ({o.cancel!.doc})</> : null}</div>
        <div className="flex gap-2"><Button size="sm" onClick={() => nav('/orders?f=cx')}>تفاصيل</Button><Button size="sm" onClick={() => act(() => repo.restoreOrder(o.ref), 'تمت استعادة الأوردر')}>استعادة الأوردر</Button></div></Card>)}</div> : <Card><Empty>لا توجد أوردرات ملغاة.</Empty></Card>)}
      {pk && <PickupSheet d={d} p={pk} onClose={() => setPk(null)} />}
      {sc && <ShipmentSheet d={d} doc={sc} onClose={() => setSc(null)} />}
    </>
  );
}
