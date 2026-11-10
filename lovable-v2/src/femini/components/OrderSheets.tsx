import { dayClosed } from '@/femini/domain/reports';
import { useMemo, useRef, useState } from 'react';
import { Sheet, Button, Pill, Alert, Field, Kpi, TableWrap, th, td } from './ui';
import { OrderPill, Photo, PhotoInput } from './shared';
import { Thumb } from './Thumb';
import type { Derived } from '@/femini/hooks/data';
import { useAct } from '@/femini/hooks/data';
import { repo } from '@/femini/data';
import { findByCode, need, skuLabel } from '@/femini/domain/orders';
import { matchScans, parseCsv, parseScan, type ScanMatch, type ScanRow } from '@/femini/domain/scan';
import { parsePickupRows, resolveModel, type ParsedOrder } from '@/femini/domain/pickup';
import { qty } from '@/femini/domain/ledger';
import { BACKDATE_DAYS, CHANNELS, channelName } from '@/femini/domain/constants';
import { fmt } from '@/femini/cn';
import { addDays, cairoDay, timeCairo } from '@/femini/domain/dates';
import { useAccountName } from '@/femini/data/account';
import { Link, useNavigate } from '@/femini/router';
import { EditCatalogSheet, NewModelSheet } from './CatalogSheets';
import { EXACT_CODE, normalizeModelCode } from './catalog-validation';

export function OrderSheet({ d, orderRef, onClose, onCancel }: { d: Derived; orderRef: string; onClose: () => void; onCancel: (code: string) => void }) {
  const act = useAct();
  const o = d.orderMap.get(orderRef);
  if (!o) return null;
  const relink = () => act(() => repo.remapUnmapped(), (n) => (n ? `اتربط ${n} صنف بالكتالوج` : 'لسه مفيش صنف مطابق في الكتالوج'));
  const n = need(o); const pk = d.snap.pickups.find((p) => p.id === o.pickupId);
  return (
    <Sheet title={`بوليصة ${o.ref}`} onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2"><OrderPill o={o} d={d} /><span className="text-muted">{channelName(pk?.channel ?? '')} · {pk?.label} · بيك أب يوم <span className="font-mono">{pk?.date ?? '—'}</span></span></div>
      <div className="grid grid-cols-2 gap-3"><Kpi label="رقم الأوردر" value={<span className="text-lg">{o.waybill}</span>} /><Kpi label="المحافظة / النوع" value={<span className="font-sans text-lg">{o.gov} · {o.type === 'exchange' ? 'استبدال' : 'جديد'}</span>} /></div>
      <TableWrap>
        <table className="text-sm"><thead><tr><th className={th}>الصنف</th><th className={th}>في الأوردر</th><th className={th}>جاهز حاليًا</th></tr></thead>
          <tbody>{Object.keys(n).map((s) => { const r = qty(d.snap.balances, s, 'READY'); return (
            <tr key={s}><td className={td}><Thumb model={d.modelMap.get(d.skuMap.get(s)?.model ?? '')} size={36} className="me-1.5" />{skuLabel(d.skuMap, s)}</td><td className={td + ' font-mono'}>{n[s]}</td><td className={td}>{r < n[s] && o.status === 'open' ? <Pill tone="crit">{r}</Pill> : <span className="font-mono">{fmt(r)}</span>}</td></tr>); })}</tbody></table>
      </TableWrap>
      {o.unmapped.length > 0 && <Alert tone="warn">
        <b>أصناف مش متعرّفة، والأوردر مش هيتشحن غير لما تتربط:</b>
        {o.status === 'open' ? <LinkLines d={d} lines={o.unmapped} /> : <ul className="mt-1 list-disc ps-5 font-mono text-xs">{o.unmapped.map((u, i) => <li key={i}>{lineText(u)}</li>)}</ul>}
        <p className="mt-1 text-xs">الزرار بيفتح الكتالوج بالكود واللون والمقاس زي ما في البيك أب، وبعد الحفظ الأوردر بيتربط لوحده.</p>
        {o.status === 'open' && <Button size="sm" className="mt-2" onClick={relink}>اربط بالكتالوج</Button>}
      </Alert>}
      {o.status === 'shipped' && <Alert tone="good">شُحن بواسطة {o.shippedBy}{o.shippedAt ? ` الساعة ${timeCairo(o.shippedAt)}` : ''} · {o.shipDoc}</Alert>}
      {o.status === 'cancelled' && o.cancel && (
        <>
          <Alert tone="warn">أُلغي {cairoDay(o.cancel.at)} بواسطة {o.cancel.by}{o.cancel.reason ? ` · ${o.cancel.reason}` : ''}{o.cancel.returned ? ` · أُعيدت القطع إلى المخزون (${o.cancel.doc})` : o.cancel.was === 'shipped' ? ' · كان مشحونًا ولم تُعد القطع' : ''}</Alert>
          <Photo path={o.cancel.attachment} zoom className="max-h-[70vh] w-full rounded-xl border border-line object-contain" />
          <RestoreOrder code={o.ref} onDone={onClose} />
        </>
      )}
      {o.status !== 'cancelled' && <div><Button variant="danger" size="sm" onClick={() => onCancel(o.ref)}>{o.status === 'shipped' ? 'طلب إلغاء بعد الشحن' : 'إلغاء الأوردر (بصورة البوليصة)'}</Button></div>}
    </Sheet>
  );
}

/** Bringing a cancelled order back: asked twice, the second time by typing the word. */
function RestoreOrder({ code, onDone }: { code: string; onDone: () => void }) {
  const act = useAct(); const [step, setStep] = useState(0); const [word, setWord] = useState('');
  if (step === 0) return <div><Button variant="danger" onClick={() => setStep(1)}>استعادة الأوردر</Button></div>;
  return (
    <div className="grid gap-3 rounded-xl border border-warn-line bg-warn-bg p-3">
      {step === 1 ? <>
        <p className="text-sm"><b>متأكد إنك عايز ترجّع {code}؟</b> هيرجع للأوردرات بحالته قبل الإلغاء.</p>
        <div className="flex gap-2"><Button variant="danger" onClick={() => setStep(2)}>أيوه، كمّل</Button><Button onClick={() => setStep(0)}>لأ</Button></div>
      </> : <>
        <Field label="للتأكيد اكتب كلمة «استعادة»"><input value={word} onChange={(e) => setWord(e.target.value)} autoFocus autoComplete="off" /></Field>
        <div className="flex gap-2">
          <Button variant="danger" disabled={word.trim() !== 'استعادة'} onClick={async () => { const r = await act(() => repo.restoreOrder(code).then(() => true), 'تمت استعادة الأوردر'); if (r) onDone(); }}>استعادة {code}</Button>
          <Button onClick={() => { setStep(0); setWord(''); }}>إلغاء</Button>
        </div>
      </>}
    </div>
  );
}

export function CancelSheet({ d, initial, onClose }: { d: Derived; initial: string; onClose: () => void }) {
  const act = useAct();
  const [code, setCode] = useState(initial); const [reason, setReason] = useState(''); const [photo, setPhoto] = useState<File | null>(null); const [ret, setRet] = useState(true); const [busy, setBusy] = useState(false);
  const o = useMemo(() => findByCode(d.snap.orders, code), [d.snap.orders, code]);
  const can = !!o && o.status !== 'cancelled' && !!photo && !busy;
  return (
    <Sheet title="إلغاء أوردر" onClose={onClose}>
      <Alert>استخدم هذا الإجراء عند طلب إلغاء أوردر. سجّل كود البوليصة وأرفق صورتها مشطوبة، وسيُحذف الأوردر من قائمة الأوردرات ومن الطلب.</Alert>
      <Field label="البوليصة أو رقم الأوردر"><input dir="ltr" className="font-mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="mk3450 أو 23772996" autoComplete="off" /></Field>
      {!code.trim() ? <p className="text-muted">اكتب البوليصة (مثل mk3450) أو رقم الأوردر (مثل 23772996).</p>
        : !o ? <Alert tone="crit">مفيش أوردر بالبوليصة أو الرقم ده. اتأكد من المكتوب على الورقة.</Alert>
        : (
          <div className="grid gap-2 rounded-xl border border-line bg-lav p-3">
            <div className="flex items-center justify-between"><b className="font-mono">{o.ref}</b><OrderPill o={o} d={d} /></div>
            <span className="text-[13px] text-muted">أوردر {o.waybill} · {o.gov} · {o.lines.length} قطعة</span>
            {o.status === 'cancelled' && <Alert tone="warn">هذا الأوردر ملغى مسبقًا.</Alert>}
            {o.status === 'shipped' && <Alert tone="warn"><b>هذا الأوردر شُحن بالفعل</b> وخُصم من المخزون.<label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={ret} onChange={(e) => setRet(e.target.checked)} /> إعادة القطع ({o.lines.length}) إلى المخزون الجاهز</label></Alert>}
          </div>
        )}
      <PhotoInput file={photo} onChange={setPhoto} label="صورة البوليصة (المشطوبة)" />
      <Field label="السبب (اختياري)"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: ألغى العميل الطلب من فيندور" /></Field>
      <Button variant="danger" disabled={!can} onClick={async () => { setBusy(true); const r = await act(() => repo.cancelOrder({ code, reason, returnStock: ret, photo: photo! }), (x) => `تم إلغاء الأوردر ${x.ref} وإزالته من الأوردرات`); setBusy(false); if (r) onClose(); }}>تأكيد إلغاء الأوردر</Button>
      <p className="text-xs text-muted">يلزم كود صحيح وصورة. يظهر الأوردر الملغى في فلتر «ملغي» ويمكن استعادته.</p>
    </Sheet>
  );
}

type Mode = 'scan' | 'pickup';
export function UploadSheet({ d, mode: m0, onClose, manualRefs, date }: { d: Derived; mode: Mode; onClose: () => void; manualRefs?: string[]; date?: string }) {
  const act = useAct(); const fileRef = useRef<HTMLInputElement>(null);
  // the day the pickup was requested / the orders left: today, or a past day for a forgotten upload
  const minDay = addDays(d.today, -BACKDATE_DAYS);
  const [day, setDay] = useState(() => (date && date >= minDay && date <= d.today ? date : d.today));
  const closed = dayClosed(d.snap, day);
  const dayText = day === d.today ? 'تاريخ اليوم' : `بتاريخ ${day}`;
  const account = useAccountName();
  const [mode, setMode] = useState<Mode>(manualRefs ? 'scan' : m0);
  const [fname, setFname] = useState(''); const [err, setErr] = useState(''); const [emp, setEmp] = useState(() => localStorage.getItem('femini-last-emp') ?? '');
  const [original, setOriginal] = useState<File | null>(null);
  const [rows, setRows] = useState<ScanRow[] | null>(null);
  const scan = useMemo<ScanMatch | null>(() => (manualRefs ? { scans: manualRefs.length, matched: manualRefs.filter((r) => !d.orderMap.get(r)?.unmapped.length), duplicates: [], already: [], unknown: [], unmapped: manualRefs.filter((r) => d.orderMap.get(r)?.unmapped.length) } : rows ? matchScans(rows, d.snap.orders) : null), [manualRefs, rows, d]);
  const setScan = (x: null) => setRows(x);
  const nav = useNavigate();
  // the rows are kept and matched to the catalog on every change of it: saving a missing model (the «ربط الصنف» buttons)
  // re-matches the pickup right here, with no need to choose the file again
  const [pickupRows, setPickupRows] = useState<unknown[][] | null>(null);
  const pickup = useMemo(() => {
    if (!pickupRows) return null;
    try { return parsePickupRows(pickupRows, d.snap.skus, new Set(d.snap.orders.map((o) => o.ref))); } catch { return null; }
  }, [pickupRows, d.snap.skus, d.snap.orders]);
  const [channel, setChannel] = useState('VENDOOR'); const [busy, setBusy] = useState(false);
  const pcs = (refs: string[]) => refs.reduce((a, r) => a + (d.orderMap.get(r)?.lines.length ?? 0), 0);
  const neg = useMemo(() => {
    if (!scan) return [] as { sku: string; ready: number; need: number }[];
    const a: Record<string, number> = {}; for (const r of scan.matched) for (const s of d.orderMap.get(r)?.lines ?? []) a[s] = (a[s] ?? 0) + 1;
    return Object.keys(a).map((s) => ({ sku: s, ready: qty(d.snap.balances, s, 'READY'), need: a[s] })).filter((x) => x.ready < x.need);
  }, [scan, d]);

  async function onFile(f: File) {
    setErr(''); setFname(f.name); setOriginal(f); setScan(null); setPickupRows(null);
    try {
      if (mode === 'scan') {
        let rows: string[][];
        if (/\.csv$/i.test(f.name)) rows = parseCsv(await f.text());
        else { const X = await import('xlsx'); const wb = X.read(await f.arrayBuffer(), { type: 'array' }); rows = X.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }); }
        const scans: ScanRow[] = parseScan(rows); const nm = scans.find((s) => s.name)?.name; if (nm && !emp) setEmp(nm);
        setRows(scans);
      } else {
        const X = await import('xlsx'); const wb = X.read(await f.arrayBuffer(), { type: 'array' });
        const rows = X.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
        parsePickupRows(rows, d.snap.skus, new Set(d.snap.orders.map((o) => o.ref)));   // a file in the wrong format throws here: shown as the error
        setPickupRows(rows);
      }
    } catch (e) { setErr(String((e as Error).message ?? e)); }
  }

  return (
    <Sheet title={manualRefs ? 'تسجيل يدوي للشحن' : mode === 'scan' ? 'رفع ملف الإسكان' : 'رفع بيك أب'} onClose={onClose}>
      {!manualRefs && (
        <>
          <div className="inline-flex w-fit overflow-hidden rounded-xl border border-line2 bg-surface" role="group">
            {([['pickup', 'بيك أب (المطلوب)'], ['scan', 'سكان (الخارج فعلًا)']] as [Mode, string][]).map(([v, l], i) => (
              <button key={v} type="button" aria-pressed={mode === v} onClick={() => { setMode(v); setScan(null); setPickupRows(null); setErr(''); setFname(''); }} className={`px-3.5 py-1.5 text-[13px] font-medium ${i ? 'border-s border-line2' : ''} ${mode === v ? 'bg-accent text-on-accent' : 'hover:bg-lav'}`}>{l}</button>
            ))}
          </div>
          <button type="button" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
            className="grid gap-1 rounded-2xl border-2 border-dashed border-line2 bg-surface p-6 text-center hover:border-accent hover:bg-lav">
            <b>{fname || 'اسحب الملف هنا أو اضغط للاختيار'}</b>
            <span className="text-muted">{mode === 'scan' ? 'تصدير QRbot (CSV) أو أي ملف فيه عمود البوليصة' : 'ملف Excel من فيندور (كود الاوردر العشوائي، المنتجات المطلوبة...)'}</span>
          </button>
          <input ref={fileRef} type="file" hidden accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
          {mode === 'pickup' && <Field label="القناة"><select value={channel} onChange={(e) => setChannel(e.target.value)}>{CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.name}{c.supported ? '' : ' (التنسيق غير متاح بعد)'}</option>)}</select></Field>}
        </>
      )}
      {manualRefs && <Alert>تسجيل يدوي لأوردرات محددة من القائمة، دون ملف.</Alert>}
      <Field label={mode === 'pickup' ? 'تاريخ البيك أب (اليوم اللي اتطلب فيه)' : 'تاريخ الشحن (اليوم اللي القطع خرجت فيه)'}>
        <input type="date" value={day} min={minDay} max={d.today} onChange={(e) => e.target.value && setDay(e.target.value)} className="w-48" />
      </Field>
      {day !== d.today && <p className="-mt-2 text-xs text-muted">هيتسجل على يوم {day} زي ما يكون اتعمل فيه. ينفع لحد {BACKDATE_DAYS} أيام لورا.</p>}
      {closed && <Alert tone="warn" className="flex flex-wrap items-center justify-between gap-2"><span>يوم {day} مقفول. افتحه الأول عشان تسجّل عليه.</span><Button size="sm" onClick={() => act(() => repo.reopenDay(day), `اتفتح يوم ${day}`)}>افتح اليوم</Button></Alert>}
      {err && <Alert tone="crit">{err}</Alert>}

      {mode === 'scan' && scan && (
        <>
          {account
            ? <Field label="الموظف (من الحساب المسجّل)"><input value={account} readOnly className="bg-lav" /></Field>
            : <Field label="اسم الموظف (الذي سجّل السكان)"><input list="emps" value={emp} onChange={(e) => setEmp(e.target.value)} placeholder="مثال: عبدالله" /><span className="text-xs text-muted">سجّل دخول من الإعدادات عشان الاسم يتاخد من حسابك.</span></Field>}
          <datalist id="emps">{[...new Set(d.snap.orders.map((o) => o.shippedBy).filter(Boolean) as string[])].map((e) => <option key={e} value={e} />)}</datalist>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="سكان في الملف" value={scan.scans} /><Kpi label="أوردر جديد" value={scan.matched.length} sub={`${fmt(pcs(scan.matched))} قطعة ستُخصم`} tone="good" />
            <Kpi label="سُجّل مسبقًا" value={scan.already.length} tone={scan.already.length ? 'warn' : undefined} /><Kpi label="كود غير معروف" value={scan.unknown.length} tone={scan.unknown.length ? 'crit' : undefined} />
          </div>
          {scan.duplicates.length > 0 && <Alert tone="warn">{scan.duplicates.length} سكان مكرر في الملف نفسه (تم تجاهله).</Alert>}
          {scan.already.length > 0 && <Alert tone="warn">{scan.already.length} أوردر سُجّل مسبقًا{scan.already[0].by ? ` (مثلًا بواسطة ${scan.already[0].by})` : ''} ولن يُخصم مرة أخرى.</Alert>}
          {scan.unknown.length > 0 && <Alert tone="crit">أكواد غير موجودة في أي بيك أب: <span className="font-mono">{scan.unknown.slice(0, 12).join('، ')}</span>{scan.unknown.length > 12 ? ' ...' : ''}<br />ارفع البيك أب الخاص بها أولًا.</Alert>}
          {scan.unmapped.length > 0 && <Alert tone="warn"><b>{scan.unmapped.length} أوردر فيه صنف مش مربوط بالكتالوج</b>، ومش هيتشحن غير لما يتربط. اربطه من هنا:
            <LinkLines d={d} lines={scan.unmapped.flatMap((r) => d.orderMap.get(r)?.unmapped ?? [])} /></Alert>}
          {neg.length > 0 && <Alert tone="crit"><b>الرصيد مش كفاية لـ {neg.length} صنف</b>، فالتأكيد مقفول لحد ما تصلّح الرصيد (جرد أو تبديل مقاس)، علشان الرصيد مايبقاش بالسالب:
            <ul className="mt-1 list-disc ps-5">{neg.map((x) => <li key={x.sku}>{skuLabel(d.skuMap, x.sku)}: الجاهز {x.ready} والمطلوب يخرج {x.need} (ناقص {x.need - x.ready})</li>)}</ul>
            <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" onClick={() => { onClose(); nav('/operations?op=SWP'); }}>تبديل مقاس</Button><Button size="sm" onClick={() => { onClose(); nav('/operations?op=CNT'); }}>جرد</Button></div>
            <p className="mt-2 text-xs">بعد ما تصلّح الرصيد ارفع نفس الملف تاني.</p></Alert>}
          <Button variant="primary" disabled={!scan.matched.length || neg.length > 0 || !(account ?? emp).trim() || closed || busy} onClick={async () => {
            setBusy(true); if (!account) localStorage.setItem('femini-last-emp', emp.trim());
            const r = await act(() => repo.shipOrders({ refs: scan.matched, employee: (account ?? emp).trim(), source: manualRefs ? 'تسجيل يدوي' : fname, file: manualRefs ? null : original, date: day }), (x) => `تم شحن ${x.shipped} أوردر وخصمها من المخزون${x.negative.length ? `. تنبيه: ${x.negative.length} صنف برصيد سالب` : ''}`);
            setBusy(false); if (r) onClose();
          }}>تأكيد وخصم {fmt(pcs(scan.matched))} قطعة من المخزون ({dayText})</Button>
        </>
      )}
      {mode === 'pickup' && pickup && (
        <>
          <div className="grid grid-cols-3 gap-3"><Kpi label="أوردر جديد" value={pickup.orders.length} sub={`${fmt(pickup.orders.reduce((a, o) => a + o.lines.length, 0))} قطعة`} tone="good" /><Kpi label="مكرر (موجود)" value={pickup.duplicates.length} tone={pickup.duplicates.length ? 'warn' : undefined} /><Kpi label="أوردرات فيها أصناف غير مرتبطة" value={pickup.orders.filter((o) => o.unmapped.length).length} sub={`${new Set(pickup.orders.flatMap((o) => o.unmapped).map(lineText)).size} صنف مختلف`} tone={pickup.orders.some((o) => o.unmapped.length) ? 'crit' : 'good'} /></div>
          {pickup.orders.some((o) => o.unmapped.length) && <Alert tone="warn">
            <b>فيه أصناف في البيك أب مش مربوطة بالكتالوج.</b> اربطها من هنا قبل الاستيراد، وبعد الحفظ البيك أب بيتطابق من تاني لوحده. ولو استوردت من غير ربط، الأوردرات دي بتتعلّم «كود غير مربوط» وبتتربط لما تضيف الصنف.
            <LinkLines d={d} lines={pickup.orders.flatMap((o) => o.unmapped)} />
          </Alert>}
          <Alert>البيك أب لا يخصم من المخزون، ويُحتسب طلبًا فقط إلى أن تُشحن الأوردرات. لا تُحفظ بيانات العملاء.</Alert>
          <Button variant="primary" disabled={!pickup.orders.length || closed || busy} onClick={async () => {
            setBusy(true);
            const r = await act(() => repo.importPickup({ label: `بيك أب ${d.snap.pickups.length + 1}`, date: day, channel, source: fname, orders: pickup.orders, file: original }), (x) => `تم استيراد ${x.imported} أوردر. لم يُخصم أي رصيد بعد.`);
            setBusy(false); if (r) onClose();
          }}>استيراد {pickup.orders.length} أوردر ({dayText})</Button>
        </>
      )}
      <p className="text-xs text-muted">يُحفظ الملف الأصلي مع البيانات المستخرجة منه. <Link className="text-accent" to="/files">الملفات</Link></p>
    </Sheet>
  );
}

/** an unlinked pickup line as Vendoor wrote it: code · size · colour × qty */
const lineText = (u: unknown) => (Array.isArray(u) ? (u.length === 4 ? `${u[0]} · ${u[1]} · ${u[2]} × ${u[3]}` : String(u[0])) : String(u));

/**
 * The pickup lines that are not in the catalog, one row per model, each with one «ربط الصنف» button that opens the catalog
 * already filled in with the pickup's own naming: a new model gets its code and every colour and size the pickup used (pick
 * the type, check the colours, save); a model that exists gets the missing colour x size ticked. Saving links every waiting
 * order by itself.
 */
export function LinkLines({ d, lines }: { d: Derived; lines: unknown[] }) {
  type Link = { model: string; add: { color: string; size: string }[] } | { model: null; code: string; exact: boolean; colors: string[]; sizes: string[] };
  const [link, setLink] = useState<Link | null>(null);
  // the pickup writes the model as "BR2", "FC-BR2" or "Women A6": the catalog's own code, when it has one
  const toLink = (u: unknown[]) => { const code = String(u[0]).trim(); const bare = normalizeModelCode(code.replace(/^(FC-|Women\s+)/i, '')); const model = resolveModel(d.modelMap.keys(), code); return { model, code: bare, size: String(u[1]).trim(), color: String(u[2]).trim() }; };
  const by = new Map<string, { model: string | null; code: string; n: number; variants: Map<string, { color: string; size: string }> }>();
  const loose = new Map<string, number>();   // lines the parser could not even read
  for (const u of lines) {
    if (!(Array.isArray(u) && u.length === 4)) { const t = lineText(u); loose.set(t, (loose.get(t) ?? 0) + 1); continue; }
    const l = toLink(u); const raw = String(u[0]).trim(); const k = l.model ?? raw;
    const g = by.get(k) ?? { model: l.model, code: l.model ?? raw, n: 0, variants: new Map() };
    g.n += Number(u[3]) || 1; g.variants.set(`${l.color}|${l.size}`, { color: l.color, size: l.size }); by.set(k, g);
  }
  return (
    <>
      <ul className="mt-2 grid gap-2 text-sm">
        {[...by.values()].map((g) => {
          const vs = [...g.variants.values()]; const colors = [...new Set(vs.map((v) => v.color))]; const sizes = [...new Set(vs.map((v) => v.size))];
          return (
            <li key={g.model ?? g.code} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-surface px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <b className="font-mono">{g.code}</b> <span className="text-xs text-muted">{g.model ? `موجود في الكتالوج وناقصه ${vs.length} لون/مقاس` : 'مش في الكتالوج'}</span>
                <span className="block text-xs text-muted">{colors.join('، ')} · {sizes.join('، ')} · {g.n} قطعة</span>
              </span>
              <Button size="sm" variant="primary" onClick={() => setLink(g.model ? { model: g.model, add: vs } : EXACT_CODE.test(g.code) ? { model: null, code: g.code, exact: true, colors, sizes } : { model: null, code: normalizeModelCode(g.code), exact: false, colors, sizes })}>ربط الصنف</Button>
            </li>
          );
        })}
        {[...loose].map(([t, n]) => <li key={t} className="font-mono text-xs">{t}{n > 1 ? ` × ${n}` : ''} <span className="font-sans text-muted">(سطر مش مفهوم، صحّحه في الملف)</span></li>)}
      </ul>
      <p className="mt-2 text-xs">الزرار بيفتح الكتالوج بالكود والألوان والمقاسات زي ما في الملف: اختار النوع وراجع الألوان واحفظ، والأوردرات بتتربط لوحدها.</p>
      {link && ('add' in link
        // saving the catalog links every waiting order by itself
        ? <EditCatalogSheet d={d} initial={link.model} addVariants={link.add} onClose={() => setLink(null)} />
        : <NewModelSheet d={d} prefill={{ code: link.code, exact: link.exact, colors: link.colors, sizes: link.sizes }} onCreated={() => {}} onClose={() => setLink(null)} />)}
    </>
  );
}
