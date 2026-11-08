import { LOC_AR, TYPE_AR } from '@/femini/domain/constants';
import { skuLabel } from '@/femini/domain/orders';
import { timeCairo } from '@/femini/domain/dates';
import { cn, fmt } from '@/femini/cn';
import { TableWrap, th, td } from './ui';
import type { Derived } from '@/femini/hooks/data';
import type { Loc, Move } from '@/femini/domain/types';

/** One operation (a document) as people think of it: what, which code, who, how many pieces, when. */
export interface DocEvent { doc: string; type: string; by: string; pieces: number; ts: string; date: string; from: string; to: string; moves: Move[] }

const SHORT: Record<string, string> = { READY: 'جاهز', DIRTY: 'نظافة', FACTORY: 'المصنع', SCRAP: 'هالك', LOST: 'مفقود', EXT_OPEN: 'افتتاحي', EXT_FACTORY: 'المصنع', EXT_CH: 'العميل', EXT_SHOP: 'المحل', EXT_ADJ: 'جرد', EXT_OFF: 'شطب', EXT_HOLD: 'هولد' };
const TONE: Record<string, string> = {
  SCN: 'bg-good-bg text-good', RTN: 'bg-info-bg text-info', RCV: 'bg-info-bg text-info', SHP: 'bg-lav text-accent', CXL: 'bg-crit-bg text-crit',
  CNT: 'bg-warn-bg text-warn', CLN: 'bg-warn-bg text-warn', LOS: 'bg-warn-bg text-warn', HLD: 'bg-lav text-accent', OPN: 'bg-lav text-muted',
};

/** Groups moves by document, newest first. A reversal ("SCN-0001 (عكس)") is its own event. */
export function docEvents(moves: Move[]): DocEvent[] {
  const by = new Map<string, Move[]>();
  for (const m of moves) { const k = `${m.date}|${m.doc}`; (by.get(k) ?? by.set(k, []).get(k)!).push(m); }
  return [...by.values()].map((ms) => {
    const pair = new Map<string, number>(); for (const m of ms) pair.set(`${m.from}|${m.to}`, (pair.get(`${m.from}|${m.to}`) ?? 0) + m.qty);
    const [from, to] = [...pair].sort((a, b) => b[1] - a[1])[0][0].split('|');
    const ts = ms.reduce((a, m) => (m.ts < a ? m.ts : a), ms[0].ts);
    return { doc: ms[0].doc, type: ms[0].type, by: ms[0].by, pieces: ms.reduce((a, m) => a + m.qty, 0), ts, date: ms[0].date, from, to, moves: ms };
  }).sort((a, b) => (a.ts < b.ts ? 1 : -1));
}

/** The clean table of operations (same layout as the variant history): time · operation · code · by · from → to · pieces. */
export function EventTable({ events, onOpen, showDate = false }: { events: DocEvent[]; onOpen?: (e: DocEvent) => void; showDate?: boolean }) {
  return (
    <TableWrap>
      <table className="text-sm">
        <thead><tr>{[showDate ? 'التاريخ' : 'الوقت', 'العملية', 'الكود', 'بواسطة', 'من ← إلى', 'القطع'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>{events.map((e) => {
          const rev = e.doc.endsWith('(عكس)');
          return (
            <tr key={`${e.date}|${e.doc}`} onClick={onOpen ? () => onOpen(e) : undefined} className={cn(onOpen && 'cursor-pointer hover:bg-lav')}>
              <td className={td + ' whitespace-nowrap font-mono text-muted'}>{showDate ? e.date : timeCairo(e.ts)}{showDate && <span className="ms-1.5 text-[11px]">{timeCairo(e.ts)}</span>}</td>
              <td className={td}><span className={cn('inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', rev ? 'bg-crit-bg text-crit' : TONE[e.type] ?? 'bg-lav text-ink')}>{rev ? `عكس ${TYPE_AR[e.type] ?? e.type}` : TYPE_AR[e.type] ?? e.type}</span></td>
              <td className={td + ' whitespace-nowrap font-mono'}>{e.doc.replace(' (عكس)', '')}</td>
              <td className={td + ' whitespace-nowrap'}>{e.by}</td>
              <td className={td + ' whitespace-nowrap text-muted'}>{SHORT[e.from] ?? e.from} ← {SHORT[e.to] ?? e.to}</td>
              <td className={td + ' num font-semibold'}>{fmt(e.pieces)}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </TableWrap>
  );
}

/** Moves of one stock state, compact: variant · operation, date, who · ± pieces. */
export function MoveRows({ d, moves, loc, max = 30 }: { d: Derived; moves: Move[]; loc: Loc; max?: number }) {
  return (
    <ul className="grid max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface">
      {moves.slice(0, max).map((m) => {
        const inn = m.to === loc;
        return (
          <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-[13px]">
            <span className="min-w-0">
              <span className="block truncate">{skuLabel(d.skuMap, m.sku)}</span>
              <span className="block truncate text-[11px] text-muted">{TYPE_AR[m.type] ?? m.type} · <span className="font-mono">{m.doc}</span> · {m.date} {timeCairo(m.ts)}{m.by ? ` · ${m.by}` : ''} · {LOC_AR[inn ? m.from : m.to] ?? ''}</span>
            </span>
            <b className={cn('num shrink-0', inn ? 'text-good' : 'text-crit')}>{inn ? '+' : '−'}{fmt(m.qty)}</b>
          </li>
        );
      })}
    </ul>
  );
}
