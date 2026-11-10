import { LATE_CRIT, LATE_WARN } from '@/femini/domain/warehouseDay';
import { cn } from '@/femini/cn';

/** The dot for late warehouse days: yellow when a day has stayed open 7+ days, red at 10+. Nothing when all is well. */
export function LateDot({ level, late, className }: { level: 0 | 1 | 2; late: number; className?: string }) {
  if (!level) return null;
  const text = level === 2 ? `فيه أيام مفتوحة من ${LATE_CRIT} أيام أو أكتر في تقفيل يوم المخزن` : `فيه ${late} يوم مفتوح من ${LATE_WARN} أيام أو أكتر في تقفيل يوم المخزن`;
  return <span role="img" aria-label={text} title={text} className={cn('inline-block size-2.5 shrink-0 rounded-full ring-2 ring-surface', level === 2 ? 'bg-crit' : 'bg-yellow-400', className)} />;
}
