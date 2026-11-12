import { addDays, dayDiff } from '@/femini/domain/dates';
import { lineBase } from '@/femini/domain/constants';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CalendarCheck, ArrowDownRight, ArrowLeft, ArrowUpRight, BarChart3, Bell, FileDown, FileSpreadsheet, Flame, Gauge, PackageX, Sparkles, Truck, Users, Wallet } from 'lucide-react';
import { useDerived } from '@/femini/hooks/data';
import { PageHead } from '@/femini/components/PageHead';
import { Alert, Button, Card, Empty, Pill, Seg, TableWrap, th, td } from '@/femini/components/ui';
import { ErrorBox } from '@/femini/components/shared';
import { Thumb } from '@/femini/components/Thumb';
import { Spinner } from '@/femini/components/Spinner';
import { C, CompareArea, HBars, Heatmap, Pareto, ShareRows, Sparkline, StateDonut } from '@/femini/components/charts';
import { PERIODS, change, comparePeriods, exportExcel, lastDays, rangeDays, riskAlerts, type ExportSheet, type Period, type Range, type RiskAlert } from '@/femini/insights-tools';
import { useNavigate } from '@/femini/router';
import { useToast } from '@/femini/components/toast';
import { useSearchParams } from '@/femini/router';
import { qty } from '@/femini/domain/ledger';
import { cairoDay, timeCairo } from '@/femini/domain/dates';
import { skuLabel } from '@/femini/domain/orders';
import { cn, fmt, pct } from '@/femini/cn';
import type { Derived } from '@/femini/hooks/data';
import { FinancialReport, financialSheets } from '@/femini/components/FinancialReport';
import { CollectionsView } from '@/femini/components/Collections';
import { Deferred } from '@/femini/components/Deferred';
import { WarehouseDayView } from '@/femini/components/WarehouseDay';
import { PeriodPicker } from '@/femini/components/PeriodPicker';
import { lateDays, lateLevel, warehouseDays } from '@/femini/domain/warehouseDay';
import { LateDot } from '@/femini/components/LateDot';
import { CancelSheet, OrderSheet } from '@/femini/components/OrderSheets';
import { ItemsDetail, OrdersDetail } from '@/femini/components/DetailSheets';
import { STAGNANT_DAYS, stagnantSkus } from '@/femini/domain/stagnant';
import type { Order } from '@/femini/domain/types';

const lineOf = (m: string) => { const b = lineBase(m); return /^PAN/.test(b) ? 'بانتي' : /^BR/.test(b) ? 'برا' : /^SH/.test(b) ? 'شورت' : 'موديلات أخرى'; };
const LINE_COLOR: Record<string, string> = { بانتي: C.accent, برا: C.scrap, شورت: C.factory, 'موديلات أخرى': C.dirty };
const topN = (o: Record<string, number>, n: number) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);

type Sec = 'summary' | 'collect' | 'whday' | 'finance';
const SECTIONS: { id: Sec; label: string; icon: typeof BarChart3 }[] = [
  { id: 'summary', label: 'الملخص', icon: Sparkles },
  { id: 'collect', label: 'التحصيل', icon: Wallet },
  { id: 'whday', label: 'تقفيل اليوم', icon: CalendarCheck },
  { id: 'finance', label: 'قيمة المخزون', icon: FileSpreadsheet },
];
/** The parts of the summary, in reading order. Risk, demand and team were tabs of their own: their old links open here. */
type Part = 'kpi' | 'attention' | 'risk' | 'trend' | 'mix' | 'demand' | 'team';
const PARTS: { id: Part; label: string }[] = [
  { id: 'kpi', label: 'الأداء' }, { id: 'attention', label: 'يحتاج انتباهك' }, { id: 'risk', label: 'المخاطر' },
  { id: 'trend', label: 'الاتجاه' }, { id: 'mix', label: 'التركيبة' }, { id: 'demand', label: 'الطلب' }, { id: 'team', label: 'الفريق' },
];
const OLD_TABS: Part[] = ['risk', 'demand', 'team'];

/**
 * Scrolls to a part of the summary and keeps it in place while the parts above it finish drawing (they fill in after the
 * first paint and change height). Stops at once if the person scrolls by hand.
 */
function jump(id: Part) {
  const el = () => document.getElementById(`part-${id}`);
  el()?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  let stop = false; const cancel = () => { stop = true; };
  const opts = { once: true, passive: true } as const;
  window.addEventListener('wheel', cancel, opts); window.addEventListener('touchstart', cancel, opts); window.addEventListener('keydown', cancel, opts);
  const t0 = performance.now();
  const step = () => {
    const x = el(); const t = performance.now() - t0;
    if (stop || !x || t > 2500) { window.removeEventListener('wheel', cancel); window.removeEventListener('touchstart', cancel); window.removeEventListener('keydown', cancel); return; }
    // after the smooth scroll had its time, put it back where it belongs if something above it grew or shrank
    if (t > 700) { const want = parseFloat(getComputedStyle(x).scrollMarginTop) || 0; if (Math.abs(x.getBoundingClientRect().top - want) > 8) x.scrollIntoView({ block: 'start' }); }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function useStats(d: Derived | null, range: Range | null) {
  return useMemo(() => {
    if (!d || !range) return null;
    // requested in the chosen window: orders whose pickup day is inside it (the same rule as the period comparison)
    const { from, to } = range;
    const live = d.snap.orders.filter((o) => { const pd = d.pickupDate.get(o.pickupId) ?? ''; return o.status !== 'cancelled' && pd >= from && pd <= to; });
    const pull: Record<string, number> = {}; for (const o of live) for (const s of o.lines) { const m = d.skuMap.get(s)?.model; if (m) pull[m] = (pull[m] ?? 0) + 1; }
    const pieces = live.reduce((a, o) => a + o.lines.length, 0);
    const shipped = live.filter((o) => o.status === 'shipped');
    const sorted = Object.entries(pull).sort((a, b) => b[1] - a[1]); const total = sorted.reduce((a, x) => a + x[1], 0);
    let cum = 0, n80 = 0; for (const [, v] of sorted) { cum += v; n80++; if (cum / (total || 1) >= 0.8) break; }
    const byLine: Record<string, number> = {}; for (const [m, v] of sorted) byLine[lineOf(m)] = (byLine[lineOf(m)] ?? 0) + v;
    const neg = d.snap.skus.filter((s) => qty(d.snap.balances, s.id, 'READY') < 0);
    const dead = stagnantSkus(d.snap.skus, d.snap.balances, d.snap.orders, d.pickupDate, d.today);   // ready stock not requested for 14+ days
    const stuckPcs = d.open.filter((o) => d.blocked.has(o.ref)).reduce((a, o) => a + o.lines.length, 0);
    // most requested variants with how long the ready stock lasts
    const skuPull: Record<string, number> = {}; for (const o of live) for (const s of o.lines) skuPull[s] = (skuPull[s] ?? 0) + 1;
    const hot = topN(skuPull, 10).map(([id, n]) => { const r = qty(d.snap.balances, id, 'READY'); const v = d.velocity[id] ?? 0; return { id, n, ready: r, open: d.demand[id] ?? 0, cover: v > 0 ? r / v : null }; });
    // ready stock per production line (now), for the demand / stock switch
    const stockLine: Record<string, number> = {}; for (const k of d.snap.skus) { const r = qty(d.snap.balances, k.id, 'READY'); if (r) stockLine[lineOf(k.model)] = (stockLine[lineOf(k.model)] ?? 0) + r; }
    return { live, pieces, shipped, sorted, total, n80, byLine, stockLine, pull, neg, dead, stuckPcs, hot };
  }, [d, range]);
}

export default function Insights() {
  const { d, isLoading, error } = useDerived();
  const [sp, setSp] = useSearchParams();
  const tabP = sp.get('tab') ?? '';
  const sec = (SECTIONS.some((s) => s.id === tabP) ? tabP : 'summary') as Sec;
  // an old address (?tab=risk / demand / team) opens the summary at that part, and the address becomes the summary's
  const oldPart = (OLD_TABS as string[]).includes(tabP) ? (tabP as Part) : null;
  useEffect(() => {
    if (!oldPart || !d) return;
    const p = new URLSearchParams(sp); p.delete('tab'); setSp(p, { replace: true });
    // not cancelled by the re-render that the new address brings (that would drop the jump); harmless if the page closed
    setTimeout(() => jump(oldPart), 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oldPart, !!d]);
  const go = (v: Sec) => { const p = new URLSearchParams(sp); if (v === 'summary') p.delete('tab'); else p.set('tab', v); setSp(p, { replace: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const period = (PERIODS.find((x) => String(x) === sp.get('p')) ?? 14) as Period;
  // a chosen date range (from / to in the address) replaces the ready-made periods
  const iso = /^\d{4}-\d{2}-\d{2}$/; const fromP = sp.get('from') ?? '', toP = sp.get('to') ?? '';
  const custom = !!d && iso.test(fromP) && iso.test(toP) && fromP <= toP && toP <= d.today;
  const range = useMemo<Range | null>(() => (d ? (custom ? { from: fromP, to: toP } : lastDays(d.today, period)) : null), [d, custom, fromP, toP, period]);
  const days = range ? rangeDays(range) : period;
  const rangeLabel = custom ? `${fromP} → ${toP} (${days} يوم)` : `آخر ${period} يوم`;
  // one place that writes the range: the last N days up to today keep the short address (?p=N)
  const setRange = (r: Range) => {
    const p = new URLSearchParams(sp); const n = rangeDays(r);
    p.delete('from'); p.delete('to'); p.delete('p');
    if (r.to === d?.today && (PERIODS as readonly number[]).includes(n)) { if (n !== 14) p.set('p', String(n)); }
    else { p.set('from', r.from); p.set('to', r.to); }
    setSp(p, { replace: true });
  };
  const setParam = (k: string, v: string | null) => { const p = new URLSearchParams(sp); if (v === null) p.delete(k); else p.set(k, v); setSp(p, { replace: true }); };
  const st = useStats(d, range);
  const cmp = useMemo(() => (d && range ? comparePeriods(d, range) : null), [d, range]);
  const alerts = useMemo(() => (d && cmp ? riskAlerts(d, cmp) : []), [d, cmp]);
  const late = useMemo(() => (d ? lateDays(d.snap, d.today) : null), [d]);   // open warehouse days that have waited too long
  const toast = useToast();
  const sheetP = sp.get('sheet') as Kind | null; const sheet = sheetP && SHEETS.includes(sheetP) ? sheetP : null;
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !d || !st || !cmp) return <Spinner />;
  const counts: Partial<Record<Sec, number>> = { summary: alerts.filter((a) => a.level === 'crit').length };
  const secLabel = SECTIONS.find((x) => x.id === sec)?.label ?? 'الملخص';
  const periodLabel = sec === 'finance' ? `الأرصدة الحالية حتى ${d.today} · التكلفة المسجلة حاليًا` : `${custom ? 'من' : `آخر ${period} يوم`} (${cmp.cur.from} → ${cmp.cur.to}) مقارنةً بـ ${cmp.prev.from} → ${cmp.prev.to}`;
  const filters = 'بدون فلاتر إضافية';
  const doExcel = () => exportExcel({ section: secLabel, period: periodLabel, filters, date: d.today }, buildSheets(sec, d, st, cmp, alerts))
    .then(() => toast('تم تصدير ملف Excel'), () => toast('تعذّر التصدير', { tone: 'err' }));
  return (
    <>
      <PageHead title="التحليلات" sub="قرارات مبنية على الطلب الفعلي وسجل الحركات — في مكان واحد.">
        {!d.velocityOK && <Pill tone="warn">بيانات {d.days} يوم فقط · السرعة تقديرية</Pill>}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {sec !== 'finance' && range && <PeriodPicker value={range} today={d.today} onChange={setRange} />}
          <Button onClick={doExcel}><FileSpreadsheet className="size-4" /> Excel</Button>
          <Button onClick={() => window.print()}><FileDown className="size-4" /> PDF</Button>
        </div>
      </PageHead>
      <div className="mb-4 hidden rounded-xl border border-line p-3 text-xs print:block">
        <b>Fémini Stock · تقرير التحليلات — {secLabel}</b>
        <div>الفترة: {periodLabel}</div><div>الفلاتر: {filters}</div><div>تاريخ التصدير: {d.today}</div>
      </div>

      <nav aria-label="أقسام التحليلات" className="print:hidden sticky top-[57px] z-10 -mx-1 mb-4 grid grid-cols-4 gap-1 rounded-2xl border border-line bg-surface/90 p-1 shadow-card backdrop-blur max-sm:static max-sm:grid-cols-4">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <Button key={id} variant={sec === id ? 'primary' : 'ghost'} onClick={() => go(id)} aria-pressed={sec === id}
            className={cn('group flex h-auto items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition max-sm:flex-col max-sm:gap-1 max-sm:px-1 max-sm:py-2 max-sm:text-[11px] max-sm:leading-tight', sec === id ? 'bg-accent text-on-accent' : 'text-ink hover:bg-lav')}>
            <Icon className="size-[18px] shrink-0" />
            {/* the count sits right next to its own label, so it cannot be read as the neighbour's */}
            <span className="inline-flex min-w-0 items-center gap-1.5"><span className="truncate max-sm:whitespace-normal max-sm:text-center">{label}</span>{counts[id] ? <span aria-label={`${counts[id]} عاجل`} className={cn('grid min-w-5 place-items-center rounded-full px-1.5 font-mono text-[11px] leading-5', sec === id ? 'bg-on-accent/25' : 'bg-crit text-on-accent')}>{counts[id]}</span> : null}{id === 'whday' && late ? <LateDot level={late.level} late={late.late} /> : null}</span>
          </Button>
        ))}
      </nav>

      {sec === 'summary' && (
        <div className="grid gap-8">
          <div className="print:hidden -mt-1 grid gap-2">
            <p className="text-[11px] text-muted"><i className="me-1 inline-block size-2 rounded-full bg-chart-primary align-middle" />الحالية <span className="num" dir="ltr">{cmp.cur.from} → {cmp.cur.to}</span><span className="mx-2 text-line">|</span><i className="me-1 inline-block size-2 rounded-full bg-chart-previous align-middle" />للمقارنة <span className="num" dir="ltr">{cmp.prev.from} → {cmp.prev.to}</span></p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
              <span className="shrink-0 self-center pe-1 text-xs text-muted">انتقل إلى:</span>
              {PARTS.map((x) => <button key={x.id} type="button" onClick={() => jump(x.id)} className="shrink-0 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink transition-colors hover:border-accent/50 hover:bg-lav">{x.label}</button>)}
            </div>
          </div>
          <Summary d={d} st={st} cmp={cmp} label={rangeLabel} />
          <Block id="risk" n={3} title="المخاطر" hint="تنبيهات، أوردرات متوقفة، رصيد سالب وراكد"><Deferred minHeight={520}><Risk d={d} st={st} alerts={alerts} /></Deferred></Block>
          <TrendMix d={d} st={st} cmp={cmp} period={days} />
          <Block id="demand" n={6} title="الطلب" hint={rangeLabel}><Deferred minHeight={600}><Demand d={d} st={st} /></Deferred></Block>
          <Block id="team" n={7} title="الفريق" hint="الشحن المسجّل لكل موظف"><Deferred minHeight={420}><Team d={d} st={st} /></Deferred></Block>
        </div>
      )}
      {sheet && <InsightSheet d={d} st={st} kind={sheet} range={null} onClose={() => setParam('sheet', null)} />}
      {sec === 'collect' && range && <CollectionsView d={d} from={range.from} to={range.to} />}
      {sec === 'whday' && range && <WarehouseDayView d={d} from={range.from} to={range.to} />}
      {sec === 'finance' && <FinancialReport s={d.snap} />}
    </>
  );
}

type Stats = NonNullable<ReturnType<typeof useStats>>;

type Cmp = ReturnType<typeof comparePeriods>;

/** Change vs the previous period. `upIsGood=false` for metrics where growth is bad. */
function Delta({ cur, prev, upIsGood = true, suffix = '' }: { cur: number; prev: number; upIsGood?: boolean; suffix?: string }) {
  const c = change(cur, prev);
  if (c === null) return <span className="text-[11px] text-muted">لا توجد بيانات للفترة السابقة</span>;
  const good = c === 0 ? null : (c > 0) === upIsGood; const Icon = c >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted">
      <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono font-semibold', good === null ? 'bg-lav text-muted' : good ? 'bg-good-bg text-good' : 'bg-crit-bg text-crit')}><Icon className="size-3" />{c > 0 ? '+' : ''}{c}%</span>
      مقابل {fmt(prev)}{suffix} في الفترة السابقة
    </span>
  );
}

function Stat({ icon: Icon, label, value, sub, tone = 'accent', children, onClick }: { icon: typeof BarChart3; label: string; value: ReactNode; sub?: ReactNode; tone?: 'accent' | 'good' | 'warn' | 'crit'; children?: ReactNode; /** opens the detail behind the number */ onClick?: () => void }) {
  const t = { accent: 'bg-accent-soft text-accent', good: 'bg-good-bg text-good', warn: 'bg-warn-bg text-warn', crit: 'bg-crit-bg text-crit' }[tone];
  const cls = 'fade-up group relative flex min-h-[132px] flex-col rounded-2xl border border-line bg-surface p-4 shadow-card';
  const body = (
    <>
      <div className="flex items-center justify-between gap-2"><span className="text-[13px] font-medium text-muted">{label}</span><span className={cn('grid size-7 shrink-0 place-items-center rounded-lg', t)}><Icon className="size-3.5" /></span></div>
      <b className="num mt-2 text-[28px] leading-none font-semibold tracking-tight">{value}</b>
      {sub && <span className="mt-1.5 text-xs text-muted">{sub}</span>}
      {children && <div className="mt-auto pt-2">{children}</div>}
      {onClick && <ArrowLeft aria-hidden="true" className="absolute bottom-3 end-3 size-4 text-muted opacity-0 transition group-hover:opacity-100 print:hidden" />}
    </>
  );
  return onClick ? <button type="button" onClick={onClick} className={cls + ' w-full cursor-pointer text-start transition hover:border-accent/50 hover:shadow-md'}>{body}</button> : <div className={cls}>{body}</div>;
}

type Kind = 'rate' | 'pieces' | 'shipped' | 'cancelled' | 'blocked' | 'old' | 'neg' | 'dead' | 'out' | 'low' | 'team';
/** the item lists an alert opens straight from its address (?sheet=…), from this page or from the bell */
const SHEETS: Kind[] = ['out', 'low', 'neg', 'dead'];
/** The detail behind a card of the analytics: the orders or the items the number is made of. */
function InsightSheet({ d, st, kind, range, onClose }: { d: Derived; st: Stats; kind: Kind; range: Range | null; onClose: () => void }) {
  const pd = (o: Order) => d.pickupDate.get(o.pickupId) ?? '';
  const dateCol = { head: 'تاريخ البيك أب', cell: (o: Order) => <span className="num">{pd(o) || '—'}</span> };
  const shipCol = { head: 'اتشحن', cell: (o: Order) => <span className="num">{o.shippedAt ? `${cairoDay(o.shippedAt)} · ${timeCairo(o.shippedAt)}` : '—'}</span> };
  const label = range ? `${range.from} → ${range.to}` : '';
  if (kind === 'rate') return <OrdersDetail d={d} title="نسبة الشحن" hint={`أوردرات الفترة ${label}: اتشحن منها ${fmt(st.shipped.length)} من ${fmt(st.live.length)}.`} orders={st.live} onClose={onClose}
    chips={[{ id: 'shipped', label: 'مشحون', test: (o) => o.status === 'shipped' }, { id: 'wait', label: 'لسه', test: (o) => o.status !== 'shipped' }]} cols={[dateCol, shipCol]} />;
  if (kind === 'pieces') return <OrdersDetail d={d} title="القطع المطلوبة" hint={`${fmt(st.pieces)} قطعة في ${fmt(st.live.length)} أوردر · ${label}`} orders={st.live} startTab="items" onClose={onClose} cols={[dateCol]} />;
  if (kind === 'shipped') return <OrdersDetail d={d} title="القطع المشحونة" hint={`${fmt(st.shipped.reduce((a, o) => a + o.lines.length, 0))} قطعة في ${fmt(st.shipped.length)} أوردر · ${label}`} orders={st.shipped} startTab="items" onClose={onClose} cols={[dateCol, shipCol]} />;
  if (kind === 'cancelled') {
    const inRange = d.snap.orders.filter((o) => o.status === 'cancelled' && (!range || (pd(o) >= range.from && pd(o) <= range.to)));
    return <OrdersDetail d={d} title="الأوردرات الملغاة" hint={`أوردرات ألغيت في الفترة ${label}، بسبب وتاريخ كل إلغاء.`} orders={inRange} onClose={onClose}
      cols={[dateCol, { head: 'السبب', cell: (o) => <span className="text-xs">{o.cancel?.reason || '—'}</span> }, { head: 'ألغاه', cell: (o) => <span className="text-xs">{o.cancel ? `${o.cancel.by} · ${cairoDay(o.cancel.at)}` : '—'}</span> }]} />;
  }
  if (kind === 'blocked') {
    const bl = d.open.filter((o) => d.blocked.has(o.ref));
    return <OrdersDetail d={d} title="متوقف بسبب المخزون الآن" hint="الأوردرات اللي ناقص فيها صنف، والصنف الناقص جنب كل واحد." orders={bl} onClose={onClose}
      cols={[dateCol, { head: 'الناقص', cell: (o) => <span className="text-xs text-crit">{(d.blocked.get(o.ref) ?? []).map((x) => `${skuLabel(d.skuMap, x.sku)} (${x.short})`).join('، ')}</span> }]} />;
  }
  if (kind === 'old') return <OrdersDetail d={d} title="من أيام سابقة" hint="أوردرات اتطلبت قبل النهارده ولسه ما اتشحنتش، الأقدم أول." orders={d.open.filter((o) => pd(o) < d.today).sort((a, b) => pd(a).localeCompare(pd(b)))} onClose={onClose}
    cols={[dateCol, { head: 'عمره', cell: (o) => <span className="num">{dayDiff(pd(o), d.today)} يوم</span> }]} />;
  if (kind === 'neg') return <ItemsDetail d={d} title="الرصيد السالب" hint="أصناف شُحن منها أكتر من الرصيد. محتاجة جرد." head={['الجاهز', 'مطلوب مفتوح']} empty="مفيش رصيد سالب."
    rows={st.neg.map((s) => ({ sku: s.id, cells: [<b key="r" className="text-crit">{fmt(qty(d.snap.balances, s.id, 'READY'))}</b>, fmt(d.demand[s.id] ?? 0)] }))} onClose={onClose} />;
  if (kind === 'dead') return <ItemsDetail d={d} title="الأصناف الراكدة" hint={`رصيد جاهز لم يُطلب من ${STAGNANT_DAYS} يوم أو أكتر (بتاريخ البيك أب)، الأكبر رصيدًا أول.`} head={['جاهز', 'آخر طلب', 'من كام يوم']} empty="مفيش أصناف راكدة."
    rows={st.dead.map((x) => ({ sku: x.sku, cells: [fmt(x.ready), x.last || 'لم يُطلب أبدًا', x.idle === null ? '—' : `${x.idle} يوم`] }))} onClose={onClose} />;
  if (kind === 'out') {
    const xs = d.snap.skus.filter((s) => qty(d.snap.balances, s.id, 'READY') <= 0 && (d.demand[s.id] ?? 0) > 0).sort((a, b) => (d.demand[b.id] ?? 0) - (d.demand[a.id] ?? 0));
    return <ItemsDetail d={d} title="أصناف نفدت وعليها طلب مفتوح" hint="مفيش منها جاهز، وفي أوردرات مستنياها. الأكتر طلبًا أول." head={['الجاهز', 'مطلوب مفتوح']} empty="مفيش أصناف نفدت وعليها طلب."
      rows={xs.map((s) => ({ sku: s.id, cells: [<b key="r" className="text-crit">{fmt(qty(d.snap.balances, s.id, 'READY'))}</b>, fmt(d.demand[s.id] ?? 0)] }))} onClose={onClose} />;
  }
  if (kind === 'low') {
    const xs = d.snap.skus.map((s) => { const r = qty(d.snap.balances, s.id, 'READY'); const v = d.velocity[s.id] ?? 0; return { s, r, v, c: v > 0 ? r / v : Infinity }; }).filter((x) => x.r > 0 && x.v > 0 && x.c < 3).sort((a, b) => a.c - b.c);
    return <ItemsDetail d={d} title="أصناف تكفي أقل من 3 أيام" hint={`بسرعة السحب الحالية${d.velocityOK ? '' : ' (تقديرية)'}، الأقل أول.`} head={['الجاهز', 'سحب في اليوم', 'يكفي']} empty="مفيش أصناف قربت تخلص."
      rows={xs.map((x) => ({ sku: x.s.id, cells: [fmt(x.r), (Math.round(x.v * 10) / 10).toString(), <Pill key="c" tone={x.c < 1 ? 'crit' : 'warn'}>{x.c < 1 ? 'أقل من يوم' : `${Math.floor(x.c)} يوم`}</Pill>] }))} onClose={onClose} />;
  }
  // team: every shipped order with who scanned it
  const shipped = d.snap.orders.filter((o) => o.status === 'shipped' && o.shippedBy).sort((a, b) => (b.shippedAt ?? '').localeCompare(a.shippedAt ?? ''));
  const who = [...new Set(shipped.map((o) => o.shippedBy as string))];
  return <OrdersDetail d={d} title="الأوردرات المشحونة" hint="كل الأوردرات اللي خرجت بالإسكان، والموظف اللي سجّلها." orders={shipped} onClose={onClose}
    chips={who.map((w) => ({ id: w, label: w, test: (o: Order) => o.shippedBy === w }))} cols={[{ head: 'الموظف', cell: (o) => o.shippedBy }, shipCol]} />;
}

function Ring({ value }: { value: number }) {
  const r = 16, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 40 40" className="size-8 -rotate-90" role="img" aria-label={`نسبة الشحن ${value}%`}><circle cx="20" cy="20" r={r} fill="none" stroke="var(--chart-track)" strokeWidth="3" />
      <circle cx="20" cy="20" r={r} fill="none" stroke="var(--chart-secondary)" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} className="transition-all duration-700 motion-reduce:transition-none" /></svg>
  );
}

/** A numbered part of the summary: a small heading over its content, so the page reads top-down in blocks. */
function Block({ id, n, title, hint, children }: { id: Part; n: number; title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section id={`part-${id}`} aria-labelledby={`part-${id}-h`} className="grid scroll-mt-36 gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line pb-2">
        <span className="grid size-6 place-items-center rounded-lg bg-accent-soft font-mono text-xs font-semibold text-accent">{n}</span>
        <h2 id={`part-${id}-h`} className="font-display text-lg font-semibold">{title}</h2>{hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Summary({ d, st, cmp, label }: { d: Derived; st: Stats; cmp: Cmp; label: string }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const { cur, prev } = cmp; const rate = cur.rate;
  const decisions: { tone: 'crit' | 'warn' | 'good' | 'accent'; icon: typeof BarChart3; title: string; body: string; to: Part; cta: string }[] = [];
  if (d.blocked.size) decisions.push({ tone: 'crit', icon: PackageX, title: `${d.blocked.size} أوردر متوقف`, body: `${fmt(st.stuckPcs)} قطعة محجوزة بسبب نقص صنف واحد على الأقل في كل أوردر.`, to: 'risk', cta: 'الأصناف المسببة' });
  if (st.sorted.length) decisions.push({ tone: 'accent', icon: Flame, title: `${st.sorted[0][0]} الأكثر طلبًا`, body: `${pct(st.sorted[0][1], st.total)}% من القطع. ${st.n80} موديل من ${st.sorted.length} تصنع 80% من الطلب.`, to: 'demand', cta: 'تحليل الطلب' });
  if (st.dead.length) decisions.push({ tone: 'warn', icon: Gauge, title: `${st.dead.length} صنف راكد`, body: 'عليه رصيد جاهز ولم يُطلب في آخر 14 يومًا.', to: 'risk', cta: 'عرض الراكد' });
  if (!decisions.length) decisions.push({ tone: 'good', icon: Sparkles, title: 'كل شيء على ما يرام', body: 'لا توجد أوردرات متوقفة ولا أصناف تحت الحد.', to: 'demand', cta: 'تحليل الطلب' });
  const toneCls = { crit: 'border-crit-line bg-crit-bg text-crit', warn: 'border-warn-line bg-warn-bg text-warn', good: 'border-good-line bg-good-bg text-good', accent: 'border-line bg-accent-soft text-accent' };
  return (
    <>
      {kind && <InsightSheet d={d} st={st} kind={kind} range={{ from: cmp.cur.from, to: cmp.cur.to }} onClose={() => setKind(null)} />}
      <Block id="kpi" n={1} title="مؤشرات الأداء" hint={`${label} · اضغط على أي رقم لتفاصيله`}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={Truck} label="نسبة الشحن" onClick={() => setKind('rate')} value={<span className="inline-flex items-center gap-2">{rate}%<Ring value={rate} /></span>} sub={`${fmt(cur.shipped)} من ${fmt(cur.orders)} أوردر`} tone="good"><Delta cur={cur.rate} prev={prev.rate} suffix="%" /></Stat>
          <Stat icon={BarChart3} label="القطع المطلوبة" onClick={() => setKind('pieces')} value={fmt(cur.pieces)} sub={`${fmt(cur.orders)} أوردر`}><Delta cur={cur.pieces} prev={prev.pieces} /><Sparkline data={cmp.curDays.map((r) => r.pcs)} labels={cmp.curDays.map((r) => r.day)} height={36} /></Stat>
          <Stat icon={Truck} label="القطع المشحونة" onClick={() => setKind('shipped')} value={fmt(cur.shippedPcs)} sub={`${fmt(cur.shipped)} أوردر`} tone="good"><Delta cur={cur.shippedPcs} prev={prev.shippedPcs} /><Sparkline data={cmp.curDays.map((r) => r.shipPcs)} labels={cmp.curDays.map((r) => r.day)} color={C.ready} height={36} /></Stat>
          <Stat icon={PackageX} label="ملغاة" onClick={() => setKind('cancelled')} value={fmt(cur.cancelled)} sub="أوردر ألغي في الفترة" tone={cur.cancelled ? 'warn' : 'good'}><Delta cur={cur.cancelled} prev={prev.cancelled} upIsGood={false} /></Stat>
        </div>
      </Block>

      <Block id="attention" n={2} title="يحتاج انتباهك" hint="الأهم الأول · اضغط للانتقال للتفاصيل">
        <div className="grid divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {decisions.map((x, i) => (
            <button key={i} type="button" onClick={() => jump(x.to)} className="group flex w-full items-center gap-3 p-4 text-start transition-colors hover:bg-lav">
              <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl border', toneCls[x.tone])}><x.icon className="size-4" /></span>
              <span className="min-w-0 flex-1"><b className="block text-sm text-ink">{x.title}</b><span className="block text-[13px] text-muted">{x.body}</span></span>
              <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-accent max-sm:hidden print:hidden">{x.cta}<ArrowLeft className="size-4 transition group-hover:-translate-x-1" /></span>
            </button>
          ))}
        </div>
      </Block>
    </>
  );
}

/** The trend and the mix of the summary: this period against the one before, the 80/20 models, lines and stock by state. */
function TrendMix({ d, st, cmp, period }: { d: Derived; st: Stats; cmp: Cmp; period: number }) {
  const [metric, setMetric] = useState<'pcs' | 'req' | 'ship'>('req');
  const series = cmp.curDays.map((r, i) => ({ day: r.day, cur: r[metric], prev: cmp.prevDays[i]?.[metric] ?? 0 }));
  return (
    <>
      <Block id="trend" n={4} title="الاتجاه" hint={`${period} يوم مقابل ${period} يوم`}>
        <Deferred minHeight={380}>
        <Card title="الفترة الحالية مقابل السابقة" action={<span className="print:hidden"><Seg value={metric} onChange={setMetric} options={[['req', 'أوردرات'], ['pcs', 'قطع مطلوبة'], ['ship', 'مشحون']]} /></span>}>
          <CompareArea data={series} />
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted"><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-chart-primary" />الحالية (<span dir="ltr">{cmp.cur.from} → {cmp.cur.to}</span>)</span><span><i className="me-1.5 inline-block h-0.5 w-4 border-t-2 border-dashed border-chart-previous align-middle" /> السابقة (<span dir="ltr">{cmp.prev.from} → {cmp.prev.to}</span>)</span></div>
        </Card>
        </Deferred>
      </Block>

      <Block id="mix" n={5} title="التركيبة" hint="منين بييجي الطلب وفين المخزون">
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Deferred minHeight={520}>
          <Card title="باريتو 80/20: الموديلات الأكثر طلبًا" hint={`${st.n80} موديل = 80% من الطلب`}>
            {st.sorted.length ? <Pareto pull={st.pull} /> : <Empty>لا توجد طلبات في الفترة دي.</Empty>}
          </Card>
          </Deferred>
          <div className="grid gap-4">
            <Deferred minHeight={260}><LineCard st={st} /></Deferred>
            <Deferred minHeight={280}><Card title="المخزون حسب الحالة"><StateDonut d={d} compact /></Card></Deferred>
          </div>
        </div>
      </Block>
    </>
  );
}

function Demand({ d, st }: { d: Derived; st: Stats }) {
  const m: Record<string, Record<string, number>> = {}; const col: Record<string, number> = {}; const gov: Record<string, number> = {}; const bk = { '1': 0, '2': 0, '3-4': 0, '5+': 0 };
  // pieces requested per model x size, and per colour inside each cell (shown on hover)
  const byColor: Record<string, Record<string, number>> = {};
  for (const o of st.live) { for (const s of o.lines) { const k = d.skuMap.get(s); if (!k) continue; (m[k.model] ??= {})[k.size] = (m[k.model][k.size] ?? 0) + 1; const cc = (byColor[`${k.model}|${k.size}`] ??= {}); cc[k.color] = (cc[k.color] ?? 0) + 1; col[k.color] = (col[k.color] ?? 0) + 1; } if (o.gov) gov[o.gov] = (gov[o.gov] ?? 0) + 1; const n = o.lines.length; bk[n === 1 ? '1' : n === 2 ? '2' : n <= 4 ? '3-4' : '5+']++; }
  const models = Object.keys(m).sort((a, b) => (st.pull[b] ?? 0) - (st.pull[a] ?? 0)).slice(0, 14); const sizes = d.snap.sizes.filter((z) => models.some((x) => m[x][z]));
  if (!st.live.length) return <Card><Empty>لا توجد أوردرات بعد.</Empty></Card>;
  return (
    <div className="grid gap-4">
      <Card title="خريطة الطلب: الموديل × المقاس" hint="أعلى 14 موديل"><Heatmap models={models} sizes={sizes} value={(x, z) => m[x][z] ?? 0} total={(x) => st.pull[x] ?? 0} breakdown={(x, z) => Object.entries(byColor[`${x}|${z}`] ?? {}).sort((p, q) => q[1] - p[1]).map(([label, n]) => ({ label, n }))} /></Card>
      <Card title="الأصناف الأكثر طلبًا" hint="مع الرصيد الجاهز وكم يكفي">
        <TableWrap><table className="text-sm"><thead><tr>{['', 'الصنف', 'مطلوب', 'طلب مفتوح', 'جاهز', 'يكفي'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{st.hot.map((r, i) => { const k = d.skuMap.get(r.id); return (
            <tr key={r.id} className="hover:bg-lav"><td className={td + ' w-10 font-mono text-muted'}>{i + 1}</td>
              <td className={td}><span className="flex items-center gap-2"><Thumb model={k ? d.modelMap.get(k.model) : undefined} size={36} />{skuLabel(d.skuMap, r.id)}</span></td>
              <td className={td + ' font-mono font-semibold'}>{fmt(r.n)}</td><td className={td + ' font-mono'}>{fmt(r.open)}</td><td className={td + ' font-mono'}>{fmt(r.ready)}</td>
              <td className={td}>{r.cover === null ? <span className="text-muted">—</span> : <Pill tone={r.cover < 7 ? 'crit' : r.cover < 14 ? 'warn' : 'good'}>{Math.round(r.cover)} يوم</Pill>}</td></tr>); })}</tbody></table></TableWrap>
      </Card>
      <Deferred minHeight={280}>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="الألوان" hint="أعلى 8"><HBars rows={topN(col, 8).map(([c, v]) => ({ label: c, value: v }))} color={C.factory} unit="قطع" /></Card>
        <Card title="المحافظات" hint="أعلى 8">{Object.keys(gov).length ? <HBars rows={topN(gov, 8).map(([g, v]) => ({ label: g, value: v }))} color={C.ready} unit="أوردر" /> : <Empty>لا توجد بيانات.</Empty>}</Card>
        <Card title="حجم الأوردر" hint="قطع في الأوردر"><HBars rows={(['1', '2', '3-4', '5+'] as const).map((k) => ({ label: k === '1' ? 'قطعة واحدة' : k === '2' ? 'قطعتان' : `${k} قطع`, value: bk[k] }))} color={C.dirty} unit="أوردر" /></Card>
      </div>
      </Deferred>
    </div>
  );
}

function Risk({ d, st, alerts }: { d: Derived; st: Stats; alerts: RiskAlert[] }) {
  const [openRef, setOpenRef] = useState<string | null>(null); const [cancelRef, setCancelRef] = useState<string | null>(null); const [kind, setKind] = useState<Kind | null>(null);
  const bl = d.open.filter((o) => d.blocked.has(o.ref)); const old = d.open.filter((o) => (d.pickupDate.get(o.pickupId) ?? d.today) < d.today).length;
  const bv: Record<string, { n: number; q: number }> = {}; for (const o of bl) for (const x of d.blocked.get(o.ref) ?? []) { const e = (bv[x.sku] ??= { n: 0, q: 0 }); e.n++; e.q += x.short; }
  const ks = Object.entries(bv).sort((a, b) => b[1].n - a[1].n).slice(0, 10);
  const buckets: Record<string, number> = { 'أقل من 3 أيام': 0, '3 - 7': 0, '7 - 14': 0, '14 - 30': 0, 'أكثر من 30': 0, 'بدون طلب': 0 };
  for (const s of d.snap.skus) { const r = qty(d.snap.balances, s.id, 'READY'); if (!r && !d.demand[s.id]) continue; const v = d.velocity[s.id]; if (!v) { buckets['بدون طلب']++; continue; } const c = r / v; buckets[c < 3 ? 'أقل من 3 أيام' : c < 7 ? '3 - 7' : c < 14 ? '7 - 14' : c < 30 ? '14 - 30' : 'أكثر من 30']++; }
  const tones = [C.scrap, C.scrap, C.dirty, C.ready, C.factory, C.muted];
  return (
    <div className="grid gap-4">
      {kind && <InsightSheet d={d} st={st} kind={kind} range={null} onClose={() => setKind(null)} />}
      <AlertsPanel alerts={alerts} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={PackageX} label="أوردرات متوقفة" onClick={() => setKind('blocked')} value={bl.length} sub={`${fmt(st.stuckPcs)} قطعة`} tone={bl.length ? 'crit' : 'good'} />
        <Stat icon={Truck} label="من أيام سابقة" onClick={() => setKind('old')} value={old} sub="لم تُشحن بعد" tone={old ? 'warn' : 'good'} />
        <Stat icon={AlertTriangle} label="رصيد سالب" onClick={() => setKind('neg')} value={st.neg.length} sub="يحتاج جرد" tone={st.neg.length ? 'crit' : 'good'} />
        <Stat icon={Gauge} label="أصناف راكدة" onClick={() => setKind('dead')} value={st.dead.length} sub={`لم يُطلب من ${STAGNANT_DAYS} يوم أو أكتر`} tone={st.dead.length ? 'warn' : 'good'} />
      </div>
      <Deferred minHeight={300}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="الأصناف الأكثر تسببًا في التوقف" hint="توفيرها يحرك أوردرات أكثر">{ks.length ? <HBars rows={ks.map(([s, e]) => ({ label: skuLabel(d.skuMap, s), value: e.n }))} color={C.scrap} unit="أوردر متوقف" /> : <Alert tone="good">لا توجد أوردرات متوقفة بسبب الرصيد.</Alert>}</Card>
        <Card title="الأصناف حسب أيام التغطية" hint={d.velocityOK ? '' : 'تقديري'}><HBars rows={Object.entries(buckets).map(([k, v], i) => ({ label: k, value: v, color: tones[i] }))} unit="صنف" /></Card>
      </div>
      </Deferred>
      <Deferred minHeight={300}>
      {bl.length > 0 && <Card title="الأوردرات المتوقفة"><TableWrap><table className="text-sm"><thead><tr>{['البوليصة', 'تاريخ البيك أب', 'قطع', 'الناقص فيه', 'عمره (يوم)'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead><tbody>{bl.slice(0, 25).map((o) => <tr key={o.ref} className="cursor-pointer hover:bg-lav" onClick={() => setOpenRef(o.ref)}><td className={td + ' font-mono text-accent underline-offset-2 hover:underline'}>{o.ref}</td><td className={td + ' font-mono text-muted'}>{d.pickupDate.get(o.pickupId) ?? '—'}</td><td className={td + ' font-mono'}>{o.lines.length}</td><td className={td}>{(d.blocked.get(o.ref) ?? []).map((x) => <span key={x.sku} className="m-0.5 inline-block"><Pill tone="crit">{skuLabel(d.skuMap, x.sku)} ×{x.short}</Pill></span>)}</td><td className={td + ' font-mono'}>{Math.max(0, Math.round((Date.parse(d.today) - Date.parse(d.pickupDate.get(o.pickupId) ?? d.today)) / 864e5))}</td></tr>)}</tbody></table></TableWrap></Card>}
      </Deferred>
      {openRef && <OrderSheet d={d} orderRef={openRef} onClose={() => setOpenRef(null)} onCancel={(c) => { setOpenRef(null); setCancelRef(c); }} />}
      {cancelRef && <CancelSheet d={d} initial={cancelRef} onClose={() => setCancelRef(null)} />}
      <Deferred minHeight={260}>
      <Card title="أكبر الأصناف الراكدة" hint={`رصيد جاهز لم يُطلب من ${STAGNANT_DAYS} يوم أو أكتر`}>{st.dead.length ? <TableWrap><table className="text-sm"><thead><tr><th className={th}>الصنف</th><th className={th}>جاهز</th><th className={th}>آخر طلب</th></tr></thead><tbody>{st.dead.slice(0, 10).map((s) => <tr key={s.sku}><td className={td}>{skuLabel(d.skuMap, s.sku)}</td><td className={td + ' font-mono'}>{fmt(s.ready)}</td><td className={td + ' font-mono text-muted'}>{s.last || 'لم يُطلب'}</td></tr>)}</tbody></table></TableWrap> : <Empty>لا يوجد.</Empty>}</Card>
      </Deferred>
    </div>
  );
}

function Team({ d, st }: { d: Derived; st: Stats }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const e: Record<string, { o: number; p: number; days: Set<string> }> = {}; const pivot: Record<string, Record<string, number>> = {}; let last = '';
  for (const o of d.snap.orders) if (o.status === 'shipped' && o.shippedBy && o.shippedAt) { const x = (e[o.shippedBy] ??= { o: 0, p: 0, days: new Set() }); x.o++; x.p += o.lines.length; const day = o.shippedAt.slice(0, 10); x.days.add(day); (pivot[day] ??= {})[o.shippedBy] = (pivot[day][o.shippedBy] ?? 0) + 1; last = o.shippedAt > last ? o.shippedAt : last; }
  const ks = Object.keys(e).sort((a, b) => e[b].o - e[a].o); const tot = ks.reduce((a, k) => a + e[k].o, 0);
  if (!ks.length) return <Card><Empty>لا توجد أوردرات مشحونة بعد. بعد أول ملف سكان تظهر هنا إحصائيات الموظفين.</Empty></Card>;
  const days = Object.keys(pivot).sort().slice(-10).reverse();
  return (
    <div className="grid gap-4">
      {kind && <InsightSheet d={d} st={st} kind={kind} range={null} onClose={() => setKind(null)} />}
      <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-2"><Stat icon={Users} label="موظفون" value={ks.length} onClick={() => setKind('team')} /><Stat icon={Truck} label="أوردرات مشحونة" value={fmt(tot)} tone="good" onClick={() => setKind('team')} /><Stat icon={Gauge} label="آخر تسجيل" value={timeCairo(last)} /></div>
      <Deferred minHeight={300}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="الأوردرات حسب الموظف"><HBars rows={ks.map((k) => ({ label: k, value: e[k].o }))} color={C.ready} unit="أوردر" /></Card>
        <Card title="التفاصيل"><TableWrap><table className="text-sm"><thead><tr>{['الموظف', 'أوردرات', 'قطع', 'أيام', 'متوسط/يوم'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead><tbody>{ks.map((k) => <tr key={k}><td className={td}>{k}</td><td className={td + ' font-mono'}>{e[k].o} <span className="text-muted">({pct(e[k].o, tot)}%)</span></td><td className={td + ' font-mono'}>{e[k].p}</td><td className={td + ' font-mono'}>{e[k].days.size}</td><td className={td + ' font-mono'}>{Math.round(e[k].o / e[k].days.size)}</td></tr>)}</tbody></table></TableWrap></Card>
      </div>
      </Deferred>
      <Deferred minHeight={260}>
      <Card title="كل يوم" hint="عدد الأوردرات المسجّلة"><TableWrap><table className="text-sm"><thead><tr><th className={th}>اليوم</th>{ks.map((k) => <th key={k} className={th}>{k}</th>)}</tr></thead><tbody>{days.map((x) => <tr key={x}><td className={td + ' font-mono'}>{x}</td>{ks.map((k) => <td key={k} className={td + ' font-mono'}>{pivot[x][k] ?? <span className="text-muted">·</span>}</td>)}</tr>)}</tbody></table></TableWrap></Card>
      </Deferred>
      <p className="text-xs text-muted">وقت الإسكان هو وقت رفع الملف وليس وقت التغليف، فلا تقيّم به السرعة.</p>
    </div>
  );
}

function AlertsPanel({ alerts }: { alerts: RiskAlert[] }) {
  const nav = useNavigate();
  const cls = { crit: 'border-crit-line bg-crit-bg', warn: 'border-warn-line bg-warn-bg', info: 'border-info-line bg-info-bg' };
  const ico = { crit: 'bg-crit text-on-accent', warn: 'bg-warn text-on-accent', info: 'bg-info text-on-accent' };
  const lbl = { crit: 'عاجل', warn: 'انتبه', info: 'للعلم' };
  const n = alerts.filter((a) => a.level === 'crit').length;
  return (
    <Card title={<span className="flex items-center gap-2"><Bell className="size-4" /> تنبيهات تستدعي التدخل</span>} hint={alerts.length ? `${n} عاجل · ${alerts.length} إجمالي` : ''}>
      {!alerts.length ? <Alert tone="good">لا توجد مؤشرات خطر حاليًا. المخزون والأوردرات في وضع سليم.</Alert> : (
        <div className="grid gap-2">{alerts.map((a, i) => (
          <div key={i} className={cn('grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border p-3', cls[a.level])}>
            <span className={cn('grid size-9 place-items-center rounded-xl', ico[a.level])}>{a.level === 'info' ? <Bell className="size-4" /> : <AlertTriangle className="size-4" />}</span>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><b className="text-ink">{a.title}</b><Pill tone={a.level === 'info' ? 'info' : a.level}>{lbl[a.level]}</Pill></div><span className="text-[13px] text-muted">{a.body}</span></div>
            <Button size="sm" className="print:hidden" onClick={() => nav(a.to)}>{a.cta}</Button>
          </div>))}</div>
      )}
    </Card>
  );
}

/** Sheets for the Excel export: the comparison is always included, plus the rows of the open section. */
function buildSheets(sec: Sec, d: Derived, st: Stats, cmp: Cmp, alerts: RiskAlert[]): ExportSheet[] {
  if (sec === 'finance') return financialSheets(d.snap);
  const ch = (a: number, b: number) => { const c = change(a, b); return c === null ? '—' : `${c > 0 ? '+' : ''}${c}%`; };
  const { cur, prev } = cmp;
  const sheets: ExportSheet[] = [{ name: 'المقارنة', rows: [
    ['المؤشر', `الحالية (${cur.from} → ${cur.to})`, `السابقة (${prev.from} → ${prev.to})`, 'التغير'],
    ['أوردرات مطلوبة', cur.orders, prev.orders, ch(cur.orders, prev.orders)],
    ['قطع مطلوبة', cur.pieces, prev.pieces, ch(cur.pieces, prev.pieces)],
    ['أوردرات مشحونة', cur.shipped, prev.shipped, ch(cur.shipped, prev.shipped)],
    ['قطع مشحونة', cur.shippedPcs, prev.shippedPcs, ch(cur.shippedPcs, prev.shippedPcs)],
    ['نسبة الشحن %', cur.rate, prev.rate, ch(cur.rate, prev.rate)],
    ['ملغاة', cur.cancelled, prev.cancelled, ch(cur.cancelled, prev.cancelled)],
  ] }, { name: 'يومي', rows: [['اليوم', 'قطع مطلوبة', 'أوردرات', 'مشحون', 'اليوم المقابل', 'قطع مطلوبة (سابقة)'], ...cmp.curDays.map((r, i) => [r.day, r.pcs, r.req, r.ship, cmp.prevDays[i]?.day ?? '', cmp.prevDays[i]?.pcs ?? 0])] }];
  if (sec === 'summary') {   // the summary holds demand, risk and team now
    sheets.push({ name: 'باريتو', rows: [['الموديل', 'قطع', '% من الطلب'], ...st.sorted.map(([m, v]) => [m, v, pct(v, st.total)])] });
    sheets.push({ name: 'الأكثر طلبا', rows: [['الصنف', 'مطلوب', 'طلب مفتوح', 'جاهز', 'يكفي (يوم)'], ...st.hot.map((r) => [skuLabel(d.skuMap, r.id), r.n, r.open, r.ready, r.cover === null ? '—' : Math.round(r.cover)])] });
  }
  if (sec === 'summary') {
    sheets.push({ name: 'التنبيهات', rows: [['المستوى', 'التنبيه', 'التفاصيل'], ...alerts.map((a) => [a.level === 'crit' ? 'عاجل' : a.level === 'warn' ? 'انتبه' : 'للعلم', a.title, a.body])] });
    sheets.push({ name: 'المتوقف', rows: [['البوليصة', 'رقم الأوردر', 'تاريخ البيك أب', 'قطع', 'الناقص'], ...d.open.filter((o) => d.blocked.has(o.ref)).map((o) => [o.ref, o.waybill, d.pickupDate.get(o.pickupId) ?? '', o.lines.length, (d.blocked.get(o.ref) ?? []).map((x) => `${skuLabel(d.skuMap, x.sku)} ×${x.short}`).join('، ')])] });
  }
  if (sec === 'whday') {
    // every order on the day it left the warehouse, whatever day its money came on
    const days = warehouseDays(d.snap, cur.from, cur.to);
    const open = days.filter((x) => x.pending > 0).sort((a, b) => a.day.localeCompare(b.day));
    const closed = days.filter((x) => !x.pending).sort((a, b) => b.closedOn.localeCompare(a.closedOn) || b.day.localeCompare(a.day));
    const collectedAt = (x: (typeof days)[number]) => x.paidOn.map((p) => `${p.date} (${p.n})`).join('، ');
    const head = ['يوم الخروج', 'أوردرات', 'قطع', 'اتحصّل', 'التوريد', 'رجع', 'قطع رجعت', 'لسه', 'قطع لسه', 'اتحصّل في تسويات'];
    const cells = (x: (typeof days)[number]) => [x.day, x.orders, x.pieces, x.collected, x.due, x.returned, x.returnedPieces, x.pending, x.pendingPieces, collectedAt(x)];
    sheets.push({ name: 'أيام لسه مفتوحة', rows: [[...head, 'عدّى كام يوم', 'متأخر'], ...open.map((x) => { const age = dayDiff(x.day, d.today); return [...cells(x), age, lateLevel(age) === 2 ? 'متأخر جدًا (10+)' : lateLevel(age) === 1 ? 'متأخر (7+)' : '']; })] });
    sheets.push({ name: 'أيام اتقفلت', rows: [[...head, 'اتقفل يوم', 'بعد كام يوم'], ...closed.map((x) => [...cells(x), x.closedOn, Math.max(0, dayDiff(x.day, x.closedOn))])] });
    sheets.push({ name: 'أوردرات الأيام', rows: [['يوم الخروج', 'البوليصة', 'رقم الأوردر', 'قطع', 'الحالة', 'اتقفل يوم', 'التوريد', 'التسوية'],
      ...days.flatMap((x) => x.list.map((w) => [x.day, w.ref, w.waybill, w.pieces, w.state === 'collected' ? 'اتحصّل' : w.state === 'returned' ? 'رجع' : 'لسه', w.closedOn, w.due, w.stl.join('، ')]))] });
  }
  if (sec === 'summary' || sec === 'collect') {
    // the settlement sheets of the period, and what is shipped and not collected yet
    const inRange = (d.snap.settles ?? []).filter((s) => s.date >= cur.from && s.date <= cur.to).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const n = (s: { rows: { type: string }[] }, t: string) => s.rows.filter((r) => r.type === t).length;
    sheets.push({ name: 'التسويات', rows: [['التاريخ', 'الرقم', 'الأوردرات', 'اتحصّل', 'رجع', 'جزئي / استبدال', 'التوريد', 'رفعه'],
      ...inRange.map((s) => [s.date, s.id, s.rows.length, n(s, 'collect'), n(s, 'return'), n(s, 'partial'), s.totals.due, s.by]),
      ['الإجمالي', `${inRange.length} تسوية`, inRange.reduce((a, s) => a + s.rows.length, 0), '', '', '', inRange.reduce((a, s) => a + s.totals.due, 0), '']] });
    const waiting = d.snap.orders.filter((o) => o.status === 'shipped' && !o.returned && !d.collected.has(o.ref) && !d.settleReturned.has(o.ref))
      .map((o) => ({ o, day: o.shippedAt ? cairoDay(o.shippedAt) : '' })).sort((a, b) => a.day.localeCompare(b.day));
    sheets.push({ name: 'لسه ما اتحصلش', rows: [['البوليصة', 'رقم الأوردر', 'تاريخ البيك أب', 'اتشحن', 'قطع'], ...waiting.map(({ o, day }) => [o.ref, o.waybill, d.pickupDate.get(o.pickupId) ?? '', day, o.lines.length])] });
  }
  if (sec === 'summary') {
    const e: Record<string, { o: number; p: number }> = {};
    for (const o of d.snap.orders) if (o.status === 'shipped' && o.shippedBy) { const x = (e[o.shippedBy] ??= { o: 0, p: 0 }); x.o++; x.p += o.lines.length; }
    sheets.push({ name: 'الفريق', rows: [['الموظف', 'أوردرات', 'قطع'], ...Object.entries(e).sort((a, b) => b[1].o - a[1].o).map(([k, v]) => [k, v.o, v.p])] });
  }
  return sheets;
}

/** Demand (in the chosen period) or ready stock (now) per production line, in aligned rows. */
function LineCard({ st }: { st: Stats }) {
  const [view, setView] = useState<'demand' | 'stock'>('demand');
  const src = view === 'demand' ? st.byLine : st.stockLine;
  const rows = Object.entries(src).sort((a, b) => b[1] - a[1]).map(([l, v]) => ({ label: l, value: v, color: LINE_COLOR[l] ?? C.dirty }));
  return (
    <Card title={view === 'demand' ? 'الطلب حسب خط الإنتاج' : 'المخزون حسب خط الإنتاج'} hint={view === 'demand' ? 'قطع مطلوبة في الفترة' : 'جاهز للبيع دلوقتي'} action={<Seg value={view} onChange={setView} options={[['demand', 'الطلب'], ['stock', 'المخزون']]} />}>
      {rows.length ? <ShareRows rows={rows} unit="قطعة" /> : <Empty>{view === 'demand' ? 'لا توجد طلبات في الفترة دي.' : 'لا يوجد مخزون جاهز.'}</Empty>}
    </Card>
  );
}
