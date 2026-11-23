import { cn, fmt } from '@/femini/cn';
import { td } from './ui';

/**
 * A table cell for the day and settlement tables: the orders and their pieces on the top line, and the cell's money
 * on the line under it.
 */
export function CountCell({ n, pieces, money, tone }: { n: number; pieces: number; money: number; tone?: string }) {
  return (
    <td className={cn(td, 'whitespace-nowrap')}>
      <div className="flex items-baseline gap-1.5">
        <b className={cn('num text-[15px] font-semibold', !n && 'font-normal text-muted', n > 0 && tone)}>{fmt(n)}</b>
        {n > 0 && <span className="text-[11px] text-muted">أوردر · <span className="num text-ink">{fmt(pieces)}</span> قطعة</span>}
      </div>
      {n > 0 && <div className="mt-0.5 text-xs text-muted"><b className="num font-semibold text-ink">{fmt(Math.round(money))}</b> جنيه</div>}
    </td>
  );
}
