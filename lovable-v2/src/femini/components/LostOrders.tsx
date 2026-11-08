import { useMemo, useState } from 'react';
import type { Derived } from '@/femini/hooks/data';
import { lostOrders } from '@/femini/domain/lost';
import { skuLabel } from '@/femini/domain/orders';
import { cn } from '@/femini/cn';
import { Chip, Empty } from './ui';

/**
 * The history of returned orders with lost pieces: waybill, order number, the return, and every piece of the parcel with
 * the missing ones marked. `onPick` (the "lost" operation): a click on a missing piece adds it to the settlement.
 */
export function LostOrders({ d, onPick }: { d: Derived; onPick?: (sku: string) => void }) {
  const all = useMemo(() => lostOrders(d.snap.docs, d.snap.orders, d.snap.moves), [d]);
  const [open, setOpen] = useState(true); const [q, setQ] = useState('');
  const isOpen = (r: (typeof all)[number]) => r.items.some((i) => i.missing && !i.settled);
  const s = q.trim().toLowerCase();
  const list = all.filter((r) => (!open || isOpen(r)) && (!s || r.ref.toLowerCase().includes(s) || r.orderNo.includes(s) || r.items.some((i) => i.missing && i.sku.toLowerCase().includes(s)))).slice().reverse();
  const nOpen = all.filter(isOpen).length;
  if (!all.length) return <Empty>مفيش أوردرات فيها قطع مفقودة.</Empty>;
  return (
    <div className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Chip pressed={open} onClick={() => setOpen(true)}>لسه مفقود <span className="font-mono text-xs opacity-75">{nOpen}</span></Chip>
        <Chip pressed={!open} onClick={() => setOpen(false)}>كل التاريخ <span className="font-mono text-xs opacity-75">{all.length}</span></Chip>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالبوليصة أو رقم الأوردر أو الصنف" className="min-w-44 flex-1" aria-label="بحث في المفقود" />
      </div>
      {!list.length ? <Empty>مفيش نتائج.</Empty> : list.map((r, k) => (
        <div key={`${r.doc}-${r.ref}-${k}`} className="rounded-xl border border-line bg-surface p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span><span className="text-[11px] text-muted">البوليصة </span><b className="font-mono">{r.ref || '—'}</b>{r.orderNo && <span className="ms-2 text-xs text-muted">رقم الأوردر <span className="font-mono">{r.orderNo}</span></span>}</span>
            <span className="text-[11px] text-muted"><span className="font-mono">{r.doc}</span> · {r.date} · {r.by}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.items.map((i, j) => {
              const lost = i.missing && !i.settled;
              const chip = <span className={cn('inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs', lost ? 'border-crit-line bg-crit-bg font-semibold text-crit' : i.missing ? 'border-line bg-lav text-muted line-through' : 'border-line text-muted')}>
                {skuLabel(d.skuMap, i.sku)}{lost ? ' · ناقص' : i.missing ? ' · اتسوّى' : ''}</span>;
              return lost && onPick ? <button key={j} type="button" title="ضيفه للتسوية" onClick={() => onPick(i.sku)} className="rounded-lg transition hover:brightness-95">{chip}</button> : <span key={j}>{chip}</span>;
            })}
          </div>
          {r.shared && <p className="mt-1.5 text-[11px] text-warn">المرتجع ده سجّل الإجمالي بس، والصنف موجود كمان في: <span className="font-mono">{r.shared.join('، ')}</span>. القطعة الناقصة من واحد فيهم.</p>}
        </div>
      ))}
    </div>
  );
}
