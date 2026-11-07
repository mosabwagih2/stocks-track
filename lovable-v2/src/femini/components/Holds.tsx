import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpFromLine, Ban, CheckCircle2, Clock, Hand, Plus, RotateCcw, Trash2, User } from 'lucide-react';
import { useAct } from '@/femini/hooks/data';
import type { Derived } from '@/femini/hooks/data';
import { Alert, Button, Card, Empty, Field, Pill, Seg, Sheet, Tabs } from '@/femini/components/ui';
import { Photo, PhotoInput } from '@/femini/components/shared';
import { VariantPicker } from '@/femini/components/VariantPicker';
import { skuLabel } from '@/femini/domain/orders';
import { qty } from '@/femini/domain/ledger';
import { daysOut, HOLD_OVERDUE_DAYS, HOLD_REASON_AR, isOverdue, outstanding, outstandingTotal, type Hold, type HoldReason } from '@/femini/domain/holds';
import type { Loc } from '@/femini/domain/types';
import { repo } from '@/femini/data';
import { cn, fmt } from '@/femini/cn';

const when = (iso: string) => new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
const reasonOf = (h: Hold) => (h.reason === 'other' ? h.reasonText || HOLD_REASON_AR.other : HOLD_REASON_AR[h.reason]);

/* ---------------- new hold */
function NewHold({ d, onClose }: { d: Derived; onClose: () => void }) {
  const act = useAct();
  const [who, setWho] = useState(''); const [note, setNote] = useState(''); const [reason, setReason] = useState<HoldReason>('shoot'); const [reasonText, setReasonText] = useState('');
  const [lines, setLines] = useState<{ sku: string; q: number }[]>([]); const [photo, setPhoto] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  const total = lines.reduce((a, l) => a + l.q, 0);
  const over = lines.filter((l) => l.q > qty(d.snap.balances, l.sku, 'READY'));
  const ready = who.trim() && total > 0 && photo && !over.length && (reason !== 'other' || reasonText.trim());
  const save = async () => { setBusy(true); const r = await act(() => repo.holdOut({ who, note, reason, reasonText, lines, photo }), (no) => `اتسجل الهولد ${no}`); setBusy(false); if (r) onClose(); };
  return (
    <Sheet title="هولد جديد" onClose={onClose} wide>
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="استلمها مين (إجباري)"><input value={who} onChange={(e) => setWho(e.target.value)} placeholder="اسم الشخص" /></Field>
          <Field label="ملاحظة"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلًا: سيشن يوم الخميس" /></Field>
        </div>
        <Field label="السبب"><Seg value={reason} onChange={setReason} options={(Object.keys(HOLD_REASON_AR) as HoldReason[]).map((k) => [k, HOLD_REASON_AR[k]])} /></Field>
        {reason === 'other' && <Field label="اكتب السبب"><input value={reasonText} onChange={(e) => setReasonText(e.target.value)} /></Field>}
        <div className="grid gap-2 rounded-xl border border-line bg-lav p-3">
          <b className="text-sm">القطع (من جاهز للبيع)</b>
          <VariantPicker d={d} from="READY" onAdd={(sku, q) => setLines((ls) => (ls.some((l) => l.sku === sku) ? ls.map((l) => (l.sku === sku ? { ...l, q: l.q + q } : l)) : [...ls, { sku, q }]))} />
          {lines.length > 0 && <div className="grid gap-1.5">{lines.map((l) => { const have = qty(d.snap.balances, l.sku, 'READY'); return (
            <div key={l.sku} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm">
              <span className="flex-1">{skuLabel(d.skuMap, l.sku)}</span>
              <span className={cn('text-xs', l.q > have ? 'text-crit' : 'text-muted')}>متاح {fmt(have)}</span>
              <input type="number" min={1} value={l.q} className="w-16 text-center" aria-label="الكمية" onChange={(e) => setLines((ls) => ls.map((x) => (x.sku === l.sku ? { ...x, q: Math.max(1, Math.floor(+e.target.value || 1)) } : x)))} />
              <Button size="sm" variant="ghost" aria-label="حذف" onClick={() => setLines((ls) => ls.filter((x) => x.sku !== l.sku))}><Trash2 className="size-4" /></Button>
            </div>); })}</div>}
        </div>
        <PhotoInput file={photo} onChange={setPhoto} label="صورة إثبات التسليم (إجباري)" />
        <p className="text-xs text-muted">الوقت بيتسجل تلقائيًا لحظة التأكيد.</p>
        {over.length > 0 && <Alert tone="crit">فيه قطع أكتر من الجاهز للبيع.</Alert>}
        <div className="sticky bottom-0 flex gap-2 border-t border-line bg-surface pt-3">
          <Button variant="primary" className="flex-1" disabled={!ready || busy} onClick={save}><ArrowUpFromLine className="size-4" /> تأكيد خروج {fmt(total)} قطعة</Button>
          <Button onClick={onClose}>إلغاء</Button>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------------- one hold: settle + log */
type Row = { sku: string; ret: number; to: Loc };
function HoldSheet({ d, h, onClose }: { d: Derived; h: Hold; onClose: () => void }) {
  const act = useAct();
  const left = outstanding(h);
  const [rows, setRows] = useState<Row[]>(() => Object.entries(left).map(([sku, q]) => ({ sku, ret: q, to: 'READY' })));
  const [rest, setRest] = useState<'off' | 'keep'>('off'); const [note, setNote] = useState(''); const [photo, setPhoto] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  const offOf = (r: Row) => (rest === 'off' ? Math.max(0, (left[r.sku] ?? 0) - r.ret) : 0);
  const set = (sku: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.sku === sku ? { ...r, ...p } : r)));
  const tRet = rows.reduce((a, r) => a + r.ret, 0), tOff = rows.reduce((a, r) => a + offOf(r), 0);
  const bad = rows.some((r) => r.ret > (left[r.sku] ?? 0));
  const remaining = outstandingTotal(h) - tRet - tOff;
  const quick = (all: boolean) => setRows((rs) => rs.map((r) => ({ ...r, ret: all ? left[r.sku] : 0 })));
  const save = async () => {
    setBusy(true);
    const r = await act(() => repo.holdSettle({ no: h.no, note, photo, ret: rows.map((x) => ({ sku: x.sku, q: x.ret, to: x.to })), off: rows.map((x) => ({ sku: x.sku, q: offOf(x) })) }), (x) => (x.closed ? 'اتقفل الهولد' : 'اتسجل والباقي لسه برا'));
    setBusy(false); if (r) onClose();
  };
  return (
    <Sheet title={<span className="font-mono">{h.no} · {h.who}</span>} onClose={onClose} wide>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Pill tone={h.status === 'closed' ? 'good' : isOverdue(h) ? 'crit' : 'warn'}>{h.status === 'closed' ? 'مقفول' : `برا من ${daysOut(h)} يوم`}</Pill>
          <span className="text-muted">{reasonOf(h)}</span>{h.note && <span className="text-muted">· {h.note}</span>}
        </div>

        {h.status === 'open' && (
          <Card title="تسوية الهولد" hint="الراجع بيرجع جاهز للبيع تلقائيًا، وتقدر تغيّر حالة أي قطعة فيها مشكلة">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => quick(true)}><RotateCcw className="size-4" /> رجع كله</Button>
              <Button size="sm" onClick={() => quick(false)}><Ban className="size-4" /> مرجعش حاجة</Button>
              <span className="ms-auto flex items-center gap-2 text-sm text-muted">اللي مرجعش: <Seg value={rest} onChange={setRest} options={[['off', 'يتخصم نهائي'], ['keep', 'يفضل برا']]} /></span>
            </div>
            <div className="grid gap-2">{rows.map((r) => { const l = left[r.sku] ?? 0; const over = r.ret > l; const off = offOf(r); return (
              <div key={r.sku} className={cn('grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end', over ? 'border-crit/50 bg-crit/5' : 'border-line')}>
                <div><b className="text-sm">{skuLabel(d.skuMap, r.sku)}</b><p className="text-xs text-muted">برا: {fmt(l)}{rest === 'keep' ? ` · هيفضل برا ${fmt(Math.max(0, l - r.ret))}` : ''}</p></div>
                <Field label="رجع"><input type="number" min={0} max={l} value={r.ret} className="w-20 text-center" onChange={(e) => set(r.sku, { ret: Math.max(0, Math.floor(+e.target.value || 0)) })} /></Field>
                <Field label="حالته"><Seg value={r.to} onChange={(to) => set(r.sku, { to })} options={[['READY', 'سليم'], ['DIRTY', 'نضافة'], ['SCRAP', 'هالك']]} /></Field>
                <Field label="خصم نهائي"><div className={cn('grid h-10 w-20 place-items-center rounded-xl border border-dashed font-mono', off ? 'border-crit/40 text-crit' : 'border-line text-muted')} title="بيتحسب تلقائي">{fmt(off)}</div></Field>
              </div>); })}</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="ملاحظة"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلًا: القطعة رجعت فيها بقعة" /></Field>
              <PhotoInput file={photo} onChange={setPhoto} label={tOff ? 'صورة إثبات الخصم (إجباري)' : 'صورة (اختياري)'} />
            </div>
            {tOff > 0 && !photo && <Alert tone="warn" className="mt-3">اللي مش هيرجع للمخزون ميتقفلش غير بصورة إثبات.</Alert>}
            {bad && <Alert tone="crit" className="mt-3">الراجع أكتر من اللي برا.</Alert>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted">رجوع {fmt(tRet)} · خصم {fmt(tOff)} · {remaining > 0 ? `هيفضل برا ${fmt(remaining)}` : 'الهولد هيتقفل'}</span>
              <Button variant="primary" disabled={busy || bad || tRet + tOff === 0 || (tOff > 0 && !photo)} onClick={save}><CheckCircle2 className="size-4" /> تأكيد</Button>
            </div>
          </Card>
        )}

        <Card title="سجل العمليات">
          <ol className="relative grid gap-4 border-s border-line ps-5">
            {[...h.events].reverse().map((e, i) => (
              <li key={i} className="relative">
                <span className={cn('absolute -start-[27px] top-1 grid size-4 place-items-center rounded-full ring-4 ring-surface', e.kind === 'out' ? 'bg-info' : e.kind === 'return' ? 'bg-good' : 'bg-crit')} />
                <div className="flex flex-wrap items-center gap-2 text-sm"><b>{e.kind === 'out' ? `خرجت لـ ${h.who}` : e.kind === 'return' ? 'رجوع' : 'خصم نهائي'}</b><span className="text-xs text-muted">{when(e.at)} · {e.by}</span></div>
                <ul className="mt-1 text-sm text-muted">{e.lines.map((l) => <li key={l.sku}>{skuLabel(d.skuMap, l.sku)} × <b className="font-mono text-ink">{l.q}</b>{e.kind === 'return' && l.to && l.to !== 'READY' ? <span> ({l.to === 'DIRTY' ? 'نضافة' : 'هالك'})</span> : null}</li>)}</ul>
                {e.note && <p className="mt-1 text-xs">{e.note}</p>}
                {e.photo && <Photo path={e.photo} className="mt-2 max-h-48 rounded-lg border border-line object-contain" />}
              </li>))}
          </ol>
        </Card>
      </div>
    </Sheet>
  );
}

/* ---------------- list */
export function Holds({ d, openNew, onOpenNew }: { d: Derived; openNew: boolean; onOpenNew: (v: boolean) => void }) {
  const holds = d.snap.holds ?? [];
  const [view, setView] = useState('all'); const [open, setOpen] = useState<string | null>(null); const [q, setQ] = useState('');
  const list = useMemo(() => [...holds].reverse().filter((h) => (view === 'open' ? h.status === 'open' : view === 'closed' ? h.status === 'closed' : true) && (!q || `${h.who} ${h.no} ${h.note}`.includes(q))), [holds, view, q]);
  const openH = holds.filter((h) => h.status === 'open');
  const piecesOut = openH.reduce((a, h) => a + outstandingTotal(h), 0); const late = openH.filter((h) => isOverdue(h)).length;
  const sel = open ? holds.find((h) => h.no === open) : undefined;
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-xs text-muted">هولد مفتوح</p><b className="text-2xl">{fmt(openH.length)}</b></div>
        <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-xs text-muted">قطع خرجت</p><b className="text-2xl">{fmt(piecesOut)}</b></div>
        <div className={cn('rounded-2xl border p-4', late ? 'border-crit/40 bg-crit/5' : 'border-line bg-surface')}><p className="text-xs text-muted">متأخر أكتر من {HOLD_OVERDUE_DAYS} أيام</p><b className={cn('text-2xl', late > 0 && 'text-crit')}>{fmt(late)}</b></div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex">
        <Tabs value={view} onChange={setView} tabs={[['all', 'الكل'], ['open', 'مفتوح'], ['closed', 'مقفول']]} className="h-10 min-w-0 shrink-0 py-0.5" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="دوّر بالاسم" className="order-last col-span-2 h-10 w-full min-w-0 rounded sm:order-none sm:w-auto sm:flex-1-[10px] border border-line2 bg-surface px-3 text-sm text-ink placeholder:text-muted" />
        <Button variant="primary" className="h-10 shrink-0" onClick={() => onOpenNew(true)}><Plus className="size-4" /> هولد جديد</Button>
      </div>
      {!list.length ? <Empty>{view === 'open' ? 'مفيش قطع برا دلوقتي.' : 'مفيش هولد هنا.'}</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{list.map((h) => { const out = outstandingTotal(h); const late2 = isOverdue(h); return (
          <button key={h.no} onClick={() => setOpen(h.no)} className={cn('grid gap-2 rounded-2xl border bg-surface p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:shadow-md', late2 ? 'border-crit/50' : 'border-line hover:border-accent/50')}>
            <div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-info/10 text-info"><User className="size-4" /></span><b className="flex-1 truncate">{h.who}</b>
              <Pill tone={h.status === 'closed' ? 'good' : late2 ? 'crit' : 'warn'}>{h.status === 'closed' ? 'مقفول' : late2 ? 'متأخر' : 'برا'}</Pill></div>
            <p className="text-sm text-muted">{reasonOf(h)}{h.note ? ` · ${h.note}` : ''}</p>
            <div className="flex items-center justify-between text-xs text-muted"><span className="inline-flex items-center gap-1"><Clock className="size-3.5" />{when(h.at)}</span><span className="font-mono">{h.no}</span></div>
            <div className="flex items-center gap-1.5 text-sm">{h.status === 'open' ? <><Hand className="size-4 text-warn" /> {fmt(out)} من {fmt(h.lines.reduce((a, l) => a + l.q, 0))} قطعة برا · {daysOut(h)} يوم</> : <><CheckCircle2 className="size-4 text-good" /> اتقفل</>}{late2 && <AlertTriangle className="size-4 text-crit" />}</div>
          </button>); })}</div>)}
      {openNew && <NewHold d={d} onClose={() => onOpenNew(false)} />}
      {sel && <HoldSheet key={sel.no + sel.events.length} d={d} h={sel} onClose={() => setOpen(null)} />}
    </div>
  );
}
