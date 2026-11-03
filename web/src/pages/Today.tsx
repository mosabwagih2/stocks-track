import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Info, Upload } from 'lucide-react';
import { useDerived } from '@/hooks/data';
import { PageHead } from '@/components/PageHead';
import { Alert, Button, Card, Kpi, Pill, Sheet, TableWrap, th, td, Empty } from '@/components/ui';
import { OrderPill, StockByState, ErrorBox } from '@/components/shared';
import { Spinner } from '@/components/Spinner';
import { OrderSheet, UploadSheet, CancelSheet } from '@/components/OrderSheets';
import { dayLabel, timeCairo } from '@/domain/dates';
import { channelName, LOC_AR } from '@/domain/constants';
import { fmt, pct } from '@/lib/cn';
import { skuLabel } from '@/domain/orders';
import { locTotal, qty } from '@/domain/ledger';
import { dailyUse, supplyBalance, supplyStatus } from '@/domain/supplies';
import { cellInfo } from '@/domain/stock';
import type { Derived } from '@/hooks/data';
import type { Order } from '@/domain/types';

type FlowKey = 'all' | 'done' | 'wait' | 'blocked';

function FlowSheet({ d, w, orders, onClose, onOrder }: { d: Derived; w: FlowKey; orders: Order[]; onClose: () => void; onOrder: (ref: string) => void }) {
  const nav = useNavigate();
  const open = orders.filter((o) => o.status === 'open');
  const list = { all: orders, done: orders.filter((o) => o.status === 'shipped'), wait: open.filter((o) => !d.blocked.has(o.ref)), blocked: open.filter((o) => d.blocked.has(o.ref)) }[w];
  const title = { all: 'المطلوب اليوم', done: 'المشحون اليوم', wait: 'لم يُشحن بعد', blocked: 'متوقف بسبب المخزون' }[w];
  const pcs = list.reduce((a, o) => a + o.lines.length, 0);
  const byVariant = (() => {
    const m: Record<string, { n: number; q: number }> = {};
    const src = w === 'blocked' ? list.flatMap((o) => (d.blocked.get(o.ref) ?? []).map((x) => ({ sku: x.sku, q: x.short }))) : w === 'wait' ? list.flatMap((o) => o.lines.map((s) => ({ sku: s, q: 1 }))) : [];
    for (const x of src) { const e = (m[x.sku] ??= { n: 0, q: 0 }); e.n++; e.q += x.q; }
    return Object.entries(m).sort((a, b) => b[1].n - a[1].n).slice(0, 30);
  })();
  const team = (() => { const m: Record<string, { o: number; p: number; a: string; b: string }> = {}; for (const o of list) if (o.status === 'shipped' && o.shippedBy) { const e = (m[o.shippedBy] ??= { o: 0, p: 0, a: o.shippedAt!, b: o.shippedAt! }); e.o++; e.p += o.lines.length; if (o.shippedAt! < e.a) e.a = o.shippedAt!; if (o.shippedAt! > e.b) e.b = o.shippedAt!; } return Object.entries(m).sort((a, b) => b[1].o - a[1].o); })();
  return (
    <Sheet title={`${title} (${list.length} أوردر · ${fmt(pcs)} قطعة)`} onClose={onClose}>
      {!list.length ? <Empty>لا توجد أوردرات هنا.</Empty> : (
        <>
          {w === 'blocked' && <Alert>يتوقف الأوردر إذا نقصت أي قطعة منه، لأنه يُشحن كاملًا. الناقص محسوب على الجاهز حاليًا وموزّع على الأوردرات بالترتيب.</Alert>}
          {w === 'wait' && <Alert>أوردرات مطلوبة ويتوفر لها رصيد، لكنها لم تُشحن بعد. لم يُخصم الرصيد بعد.</Alert>}
          {byVariant.length > 0 && (
            <TableWrap><table className="text-sm"><thead><tr><th className={th}>الصنف</th><th className={th}>جاهز</th><th className={th}>{w === 'blocked' ? 'ناقص' : 'مطلوب'}</th><th className={th}>أوردرات</th></tr></thead>
              <tbody>{byVariant.map(([s, e]) => <tr key={s}><td className={td}>{skuLabel(d.skuMap, s)}</td><td className={td + ' font-mono'}>{fmt(qty(d.snap.balances, s, 'READY'))}</td><td className={td}>{w === 'blocked' ? <Pill tone="crit">{e.q}</Pill> : <span className="font-mono">{e.q}</span>}</td><td className={td + ' font-mono'}>{e.n}</td></tr>)}</tbody></table></TableWrap>
          )}
          {w === 'done' && (
            <TableWrap><table className="text-sm"><thead><tr><th className={th}>الموظف</th><th className={th}>أوردرات</th><th className={th}>قطع</th><th className={th}>من - إلى</th></tr></thead>
              <tbody>{team.map(([k, e]) => <tr key={k}><td className={td}>{k}</td><td className={td + ' font-mono'}>{e.o}</td><td className={td + ' font-mono'}>{e.p}</td><td className={td + ' font-mono'}>{timeCairo(e.a)} - {timeCairo(e.b)}</td></tr>)}</tbody></table></TableWrap>
          )}
          <TableWrap><table className="text-sm"><thead><tr><th className={th}>الكود</th><th className={th}>قطع</th><th className={th}>الحالة</th></tr></thead>
            <tbody>{list.slice(0, 80).map((o) => <tr key={o.ref} className="cursor-pointer hover:bg-lav" onClick={() => onOrder(o.ref)}><td className={td + ' font-mono'}>{o.ref}</td><td className={td + ' font-mono'}>{o.lines.length}</td><td className={td}><OrderPill o={o} d={d} /></td></tr>)}</tbody></table></TableWrap>
          <Button onClick={() => { onClose(); nav('/orders'); }}>عرضها في صفحة الأوردرات</Button>
        </>
      )}
    </Sheet>
  );
}

export default function Today() {
  const { d, isLoading, error } = useDerived();
  const nav = useNavigate();
  const [flow, setFlow] = useState<FlowKey | null>(null);
  const [upload, setUpload] = useState<'scan' | 'pickup' | null>(null);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [cancel, setCancel] = useState<string | null>(null);

  const x = useMemo(() => {
    if (!d) return null;
    const ids = new Set(d.snap.pickups.filter((p) => p.date === d.today).map((p) => p.id));
    const orders = d.snap.orders.filter((o) => ids.has(o.pickupId) && o.status !== 'cancelled');
    const done = orders.filter((o) => o.status === 'shipped'); const open = orders.filter((o) => o.status === 'open');
    const blk = open.filter((o) => d.blocked.has(o.ref)); const wait = open.filter((o) => !d.blocked.has(o.ref));
    const pcs = (a: Order[]) => a.reduce((s, o) => s + o.lines.length, 0);
    const older = d.open.filter((o) => (d.pickupDate.get(o.pickupId) ?? d.today) < d.today);
    const oldDay = older.map((o) => d.pickupDate.get(o.pickupId)!).sort()[0];
    const neg = d.snap.skus.filter((s) => qty(d.snap.balances, s.id, 'READY') < 0);
    const low = d.snap.skus.filter((s) => {
      const c = cellInfo(s, d.snap.balances, d.demand, d.velocity, d.velocityOK, 14);
      return c.level === 'warn' && (d.velocityOK || (d.pull[s.model] ?? 0) > 0 || c.demand > 0);
    });
    const supLow = d.snap.supplies.filter((s) => !s.archived && supplyStatus(s, supplyBalance(d.snap.supplyLog, s.id), dailyUse(d.snap.supplyLog, s.id, d.today)) !== 'good');
    const team: Record<string, { o: number; p: number; a: string; b: string }> = {};
    for (const o of done) if (o.shippedBy) { const e = (team[o.shippedBy] ??= { o: 0, p: 0, a: o.shippedAt!, b: o.shippedAt! }); e.o++; e.p += o.lines.length; if (o.shippedAt! < e.a) e.a = o.shippedAt!; if (o.shippedAt! > e.b) e.b = o.shippedAt!; }
    return { ids, orders, done, open, blk, wait, pcs, older, oldDay, neg, low, supLow, team, pickups: d.snap.pickups.filter((p) => p.date === d.today) };
  }, [d]);

  if (error) return <ErrorBox error={error} />;
  if (isLoading || !d || !x) return <Spinner />;

  const actions: { tone: 'crit' | 'warn' | 'info'; title: string; desc: string; go: () => void; btn: string }[] = [];
  if (x.neg.length) actions.push({ tone: 'crit', title: `رصيد سالب في ${x.neg.length} صنف`, desc: 'تم شحن كمية أكبر من الرصيد. أجرِ جردًا لهذه الأصناف وصحّح الرصيد.', go: () => nav('/stock'), btn: 'فتح المخزون' });
  if (d.blocked.size) actions.push({ tone: 'crit', title: `${d.blocked.size} أوردر متوقف بسبب الرصيد`, desc: 'نقص قطعة واحدة في الأوردر يوقفه بالكامل. راجع الأصناف الأكثر تسببًا في التوقف.', go: () => nav('/orders?f=blocked'), btn: 'عرض الأوردرات' });
  const waiting = d.open.length - d.blocked.size;
  if (waiting > 0) actions.push({ tone: 'warn', title: `${waiting} أوردر لم يُشحن بعد`, desc: 'وردت في البيك أب وتنتظر التسجيل بالسكان. لم يُخصم الرصيد بعد.', go: () => nav('/orders?f=wait'), btn: 'عرض الأوردرات المنتظرة' });
  if (x.low.length) actions.push({ tone: 'warn', title: `${x.low.length} صنف على وشك النفاد`, desc: d.velocityOK ? 'أقل من تغطية 14 يومًا' : 'أقل من الحد الأدنى المسجّل (لا يتوفر تاريخ كافٍ بعد).', go: () => nav('/insights'), btn: 'اقتراح التصنيع' });
  const dirty = locTotal(d.snap.balances, 'DIRTY'); if (dirty > 0) actions.push({ tone: 'info', title: `${fmt(dirty)} قطعة ${LOC_AR.DIRTY}`, desc: 'أرسلها إلى المصنع للغسيل المجاني.', go: () => nav('/operations'), btn: 'العمليات' });
  const lost = locTotal(d.snap.balances, 'LOST'); if (lost > 0) actions.push({ tone: 'warn', title: `${fmt(lost)} قطعة مفقودة بانتظار التسوية`, desc: 'هل تم العثور عليها أم يُشطب الرصيد؟', go: () => nav('/operations'), btn: 'العمليات' });
  if (x.supLow.length) actions.push({ tone: 'warn', title: `مستلزمات على وشك النفاد: ${x.supLow.map((s) => s.name).join('، ')}`, desc: 'محسوب من آخر 7 أيام شحن وحد التنبيه.', go: () => nav('/supplies'), btn: 'المستلزمات' });

  const total = x.orders.length;
  const w = (n: number) => (total ? `${(n / total) * 100}%` : '0%');
  const team = Object.entries(x.team).sort((a, b) => b[1].o - a[1].o);
  return (
    <>
      <PageHead title="اليوم" sub="الطلب الوارد من القنوات، وما تم شحنه فعلًا، وما هو متوقف.">
        <Pill tone="good">اليوم · {dayLabel(d.today)}</Pill>
        <Button onClick={() => setUpload('pickup')}><Upload className="size-4" /> رفع بيك أب</Button>
        <Button variant="primary" onClick={() => setUpload('scan')}><Upload className="size-4" /> رفع ملف السكان</Button>
      </PageHead>
      <div className="grid gap-4">
        {x.older.length > 0 && (
          <Alert tone="warn" className="flex flex-wrap items-center justify-between gap-2">
            <span>يوجد <b>{x.older.length}</b> أوردر من أيام سابقة (من {x.oldDay}) لم تُشحن بعد.</span>
            <Button size="sm" onClick={() => nav('/orders?f=wait')}>عرضها في الأوردرات</Button>
          </Alert>
        )}
        <Card title="تدفق اليوم" hint="البيك أب هو الطلب. الخصم من المخزون يتم عند الشحن بالسكان فقط.">
          {!total ? <Empty>لا يوجد بيك أب اليوم. ارفع ملف البيك أب.</Empty> : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Kpi label="المطلوب (بيك أب)" value={fmt(total)} sub={`${fmt(x.pcs(x.orders))} قطعة`} onClick={() => setFlow('all')} />
                <Kpi label="تم الشحن (خرج فعلًا)" value={fmt(x.done.length)} sub={`${fmt(x.pcs(x.done))} قطعة · ${pct(x.done.length, total)}%`} tone="good" onClick={x.done.length ? () => setFlow('done') : undefined} />
                <Kpi label="لم يُشحن بعد" value={fmt(x.wait.length)} sub={`${fmt(x.pcs(x.wait))} قطعة`} tone={x.wait.length ? 'warn' : undefined} onClick={x.wait.length ? () => setFlow('wait') : undefined} />
                <Kpi label="متوقف بسبب المخزون" value={fmt(x.blk.length)} sub={`${fmt(x.pcs(x.blk))} قطعة`} tone={x.blk.length ? 'crit' : undefined} onClick={x.blk.length ? () => setFlow('blocked') : undefined} />
              </div>
              <div className="flex h-4 gap-0.5 overflow-hidden rounded-full bg-grid" role="img" aria-label={`تم شحن ${x.done.length} من ${total}`}>
                <i className="bg-ready" style={{ width: w(x.done.length) }} /><i className="bg-line2" style={{ width: w(x.wait.length) }} /><i className="bg-scrap" style={{ width: w(x.blk.length) }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted"><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-ready" />مشحون</span><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-line2" />بانتظار الشحن</span><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-scrap" />متوقف بسبب المخزون</span></div>
              <div className="mt-3 grid gap-1">{x.pickups.map((p) => { const po = x.orders.filter((o) => o.pickupId === p.id); return <div key={p.id} className="flex justify-between rounded-lg px-2 py-1.5 hover:bg-lav"><span><b>{p.label}</b> <span className="text-muted">· {channelName(p.channel)}</span></span><span><span className="num">{po.filter((o) => o.status === 'shipped').length}</span> من <span className="num">{po.length}</span> مشحون</span></div>; })}</div>
            </>
          )}
        </Card>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card title="يتطلب إجراء" hint={actions.length ? `${actions.length} عنصر` : ''}>
            {!actions.length ? <Alert tone="good">لا توجد عناصر تتطلب إجراءً حاليًا.</Alert> : (
              <div className="grid gap-2">{actions.map((a, i) => (
                <div key={i} className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border p-3 ${a.tone === 'crit' ? 'border-crit-line bg-crit-bg text-crit' : a.tone === 'warn' ? 'border-warn-line bg-warn-bg text-warn' : 'border-line bg-surface text-ink'}`}>
                  <span className={`grid size-9 place-items-center rounded-xl ${a.tone === 'info' ? 'bg-info text-white' : a.tone === 'crit' ? 'bg-crit text-white dark:text-page' : 'bg-warn text-white dark:text-page'}`}>{a.tone === 'info' ? <Info className="size-4" /> : <AlertTriangle className="size-4" />}</span>
                  <div><b className="block">{a.title}</b><span className="text-[13px] opacity-85">{a.desc}</span></div>
                  <Button size="sm" onClick={a.go}>{a.btn}</Button>
                </div>))}</div>
            )}
          </Card>
          <div className="grid content-start gap-4">
            <Card title="المخزون حسب الحالة"><StockByState d={d} /></Card>
            <Card title="فريق اليوم">
              {!team.length ? <Empty>لم يُسجَّل أي شحن اليوم بعد.</Empty> : (
                <TableWrap><table className="text-sm"><thead><tr><th className={th}>الموظف</th><th className={th}>أوردرات</th><th className={th}>قطع</th><th className={th}>من - إلى</th></tr></thead>
                  <tbody>{team.map(([k, e]) => <tr key={k}><td className={td}>{k}</td><td className={td + ' font-mono'}>{e.o}</td><td className={td + ' font-mono'}>{e.p}</td><td className={td + ' font-mono'}>{timeCairo(e.a)} - {timeCairo(e.b)}</td></tr>)}</tbody></table></TableWrap>
              )}
              {team.length > 0 && <p className="mt-2 text-xs text-muted">الوقت هو وقت تسجيل الملف وليس وقت التغليف.</p>}
            </Card>
          </div>
        </div>
      </div>
      {flow && <FlowSheet d={d} w={flow} orders={x.orders} onClose={() => setFlow(null)} onOrder={(r) => { setFlow(null); setOrderRef(r); }} />}
      {upload && <UploadSheet d={d} mode={upload} onClose={() => setUpload(null)} />}
      {orderRef && <OrderSheet d={d} orderRef={orderRef} onClose={() => setOrderRef(null)} onCancel={(c) => { setOrderRef(null); setCancel(c); }} />}
      {cancel !== null && <CancelSheet d={d} initial={cancel} onClose={() => setCancel(null)} />}
    </>
  );
}
