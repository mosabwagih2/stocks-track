import { cn, fmt } from '@/femini/cn';
import { Seg, td } from './ui';

/** What the day and settlement tables count: orders, pieces, or the orders' value (their total on the pickup sheet). */
export type Metric = 'orders' | 'pieces' | 'value';
export const METRIC_OPTIONS: [Metric, string][] = [['orders', 'أوردرات'], ['pieces', 'قطع'], ['value', 'فلوس']];
export const METRIC_UNIT: Record<Metric, string> = { orders: 'أوردر', pieces: 'قطعة', value: 'جنيه' };

/** The switch above a table: one measure at a time, so every row adds up (اتحصّل + مرتجع + لسه = الكل). */
export function MetricSeg({ value, onChange }: { value: Metric; onChange: (m: Metric) => void }) {
  return <span className="print:hidden"><Seg<Metric> label="المقياس" value={value} onChange={onChange} options={METRIC_OPTIONS} /></span>;
}

/** One number per cell, in the chosen measure. */
export function CountCell({ n, tone, strong }: { n: number; tone?: string; strong?: boolean }) {
  return <td className={cn(td, 'font-mono font-semibold whitespace-nowrap', !n && !strong && 'font-normal text-muted', n > 0 && tone)}>{fmt(Math.round(n))}</td>;
}
