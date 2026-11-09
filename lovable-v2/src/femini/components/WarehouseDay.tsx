import { useMemo, useState } from 'react';
import type { Derived } from '@/femini/hooks/data';
import { warehouseDays, type WhDay, type WhState } from '@/femini/domain/warehouseDay';
import { fmt, pct } from '@/femini/cn';
import { Card, Empty, Kpi, Pill, Sheet, TableWrap, th, td } from './ui';
import { C, TrendArea } from './charts';
import { OrderSheet } from './OrderSheets';

const money = (n: number) => new Intl.NumberFormat('ar-EG-u-nu-latn', { maximumFractionDigits: 0 }).format(n);
const STATE: Record<WhState, [string, 'good' | 'warn' | 'lost']> = { collected: ['اتحصّل', 'good'], returned: ['رجع', 'lost'], pending: ['لسه', 'warn'] };

/** «تقفيل يوم المخزن»: what left each day, and how much of it is paid, came back, or still out — whatever day the money came on. */
export function WarehouseDayView({ d, from, to }: { d: Derived; from: string; to: string }) {
  const days = useMemo(() => warehouseDays(d.snap, from, to), [d, from, to]);
  // which sheet is open: one day, or the whole period ('*'), and the state it starts filtered on
  const [open, setOpen] = useState<{ day: string; f: WhState | 'all' } | null>(null);
  const sum = (k: keyof Pick<WhDay, 'orders' | 'collected' | 'returned' | 'pending' | 'pendingValue' | 'sales' | 'due' | 'expected'>) => days.reduce((a, x) => a + x[k], 0);
  const chart = useMemo(() => [...days].reverse().map((x) => ({ day: x.day, collected: x.collected, returned: x.returned, pending: x.pending })), [days]);
  const all = useMemo(() => periodTotal(days), [days]);
  const day = open?.day === '*' ? all : days.find((x) => x.day === open?.day);
  const show = (f: WhState | 'all') => setOpen({ day: '*', f });
  if (!days.length) return <Card><Empty>مفيش أوردرات خرجت من المخزن في الفترة دي.</Empty></Card>;
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted">كل أوردر محسوب على اليوم اللي خرج فيه من المخزن (يوم الإسكان)، مهما كان يوم التسوية اللي جت فيها فلوسه. اليوم بيتقفل لما كل أوردراته تتحصّل أو ترجع.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="خرج من المخزن" value={fmt(sum('orders'))} sub={`${days.length} يوم · متوقع ${money(sum('expected'))} جنيه`} onClick={() => show('all')} />
        <Kpi label="اتحصّل" value={fmt(sum('collected'))} sub={`${pct(sum('collected'), sum('orders'))}% · مستحق فيميني ${money(sum('due'))}`} tone="good" onClick={() => show('collected')} />
        <Kpi label="رجع" value={fmt(sum('returned'))} sub={`${pct(sum('returned'), sum('orders'))}%`} onClick={() => show('returned')} />
        <Kpi label="لسه ما اتقفلش" value={fmt(sum('pending'))} sub={`متوقع ${money(sum('pendingValue'))} جنيه`} tone={sum('pending') ? 'warn' : 'good'} onClick={() => show('pending')} />
      </div>
      <Card title="حالة أوردرات كل يوم خروج" hint="أوردرات">
        <TrendArea bars data={chart} series={[{ key: 'collected', name: 'اتحصّل', color: C.ready }, { key: 'returned', name: 'رجع', color: C.scrap }, { key: 'pending', name: 'لسه', color: C.dirty }]} />
      </Card>
      <Card title="الأيام" hint="اضغط على اليوم تشوف أوردراته">
        <TableWrap><table className="text-sm"><thead><tr>{['يوم الخروج', 'أوردرات', 'قطع', 'اتحصّل', 'رجع', 'لسه', 'المبيعات', 'الصافي', 'مستحق فيميني', 'اتحصّل في تسويات', 'الحالة'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{days.map((x) => (
            <tr key={x.day} className="cursor-pointer hover:bg-lav" onClick={() => setOpen({ day: x.day, f: 'all' })}>
              <td className={td + ' font-mono font-semibold'}>{x.day}</td><td className={td + ' font-mono'}>{fmt(x.orders)}</td><td className={td + ' font-mono'}>{fmt(x.pieces)}</td>
              <td className={td + ' font-mono text-good'}>{fmt(x.collected)}</td><td className={td + ' font-mono'}>{fmt(x.returned)}</td><td className={td + ' font-mono'}>{x.pending ? <b className="text-warn">{fmt(x.pending)}</b> : 0}</td>
              <td className={td + ' font-mono'}>{money(x.sales)}</td><td className={td + ' font-mono'}>{money(x.cod)}</td><td className={td + ' font-mono font-semibold'}>{money(x.due)}</td>
              <td className={td + ' text-xs text-muted'}>{x.paidOn.length ? x.paidOn.map((p) => `${p.date.slice(5)} (${p.n})`).join('، ') : '—'}</td>
              <td className={td}>{x.pending ? <Pill tone="warn">لسه {x.pending}</Pill> : <Pill tone="good">اتقفل</Pill>}</td>
            </tr>))}</tbody></table></TableWrap>
      </Card>
      {day && open && <DaySheet key={`${open.day}:${open.f}`} d={d} x={day} start={open.f} period={open.day === '*' ? `${days.at(-1)?.day} → ${days[0].day}` : undefined} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** every day of the period added up into one, for the period cards */
function periodTotal(days: WhDay[]): WhDay {
  const t: WhDay = { day: '*', orders: 0, pieces: 0, expected: 0, collected: 0, returned: 0, pending: 0, pendingValue: 0, sales: 0, fees: 0, cod: 0, due: 0, paidOn: [], list: [] };
  const on: Record<string, number> = {};
  for (const x of days) {
    for (const k of ['orders', 'pieces', 'expected', 'collected', 'returned', 'pending', 'pendingValue', 'sales', 'fees', 'cod', 'due'] as const) t[k] += x[k];
    for (const p of x.paidOn) on[p.date] = (on[p.date] ?? 0) + p.n;
    t.list.push(...x.list);
  }
  t.paidOn = Object.entries(on).sort((a, b) => a[0].localeCompare(b[0])).map(([date, n]) => ({ date, n }));
  return t;
}

const F_AR: Record<WhState | 'all', string> = { all: 'كل الأوردرات', collected: 'اتحصّل', returned: 'رجع', pending: 'لسه' };

/** One leave day (or the whole period when `period` is given): its orders, filtered by state with the cards on top. */
function DaySheet({ d, x, start, period, onClose }: { d: Derived; x: WhDay; start: WhState | 'all'; period?: string; onClose: () => void }) {
  const [f, setF] = useState<WhState | 'all'>(start); const [ref, setRef] = useState<string | null>(null);
  const list = x.list.filter((w) => f === 'all' || w.state === f);
  const many = !!period;
  return (
    <Sheet title={many ? `${F_AR[f]} · ${period} · ${fmt(list.length)} أوردر` : `يوم الخروج ${x.day} · ${fmt(x.orders)} أوردر`} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="اتحصّل" value={fmt(x.collected)} sub={`مستحق فيميني ${money(x.due)}`} tone="good" onClick={() => setF('collected')} />
        <Kpi label="رجع" value={fmt(x.returned)} onClick={() => setF('returned')} />
        <Kpi label="لسه" value={fmt(x.pending)} sub={`متوقع ${money(x.pendingValue)} جنيه`} tone={x.pending ? 'warn' : 'good'} onClick={() => setF('pending')} />
        <Kpi label="المبيعات / الصافي" value={money(x.sales)} sub={`الصافي ${money(x.cod)} · الشحن ${money(x.fees)}`} onClick={() => setF('all')} />
      </div>
      {x.paidOn.length > 0 && <p className="text-sm text-muted">{many ? 'فلوس الفترة دي جت على' : 'فلوس اليوم ده جت على'}: {x.paidOn.map((p) => `${p.date} (${p.n} أوردر)`).join('، ')}</p>}
      {!list.length ? <Empty>مفيش أوردرات {F_AR[f]} هنا.</Empty> : <TableWrap><table className="text-sm"><thead><tr>{[...(many ? ['يوم الخروج'] : []), 'البوليصة', 'رقم الأوردر', 'قطع', 'الحالة', 'المبلغ', 'الصافي', 'مستحق فيميني', 'التسوية'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>{list.map((w) => (
          <tr key={w.ref} className="cursor-pointer hover:bg-lav" onClick={() => setRef(w.ref)}>
            {many && <td className={td + ' font-mono text-muted'}>{w.day}</td>}<td className={td + ' font-mono'}>{w.ref}</td><td className={td + ' font-mono text-muted'}>{w.waybill}</td><td className={td + ' font-mono'}>{w.pieces}</td>
            <td className={td}><Pill tone={STATE[w.state][1]}>{STATE[w.state][0]}{w.on ? ` · ${w.on}` : ''}</Pill></td>
            <td className={td + ' font-mono'}>{money(w.state === 'collected' ? w.sales : w.expected)}</td><td className={td + ' font-mono'}>{w.cod ? money(w.cod) : '—'}</td><td className={td + ' font-mono'}>{w.due ? money(w.due) : '—'}</td>
            <td className={td + ' font-mono text-xs text-muted'}>{w.stl.join('، ') || '—'}</td>
          </tr>))}</tbody></table></TableWrap>}
      {ref && <OrderSheet d={d} orderRef={ref} onClose={() => setRef(null)} onCancel={() => setRef(null)} />}
    </Sheet>
  );
}
