import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Download, Trash2, Upload } from 'lucide-react';
import type { Derived } from '@/femini/hooks/data';
import { useAct } from '@/femini/hooks/data';
import { isAdmin, repo } from '@/femini/data';
import { parseSettlement, previewSettlement, type Settlement } from '@/femini/domain/settle';
import { cairoDay } from '@/femini/domain/dates';
import { downloadBlob } from '@/femini/data/backup';
import { cn, fmt } from '@/femini/cn';
import { Alert, Button, Card, Empty, Field, Kpi, Pill, Seg, Sheet, TableWrap, th, td } from './ui';
import { C, StackedBars, TrendArea } from './charts';
import { closedBySheet, collectByDay, collectTrend, type CollectMetric } from '@/femini/domain/trends';
import { change } from '@/femini/insights-tools';
import { OrdersDetail } from './DetailSheets';
import type { Order } from '@/femini/domain/types';

const money = (n: number) => fmt(n);   // amounts in EGP (the labels say so)

/** Upload the channel's settlement sheet: read it, show what it adds, then save. */
export function SettleUpload({ d, onClose }: { d: Derived; onClose: () => void }) {
  const act = useAct();
  const [file, setFile] = useState<File | null>(null); const [err, setErr] = useState('');
  const [parsed, setParsed] = useState<ReturnType<typeof parseSettlement> | null>(null);
  const read = async (f: File) => {
    setFile(f); setErr(''); setParsed(null);
    try {
      const X = await import('xlsx'); const wb = X.read(await f.arrayBuffer(), { type: 'array', cellDates: false });
      const aoa = X.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
      setParsed(parseSettlement(aoa, f.name));
    } catch (e) { setErr((e as Error).message); }
  };
  const pv = useMemo(() => (parsed ? previewSettlement(parsed, d.snap.orders, new Set<string>(), d.snap.settles ?? []) : null), [parsed, d]);
  return (
    <Sheet title="رفع شيت التحصيل (التسوية)" onClose={onClose} wide>
      <p className="text-sm text-muted">الشيت اللي بيوصل من شركة الشحن: كل أوردر اتحصّل (العميل دفع) أو رجع. "مشحون" يعني خرج بالإسكان، و"تم التحصيل" يعني فلوسه وصلت، ودي بتيجي من الشيت ده.</p>
      <Field label="ملف التسوية (Excel)"><input type="file" accept=".xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); }} /></Field>
      {err && <Alert tone="crit">{err}</Alert>}
      {parsed && pv && <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Kpi label="تاريخ التسوية" value={<span className="text-lg">{parsed.date}</span>} sub={parsed.title} />
          <Kpi label="إجمالي الأوردرات" value={pv.rows} sub="في الشيت" />
          <Kpi label="التوريد (جنيه)" value={money(parsed.totals.due)} tone="good" />
        </div>
        <TableWrap><table className="text-sm"><thead><tr><th className={th}>الأوردرات</th><th className={th}>العدد</th></tr></thead><tbody>
          <tr><td className={td}><b>إجمالي الأوردرات</b></td><td className={td + ' font-mono font-semibold'}>{pv.rows}</td></tr>
          <tr><td className={td}>اتحصّل (اتسلّم واتدفع)</td><td className={td + ' font-mono'}>{pv.collect}</td></tr>
          <tr><td className={td}>رجع (رفض الاستلام)</td><td className={td + ' font-mono'}>{pv.ret}</td></tr>
          <tr><td className={td}>تسليم جزئي / استبدال</td><td className={td + ' font-mono'}>{pv.partial}</td></tr>
          {pv.adjust > 0 && <tr><td className={td}>تعديل (فرق تحصيل)</td><td className={td + ' font-mono'}>{pv.adjust}</td></tr>}
          <tr><td className={td}>منهم في السيستم</td><td className={td + ' font-mono'}>{pv.inSystem}</td></tr>
          <tr><td className={td}>منهم مش في السيستم</td><td className={td + ' font-mono'}>{pv.unknown.length}</td></tr>
        </tbody></table></TableWrap>
        {parsed.dateNote && <Alert tone="warn">{parsed.dateNote}</Alert>}
        {pv.allDup && <Alert tone="crit">الشيت ده اترفع قبل كده؛ مش هيتسجل تاني.</Alert>}
        {!pv.allDup && pv.dup > 0 && <Alert tone="warn">{pv.dup} سطر متسجّل قبل كده في شيت تاني.</Alert>}
        {pv.notShipped.length > 0 && <Alert tone="warn">{pv.notShipped.length} أوردر اتحصّل في الشيت ومش متسجّل شحنه عندك: <span className="font-mono">{pv.notShipped.map((r) => r.ref).join('، ')}</span>. راجع الإسكان بتاعهم.</Alert>}
        {pv.unknown.length > 0 && <Alert>{pv.unknown.length} أوردر مش في السيستم (غالبًا من قبل ما السيستم يبدأ)، بيتسجلوا في التسوية بس: <span className="font-mono">{pv.unknown.map((r) => r.ref).join('، ')}</span></Alert>}
        <div><Button variant="primary" disabled={pv.allDup} onClick={async () => { const r = await act(() => repo.importSettlement({ settle: parsed, source: file?.name ?? 'settlement.xlsx', file }), (x) => `اتسجلت ${x.id}: ${x.collected} أوردر اتحصّل`); if (r) onClose(); }}><Upload className="size-4" />تسجيل التسوية</Button></div>
      </>}
    </Sheet>
  );
}

/** Analytics › collections: what the settlements brought in, and what was shipped but not collected yet. */
export function CollectionsView({ d, from, to }: { d: Derived; from: string; to: string }) {
  const act = useAct(); const admin = isAdmin();
  const [up, setUp] = useState(false); const [del, setDel] = useState<string | null>(null); const [card, setCard] = useState<'due' | 'paid' | 'wait' | null>(null);
  const settles = (d.snap.settles ?? []).slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const inRange = settles.filter((s) => s.date >= from && s.date <= to);
  const sum = (list: Settlement[], k: keyof Settlement['totals']) => list.reduce((a, s) => a + s.totals[k], 0);
  const shipped = d.snap.orders.filter((o) => o.status === 'shipped' && !o.returned);
  const paid = shipped.filter((o) => d.collected.has(o.ref));
  const waiting = shipped.filter((o) => !d.collected.has(o.ref) && !d.settleReturned.has(o.ref))
    .map((o) => ({ o, day: o.shippedAt ? cairoDay(o.shippedAt) : '' })).sort((a, b) => a.day.localeCompare(b.day));
  const age = (day: string) => (day ? Math.max(0, Math.round((Date.parse(d.today) - Date.parse(day)) / 864e5)) : 0);
  const fileOf = (id: string) => d.snap.files.filter((f) => f.owner === id).at(-1);
  const download = (id: string) => act(async () => {
    const f = fileOf(id); const url = f ? await repo.photoUrl(f.path) : null; if (!f || !url) throw new Error('ملف التسوية مش محفوظ.');
    const r = await fetch(url.replace(/[?&]thumb=1$/, ''), { credentials: 'same-origin' }); if (!r.ok) throw new Error('مقدرتش أنزّل الملف.');
    downloadBlob(await r.blob(), f.name); return true;
  }, 'تم تجهيز الملف');
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">"مشحون" = خرج بالإسكان. "تم التحصيل" = فلوسه وصلت حسب شيت التسوية.</p>
        <Button variant="primary" onClick={() => setUp(true)}><Upload className="size-4" />رفع شيت التحصيل</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi label="التوريد في الفترة (جنيه)" onClick={() => setCard('due')} value={money(sum(inRange, 'due'))} sub={`${inRange.length} تسوية · الكل ${money(sum(settles, 'due'))}`} tone="good" />
        <Kpi label="أوردرات اتحصّلت" onClick={() => setCard('paid')} value={fmt(paid.length)} sub={`من ${fmt(shipped.length)} مشحون`} tone="good" />
        <Kpi label="مشحون ولسه ما اتحصّلش" onClick={() => setCard('wait')} value={fmt(waiting.length)} sub={`${fmt(waiting.reduce((a, x) => a + x.o.lines.length, 0))} قطعة`} tone={waiting.length ? 'warn' : undefined} />
      </div>
      <CollectTrend d={d} from={from} to={to} />
      <Card title="شيتات التسوية" hint={`${settles.length} شيت`}>
        {!settles.length ? <Empty>لسه ما اترفعش شيت تسوية.</Empty> : (
          <TableWrap><table className="text-sm"><thead><tr>{['التاريخ', 'الرقم', 'الأوردرات', 'اتحصّل', 'رجع', 'جزئي / استبدال', 'التوريد', 'رفعه', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{settles.map((s) => (
              <tr key={s.id}>
                <td className={td + ' font-mono'} title={s.source}>{s.date}</td><td className={td + ' font-mono'}>{s.id}</td><td className={td + ' font-mono'}>{s.rows.length}</td>
                <td className={td + ' font-mono'}>{s.rows.filter((r) => r.type === 'collect').length}</td><td className={td + ' font-mono'}>{s.rows.filter((r) => r.type === 'return').length}</td><td className={td + ' font-mono'}>{s.rows.filter((r) => r.type === 'partial').length}</td>
                <td className={td + ' font-mono font-semibold'}>{fmt(s.totals.due)}</td><td className={td}>{s.by}</td>
                <td className={td}><div className="flex gap-1">
                  {fileOf(s.id) && <Button size="sm" onClick={() => download(s.id)} aria-label={`تنزيل ${s.id}`}><Download className="size-4" /></Button>}
                  {admin && (del === s.id
                    ? <><Button size="sm" variant="danger" onClick={() => act(() => repo.deleteSettlement(s.id).then(() => true), `اتشالت ${s.id}`)}>تأكيد الحذف</Button><Button size="sm" onClick={() => setDel(null)}>لأ</Button></>
                    : <Button size="sm" variant="ghost" aria-label={`حذف ${s.id}`} onClick={() => setDel(s.id)}><Trash2 className="size-4" /></Button>)}
                </div></td>
              </tr>))}</tbody></table></TableWrap>
        )}
      </Card>
      <Card title="مشحون ولسه ما اتحصّلش" hint="الأقدم الأول">
        {!waiting.length ? <Empty>كل المشحون اتحصّل.</Empty> : (
          <TableWrap><table className="text-sm"><thead><tr>{['البوليصة', 'رقم الأوردر', 'تاريخ البيك أب', 'اتشحن', 'من كام يوم', 'قطع'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{waiting.slice(0, 100).map(({ o, day }) => (
              <tr key={o.ref}><td className={td + ' font-mono'}>{o.ref}</td><td className={td + ' font-mono text-muted'}>{o.waybill}</td><td className={td + ' font-mono text-muted'}>{d.pickupDate.get(o.pickupId) ?? '—'}</td><td className={td + ' font-mono'}>{day}</td>
                <td className={td + ' font-mono'}>{age(day)}</td><td className={td + ' font-mono'}>{o.lines.length}</td></tr>))}</tbody></table></TableWrap>
        )}
        {waiting.length > 100 && <p className="mt-2 text-xs text-muted">أول 100 من {fmt(waiting.length)}.</p>}
      </Card>
      {card && (() => {
        const collected = (o: Order) => d.collected.get(o.ref);
        const cols = [{ head: 'تاريخ التحصيل', cell: (o: Order) => <span className="num">{collected(o)?.date ?? '—'}</span> }, { head: 'التوريد', cell: (o: Order) => <b className="num">{money(collected(o)?.due ?? 0)}</b> }, { head: 'التسوية', cell: (o: Order) => <span className="num text-muted">{collected(o)?.stl ?? '—'}</span> }];
        if (card === 'wait') return <OrdersDetail d={d} title="مشحون ولسه ما اتحصّلش" hint="الأقدم الأول." orders={waiting.map((x) => x.o)} onClose={() => setCard(null)}
          cols={[{ head: 'اتشحن من', cell: (o) => { const w = waiting.find((x) => x.o.ref === o.ref); return <span className="num">{w ? age(w.day) : 0} يوم</span>; } }]} />;
        if (card === 'paid') return <OrdersDetail d={d} title="أوردرات اتحصّلت" hint="كل اللي فلوسه وصلت حسب شيتات التسوية." orders={paid.slice().sort((a, b) => (collected(b)?.date ?? '').localeCompare(collected(a)?.date ?? ''))} cols={cols} onClose={() => setCard(null)} />;
        const inPeriod = d.snap.orders.filter((o) => { const c = collected(o); return !!c && c.date >= from && c.date <= to; }).sort((a, b) => (collected(b)?.date ?? '').localeCompare(collected(a)?.date ?? ''));
        const listed = inPeriod.reduce((a, o) => a + (collected(o)?.due ?? 0), 0); const all = sum(inRange, 'due');
        return <OrdersDetail d={d} title="التوريد في الفترة" hint={`الأوردرات اللي اتحصّلت من ${from} لـ ${to}، بتاريخ تحصيلها: ${money(listed)} من ${money(all)} جنيه${Math.round(listed) !== Math.round(all) ? '. الباقي من أوردرات مش في السيستم أو تسويات ما اتربطتش بأوردر.' : '.'}`} orders={inPeriod} cols={cols} onClose={() => setCard(null)} />;
      })()}
      {up && <SettleUpload d={d} onClose={() => setUp(false)} />}
    </div>
  );
}

/** Collections over the chosen period: orders that left vs got paid vs came back, and Fémini's due per settlement day
 * (the only amount shown: the sheet's «المبلغ المستحق Femini»). */
function CollectTrend({ d, from, to }: { d: Derived; from: string; to: string }) {
  const rows = useMemo(() => {
    // the average of the days a settlement came on (days with no settlement would pull it down)
    const r = collectByDay(d.snap, from, to); const paid = r.filter((x) => x.due > 0);
    const avg = Math.round(paid.reduce((a, x) => a + x.due, 0) / Math.max(1, paid.length));
    return r.map((x) => ({ ...x, avg }));
  }, [d, from, to]);
  const [pick, setPick] = useState<string | null>(null);
  if (!(d.snap.settles ?? []).length) return null;
  return <div className="grid gap-4 lg:grid-cols-2">
    {pick && <ClosedDaySheet d={d} day={pick} onClose={() => setPick(null)} />}
    <Card title="المحصّل والراجع" hint="كل عمود = الأوردرات اللي اتقفلت في اليوم ده بتاريخ الشيت: اتحصّل · رجع · اضغط على يوم لتفاصيله">
      {/* stacked: the two parts are orders closing on that day. What was shipped is a number in the readout, not a
          line over the bars (it counts other orders, by ship day, and drawn on top it read as part of the same bar) */}
      <StackedBars data={rows} totalName="اتقفل" onPick={setPick} series={[{ key: 'collected', name: 'اتحصّل', color: C.ready }, { key: 'returned', name: 'رجع', color: C.scrap }]} also={[{ key: 'shipped', name: 'اتشحن', color: C.accent }]} />
    </Card>
    <CollectFlow d={d} />
  </div>;
}

/** The orders that closed on one day by the sheets (the same orders the graph counts for that day), collected first. */
function ClosedDaySheet({ d, day, onClose }: { d: Derived; day: string; onClose: () => void }) {
  const closed = useMemo(() => closedBySheet(d.snap.settles ?? []), [d]);
  const refs = [...closed].filter(([, c]) => c.day === day);
  const kind = new Map(refs.map(([r, c]) => [r, c.kind]));
  const orders = d.snap.orders.filter((o) => kind.has(o.ref)).sort((a, b) => (kind.get(a.ref) === kind.get(b.ref) ? a.ref.localeCompare(b.ref) : kind.get(a.ref) === 'collected' ? -1 : 1));
  const nCol = refs.filter(([, c]) => c.kind === 'collected').length; const nRet = refs.length - nCol;
  const due = orders.reduce((a, o) => a + (kind.get(o.ref) === 'collected' ? d.collected.get(o.ref)?.due ?? 0 : 0), 0);
  const missing = refs.length - orders.length;
  return <OrdersDetail d={d} title={`اتقفل يوم ${day}`} onClose={onClose} orders={orders}
    hint={`${fmt(nCol)} اتحصّل (التوريد ${money(due)} جنيه) · ${fmt(nRet)} رجع${missing ? ` · ${fmt(missing)} أوردر في الشيت مش في السيستم` : ''}.`}
    chips={[{ id: 'collected', label: 'اتحصّل', test: (o) => kind.get(o.ref) === 'collected' }, { id: 'returned', label: 'رجع', test: (o) => kind.get(o.ref) === 'returned' }]}
    cols={[{ head: 'الحالة', cell: (o) => kind.get(o.ref) === 'collected' ? <Pill tone="good">اتحصّل</Pill> : <Pill tone="crit">رجع</Pill> },
      { head: 'التوريد', cell: (o) => kind.get(o.ref) === 'collected' ? <b className="num">{money(d.collected.get(o.ref)?.due ?? 0)}</b> : <span className="text-muted">—</span> },
      { head: 'اتشحن', cell: (o) => <span className="num">{o.shippedAt ? cairoDay(o.shippedAt) : '—'}</span> }]} />;
}

const DAYS: [string, string][] = [['7', '7 يوم'], ['14', '14 يوم'], ['30', '30 يوم']];

/** «حركة التحصيل»: the last 7 / 14 / 30 days up to today, with how it moved against the same number of days before. */
function CollectFlow({ d }: { d: Derived }) {
  const [days, setDays] = useState('14'); const [metric, setMetric] = useState<CollectMetric>('due');
  const n = Number(days); const money = metric === 'due';
  const t = useMemo(() => collectTrend(d.snap, d.today, n, metric), [d, n, metric]);
  const pct = change(t.cur, t.prev);
  return (
    <Card title="حركة التحصيل" hint={money ? 'جنيه · التوريد بتاريخ التسوية' : 'أوردرات · بتاريخ التحصيل في الشيت'}
      action={<span className="flex flex-wrap items-center gap-2 print:hidden">
        <Seg<CollectMetric> label="المقياس" value={metric} onChange={setMetric} options={[['due', 'جنيه'], ['collected', 'أوردرات']]} />
        <Seg<string> label="الفترة" value={days} onChange={setDays} options={DAYS} />
      </span>}>
      <p className="mb-1 flex flex-wrap items-center gap-x-2 text-sm" aria-live="polite">
        {pct === null
          ? <span className="text-muted">{t.cur ? 'مفيش تحصيل في الفترة اللي قبلها للمقارنة' : 'مفيش تحصيل في الفترة دي'}</span>
          : <>{pct === 0
              ? <span className="font-semibold text-muted">تقريبًا زي</span>
              : <span className={cn('inline-flex items-center gap-1 font-semibold', pct > 0 ? 'text-good' : 'text-crit')}>{pct > 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}<span className="num">{Math.abs(pct)}%</span>{pct > 0 ? 'طلع' : 'نزل'} عن</span>}
            <span className="text-muted">الـ {n} يوم اللي قبلهم (<span className="num">{fmt(t.prev)}</span>{money ? ' جنيه' : ' أوردر'})</span></>}
      </p>
      <TrendArea money={money} height={240} data={t.rows} series={[{ key: metric, name: money ? 'التوريد' : 'اتحصّل', color: money ? C.femini : C.ready }, { key: 'avg', name: 'متوسط يوم التحصيل', color: C.muted, dash: true, total: 'last' }]} />
    </Card>
  );
}
