import { useMemo } from 'react';
import type { Derived } from '@/femini/hooks/data';
import type { Doc } from '@/femini/domain/types';
import { docLog, type LogEntry } from '@/femini/domain/docLog';
import { cairoDay, timeCairo } from '@/femini/domain/dates';
import { cn, fmt } from '@/femini/cn';
import { TONE } from './tones';

const pill = (e: LogEntry) => (e.kind === 'reverse' ? 'bg-crit-bg text-crit' : (e.kind === 'create' || e.kind === 'link') && e.type ? TONE[e.type] ?? 'bg-lav text-ink' : e.kind === 'deliver' ? 'bg-good-bg text-good' : 'bg-lav text-muted');

/** The log of one operation, one short line per event like the ledger: time · what · detail · who · pieces. */
export function DocLog({ d, doc, limit, onOpen }: { d: Derived; doc: Doc; limit?: number; onOpen?: (no: string) => void }) {
  const log = useMemo(() => docLog(d.snap, doc), [d, doc]);
  const shown = limit ? log.slice(0, limit) : log;
  // the operation's own day goes without its date; another day shows it
  const when = (at: string) => {
    if (!at) return '';
    const day = at.includes('T') ? cairoDay(at) : at; const time = at.includes('T') ? timeCairo(at) : '';
    return day === doc.date ? time : `${day.slice(5)}${time ? ` ${time}` : ''}`;
  };
  return (
    <ul className="grid divide-y divide-line" aria-label={`سجل ${doc.no}`}>
      {shown.map((e, i) => {
        const link = e.kind === 'link' && e.ref && onOpen;
        return (
          <li key={i} className="grid grid-cols-[4.5rem_auto_minmax(0,1fr)_auto_3rem] items-center gap-x-3 py-2 text-sm">
            <span className="num whitespace-nowrap text-muted">{when(e.at)}</span>
            <span className={cn('justify-self-start whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', pill(e))}>{e.label}</span>
            {link ? <button type="button" className="num truncate text-start text-accent hover:underline" onClick={(ev) => { ev.stopPropagation(); onOpen(e.ref!); }}>{e.detail}</button>
              : <span className="truncate text-muted" title={e.detail}>{e.detail}</span>}
            <span className="whitespace-nowrap">{e.by}</span>
            <b className="num text-end">{e.qty != null ? fmt(e.qty) : ''}</b>
          </li>
        );
      })}
      {limit && log.length > limit && <li className="py-2 text-xs text-muted">و{log.length - limit} كمان في صفحة العملية</li>}
    </ul>
  );
}
