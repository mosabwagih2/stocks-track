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
import { PickupOrders } from '@/femini/components/PickupOrders';
import { ItemsDetail, OrdersDetail, SkuOrders } from '@/femini/components/DetailSheets';
import { SettleUpload } from '@/femini/components/Collections';
import { channelName } from '@/femini/domain/constants';
import { fmt } from '@/femini/cn';
import { qty } from '@/femini/domain/ledger';
import { skuLabel } from '@/femini/domain/orders';
import { cairoDay, dayDiff } from '@/femini/domain/dates';
import type { Order } from '@/femini/domain/types';
import type { Derived } from '@/femini/hooks/data';

/** under the status: when the money came, or for how many days it has been out and not collected */
function statusDate(o: Order, d: Derived) {
  if (o.status === 'shipped' && !o.returned && !d.collected.has(o.ref) && o.shippedAt) { const n = dayDiff(cairoDay(o.shippedAt), d.today); return <div className="num mt-1 text-[11px] text-muted">اتشحن من {n} يوم</div>; }
  return null;
}
/** the row's tint by state */
const rowTint = (o: Order, d: Derived) => o.status === 'open' && d.blocked.has(o.ref) ? 'bg-crit-bg/60' : o.status === 'shipped' ? (d.collected.has(o.ref) ? 'bg-good-bg/50' : 'bg-info-bg/40') : o.status === 'cancelled' ? 'opacity-70' : '';
/** the state: one pill (the collection date has its own place), the days out, what is short */
function StateCell({ o, d }: { o: Order; d: Derived }) {
  return <>{o.returned ? <Pill tone="lost">مرتجع · {o.returned.doc}</Pill> : <OrderPill o={o} d={d} />}{statusDate(o, d)}{o.status === 'open' && d.blocked.has(o.ref) && <p className="mt-1 text-xs text-crit">ناقص {d.blocked.get(o.ref)?.map((x) => `${skuLabel(d.skuMap, x.sku)} (${x.short})`).join('، ')}</p>}</>;
}
type Filter = 'all' | 'wait' | 'blocked' | 'done' | 'cx' | 'bad' | 'returned' | 'paid';
const PAGE = 60;

export default function Orders() {
  const { d, isLoading, error } = useDerived();
  const [sp, setSp] = useSearchParams();
  const f = (sp.get('f') as Filter) || 'all'; const pk = sp.get('pk') || '';
  const [q, setQ] = useState(''); const dq = useDeferredValue(q);
  const [tab, setTab] = useState<'list' | 'pk' | 'pick'>('list'); const [n, setN] = useState(PAGE);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pkSheet, setPkSheet] = useState<string | null>(null); const [settle, setSettle] = useState(false);   // a pickup's orders; an order opened from it returns to it
  const [orderRef, setOrderRef] = useState<string | null>(null); const [upload, setUpload] = useState<'scan' | 'pickup' | null>(null);
  const [manual, setManual] = useState<string[] | null>(null); const [cancel, setCancel] = useState<string | null>(null);
  const [card, setCard] = useState<'items' | 'pieces' | 'short' | null>(null); const [skuOrd, setSkuOrd] = useState<string | null>(null);   // a prep-list card, and the orders of one item

  const counts = useMemo(() => {
    if (!d) return null;
    const live = d.snap.orders.filter((o) => o.status !== 'cancelled');
    return {
      all: live.length, wait: live.filter((o) => o.status === 'open' && !d.blocked.has(o.ref)).length, blocked: live.filter((o) => o.status === 'open' && d.blocked.has(o.ref)).length,
      done: live.filter((o) => o.status === 'shipped' && !o.returned && !d.collected.has(o.ref)).length, paid: live.filter((o) => o.status === 'shipped' && !o.returned && d.collected.has(o.ref)).length, returned: live.filter((o)=>o.returned).length, cx: d.snap.orders.length - live.length, bad: live.filter((o) => o.unmapped.length).length,
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
      if (f === 'done' && (o.status !== 'shipped' || o.returned || d.collected.has(o.ref))) return false;   // shipped, money not in yet
      if (f === 'paid' && (o.status !== 'shipped' || o.returned || !d.collected.has(o.ref))) return false;
      if (f === 'returned' && !o.returned) return false;
      if (f === 'bad' && !o.unmapped.length) return false;
      return !s || o.ref.toLowerCase().includes(s) || o.waybill.includes(s) || o.gov.includes(s);
    });
  }, [d, f, pk, dq]);

  if (error) return <ErrorBox error={error} />;
  if (isLoading || !d || !counts) return <Spinner />;
  const setF = (v: Filter) => { const p = new URLSearchParams(sp); if (v === 'all') p.delete('f'); else p.set('f', v); setSp(p, { replace: true }); setN(PAGE); };
  const chips: [Filter, string][] = [['all', 'الأوردرات'], ['wait', 'بانتظار الشحن'], ['blocked', 'متوقف'], ['done', 'مشحون'], ['paid', 'تم التحصيل'], ['returned','مرتجع']];
  const pick = (() => {
    const m: Record<string, number> = {}; for (const o of d.open) for (const s of o.lines) m[s] = (m[s] ?? 0) + 1;
    return Object.keys(m).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).map((s) => ({ sku: s, need: m[s], ready: qty(d.snap.balances, s, 'READY') }));
  })();
  const selOpen = [...sel].filter((r) => { const o = d.orderMap.get(r); return o?.status === 'open' && !o.unmapped.length; });
  const toggle = (r: string) => setSel((s) => { const x = new Set(s); if (x.has(r)) x.delete(r); else x.add(r); return x; });

  return (
    <>
      <PageHead title="الأوردرات" sub="البيك أب = الطلب. الشحن (بالإسكان) = ما خرج فعلًا. الفرق بينهما هو الأوردرات المتوقفة.">
        <Button variant="danger" onClick={() => setCancel('')}><XCircle className="size-4" /> إلغاء أوردر</Button>
        <Button onClick={() => setSettle(true)}><Upload className="size-4" /> رفع شيت التحصيل</Button>
        <Button variant="primary" onClick={() => setUpload('pickup')}><Upload className="size-4" /> رفع بيك أب</Button>
        <Button onClick={() => setUpload('scan')}><Upload className="size-4" /> رفع ملف الإسكان</Button>
      </PageHead>
      <Tabs value={tab} onChange={setTab} tabs={[['pk', `بيك أب (${d.snap.pickups.length})`], ['list', 'الأوردرات'], ['pick', 'قائمة التجهيز']]} />
      {tab === 'pk' ? (
        !d.snap.pickups.length ? <Card><Empty>لا يوجد بيك أب بعد. ارفع ملف البيك أب.</Empty></Card> : <>
          <p className="mb-3 text-sm text-muted">اضغط على أي بيك أب يفتح أوردراته.</p>
          <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...d.snap.pickups].sort((a,b)=>b.date.localeCompare(a.date)).map((p) => {
              const po = d.snap.orders.filter((o) => o.pickupId === p.id && o.status !== 'cancelled'); const done = po.filter((o) => o.status === 'shipped').length;
              return (
                <button key={p.id} type="button" onClick={() => setPkSheet(p.id)}
                  className="grid gap-2 rounded-2xl border border-line bg-surface p-3.5 text-start transition hover:border-accent">
                  <span className="flex justify-between"><b>{p.label}</b><span className="text-xs text-muted">{p.date}</span></span>
                  <span className="text-xs text-muted">{channelName(p.channel)}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-grid"><i className="block h-full bg-ready" style={{ width: `${po.length ? (done / po.length) * 100 : 0}%` }} /></span>
                  <span className="flex justify-between"><span><span className="num">{done}</span> من <span className="num">{po.length}</span> مشحون</span><span className="text-muted">{fmt(po.reduce((a, o) => a + o.lines.length, 0))} قطعة</span></span>
                </button>
              );
            })}
          </div>
        </>
      ) : tab === 'pick' ? (
        !pick.length ? <Card><Empty>لا توجد أوردرات مفتوحة. تم شحن كل ما طُلب.</Empty></Card> : (
          <>
            <div className="mb-3 grid grid-cols-3 gap-3">
              <Kpi label="أصناف مطلوبة" value={pick.length} sub="اضغط للتفاصيل" onClick={() => setCard('items')} />
              <Kpi label="قطع مطلوبة (لم تُشحن)" value={fmt(pick.reduce((a, x) => a + x.need, 0))} sub={`${fmt(d.open.length)} أوردر`} onClick={() => setCard('pieces')} />
              <Kpi label="أصناف ناقصة" value={pick.filter((x) => x.ready < x.need).length} sub={pick.some((x) => x.ready < x.need) ? 'ومعاها الأوردرات المتوقفة' : undefined} tone={pick.some((x) => x.ready < x.need) ? 'crit' : 'good'} onClick={() => setCard('short')} />
            </div>
            <TableWrap><table className="text-sm"><thead><tr><th className={th}>الصنف</th><th className={th}>مطلوب</th><th className={th}>جاهز</th><th className={th}>الفرق</th></tr></thead>
              <tbody>{pick.map((x) => <tr key={x.sku}><td className={td}><Thumb model={d.modelMap.get(d.skuMap.get(x.sku)?.model ?? '')} size={36} className="me-1.5" />{skuLabel(d.skuMap, x.sku)}</td><td className={td + ' font-mono'}>{x.need}</td><td className={td + ' font-mono'}>{fmt(x.ready)}</td><td className={td}>{x.ready >= x.need ? <span className="font-mono text-muted">{fmt(x.ready - x.need)} متبقي</span> : <Pill tone="crit">ناقص {x.need - Math.max(0, x.ready)}</Pill>}</td></tr>)}</tbody></table></TableWrap>
          </>
        )
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {pk && <Chip pressed onClick={() => { const x = new URLSearchParams(sp); x.delete('pk'); setSp(x, { replace: true }); }}>{d.snap.pickups.find((p) => p.id === pk)?.label ?? pk} ✕</Chip>}
            {chips.map(([v, l]) => <Chip key={v} pressed={f === v} onClick={() => setF(v)}>{l} <span className="font-mono text-xs opacity-75">{counts[v as 'all']}</span></Chip>)}
            {counts.cx > 0 && <Chip pressed={f === 'cx'} onClick={() => setF('cx')}>ملغي <span className="font-mono text-xs opacity-75">{counts.cx}</span></Chip>}
            {counts.bad > 0 && <Chip pressed={f === 'bad'} onClick={() => setF('bad')}>كود غير مربوط <span className="font-mono text-xs opacity-75">{counts.bad}</span></Chip>}
            <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setN(PAGE); }} placeholder="بحث بالبوليصة أو رقم الأوردر أو المحافظة" className="min-w-52 max-w-sm flex-1" aria-label="بحث" />
          </div>
          {selOpen.length > 0 && (
            <Alert className="mb-3 flex flex-wrap items-center justify-between gap-2"><span>تم تحديد <b>{selOpen.length}</b> أوردر</span>
              <span className="flex gap-2"><Button size="sm" onClick={() => setSel(new Set())}>إلغاء الاختيار</Button><Button size="sm" variant="primary" onClick={() => setManual(selOpen)}>سجّلها كأوردرات شُحنت</Button></span></Alert>
          )}
          {/* phone: one card per order, the state always in view; a table would cut it off */}
          <ul className="grid gap-2 sm:hidden">
            {list.slice(0, n).map((o) => (
              <li key={o.ref} onClick={() => setOrderRef(o.ref)} className={`cursor-pointer rounded-xl border border-line p-3 ${rowTint(o, d)}`}>
                <div className="flex items-center gap-2">
                  <span onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(o.ref)} disabled={o.status !== 'open' || o.unmapped.length > 0} onChange={() => toggle(o.ref)} aria-label="تحديد" /></span>
                  <b className="font-mono">{o.ref}</b>{o.type === 'exchange' && <Pill tone="lost">استبدال</Pill>}
                  <span className="ms-auto text-sm text-muted">{o.gov} · <span className="num font-semibold text-ink">{o.lines.length}</span> قطعة</span>
                </div>
                <div className="mt-2"><StateCell o={o} d={d} /></div>
                <div className="num mt-2 flex flex-wrap gap-x-4 text-xs text-muted"><span>بيك أب {d.pickupDate.get(o.pickupId) ?? '—'}</span>{d.collected.get(o.ref) && <span>تحصيل {d.collected.get(o.ref)!.date}</span>}</div>
              </li>
            ))}
            {!list.length && <li><Empty>لا توجد أوردرات مطابقة للفلتر.</Empty></li>}
          </ul>
          <div className="max-sm:hidden"><TableWrap>
            <table className="text-sm"><thead><tr><th className={th + ' w-9'} /><th className={th}>البوليصة</th><th className={th}>تاريخ البيك أب</th><th className={th}>تاريخ التحصيل</th><th className={th}>النوع</th><th className={th}>المحافظة</th><th className={th}>قطع</th><th className={th}>الحالة</th></tr></thead>
              <tbody>
                {list.slice(0, n).map((o) => (
                  <tr key={o.ref} className={`cursor-pointer hover:bg-lav ${rowTint(o, d)}`} onClick={() => setOrderRef(o.ref)}>
                    <td className={td} onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(o.ref)} disabled={o.status !== 'open' || o.unmapped.length > 0} title={o.unmapped.length ? 'فيه أصناف مش متعرّفة؛ صحّحها الأول' : undefined} onChange={() => toggle(o.ref)} aria-label="تحديد" /></td>
                    <td className={td + ' font-mono'}>{o.ref}</td><td className={td + ' font-mono text-muted whitespace-nowrap'}>{d.pickupDate.get(o.pickupId) ?? '—'}</td><td className={td + ' font-mono whitespace-nowrap'} title={d.collected.get(o.ref) ? `التسوية ${d.collected.get(o.ref)!.stl}` : undefined}>{d.collected.get(o.ref)?.date ?? <span className="text-muted">—</span>}</td>
                    <td className={td}>{o.type === 'exchange' ? <Pill tone="lost">استبدال</Pill> : 'جديد'}</td><td className={td}>{o.gov}</td><td className={td + ' font-mono'}>{o.lines.length}</td><td className={td}><StateCell o={o} d={d} /></td>
                  </tr>
                ))}
                {!list.length && <tr><td colSpan={8}><Empty>لا توجد أوردرات مطابقة للفلتر.</Empty></td></tr>}
              </tbody>
            </table>
          </TableWrap></div>
          {list.length > n && <div className="mt-3 text-center"><Button onClick={() => setN((x) => x + PAGE)}>عرض المزيد ({fmt(list.length - n)} متبقي)</Button></div>}
        </>
      )}
      {card === 'items' && <ItemsDetail d={d} title="الأصناف المطلوبة" hint="كل الأصناف في الأوردرات المفتوحة. اضغط على صنف يفتح أوردراته." head={['مطلوب', 'جاهز', 'الفرق']}
        rows={pick.slice().sort((x, y) => y.need - x.need).map((x) => ({ sku: x.sku, cells: [fmt(x.need), fmt(x.ready), x.ready >= x.need ? `متبقي ${fmt(x.ready - x.need)}` : <b key="s" className="text-crit">ناقص {fmt(x.need - x.ready)}</b>] }))} onItem={setSkuOrd} onClose={() => setCard(null)} />}
      {card === 'short' && <ItemsDetail d={d} title="الأصناف الناقصة" hint="الجاهز أقل من المطلوب: دي اللي بتوقّف أوردرات. اضغط على صنف يفتح الأوردرات المتوقفة بسببه." head={['مطلوب', 'جاهز', 'ناقص']} empty="مفيش أصناف ناقصة."
        rows={pick.filter((x) => x.ready < x.need).sort((x, y) => (y.need - y.ready) - (x.need - x.ready)).map((x) => ({ sku: x.sku, cells: [fmt(x.need), fmt(x.ready), <b key="s" className="text-crit">{fmt(x.need - x.ready)}</b>] }))} onItem={setSkuOrd} onClose={() => setCard(null)} />}
      {card === 'pieces' && <OrdersDetail d={d} title="القطع المطلوبة (لم تُشحن)" hint="كل الأوردرات المفتوحة: المتوقفة والمستنية الشحن." orders={d.open} startTab="items" onClose={() => setCard(null)}
        chips={[{ id: 'wait', label: 'بانتظار الشحن', test: (o) => !d.blocked.has(o.ref) }, { id: 'blocked', label: 'متوقف', test: (o) => d.blocked.has(o.ref) }]}
        cols={[{ head: 'تاريخ البيك أب', cell: (o) => <span className="num">{d.pickupDate.get(o.pickupId) ?? '—'}</span> }]} />}
      {skuOrd && <SkuOrders d={d} sku={skuOrd} onClose={() => setSkuOrd(null)} />}
      {settle && <SettleUpload d={d} onClose={() => setSettle(false)} />}
      {pkSheet && !orderRef && <PickupOrders d={d} pickupId={pkSheet} onClose={() => setPkSheet(null)} onOrder={setOrderRef} />}
      {orderRef && <OrderSheet d={d} orderRef={orderRef} onClose={() => setOrderRef(null)} onCancel={(c) => { setOrderRef(null); setPkSheet(null); setCancel(c); }} />}
      {upload && <UploadSheet d={d} mode={upload} onClose={() => setUpload(null)} />}
      {manual && <UploadSheet d={d} mode="scan" manualRefs={manual} onClose={() => { setManual(null); setSel(new Set()); }} />}
      {cancel !== null && <CancelSheet d={d} initial={cancel} onClose={() => setCancel(null)} />}
    </>
  );
}
