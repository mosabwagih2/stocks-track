import { useMemo, useState, type ReactNode } from 'react';
import type { Derived } from '@/femini/hooks/data';
import type { Order } from '@/femini/domain/types';
import { skuLabel } from '@/femini/domain/orders';
import { qty } from '@/femini/domain/ledger';
import { fmt } from '@/femini/cn';
import { Chip, Empty, Sheet, TableWrap, Tabs, th, td } from './ui';
import { OrderPill } from './shared';
import { OrderSheet, CancelSheet } from './OrderSheets';
import { Thumb } from './Thumb';

/**
 * The detail a card opens: a list of orders (with their items on a second tab) or a list of items. Every card of the app that
 * counts something opens one of these, so the number can always be traced back to the orders and items behind it.
 */
const PAGE = 100;
export interface OrderCol { head: string; cell: (o: Order) => ReactNode }
export interface OrderChip { id: string; label: string; test: (o: Order) => boolean }

/** A list of orders: search, optional filter chips, the items of the same orders on the second tab, click an order to open it. */
export function OrdersDetail({ d, title, hint, orders, cols = [], chips = [], startTab = 'orders', onClose }: {
  d: Derived; title: ReactNode; hint?: ReactNode; orders: Order[]; cols?: OrderCol[]; chips?: OrderChip[]; startTab?: 'orders' | 'items'; onClose: () => void;
}) {
  const [tab, setTab] = useState<'orders' | 'items'>(startTab);
  const [q, setQ] = useState(''); const [chip, setChip] = useState(''); const [sku, setSku] = useState(''); const [n, setN] = useState(PAGE);
  const [openRef, setOpenRef] = useState<string | null>(null); const [cancelRef, setCancelRef] = useState<string | null>(null);
  const active = chips.find((c) => c.id === chip);
  const scoped = useMemo(() => (active ? orders.filter(active.test) : orders), [orders, active]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return scoped.filter((o) => (!sku || o.lines.includes(sku)) && (!s || o.ref.toLowerCase().includes(s) || o.waybill.includes(s) || o.gov.includes(s)));
  }, [scoped, q, sku]);
  const items = useMemo(() => {
    const m = new Map<string, number>(); for (const o of scoped) for (const s of o.lines) m.set(s, (m.get(s) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [scoped]);
  const pieces = list.reduce((a, o) => a + o.lines.length, 0);
  return (
    <Sheet title={title} onClose={onClose} wide>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {chips.length > 0 && <><Chip pressed={!chip} onClick={() => { setChip(''); setN(PAGE); }}>الكل <span className="font-mono text-xs opacity-75">{orders.length}</span></Chip>
          {chips.map((c) => <Chip key={c.id} pressed={chip === c.id} onClick={() => { setChip(c.id); setN(PAGE); }}>{c.label} <span className="font-mono text-xs opacity-75">{orders.filter(c.test).length}</span></Chip>)}</>}
        {sku && <Chip pressed onClick={() => setSku('')}>{skuLabel(d.skuMap, sku)} ✕</Chip>}
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[['orders', `الأوردرات (${fmt(list.length)})`], ['items', `الأصناف (${fmt(items.length)})`]]} />
      {tab === 'orders' ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setN(PAGE); }} placeholder="بحث بالبوليصة أو رقم الأوردر أو المحافظة" className="min-w-48 flex-1" aria-label="بحث" />
            <span className="text-sm text-muted"><b className="num text-ink">{fmt(list.length)}</b> أوردر · <b className="num text-ink">{fmt(pieces)}</b> قطعة</span>
          </div>
          {!list.length ? <Empty>مفيش أوردرات هنا.</Empty> : (
            <TableWrap><table className="text-sm"><thead><tr>{['البوليصة', 'رقم الأوردر', 'المحافظة', 'قطع', 'الحالة', ...cols.map((c) => c.head)].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>{list.slice(0, n).map((o) => (
                <tr key={o.ref} className="cursor-pointer hover:bg-lav" onClick={() => setOpenRef(o.ref)}>
                  <td className={td + ' font-mono'}>{o.ref}</td><td className={td + ' font-mono text-muted'}>{o.waybill}</td><td className={td}>{o.gov}</td><td className={td + ' font-mono'}>{o.lines.length}</td>
                  <td className={td}><OrderPill o={o} d={d} /></td>
                  {cols.map((c) => <td key={c.head} className={td}>{c.cell(o)}</td>)}
                </tr>))}</tbody></table></TableWrap>
          )}
          {list.length > n && <div className="text-center"><button type="button" className="rounded-lg px-3 py-1.5 text-sm text-accent hover:bg-lav" onClick={() => setN((x) => x + PAGE)}>عرض {fmt(Math.min(PAGE, list.length - n))} كمان</button></div>}
        </>
      ) : (
        !items.length ? <Empty>مفيش أصناف.</Empty> : (
          <TableWrap><table className="text-sm"><thead><tr>{['الصنف', 'في الأوردرات', 'جاهز الآن'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{items.slice(0, 300).map(([s, c]) => { const r = qty(d.snap.balances, s, 'READY'); return (
              <tr key={s} className="cursor-pointer hover:bg-lav" onClick={() => { setSku(s); setTab('orders'); }}>
                <td className={td}><span className="flex items-center gap-2"><Thumb model={d.modelMap.get(d.skuMap.get(s)?.model ?? '')} size={36} />{skuLabel(d.skuMap, s)}</span></td>
                <td className={td + ' font-mono font-semibold'}>{fmt(c)}</td>
                <td className={td + ' font-mono ' + (r < c ? 'text-crit' : '')}>{fmt(r)}</td>
              </tr>); })}</tbody></table></TableWrap>
        )
      )}
      {openRef && <OrderSheet d={d} orderRef={openRef} onClose={() => setOpenRef(null)} onCancel={(c) => { setOpenRef(null); setCancelRef(c); }} />}
      {cancelRef && <CancelSheet d={d} initial={cancelRef} onClose={() => setCancelRef(null)} />}
    </Sheet>
  );
}

/** A list of items with their own columns (what is requested, short, stagnant…); an item can open the orders that ask for it. */
export function ItemsDetail({ d, title, hint, head, rows, onClose, onItem, empty = 'مفيش أصناف.' }: {
  d: Derived; title: ReactNode; hint?: ReactNode; head: string[]; rows: { sku: string; cells: ReactNode[] }[]; onClose: () => void; onItem?: (sku: string) => void; empty?: string;
}) {
  const [q, setQ] = useState(''); const [n, setN] = useState(PAGE);
  const s = q.trim().toLowerCase();
  const list = rows.filter((r) => !s || skuLabel(d.skuMap, r.sku).toLowerCase().includes(s));
  return (
    <Sheet title={title} onClose={onClose} wide>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setN(PAGE); }} placeholder="بحث بالموديل أو اللون أو المقاس" className="min-w-48 flex-1" aria-label="بحث" />
        <span className="text-sm text-muted"><b className="num text-ink">{fmt(list.length)}</b> صنف</span>
      </div>
      {!list.length ? <Empty>{empty}</Empty> : (
        <TableWrap><table className="text-sm"><thead><tr>{['الصنف', ...head].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{list.slice(0, n).map((r) => (
            <tr key={r.sku} className={onItem ? 'cursor-pointer hover:bg-lav' : ''} onClick={onItem ? () => onItem(r.sku) : undefined}>
              <td className={td}><span className="flex items-center gap-2"><Thumb model={d.modelMap.get(d.skuMap.get(r.sku)?.model ?? '')} size={36} />{skuLabel(d.skuMap, r.sku)}</span></td>
              {r.cells.map((c, i) => <td key={i} className={td + ' font-mono'}>{c}</td>)}
            </tr>))}</tbody></table></TableWrap>
      )}
      {list.length > n && <div className="text-center"><button type="button" className="rounded-lg px-3 py-1.5 text-sm text-accent hover:bg-lav" onClick={() => setN((x) => x + PAGE)}>عرض {fmt(Math.min(PAGE, list.length - n))} كمان</button></div>}
    </Sheet>
  );
}

/** The open orders that ask for one item, with how many of it each one is short. */
export function SkuOrders({ d, sku, onClose }: { d: Derived; sku: string; onClose: () => void }) {
  const orders = useMemo(() => d.open.filter((o) => o.lines.includes(sku)), [d, sku]);
  return (
    <OrdersDetail d={d} title={`أوردرات ${skuLabel(d.skuMap, sku)}`} hint={`جاهز الآن ${fmt(qty(d.snap.balances, sku, 'READY'))} قطعة · المطلوب ${fmt(orders.reduce((a, o) => a + o.lines.filter((l) => l === sku).length, 0))}`}
      orders={orders} onClose={onClose}
      cols={[{ head: 'ناقص فيه', cell: (o) => { const s = d.blocked.get(o.ref)?.find((x) => x.sku === sku)?.short; return s ? <b className="num text-crit">{s}</b> : <span className="text-muted">—</span>; } }]} />
  );
}
