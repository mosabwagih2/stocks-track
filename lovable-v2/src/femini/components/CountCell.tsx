import { cn, fmt } from '@/femini/cn';
import { td } from './ui';

/**
 * A table cell with a count of orders and, each on its own line under it, their pieces and their money. Used by
 * «أيام لسه مفتوحة» / «أيام اتقفلت» and «شيتات التسوية», so every count reads the same way everywhere.
 */
export function CountCell({ n, pieces, money, tone, strong }: { n: number; pieces?: number; money?: number; tone?: string; strong?: boolean }) {
  return (
    <td className={td}>
      <div className={cn('font-mono font-semibold', !n && !strong && 'font-normal text-muted', n > 0 && tone)}>{fmt(n)}</div>
      {n > 0 && (
        <div className="mt-0.5 grid gap-0.5 text-[11px] leading-4 text-muted">
          {pieces !== undefined && <span className="block whitespace-nowrap"><span className="num">{fmt(pieces)}</span> قطعة</span>}
          {money !== undefined && <span className="block whitespace-nowrap"><span className="num">{fmt(Math.round(money))}</span> جنيه</span>}
        </div>
      )}
    </td>
  );
}
