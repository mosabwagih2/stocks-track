import { useMemo, useRef, useState } from 'react';
import { Sheet, Button, Pill, Alert, Field, Kpi, TableWrap, th, td } from './ui';
import { OrderPill, Photo, PhotoInput } from './shared';
import type { Derived } from '@/hooks/data';
import { useAct } from '@/hooks/data';
import { repo } from '@/data';
import { findByCode, need, skuLabel } from '@/domain/orders';
import { matchScans, parseCsv, parseScan, type ScanMatch, type ScanRow } from '@/domain/scan';
import { parsePickupRows, type ParsedOrder } from '@/domain/pickup';
import { qty } from '@/domain/ledger';
import { CHANNELS, channelName } from '@/domain/constants';
import { fmt } from '@/lib/cn';
import { timeCairo } from '@/domain/dates';
import { Link } from 'react-router-dom';

export function OrderSheet({ d, orderRef, onClose, onCancel }: { d: Derived; orderRef: string; onClose: () => void; onCancel: (code: string) => void }) {
  const act = useAct();
  const o = d.orderMap.get(orderRef);
  if (!o) return null;
  const n = need(o); const pk = d.snap.pickups.find((p) => p.id === o.pickupId);
  return (
    <Sheet title={`أوردر ${o.ref}`} onClose={onClose}>
      <div className="flex flex-wrap items-center gap-2"><OrderPill o={o} d={d} /><span className="text-muted">{channelName(pk?.channel ?? '')} · {pk?.label}</span></div>
      <div className="grid grid-cols-2 gap-3"><Kpi label="البوليصة" value={<span className="text-lg">{o.waybill}</span>} /><Kpi label="المحافظة / النوع" value={<span className="font-sans text-lg">{o.gov} · {o.type === 'exchange' ? 'استبدال' : 'جديد'}</span>} /></div>
      <TableWrap>
        <table className="text-sm"><thead><tr><th className={th}>الصنف</th><th className={th}>في الأوردر</th><th className={th}>جاهز دلوقتي</th></tr></thead>
          <tbody>{Object.keys(n).map((s) => { const r = qty(d.snap.balances, s, 'READY'); return (
            <tr key={s}><td className={td}>{skuLabel(d.skuMap, s)}</td><td className={td + ' font-mono'}>{n[s]}</td><td className={td}>{r < n[s] && o.status === 'open' ? <Pill tone="crit">{r}</Pill> : <span className="font-mono">{fmt(r)}</span>}</td></tr>); })}</tbody></table>
      </TableWrap>
      {o.unmapped.length > 0 && <Alert tone="warn">فيه أصناف مش مربوطة بالكتالوج. اربطها قبل الشحن.</Alert>}
      {o.status === 'shipped' && <Alert tone="good">اتشحن بواسطة {o.shippedBy}{o.shippedAt ? ` الساعة ${timeCairo(o.shippedAt)}` : ''} · {o.shipDoc}</Alert>}
      {o.status === 'cancelled' && o.cancel && (
        <>
          <Alert tone="warn">اتلغى {o.cancel.at.slice(0, 10)} بواسطة {o.cancel.by}{o.cancel.reason ? ` · ${o.cancel.reason}` : ''}{o.cancel.returned ? ` · القطع رجعت للمخزون (${o.cancel.doc})` : o.cancel.was === 'shipped' ? ' · كان اتشحن والقطع ما رجعتش' : ''}</Alert>
          <Photo path={o.cancel.attachment} className="w-full rounded-xl border border-line" />
          <div><Button onClick={async () => { await act(() => repo.restoreOrder(o.ref), 'اترجّع الأوردر'); onClose(); }}>رجّع الأوردر</Button></div>
        </>
      )}
      {o.status !== 'cancelled' && <div><Button variant="danger" size="sm" onClick={() => onCancel(o.ref)}>{o.status === 'shipped' ? 'طلب إلغاء بعد الشحن' : 'إلغاء الأوردر (بصورة البوليصة)'}</Button></div>}
    </Sheet>
  );
}

export function CancelSheet({ d, initial, onClose }: { d: Derived; initial: string; onClose: () => void }) {
  const act = useAct();
  const [code, setCode] = useState(initial); const [reason, setReason] = useState(''); const [photo, setPhoto] = useState<File | null>(null); const [ret, setRet] = useState(true); const [busy, setBusy] = useState(false);
  const o = useMemo(() => findByCode(d.snap.orders, code), [d.snap.orders, code]);
  const can = !!o && o.status !== 'cancelled' && !!photo && !busy;
  return (
    <Sheet title="إلغاء أوردر" onClose={onClose}>
      <Alert>استخدمها لما يتطلب منك تلغي أوردر. سجّل كود البوليصة وصوّرها وهي متشطوبة، والأوردر هيتشال من الأوردرات ومن الطلب.</Alert>
      <Field label="كود الأوردر أو رقم الشحن"><input dir="ltr" className="font-mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="mk3450 أو 23772996" autoComplete="off" /></Field>
      {!code.trim() ? <p className="text-muted">اكتب كود الأوردر (زي mk3450) أو رقم الشحن (زي 23772996) من البوليصة.</p>
        : !o ? <Alert tone="crit">مفيش أوردر بالكود ده. اتأكد من الكود المكتوب على البوليصة.</Alert>
        : (
          <div className="grid gap-2 rounded-xl border border-line bg-lav p-3">
            <div className="flex items-center justify-between"><b className="font-mono">{o.ref}</b><OrderPill o={o} d={d} /></div>
            <span className="text-[13px] text-muted">شحن {o.waybill} · {o.gov} · {o.lines.length} قطعة</span>
            {o.status === 'cancelled' && <Alert tone="warn">الأوردر ده اتلغى قبل كده.</Alert>}
            {o.status === 'shipped' && <Alert tone="warn"><b>الأوردر ده اتشحن بالفعل</b> واتخصم من المخزون.<label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={ret} onChange={(e) => setRet(e.target.checked)} /> رجّع القطع ({o.lines.length}) للمخزون جاهز</label></Alert>}
          </div>
        )}
      <PhotoInput file={photo} onChange={setPhoto} label="صورة البوليصة (المشطوبة)" />
      <Field label="السبب (اختياري)"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثلًا: العميل لغى من فيندور" /></Field>
      <Button variant="danger" disabled={!can} onClick={async () => { setBusy(true); const r = await act(() => repo.cancelOrder({ code, reason, returnStock: ret, photo: photo! }), (x) => `اتلغى الأوردر ${x.ref} ونزل من الأوردرات`); setBusy(false); if (r) onClose(); }}>تأكيد إلغاء الأوردر</Button>
      <p className="text-xs text-muted">مطلوب كود صحيح وصورة. الأوردر الملغي بيظهر في فلتر "ملغي" وتقدر ترجّعه.</p>
    </Sheet>
  );
}

type Mode = 'scan' | 'pickup';
export function UploadSheet({ d, mode: m0, onClose, manualRefs }: { d: Derived; mode: Mode; onClose: () => void; manualRefs?: string[] }) {
  const act = useAct(); const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>(manualRefs ? 'scan' : m0);
  const [fname, setFname] = useState(''); const [err, setErr] = useState(''); const [emp, setEmp] = useState(() => localStorage.getItem('femini-last-emp') ?? '');
  const [scan, setScan] = useState<ScanMatch | null>(manualRefs ? { scans: manualRefs.length, matched: manualRefs, duplicates: [], already: [], unknown: [], unmapped: [] } : null);
  const [pickup, setPickup] = useState<{ orders: ParsedOrder[]; duplicates: string[]; unknownModels: string[] } | null>(null);
  const [channel, setChannel] = useState('VENDOOR'); const [busy, setBusy] = useState(false);
  const pcs = (refs: string[]) => refs.reduce((a, r) => a + (d.orderMap.get(r)?.lines.length ?? 0), 0);
  const neg = useMemo(() => {
    if (!scan) return [] as { sku: string; ready: number; need: number }[];
    const a: Record<string, number> = {}; for (const r of scan.matched) for (const s of d.orderMap.get(r)?.lines ?? []) a[s] = (a[s] ?? 0) + 1;
    return Object.keys(a).map((s) => ({ sku: s, ready: qty(d.snap.balances, s, 'READY'), need: a[s] })).filter((x) => x.ready < x.need);
  }, [scan, d]);

  async function onFile(f: File) {
    setErr(''); setFname(f.name); setScan(null); setPickup(null);
    try {
      if (mode === 'scan') {
        let rows: string[][];
        if (/\.csv$/i.test(f.name)) rows = parseCsv(await f.text());
        else { const X = await import('xlsx'); const wb = X.read(await f.arrayBuffer(), { type: 'array' }); rows = X.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }); }
        const scans: ScanRow[] = parseScan(rows); const nm = scans.find((s) => s.name)?.name; if (nm && !emp) setEmp(nm);
        setScan(matchScans(scans, d.snap.orders));
      } else {
        const X = await import('xlsx'); const wb = X.read(await f.arrayBuffer(), { type: 'array' });
        const rows = X.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
        setPickup(parsePickupRows(rows, d.snap.skus, new Set(d.snap.orders.map((o) => o.ref))));
      }
    } catch (e) { setErr(String((e as Error).message ?? e)); }
  }

  return (
    <Sheet title={manualRefs ? 'تسجيل يدوي للشحن' : mode === 'scan' ? 'رفع ملف السكان' : 'رفع بيك أب'} onClose={onClose}>
      {!manualRefs && (
        <>
          <div className="inline-flex w-fit overflow-hidden rounded-xl border border-line2 bg-surface" role="group">
            {([['pickup', 'بيك أب (المطلوب)'], ['scan', 'سكان (الخارج فعلًا)']] as [Mode, string][]).map(([v, l], i) => (
              <button key={v} type="button" aria-pressed={mode === v} onClick={() => { setMode(v); setScan(null); setPickup(null); setErr(''); setFname(''); }} className={`px-3.5 py-1.5 text-[13px] font-medium ${i ? 'border-s border-line2' : ''} ${mode === v ? 'bg-accent text-on-accent' : 'hover:bg-lav'}`}>{l}</button>
            ))}
          </div>
          <button type="button" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}
            className="grid gap-1 rounded-2xl border-2 border-dashed border-line2 bg-surface p-6 text-center hover:border-accent hover:bg-lav">
            <b>{fname || 'اسحب الملف هنا أو اضغط للاختيار'}</b>
            <span className="text-muted">{mode === 'scan' ? 'تصدير QRbot (CSV) أو أي ملف فيه عمود كود الأوردر' : 'ملف Excel من فيندور (كود الاوردر العشوائي، المنتجات المطلوبة...)'}</span>
          </button>
          <input ref={fileRef} type="file" hidden accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }} />
          {mode === 'pickup' && <Field label="القناة"><select value={channel} onChange={(e) => setChannel(e.target.value)}>{CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.name}{c.supported ? '' : ' (التنسيق مش متاح لسه)'}</option>)}</select></Field>}
        </>
      )}
      {manualRefs && <Alert>تسجيل يدوي لأوردرات اخترتها من القائمة، من غير ملف.</Alert>}
      {err && <Alert tone="crit">{err}</Alert>}

      {mode === 'scan' && scan && (
        <>
          <Field label="اسم الموظف (اللي سكان)"><input list="emps" value={emp} onChange={(e) => setEmp(e.target.value)} placeholder="مثلًا: عبدالله" /></Field>
          <datalist id="emps">{[...new Set(d.snap.orders.map((o) => o.shippedBy).filter(Boolean) as string[])].map((e) => <option key={e} value={e} />)}</datalist>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="سكان في الملف" value={scan.scans} /><Kpi label="أوردر جديد" value={scan.matched.length} sub={`${fmt(pcs(scan.matched))} قطعة هتتخصم`} tone="good" />
            <Kpi label="اتسجّل قبل كده" value={scan.already.length} tone={scan.already.length ? 'warn' : undefined} /><Kpi label="كود غير معروف" value={scan.unknown.length} tone={scan.unknown.length ? 'crit' : undefined} />
          </div>
          {scan.duplicates.length > 0 && <Alert tone="warn">{scan.duplicates.length} سكان مكرر في نفس الملف اتخطّى.</Alert>}
          {scan.already.length > 0 && <Alert tone="warn">{scan.already.length} أوردر اتسجّل قبل كده{scan.already[0].by ? ` (مثلًا بواسطة ${scan.already[0].by})` : ''} ومش هيتخصم تاني.</Alert>}
          {scan.unknown.length > 0 && <Alert tone="crit">أكواد مش موجودة في أي بيك أب: <span className="font-mono">{scan.unknown.slice(0, 12).join('، ')}</span>{scan.unknown.length > 12 ? ' ...' : ''}<br />ارفع البيك أب بتاعها الأول.</Alert>}
          {scan.unmapped.length > 0 && <Alert tone="warn">{scan.unmapped.length} أوردر فيه صنف مش مربوط بالكتالوج. اربطه الأول.</Alert>}
          {neg.length > 0 && <Alert tone="warn"><b>الرصيد مش كفاية لـ {neg.length} صنف</b>، بس السكان مش هيتمنع. هيبقى بالسالب ويظهر في "محتاج تدخّل":<ul className="mt-1 list-disc ps-5">{neg.slice(0, 6).map((x) => <li key={x.sku}>{skuLabel(d.skuMap, x.sku)}: رصيد {x.ready} والمشحون {x.need}</li>)}</ul></Alert>}
          <Button variant="primary" disabled={!scan.matched.length || !emp.trim() || busy} onClick={async () => {
            setBusy(true); localStorage.setItem('femini-last-emp', emp.trim());
            const r = await act(() => repo.shipOrders({ refs: scan.matched, employee: emp.trim(), source: manualRefs ? 'تسجيل يدوي' : fname }), (x) => `اتسجّل ${x.shipped} أوردر وخرجوا من المخزون${x.negative.length ? `. تنبيه: ${x.negative.length} صنف بالسالب` : ''}`, { undo: (x) => { act(() => repo.reverseShipment(x.doc), 'اتعكست العملية'); } });
            setBusy(false); if (r) onClose();
          }}>تأكيد وخصم {fmt(pcs(scan.matched))} قطعة من المخزون</Button>
        </>
      )}
      {mode === 'pickup' && pickup && (
        <>
          <div className="grid grid-cols-3 gap-3"><Kpi label="أوردر جديد" value={pickup.orders.length} sub={`${fmt(pickup.orders.reduce((a, o) => a + o.lines.length, 0))} قطعة`} tone="good" /><Kpi label="مكرر (موجود)" value={pickup.duplicates.length} tone={pickup.duplicates.length ? 'warn' : undefined} /><Kpi label="أصناف مش مربوطة" value={pickup.orders.filter((o) => o.unmapped.length).length} tone={pickup.orders.some((o) => o.unmapped.length) ? 'crit' : undefined} /></div>
          {pickup.unknownModels.length > 0 && <Alert tone="warn">أكواد موديل مش معروفة: <span className="font-mono">{pickup.unknownModels.join('، ')}</span>. الأوردرات دي هتتعلّم "كود غير مربوط".</Alert>}
          <Alert>البيك أب مش بيخصم من المخزون. بيتحسب كطلب بس لحد ما الأوردرات تتشحن. بيانات العملاء ما بتتحفظش.</Alert>
          <Button variant="primary" disabled={!pickup.orders.length || busy} onClick={async () => {
            setBusy(true);
            const r = await act(() => repo.importPickup({ label: `بيك أب ${d.snap.pickups.length + 1}`, date: d.today, channel, source: fname, orders: pickup.orders }), (x) => `اتستورد ${x.imported} أوردر. لسه ما اتخصمش حاجة.`);
            setBusy(false); if (r) onClose();
          }}>استيراد {pickup.orders.length} أوردر (تاريخ النهارده)</Button>
        </>
      )}
      <p className="text-xs text-muted">الملفات الأصلية مش بتتخزّن. بتتحفظ البيانات اللي طلعت منها. <Link className="text-accent" to="/ledger">السجل</Link></p>
    </Sheet>
  );
}
