import { addDays } from '@/femini/domain/dates';
import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowLeft, ArrowUpRight, BarChart3, Bell, FileDown, FileSpreadsheet, Flame, Gauge, PackageX, Sparkles, Truck, Users } from 'lucide-react';
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
import { timeCairo } from '@/femini/domain/dates';
import { skuLabel } from '@/femini/domain/orders';
import { cn, fmt, pct } from '@/femini/cn';
import type { Derived } from '@/femini/hooks/data';
import { FinancialReport, financialSheets } from '@/femini/components/FinancialReport';
import { Deferred } from '@/femini/components/Deferred';

const lineOf = (m: string) => (/^PAN/.test(m) ? 'بانتي' : /^BR/.test(m) ? 'برا' : /^SH/.test(m) ? 'شورت' : 'موديلات أخرى');
const LINE_COLOR: Record<string, string> = { بانتي: C.accent, برا: C.scrap, شورت: C.factory, 'موديلات أخرى': C.dirty };
const topN = (o: Record<string, number>, n: number) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);

type Sec = 'summary' | 'demand' | 'risk' | 'team' | 'finance';
const SECTIONS: { id: Sec; label: string; icon: typeof BarChart3 }[] = [
  { id: 'summary', label: 'الملخص', icon: Sparkles },
  { id: 'demand', label: 'الطلب', icon: Flame },
  { id: 'risk', label: 'المخاطر', icon: AlertTriangle },
  { id: 'team', label: 'الفريق', icon: Users },
  { id: 'finance', label: 'القيمة المالية', icon: FileSpreadsheet },
];

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
    const dead = d.snap.skus.filter((s) => qty(d.snap.balances, s.id, 'READY') > 0 && !d.velocity[s.id]);
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
  const sec = (SECTIONS.some((s) => s.id === sp.get('tab')) ? sp.get('tab') : 'summary') as Sec;
  const go = (v: Sec) => { const p = new URLSearchParams(sp); if (v === 'summary') p.delete('tab'); else p.set('tab', v); setSp(p, { replace: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const period = (PERIODS.find((x) => String(x) === sp.get('p')) ?? 14) as Period;
  // a chosen date range (from / to in the address) replaces the ready-made periods
  const iso = /^\d{4}-\d{2}-\d{2}$/; const fromP = sp.get('from') ?? '', toP = sp.get('to') ?? '';
  const custom = !!d && iso.test(fromP) && iso.test(toP) && fromP <= toP && toP <= d.today;
  const range = useMemo<Range | null>(() => (d ? (custom ? { from: fromP, to: toP } : lastDays(d.today, period)) : null), [d, custom, fromP, toP, period]);
  const days = range ? rangeDays(range) : period;
  const rangeLabel = custom ? `${fromP} → ${toP} (${days} يوم)` : `آخر ${period} يوم`;
  const setParam = (k: string, v: string | null) => { const p = new URLSearchParams(sp); if (v === null) p.delete(k); else p.set(k, v); setSp(p, { replace: true }); };
  const st = useStats(d, range);
  const cmp = useMemo(() => (d && range ? comparePeriods(d, range) : null), [d, range]);
  const alerts = useMemo(() => (d && cmp ? riskAlerts(d, cmp) : []), [d, cmp]);
  const toast = useToast();
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !d || !st || !cmp) return <Spinner />;
  const counts: Partial<Record<Sec, number>> = { risk: alerts.filter((a) => a.level === 'crit').length };
  const secLabel = SECTIONS.find((x) => x.id === sec)?.label ?? 'الملخص';
  const periodLabel = sec === 'finance' ? `الأرصدة الحالية حتى ${d.today} · التكلفة المسجلة حاليًا` : `${custom ? 'من' : `آخر ${period} يوم`} (${cmp.cur.from} → ${cmp.cur.to}) مقارنةً بـ ${cmp.prev.from} → ${cmp.prev.to}`;
  const filters = 'بدون فلاتر إضافية';
  const doExcel = () => exportExcel({ section: secLabel, period: periodLabel, filters, date: d.today }, buildSheets(sec, d, st, cmp, alerts))
    .then(() => toast('تم تصدير ملف Excel'), () => toast('تعذّر التصدير', { tone: 'err' }));
  return (
    <>
      <PageHead title="التحليلات" sub="قرارات مبنية على الطلب الفعلي ودفتر الحركات — في مكان واحد.">
        {!d.velocityOK && <Pill tone="warn">بيانات {d.days} يوم فقط · السرعة تقديرية</Pill>}
        <div className="flex items-center gap-2 print:hidden">
          {sec !== 'finance' && <Seg<string> label="الفترة" value={custom ? '' : String(period)} onChange={(v) => { const p = new URLSearchParams(sp); p.delete('from'); p.delete('to'); if (v === '14') p.delete('p'); else p.set('p', v); setSp(p, { replace: true }); }} options={PERIODS.map((x) => [String(x), `${x} يوم`] as [string, string])} />}
          {sec !== 'finance' && <span className="flex items-center gap-1 text-xs text-muted" aria-label="فترة بالتاريخ">من
            <input type="date" className="h-9 w-36" value={range?.from ?? ''} max={range?.to ?? d.today} onChange={(e) => { if (!e.target.value) return; const p = new URLSearchParams(sp); p.set('from', e.target.value); p.set('to', range?.to ?? d.today); setSp(p, { replace: true }); }} />
            لـ <input type="date" className="h-9 w-36" value={range?.to ?? ''} min={range?.from} max={d.today} onChange={(e) => { if (!e.target.value) return; const p = new URLSearchParams(sp); p.set('from', range?.from ?? e.target.value); p.set('to', e.target.value); setSp(p, { replace: true }); }} /></span>}
          <Button onClick={doExcel}><FileSpreadsheet className="size-4" /> Excel</Button>
          <Button onClick={() => window.print()}><FileDown className="size-4" /> PDF</Button>
        </div>
      </PageHead>
      <div className="mb-4 hidden rounded-xl border border-line p-3 text-xs print:block">
        <b>Fémini Stock · تقرير التحليلات — {secLabel}</b>
        <div>الفترة: {periodLabel}</div><div>الفلاتر: {filters}</div><div>تاريخ التصدير: {d.today}</div>
      </div>

      <nav aria-label="أقسام التحليلات" className="print:hidden sticky top-[57px] z-10 -mx-1 mb-6 grid grid-cols-5 gap-1 rounded-2xl border border-line bg-surface/90 p-1 shadow-card backdrop-blur max-sm:overflow-x-auto max-sm:grid-cols-none max-sm:grid-flow-col max-sm:auto-cols-[minmax(128px,1fr)]">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <Button key={id} variant={sec === id ? 'primary' : 'ghost'} onClick={() => go(id)} aria-pressed={sec === id}
            className={cn('group flex h-auto items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition', sec === id ? 'bg-accent text-on-accent' : 'text-ink hover:bg-lav')}>
            <Icon className="size-[18px] shrink-0" />
            {/* the count sits right next to its own label, so it cannot be read as the neighbour's */}
            <span className="inline-flex min-w-0 items-center gap-1.5"><span className="truncate">{label}</span>{counts[id] ? <span aria-label={`${counts[id]} عاجل`} className={cn('grid min-w-5 place-items-center rounded-full px-1.5 font-mono text-[11px] leading-5', sec === id ? 'bg-on-accent/25' : 'bg-crit text-on-accent')}>{counts[id]}</span> : null}</span>
          </Button>
        ))}
      </nav>

      {sec === 'summary' && <Summary d={d} st={st} cmp={cmp} period={days} label={rangeLabel} go={go} />}
      {sec === 'demand' && <Demand d={d} st={st} />}
      {sec === 'risk' && <Risk d={d} st={st} alerts={alerts} />}
      {sec === 'team' && <Team d={d} />}
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

function Stat({ icon: Icon, label, value, sub, tone = 'accent', children }: { icon: typeof BarChart3; label: string; value: ReactNode; sub?: ReactNode; tone?: 'accent' | 'good' | 'warn' | 'crit'; children?: ReactNode }) {
  const t = { accent: 'bg-accent-soft text-accent', good: 'bg-good-bg text-good', warn: 'bg-warn-bg text-warn', crit: 'bg-crit-bg text-crit' }[tone];
  return (
    <div className="fade-up relative grid content-start rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center gap-2.5"><span className={cn('grid size-9 place-items-center rounded-xl', t)}><Icon className="size-[18px]" /></span><span className="text-[13px] font-medium text-muted">{label}</span></div>
      <b className="num mt-3 text-[30px] leading-none font-semibold tracking-tight">{value}</b>
      {sub && <span className="mt-1.5 text-xs text-muted">{sub}</span>}
      {children}
    </div>
  );
}

function Ring({ value }: { value: number }) {
  const r = 16, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 40 40" className="size-11 -rotate-90" role="img" aria-label={`نسبة الشحن ${value}%`}><circle cx="20" cy="20" r={r} fill="none" stroke="var(--chart-track)" strokeWidth="3" />
      <circle cx="20" cy="20" r={r} fill="none" stroke="var(--chart-secondary)" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} className="transition-all duration-700 motion-reduce:transition-none" /></svg>
  );
}

function Summary({ d, st, cmp, period, label, go }: { d: Derived; st: Stats; cmp: Cmp; period: number; label: string; go: (s: Sec) => void }) {
  const [metric, setMetric] = useState<'pcs' | 'req' | 'ship'>('pcs');
  const { cur, prev } = cmp; const rate = cur.rate;
  const series = cmp.curDays.map((r, i) => ({ day: r.day, cur: r[metric], prev: cmp.prevDays[i]?.[metric] ?? 0 }));
  const decisions: { tone: 'crit' | 'warn' | 'good' | 'accent'; icon: typeof BarChart3; title: string; body: string; to: Sec; cta: string }[] = [];
  if (d.blocked.size) decisions.push({ tone: 'crit', icon: PackageX, title: `${d.blocked.size} أوردر متوقف`, body: `${fmt(st.stuckPcs)} قطعة محجوزة بسبب نقص صنف واحد على الأقل في كل أوردر.`, to: 'risk', cta: 'الأصناف المسببة' });
  if (st.sorted.length) decisions.push({ tone: 'accent', icon: Flame, title: `${st.sorted[0][0]} الأكثر طلبًا`, body: `${pct(st.sorted[0][1], st.total)}% من القطع. ${st.n80} موديل من ${st.sorted.length} تصنع 80% من الطلب.`, to: 'demand', cta: 'تحليل الطلب' });
  if (st.dead.length) decisions.push({ tone: 'warn', icon: Gauge, title: `${st.dead.length} صنف راكد`, body: 'عليه رصيد جاهز ولم يُطلب في آخر 14 يومًا.', to: 'risk', cta: 'عرض الراكد' });
  if (!decisions.length) decisions.push({ tone: 'good', icon: Sparkles, title: 'كل شيء على ما يرام', body: 'لا توجد أوردرات متوقفة ولا أصناف تحت الحد.', to: 'demand', cta: 'تحليل الطلب' });
  const toneCls = { crit: 'border-crit-line bg-crit-bg text-crit', warn: 'border-warn-line bg-warn-bg text-warn', good: 'border-good-line bg-good-bg text-good', accent: 'border-line bg-accent-soft text-accent' };
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Truck} label="نسبة الشحن" value={`${rate}%`} sub={`${fmt(cur.shipped)} شحنة من ${fmt(cur.orders)} أوردر`} tone="good"><div className="absolute top-4 left-4 max-sm:hidden"><Ring value={rate} /></div><div className="mt-2"><Delta cur={cur.rate} prev={prev.rate} suffix="%" /></div></Stat>
        <Stat icon={BarChart3} label="القطع المطلوبة" value={fmt(cur.pieces)} sub={`${fmt(cur.orders)} أوردر · ${label}`}><div className="mt-2"><Delta cur={cur.pieces} prev={prev.pieces} /></div><Sparkline data={cmp.curDays.map((r) => r.pcs)} labels={cmp.curDays.map((r) => r.day)} /></Stat>
        <Stat icon={Truck} label="القطع المشحونة" value={fmt(cur.shippedPcs)} sub={`${fmt(cur.shipped)} أوردر`} tone="good"><div className="mt-2"><Delta cur={cur.shippedPcs} prev={prev.shippedPcs} /></div><Sparkline data={cmp.curDays.map((r) => r.shipPcs)} labels={cmp.curDays.map((r) => r.day)} color={C.ready} /></Stat>
        <Stat icon={PackageX} label="ملغاة" value={fmt(cur.cancelled)} sub="أوردرات ألغيت في الفترة" tone={cur.cancelled ? 'warn' : 'good'}><div className="mt-2"><Delta cur={cur.cancelled} prev={prev.cancelled} upIsGood={false} /></div></Stat>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={PackageX} label="متوقف بسبب المخزون الآن" value={fmt(d.blocked.size)} sub={`${fmt(st.stuckPcs)} قطعة`} tone={d.blocked.size ? 'crit' : 'good'} />
        <Stat icon={Gauge} label="أصناف راكدة" value={fmt(st.dead.length)} sub="رصيد جاهز بلا طلب" tone={st.dead.length ? 'warn' : 'good'} />
      </div>

      <div>
        <h2 className="mb-3 font-display text-[15px] font-semibold">قرارات تحتاج انتباهك</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {decisions.map((x, i) => (
            <button key={i} type="button" onClick={() => go(x.to)} className={cn('fade-up group grid content-start gap-2 rounded-2xl border p-4 text-start transition hover:-translate-y-0.5 hover:shadow-card', toneCls[x.tone])}>
              <x.icon className="size-5" />
              <b className="text-[15px] text-ink">{x.title}</b>
              <span className="text-[13px] text-muted">{x.body}</span>
              <span className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold">{x.cta}<ArrowLeft className="size-4 transition group-hover:-translate-x-1" /></span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Deferred minHeight={400}>
        <Card title="الفترة الحالية مقابل السابقة" hint={`${period} يوم مقابل ${period} يوم`} action={<span className="print:hidden"><Seg value={metric} onChange={setMetric} options={[['pcs', 'قطع مطلوبة'], ['req', 'أوردرات'], ['ship', 'مشحون']]} /></span>}>
          <CompareArea data={series} />
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted"><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-chart-primary" />الفترة الحالية ({cmp.cur.from} → {cmp.cur.to})</span><span><i className="me-1.5 inline-block h-0.5 w-4 border-t-2 border-dashed border-chart-previous align-middle" /> الفترة السابقة ({cmp.prev.from} → {cmp.prev.to})</span></div>
        </Card>
        </Deferred>
        <Deferred minHeight={300}>
        <LineCard st={st} />
        </Deferred>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Deferred minHeight={420}>
        <Card title="باريتو 80/20: الموديلات الأكثر طلبًا" hint={`${st.n80} موديل = 80% من الطلب`}>
          {st.sorted.length ? <Pareto pull={st.pull} /> : <Empty>لا توجد طلبات في الفترة دي.</Empty>}
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted"><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-chart-primary" />فئة A</span><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-dirty" />فئة B</span><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-chart-previous" />فئة C</span><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-scrap" />تراكمي</span></div>
        </Card>
        </Deferred>
        <Deferred minHeight={280}>
        <Card title="المخزون حسب الحالة"><StateDonut d={d} compact /></Card>
        </Deferred>
      </div>
    </div>
  );
}

function Demand({ d, st }: { d: Derived; st: Stats }) {
  const m: Record<string, Record<string, number>> = {}; const col: Record<string, number> = {}; const gov: Record<string, number> = {}; const bk = { '1': 0, '2': 0, '3-4': 0, '5+': 0 };
  for (const o of st.live) { for (const s of o.lines) { const k = d.skuMap.get(s); if (!k) continue; (m[k.model] ??= {})[k.size] = (m[k.model][k.size] ?? 0) + 1; col[k.color] = (col[k.color] ?? 0) + 1; } if (o.gov) gov[o.gov] = (gov[o.gov] ?? 0) + 1; const n = o.lines.length; bk[n === 1 ? '1' : n === 2 ? '2' : n <= 4 ? '3-4' : '5+']++; }
  const models = Object.keys(m).sort((a, b) => (st.pull[b] ?? 0) - (st.pull[a] ?? 0)).slice(0, 14); const sizes = d.snap.sizes.filter((z) => models.some((x) => m[x][z]));
  if (!st.live.length) return <Card><Empty>لا توجد أوردرات بعد.</Empty></Card>;
  return (
    <div className="grid gap-4">
      <Card title="خريطة الطلب: الموديل × المقاس" hint="أعلى 14 موديل"><Heatmap models={models} sizes={sizes} value={(x, z) => m[x][z] ?? 0} total={(x) => st.pull[x] ?? 0} /></Card>
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
  const bl = d.open.filter((o) => d.blocked.has(o.ref)); const old = d.open.filter((o) => (d.pickupDate.get(o.pickupId) ?? d.today) < d.today).length;
  const bv: Record<string, { n: number; q: number }> = {}; for (const o of bl) for (const x of d.blocked.get(o.ref) ?? []) { const e = (bv[x.sku] ??= { n: 0, q: 0 }); e.n++; e.q += x.short; }
  const ks = Object.entries(bv).sort((a, b) => b[1].n - a[1].n).slice(0, 10);
  const buckets: Record<string, number> = { 'أقل من 3 أيام': 0, '3 - 7': 0, '7 - 14': 0, '14 - 30': 0, 'أكثر من 30': 0, 'بدون طلب': 0 };
  for (const s of d.snap.skus) { const r = qty(d.snap.balances, s.id, 'READY'); if (!r && !d.demand[s.id]) continue; const v = d.velocity[s.id]; if (!v) { buckets['بدون طلب']++; continue; } const c = r / v; buckets[c < 3 ? 'أقل من 3 أيام' : c < 7 ? '3 - 7' : c < 14 ? '7 - 14' : c < 30 ? '14 - 30' : 'أكثر من 30']++; }
  const tones = [C.scrap, C.scrap, C.dirty, C.ready, C.factory, C.muted];
  return (
    <div className="grid gap-4">
      <AlertsPanel alerts={alerts} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={PackageX} label="أوردرات متوقفة" value={bl.length} sub={`${fmt(st.stuckPcs)} قطعة`} tone={bl.length ? 'crit' : 'good'} />
        <Stat icon={Truck} label="من أيام سابقة" value={old} sub="لم تُشحن بعد" tone={old ? 'warn' : 'good'} />
        <Stat icon={AlertTriangle} label="رصيد سالب" value={st.neg.length} sub="يحتاج جرد" tone={st.neg.length ? 'crit' : 'good'} />
        <Stat icon={Gauge} label="أصناف راكدة" value={st.dead.length} sub="رصيد بلا طلب" tone={st.dead.length ? 'warn' : 'good'} />
      </div>
      <Deferred minHeight={300}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="الأصناف الأكثر تسببًا في التوقف" hint="توفيرها يحرك أوردرات أكثر">{ks.length ? <HBars rows={ks.map(([s, e]) => ({ label: skuLabel(d.skuMap, s), value: e.n }))} color={C.scrap} unit="أوردر متوقف" /> : <Alert tone="good">لا توجد أوردرات متوقفة بسبب الرصيد.</Alert>}</Card>
        <Card title="الأصناف حسب أيام التغطية" hint={d.velocityOK ? '' : 'تقديري'}><HBars rows={Object.entries(buckets).map(([k, v], i) => ({ label: k, value: v, color: tones[i] }))} unit="صنف" /></Card>
      </div>
      </Deferred>
      <Deferred minHeight={300}>
      {bl.length > 0 && <Card title="الأوردرات المتوقفة"><TableWrap><table className="text-sm"><thead><tr>{['الكود', 'قطع', 'الناقص فيه', 'عمره (يوم)'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead><tbody>{bl.slice(0, 25).map((o) => <tr key={o.ref}><td className={td + ' font-mono'}>{o.ref}</td><td className={td + ' font-mono'}>{o.lines.length}</td><td className={td}>{(d.blocked.get(o.ref) ?? []).map((x) => <span key={x.sku} className="m-0.5 inline-block"><Pill tone="crit">{skuLabel(d.skuMap, x.sku)} ×{x.short}</Pill></span>)}</td><td className={td + ' font-mono'}>{Math.max(0, Math.round((Date.parse(d.today) - Date.parse(d.pickupDate.get(o.pickupId) ?? d.today)) / 864e5))}</td></tr>)}</tbody></table></TableWrap></Card>}
      </Deferred>
      <Deferred minHeight={260}>
      <Card title="أكبر الأصناف الراكدة" hint="رصيد جاهز بلا طلب">{st.dead.length ? <TableWrap><table className="text-sm"><thead><tr><th className={th}>الصنف</th><th className={th}>جاهز</th></tr></thead><tbody>{[...st.dead].sort((a, b) => qty(d.snap.balances, b.id, 'READY') - qty(d.snap.balances, a.id, 'READY')).slice(0, 10).map((s) => <tr key={s.id}><td className={td}>{skuLabel(d.skuMap, s.id)}</td><td className={td + ' font-mono'}>{fmt(qty(d.snap.balances, s.id, 'READY'))}</td></tr>)}</tbody></table></TableWrap> : <Empty>لا يوجد.</Empty>}</Card>
      </Deferred>
    </div>
  );
}

function Team({ d }: { d: Derived }) {
  const e: Record<string, { o: number; p: number; days: Set<string> }> = {}; const pivot: Record<string, Record<string, number>> = {}; let last = '';
  for (const o of d.snap.orders) if (o.status === 'shipped' && o.shippedBy && o.shippedAt) { const x = (e[o.shippedBy] ??= { o: 0, p: 0, days: new Set() }); x.o++; x.p += o.lines.length; const day = o.shippedAt.slice(0, 10); x.days.add(day); (pivot[day] ??= {})[o.shippedBy] = (pivot[day][o.shippedBy] ?? 0) + 1; last = o.shippedAt > last ? o.shippedAt : last; }
  const ks = Object.keys(e).sort((a, b) => e[b].o - e[a].o); const tot = ks.reduce((a, k) => a + e[k].o, 0);
  if (!ks.length) return <Card><Empty>لا توجد أوردرات مشحونة بعد. بعد أول ملف سكان تظهر هنا إحصائيات الموظفين.</Empty></Card>;
  const days = Object.keys(pivot).sort().slice(-10).reverse();
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-3"><Stat icon={Users} label="موظفون" value={ks.length} /><Stat icon={Truck} label="أوردرات مشحونة" value={fmt(tot)} tone="good" /><Stat icon={Gauge} label="آخر تسجيل" value={timeCairo(last)} /></div>
      <Deferred minHeight={300}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="الأوردرات حسب الموظف"><HBars rows={ks.map((k) => ({ label: k, value: e[k].o }))} color={C.ready} unit="أوردر" /></Card>
        <Card title="التفاصيل"><TableWrap><table className="text-sm"><thead><tr>{['الموظف', 'أوردرات', 'قطع', 'أيام', 'متوسط/يوم'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead><tbody>{ks.map((k) => <tr key={k}><td className={td}>{k}</td><td className={td + ' font-mono'}>{e[k].o} <span className="text-muted">({pct(e[k].o, tot)}%)</span></td><td className={td + ' font-mono'}>{e[k].p}</td><td className={td + ' font-mono'}>{e[k].days.size}</td><td className={td + ' font-mono'}>{Math.round(e[k].o / e[k].days.size)}</td></tr>)}</tbody></table></TableWrap></Card>
      </div>
      </Deferred>
      <Deferred minHeight={260}>
      <Card title="كل يوم" hint="عدد الأوردرات المسجّلة"><TableWrap><table className="text-sm"><thead><tr><th className={th}>اليوم</th>{ks.map((k) => <th key={k} className={th}>{k}</th>)}</tr></thead><tbody>{days.map((x) => <tr key={x}><td className={td + ' font-mono'}>{x}</td>{ks.map((k) => <td key={k} className={td + ' font-mono'}>{pivot[x][k] ?? <span className="text-muted">·</span>}</td>)}</tr>)}</tbody></table></TableWrap></Card>
      </Deferred>
      <p className="text-xs text-muted">وقت السكان هو وقت رفع الملف وليس وقت التغليف، فلا تقيّم به السرعة.</p>
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
  if (sec === 'summary' || sec === 'demand') {
    sheets.push({ name: 'باريتو', rows: [['الموديل', 'قطع', '% من الطلب'], ...st.sorted.map(([m, v]) => [m, v, pct(v, st.total)])] });
    sheets.push({ name: 'الأكثر طلبا', rows: [['الصنف', 'مطلوب', 'طلب مفتوح', 'جاهز', 'يكفي (يوم)'], ...st.hot.map((r) => [skuLabel(d.skuMap, r.id), r.n, r.open, r.ready, r.cover === null ? '—' : Math.round(r.cover)])] });
  }
  if (sec === 'summary' || sec === 'risk') {
    sheets.push({ name: 'التنبيهات', rows: [['المستوى', 'التنبيه', 'التفاصيل'], ...alerts.map((a) => [a.level === 'crit' ? 'عاجل' : a.level === 'warn' ? 'انتبه' : 'للعلم', a.title, a.body])] });
    sheets.push({ name: 'المتوقف', rows: [['الكود', 'قطع', 'الناقص'], ...d.open.filter((o) => d.blocked.has(o.ref)).map((o) => [o.ref, o.lines.length, (d.blocked.get(o.ref) ?? []).map((x) => `${skuLabel(d.skuMap, x.sku)} ×${x.short}`).join('، ')])] });
  }
  if (sec === 'team') {
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
