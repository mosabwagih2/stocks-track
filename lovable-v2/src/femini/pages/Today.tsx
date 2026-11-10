import { serverEdition } from '@/femini/data';
import { dayClosed } from '@/femini/domain/reports';
import { useMemo, useState } from 'react';
import { useNavigate } from '@/femini/router';
import { AlertTriangle, Info, Upload, ArrowDownToLine, Shuffle, ChevronRight, ChevronLeft, LockKeyhole } from 'lucide-react';
import { useAct, useDerived } from '@/femini/hooks/data';
import { repo } from '@/femini/data';
import { EventDetails } from '@/femini/components/EventDetails';
import type { Move } from '@/femini/domain/types';
import { Alert, Button, Card, Kpi, Pill, Sheet, TableWrap, th, td, Empty } from '@/femini/components/ui';
import { OrderPill, ErrorBox } from '@/femini/components/shared';
import { FlowArea, Sparkline, StateDonut, StockArea, useDaily, useStockDaily, C } from '@/femini/components/charts';
import { EventTable, docEvents } from '@/femini/components/MoveRows';
import { Seg } from '@/femini/components/ui';
const DAYS: [string, string][] = [['7', '7 يوم'], ['14', '14 يوم'], ['30', '30 يوم']];
import { Spinner } from '@/femini/components/Spinner';
import { OrderSheet, UploadSheet, CancelSheet } from '@/femini/components/OrderSheets';
import { addDays, dayLabel, timeCairo } from '@/femini/domain/dates';
import { channelName, LOC_AR, BACKDATE_DAYS } from '@/femini/domain/constants';
import { cn, fmt, pct } from '@/femini/cn';
import { skuLabel } from '@/femini/domain/orders';
import { locTotal, qty } from '@/femini/domain/ledger';
import { dailyUse, supplyBalance, supplyStatus } from '@/femini/domain/supplies';
import { cellInfo } from '@/femini/domain/stock';
import type { Derived } from '@/femini/hooks/data';
import type { Order } from '@/femini/domain/types';
import { backupDue } from '@/femini/domain/reports';
import { DayCloseReport } from '@/femini/components/DayCloseReport';
import { Deferred } from '@/femini/components/Deferred';

type FlowKey = 'all' | 'done' | 'wait' | 'blocked' | 'older';

function FlowSheet({ d, w, orders, onClose, onOrder }: { d: Derived; w: FlowKey; orders: Order[]; onClose: () => void; onOrder: (ref: string) => void }) {
  const nav = useNavigate();
  const open = orders.filter((o) => o.status === 'open');
  const day = (o: Order) => d.pickupDate.get(o.pickupId) ?? '';
  const list = { all: orders, done: orders.filter((o) => o.status === 'shipped'), wait: open.filter((o) => !d.blocked.has(o.ref)), blocked: open.filter((o) => d.blocked.has(o.ref)), older: [...open].sort((a, b) => day(a).localeCompare(day(b))) }[w];
  const title = { all: 'المطلوب اليوم', done: 'المشحون اليوم', wait: 'لم يُشحن بعد', blocked: 'متوقف بسبب المخزون', older: 'متأخر من أيام سابقة' }[w];
  const pcs = list.reduce((a, o) => a + o.lines.length, 0);
  const byVariant = (() => {
    const m: Record<string, { n: number; q: number }> = {};
    const src = w === 'blocked' || w === 'older' ? list.flatMap((o) => (d.blocked.get(o.ref) ?? []).map((x) => ({ sku: x.sku, q: x.short }))) : w === 'wait' ? list.flatMap((o) => o.lines.map((s) => ({ sku: s, q: 1 }))) : [];
    for (const x of src) { const e = (m[x.sku] ??= { n: 0, q: 0 }); e.n++; e.q += x.q; }
    return Object.entries(m).sort((a, b) => b[1].n - a[1].n).slice(0, 30);
  })();
  const team = (() => { const m: Record<string, { o: number; p: number; a: string; b: string }> = {}; for (const o of list) if (o.status === 'shipped' && o.shippedBy) { const e = (m[o.shippedBy] ??= { o: 0, p: 0, a: o.shippedAt!, b: o.shippedAt! }); e.o++; e.p += o.lines.length; if (o.shippedAt! < e.a) e.a = o.shippedAt!; if (o.shippedAt! > e.b) e.b = o.shippedAt!; } return Object.entries(m).sort((a, b) => b[1].o - a[1].o); })();
  return (
    <Sheet title={`${title} (${list.length} أوردر · ${fmt(pcs)} قطعة)`} onClose={onClose}>
      {!list.length ? <Empty>لا توجد أوردرات هنا.</Empty> : (
        <>
          {w === 'blocked' && <Alert>يتوقف الأوردر إذا نقصت أي قطعة منه، لأنه يُشحن كاملًا. الناقص محسوب على الجاهز حاليًا وموزّع على الأوردرات بالترتيب.</Alert>}
          {w === 'older' && <Alert tone="warn">أوردرات من بيك أب أيام فاتت ولسه ما اتشحنتش، الأقدم الأول. {list.filter((o) => d.blocked.has(o.ref)).length ? <>منهم <b>{list.filter((o) => d.blocked.has(o.ref)).length}</b> متوقف بسبب المخزون (الناقص في الجدول).</> : 'كلها رصيدها موجود ومستنية الإسكان.'}</Alert>}
          {w === 'wait' && <Alert>أوردرات مطلوبة ويتوفر لها رصيد، لكنها لم تُشحن بعد. لم يُخصم الرصيد بعد.</Alert>}
          {byVariant.length > 0 && (
            <TableWrap><table className="text-sm"><thead><tr><th className={th}>الصنف</th><th className={th}>جاهز</th><th className={th}>{w === 'blocked' || w === 'older' ? 'ناقص' : 'مطلوب'}</th><th className={th}>أوردرات</th></tr></thead>
              <tbody>{byVariant.map(([s, e]) => <tr key={s}><td className={td}>{skuLabel(d.skuMap, s)}</td><td className={td + ' font-mono'}>{fmt(qty(d.snap.balances, s, 'READY'))}</td><td className={td}>{w === 'blocked' || w === 'older' ? <Pill tone="crit">{e.q}</Pill> : <span className="font-mono">{e.q}</span>}</td><td className={td + ' font-mono'}>{e.n}</td></tr>)}</tbody></table></TableWrap>
          )}
          {w === 'done' && (
            <TableWrap><table className="text-sm"><thead><tr><th className={th}>الموظف</th><th className={th}>أوردرات</th><th className={th}>قطع</th><th className={th}>من - إلى</th></tr></thead>
              <tbody>{team.map(([k, e]) => <tr key={k}><td className={td}>{k}</td><td className={td + ' font-mono'}>{e.o}</td><td className={td + ' font-mono'}>{e.p}</td><td className={td + ' font-mono'}>{timeCairo(e.a)} - {timeCairo(e.b)}</td></tr>)}</tbody></table></TableWrap>
          )}
          <TableWrap><table className="text-sm"><thead><tr><th className={th}>الكود</th><th className={th}>تاريخ البيك أب</th><th className={th}>قطع</th><th className={th}>الحالة</th></tr></thead>
            <tbody>{list.slice(0, w === 'older' ? 500 : 80).map((o) => <tr key={o.ref} className="cursor-pointer hover:bg-lav" onClick={() => onOrder(o.ref)}><td className={td + ' font-mono'}>{o.ref}</td><td className={td + ' font-mono text-muted'}>{day(o) || '—'}</td><td className={td + ' font-mono'}>{o.lines.length}</td><td className={td}><OrderPill o={o} d={d} /></td></tr>)}</tbody></table></TableWrap>
          <Button onClick={() => { onClose(); nav(w === 'older' ? '/orders?f=wait' : '/orders'); }}>عرضها في صفحة الأوردرات</Button>
        </>
      )}
    </Sheet>
  );
}

export default function Today() {
  const { d, isLoading, error } = useDerived();
  const act = useAct(); const [date, setDate] = useState(''); const [closing, setClosing] = useState(false); const [event, setEvent] = useState<Move[] | null>(null);
  const selected = date || d?.today || ''; const historical = !!d && selected !== d.today; const tooOld = !!d && selected < addDays(d.today, -BACKDATE_DAYS);
  const nav = useNavigate();
  const [flow, setFlow] = useState<FlowKey | null>(null);
  const [upload, setUpload] = useState<'scan' | 'pickup' | null>(null);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [cancel, setCancel] = useState<string | null>(null);
  const [metric, setMetric] = useState<'orders' | 'pieces'>('orders');
  // the period of the charts on this page (7 / 14 / 30 days), remembered in this browser
  const [range, setRangeState] = useState<number>(() => { try { return Number(localStorage.getItem('femini-today-range')) || 14; } catch { return 14; } });
  const setRange = (v: string) => { setRangeState(Number(v)); try { localStorage.setItem('femini-today-range', v); } catch { /* private mode */ } };
  const daily = useDaily(d, range);
  const [stockRange, setStockRangeState] = useState<number>(() => { try { return Number(localStorage.getItem('femini-stock-range')) || 14; } catch { return 14; } });
  const setStockRange = (v: string) => { setStockRangeState(Number(v)); try { localStorage.setItem('femini-stock-range', v); } catch { /* private mode */ } };
  const stockDaily = useStockDaily(d, stockRange);
  const dayEvents = useMemo(() => (d ? docEvents(d.snap.moves.filter((m) => m.date === selected)) : []), [d, selected]);

  const x = useMemo(() => {
    if (!d) return null;
    const ids = new Set(d.snap.pickups.filter((p) => p.date === selected).map((p) => p.id));
    const orders = d.snap.orders.filter((o) => ids.has(o.pickupId) && o.status !== 'cancelled');
    const done = orders.filter((o) => o.status === 'shipped'); const open = orders.filter((o) => o.status === 'open');
    const blk = open.filter((o) => d.blocked.has(o.ref)); const wait = open.filter((o) => !d.blocked.has(o.ref));
    const pcs = (a: Order[]) => a.reduce((s, o) => s + o.lines.length, 0);
    const older = d.open.filter((o) => (d.pickupDate.get(o.pickupId) ?? d.today) < d.today);
    const oldDay = older.map((o) => d.pickupDate.get(o.pickupId)!).sort()[0];
    const olderBy: Record<string, number> = {}; for (const o of older) { const k = d.pickupDate.get(o.pickupId)!; olderBy[k] = (olderBy[k] ?? 0) + 1; }
    const olderDays = Object.keys(olderBy).sort(); const olderBlk = older.filter((o) => d.blocked.has(o.ref));
    const neg = d.snap.skus.filter((s) => qty(d.snap.balances, s.id, 'READY') < 0);
    const low = d.snap.skus.filter((s) => {
      const c = cellInfo(s, d.snap.balances, d.demand, d.velocity, d.velocityOK, 14);
      return c.level === 'warn' && (d.velocityOK || (d.pull[s.model] ?? 0) > 0 || c.demand > 0);
    });
    const supLow = d.snap.supplies.filter((s) => !s.archived && supplyStatus(s, supplyBalance(d.snap.supplyLog, s.id), dailyUse(d.snap.supplyLog, s.id, d.today)) !== 'good');
    // the employee is the name in the scan file; the account that uploaded the file is a different thing, kept apart
    const team: Record<string, { o: number; p: number; a: string; b: string; up: Set<string> }> = {}; const docBy = new Map(d.snap.docs.map((x) => [x.no, x.by]));
    for (const o of done) if (o.shippedBy) { const e = (team[o.shippedBy] ??= { o: 0, p: 0, a: o.shippedAt!, b: o.shippedAt!, up: new Set<string>() }); e.o++; e.p += o.lines.length; const by = o.shipDoc ? docBy.get(o.shipDoc) : undefined; if (by) e.up.add(by); if (o.shippedAt! < e.a) e.a = o.shippedAt!; if (o.shippedAt! > e.b) e.b = o.shippedAt!; }
    return { ids, orders, done, open, blk, wait, pcs, older, oldDay, olderBy, olderDays, olderBlk, neg, low, supLow, team, pickups: d.snap.pickups.filter((p) => p.date === selected) };
  }, [d, selected]);

  if (error) return <ErrorBox error={error} />;
  if (isLoading || !d || !x) return <Spinner />;

  const actions: { tone: 'crit' | 'warn' | 'info'; title: string; desc: string; go: () => void; btn: string }[] = [];
  if (x.neg.length) actions.push({ tone: 'crit', title: `رصيد سالب في ${x.neg.length} صنف`, desc: 'تم شحن كمية أكبر من الرصيد. أجرِ جردًا لهذه الأصناف وصحّح الرصيد.', go: () => nav('/stock'), btn: 'فتح المخزون' });
  if (d.blocked.size) actions.push({ tone: 'crit', title: `${d.blocked.size} أوردر متوقف بسبب الرصيد`, desc: 'نقص قطعة واحدة في الأوردر يوقفه بالكامل. راجع الأصناف الأكثر تسببًا في التوقف.', go: () => nav('/orders?f=blocked'), btn: 'عرض الأوردرات' });
  const waiting = d.open.length - d.blocked.size;
  if (waiting > 0) actions.push({ tone: 'warn', title: `${waiting} أوردر لم يُشحن بعد`, desc: 'وردت في البيك أب وتنتظر التسجيل بالسكان. لم يُخصم الرصيد بعد.', go: () => nav('/orders?f=wait'), btn: 'عرض الأوردرات المنتظرة' });
  if (x.low.length) actions.push({ tone: 'warn', title: `${x.low.length} صنف على وشك النفاد`, desc: d.velocityOK ? 'أقل من تغطية 14 يومًا' : 'أقل من الحد الأدنى المسجّل (لا يتوفر تاريخ كافٍ بعد).', go: () => nav('/stock'), btn: 'فتح المخزون' });
  const dirty = locTotal(d.snap.balances, 'DIRTY'); if (dirty > 0) actions.push({ tone: 'info', title: `${fmt(dirty)} قطعة ${LOC_AR.DIRTY}`, desc: 'أرسلها إلى المصنع للغسيل المجاني.', go: () => nav('/operations'), btn: 'العمليات' });
  const lost = locTotal(d.snap.balances, 'LOST'); if (lost > 0) actions.push({ tone: 'warn', title: `${fmt(lost)} قطعة مفقودة بانتظار التسوية`, desc: 'هل تم العثور عليها أم يُشطب الرصيد؟', go: () => nav('/operations'), btn: 'العمليات' });
  if (x.supLow.length) actions.push({ tone: 'warn', title: `مستلزمات على وشك النفاد: ${x.supLow.map((s) => s.name).join('، ')}`, desc: 'محسوب من آخر 7 أيام شحن وحد التنبيه.', go: () => nav('/stock?view=supplies'), btn: 'المستلزمات' });

  const total = x.orders.length;
  const w = (n: number) => (total ? `${(n / total) * 100}%` : '0%');
  const team = Object.entries(x.team).sort((a, b) => b[1].o - a[1].o);
  return (
    <>
      <section aria-label="إجراءات اليوم" className="mb-5 border-b border-line pb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5">
            {/* right = newer, left = older (like a timeline read from the left) */}
            <Button className="size-10 shrink-0 p-0" aria-label="اليوم التالي" title="اليوم التالي" disabled={!historical} onClick={()=>setDate(addDays(selected,1))}><ChevronRight className="size-4" /></Button>
            <input className="h-10 w-40 min-w-0" aria-label="يوم التقرير" type="date" value={selected} max={d.today} onChange={(e)=>setDate(e.target.value)} />
            <Button className="size-10 shrink-0 p-0" aria-label="اليوم السابق" title="اليوم السابق" onClick={()=>setDate(addDays(selected,-1))}><ChevronLeft className="size-4" /></Button>
            {historical && <Button size="sm" onClick={()=>setDate('')}>العودة لليوم</Button>}
          </div>
          <Button className="h-10" onClick={()=>setClosing(true)}><LockKeyhole className="size-4" />{dayClosed(d.snap,selected) ? 'تقرير اليوم المقفول' : 'قفل اليوم'}</Button>
        </div>
        {historical && <p className="mb-3 text-xs text-muted">{dayLabel(selected)} · {tooOld ? 'قراءة فقط' : 'تقدر ترفع بيك أب أو ملف إسكان على اليوم ده لو كنت نسيته'}</p>}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Button className="h-11 w-full" disabled={tooOld} variant="primary" onClick={() => setUpload('scan')}><Upload className="size-4 shrink-0" />رفع ملف الإسكان</Button>
          <Button className="h-11 w-full" disabled={tooOld} onClick={() => setUpload('pickup')}><Upload className="size-4 shrink-0" />رفع بيك أب</Button>
          <Button className="h-11 w-full" disabled={historical} onClick={()=>nav('/operations?op=RCV')}><ArrowDownToLine className="size-4 shrink-0" />استلام توريد</Button>
          <Button className="h-11 w-full" disabled={historical} onClick={()=>nav('/operations?op=CLN')}><Shuffle className="size-4 shrink-0" />تصنيف الهالك</Button>
        </div>
      </section>
      <div className="grid gap-4">
        {backupDue(d.snap.lastBackup) && <Alert tone="warn" className="flex flex-wrap items-center justify-between gap-2"><span>{d.snap.lastBackup ? 'مرّ أكثر من أسبوع على آخر نسخة احتياطية؛ حان وقت نسخة حديثة.' : 'لم تؤخذ نسخة احتياطية بعد؛ احمِ شغلك بنسخة الآن.'}</span><Button size="sm" onClick={()=>nav('/settings')}>النسخ الاحتياطي</Button></Alert>}
        {dayClosed(d.snap,selected) && <Alert>اليوم مقفول؛ لا يمكن تسجيل عمليات بتاريخ هذا اليوم قبل فتحه من التقرير.</Alert>}
        <Card title="تدفق اليوم" hint="البيك أب هو الطلب. الخصم من المخزون يتم عند الشحن بالسكان فقط.">
          {/* always there, also on a new day with no pickup yet: what is still waiting from earlier days */}
          <div className={cn('grid gap-3', total ? 'mb-4 grid-cols-2 md:grid-cols-5' : 'mb-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-5')}>
            <Kpi label="متأخر من أيام سابقة" value={fmt(x.older.length)} sub={x.older.length ? `${fmt(x.pcs(x.older))} قطعة · من ${x.oldDay}${x.olderBlk.length ? ` · ${x.olderBlk.length} متوقف` : ''}` : 'مفيش حاجة متأخرة'} tone={x.olderBlk.length ? 'crit' : x.older.length ? 'warn' : 'good'} onClick={x.older.length ? () => setFlow('older') : undefined}>{x.olderDays.length > 1 && <Sparkline data={x.olderDays.map((k) => x.olderBy[k])} labels={x.olderDays} color={C.scrap} />}</Kpi>
          {!total ? <div className="md:col-span-4"><Empty>لا يوجد بيك أب اليوم. ارفع ملف البيك أب.</Empty></div> : <>
                <Kpi label="المطلوب (بيك أب)" value={fmt(total)} sub={`${fmt(x.pcs(x.orders))} قطعة`} onClick={() => setFlow('all')}><Sparkline data={daily.map((r) => r.req)} labels={daily.map((r) => r.day)} /></Kpi>
                <Kpi label="تم الشحن (خرج فعلًا)" value={fmt(x.done.length)} sub={`${fmt(x.pcs(x.done))} قطعة · ${pct(x.done.length, total)}%`} tone="good" onClick={x.done.length ? () => setFlow('done') : undefined}><Sparkline data={daily.map((r) => r.ship)} labels={daily.map((r) => r.day)} color={C.ready} /></Kpi>
                <Kpi label="لم يُشحن بعد" value={fmt(x.wait.length)} sub={`${fmt(x.pcs(x.wait))} قطعة`} tone={x.wait.length ? 'warn' : undefined} onClick={x.wait.length ? () => setFlow('wait') : undefined}><Sparkline data={daily.map((r) => Math.max(0, r.req - r.ship))} labels={daily.map((r) => r.day)} color={C.dirty} /></Kpi>
                <Kpi label="متوقف بسبب المخزون" value={fmt(x.blk.length)} sub={`${fmt(x.pcs(x.blk))} قطعة`} tone={x.blk.length ? 'crit' : undefined} onClick={x.blk.length ? () => setFlow('blocked') : undefined}><div className="mt-2 h-2 overflow-hidden rounded-full bg-grid"><i className="block h-full rounded-full bg-scrap" style={{ width: `${pct(x.blk.length, total)}%` }} /></div><span className="mt-1 text-[11px] text-muted">{pct(x.blk.length, total)}% من طلب اليوم</span></Kpi>
              </>}
          </div>
          {total > 0 && (
            <>
              <div className="flex h-2 gap-1 overflow-hidden rounded-full bg-grid" role="img" aria-label={`تم شحن ${x.done.length} من ${total}`}>
                <i className="rounded-full bg-ready" style={{ width: w(x.done.length) }} /><i className="rounded-full bg-line2" style={{ width: w(x.wait.length) }} /><i className="rounded-full bg-scrap" style={{ width: w(x.blk.length) }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted"><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-ready" />مشحون</span><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-line2" />بانتظار الشحن</span><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-scrap" />متوقف بسبب المخزون</span></div>
              <div className="mt-3 grid gap-1">{x.pickups.map((p) => { const po = x.orders.filter((o) => o.pickupId === p.id); return <div key={p.id} className="flex justify-between rounded-lg px-2 py-1.5 hover:bg-lav"><span><b>{p.label}</b> <span className="text-muted">· {channelName(p.channel)}</span></span><span><span className="num">{po.filter((o) => o.status === 'shipped').length}</span> من <span className="num">{po.length}</span> مشحون</span></div>; })}</div>
            </>
          )}
        </Card>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-4">
          <Deferred minHeight={400}>
          <Card title="حركة الأوردرات والشحن" action={<div className="flex flex-wrap gap-2"><Seg value={metric} onChange={setMetric} options={[['orders', 'أوردرات'], ['pieces', 'قطع']]} /><Seg label="الفترة" value={String(range)} onChange={setRange} options={DAYS} /></div>}>
            <FlowArea data={daily} metric={metric} />
          </Card>
          </Deferred>
          <Deferred minHeight={320}>
          <Card title="حركة المخزون" action={<Seg label="الفترة" value={String(stockRange)} onChange={setStockRange} options={DAYS} />}>
            <StockArea data={stockDaily} />
          </Card>
          </Deferred>
          </div>
          <Deferred minHeight={300}>
          <Card title="المخزون حسب الحالة" hint="من دفتر الحركات"><StateDonut d={d} compact /></Card>
          </Deferred>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card title="يتطلب إجراء" hint={actions.length ? `${actions.length} عنصر` : ''}>
            {!actions.length ? <Alert tone="good">لا توجد عناصر تتطلب إجراءً حاليًا.</Alert> : (
              <div className="grid gap-2">{actions.map((a, i) => (
                <div key={i} className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border p-3 ${a.tone === 'crit' ? 'border-crit-line bg-crit-bg text-crit' : a.tone === 'warn' ? 'border-warn-line bg-warn-bg text-warn' : 'border-line bg-surface text-ink'}`}>
                  <span className={`grid size-9 place-items-center rounded-xl ${a.tone === 'info' ? 'bg-info text-on-accent' : a.tone === 'crit' ? 'bg-crit text-on-accent' : 'bg-warn text-on-accent'}`}>{a.tone === 'info' ? <Info className="size-4" /> : <AlertTriangle className="size-4" />}</span>
                  <div><b className="block">{a.title}</b><span className="text-[13px] opacity-85">{a.desc}</span></div>
                  <Button size="sm" onClick={a.go}>{a.btn}</Button>
                </div>))}</div>
            )}
          </Card>
          <div className="grid content-start gap-4">
            <Card title="فريق اليوم">
              {!team.length ? <Empty>لم يُسجَّل أي شحن اليوم بعد.</Empty> : (
                <TableWrap><table className="text-sm"><thead><tr><th className={th}>الموظف</th><th className={th}>أوردرات</th><th className={th}>قطع</th><th className={th}>من - إلى</th></tr></thead>
                  <tbody>{team.map(([k, e]) => <tr key={k}><td className={td}>{k}{[...e.up].filter((u) => u !== k).length > 0 && <span className="block text-[11px] font-normal text-muted">رفع الملف: {[...e.up].filter((u) => u !== k).join('، ')}</span>}</td><td className={td + ' font-mono'}>{e.o}</td><td className={td + ' font-mono'}>{e.p}</td><td className={td + ' font-mono'}>{timeCairo(e.a)} - {timeCairo(e.b)}</td></tr>)}</tbody></table></TableWrap>
              )}
              {team.length > 0 && <p className="mt-2 text-xs text-muted">الوقت هو وقت تسجيل الملف وليس وقت التغليف. الاسم هو الموظف المكتوب في ملف السكان، واللي رفع الملف مكتوب تحته.</p>}
            </Card>
          </div>
        </div>
        <Deferred minHeight={220}>
          <Card title="حصل إيه في اليوم ده" hint={dayEvents.length ? `${dayEvents.length} عملية · ${fmt(dayEvents.reduce((a, e) => a + e.pieces, 0))} قطعة` : ''}>
            {!dayEvents.length ? <Empty>مفيش عمليات اتسجلت في اليوم ده.</Empty> : <EventTable events={dayEvents} onOpen={(e) => setEvent(e.moves)} />}
          </Card>
        </Deferred>
      </div>
      {event && <EventDetails d={d} moves={event} title={event[0]?.doc ?? 'حدث'} onClose={()=>setEvent(null)} />}
      {closing && <Sheet title={`تقرير يوم ${selected}`} onClose={()=>setClosing(false)}>
        <Alert>{serverEdition ? 'القفل على السيرفر: بيقفل اليوم ده وكل اللي قبله لكل الموظفين. التنبيهات للعلم ولا تمنع الإغلاق.' : 'قفل محلي في هذا المتصفح؛ التنبيهات للعلم ولا تمنع الإغلاق.'}</Alert>
        <DayCloseReport s={d.snap} date={selected} />
        <label className="flex items-center gap-2"><input type="checkbox" checked={d.snap.autoClose} onChange={(e)=>act(()=>repo.setAutoClose(e.target.checked),'تم تحديث القفل التلقائي')} />قفل الأيام تلقائيًا عند بداية يوم جديد</label>
        <Button variant="primary" onClick={async()=>{const locked=dayClosed(d.snap,selected);await act(()=>locked?repo.reopenDay(selected):repo.closeDay(selected),locked?'تم فتح اليوم':'تم قفل اليوم');}}>{dayClosed(d.snap,selected)?'فتح اليوم':'تأكيد قفل اليوم'}</Button>
      </Sheet>}
      {flow && <FlowSheet d={d} w={flow} orders={flow === 'older' ? x.older : x.orders} onClose={() => setFlow(null)} onOrder={(r) => { setFlow(null); setOrderRef(r); }} />}
      {upload && <UploadSheet d={d} mode={upload} date={selected} onClose={() => setUpload(null)} />}
      {orderRef && <OrderSheet d={d} orderRef={orderRef} onClose={() => setOrderRef(null)} onCancel={(c) => { setOrderRef(null); setCancel(c); }} />}
      {cancel !== null && <CancelSheet d={d} initial={cancel} onClose={() => setCancel(null)} />}
    </>
  );
}
