import { useState } from 'react';
import { ChevronDown, History } from 'lucide-react';
import type { Derived } from '@/femini/hooks/data';
import type { Doc } from '@/femini/domain/types';
import { TONE } from './tones';
import { Button, Empty } from './ui';
import { cn, fmt } from '@/femini/cn';

const KEY = 'femini.opHistory.open';
const remembered = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const remember = (v: boolean) => { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* private mode: just not remembered */ } };
const STEP = 10;

/**
 * Under an operation's form: the latest operations of the same kind. The section opens and closes (remembered on
 * this device); tapping an operation opens its sheet (details and log).
 */
export function OpHistory({ d, type, label, onOpen }: { d: Derived; type: string; label: string; onOpen: (no: string) => void }) {
  const [open, setOpen] = useState(remembered);
  const [n, setN] = useState(STEP);
  const all = d.snap.docs.filter((x) => x.type === type).reverse();
  const pieces = (x: Doc) => { const m = d.snap.moves.filter((r) => r.doc === x.no); return Number(x.hdr.pieces ?? (m.length ? m.reduce((a, r) => a + r.qty, 0) / (type === 'SWP' ? 2 : 1) : x.lines.reduce((a, l) => a + l.qty, 0))); };
  const toggle = () => { setOpen((v) => { remember(!v); return !v; }); };
  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card">
      <button type="button" aria-expanded={open} onClick={toggle} className="flex w-full items-center gap-3 px-4 py-3 text-start">
        <span className="grid size-8 place-items-center rounded-lg bg-lav text-accent"><History className="size-4" /></span>
        <span className="min-w-0 flex-1"><b className="block text-sm">آخر عمليات {label}</b><span className="text-xs text-muted">{all.length ? `${fmt(all.length)} ${all.length > 2 && all.length <= 10 ? 'عمليات' : 'عملية'} · آخرها ${all[0].date}` : 'لسه مفيش عمليات من النوع ده'}</span></span>
        <ChevronDown className={cn('size-5 text-muted transition', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t border-line">
        {!all.length ? <div className="p-4"><Empty>لسه مفيش عمليات {label}.</Empty></div> : <ul className="divide-y divide-line">
          {all.slice(0, n).map((x) => {
            const reversed = x.status !== 'done';
            return <li key={x.no}>
              <button type="button" onClick={() => onOpen(x.no)} aria-label={`افتح ${x.no}`}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-start text-sm transition hover:bg-lav">
                <b className="num whitespace-nowrap">{x.no}</b>
                <span className="num whitespace-nowrap text-muted max-sm:hidden">{x.date}</span>
                <span className="truncate text-muted max-sm:hidden">{x.by}</span>
                {x.hdr.shop ? <span className="min-w-0 truncate">{String(x.hdr.shop)}</span> : null}
                <span className="num ms-auto whitespace-nowrap">{fmt(pieces(x))} قطعة</span>
                {x.type === 'SHP' && !reversed && !x.hdr.delivered && <span className="whitespace-nowrap rounded-full bg-warn-bg px-2 py-0.5 text-xs font-medium text-warn">مستني التسليم</span>}
                <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', reversed ? 'bg-crit-bg text-crit' : TONE[x.type] ?? 'bg-lav text-ink')}>{reversed ? `عكس ${label}` : label}</span>
              </button>
            </li>;
          })}
        </ul>}
        {all.length > n && <div className="border-t border-line p-2 text-center"><Button size="sm" variant="ghost" onClick={() => setN((v) => v + STEP)}>عرض {fmt(Math.min(STEP, all.length - n))} كمان</Button></div>}
      </div>}
    </section>
  );
}
