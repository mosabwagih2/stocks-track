import { useDeferredValue, useMemo, useState } from 'react';
import { useSearchParams } from '@/femini/router';
import { Upload, XCircle } from 'lucide-react';
import { useDerived } from '@/femini/hooks/data';
import { PageHead } from '@/femini/components/PageHead';
import { Alert, Button, Card, Chip, Empty, Kpi, Pill, TableWrap, Tabs, th, td } from '@/femini/components/ui';
import { OrderPill, ErrorBox } from '@/femini/components/shared';
import { Thumb } from '@/femini/components/Thumb';
import { Spinner } from '@/femini/components/Spinner';
import { CancelSheet, OrderSheet, UploadSheet } from '@/femini/components/OrderSheets';
import { channelName } from '@/femini/domain/constants';
import { fmt } from '@/femini/cn';
import { qty } from '@/femini/domain/ledger';
import { skuLabel } from '@/femini/domain/orders';

type Filter = 'all' | 'wait' | 'blocked' | 'done' | 'cx' | 'bad' | 'returned';
const PAGE = 60;

export default function Orders() {
  const { d, isLoading, error } = useDerived();
  const [sp, setSp] = useSearchParams();
  const f = (sp.get('f') as Filter) || 'all'; const pk = sp.get('pk') || '';
  const [q, setQ] = useState(''); const dq = useDeferredValue(q);
  const [tab, setTab] = useState<'list' | 'pick'>('list'); const [n, setN] = useState(PAGE);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [orderRef, setOrderRef] = useState<string | null>(null); const [upload, setUpload] = useState<'scan' | 'pickup' | null>(null);
  const [manual, setManual] = useState<string[] | null>(null); const [cancel, setCancel] = useState<string | null>(null);

  const counts = useMemo(() => {
    if (!d) return null;
    const live = d.snap.orders.filter((o) => o.status !== 'cancelled');
    return {
      all: live.length, wait: live.filter((o) => o.status === 'open' && !d.blocked.has(o.ref)).length, blocked: live.filter((o) => o.status === 'open' && d.blocked.has(o.ref)).length,
      done: live.filter((o) => o.status === 'shipped' && !o.returned).length, returned: live.filter((o)=>o.returned).length, cx: d.snap.orders.length - live.length, bad: live.filter((o) => o.unmapped.length).length,
    };
  }, [d]);
  const list = useMemo(() => {
    if (!d) return [];
    const s = dq.trim().toLowerCase();
    return d.snap.orders.filter((o) => {
      if (pk && o.pickupId !== pk) return false;
      if (f === 'cx') { if (o.status !== 'cancelled') return false; } else if (o.status === 'cancelled') return false;
      if (f === 'wait' && !(o.status === 'open' && !d.blocked.has(o.ref))) return false;
      if (f === 'blocked' && !(o.status === 'open' && d.blocked.has(o.ref))) return false;
      if (f === 'done' && (o.status !== 'shipped' || o.returned)) return false;
      if (f === 'returned' && !o.returned) return false;
      if (f === 'bad' && !o.unmapped.length) return false;
      return !s || o.ref.toLowerCase().includes(s) || o.waybill.includes(s) || o.gov.includes(s);
    });
  }, [d, f, pk, dq]);

  if (error) return <ErrorBox error={error} />;
  if (isLoading || !d || !counts) return <Spinner />;
  const setF = (v: Filter) => { const p = new URLSearchParams(sp); if (v === 'all') p.delete('f'); else p.set('f', v); setSp(p, { replace: true }); setN(PAGE); };
  const chips: [Filter, string][] = [['all', 'الكل'], ['wait', 'بانتظار الشحن'], ['blocked', 'متوقف'], ['done', 'مشحون'], ['returned','مرتجع']];
  const pick = (() => {
    const m: Record<string, number> = {}; for (const o of d.open) for (const s of o.lines) m[s] = (m[s] ?? 0) + 1;
    return Object.keys(m).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).map((s) => ({ sku: s, need: m[s], ready: qty(d.snap.balances, s, 'READY') }));
  })();
  const selOpen = [...sel].filter((r) => { const o = d.orderMap.get(r); return o?.status === 'open' && !o.unmapped.length; });
  const toggle = (r: string) => setSel((s) => { const x = new Set(s); if (x.has(r)) x.delete(r); else x.add(r); return x; });

  return (
    <>
      <PageHead title="الأوردرات" sub="البيك أب = الطلب. الشحن (بالسكان) = ما خرج فعلًا. الفرق بينهما هو الأوردرات المتوقفة.">
        <Button variant="danger" onClick={() => setCancel('')}><XCircle className="size-4" /> إلغاء أوردر</Button>
        <Button onClick={() => setUpload('pickup')}><Upload className="size-4" /> رفع بيك أب</Button>
        <Button variant="primary" onClick={() => setUpload('scan')}><Upload className="size-4" /> رفع ملف الإسكان</Button>
      </PageHead>
      <Tabs value={tab} onChange={setTab} tabs={[['list', 'الأوردرات'], ['pick', 'قائمة التجهيز']]} />
      {tab === 'pick' ? (
        !pick.length ? <Card><Empty>لا توجد أوردرات مفتوحة. تم شحن كل ما طُلب.</Empty></Card> : (
          <>
            <div className="mb-3 grid grid-cols-3 gap-3"><Kpi label="أصناف مطلوبة" value={pick.length} /><Kpi label="قطع مطلوبة (لم تُشحن)" value={fmt(pick.reduce((a, x) => a + x.need, 0))} /><Kpi label="أصناف ناقصة" value={pick.filter((x) => x.ready < x.need).length} tone={pick.some((x) => x.ready < x.need) ? 'crit' : 'good'} /></div>
            <TableWrap><table className="text-sm"><thead><tr><th className={th}>الصنف</th><th className={th}>مطلوب</th><th className={th}>جاهز</th><th className={th}>الفرق</th></tr></thead>
              <tbody>{pick.map((x) => <tr key={x.sku}><td className={td}><Thumb model={d.modelMap.get(d.skuMap.get(x.sku)?.model ?? '')} size={36} className="me-1.5" />{skuLabel(d.skuMap, x.sku)}</td><td className={td + ' font-mono'}>{x.need}</td><td className={td + ' font-mono'}>{fmt(x.ready)}</td><td className={td}>{x.ready >= x.need ? <span className="font-mono text-muted">{fmt(x.ready - x.need)} متبقي</span> : <Pill tone="crit">ناقص {x.need - Math.max(0, x.ready)}</Pill>}</td></tr>)}</tbody></table></TableWrap>
          </>
        )
      ) : (
        <>
          <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...d.snap.pickups].sort((a,b)=>b.date.localeCompare(a.date)).map((p) => {
              const po = d.snap.orders.filter((o) => o.pickupId === p.id && o.status !== 'cancelled'); const done = po.filter((o) => o.status === 'shipped').length;
              return (
                <button key={p.id} type="button" onClick={() => { const x = new URLSearchParams(sp); if (pk === p.id) x.delete('pk'); else x.set('pk', p.id); setSp(x, { replace: true }); }}
                  className={`grid gap-2 rounded-2xl border bg-surface p-3.5 text-start ${pk === p.id ? 'border-accent' : 'border-line'}`}>
                  <span className="flex justify-between"><b>{p.label}</b><span className="text-xs text-muted">{p.date}</span></span>
                  <span className="text-xs text-muted">{channelName(p.channel)}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-grid"><i className="block h-full bg-ready" style={{ width: `${po.length ? (done / po.length) * 100 : 0}%` }} /></span>
                  <span className="flex justify-between"><span><span className="num">{done}</span> من <span className="num">{po.length}</span> مشحون</span><span className="text-muted">{fmt(po.reduce((a, o) => a + o.lines.length, 0))} قطعة</span></span>
                </button>
              );
            })}
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {chips.map(([v, l]) => <Chip key={v} pressed={f === v} onClick={() => setF(v)}>{l} <span className="font-mono text-xs opacity-75">{counts[v as 'all']}</span></Chip>)}
            {counts.cx > 0 && <Chip pressed={f === 'cx'} onClick={() => setF('cx')}>ملغي <span className="font-mono text-xs opacity-75">{counts.cx}</span></Chip>}
            {counts.bad > 0 && <Chip pressed={f === 'bad'} onClick={() => setF('bad')}>كود غير مربوط <span className="font-mono text-xs opacity-75">{counts.bad}</span></Chip>}
            <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setN(PAGE); }} placeholder="بحث بكود الأوردر أو البوليصة أو المحافظة" className="min-w-52 max-w-sm flex-1" aria-label="بحث" />
          </div>
          {selOpen.length > 0 && (
            <Alert className="mb-3 flex flex-wrap items-center justify-between gap-2"><span>تم تحديد <b>{selOpen.length}</b> أوردر</span>
              <span className="flex gap-2"><Button size="sm" onClick={() => setSel(new Set())}>إلغاء الاختيار</Button><Button size="sm" variant="primary" onClick={() => setManual(selOpen)}>سجّلها كأوردرات شُحنت</Button></span></Alert>
          )}
          <TableWrap>
            <table className="text-sm"><thead><tr><th className={th + ' w-9'} /><th className={th}>كود الأوردر</th><th className={th}>البوليصة</th><th className={th}>النوع</th><th className={th}>المحافظة</th><th className={th}>قطع</th><th className={th}>الحالة</th></tr></thead>
              <tbody>
                {list.slice(0, n).map((o) => (
                  <tr key={o.ref} className={`cursor-pointer hover:bg-lav ${o.status === 'open' && d.blocked.has(o.ref) ? 'bg-crit-bg/60' : o.status === 'shipped' ? 'bg-good-bg/50' : o.status === 'cancelled' ? 'opacity-70' : ''}`} onClick={() => setOrderRef(o.ref)}>
                    <td className={td} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(o.ref)} disabled={o.status !== 'open' || o.unmapped.length > 0} title={o.unmapped.length ? 'فيه أصناف مش متعرّفة؛ صحّحها الأول' : undefined} onChange={() => toggle(o.ref)} aria-label="تحديد" /></td>
                    <td className={td + ' font-mono'}>{o.ref}</td><td className={td + ' font-mono text-muted'}>{o.waybill}</td>
                    <td className={td}>{o.type === 'exchange' ? <Pill tone="lost">استبدال</Pill> : 'جديد'}</td><td className={td}>{o.gov}</td><td className={td + ' font-mono'}>{o.lines.length}</td><td className={td}>{o.returned ? <Pill tone="warn">مرتجع · {o.returned.doc}</Pill> : <OrderPill o={o} d={d} />}{o.status==='open' && d.blocked.has(o.ref) && <p className="mt-1 text-xs text-crit">ناقص {d.blocked.get(o.ref)?.map((x)=>`${skuLabel(d.skuMap,x.sku)} (${x.short})`).join('، ')}</p>}</td>
                  </tr>
                ))}
                {!list.length && <tr><td colSpan={7}><Empty>لا توجد أوردرات مطابقة للفلتر.</Empty></td></tr>}
              </tbody>
            </table>
          </TableWrap>
          {list.length > n && <div className="mt-3 text-center"><Button onClick={() => setN((x) => x + PAGE)}>عرض المزيد ({fmt(list.length - n)} متبقي)</Button></div>}
        </>
      )}
      {orderRef && <OrderSheet d={d} orderRef={orderRef} onClose={() => setOrderRef(null)} onCancel={(c) => { setOrderRef(null); setCancel(c); }} />}
      {upload && <UploadSheet d={d} mode={upload} onClose={() => setUpload(null)} />}
      {manual && <UploadSheet d={d} mode="scan" manualRefs={manual} onClose={() => { setManual(null); setSel(new Set()); }} />}
      {cancel !== null && <CancelSheet d={d} initial={cancel} onClose={() => setCancel(null)} />}
    </>
  );
}
