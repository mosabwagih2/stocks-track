import { useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { useDerived } from '@/hooks/data';
import { PageHead } from '@/components/PageHead';
import { Alert, Bar, Button, Card, Chip, Empty, Kpi, Pill, Tabs, TableWrap, th, td } from '@/components/ui';
import { ErrorBox, StockByState } from '@/components/shared';
import { Thumb } from '@/components/Thumb';
import { Spinner } from '@/components/Spinner';
import { useToast } from '@/components/toast';
import { cellInfo } from '@/domain/stock';
import { qty, totalOwned } from '@/domain/ledger';
import { timeCairo } from '@/domain/dates';
import { skuLabel } from '@/domain/orders';
import { fmt, pct } from '@/lib/cn';
import type { Derived } from '@/hooks/data';

const lineOf = (m: string) => (/^PAN/.test(m) ? 'بانتي' : /^BR/.test(m) ? 'برا' : /^SH/.test(m) ? 'شورت' : 'موديلات أخرى');

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
  const [tab, setTab] = useState<'over' | 'demand' | 'plan' | 'stuck' | 'team' | 'health'>('over'); const [line, setLine] = useState('all');
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
  if (sorted.length) { notes.push({ tone: 'info', t: `${sorted[0][0]} هو الأكثر طلبًا: ${pct(sorted[0][1], total)}% من القطع (${fmt(sorted[0][1])} قطعة).` }); notes.push({ tone: 'info', t: `${n80} موديل من ${sorted.length} تمثّل 80% من الطلب، وعليها يجب أن يركّز المصنع.` }); }
  if (d.blocked.size) notes.push({ tone: 'crit', t: `${d.blocked.size} أوردر متوقف بسبب نقص الرصيد.` });
  if (plan.length) notes.push({ tone: 'warn', t: `${plan.length} صنف يحتاج إلى تصنيع (${fmt(plan.reduce((a, r) => a + r.make, 0))} قطعة مقترحة).` });
  if (live.length) notes.push({ tone: shipped / live.length >= 0.8 ? 'good' : 'warn', t: `تم شحن ${pct(shipped, live.length)}% من الأوردرات المطلوبة (${shipped} من ${live.length}).` });
  return (
    <>
      <PageHead title="التحليلات" sub="قرارات مبنية على الطلب الفعلي: ما يجب تصنيعه، وما يُباع، وما هو متوقف." />
      <Tabs value={tab} onChange={setTab} tabs={[['over', 'نظرة عامة'], ['demand', 'الطلب'], ['plan', 'التصنيع'], ['stuck', 'المتوقف'], ['team', 'الفريق'], ['health', 'صحة المخزون']]} />
      {!d.velocityOK && <Alert tone="warn" className="mb-4">لدينا <b>{d.days} يوم</b> بيانات طلب فقط. الأرقام دقيقة لهذه الأيام، لكنها غير كافية لتحديد اتجاه أو سرعة سحب موثوقة قبل 3 أيام.</Alert>}
      {tab === 'demand' ? <Demand d={d} /> : tab === 'stuck' ? <Stuck d={d} /> : tab === 'team' ? <Team d={d} /> : tab === 'health' ? <Health d={d} /> : tab === 'over' ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Kpi label="أوردرات مطلوبة" value={fmt(live.length)} sub={`${fmt(pieces)} قطعة`} /><Kpi label="متوسط القطع في الأوردر" value={live.length ? (pieces / live.length).toFixed(1) : '—'} /><Kpi label="مشحون" value={fmt(shipped)} sub={`${pct(shipped, live.length)}% من المطلوب`} tone="good" /><Kpi label="متوقف بسبب المخزون" value={fmt(d.blocked.size)} tone={d.blocked.size ? 'crit' : undefined} /></div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="أهم الملاحظات">{notes.length ? notes.map((x, i) => <div key={i} className="flex items-start gap-3 border-b border-grid py-2.5 last:border-0"><Pill tone={x.tone}>{x.tone === 'good' ? '✓' : x.tone === 'info' ? 'i' : '!'}</Pill><span>{x.t}</span></div>) : <Empty>لا توجد بيانات بعد.</Empty>}</Card>
            <Card title="حصة الموديلات من الطلب" hint="أعلى 8">{(() => { let c = 0; const cls = new Map<string, 'info' | 'warn' | 'muted'>(); for (const [m, v] of sorted) { cls.set(m, c / (total || 1) < 0.8 ? 'info' : c / (total || 1) < 0.95 ? 'warn' : 'muted'); c += v; } return (<>{sorted.slice(0, 8).map(([m, v]) => <Bar key={m} tone={cls.get(m)} label={<b className="font-mono">{m}</b>} value={v} max={sorted[0][1]} right={`${fmt(v)} · ${pct(v, total)}%`} />)}<div className="mt-3 flex flex-wrap gap-4 text-xs text-muted"><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-factory" />فئة A (أول 80% من الطلب)</span><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-dirty" />فئة B</span><span><i className="me-1.5 inline-block size-2.5 rounded-full bg-line2" />فئة C</span></div></>); })()}</Card>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-3"><Kpi label="قطع مقترحة" value={fmt(totalMake)} sub="للتصنيع" tone={totalMake ? 'warn' : undefined} /><Kpi label="أصناف" value={fmt(rows.length)} sub={`في ${models.length} موديل`} /><Kpi label="حرجة" value={fmt(rows.filter((r) => r.level === 'crit').length)} tone={rows.some((r) => r.level === 'crit') ? 'crit' : undefined} /></div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">{['all', 'بانتي', 'برا', 'شورت', 'موديلات أخرى'].map((l) => <Chip key={l} pressed={line === l} onClick={() => setLine(l)}>{l === 'all' ? 'الكل' : l}</Chip>)}</div>
            <Button variant="primary" onClick={() => { const t = `اقتراح تصنيع Fémini · ${d.today}\n${rows.map((r) => `${skuLabel(d.skuMap, r.id)} : ${r.make}`).join('\n')}\nالإجمالي: ${totalMake}`; navigator.clipboard?.writeText(t).then(() => toast('تم نسخ اقتراح التصنيع'), () => toast('انسخ النص يدويًا', { tone: 'err' })); }}><Copy className="size-4" /> نسخ للمصنع</Button>
          </div>
          {!models.length ? <Card><Empty>لا توجد أصناف تحت الحد حاليًا.</Empty></Card> : models.map((m, i) => (
            <details key={m} open={i < 2} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3"><span className="flex items-center gap-2"><Thumb model={d.modelMap.get(m)} size={34} /><b>{m} · {d.modelMap.get(m)?.name}</b></span><span className="flex items-center gap-2">{by[m].some((r) => r.level === 'crit') && <Pill tone="crit">{by[m].filter((r) => r.level === 'crit').length} حرج</Pill>}<Pill>{by[m].length} صنف</Pill><b className="font-mono">{fmt(by[m].reduce((a, r) => a + r.make, 0))}</b><span className="text-muted">قطعة</span></span></summary>
              <TableWrap className="rounded-none border-0 border-t"><table className="text-sm"><thead><tr>{['الصنف', 'جاهز', 'طلب مفتوح', 'راجع من المصنع', 'المقترح تصنيعه', ''].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>{by[m].map((r) => <tr key={r.id}><td className={td}>{skuLabel(d.skuMap, r.id, false)}</td><td className={td + ' font-mono'}>{fmt(r.ready)}</td><td className={td + ' font-mono'}>{r.demand}</td><td className={td + ' font-mono'}>{r.pending}</td><td className={td + ' font-mono font-semibold'}>{fmt(r.make)}</td><td className={td}><Pill tone={r.level}>{r.level === 'crit' ? 'حرج' : 'منخفض'}</Pill></td></tr>)}</tbody></table></TableWrap>
            </details>))}
        </div>
      )}
    </>
  );
}

const topN = (o: Record<string, number>, n: number) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);

function Demand({ d }: { d: Derived }) {
  const live = d.snap.orders.filter((o) => o.status !== 'cancelled'); const m: Record<string, Record<string, number>> = {}; const col: Record<string, number> = {}; const gov: Record<string, number> = {}; const bk = { '1': 0, '2': 0, '3-4': 0, '5+': 0 };
  for (const o of live) { for (const s of o.lines) { const k = d.skuMap.get(s); if (!k) continue; (m[k.model] ??= {})[k.size] = (m[k.model][k.size] ?? 0) + 1; col[k.color] = (col[k.color] ?? 0) + 1; } if (o.gov) gov[o.gov] = (gov[o.gov] ?? 0) + 1; const n = o.lines.length; bk[n === 1 ? '1' : n === 2 ? '2' : n <= 4 ? '3-4' : '5+']++; }
  const models = Object.keys(m).sort((a, b) => (d.pull[b] ?? 0) - (d.pull[a] ?? 0)).slice(0, 14); const sizes = d.snap.sizes.filter((z) => models.some((x) => m[x][z])); const mx = Math.max(1, ...models.flatMap((x) => sizes.map((z) => m[x][z] ?? 0)));
  const total = Object.values(col).reduce((a, b) => a + b, 0); const bmx = Math.max(1, ...Object.values(bk));
  if (!live.length) return <Card><Empty>لا توجد أوردرات بعد.</Empty></Card>;
  return (
    <div className="grid gap-4">
      <Card title="خريطة الطلب: الموديل × المقاس" hint="الأغمق = طلب أكبر. أعلى 14 موديل"><TableWrap><table className="w-auto border-separate border-spacing-1 text-xs"><thead><tr><th />{sizes.map((z) => <th key={z} className="px-1 text-center text-muted">{z}</th>)}<th className="text-muted">الإجمالي</th></tr></thead>
        <tbody>{models.map((x) => <tr key={x}><th className="pe-2 text-start font-mono">{x}</th>{sizes.map((z) => { const v = m[x][z] ?? 0, a = Math.round((v / mx) * 85); return <td key={z} className="min-w-11 rounded-md p-1.5 text-center font-mono" style={{ background: v ? `color-mix(in srgb, var(--accent) ${a}%, var(--surface))` : 'var(--grid)', color: a > 50 ? 'var(--on-accent)' : 'var(--ink)' }}>{v || ''}</td>; })}<td className="text-center font-mono font-semibold">{fmt(d.pull[x] ?? 0)}</td></tr>)}</tbody></table></TableWrap></Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="الألوان" hint="أعلى 10">{topN(col, 10).map(([c, v]) => <Bar key={c} label={c} value={v} max={topN(col, 1)[0][1]} right={`${fmt(v)} · ${pct(v, total)}%`} tone="info" />)}</Card>
        <Card title="المحافظات" hint="أعلى 10">{Object.keys(gov).length ? topN(gov, 10).map(([g, v]) => <Bar key={g} label={g} value={v} max={topN(gov, 1)[0][1]} right={`${fmt(v)} أوردر`} tone="good" />) : <Empty>لا توجد بيانات.</Empty>}</Card>
        <Card title="حجم الأوردر" hint="عدد القطع في الأوردر">{(['1', '2', '3-4', '5+'] as const).map((k) => <Bar key={k} label={k === '1' ? 'قطعة واحدة' : k === '2' ? 'قطعتان' : `${k} قطع`} value={bk[k]} max={bmx} right={`${fmt(bk[k])} · ${pct(bk[k], live.length)}%`} tone="warn" />)}</Card>
      </div>
    </div>
  );
}

function Stuck({ d }: { d: Derived }) {
  const bl = d.open.filter((o) => d.blocked.has(o.ref)); const wait = d.open.length - bl.length; const old = d.open.filter((o) => (d.pickupDate.get(o.pickupId) ?? d.today) < d.today).length;
  const bv: Record<string, { n: number; q: number }> = {}; for (const o of bl) for (const x of d.blocked.get(o.ref) ?? []) { const e = (bv[x.sku] ??= { n: 0, q: 0 }); e.n++; e.q += x.short; }
  const ks = Object.entries(bv).sort((a, b) => b[1].n - a[1].n).slice(0, 10);
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-3"><Kpi label="متوقف بسبب المخزون" value={bl.length} sub={`${fmt(bl.reduce((a, o) => a + o.lines.length, 0))} قطعة`} tone={bl.length ? 'crit' : 'good'} /><Kpi label="بانتظار الشحن" value={wait} tone={wait ? 'warn' : undefined} /><Kpi label="من أيام سابقة" value={old} sub="لم تُشحن بعد" tone={old ? 'warn' : 'good'} /></div>
      {!d.open.length ? <Alert tone="good">لا توجد أوردرات مفتوحة. تم شحن كل ما طُلب.</Alert> : (
        <>
          <Card title="الأصناف الأكثر تسببًا في التوقف" hint="لو توفّرت هذه، تتحرك أوردرات أكثر">{ks.length ? ks.map(([s, e]) => <Bar key={s} label={skuLabel(d.skuMap, s)} value={e.n} max={ks[0][1].n} right={`${e.n} أوردر · ناقص ${e.q}`} tone="crit" />) : <Alert tone="good">لا توجد أوردرات متوقفة بسبب الرصيد.</Alert>}</Card>
          {bl.length > 0 && <TableWrap><table className="text-sm"><thead><tr>{['الكود', 'قطع', 'الناقص فيه', 'عمره (يوم)'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead><tbody>{bl.slice(0, 25).map((o) => <tr key={o.ref}><td className={td + ' font-mono'}>{o.ref}</td><td className={td + ' font-mono'}>{o.lines.length}</td><td className={td}>{(d.blocked.get(o.ref) ?? []).map((x) => <span key={x.sku} className="m-0.5 inline-block"><Pill tone="crit">{skuLabel(d.skuMap, x.sku)} ×{x.short}</Pill></span>)}</td><td className={td + ' font-mono'}>{Math.max(0, Math.round((Date.parse(d.today) - Date.parse(d.pickupDate.get(o.pickupId) ?? d.today)) / 864e5))}</td></tr>)}</tbody></table></TableWrap>}
        </>
      )}
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
      <div className="grid grid-cols-3 gap-3"><Kpi label="موظفون" value={ks.length} /><Kpi label="أوردرات مشحونة" value={fmt(tot)} tone="good" /><Kpi label="آخر تسجيل" value={<span className="text-lg">{timeCairo(last)}</span>} /></div>
      <div className="grid gap-4 lg:grid-cols-2"><Card title="الأوردرات حسب الموظف">{ks.map((k) => <Bar key={k} label={k} value={e[k].o} max={e[ks[0]].o} right={`${fmt(e[k].o)} · ${pct(e[k].o, tot)}%`} tone="good" />)}</Card>
        <Card title="التفاصيل"><TableWrap><table className="text-sm"><thead><tr>{['الموظف', 'قطع', 'أيام', 'متوسط/يوم'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead><tbody>{ks.map((k) => <tr key={k}><td className={td}>{k}</td><td className={td + ' font-mono'}>{e[k].p}</td><td className={td + ' font-mono'}>{e[k].days.size}</td><td className={td + ' font-mono'}>{Math.round(e[k].o / e[k].days.size)}</td></tr>)}</tbody></table></TableWrap></Card></div>
      <Card title="كل يوم" hint="عدد الأوردرات المسجّلة"><TableWrap><table className="text-sm"><thead><tr><th className={th}>اليوم</th>{ks.map((k) => <th key={k} className={th}>{k}</th>)}</tr></thead><tbody>{days.map((x) => <tr key={x}><td className={td + ' font-mono'}>{x}</td>{ks.map((k) => <td key={k} className={td + ' font-mono'}>{pivot[x][k] ?? <span className="text-muted">·</span>}</td>)}</tr>)}</tbody></table></TableWrap></Card>
      <p className="text-xs text-muted">الأرقام هي عدد الأوردرات المسجّلة بالسكان. وقت السكان هو وقت رفع الملف وليس وقت التغليف، فلا تقيّم به السرعة.</p>
    </div>
  );
}

function Health({ d }: { d: Derived }) {
  const neg = d.snap.skus.filter((s) => qty(d.snap.balances, s.id, 'READY') < 0); const dead = d.snap.skus.filter((s) => qty(d.snap.balances, s.id, 'READY') > 0 && !d.velocity[s.id]);
  const exc = d.velocityOK ? d.snap.skus.filter((s) => { const v = d.velocity[s.id]; return v > 0 && qty(d.snap.balances, s.id, 'READY') / v > 60; }) : [];
  const buckets: Record<string, number> = { 'أقل من 3 أيام': 0, '3 - 7': 0, '7 - 14': 0, '14 - 30': 0, 'أكثر من 30': 0, 'بدون طلب': 0 };
  for (const s of d.snap.skus) { const r = qty(d.snap.balances, s.id, 'READY'); if (!r && !d.demand[s.id]) continue; const v = d.velocity[s.id]; if (!v) { buckets['بدون طلب']++; continue; } const c = r / v; buckets[c < 3 ? 'أقل من 3 أيام' : c < 7 ? '3 - 7' : c < 14 ? '7 - 14' : c < 30 ? '14 - 30' : 'أكثر من 30']++; }
  const bmx = Math.max(1, ...Object.values(buckets)); const tones = ['crit', 'crit', 'warn', 'good', 'info', 'muted'] as const;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Kpi label="اتزان الحركات" value={<span className="font-sans text-xl">سليم</span>} sub="مجموع كل الحركات = صفر" tone="good" /><Kpi label="أصناف برصيد سالب" value={neg.length} tone={neg.length ? 'crit' : 'good'} /><Kpi label="أصناف راكدة" value={dead.length} sub="رصيد ولا سحب" tone={dead.length ? 'warn' : undefined} /><Kpi label="فائض" value={exc.length} sub="تغطية أكثر من 60 يومًا" /></div>
      <div className="grid gap-4 lg:grid-cols-2"><Card title="المخزون حسب الحالة"><StockByState d={d} /></Card>
        <Card title="الأصناف حسب أيام التغطية">{Object.entries(buckets).map(([k, v], i) => <Bar key={k} label={k} value={v} max={bmx} right={`${fmt(v)} صنف`} tone={tones[i]} />)}{!d.velocityOK && <p className="mt-2 text-xs text-muted">تقديري: مبني على أيام بيانات قليلة.</p>}</Card></div>
      <Card title="أكبر الأصناف الراكدة" hint="رصيد بلا طلب">{dead.length ? <TableWrap><table className="text-sm"><tbody>{dead.sort((a, b) => qty(d.snap.balances, b.id, 'READY') - qty(d.snap.balances, a.id, 'READY')).slice(0, 10).map((s) => <tr key={s.id}><td className={td}>{skuLabel(d.skuMap, s.id)}</td><td className={td + ' font-mono'}>{fmt(totalOwned(d.snap.balances, s.id))}</td></tr>)}</tbody></table></TableWrap> : <Empty>لا يوجد.</Empty>}</Card>
    </div>
  );
}
