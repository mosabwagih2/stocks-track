import { useMemo, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Derived } from '@/femini/hooks/data';
import type { Doc } from '@/femini/domain/types';
import { LOC_AR, TYPE_AR, channelName } from '@/femini/domain/constants';
import { DocLog } from './DocLog';
import { flowText } from '@/femini/domain/docLog';
import { Thumb } from './Thumb';
import { Photo } from './shared';
import { Alert, Pill, Sheet } from './ui';
import { cn, fmt } from '@/femini/cn';

interface Piece { sku: string; qty: number; from: string; to: string }
const loc = (l: string) => LOC_AR[l] ?? (l || '—');

/** What one operation moved: from its ledger rows, else what it kept in its header, else its lines. */
function piecesOf(d: Derived, doc: Doc): Piece[] {
  const rows = d.snap.moves.filter((m) => m.doc === doc.no);
  if (rows.length) return rows.map((m) => ({ sku: m.sku, qty: m.qty, from: m.from, to: m.to }));
  const kept = doc.hdr.moves as Piece[] | undefined;
  return kept?.length ? kept : doc.lines.map((l) => ({ ...l, from: '', to: '' }));
}

/** The facts worth reading first for this kind of operation. */
function facts(d: Derived, doc: Doc, pieces: number, varieties: number): [string, ReactNode][] {
  const h = doc.hdr; const s = (k: string) => (h[k] == null || h[k] === '' ? null : String(h[k]));
  const list = (k: string) => (Array.isArray(h[k]) ? (h[k] as unknown[]).length : 0);
  const out: [string, ReactNode][] = [['التاريخ', <span className="num">{doc.date}</span>], ['سجّلها', doc.by || '—'], ['القطع', <b className="num">{fmt(pieces)}</b>], ['الأصناف', <span className="num">{fmt(varieties)}</span>]];
  if (s('shop')) out.push(['المحل', s('shop')]);
  if (doc.type === 'SHP') out.push(['التسليم', h.delivered ? <Pill tone="good">اتسلم للمحل</Pill> : <Pill tone="warn">مستني صورة الإذن</Pill>]);
  if (s('ref')) out.push(['رقم الإذن', <span className="num">{s('ref')}</span>]);
  if (h.declared != null && h.declared !== '') out.push(['المكتوب في الورقة', <span className={cn('num', Number(h.declared) !== pieces && 'font-semibold text-warn')}>{fmt(Number(h.declared))}{Number(h.declared) !== pieces ? ` (فرق ${fmt(pieces - Number(h.declared))})` : ''}</span>]);
  if (s('channel')) out.push(['القناة', channelName(s('channel')!)]);
  if (doc.type === 'RTN' && list('refs')) out.push(['البوالص', <span className="num">{fmt(list('refs'))}</span>]);
  if (doc.type === 'SCN' && list('refs')) out.push(['الأوردرات', <span className="num">{fmt(list('refs'))}</span>]);
  if (s('emp')) out.push(['الموظف', s('emp')]);
  if (doc.type === 'FSD') out.push(['نوع الإرسال', h.kind === 'scrap' ? 'تسليم هالك' : 'غسيل (هيرجع)']);
  if (s('reason')) out.push(['السبب', s('reason')]);
  if (s('note')) out.push(['ملاحظة', s('note')]);
  return out;
}

const order = (have: Set<string>, all: string[]) => [...have].sort((a, b) => (all.indexOf(a) + 1 || 99) - (all.indexOf(b) + 1 || 99) || a.localeCompare(b));

/** colours down, sizes across, the count in each cell: how a clothes order is read */
function Grid({ m, sizes }: { m: { cells: Map<string, number>; colors: Set<string> }; sizes: string[] }) {
  const colors = [...m.colors].sort((a, b) => sizes.reduce((x, z) => x + (m.cells.get(`${b}|${z}`) ?? 0), 0) - sizes.reduce((x, z) => x + (m.cells.get(`${a}|${z}`) ?? 0), 0));
  const row = (c: string) => sizes.reduce((x, z) => x + (m.cells.get(`${c}|${z}`) ?? 0), 0);
  // a CSS grid, not a <table>: the app's table styles (full width, sticky heads) don't fit a small matrix
  return <div className="overflow-x-auto"><div role="table" aria-label="الألوان والمقاسات" className="inline-grid items-center gap-1 text-xs" style={{ gridTemplateColumns: `auto repeat(${sizes.length}, 2.75rem) auto` }}>
    <span role="columnheader" className="pe-3 text-muted">اللون</span>{sizes.map((z) => <span key={z} role="columnheader" className="num text-center font-semibold text-muted">{z}</span>)}<span role="columnheader" className="ps-3 text-center text-muted">الإجمالي</span>
    {colors.map((c) => <div key={c} role="row" className="contents">
      <span role="rowheader" className="whitespace-nowrap pe-3 font-medium">{c}</span>
      {sizes.map((z) => { const v = m.cells.get(`${c}|${z}`) ?? 0; return <span key={z} role="cell" className={cn('num grid h-7 place-items-center rounded-md', v ? 'bg-accent-soft font-semibold text-ink' : 'text-muted/50')}>{v || '·'}</span>; })}
      <span role="cell" className="num ps-3 text-center font-semibold">{fmt(row(c))}</span>
    </div>)}
  </div></div>;
}

export function DocDetails({ d, doc, onClose, onOpen, actions }: { d: Derived; doc: Doc; onClose: () => void; onOpen: (no: string) => void; actions?: ReactNode }) {
  const pieces = useMemo(() => piecesOf(d, doc), [d, doc]);
  const total = pieces.reduce((a, p) => a + p.qty, 0) / (doc.type === 'SWP' ? 2 : 1);
  // the flow: how many pieces went from where to where
  const flows = useMemo(() => {
    const m = new Map<string, number>(); for (const p of pieces) m.set(`${p.from}>${p.to}`, (m.get(`${p.from}>${p.to}`) ?? 0) + p.qty);
    return [...m].map(([k, q]) => { const [from, to] = k.split('>'); return { from, to, q }; }).filter((f) => f.from || f.to);
  }, [pieces]);
  // the pieces by model, then colour · size
  const models = useMemo(() => {
    const by = new Map<string, { code: string; total: number; items: Map<string, number>; cells: Map<string, number>; colors: Set<string>; sizes: Set<string> }>();
    for (const p of pieces) {
      const k = d.skuMap.get(p.sku); const code = k?.model ?? p.sku;
      const g = by.get(code) ?? { code, total: 0, items: new Map(), cells: new Map(), colors: new Set<string>(), sizes: new Set<string>() };
      if (k) { g.colors.add(k.color); g.sizes.add(k.size); g.cells.set(`${k.color}|${k.size}`, (g.cells.get(`${k.color}|${k.size}`) ?? 0) + p.qty); }
      const label = (k ? `${k.color} · ${k.size}` : p.sku) + (flows.length > 1 && p.to ? ` → ${loc(p.to)}` : '');
      g.total += p.qty; g.items.set(label, (g.items.get(label) ?? 0) + p.qty); by.set(code, g);
    }
    return [...by.values()].sort((a, b) => b.total - a.total);
  }, [pieces, d.skuMap, flows.length]);
  const reversed = doc.status === 'reversed';
  return (
    <Sheet onClose={onClose} wide title={<span className="flex flex-wrap items-center gap-2">{TYPE_AR[doc.type] ?? doc.type}<span className="num text-base font-normal text-muted">{doc.no}</span>{reversed ? <Pill>معكوسة</Pill> : <Pill tone="good">مؤكدة</Pill>}</span>}>
      {reversed && <Alert>العملية دي اتعكست: القطع رجعت مكانها. التفاصيل في السجل تحت.</Alert>}

      <section aria-label="الملخص" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {facts(d, doc, total, new Set(pieces.map((p) => p.sku)).size).map(([k, v]) => (
          <div key={k} className="grid content-start gap-1 rounded-xl border border-line bg-surface px-3.5 py-2.5"><span className="text-xs text-muted">{k}</span><span className="min-w-0 break-words text-sm text-ink">{v}</span></div>
        ))}
      </section>

      {flows.length > 0 && flowText(pieces) !== '' && <section aria-label="حركة المخزون" className="grid gap-2">
        <h3 className="text-sm font-semibold">حركة المخزون</h3>
        <div className="flex flex-wrap gap-2">{flows.map((f) => (
          <span key={f.from + f.to} className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
            <span>{loc(f.from)}</span><ArrowLeft className="size-4 text-muted" /><span>{loc(f.to)}</span><b className="num ms-1 rounded-md bg-lav px-1.5">{fmt(f.q)}</b>
          </span>))}</div>
      </section>}

      <section aria-label="القطع" className="grid gap-2">
        <h3 className="text-sm font-semibold">القطع <span className="font-normal text-muted">· {fmt(models.length)} {models.length > 2 && models.length <= 10 ? 'موديلات' : 'موديل'}</span></h3>
        <div className="grid gap-2">{models.map((m) => (
          <div key={m.code} className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
            <Thumb model={d.modelMap.get(m.code)} size={48} className="shrink-0" />
            <div className="grid min-w-0 flex-1 gap-2">
              <div className="flex items-baseline justify-between gap-2"><b className="truncate text-sm">{d.modelMap.get(m.code)?.name || m.code} <span className="num font-normal text-muted">{m.code}</span></b><b className="num shrink-0 text-sm">{fmt(m.total)} قطعة</b></div>
              {flows.length > 1 || !m.cells.size ? <div className="flex flex-wrap gap-1.5">{[...m.items].map(([label, q]) => (
                <span key={label} className="inline-flex items-center gap-1 rounded-lg bg-lav px-2 py-1 text-xs">{label}<b className="num">×{fmt(q)}</b></span>))}</div>
                : <Grid m={m} sizes={order(m.sizes, d.snap.sizes)} />}
            </div>
          </div>))}</div>
      </section>

      {doc.attachment && <section aria-label="المرفق" className="grid gap-2"><h3 className="text-sm font-semibold">المرفق</h3><Photo path={doc.attachment} className="max-h-96 w-full rounded-2xl border border-line object-contain" /></section>}
      {actions}

      <section aria-label="السجل" className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
        <h3 className="text-sm font-semibold">السجل</h3>
        <DocLog d={d} doc={doc} onOpen={onOpen} />
      </section>
    </Sheet>
  );
}
