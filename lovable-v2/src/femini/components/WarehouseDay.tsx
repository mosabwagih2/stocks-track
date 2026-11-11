import { useMemo, useState } from 'react';
import type { Derived } from '@/femini/hooks/data';
import { lateLevel, warehouseDays, type WhDay, type WhState } from '@/femini/domain/warehouseDay';
import { dayDiff } from '@/femini/domain/dates';
import { cn, fmt, pct } from '@/femini/cn';
import { Card, Chip, Empty, Kpi, Pill, Sheet, TableWrap, th, td } from './ui';
import { C, TrendArea } from './charts';
import { OrderSheet } from './OrderSheets';

const money = (n: number) => new Intl.NumberFormat('ar-EG-u-nu-latn', { maximumFractionDigits: 0 }).format(n);
const STATE: Record<WhState, [string, 'good' | 'warn' | 'lost']> = { collected: ['اتحصّل', 'good'], returned: ['رجع', 'lost'], pending: ['لسه', 'warn'] };
/** the colour of each state: the chart's own (teal, rose, amber), livelier than the text tones */
const FILL: Record<WhState, string> = { collected: 'var(--chart-secondary)', returned: 'var(--scrap)', pending: 'var(--dirty)' };
const F_AR: Record<WhState | 'all', string> = { all: 'كل الأوردرات', collected: 'اتحصّل', returned: 'رجع', pending: 'لسه' };
const SUM_KEYS = ['orders', 'pieces', 'collected', 'returned', 'pending', 'collectedPieces', 'returnedPieces', 'pendingPieces', 'due'] as const;

/** how much of a day is closed (collected or came back) */
const closedPct = (x: Pick<WhDay, 'orders' | 'collected' | 'returned'>) => (x.orders ? Math.round(((x.collected + x.returned) / x.orders) * 100) : 0);

/** The day's orders as one bar: collected · came back · still out. */
function StateBar({ x, label = true }: { x: Pick<WhDay, 'orders' | 'collected' | 'returned' | 'pending'>; label?: boolean }) {
  const w = (n: number) => `${x.orders ? (n / x.orders) * 100 : 0}%`;
  return (
    <div className="min-w-28">
      <div className="flex h-2 overflow-hidden rounded-full bg-lav" role="img" aria-label={`اتقفل ${closedPct(x)}%: اتحصّل ${x.collected}، رجع ${x.returned}، لسه ${x.pending}`}>
        <i style={{ width: w(x.collected), background: FILL.collected }} /><i style={{ width: w(x.returned), background: FILL.returned }} /><i style={{ width: w(x.pending), background: FILL.pending }} />
      </div>
      {label && <span className="num mt-0.5 block text-[11px] text-muted">اتقفل <bdi dir="ltr">{closedPct(x)}%</bdi></span>}
    </div>
  );
}

/** a count with what it is worth underneath */
function Num({ n, sub, tone }: { n: number; sub?: string; tone?: string }) {
  return <td className={td}><div className={cn('font-mono font-semibold', !n && 'font-normal text-muted', n > 0 && tone)}>{fmt(n)}</div>{n > 0 && sub ? <div className="num whitespace-nowrap text-[11px] text-muted">{sub}</div> : null}</td>;
}

/**
 * «تقفيل يوم المخزن»: what left each day, and how much of it is paid, came back, or still out — whatever day the money
 * came on. Two tables: the days still open (oldest first, red once 7+ days old) and the days that closed (every order
 * collected or back), which move down by themselves.
 */
export function WarehouseDayView({ d, from, to }: { d: Derived; from: string; to: string }) {
  const days = useMemo(() => warehouseDays(d.snap, from, to), [d, from, to]);
  const open = useMemo(() => days.filter((x) => x.pending > 0).sort((a, b) => a.day.localeCompare(b.day)), [days]);
  const closed = useMemo(() => days.filter((x) => !x.pending).sort((a, b) => b.closedOn.localeCompare(a.closedOn) || b.day.localeCompare(a.day)), [days]);
  // which sheet is open: one day, or the whole period ('*'), and the state it starts filtered on
  const [sheet, setSheet] = useState<{ day: string; f: WhState | 'all' } | null>(null);
  const sum = (k: (typeof SUM_KEYS)[number]) => days.reduce((a, x) => a + x[k], 0);
  const chart = useMemo(() => [...days].reverse().map((x) => ({ day: x.day, collected: x.collected, returned: x.returned, pending: x.pending })), [days]);
  const all = useMemo(() => periodTotal(days), [days]);
  const day = sheet?.day === '*' ? all : days.find((x) => x.day === sheet?.day);
  const show = (f: WhState | 'all') => setSheet({ day: '*', f });
  if (!days.length) return <Card><Empty>مفيش أوردرات خرجت من المخزن في الفترة دي.</Empty></Card>;
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted">كل أوردر محسوب على اليوم اللي خرج فيه من المخزن (يوم الإسكان)، مهما كان يوم التسوية اللي جت فيها فلوسه. اليوم بيفضل في «الأيام اللي لسه مفتوحة» لحد ما كل أوردراته تتحصّل أو ترجع، وبعدين بينزل لوحده في «الأيام اللي اتقفلت».</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="خرج من المخزن" value={fmt(sum('orders'))} sub={`${days.length} يوم · ${fmt(sum('pieces'))} قطعة`} onClick={() => show('all')} />
        <Kpi label="اتحصّل" value={fmt(sum('collected'))} sub={`${pct(sum('collected'), sum('orders'))}% · التوريد ${money(sum('due'))} جنيه`} tone="good" onClick={() => show('collected')} />
        <Kpi label="رجع" value={fmt(sum('returned'))} sub={`${pct(sum('returned'), sum('orders'))}% · ${fmt(sum('returnedPieces'))} قطعة`} onClick={() => show('returned')} />
        <Kpi label="لسه ما اتقفلش" value={fmt(sum('pending'))} sub={`${pct(sum('pending'), sum('orders'))}% · ${fmt(sum('pendingPieces'))} قطعة`} tone={sum('pending') ? 'warn' : 'good'} onClick={() => show('pending')} />
      </div>
      <Card title="حالة أوردرات كل يوم خروج" hint="أوردرات">
        <TrendArea bars data={chart} series={[{ key: 'collected', name: 'اتحصّل', color: C.ready }, { key: 'returned', name: 'رجع', color: C.scrap }, { key: 'pending', name: 'لسه', color: C.dirty }]} />
      </Card>
      <Card title={`أيام لسه مفتوحة (${fmt(open.length)})`} hint="الأقدم الأول · الأحمر عدّى عليه 7 أيام أو أكتر من غير ما يتقفل">
        {!open.length ? <Empty>كل الأيام اتقفلت.</Empty> : <DaysTable d={d} days={open} kind="open" onOpen={(x) => setSheet({ day: x.day, f: 'pending' })} />}
      </Card>
      <Card title={`أيام اتقفلت (${fmt(closed.length)})`} hint="اتقفلت لما كل أوردراتها اتحصّلت أو رجعت · الأحدث أول">
        {!closed.length ? <Empty>لسه مفيش يوم اتقفل.</Empty> : <DaysTable d={d} days={closed} kind="closed" onOpen={(x) => setSheet({ day: x.day, f: 'all' })} />}
      </Card>
      {day && sheet && <DaySheet key={`${sheet.day}:${sheet.f}`} d={d} x={day} start={sheet.f} period={sheet.day === '*' ? `${days.at(-1)?.day} → ${days[0].day}` : undefined} onClose={() => setSheet(null)} />}
    </div>
  );
}

/** Days with what was collected (with its توريد), what came back and what is left (with their pieces). */
function DaysTable({ d, days, kind, onOpen }: { d: Derived; days: WhDay[]; kind: 'open' | 'closed'; onOpen: (x: WhDay) => void }) {
  const head = ['يوم الخروج', 'أوردرات', 'اتحصّل · التوريد', 'رجع', ...(kind === 'open' ? ['لسه'] : []), 'الحالة', kind === 'open' ? 'اتحصّل في تسويات' : 'اتقفل يوم'];
  return (
    <TableWrap><table className="text-sm"><thead><tr>{head.map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
      <tbody>{days.map((x) => {
        const age = dayDiff(x.day, d.today); const lvl = kind === 'open' ? lateLevel(age) : 0;
        return (
          <tr key={x.day} className={cn('cursor-pointer', lvl ? 'bg-crit-bg/60 hover:bg-crit-bg' : 'hover:bg-lav', lvl === 2 && 'bg-crit-bg')} onClick={() => onOpen(x)}>
            <td className={td + ' whitespace-nowrap'}>
              <b className="font-mono">{x.day}</b>
              {kind === 'open' && <div className="mt-0.5">{lvl ? <Pill tone="crit" title={lvl === 2 ? 'عدّى عليه 10 أيام أو أكتر' : 'عدّى عليه 7 أيام'}>عدّى {age} يوم</Pill> : <span className="num text-[11px] text-muted">من {age} يوم</span>}</div>}
            </td>
            <td className={td}><div className="font-mono font-semibold">{fmt(x.orders)}</div><div className="num whitespace-nowrap text-[11px] text-muted">{fmt(x.pieces)} قطعة</div></td>
            <Num n={x.collected} sub={`${money(x.due)} جنيه`} tone="text-good" />
            <Num n={x.returned} sub={`${fmt(x.returnedPieces)} قطعة`} />
            {kind === 'open' && <Num n={x.pending} sub={`${fmt(x.pendingPieces)} قطعة`} tone="text-warn" />}
            <td className={td}><StateBar x={x} /></td>
            {kind === 'open'
              ? <td className={td + ' text-xs text-muted'}>{x.paidOn.length ? x.paidOn.map((p) => `${p.date.slice(5)} (${p.n})`).join('، ') : '—'}</td>
              : <td className={td + ' whitespace-nowrap'}><b className="font-mono">{x.closedOn}</b><div className="num text-[11px] text-muted">بعد {Math.max(0, dayDiff(x.day, x.closedOn))} يوم</div></td>}
          </tr>
        );
      })}</tbody></table></TableWrap>
  );
}

/** every day of the period added up into one, for the period cards */
function periodTotal(days: WhDay[]): WhDay {
  const t: WhDay = { day: '*', orders: 0, pieces: 0, collected: 0, returned: 0, pending: 0, collectedPieces: 0, returnedPieces: 0, pendingPieces: 0, closedOn: '', due: 0, paidOn: [], list: [] };
  const on: Record<string, number> = {};
  for (const x of days) {
    for (const k of SUM_KEYS) t[k] += x[k];
    for (const p of x.paidOn) on[p.date] = (on[p.date] ?? 0) + p.n;
    t.list.push(...x.list);
  }
  t.paidOn = Object.entries(on).sort((a, b) => a[0].localeCompare(b[0])).map(([date, n]) => ({ date, n }));
  return t;
}

/** One state of the day as a card: how many orders and pieces (and the توريد of the collected). Tapping it filters the list. */
function StateCard({ state, x, on, onClick }: { state: WhState; x: WhDay; on: boolean; onClick: () => void }) {
  const n = state === 'collected' ? x.collected : state === 'returned' ? x.returned : x.pending;
  const pieces = state === 'collected' ? x.collectedPieces : state === 'returned' ? x.returnedPieces : x.pendingPieces;
  const tone = state === 'collected' ? 'text-good' : state === 'pending' && n ? 'text-warn' : 'text-ink';
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={cn('grid content-start gap-1 rounded-2xl border bg-surface px-4 py-3 text-start shadow-card transition hover:-translate-y-0.5', on ? 'border-accent ring-1 ring-accent/40' : 'border-line hover:border-accent/50')}>
      <span className="flex items-center gap-2 text-[13px] font-medium text-muted"><i className="h-3.5 w-1 rounded-full" style={{ background: FILL[state] }} />{F_AR[state]}</span>
      <b className={cn('num text-[28px] leading-none font-semibold', tone)}>{fmt(n)}</b>
      <span className="num text-xs text-muted">{fmt(pieces)} قطعة</span>
      {state === 'collected' && <span className="mt-1 border-t border-line pt-1.5 text-xs text-muted">التوريد: <b className="num text-sm text-ink">{money(x.due)}</b> جنيه</span>}
    </button>
  );
}

/** One leave day (or the whole period when `period` is given): how it stands, then its orders filtered by state. */
function DaySheet({ d, x, start, period, onClose }: { d: Derived; x: WhDay; start: WhState | 'all'; period?: string; onClose: () => void }) {
  const [f, setF] = useState<WhState | 'all'>(start); const [ref, setRef] = useState<string | null>(null);
  const list = x.list.filter((w) => f === 'all' || w.state === f);
  const many = !!period;
  const age = many ? 0 : dayDiff(x.day, d.today); const lvl = x.pending && !many ? lateLevel(age) : 0;
  return (
    <Sheet title={many ? `${F_AR[f]} · ${period} · ${fmt(list.length)} أوردر` : <span className="flex flex-wrap items-center gap-2">يوم الخروج <span className="num">{x.day}</span></span>} onClose={onClose} wide>
      <section aria-label="حالة اليوم" className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span><b className="num">{fmt(x.orders)}</b> أوردر · <b className="num">{fmt(x.pieces)}</b> قطعة · التوريد <b className="num">{money(x.due)}</b> جنيه</span>
          {!many && (x.pending
            ? <Pill tone={lvl ? 'crit' : 'warn'}>{lvl ? `متأخر · عدّى ${age} يوم` : `لسه مفتوح · من ${age} يوم`}</Pill>
            : <Pill tone="good">اتقفل يوم {x.closedOn} · بعد {Math.max(0, dayDiff(x.day, x.closedOn))} يوم</Pill>)}
          {many && <Pill tone={x.pending ? 'warn' : 'good'}>اتقفل <bdi dir="ltr">{closedPct(x)}%</bdi></Pill>}
        </div>
        <StateBar x={x} label={false} />
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">{(['collected', 'returned', 'pending'] as const).map((k) => <span key={k} className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full" style={{ background: FILL[k] }} />{F_AR[k]}</span>)}</p>
      </section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StateCard state="collected" x={x} on={f === 'collected'} onClick={() => setF(f === 'collected' ? 'all' : 'collected')} />
        <StateCard state="returned" x={x} on={f === 'returned'} onClick={() => setF(f === 'returned' ? 'all' : 'returned')} />
        <StateCard state="pending" x={x} on={f === 'pending'} onClick={() => setF(f === 'pending' ? 'all' : 'pending')} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'collected', 'returned', 'pending'] as const).map((s) => <Chip key={s} pressed={f === s} onClick={() => setF(s)}>{F_AR[s]}{s === 'all' ? '' : ` · ${fmt(s === 'collected' ? x.collected : s === 'returned' ? x.returned : x.pending)}`}</Chip>)}
      </div>
      {x.paidOn.length > 0 && <p className="text-sm text-muted">{many ? 'التوريد بتاع الفترة دي جه على' : 'التوريد بتاع اليوم ده جه على'}: {x.paidOn.map((p) => `${p.date} (${p.n} أوردر)`).join('، ')}</p>}
      {!list.length ? <Empty>مفيش أوردرات {F_AR[f]} هنا.</Empty> : <TableWrap><table className="text-sm"><thead><tr>{[...(many ? ['يوم الخروج'] : []), 'البوليصة', 'رقم الأوردر', 'قطع', 'الحالة', 'التوريد', 'التسوية'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>{list.map((w) => (
          <tr key={w.ref} className="cursor-pointer hover:bg-lav" onClick={() => setRef(w.ref)}>
            {many && <td className={td + ' font-mono text-muted'}>{w.day}</td>}<td className={td + ' font-mono'}>{w.ref}</td><td className={td + ' font-mono text-muted'}>{w.waybill}</td><td className={td + ' font-mono'}>{w.pieces}</td>
            <td className={td}><Pill tone={STATE[w.state][1]}>{STATE[w.state][0]}{w.closedOn ? ` · ${w.closedOn.slice(5)}` : ''}</Pill></td>
            <td className={td + ' font-mono font-semibold'}>{w.due ? money(w.due) : '—'}</td>
            <td className={td + ' font-mono text-xs text-muted'}>{w.stl.join('، ') || '—'}</td>
          </tr>))}</tbody></table></TableWrap>}
      {ref && <OrderSheet d={d} orderRef={ref} onClose={() => setRef(null)} onCancel={() => setRef(null)} />}
    </Sheet>
  );
}
