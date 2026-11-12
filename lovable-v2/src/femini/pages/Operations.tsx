import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Ban, ClipboardCheck, Download, Factory, FileText, Minus, Plus, Printer, Recycle, RotateCcw, ScanLine, Search, Shuffle, ArrowLeftRight, Hand, Store, Trash2, Truck, Undo2, Save, X } from 'lucide-react';
import { useAct, useDerived } from '@/femini/hooks/data';
import { PageHead } from '@/femini/components/PageHead';
import { Alert, Button, Card, Chip, Empty, Field, Pill, Seg, Sheet, Tabs, TableWrap, th, td } from '@/femini/components/ui';
import { ErrorBox, Photo, PhotoInput } from '@/femini/components/shared';
import { VariantPicker } from '@/femini/components/VariantPicker';
import { Spinner } from '@/femini/components/Spinner';
import { LOCS, LOC_AR, TYPE_AR } from '@/femini/domain/constants';
import { qty } from '@/femini/domain/ledger';
import { findByCode, skuLabel } from '@/femini/domain/orders';
import { addDays } from '@/femini/domain/dates';
import { buildOp, effects, expectedReturn, GROUP_AR, OPS, type OpGroup, type OpHdr, type OpLine, type OpType } from '@/femini/domain/ops';
import { LostOrders } from '@/femini/components/LostOrders';
import { deliveryNoteExcel, downloadDeliveryNote, printDeliveryNote } from '@/femini/components/DeliveryNote';
import { Holds } from '@/femini/components/Holds';
import { DocDetails } from '@/femini/components/DocDetails';
import { OpHistory } from '@/femini/components/OpHistory';
import { isOverdue } from '@/femini/domain/holds';
import { useNavigate, useSearchParams } from '@/femini/router';
import { cn, fmt } from '@/femini/cn';
import { repo } from '@/femini/data';
import type { Derived } from '@/femini/hooks/data';
import type { Doc, Loc, OpDraft } from '@/femini/domain/types';

const ICON: Record<string, typeof Truck> = { RCV: ArrowDownToLine, RTN: RotateCcw, SRT: Undo2, SHP: Store, CLN: Shuffle, FSD: Factory, FRC: Recycle, CNT: ClipboardCheck, LOS: Search, SWP: ArrowLeftRight, SCN: ScanLine };
const GROUP_TONE: Record<OpGroup, string> = { in: 'text-good bg-good/10', out: 'text-info bg-info/10', internal: 'text-warn bg-warn/10', control: 'text-accent bg-accent/10' };
const SOURCE: Partial<Record<OpType, (h: OpHdr) => Loc | undefined>> = { SHP: () => 'READY', CLN: (h) => h.from ?? 'READY', FSD: (h) => (h.kind === 'scrap' ? 'SCRAP' : 'DIRTY'), FRC: () => 'FACTORY', LOS: () => 'LOST', SWP: () => 'READY' };
const defaults = (t: OpType): OpHdr => (t === 'CLN' ? { from: 'READY', to: 'DIRTY' } : t === 'FSD' ? { kind: 'wash' } : t === 'CNT' ? { state: 'READY', cnt: {}, snap: {} } : t === 'RTN' ? { refs: [] } : {});

/* ------------------------------------------------------------------ launcher */
function Launcher({ d, onPick, onDraft, onHold }: { d: Derived; onPick: (t: OpType) => void; onDraft: (x: OpDraft) => void; onHold: () => void }) {
  const nav = useNavigate(); const act = useAct();
  const groups: OpGroup[] = ['in', 'out', 'internal', 'control'];
  const loc = (l: Loc) => Object.values(d.snap.balances).reduce((a, b) => a + (b[l] ?? 0), 0);
  const hint: Partial<Record<string, string>> = {
    CLN: '', FSD: loc('DIRTY') ? `${fmt(loc('DIRTY'))} قطعة محتاجة غسيل` : '', FRC: loc('FACTORY') ? `${fmt(loc('FACTORY'))} قطعة عند المصنع` : '',
    LOS: loc('LOST') ? `${fmt(loc('LOST'))} قطعة مفقودة مستنية تسوية` : '', SHP: `${(d.snap.docs.filter((x) => x.type === 'SHP' && x.status === 'done' && !x.hdr.delivered)).length || ''}`,
    SCN: d.open.length ? `${fmt(d.open.length)} أوردر مستني الشحن` : '',
  };
  if (hint.SHP) hint.SHP = `${hint.SHP} إذن مستني تأكيد التسليم`;
  return (
    <div className="grid gap-5">
      {(d.snap.drafts ?? []).length > 0 && (
        <Card title={`مسودات محتاجة تكمل (${(d.snap.drafts ?? []).length})`}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[...(d.snap.drafts ?? [])].reverse().map((x) => {
            const I = ICON[x.type] ?? FileText;
            return (
              <div key={x.id} className="flex items-center gap-3 rounded-xl border border-warn/40 bg-warn/5 p-3">
                <I className="size-5 text-warn" />
                <button className="min-w-0 flex-1 text-start" onClick={() => onDraft(x)}><b className="block">{TYPE_AR[x.type]}</b><span className="text-xs text-muted">{x.lines.length} صنف · {x.updatedAt.slice(0, 16).replace('T', ' ')}</span></button>
                <Button size="sm" variant="ghost" aria-label="أرشفة المسودة" onClick={() => act(() => repo.deleteDraft(x.id), 'تمت أرشفة المسودة؛ يمكن استرجاعها من السجل')}><Trash2 className="size-4" /></Button>
              </div>);
          })}</div>
        </Card>
      )}
      {groups.map((g) => (
        <section key={g}>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted">{g === 'in' ? <ArrowDownToLine className="size-4" /> : g === 'out' ? <ArrowUpFromLine className="size-4" /> : g === 'internal' ? <Shuffle className="size-4" /> : <ClipboardCheck className="size-4" />}{GROUP_AR[g]}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g === 'out' && (
              <button onClick={() => nav('/orders')} className="group flex items-start gap-3 rounded-2xl border border-dashed border-line2 bg-surface p-4 text-start transition hover:border-accent/50">
                <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', GROUP_TONE.out)}><ScanLine className="size-5" /></span>
                <span className="min-w-0 flex-1"><b className="block">أوردرات اتشحنت</b><span className="text-sm text-muted">الخروج الفعلي من ملف الإسكان — من صفحة الأوردرات</span>{hint.SCN && <span className="mt-1.5 block text-xs font-semibold text-warn">{hint.SCN}</span>}</span>
              </button>)}
            {OPS.filter((o) => o.grp === g).map((o) => { const I = ICON[o.type]; return (
              <button key={o.type} onClick={() => onPick(o.type)} className="group flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md">
                <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', GROUP_TONE[g])}><I className="size-5" /></span>
                <span className="min-w-0 flex-1"><b className="block">{o.ar}</b><span className="text-sm text-muted">{o.desc}</span>{hint[o.type] && <span className="mt-1.5 block text-xs font-semibold text-warn">{hint[o.type]}</span>}</span>
                <ArrowLeft className="size-4 self-center text-muted opacity-0 transition group-hover:opacity-100" />
              </button>); })}
            {g === 'out' && (() => { const oh = (d.snap.holds ?? []).filter((h) => h.status === 'open'); const late = oh.filter((h) => isOverdue(h)).length; return (
              <button onClick={onHold} className="group flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md">
                <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', GROUP_TONE.out)}><Hand className="size-5" /></span>
                <span className="min-w-0 flex-1"><b className="block">هولد</b><span className="text-sm text-muted">عينات تصوير أو عينات بتطلع وممكن ترجع أو تتخصم</span>{oh.length > 0 && <span className={cn('mt-1.5 block text-xs font-semibold', late ? 'text-crit' : 'text-warn')}>{oh.length} هولد مفتوح{late ? ` · ${late} متأخر` : ''}</span>}</span>
              </button>); })()}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ line editors */
type SetLines = (f: (l: OpLine[]) => OpLine[]) => void;
function Stepper({ v, on, min = 0, max, label }: { v: number; on: (n: number) => void; min?: number; max?: number; label: string }) {
  const clamp = (n: number) => Math.max(min, max === undefined ? n : Math.min(max, n));
  return (
    <span className="inline-flex items-center overflow-hidden rounded-lg border border-line2">
      <button type="button" aria-label={`${label} -`} className="px-2 py-1.5 hover:bg-lav" onClick={() => on(clamp(v - 1))}><Minus className="size-3.5" /></button>
      <input type="number" min={min} max={max} value={v} aria-label={label} className="w-14 rounded-none border-0 py-1 text-center" onChange={(e) => on(clamp(Math.floor(+e.target.value || 0)))} />
      <button type="button" aria-label={`${label} +`} disabled={max !== undefined && v >= max} className="px-2 py-1.5 hover:bg-lav disabled:opacity-40" onClick={() => on(clamp(v + 1))}><Plus className="size-3.5" /></button>
    </span>
  );
}
const upd = (set: SetLines, i: number, p: Partial<OpLine>) => set((ls) => ls.map((x, j) => (j === i ? { ...x, ...p } : x)));
/** `max`: what the source state holds; adding again never goes past it */
const addLine = (ls: OpLine[], sku: string, q: number, extra: Partial<OpLine> = {}, max?: number) => {
  // a line is the variant (and, for a shop return, the state it came back in): the same piece in two states is two lines
  const same = (l: OpLine) => l.sku === sku && (extra.to === undefined || l.to === extra.to);
  const cur = ls.find(same)?.q ?? 0; const next = max === undefined ? cur + q : Math.min(max, cur + q);
  if (next <= 0 || next === cur) return ls;
  return ls.some(same) ? ls.map((l) => (same(l) ? { ...l, q: next } : l)) : [...ls, { sku, q: next, ...extra }];
};

function SimpleLines({ d, type, lines, set, from }: { d: Derived; type: OpType; lines: OpLine[]; set: SetLines; from?: Loc }) {
  if (!lines.length) return <Empty>لسه مفيش أصناف. اختار الموديل واللون والمقاس ودوس إضافة.</Empty>;
  return (
    <TableWrap><table className="text-sm"><thead><tr>
      <th className={th}>الصنف</th>{from && <th className={th}>المتاح في {LOC_AR[from]}</th>}
      <th className={th}>{type === 'FRC' ? 'رجع سليم' : 'الكمية'}</th>{type === 'FRC' && <th className={th}>مرفوض (هالك)</th>}{type === 'LOS' && <th className={th}>القرار</th>}{type === 'SRT' && <th className={th}>حالتها</th>}<th className={th} /></tr></thead>
      <tbody>{lines.map((l, i) => (
        <tr key={`${l.sku}|${l.to ?? ''}|${i}`}>
          <td className={td}>{skuLabel(d.skuMap, l.sku)}</td>
          {from && <td className={td + ' font-mono'}>{fmt(qty(d.snap.balances, l.sku, from))}</td>}
          {/* never more than the source state holds (for FRC the rejected pieces come out of the same total) */}
          <td className={td}><Stepper v={l.q} on={(q) => upd(set, i, { q })} min={type === 'FRC' ? 0 : 1} max={from ? Math.max(type === 'FRC' ? 0 : 1, qty(d.snap.balances, l.sku, from) - (type === 'FRC' ? l.rej ?? 0 : 0)) : undefined} label="الكمية" /></td>
          {type === 'FRC' && <td className={td}><Stepper v={l.rej ?? 0} on={(rej) => upd(set, i, { rej })} label="مرفوض" /></td>}
          {type === 'SRT' && <td className={td}><Seg value={(l.to as Loc) ?? 'READY'} onChange={(to) => upd(set, i, { to })} options={[['READY', 'سليم'], ['DIRTY', 'نضافة'], ['SCRAP', 'هالك']]} /></td>}
          {type === 'LOS' && <td className={td}><Seg value={l.res ?? 'FOUND'} onChange={(res) => upd(set, i, { res })} options={[['FOUND', 'لقيناه'], ['COMP', 'اتعوّض'], ['OFF', 'مفقود نهائي']]} /></td>}
          <td className={td}><Button size="sm" variant="ghost" aria-label="حذف" onClick={() => set((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button></td>
        </tr>))}</tbody></table></TableWrap>
  );
}

function SwapLines({ d, lines, set }: { d: Derived; lines: OpLine[]; set: SetLines }) {
  const models = useMemo(() => { const has = new Set(d.snap.skus.map((s) => s.model)); return d.modelOrder.filter((m) => has.has(m)); }, [d]);
  const [m, setM] = useState(models[0] ?? ''); const [c, setC] = useState(''); const [a, setA] = useState(''); const [b, setB] = useState(''); const [q, setQ] = useState(1);
  const ms = d.snap.skus.filter((s) => s.model === m);
  const colors = [...new Set(ms.map((s) => s.color))]; const color = colors.includes(c) ? c : colors[0] ?? '';
  const sizes = ms.filter((s) => s.color === color).map((s) => s.size);
  const from = sizes.includes(a) ? a : sizes[0] ?? ''; const toSizes = sizes.filter((z) => z !== from); const to = toSizes.includes(b) ? b : toSizes[0] ?? '';
  const id = (z: string) => ms.find((s) => s.color === color && s.size === z)?.id;
  const fromId = id(from), toId = id(to);
  const avail = fromId ? qty(d.snap.balances, fromId, 'READY') : 0;
  const add = () => { if (!fromId || !toId) return; set((ls) => { const k = ls.findIndex((l) => l.sku === fromId && l.to === toId); return k >= 0 ? ls.map((l, j) => (j === k ? { ...l, q: l.q + q } : l)) : [...ls, { sku: fromId, to: toId, q }]; }); setQ(1); };
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 rounded-xl border border-line bg-lav p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="الموديل"><select value={m} onChange={(e) => setM(e.target.value)}>{models.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
          <Field label="اللون"><select value={color} onChange={(e) => setC(e.target.value)}>{colors.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <Field label="من مقاس">
            <div className="flex flex-wrap gap-1.5">{sizes.map((z) => <Chip key={z} pressed={z === from} onClick={() => setA(z)}>{z}</Chip>)}</div>
          </Field>
          <span className="hidden size-9 place-items-center rounded-full bg-accent/10 text-accent sm:grid"><ArrowLeft className="size-4" /></span>
          <Field label="لمقاس">
            <div className="flex flex-wrap gap-1.5">{toSizes.map((z) => <Chip key={z} pressed={z === to} onClick={() => setB(z)}>{z}</Chip>)}</div>
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">الجاهز في <b className="font-mono text-ink">{from}</b>: <b className="font-mono text-ink">{fmt(avail)}</b>{toId && <> · في <b className="font-mono text-ink">{to}</b>: <b className="font-mono text-ink">{fmt(qty(d.snap.balances, toId, 'READY'))}</b></>}</p>
          <div className="flex items-center gap-2"><Stepper v={q} on={setQ} min={1} label="الكمية" /><Button variant="primary" onClick={add} disabled={!fromId || !toId}><Plus className="size-4" /> إضافة تبديل</Button></div>
        </div>
      </div>
      {!lines.length ? <Empty>لسه مفيش تبديل. اختار الموديل واللون والمقاسين ودوس إضافة.</Empty> : (
        <TableWrap><table className="text-sm"><thead><tr><th className={th}>من</th><th className={th} /><th className={th}>إلى</th><th className={th}>الكمية</th><th className={th} /></tr></thead>
          <tbody>{lines.map((l, i) => (
            <tr key={`${l.sku}>${l.to}`}>
              <td className={td}>{skuLabel(d.skuMap, l.sku)}</td><td className={td}><ArrowLeft className="size-4 text-accent" /></td>
              <td className={td}>{l.to ? skuLabel(d.skuMap, l.to) : '—'}</td>
              <td className={td}><Stepper v={l.q} on={(v) => upd(set, i, { q: v })} min={1} label="الكمية" /></td>
              <td className={td}><Button size="sm" variant="ghost" aria-label="حذف" onClick={() => set((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button></td>
            </tr>))}</tbody></table></TableWrap>)}
    </div>
  );
}

function ReturnLines({ d, hdr, setHdr, lines, set }: { d: Derived; hdr: OpHdr; setHdr: (h: OpHdr) => void; lines: OpLine[]; set: SetLines }) {
  const [code, setCode] = useState(''); const [msg, setMsg] = useState<{ tone: 'crit' | 'good'; t: string } | null>(null);
  const refs = hdr.refs ?? [];
  const lookup = () => {
    const codes = code.split(/[\s,،]+/).filter(Boolean); const added: string[] = []; const bad: string[] = [];
    const newRefs = [...refs]; let newLines = lines;
    for (const c of codes) {
      const o = findByCode(d.snap.orders, c);
      if (!o) { bad.push(`${c}: مش لاقيه`); continue; }
      if (o.status !== 'shipped') { bad.push(`${o.ref}: ${o.status === 'open' ? 'لسه ما اتشحنش' : 'ملغي'}`); continue; }
      if (o.returned) { bad.push(`${o.ref}: اتسجل له مرتجع (${o.returned.doc})`); continue; }
      if (newRefs.includes(o.ref)) continue;
      newRefs.push(o.ref); added.push(o.ref);
      for (const e of expectedReturn([o.lines])) {
        const k = newLines.findIndex((l) => l.sku === e.sku);
        newLines = k >= 0 ? newLines.map((l, j) => (j === k ? { ...l, exp: (l.exp ?? 0) + (e.exp ?? 0), r: (l.r ?? 0) + (e.exp ?? 0) } : l)) : [...newLines, e];
      }
    }
    setHdr({ ...hdr, refs: newRefs, counted: false }); set(() => newLines); setCode('');
    setMsg(bad.length ? { tone: 'crit', t: bad.join(' · ') } : added.length ? { tone: 'good', t: `اتضاف ${added.length} أوردر` } : null);
  };
  const removeRef = (ref: string) => {
    const o = d.orderMap.get(ref); if (!o) return;
    const exp = expectedReturn([o.lines]);
    set((ls) => ls.map((l) => { const e = exp.find((x) => x.sku === l.sku); if (!e) return l; const ne = Math.max(0, (l.exp ?? 0) - (e.exp ?? 0)); return { ...l, exp: ne, r: Math.min(l.r ?? 0, ne) }; }).filter((l) => (l.exp ?? 0) > 0 || (l.r ?? 0) + (l.d ?? 0) + (l.x ?? 0) > 0));
    setHdr({ ...hdr, refs: refs.filter((r) => r !== ref), counted: false });
  };
  return (
    <div className="grid gap-3">
      <div className="grid gap-2 rounded-xl border border-line bg-lav p-3">
        <Field label="البوليصة أو رقم الأوردر (تقدر تلصق أكتر من واحد)">
          <div className="flex gap-2"><input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && lookup()} placeholder="امسح أو اكتب البوليصة" className="flex-1" /><Button variant="primary" onClick={lookup} disabled={!code.trim()}><Search className="size-4" /> لاقي الأوردر</Button></div>
        </Field>
        {msg && <p className={cn('text-xs', msg.tone === 'crit' ? 'text-crit' : 'text-good')}>{msg.t}</p>}
        {refs.length > 0 && <div className="flex flex-wrap gap-1.5">{refs.map((r) => { const o = d.orderMap.get(r); return <span key={r} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs"><b className="font-mono">{r}</b>{o && <span className="text-muted">· {o.gov} · {o.lines.length} قطعة</span>}<button aria-label="شيل" onClick={() => removeRef(r)}><X className="size-3" /></button></span>; })}</div>}
      </div>
      <details className="rounded-xl border border-line p-3"><summary className="cursor-pointer text-sm font-semibold">جرد يدوي: إضافة صنف رجع من غير بوليصة</summary>
        <div className="mt-3"><VariantPicker d={d} onAdd={(s, q) => { set((ls) => (ls.some((l) => l.sku === s) ? ls.map((l) => (l.sku === s ? { ...l, r: (l.r ?? 0) + q } : l)) : [...ls, { sku: s, q: 0, exp: 0, r: q, d: 0, x: 0 }])); setHdr({ ...hdr, counted: false }); }} /></div></details>
      {!lines.length ? <Empty>دوّر بالبوليصة عشان تظهر القطع اللي اتشحنت، وعلّم كل قطعة رجعت إزاي.</Empty> : (
        <TableWrap><table className="text-sm"><thead><tr><th className={th}>الصنف</th><th className={th}>اتشحن</th><th className={th}>سليم</th><th className={th}>نضافة</th><th className={th}>هالك</th><th className={th}>الفرق</th></tr></thead>
          <tbody>{lines.map((l, i) => { const got = (l.r ?? 0) + (l.d ?? 0) + (l.x ?? 0); const diff = got - (l.exp ?? 0); return (
            <tr key={l.sku}><td className={td}>{skuLabel(d.skuMap, l.sku)}</td><td className={td + ' font-mono'}>{l.exp ?? 0}</td>
              <td className={td}><Stepper v={l.r ?? 0} on={(r) => { upd(set, i, { r }); setHdr({ ...hdr, counted: false }); }} label="سليم" /></td>
              <td className={td}><Stepper v={l.d ?? 0} on={(v) => { upd(set, i, { d: v }); setHdr({ ...hdr, counted: false }); }} label="نضافة" /></td>
              <td className={td}><Stepper v={l.x ?? 0} on={(x) => { upd(set, i, { x }); setHdr({ ...hdr, counted: false }); }} label="هالك" /></td>
              <td className={td}>{diff === 0 ? <Pill tone="good">مطابق</Pill> : diff < 0 ? <Pill tone="crit">ناقص {-diff}</Pill> : <Pill tone="warn">زيادة {diff}</Pill>}</td></tr>); })}</tbody></table></TableWrap>)}
      {lines.length > 0 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!hdr.counted} onChange={(e) => setHdr({ ...hdr, counted: e.target.checked })} /> خلّصت عدّ كل القطع وعلّمت حالتها</label>}
    </div>
  );
}

/** `focus`: items an alert asked to count; they get their own entry in the model list, chosen first */
const FOCUS = '__alert';
function CountSheet({ d, hdr, setHdr, focus }: { d: Derived; hdr: OpHdr; setHdr: (h: OpHdr) => void; focus?: string[] }) {
  const models = d.modelOrder; const fset = useMemo(() => new Set(focus ?? []), [focus]);
  const [model, setModel] = useState(fset.size ? FOCUS : models[0] ?? ''); const [q, setQ] = useState('');
  const state = hdr.state ?? 'READY'; const cnt = hdr.cnt ?? {}; const snap = hdr.snap ?? {};
  const skus = d.snap.skus.filter((s) => (model === FOCUS ? fset.has(s.id) : s.model === model) && (!q || `${s.color} ${s.size}`.includes(q)));
  const setCnt = (sku: string, v: string) => {
    const c = { ...cnt }; const s = { ...snap };
    if (v === '') delete c[sku]; else { c[sku] = Math.max(0, Math.floor(+v || 0)); if (!(sku in s)) s[sku] = qty(d.snap.balances, sku, state); }
    setHdr({ ...hdr, cnt: c, snap: s, reveal: false });
  };
  const counted = Object.keys(cnt).length;
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="الحالة اللي بتعدّها"><select value={state} disabled={counted > 0} onChange={(e) => setHdr({ ...hdr, state: e.target.value as Loc, cnt: {}, snap: {}, reveal: false })}>{LOCS.map((l) => <option key={l} value={l}>{LOC_AR[l]}</option>)}</select></Field>
        <Field label="الموديل"><select value={model} onChange={(e) => setModel(e.target.value)}>{fset.size > 0 && <option value={FOCUS}>أصناف التنبيه ({fset.size})</option>}{models.map((m) => <option key={m} value={m}>{m} · {d.modelMap.get(m)?.name}</option>)}</select></Field>
        <Field label="بحث باللون أو المقاس"><input value={q} onChange={(e) => setQ(e.target.value)} /></Field>
      </div>
      <Alert tone="info">العدّ أعمى: الرصيد اللي على السيستم مش بيظهر لحد ما تكشف الفروق. اتعدّ {fmt(counted)} صنف.</Alert>
      <TableWrap className="max-h-[480px]"><table className="text-sm"><thead><tr><th className={th}>الصنف</th><th className={th}>العدد الفعلي</th>{hdr.reveal && <><th className={th}>على السيستم</th><th className={th}>الفرق</th></>}</tr></thead>
        <tbody>{skus.map((s) => { const has = s.id in cnt; const now = qty(d.snap.balances, s.id, state); const diff = has ? cnt[s.id] - now : 0; return (
          <tr key={s.id} className={has ? 'bg-accent/5' : ''}><td className={td}>{model === FOCUS ? <span className="font-mono">{s.model} · </span> : null}{s.color} · {s.size}</td>
            <td className={td}><input type="number" min={0} value={has ? cnt[s.id] : ''} onChange={(e) => setCnt(s.id, e.target.value)} className="w-24" aria-label={`عدد ${s.color} ${s.size}`} /></td>
            {hdr.reveal && <><td className={td + ' font-mono'}>{fmt(now)}</td><td className={td}>{!has ? '—' : diff === 0 ? <Pill tone="good">مطابق</Pill> : diff < 0 ? <Pill tone="crit">عجز {-diff}</Pill> : <Pill tone="warn">زيادة {diff}</Pill>}</td></>}
          </tr>); })}</tbody></table></TableWrap>
      {counted > 0 && <Button onClick={() => setHdr({ ...hdr, reveal: !hdr.reveal })}>{hdr.reveal ? 'اخفي الفروق' : 'اكشف الفروق وراجعها'}</Button>}
      {hdr.reveal && Object.keys(snap).some((k) => snap[k] !== qty(d.snap.balances, k, state)) && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!hdr.ack} onChange={(e) => setHdr({ ...hdr, ack: e.target.checked })} /> موافق إن الفرق يتحسب على الرصيد الحالي</label>}
    </div>
  );
}

/* ------------------------------------------------------------------ operation form */
/**
 * The lines an alert opens an operation with: every listed item with all its pieces in the state the operation takes
 * them from (the lost pieces for LOS, the dirty ones for FSD). A count (CNT) gets no lines: the items are shown to be
 * counted, and nothing is counted for the person.
 */
function prefillLines(d: Derived, type: OpType, skus: string[]): OpLine[] {
  const loc: Loc | null = type === 'LOS' ? 'LOST' : type === 'FSD' ? 'DIRTY' : null;
  if (!loc) return [];
  return skus.map((sku) => ({ sku, q: qty(d.snap.balances, sku, loc), ...(type === 'LOS' ? { res: 'FOUND' as const } : {}) })).filter((l) => l.q > 0);
}

function OpForm({ d, type, draft, prefill, onDone, onBack, onOpen }: { d: Derived; type: OpType; draft?: OpDraft | null; /** items an alert sent, see prefillLines */ prefill?: string[]; onDone: (doc: string) => void; onBack: () => void; onOpen: (no: string) => void }) {
  const act = useAct(); const meta = OPS.find((o) => o.type === type)!; const I = ICON[type];
  const [hdr, setHdr] = useState<OpHdr>((draft?.hdr as OpHdr) ?? defaults(type));
  const [lines, setLinesState] = useState<OpLine[]>(() => (draft?.lines as unknown as OpLine[]) ?? (prefill?.length ? prefillLines(d, type, prefill) : []));
  const set: SetLines = (f) => setLinesState(f);
  const [date, setDate] = useState(draft?.date ?? d.today); const [photo, setPhoto] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  const [draftId, setDraftId] = useState(draft?.id);
  const from = SOURCE[type]?.(hdr);
  const name = (s: string) => skuLabel(d.skuMap, s);
  const r = buildOp(type, { ...hdr, hasPhoto: !!photo }, lines, d.snap.balances, date, d.today, name);
  const eff = effects(r.moves, d.snap.balances);
  const total = r.moves.reduce((a, m) => a + m.qty, 0) / (type === 'SWP' ? 2 : 1);
  const confirm = async () => {
    setBusy(true);
    const res = await act(() => repo.postOp({ type, date, hdr, lines, photo }), (x) => `اتأكدت ${x.doc} (${fmt(x.pieces)} قطعة)`);
    if (res && draftId) await repo.deleteDraft(draftId);
    setBusy(false); if (res) onDone(res.doc);
  };
  const saveDraft = async () => { const id = await act(() => repo.saveDraft({ id: draftId, type, date, hdr: hdr as Record<string, unknown>, lines: lines as unknown as Record<string, unknown>[] }), 'اتحفظت المسودة'); if (id) setDraftId(id); };
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="size-4 rotate-180" /> كل العمليات</Button>
        <span className={cn('grid size-9 place-items-center rounded-xl', GROUP_TONE[meta.grp])}><I className="size-4.5" /></span>
        <div><b className="text-lg">{meta.ar}</b><p className="text-xs text-muted">{meta.desc}</p></div>
        {draftId && <Pill tone="warn">مسودة</Pill>}
      </div>
      {!draft && prefill?.length ? <Alert tone="info">{type === 'CNT' ? `جاي من التنبيه: ${fmt(prefill.length)} صنف محتاج جرد، ظاهرين تحت في «أصناف التنبيه». اعدّهم واكشف الفروق قبل التأكيد.` : `جاي من التنبيه: اتملى ${fmt(lines.length)} صنف بكل قطعهم${type === 'LOS' ? '، والكل متعلّم «لقيناه». غيّر اللي اتشطب' : ''}. راجع الكميات قبل التأكيد.`}</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid content-start gap-4">
          <Card title="البيانات"><div className="grid gap-3 sm:grid-cols-3">
            <Field label="التاريخ"><input type="date" value={date} max={d.today} onChange={(e) => setDate(e.target.value)} /></Field>
            {type === 'RCV' && <>
              <Field label="رقم الإذن / الورقة"><input value={hdr.ref ?? ''} onChange={(e) => setHdr({ ...hdr, ref: e.target.value })} /></Field>
              <Field label="إجمالي القطع المكتوب في الورقة"><input type="number" min={0} value={hdr.declared ?? ''} onChange={(e) => setHdr({ ...hdr, declared: e.target.value === '' ? null : +e.target.value })} /></Field></>}
            {(type === 'SHP' || type === 'SRT') && <>
              <Field label="اسم المحل (إجباري)"><input list="shops" value={hdr.shop ?? ''} onChange={(e) => setHdr({ ...hdr, shop: e.target.value })} /><datalist id="shops">{(d.snap.shops ?? []).map((s) => <option key={s} value={s} />)}</datalist></Field>
              <Field label="ملاحظة"><input value={hdr.note ?? ''} onChange={(e) => setHdr({ ...hdr, note: e.target.value })} /></Field></>}
            {type === 'CLN' && <>
              <Field label="من حالة"><select value={hdr.from} onChange={(e) => { const v = e.target.value as Loc; setHdr({ ...hdr, from: v, to: v === hdr.to ? LOCS.find((l) => l !== v) : hdr.to }); }}>{LOCS.map((l) => <option key={l} value={l}>{LOC_AR[l]}</option>)}</select></Field>
              <Field label="إلى حالة"><select value={hdr.to} onChange={(e) => setHdr({ ...hdr, to: e.target.value as Loc })}>{LOCS.filter((l) => l !== hdr.from).map((l) => <option key={l} value={l}>{LOC_AR[l]}</option>)}</select></Field>
              <Field label="السبب" className="sm:col-span-3"><input value={hdr.reason ?? ''} onChange={(e) => setHdr({ ...hdr, reason: e.target.value })} placeholder="بقعة، خيط، غسيل..." /></Field></>}
            {type === 'FSD' && <div className="sm:col-span-2"><Field label="نوع الإرسال"><Seg value={hdr.kind ?? 'wash'} onChange={(kind) => { setHdr({ ...hdr, kind }); set(() => []); }} options={[['wash', 'غسيل (هيرجع)'], ['scrap', 'تسليم هالك']]} /></Field></div>}
          </div>
            {type === 'RCV' && <div className="mt-3"><PhotoInput file={photo} onChange={setPhoto} label="صورة الورقة الموقّعة من الطرفين" /></div>}
          </Card>
          {type === 'LOS' && <Card title="الأوردرات اللي فيها قطع مفقودة" hint="اضغط على القطعة الناقصة تختارها، ودوس تاني تشيلها">
            <LostOrders d={d} picked={Object.fromEntries(lines.map((l) => [l.sku, l.q]))}
              onToggle={(s, add) => set((l) => add ? addLine(l, s, 1, { res: 'FOUND' }, from ? qty(d.snap.balances, s, from) : undefined) : l.flatMap((x) => (x.sku !== s ? [x] : x.q > 1 ? [{ ...x, q: x.q - 1 }] : [])))} />
          </Card>}
          <Card title={type === 'RTN' ? 'المرتجعات بالبوليصة' : type === 'CNT' ? 'ورقة الجرد' : type === 'SWP' ? 'التبديلات' : 'الأصناف'}>
            {type === 'RTN' ? <ReturnLines d={d} hdr={hdr} setHdr={setHdr} lines={lines} set={set} />
              : type === 'CNT' ? <CountSheet d={d} hdr={hdr} setHdr={setHdr} focus={prefill} />
              : type === 'SWP' ? <SwapLines d={d} lines={lines} set={set} />
              : <div className="grid gap-3"><VariantPicker d={d} from={from} onAdd={(s, q) => set((l) => addLine(l, s, q, type === 'LOS' ? { res: 'FOUND' } : type === 'FRC' ? { rej: 0 } : type === 'SRT' ? { to: 'READY' } : {}, from ? qty(d.snap.balances, s, from) : undefined))} /><SimpleLines d={d} type={type} lines={lines} set={set} from={from} /></div>}
          </Card>
        </div>
        <div className="grid h-fit gap-4 lg:sticky lg:top-4">
          <Card title="الأثر على المخزون" hint="اللي هيتغيّر بعد التأكيد">
            {!eff.length ? <p className="text-sm text-muted">مفيش تغيير لسه.</p> : (
              <div className="grid max-h-64 gap-2 overflow-auto text-sm">{eff.map((e) => (
                <div key={e.sku} className="rounded-lg border border-line p-2"><b className="text-xs">{name(e.sku)}</b>
                  {e.ch.map((c) => <div key={c.loc} className="flex items-center justify-between text-xs"><span className="text-muted">{LOC_AR[c.loc]}</span><span className="font-mono">{fmt(c.now)} ← <b className={c.after < 0 ? 'text-crit' : c.after > c.now ? 'text-good' : 'text-warn'}>{fmt(c.after)}</b></span></div>)}
                </div>))}</div>)}
            {type === 'SHP' || type === 'SRT' || type === 'RCV' || type === 'RTN' ? <p className="mt-2 text-xs text-muted">إجمالي {fmt(total)} قطعة</p> : null}
          </Card>
          <Card title="قبل التأكيد">
            <div className="grid gap-1.5 text-sm">{r.checks.map((c) => <div key={c.t} className="flex items-start gap-2"><span className={c.ok ? 'text-good' : 'text-crit'}>{c.ok ? '✓' : '●'}</span><span>{c.t}</span></div>)}</div>
            {r.err.map((e) => <Alert key={e} tone="crit" className="mt-2">{e}</Alert>)}
            {r.warn.map((w) => <Alert key={w} tone="warn" className="mt-2">{w}</Alert>)}
            <Button variant="primary" className="mt-4 w-full" disabled={!r.ok || busy} onClick={confirm}>تأكيد وتسجيل {fmt(total)} قطعة</Button>
            <Button className="mt-2 w-full" onClick={saveDraft} disabled={busy}><Save className="size-4" /> حفظ كمسودة</Button>
          </Card>
        </div>
      </div>
      <OpHistory d={d} type={type} label={meta.ar} onOpen={onOpen} />
    </div>
  );
}

/* ------------------------------------------------------------------ doc details, delivery note */
function ShopActions({ d, doc }: { d: Derived; doc: Doc }) {
  const act = useAct(); const [photo, setPhoto] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-3 rounded-xl border border-line bg-lav p-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => printDeliveryNote(doc, d.skuMap, d.modelMap)}><Printer className="size-4" /> طباعة</Button>
        <Button onClick={() => act(() => downloadDeliveryNote(doc, d.skuMap, 'pdf', d.modelMap), 'تم تجهيز PDF')}><Download className="size-4" />PDF</Button>
        <Button onClick={() => act(() => downloadDeliveryNote(doc, d.skuMap, 'png', d.modelMap), 'تم تجهيز الصورة')}><Download className="size-4" />PNG</Button>
        <Button onClick={() => act(() => deliveryNoteExcel(doc, d.skuMap, d.modelMap).then(() => true), 'تم تجهيز Excel')}><Download className="size-4" /> Excel</Button>
      </div>
      {doc.type === 'SHP' && !doc.hdr.delivered && doc.status === 'done' && <>
        <Alert tone="warn">صورة الإذن الموقّع من الطرفين إجبارية لتأكيد التسليم، وبعد التأكيد مش بتتغيّر.</Alert>
        <PhotoInput file={photo} onChange={setPhoto} label="صورة الإذن الموقّع" />
        <Button variant="primary" disabled={!photo || busy} onClick={async () => { setBusy(true); await act(() => repo.confirmShopDelivery(doc.no, photo!), 'اتأكد التسليم للمحل'); setBusy(false); }}><Truck className="size-4" /> تأكيد التسليم للمحل</Button></>}
    </div>
  );
}

function Docs({ d, onOpen }: { d: Derived; onOpen: (no: string) => void }) {
  const [t, setT] = useState('all'); const [q, setQ] = useState('');
  const types = [...new Set(d.snap.docs.map((x) => x.type))];
  const docs = [...d.snap.docs].reverse().filter((x) => (t === 'all' || x.type === t) && (!q || `${x.no} ${x.by} ${x.hdr.shop ?? ''} ${x.hdr.ref ?? ''} ${(x.hdr.refs as string[] | undefined)?.join(' ') ?? ''}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative"><Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="رقم، محل، أوردر، شخص" className="ps-8" /></div>
        <Chip pressed={t === 'all'} onClick={() => setT('all')}>الكل</Chip>{types.map((x) => <Chip key={x} pressed={t === x} onClick={() => setT(x)}>{TYPE_AR[x] ?? x}</Chip>)}
      </div>
      {!docs.length ? <Card><Empty>مفيش عمليات مطابقة.</Empty></Card> : (
        <TableWrap><table className="text-sm"><thead><tr><th className={th}>الرقم</th><th className={th}>النوع</th><th className={th}>التاريخ</th><th className={th}>بواسطة</th><th className={th}>القطع</th><th className={th}>الحالة</th></tr></thead>
          <tbody>{docs.map((x) => { const I = ICON[x.type] ?? FileText; return (
            <tr key={x.no} className="cursor-pointer hover:bg-lav" onClick={() => onOpen(x.no)}>
              <td className={td + ' font-mono font-semibold'}>{x.no}</td><td className={td}><span className="inline-flex items-center gap-1.5"><I className="size-4 text-muted" />{TYPE_AR[x.type] ?? x.type}</span></td>
              <td className={td}>{x.date}</td><td className={td}>{x.by}</td><td className={td + ' font-mono'}>{fmt(Number(x.hdr.pieces ?? x.lines.reduce((a, l) => a + l.qty, 0)))}</td>
              <td className={td}>{x.status !== 'done' ? <Pill>معكوس</Pill> : x.type === 'SHP' && !x.hdr.delivered ? <Pill tone="warn">مستني التسليم</Pill> : <Pill tone="good">مؤكد</Pill>}</td></tr>); })}</tbody></table></TableWrap>)}
    </div>
  );
}

function Shops({ d, onOpen }: { d: Derived; onOpen: (no: string) => void }) {
  const [shop, setShop] = useState('all'); const [st, setSt] = useState<'all' | 'pending' | 'done' | 'ret'>('all');
  const all = d.snap.docs.filter((x) => x.type === 'SHP' && x.status === 'done');
  const rets = d.snap.docs.filter((x) => x.type === 'SRT' && x.status === 'done');
  const rows = [...all, ...rets].sort((a, b) => (b.date + b.no).localeCompare(a.date + a.no)).filter((x) => (shop === 'all' || x.hdr.shop === shop) && (st === 'all' || (x.type === 'SHP' && (st === 'done') === !!x.hdr.delivered) || (x.type === 'SRT' && st === 'ret')));
  const shops = [...new Set([...all, ...rets].map((x) => String(x.hdr.shop)))];
  const pcs = (x: Doc) => x.lines.reduce((a, l) => a + l.qty, 0);
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <Card><p className="text-xs text-muted">توريدات</p><b className="num text-2xl">{fmt(all.length)}</b></Card>
        <Card><p className="text-xs text-muted">قطع اتوردت</p><b className="num text-2xl">{fmt(all.reduce((a, x) => a + pcs(x), 0))}</b></Card>
        <Card><p className="text-xs text-muted">رجع من المحل</p><b className="num text-2xl">{fmt(rets.reduce((a, x) => a + pcs(x), 0))}</b></Card>
        <Card><p className="text-xs text-muted">مستني تأكيد التسليم</p><b className="num text-2xl text-warn">{fmt(all.filter((x) => !x.hdr.delivered).length)}</b></Card>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={shop} onChange={(e) => setShop(e.target.value)} className="w-auto"><option value="all">كل المحلات</option>{shops.map((s) => <option key={s}>{s}</option>)}</select>
        <Seg value={st} onChange={setSt} options={[['all', 'الكل'], ['pending', 'مستني التسليم'], ['done', 'اتسلم'], ['ret', 'مرتجع']]} />
      </div>
      {!rows.length ? <Card><Empty>مفيش توريدات للمحل لسه. ابدأ من «توريد للمحل».</Empty></Card> : (
        <TableWrap><table className="text-sm"><thead><tr><th className={th}>الإذن</th><th className={th}>المحل</th><th className={th}>التاريخ</th><th className={th}>القطع</th><th className={th}>الحالة</th><th className={th} /></tr></thead>
          <tbody>{rows.map((x) => (
            <tr key={x.no}><td className={td + ' font-mono font-semibold'}>{x.no}</td><td className={td}>{String(x.hdr.shop)}</td><td className={td}>{x.date}</td><td className={td + ' font-mono'}>{fmt(pcs(x))}</td>
              <td className={td}>{x.type === 'SRT' ? <Pill tone="info">مرتجع من المحل</Pill> : x.hdr.delivered ? <Pill tone="good">اتسلم</Pill> : <Pill tone="warn">مستني التسليم</Pill>}</td>
              <td className={td}><div className="flex gap-1"><Button size="sm" variant="ghost" aria-label="طباعة الإذن" onClick={() => printDeliveryNote(x, d.skuMap, d.modelMap)}><Printer className="size-4" /></Button><Button size="sm" onClick={() => onOpen(x.no)}>{x.type === 'SRT' || x.hdr.delivered ? 'تفاصيل' : 'تأكيد التسليم'}</Button></div></td></tr>))}</tbody></table></TableWrap>)}
    </div>
  );
}

/* ------------------------------------------------------------------ page */
export default function Operations() {
  const { d, isLoading, error } = useDerived();
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get('tab') ?? 'new') as 'new' | 'docs' | 'shops' | 'holds';
  const op = sp.get('op') as OpType | null; const draftId = sp.get('draft'); const open = sp.get('doc'); const skusP = sp.get('skus') ?? '';
  // leaving the form (or picking another operation) drops the items an alert sent with it
  const go = (p: Record<string, string | null>) => { const n = new URLSearchParams(sp); if ('op' in p) n.delete('skus'); for (const k in p) { const v = p[k]; if (v == null) n.delete(k); else n.set(k, v); } setSp(n); };
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !d) return <Spinner />;
  const draft = draftId ? (d.snap.drafts ?? []).find((x) => x.id === draftId) ?? null : null;
  // only items that exist (an old or hand-made address can hold anything)
  const known = new Set([...d.snap.skus, ...(d.snap.archivedSkus ?? [])].map((s) => s.id));
  const prefill = skusP ? [...new Set(skusP.split(','))].filter((s) => known.has(s)) : [];
  const openDoc = open ? d.snap.docs.find((x) => x.no === open) : undefined;
  const openHolds = (d.snap.holds ?? []).filter((h) => h.status === 'open').length;
  const pendingShop = d.snap.docs.filter((x) => x.type === 'SHP' && x.status === 'done' && !x.hdr.delivered).length;
  return (
    <>
      <PageHead title="العمليات" sub="قلب التشغيل: كل حركة بتغيّر المخزون بتتسجل هنا بفحوص قبل التأكيد. الشحن بالإسكان من صفحة الأوردرات." />
      <Tabs value={tab} onChange={(t) => go({ tab: t === 'new' ? null : t, op: null, draft: null, new: null })} tabs={[['new', 'عملية جديدة'], ['docs', `آخر العمليات (${d.snap.docs.length})`], ['shops', `توريدات المحل${pendingShop ? ` · ${pendingShop}` : ''}`], ['holds', `هولد${openHolds ? ` · ${openHolds}` : ''}`]]} />
      {tab === 'new' && (op && OPS.some((o) => o.type === op)
        ? <OpForm key={`${op}-${draftId ?? ''}-${skusP}`} d={d} type={op} draft={draft} prefill={prefill} onBack={() => go({ op: null, draft: null })} onDone={(no) => go({ op: null, draft: null, ...(op === 'SHP' ? { tab: 'shops', doc: no } : {}) })} onOpen={(no) => go({ doc: no })} />
        : <Launcher d={d} onPick={(t) => go({ op: t, draft: null })} onDraft={(x) => go({ op: x.type, draft: x.id })} onHold={() => go({ tab: 'holds', new: 'yes' })} />)}
      {tab === 'docs' && <Docs d={d} onOpen={(no) => go({ doc: no })} />}
      {tab === 'holds' && <Holds d={d} openNew={sp.get('new') === 'yes'} onOpenNew={(v) => go({ new: v ? 'yes' : null })} />}
      {tab === 'shops' && <Shops d={d} onOpen={(no) => go({ doc: no })} />}
      {openDoc && <DocDetails key={openDoc.no} d={d} doc={openDoc} onClose={() => go({ doc: null })} onOpen={(no) => go({ doc: no })}
        actions={(openDoc.type === 'SHP' || openDoc.type === 'SRT') && <ShopActions d={d} doc={openDoc} />} />}
    </>
  );
}
