import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { addMonths, canStepForward, describeRange, monthGrid, presets, sameRange, shiftRange, type Range } from '@/femini/domain/range';
import { cn } from '@/femini/cn';

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2026, i, 1)).toLocaleDateString('ar-EG-u-nu-latn', { month: 'long', timeZone: 'UTC' }));
const WEEK = ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'];   // Saturday first, like the Egyptian work week

/**
 * The analytics period. One control: the window's name in the middle (opens the picker), older on the right and
 * newer on the left (Arabic reads right to left, so time runs that way too). The picker has the ready-made windows
 * and a calendar: tap the first day, then the last.
 */
export function PeriodPicker({ value, today, onChange }: { value: Range; today: string; onChange: (r: Range) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null); const panel = useRef<HTMLDivElement>(null);
  // The panel goes to <body> at the control's place: the page head is animated (a transform), which would trap it
  // under the sticky section tabs.
  const [at, setAt] = useState<{ top: number; left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = box.current?.getBoundingClientRect(); if (!r) return;
      const vw = document.documentElement.clientWidth;   // without the scrollbar
      const width = Math.min(560, vw - 16);
      // its left edge on the control's left edge (the end side in Arabic), kept on the screen
      setAt({ top: r.bottom + 8, left: Math.max(8, Math.min(r.left, vw - width - 8)), width });
    };
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);
  const { title, days } = describeRange(value, today);
  const fwd = canStepForward(value, today);
  const older = shiftRange(value, -1, today), newer = shiftRange(value, 1, today);

  useEffect(() => {
    if (!open) return;
    const out = (e: PointerEvent) => { const t = e.target as Node; if (!box.current?.contains(t) && !panel.current?.contains(t)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', out); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', out); document.removeEventListener('keydown', esc); };
  }, [open]);

  const pick = (r: Range) => { onChange(r); setOpen(false); };
  const step = 'grid w-10 shrink-0 place-items-center text-muted transition hover:bg-lav hover:text-ink disabled:pointer-events-none disabled:opacity-30';

  return (
    <div ref={box} className="flex items-center gap-2">
      <div role="group" aria-label="الفترة" className="flex h-10 items-stretch overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <button type="button" className={cn(step, 'border-e border-line')} onClick={() => onChange(older)}
          aria-label={`الفترة اللي قبلها: ${describeRange(older, today).title}`} title={describeRange(older, today).title}><ChevronRight className="size-4" /></button>
        <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 items-center gap-2 px-3 text-sm transition hover:bg-lav">
          <CalendarDays className="size-4 shrink-0 text-accent" />
          <b className="truncate font-semibold text-ink">{title}</b>
          <span className="shrink-0 text-xs text-muted max-sm:hidden">{days}</span>
          <ChevronDown className={cn('size-4 shrink-0 text-muted transition', open && 'rotate-180')} />
        </button>
        <button type="button" className={cn(step, 'border-s border-line')} disabled={!fwd} onClick={() => onChange(newer)}
          aria-label={fwd ? `الفترة اللي بعدها: ${describeRange(newer, today).title}` : 'مفيش أيام بعد النهارده'} title={fwd ? describeRange(newer, today).title : undefined}><ChevronLeft className="size-4" /></button>
      </div>
      {fwd && <button type="button" className="h-10 rounded-xl px-3 text-sm font-medium text-accent transition hover:bg-lav" onClick={() => onChange(presets(today)[0].range)}>النهارده</button>}
      {open && at && createPortal(<div ref={panel} dir="rtl" className="fixed z-50" style={at}><Panel value={value} today={today} onPick={pick} /></div>, document.body)}
    </div>
  );
}

function Panel({ value, today, onPick, onAll, all }: { value: Range; today: string; onPick: (r: Range) => void; /** a filter may also be «كل التواريخ» (no limit) */ onAll?: () => void; all?: boolean }) {
  const [month, setMonth] = useState(value.to);
  const [anchor, setAnchor] = useState<string | null>(null);   // the first day tapped, waiting for the last
  const [hover, setHover] = useState<string | null>(null);
  const shown: Range = anchor ? (hover && hover < anchor ? { from: hover, to: anchor } : { from: anchor, to: hover ?? anchor }) : value;
  const tap = (day: string) => {
    if (!anchor) { setAnchor(day); return; }
    onPick(day < anchor ? { from: day, to: anchor } : { from: anchor, to: day });
  };
  const canNextMonth = addMonths(month, 1) <= today;
  // the month and the year are picked from lists: any month of the last years in two taps, never past today
  const years = Array.from({ length: 6 }, (_, i) => String(Number(today.slice(0, 4)) - 5 + i));
  const setYM = (y: string, m: string) => { let v = `${y}-${m}-01`; if (v.slice(0, 7) > today.slice(0, 7)) v = `${today.slice(0, 7)}-01`; setMonth(v); };
  const sel = '!h-8 !w-auto !rounded-lg !py-0 !ps-2 !pe-7 text-sm font-semibold';
  return (
    <div role="dialog" aria-label="اختيار الفترة" className="grid max-h-[calc(100vh-120px)] overflow-y-auto rounded-2xl border border-line bg-surface shadow-pop sm:grid-cols-[168px_1fr]">
      <ul className="grid content-start gap-0.5 border-line p-2 max-sm:grid-cols-2 max-sm:border-b sm:border-e">
        {onAll && <li><button type="button" aria-pressed={!!all} onClick={onAll} className={cn('w-full rounded-lg px-3 py-2 text-start text-sm transition', all ? 'bg-accent text-on-accent' : 'text-ink hover:bg-lav')}>كل التواريخ</button></li>}
        {presets(today).map((p) => {
          const on = !all && sameRange(p.range, value);
          return <li key={p.id}><button type="button" aria-pressed={on} onClick={() => onPick(p.range)}
            className={cn('w-full rounded-lg px-3 py-2 text-start text-sm transition', on ? 'bg-accent text-on-accent' : 'text-ink hover:bg-lav')}>{p.label}</button></li>;
        })}
      </ul>
      <div className="p-3" onPointerLeave={() => setHover(null)}>
        <div className="mb-2 flex items-center justify-between">
          <button type="button" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-lav hover:text-ink" aria-label="الشهر اللي قبله" onClick={() => setMonth(addMonths(month, -1))}><ChevronRight className="size-4" /></button>
          <span className="flex items-center gap-1.5">
            <select aria-label="الشهر" className={sel} value={month.slice(5, 7)} onChange={(e) => setYM(month.slice(0, 4), e.target.value)}>
              {MONTHS.map((n, i) => { const mm = String(i + 1).padStart(2, '0'); return <option key={mm} value={mm} disabled={`${month.slice(0, 4)}-${mm}` > today.slice(0, 7)}>{n}</option>; })}
            </select>
            <select aria-label="السنة" className={sel} value={month.slice(0, 4)} onChange={(e) => setYM(e.target.value, month.slice(5, 7))}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
          </span>
          <button type="button" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-lav hover:text-ink disabled:opacity-30" aria-label="الشهر اللي بعده" disabled={!canNextMonth} onClick={() => setMonth(addMonths(month, 1))}><ChevronLeft className="size-4" /></button>
        </div>
        <table className="w-full border-collapse text-center text-sm">
          <thead><tr>{WEEK.map((w) => <th key={w} className="pb-1 text-xs font-medium text-muted">{w}</th>)}</tr></thead>
          <tbody>{monthGrid(month).map((week, i) => (
            <tr key={i}>{week.map((day, j) => {
              if (!day) return <td key={j} />;
              const inside = day >= shown.from && day <= shown.to; const edge = day === shown.from || day === shown.to;
              const future = day > today;
              return <td key={j} className={cn('p-0', inside && !edge && 'bg-accent/12', day === shown.from && 'rounded-s-lg bg-accent/12', day === shown.to && 'rounded-e-lg bg-accent/12')}>
                <button type="button" disabled={future} onClick={() => tap(day)} onPointerEnter={() => anchor && setHover(day)}
                  aria-label={day} aria-pressed={edge}
                  className={cn('num mx-auto grid size-9 place-items-center rounded-lg transition disabled:text-muted/40',
                    edge ? 'bg-accent font-semibold text-on-accent' : 'hover:bg-lav', day === today && !edge && 'font-bold text-accent')}>
                  {Number(day.slice(8))}
                </button>
              </td>;
            })}</tr>))}</tbody>
        </table>
        <p className="mt-2 text-xs text-muted">{anchor ? 'دوس على آخر يوم في الفترة (أو نفس اليوم ليوم واحد).' : 'دوس على أول يوم في الفترة، وبعدين آخر يوم.'}</p>
      </div>
    </div>
  );
}

/**
 * A date filter for a list (files, the ledger): «كل التواريخ» or a period, picked from the same panel as the analytics:
 * ready-made periods, the month and year from lists, and a calendar to tap the first and the last day.
 */
export function DateFilter({ value, today, onChange }: { value: Range | null; today: string; onChange: (r: Range | null) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null); const panel = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = box.current?.getBoundingClientRect(); if (!r) return;
      const vw = document.documentElement.clientWidth; const width = Math.min(560, vw - 16);
      setAt({ top: r.bottom + 8, left: Math.max(8, Math.min(r.left, vw - width - 8)), width });
    };
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const out = (e: PointerEvent) => { const t = e.target as Node; if (!box.current?.contains(t) && !panel.current?.contains(t)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', out); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', out); document.removeEventListener('keydown', esc); };
  }, [open]);
  const title = value ? describeRange(value, today).title : 'كل التواريخ';
  return (
    <div ref={box} className="inline-flex items-center gap-1.5">
      <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm shadow-card transition hover:bg-lav">
        <CalendarDays className="size-4 shrink-0 text-accent" /><b className="truncate font-semibold">{title}</b>
        {value && <span className="num text-xs text-muted max-sm:hidden">{describeRange(value, today).days}</span>}
        <ChevronDown className={cn('size-4 shrink-0 text-muted transition', open && 'rotate-180')} />
      </button>
      {value && <button type="button" aria-label="مسح فلتر التاريخ" title="كل التواريخ" className="grid size-9 place-items-center rounded-xl text-muted transition hover:bg-lav hover:text-ink" onClick={() => onChange(null)}><X className="size-4" /></button>}
      {open && at && createPortal(<div ref={panel} dir="rtl" className="fixed z-50" style={at}>
        <Panel value={value ?? { from: today, to: today }} all={!value} today={today} onPick={(r) => { onChange(r); setOpen(false); }} onAll={() => { onChange(null); setOpen(false); }} />
      </div>, document.body)}
    </div>
  );
}
