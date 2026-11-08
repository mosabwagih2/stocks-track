import { useMemo, useState } from 'react';
import type { Derived } from '@/femini/hooks/data';
import type { Order } from '@/femini/domain/types';
import { channelName } from '@/femini/domain/constants';
import { fmt } from '@/femini/cn';
import { Chip, Empty, Kpi, Sheet, TableWrap, th, td } from './ui';
import { OrderPill } from './shared';

type F = 'all' | 'wait' | 'blocked' | 'done' | 'paid' | 'returned' | 'cx' | 'bad';
const FILTERS: [F, string][] = [['all', 'الكل'], ['wait', 'بانتظار الشحن'], ['blocked', 'متوقف'], ['done', 'مشحون'], ['paid', 'تم التحصيل'], ['returned', 'مرتجع'], ['cx', 'ملغي'], ['bad', 'كود غير مربوط']];

/** One pickup's orders: search a waybill, filter by state, open an order. */
export function PickupOrders({ d, pickupId, onClose, onOrder }: { d: Derived; pickupId: string; onClose: () => void; onOrder: (ref: string) => void }) {
  const p = d.snap.pickups.find((x) => x.id === pickupId);
  const [f, setF] = useState<F>('all'); const [q, setQ] = useState('');
  const all = useMemo(() => d.snap.orders.filter((o) => o.pickupId === pickupId), [d, pickupId]);
  const is = (o: Order, x: F) => {
    if (x === 'cx') return o.status === 'cancelled';
    if (o.status === 'cancelled') return false;
    if (x === 'all') return true;
    if (x === 'wait') return o.status === 'open' && !d.blocked.has(o.ref);
    if (x === 'blocked') return o.status === 'open' && d.blocked.has(o.ref);
    if (x === 'done') return o.status === 'shipped' && !o.returned && !d.collected.has(o.ref);
    if (x === 'paid') return o.status === 'shipped' && !o.returned && d.collected.has(o.ref);
    if (x === 'returned') return !!o.returned;
    return o.unmapped.length > 0;
  };
  const count = (x: F) => all.filter((o) => is(o, x)).length;
  const s = q.trim().toLowerCase();
  const list = all.filter((o) => is(o, f) && (!s || o.ref.toLowerCase().includes(s) || o.waybill.includes(s) || o.gov.includes(s)));
  if (!p) return null;
  const live = all.filter((o) => o.status !== 'cancelled');
  return (
    <Sheet title={`${p.label} · ${p.date}`} onClose={onClose} wide>
      <p className="text-sm text-muted">{channelName(p.channel)} · {p.source}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="أوردرات" value={live.length} sub={`${fmt(live.reduce((a, o) => a + o.lines.length, 0))} قطعة`} />
        <Kpi label="مشحون" value={live.filter((o) => o.status === 'shipped').length} tone="good" />
        <Kpi label="لسه" value={count('wait') + count('blocked')} tone={count('blocked') ? 'crit' : undefined} sub={count('blocked') ? `${count('blocked')} متوقف` : undefined} />
        <Kpi label="مرتجع / ملغي" value={`${count('returned')} / ${count('cx')}`} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.filter(([x]) => x === 'all' || count(x) > 0).map(([x, l]) => <Chip key={x} pressed={f === x} onClick={() => setF(x)}>{l} <span className="font-mono text-xs opacity-75">{count(x)}</span></Chip>)}
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالبوليصة أو رقم الأوردر" className="min-w-48 flex-1" aria-label="بحث في البيك أب" autoFocus />
      </div>
      {!list.length ? <Empty>مفيش أوردرات مطابقة.</Empty> : (
        <TableWrap><table className="text-sm"><thead><tr>{['البوليصة', 'رقم الأوردر', 'المحافظة', 'قطع', 'الحالة'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{list.map((o) => (
            <tr key={o.ref} className="cursor-pointer hover:bg-lav" onClick={() => onOrder(o.ref)}>
              <td className={td + ' font-mono'}>{o.ref}</td><td className={td + ' font-mono text-muted'}>{o.waybill}</td><td className={td}>{o.gov}</td><td className={td + ' font-mono'}>{o.lines.length}</td><td className={td}><OrderPill o={o} d={d} /></td>
            </tr>))}</tbody></table></TableWrap>
      )}
    </Sheet>
  );
}
