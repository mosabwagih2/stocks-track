import { useDeferredValue, useMemo, useState } from 'react';
import { useAct, useDerived } from '@/femini/hooks/data';
import { PageHead } from '@/femini/components/PageHead';
import { Button, Empty, Sheet, TableWrap, Tabs, th, td } from '@/femini/components/ui';
import { EventDetails } from '@/femini/components/EventDetails';
import { repo } from '@/femini/data';
import type { Move } from '@/femini/domain/types';
import { ErrorBox } from '@/femini/components/shared';
import { Spinner } from '@/femini/components/Spinner';
import { LOC_AR, TYPE_AR } from '@/femini/domain/constants';
import { skuLabel } from '@/femini/domain/orders';
import { dayLabel } from '@/femini/domain/dates';
import { EventTable, docEvents, type DocEvent } from '@/femini/components/MoveRows';

export default function Ledger() {
  const { d, isLoading, error } = useDerived();
  const act = useAct(); const [tab, setTab] = useState<'events' | 'sku' | 'archive'>('events'); const [person, setPerson] = useState(''); const [date, setDate] = useState(''); const [event, setEvent] = useState<Move[] | null>(null);
  const [restore, setRestore] = useState<{ label: string; run: () => Promise<unknown> } | null>(null);
  const [q, setQ] = useState(''); const dq = useDeferredValue(q); const [type, setType] = useState('');
  const rows = useMemo(() => {
    if (!d) return [];
    const w = dq.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return d.snap.moves.filter((m) => (!type || m.type === type) && (!person || m.by === person) && (!date || m.date === date) && w.every((x) => `${m.sku} ${skuLabel(d.skuMap, m.sku)} ${m.doc}`.toLowerCase().includes(x)));
  }, [d, dq, type, person, date]);
  const byDay = useMemo(() => { const m = new Map<string, DocEvent[]>(); for (const e of docEvents(rows)) (m.get(e.date) ?? m.set(e.date, []).get(e.date)!).push(e); return [...m].sort((a, b) => (a[0] < b[0] ? 1 : -1)); }, [rows]);
  const supplyRows = useMemo(() => (d ? d.snap.supplyLog.filter((e) => (!date || e.date === date) && (!person || e.by === person)).slice().reverse() : []), [d, date, person]);
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !d) return <Spinner />;
  const types = [...new Set(d.snap.moves.map((m) => m.type))];
  return (
    <>
      <PageHead title="السجل" sub="الأحداث وتتبّع الأصناف والأرشيف؛ الحركات المؤكدة ثابتة." />
      <Tabs value={tab} onChange={setTab} tabs={[['events','اللي حصل'],['sku','تتبّع صنف'],['archive','المؤرشف']]} />
      {tab === 'archive' ? <div className="grid gap-3">
        {d.snap.archivedPickups.map((x)=><div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4" key={x.pickup.id}><div><b>{x.pickup.label}</b><p className="text-xs text-muted">بيك أب · {x.orders.length} أوردر</p></div><Button onClick={()=>setRestore({label:x.pickup.label,run:()=>repo.restoreArchive('pickup',x.pickup.id)})}>استرجاع</Button></div>)}
        {d.snap.archivedDrafts.map((x)=><div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4" key={x.id}><div><b>{TYPE_AR[x.type]} · {x.id}</b><p className="text-xs text-muted">مسودة · {x.date}</p></div><Button onClick={()=>setRestore({label:x.id,run:()=>repo.restoreArchive('draft',x.id)})}>استرجاع</Button></div>)}
        {d.snap.supplies.filter((x)=>x.archived).map((x)=><div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4" key={x.id}><div><b>{x.name}</b><p className="text-xs text-muted">مستلزم</p></div><Button onClick={()=>setRestore({label:x.name,run:()=>repo.supplyArchive(x.id,false)})}>استرجاع</Button></div>)}
        {[...new Set(d.snap.archivedSkus.map((s)=>s.model))].map((model)=><div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4" key={model}><div><b>{model}</b><p className="text-xs text-muted">كتالوج · {d.snap.archivedSkus.filter((s)=>s.model===model).length} صنف</p></div><Button onClick={()=>setRestore({label:model,run:()=>repo.catalogRestore({model})})}>استرجاع</Button></div>)}
        {!d.snap.archivedPickups.length && !d.snap.archivedDrafts.length && !d.snap.archivedSkus.length && !d.snap.supplies.some((s)=>s.archived) && <Empty>الأرشيف فارغ.</Empty>}
      </div> : <>
      <div className="mb-3 flex flex-wrap gap-2">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالصنف أو المستند" className="min-w-52 max-w-xs flex-1" aria-label="بحث" />
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="النوع"><option value="">كل الأنواع</option>{types.map((t) => <option key={t} value={t}>{TYPE_AR[t] ?? t}</option>)}</select>
        <select aria-label="الشخص" value={person} onChange={(e)=>setPerson(e.target.value)}><option value="">كل الأشخاص</option>{[...new Set(d.snap.moves.map((m)=>m.by))].map((p)=><option key={p}>{p}</option>)}</select>
        <input type="date" aria-label="اليوم" value={date} onChange={(e)=>setDate(e.target.value)} />
      </div>
      {tab === 'events' ? <div className="grid gap-5">
        {/* one clean row per operation: time · operation · code · by · from → to · pieces (same layout as the variant history) */}
        {byDay.map(([day, evs]) => <section key={day}>
          <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold"><span className="font-mono">{day}</span><span className="text-xs font-normal text-muted">{dayLabel(day)} · {evs.length} عملية · {evs.reduce((a, e) => a + e.pieces, 0).toLocaleString('en')} قطعة</span></h2>
          <EventTable events={evs} onOpen={(e) => setEvent(e.moves)} />
        </section>)}
        {supplyRows.length > 0 && <section><h2 className="mb-2 text-sm font-semibold">المستلزمات</h2><TableWrap><table className="text-sm"><thead><tr>{['التاريخ', 'المستلزم', 'السبب', 'بواسطة', 'الكمية'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead><tbody>{supplyRows.map((e) => <tr key={`s${e.id}`}><td className={td + ' whitespace-nowrap font-mono text-muted'}>{e.date}</td><td className={td}>{d.snap.supplies.find((s) => s.id === e.item)?.name ?? e.item}</td><td className={td + ' text-muted'}>{e.why}</td><td className={td + ' whitespace-nowrap'}>{e.by}</td><td className={td + ' num font-semibold ' + (e.qty < 0 ? 'text-crit' : 'text-good')}>{e.qty > 0 ? '+' : ''}{e.qty}</td></tr>)}</tbody></table></TableWrap></section>}
        {!rows.length && <Empty>لا توجد أحداث مطابقة.</Empty>}</div> : <>
      <p className="mb-3 text-sm text-muted">ابحث بكود صنف كامل لعرض رحلته؛ الرصيد التالي محسوب بعد الحركة من كامل السجل.</p>
      <TableWrap>
        <table className="text-sm"><thead><tr>{['التاريخ', 'المستند', 'الصنف', 'كمية', 'من', 'إلى', 'ملاحظة'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((m) => (
            <tr key={m.id} onClick={()=>setEvent(d.snap.moves.filter((x)=>x.doc===m.doc))} className="cursor-pointer hover:bg-lav"><td className={td + ' font-mono'}>{m.date}</td><td className={td + ' font-mono'}>{m.doc}</td><td className={td}>{skuLabel(d.skuMap, m.sku)}</td><td className={td + ' font-mono'}>{m.qty}</td><td className={td}>{LOC_AR[m.from]}</td><td className={td}>{LOC_AR[m.to]}</td><td className={td + ' text-muted'}>{m.note}<div>جاهز بعد الحركة: {d.snap.moves.filter((x)=>x.sku===m.sku&&x.id<=m.id).reduce((a,x)=>a+(x.to==='READY'?x.qty:0)-(x.from==='READY'?x.qty:0),0)}</div></td></tr>
          ))}{!rows.length && <tr><td colSpan={7}><Empty>لا توجد حركات.</Empty></td></tr>}</tbody></table>
      </TableWrap>
      </> }</>}
      {event && <EventDetails d={d} moves={event} title={event[0]?.doc ?? 'حدث'} onClose={()=>setEvent(null)} />}
      {restore && <Sheet title={`استرجاع ${restore.label}`} onClose={()=>setRestore(null)}><p>هل تريد استرجاع هذا العنصر من الأرشيف؟</p><div className="flex gap-2"><Button variant="primary" onClick={async()=>{await act(restore.run,'تم الاسترجاع');setRestore(null);}}>تأكيد الاسترجاع</Button><Button onClick={()=>setRestore(null)}>إلغاء</Button></div></Sheet>}
    </>
  );
}
