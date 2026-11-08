import { useState } from 'react';
import { Download } from 'lucide-react';
import { downloadBlob } from '@/femini/data/backup';
import { useNavigate } from '@/femini/router';
import { useAct, useDerived } from '@/femini/hooks/data';
import { PageHead } from '@/femini/components/PageHead';
import { Alert, Button, Card, Empty, Field, Kpi, Pill, Sheet, TableWrap, Tabs, th, td } from '@/femini/components/ui';
import { ErrorBox, Photo } from '@/femini/components/shared';
import { OrderSheet } from '@/femini/components/OrderSheets';
import { Spinner } from '@/femini/components/Spinner';
import { CHANNELS, channelName, TYPE_AR } from '@/femini/domain/constants';
import { isAdmin, repo } from '@/femini/data';
import { dayClosed } from '@/femini/domain/reports';
import { fmt } from '@/femini/cn';
import type { Derived } from '@/femini/hooks/data';
import type { Doc, Pickup } from '@/femini/domain/types';

function PickupSheet({ d, p, onClose }: { d: Derived; p: Pickup; onClose: () => void }) {
  const act = useAct(); const nav = useNavigate(); const admin = isAdmin();
  const [label, setLabel] = useState(p.label); const [date, setDate] = useState(p.date); const [channel, setChannel] = useState(p.channel); const [del, setDel] = useState(false);
  const os = d.snap.orders.filter((o) => o.pickupId === p.id); const shipped = os.filter((o) => o.status === 'shipped').length;
  return (
    <Sheet title={p.label} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3"><Kpi label="أوردرات" value={os.length} sub={`${fmt(os.reduce((a, o) => a + o.lines.length, 0))} قطعة`} /><Kpi label="مشحون" value={shipped} tone={shipped ? 'good' : undefined} /></div>
      <p className="text-[13px] text-muted">الملف الأصلي: <b>{p.source || '—'}</b></p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="اسم البيك أب" className="col-span-2"><input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
        <Field label="التاريخ (اليوم اللي اتطلب فيه)"><input type="date" value={date} max={d.today} onChange={(e) => setDate(e.target.value > d.today ? d.today : e.target.value)} /></Field>
        <Field label="القناة"><select value={channel} onChange={(e) => setChannel(e.target.value)}>{CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      </div>
      {admin && (dayClosed(d.snap, p.date) || dayClosed(d.snap, date)) && <p className="-mt-2 text-xs text-muted">اليوم مقفول، بس كمدير تقدر تصحّح تاريخ البيك أب. البيك أب ما بيحرّكش مخزون، فالدفتر ما بيتأثرش.</p>}
      <div className="flex gap-2"><Button variant="primary" disabled={!label.trim()} onClick={async () => { const r = await act(() => repo.pickupUpdate({ id: p.id, label, date, channel, force: admin }).then(() => true), 'تم حفظ التعديل'); if (r) onClose(); }}>حفظ التعديل</Button><Button onClick={() => { onClose(); nav(`/orders?pk=${p.id}`); }}>عرض أوردراته</Button></div>
      <div className="rounded-xl border border-line p-3"><h3 className="mb-1 font-display font-semibold">أرشفة البيك أب</h3>
        {shipped ? <Alert tone="warn">لا يمكن الأرشفة لأن فيه {shipped} أوردر مشحون (خُصم رصيده). يبقى البيك أب محفوظًا لحماية سجل الشحن.</Alert>
          : del ? <Alert tone="crit">سيتم أرشفة {os.length} أوردر من «{p.label}» ولن تُحتسب طلبًا. لا يتأثر المخزون لأن البيك أب لا يخصم. هل أنت متأكد؟<div className="mt-2 flex gap-2"><Button variant="danger" size="sm" onClick={async () => { const r = await act(() => repo.pickupDelete(p.id), (n) => `تمت أرشفة ${p.label} (${n} أوردر)`); if (r !== undefined) onClose(); }}>نعم، أرشف</Button><Button size="sm" onClick={() => setDel(false)}>لا</Button></div></Alert>
          : <Button variant="danger" size="sm" onClick={() => setDel(true)}>أرشفة البيك أب</Button>}
      </div>
    </Sheet>
  );
}

function ShipmentSheet({ d, doc, onClose }: { d: Derived; doc: Doc; onClose: () => void }) {
  const act = useAct(); const [emp, setEmp] = useState(String(doc.hdr.employee ?? doc.by)); const admin = isAdmin();
  const refs = d.snap.orders.filter((o) => o.shipDoc === doc.no); const done = doc.status === 'done';
  // pieces of the sheet from the ledger (older sheets did not store the count)
  const pieces = d.snap.moves.filter((m) => m.doc === doc.no).reduce((a, m) => a + m.qty, 0);
  const orders = Number(doc.hdr.orders ?? (Array.isArray(doc.hdr.refs) ? (doc.hdr.refs as unknown[]).length : refs.length));
  const [newDate, setNewDate] = useState(doc.date); const closed = dayClosed(d.snap, newDate);
  const movable = refs.filter((o) => o.status === 'shipped' && !o.returned).length;
  return (
    <Sheet title={`ملف شحن ${doc.no}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3"><Kpi label="أوردرات" value={orders} sub={`${fmt(pieces)} قطعة`} /><Kpi label="الحالة" value={<span className="font-sans text-lg">{done ? 'مؤكد' : 'معكوس'}</span>} /></div>
      <p className="text-[13px] text-muted">{doc.date} · الملف الأصلي: <b>{String(doc.hdr.source ?? '—')}</b></p>
      {done ? (
        <>
          <Field label="اسم الموظف"><input value={emp} onChange={(e) => setEmp(e.target.value)} /></Field>
          <div><Button variant="primary" disabled={!emp.trim() || emp.trim() === String(doc.hdr.employee ?? doc.by)} onClick={async () => { const r = await act(() => repo.renameShipmentEmployee(doc.no, emp), 'تم تحديث اسم الموظف'); if (r !== undefined) onClose(); }}>حفظ اسم الموظف</Button>
            <p className="mt-1 text-xs text-muted">يحدّث الأوردرات وإحصائيات الموظفين. تبقى حركات المخزون القديمة كما هي في السجل.</p></div>
          {admin && <div className="grid gap-2 rounded-xl border border-line bg-surface p-3">
            <h3 className="text-sm font-semibold">تصحيح تاريخ الورقة <span className="text-xs font-normal text-muted">(للمدير)</span></h3>
            <p className="text-xs text-muted">الورقة المؤكدة ما بتتعدلش في الدفتر. النقل بيعكسها، ويسجّل أوردراتها ({movable}) تاني على اليوم الصحيح في حفظة واحدة، باسم نفس الموظف. الأوردرات اللي ليها مرتجع بتفضل على الورقة القديمة.</p>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="اليوم الصحيح"><input type="date" value={newDate} max={d.today} onChange={(e) => e.target.value && setNewDate(e.target.value > d.today ? d.today : e.target.value)} /></Field>
              {closed && newDate !== doc.date && <Button size="sm" onClick={() => act(() => repo.reopenDay(newDate), `اتفتح يوم ${newDate}`)}>افتح يوم {newDate}</Button>}
              <Button variant="primary" disabled={newDate === doc.date || closed || !movable} onClick={async () => { const r = await act(() => repo.redateShipment(doc.no, newDate), (x) => `اتنقلت الورقة: ${x.doc} على ${newDate} (${x.orders} أوردر)`); if (r) onClose(); }}>نقل الورقة لليوم ده</Button>
            </div>
            {closed && newDate !== doc.date && <p className="text-xs text-warn">يوم {newDate} مقفول؛ افتحه الأول (بيفتح الأيام اللي بعده لحد النهارده، وبتتقفل تاني بكره لوحدها).</p>}
          </div>}

        </>
      ) : <Alert>تم عكس هذا الملف.</Alert>}
    </Sheet>
  );
}

type FileTab = 'pk' | 'sc' | 'ph' | 'cx';
/** which original files belong to each tab (the server keeps them; they download from any device) */
const KIND_OF: Record<FileTab, string[]> = { pk: ['pickup'], sc: ['scan'], ph: ['doc_photo', 'photo'], cx: ['cancel'] };

function Originals({ d, tab }: { d: Derived; tab: FileTab }) {
  const act = useAct();
  const files = d.snap.files.filter((f) => KIND_OF[tab].includes(f.kind)).slice().reverse();
  if (!files.length) return null;
  const download = (f: (typeof files)[number]) => act(async () => {
    const url = await repo.photoUrl(f.path);
    if (!url) throw new Error('الملف ده مش محفوظ (اترفع قبل ما النظام يحفظ الملفات الأصلية).');
    const r = await fetch(url.replace(/[?&]thumb=1$/, ''), { credentials: 'same-origin' });
    if (!r.ok) throw new Error('مقدرتش أنزّل الملف من السيرفر؛ جرّب تاني.');
    downloadBlob(await r.blob(), f.name); return true;
  }, 'تم تجهيز الملف للتنزيل');
  return (
    <div className="mt-5 grid gap-3">
      <h2 className="font-display font-semibold">الملفات الأصلية ({files.length})</h2>
      <TableWrap><table className="text-sm"><thead><tr>{['الملف', 'مرتبط بـ', 'التاريخ', 'الحجم', ''].map((x) => <th className={th} key={x}>{x}</th>)}</tr></thead>
        <tbody>{files.map((f) => <tr key={f.id}><td className={td}>{f.name}</td><td className={td + ' font-mono'}>{f.owner}</td><td className={td + ' font-mono'}>{f.at.slice(0, 10)}</td><td className={td}>{Math.ceil(f.size / 1024)} KB</td>
          <td className={td}><Button size="sm" aria-label={`تنزيل ${f.name}`} onClick={() => download(f)}><Download className="size-4" />تنزيل</Button></td></tr>)}</tbody></table></TableWrap>
    </div>
  );
}

export default function Files() {
  const { d, isLoading, error } = useDerived(); const act = useAct();
  const [tab, setTab] = useState<FileTab>('pk'); const [pk, setPk] = useState<Pickup | null>(null); const [sc, setSc] = useState<Doc | null>(null); const [ord, setOrd] = useState<string | null>(null);
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !d) return <Spinner />;
  const ships = d.snap.docs.filter((x) => x.type === 'SCN').slice().reverse(); const rcv = d.snap.docs.filter((x) => x.attachment).slice().reverse();
  const cx = d.snap.orders.filter((o) => o.status === 'cancelled' && o.cancel).sort((a, b) => b.cancel!.at.localeCompare(a.cancel!.at));
  const piecesOf = (no: string) => d.snap.moves.filter((m) => m.doc === no).reduce((a, m) => a + m.qty, 0);
  return (
    <>
      <PageHead title="الملفات" sub="اختار نوع الملفات: البيك أب، الشحن، صور الورق الموقّع، أو الإلغاءات. الملفات الأصلية محفوظة على السيرفر وتتنزّل من أي جهاز." />
      <Tabs value={tab} onChange={setTab} tabs={[['pk', `ملفات البيك أب (${d.snap.pickups.length})`], ['sc', `ملفات الشحن (${ships.length})`], ['ph', `صور المستندات (${rcv.length})`], ['cx', `الإلغاءات (${cx.length})`]]} />
      {tab === 'pk' && (d.snap.pickups.length ? <TableWrap><table className="text-sm"><thead><tr>{['البيك أب', 'الملف', 'التاريخ', 'القناة', 'أوردرات', 'مشحون', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>{[...d.snap.pickups].reverse().map((p) => { const os = d.snap.orders.filter((o) => o.pickupId === p.id && o.status !== 'cancelled'); return <tr key={p.id}><td className={td}><b>{p.label}</b></td><td className={td + ' text-muted'}>{p.source}</td><td className={td + ' font-mono'}>{p.date}</td><td className={td}>{channelName(p.channel)}</td><td className={td + ' font-mono'}>{os.length}</td><td className={td + ' font-mono'}>{os.filter((o) => o.status === 'shipped').length}</td><td className={td}><Button size="sm" onClick={() => setPk(p)}>تعديل</Button></td></tr>; })}</tbody></table></TableWrap> : <Card><Empty>لا توجد ملفات بيك أب بعد. ارفع ملفًا من صفحة الأوردرات.</Empty></Card>)}
      {tab === 'sc' && (ships.length ? <TableWrap><table className="text-sm"><thead><tr>{['الرقم', 'الموظف', 'الملف', 'التاريخ', 'أوردرات', 'قطع', 'الحالة', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>{ships.map((x) => <tr key={x.no}><td className={td + ' font-mono'}>{x.no}</td><td className={td}>{String(x.hdr.employee ?? x.by)}</td><td className={td + ' text-muted'}>{String(x.hdr.source ?? '')}</td><td className={td + ' font-mono'}>{x.date}</td><td className={td + ' font-mono'}>{String(x.hdr.orders ?? '')}</td><td className={td + ' font-mono'}>{fmt(piecesOf(x.no))}</td><td className={td}>{x.status === 'done' ? <Pill tone="good">مؤكد</Pill> : <Pill>معكوس</Pill>}</td><td className={td}><Button size="sm" onClick={() => setSc(x)}>{x.status === 'done' ? 'تعديل' : 'عرض'}</Button></td></tr>)}</tbody></table></TableWrap> : <Card><Empty>لا توجد ملفات شحن بعد. ارفع ملف الإسكان من صفحة الأوردرات.</Empty></Card>)}
      {tab === 'ph' && (rcv.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rcv.map((x) => <Card key={x.no}><div className="mb-2 flex items-center justify-between"><b className="font-mono">{x.no}</b>{x.status === 'done' ? <Pill tone="good">مؤكد</Pill> : <Pill>معكوس</Pill>}</div><div className="mb-2 text-muted">{TYPE_AR[x.type] ?? x.type} · {x.date} · {fmt(x.lines.reduce((a, l) => a + l.qty, 0))} قطعة</div><Photo path={x.attachment} zoom className={PHOTO} /></Card>)}</div> : <Card><Empty>لا توجد صور بعد. تُرفق الصورة مع عملية الاستلام.</Empty></Card>)}
      {tab === 'cx' && (cx.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cx.map((o) => (
        <Card key={o.ref} className="cursor-pointer transition hover:border-accent" >
          <div role="button" tabIndex={0} onClick={() => setOrd(o.ref)} onKeyDown={(e) => e.key === 'Enter' && setOrd(o.ref)} aria-label={`تفاصيل ${o.ref}`}>
            <div className="mb-2 flex items-center justify-between"><b className="font-mono">{o.ref}</b><Pill tone="lost">ملغي</Pill></div>
            <div className="mb-2 text-muted">أوردر {o.waybill} · {o.lines.length} قطعة · {o.cancel!.at.slice(0, 10)} · {o.cancel!.by}</div>
            {(o.cancel!.reason || o.cancel!.returned) && <div className="mb-2 text-xs text-muted">{o.cancel!.reason}{o.cancel!.reason && o.cancel!.returned ? ' · ' : ''}{o.cancel!.returned ? `القطع رجعت للمخزون (${o.cancel!.doc})` : ''}</div>}
          </div>
          <Photo path={o.cancel!.attachment} zoom className={PHOTO} />
          <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => setOrd(o.ref)}>تفاصيل</Button><Button size="sm" onClick={() => act(() => repo.restoreOrder(o.ref), 'تمت استعادة الأوردر')}>استعادة الأوردر</Button></div>
        </Card>))}</div> : <Card><Empty>لا توجد أوردرات ملغاة.</Empty></Card>)}
      <Originals d={d} tab={tab} />
      {pk && <PickupSheet d={d} p={pk} onClose={() => setPk(null)} />}
      {sc && <ShipmentSheet d={d} doc={sc} onClose={() => setSc(null)} />}
      {ord && <OrderSheet d={d} orderRef={ord} onClose={() => setOrd(null)} onCancel={() => {}} />}
    </>
  );
}
const PHOTO = 'aspect-[4/3] w-full rounded-xl border border-line object-cover';
