import { useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { useDerived } from '@/hooks/data';
import { PageHead } from '@/components/PageHead';
import { Alert, Bar, Button, Card, Chip, Empty, Kpi, Pill, Tabs, TableWrap, th, td } from '@/components/ui';
import { ErrorBox } from '@/components/shared';
import { Spinner } from '@/components/Spinner';
import { useToast } from '@/components/toast';
import { cellInfo } from '@/domain/stock';
import { qty } from '@/domain/ledger';
import { skuLabel } from '@/domain/orders';
import { fmt, pct } from '@/lib/cn';
import type { Derived } from '@/hooks/data';

const lineOf = (m: string) => (/^PAN/.test(m) ? 'بانتي' : /^BR/.test(m) ? 'برا' : /^SH/.test(m) ? 'شورت' : 'موديلات تانية');

function usePlan(d: Derived | null) {
  return useMemo(() => {
    if (!d) return [];
    const rows: { id: string; model: string; ready: number; demand: number; pending: number; make: number; level: 'warn' | 'crit' }[] = [];
    for (const s of d.snap.skus) {
      const c = cellInfo(s, d.snap.balances, d.demand, d.velocity, d.velocityOK, 14); if (!c.level) continue;
      if (!d.velocityOK && !(d.pull[s.model] ?? 0) && !c.demand) continue; // legacy minimums are noise for models nobody orders
      const pending = qty(d.snap.balances, s.id, 'FACTORY'); const have = c.ready - c.demand + pending;
      const target = d.velocityOK ? Math.ceil(c.velocity * 30) : Math.max(s.minAlert * 2, c.demand); const make = Math.max(0, target - have);
      if (make > 0) rows.push({ id: s.id, model: s.model, ready: c.ready, demand: c.demand, pending, make, level: c.level });
    }
    return rows;
  }, [d]);
}

export default function Insights() {
  const { d, isLoading, error } = useDerived(); const toast = useToast();
  const [tab, setTab] = useState<'over' | 'plan'>('over'); const [line, setLine] = useState('all');
  const plan = usePlan(d);
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !d) return <Spinner />;
  const live = d.snap.orders.filter((o) => o.status !== 'cancelled'); const pieces = live.reduce((a, o) => a + o.lines.length, 0); const shipped = live.filter((o) => o.status === 'shipped').length;
  const sorted = Object.entries(d.pull).sort((a, b) => b[1] - a[1]); const total = sorted.reduce((a, x) => a + x[1], 0);
  let cum = 0, n80 = 0; for (const [, v] of sorted) { cum += v; n80++; if (cum / (total || 1) >= 0.8) break; }
  const rows = plan.filter((r) => line === 'all' || lineOf(r.model) === line); const by: Record<string, typeof rows> = {};
  for (const r of rows) (by[r.model] ??= []).push(r);
  const models = Object.keys(by).sort((a, b) => by[b].reduce((x, r) => x + r.make, 0) - by[a].reduce((x, r) => x + r.make, 0));
  const totalMake = rows.reduce((a, r) => a + r.make, 0);
  const notes: { tone: 'info' | 'warn' | 'crit' | 'good'; t: string }[] = [];
  if (sorted.length) { notes.push({ tone: 'info', t: `${sorted[0][0]} هو الأكتر طلبًا: ${pct(sorted[0][1], total)}% من القطع (${fmt(sorted[0][1])} قطعة).` }); notes.push({ tone: 'info', t: `${n80} موديل من ${sorted.length} بيمثّلوا 80% من الطلب. دول اللي المصنع يركّز عليهم.` }); }
  if (d.blocked.size) notes.push({ tone: 'crit', t: `${d.blocked.size} أوردر هيقف بسبب نقص الرصيد.` });
  if (plan.length) notes.push({ tone: 'warn', t: `${plan.length} صنف محتاج تصنيع (${fmt(plan.reduce((a, r) => a + r.make, 0))} قطعة مقترحة).` });
  if (live.length) notes.push({ tone: shipped / live.length >= 0.8 ? 'good' : 'warn', t: `اتشحن ${pct(shipped, live.length)}% من الأوردرات المطلوبة (${shipped} من ${live.length}).` });
  return (
    <>
      <PageHead title="التحليلات" sub="قرارات مبنية على الطلب الفعلي: نصنّع إيه، إيه بيتباع، إيه واقف." />
      <Tabs value={tab} onChange={setTab} tabs={[['over', 'نظرة عامة'], ['plan', 'التصنيع']]} />
      {!d.velocityOK && <Alert tone="warn" className="mb-4">عندنا <b>{d.days} يوم</b> بيانات طلب بس. الأرقام دقيقة للأيام دي، بس مش كفاية نحدد اتجاه أو سرعة سحب مضمونة قبل 3 أيام.</Alert>}
      {tab === 'over' ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Kpi label="أوردرات مطلوبة" value={fmt(live.length)} sub={`${fmt(pieces)} قطعة`} /><Kpi label="متوسط القطع في الأوردر" value={live.length ? (pieces / live.length).toFixed(1) : '—'} /><Kpi label="اتشحن" value={fmt(shipped)} sub={`${pct(shipped, live.length)}% من المطلوب`} tone="good" /><Kpi label="هيقف بالمخزون" value={fmt(d.blocked.size)} tone={d.blocked.size ? 'crit' : undefined} /></div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="أهم الملاحظات">{notes.length ? notes.map((x, i) => <div key={i} className="flex items-start gap-3 border-b border-grid py-2.5 last:border-0"><Pill tone={x.tone}>{x.tone === 'good' ? '✓' : x.tone === 'info' ? 'i' : '!'}</Pill><span>{x.t}</span></div>) : <Empty>مفيش بيانات لسه.</Empty>}</Card>
            <Card title="حصة الموديلات من الطلب" hint="أعلى 8">{sorted.slice(0, 8).map(([m, v]) => <Bar key={m} label={<b className="font-mono">{m}</b>} value={v} max={sorted[0][1]} right={`${fmt(v)} · ${pct(v, total)}%`} />)}</Card>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-3"><Kpi label="قطع مقترحة" value={fmt(totalMake)} sub="للتصنيع" tone={totalMake ? 'warn' : undefined} /><Kpi label="أصناف" value={fmt(rows.length)} sub={`في ${models.length} موديل`} /><Kpi label="حرجة" value={fmt(rows.filter((r) => r.level === 'crit').length)} tone={rows.some((r) => r.level === 'crit') ? 'crit' : undefined} /></div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">{['all', 'بانتي', 'برا', 'شورت', 'موديلات تانية'].map((l) => <Chip key={l} pressed={line === l} onClick={() => setLine(l)}>{l === 'all' ? 'الكل' : l}</Chip>)}</div>
            <Button variant="primary" onClick={() => { const t = `اقتراح تصنيع Fémini · ${d.today}\n${rows.map((r) => `${skuLabel(d.skuMap, r.id)} : ${r.make}`).join('\n')}\nالإجمالي: ${totalMake}`; navigator.clipboard?.writeText(t).then(() => toast('اتنسخ اقتراح التصنيع'), () => toast('انسخ يدويًا', { tone: 'err' })); }}><Copy className="size-4" /> نسخ للمصنع</Button>
          </div>
          {!models.length ? <Card><Empty>مفيش أصناف تحت الحد حاليًا.</Empty></Card> : models.map((m, i) => (
            <details key={m} open={i < 2} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3"><b>{m} · {d.modelMap.get(m)?.name}</b><span className="flex items-center gap-2">{by[m].some((r) => r.level === 'crit') && <Pill tone="crit">{by[m].filter((r) => r.level === 'crit').length} حرج</Pill>}<Pill>{by[m].length} صنف</Pill><b className="font-mono">{fmt(by[m].reduce((a, r) => a + r.make, 0))}</b><span className="text-muted">قطعة</span></span></summary>
              <TableWrap className="rounded-none border-0 border-t"><table className="text-sm"><thead><tr>{['الصنف', 'جاهز', 'طلب مفتوح', 'راجع من المصنع', 'يتصنّع', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>{by[m].map((r) => <tr key={r.id}><td className={td}>{skuLabel(d.skuMap, r.id, false)}</td><td className={td + ' font-mono'}>{fmt(r.ready)}</td><td className={td + ' font-mono'}>{r.demand}</td><td className={td + ' font-mono'}>{r.pending}</td><td className={td + ' font-mono font-semibold'}>{fmt(r.make)}</td><td className={td}><Pill tone={r.level}>{r.level === 'crit' ? 'حرج' : 'قرب'}</Pill></td></tr>)}</tbody></table></TableWrap>
            </details>))}
        </div>
      )}
    </>
  );
}
