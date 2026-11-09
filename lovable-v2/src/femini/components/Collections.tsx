import { useMemo, useState } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import type { Derived } from '@/femini/hooks/data';
import { useAct } from '@/femini/hooks/data';
import { isAdmin, repo } from '@/femini/data';
import { parseSettlement, previewSettlement, type Settlement } from '@/femini/domain/settle';
import { cairoDay } from '@/femini/domain/dates';
import { downloadBlob } from '@/femini/data/backup';
import { fmt } from '@/femini/cn';
import { Alert, Button, Card, Empty, Field, Kpi, Sheet, TableWrap, th, td } from './ui';
import { C, TrendArea } from './charts';
import { collectByDay } from '@/femini/domain/trends';

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
      <p className="text-sm text-muted">الشيت اللي بيوصل من شركة الشحن: كل أوردر اتحصّل (العميل دفع) أو رجع. "مشحون" يعني خرج بالسكان، و"تم التحصيل" يعني فلوسه وصلت، ودي بتيجي من الشيت ده.</p>
      <Field label="ملف التسوية (Excel)"><input type="file" accept=".xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); }} /></Field>
      {err && <Alert tone="crit">{err}</Alert>}
      {parsed && pv && <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Kpi label="تاريخ التسوية" value={<span className="text-lg">{parsed.date}</span>} sub={parsed.title} />
          <Kpi label="إجمالي الأوردرات" value={pv.rows} sub="في الشيت" />
          <Kpi label="مستحق فيميني (جنيه)" value={money(parsed.totals.due)} tone="good" />
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
        <TableWrap><table className="text-sm"><thead><tr><th className={th}>الفلوس</th><th className={th}>جنيه</th></tr></thead><tbody>
          <tr><td className={td}>إجمالي المبيعات (اللي دفعه العملاء)</td><td className={td + ' font-mono'}>{money(parsed.totals.sales)}</td></tr>
          <tr><td className={td}>مستحق شركة الشحن (مصاريف الشحن)</td><td className={td + ' font-mono'}>{money(parsed.totals.shipping)}</td></tr>
          <tr><td className={td}>الصافي بعد الشحن</td><td className={td + ' font-mono'}>{money(parsed.totals.cod)}</td></tr>
          <tr><td className={td}>مستحق فيندور</td><td className={td + ' font-mono'}>{money(parsed.totals.vendoor)}</td></tr>
          <tr><td className={td}><b>مستحق فيميني</b></td><td className={td + ' font-mono font-semibold'}>{money(parsed.totals.due)}</td></tr>
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
  const [up, setUp] = useState(false); const [del, setDel] = useState<string | null>(null);
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
        <p className="text-sm text-muted">"مشحون" = خرج بالسكان. "تم التحصيل" = فلوسه وصلت حسب شيت التسوية.</p>
        <Button variant="primary" onClick={() => setUp(true)}><Upload className="size-4" />رفع شيت التحصيل</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="مستحق فيميني في الفترة (جنيه)" value={money(sum(inRange, 'due'))} sub={`${inRange.length} تسوية · الكل ${money(sum(settles, 'due'))}`} tone="good" />
        <Kpi label="المبيعات في الفترة (جنيه)" value={money(sum(inRange, 'sales'))} sub={`شركة الشحن ${money(sum(inRange, 'shipping'))} · فيندور ${money(sum(inRange, 'vendoor'))}`} />
        <Kpi label="أوردرات اتحصّلت" value={fmt(paid.length)} sub={`من ${fmt(shipped.length)} مشحون`} tone="good" />
        <Kpi label="مشحون ولسه ما اتحصّلش" value={fmt(waiting.length)} sub={`متوقع ${money(waiting.reduce((a, x) => a + (x.o.total || 0), 0))} جنيه`} tone={waiting.length ? 'warn' : undefined} />
      </div>
      <CollectTrend d={d} from={from} to={to} />
      <Card title="شيتات التسوية" hint={`${settles.length} شيت`}>
        {!settles.length ? <Empty>لسه ما اترفعش شيت تسوية.</Empty> : (
          <TableWrap><table className="text-sm"><thead><tr>{['التاريخ', 'الرقم', 'الأوردرات', 'اتحصّل', 'رجع', 'جزئي / استبدال', 'المبيعات', 'شركة الشحن', 'فيندور', 'فيميني', 'رفعه', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{settles.map((s) => (
              <tr key={s.id}>
                <td className={td + ' font-mono'} title={s.source}>{s.date}</td><td className={td + ' font-mono'}>{s.id}</td><td className={td + ' font-mono'}>{s.rows.length}</td>
                <td className={td + ' font-mono'}>{s.rows.filter((r) => r.type === 'collect').length}</td><td className={td + ' font-mono'}>{s.rows.filter((r) => r.type === 'return').length}</td><td className={td + ' font-mono'}>{s.rows.filter((r) => r.type === 'partial').length}</td>
                <td className={td + ' font-mono'}>{fmt(s.totals.sales)}</td><td className={td + ' font-mono'}>{fmt(s.totals.shipping)}</td><td className={td + ' font-mono'}>{fmt(s.totals.vendoor)}</td><td className={td + ' font-mono font-semibold'}>{fmt(s.totals.due)}</td><td className={td}>{s.by}</td>
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
          <TableWrap><table className="text-sm"><thead><tr>{['البوليصة', 'رقم الأوردر', 'تاريخ البيك أب', 'اتشحن', 'من كام يوم', 'المبلغ', 'قطع'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{waiting.slice(0, 100).map(({ o, day }) => (
              <tr key={o.ref}><td className={td + ' font-mono'}>{o.ref}</td><td className={td + ' font-mono text-muted'}>{o.waybill}</td><td className={td + ' font-mono text-muted'}>{d.pickupDate.get(o.pickupId) ?? '—'}</td><td className={td + ' font-mono'}>{day}</td>
                <td className={td + ' font-mono'}>{age(day)}</td><td className={td + ' font-mono'}>{fmt(o.total || 0)}</td><td className={td + ' font-mono'}>{o.lines.length}</td></tr>))}</tbody></table></TableWrap>
        )}
        {waiting.length > 100 && <p className="mt-2 text-xs text-muted">أول 100 من {fmt(waiting.length)}.</p>}
      </Card>
      {up && <SettleUpload d={d} onClose={() => setUp(false)} />}
    </div>
  );
}

/** Collections over the chosen period: orders that left vs got paid vs came back, the money of each settlement day,
 * and Fémini's due adding up. */
function CollectTrend({ d, from, to }: { d: Derived; from: string; to: string }) {
  const rows = useMemo(() => collectByDay(d.snap, from, to), [d, from, to]);
  if (!(d.snap.settles ?? []).length) return null;
  return <div className="grid gap-4 lg:grid-cols-2">
    <Card title="المشحون والمحصّل" hint="أوردرات · المحصّل بتاريخ التحصيل في الشيت">
      <TrendArea bars data={rows} series={[{ key: 'shipped', name: 'اتشحن', color: C.accent }, { key: 'collected', name: 'اتحصّل', color: C.ready }, { key: 'returned', name: 'رجع', color: C.scrap }]} />
    </Card>
    <Card title="فلوس التسويات" hint="جنيه · بتاريخ التسوية">
      <TrendArea bars money data={rows} series={[{ key: 'due', name: 'مستحق فيميني', color: C.ready }, { key: 'vendoor', name: 'مستحق فيندور', color: C.accent }, { key: 'shipping', name: 'شركة الشحن', color: C.muted }]} />
    </Card>
    <Card title="مستحق فيميني المتراكم" hint="من أول تسوية لحد كل يوم" className="lg:col-span-2">
      <TrendArea money height={220} data={rows} series={[{ key: 'paidSoFar', name: 'إجمالي مستحق فيميني', color: C.ready, total: 'last' }]} />
    </Card>
  </div>;
}
