import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { Derived } from '@/femini/hooks/data';
import { lostOrders } from '@/femini/domain/lost';
import { skuLabel } from '@/femini/domain/orders';
import { cn } from '@/femini/cn';
import { Chip, Empty } from './ui';

/**
 * The history of returned orders with lost pieces: waybill, order number, the return, how many pieces are missing, and every
 * piece of the parcel (missing = red, came back = white, settled later = crossed out).
 * With `onToggle` (the "lost" operation): a click on a missing piece picks it for the settlement, a second click drops it.
 * `picked` is how many of each sku the settlement holds; the first that many open pieces of that sku show as picked.
 */
export function LostOrders({ d, picked, onToggle }: { d: Derived; picked?: Record<string, number>; onToggle?: (sku: string, add: boolean) => void }) {
  const all = useMemo(() => lostOrders(d.snap.docs, d.snap.orders, d.snap.moves), [d]);
  const [open, setOpen] = useState(true); const [q, setQ] = useState('');
  const openCount = (r: (typeof all)[number]) => r.items.filter((i) => i.missing && !i.settled).length;
  const s = q.trim().toLowerCase();
  const list = all.filter((r) => (!open || openCount(r) > 0) && (!s || r.ref.toLowerCase().includes(s) || r.orderNo.includes(s) || r.items.some((i) => i.missing && i.sku.toLowerCase().includes(s)))).slice().reverse();
  const nOpen = all.filter((r) => openCount(r) > 0).length;
  const totalOpen = all.reduce((a, r) => a + (r.shared ? 0 : openCount(r)), 0);
  if (!all.length) return <Empty>مفيش أوردرات فيها قطع مفقودة.</Empty>;
  // which open piece chips are picked: per sku, the first `picked[sku]` of them in the list as shown
  const left: Record<string, number> = { ...(picked ?? {}) };
  return (
    <div className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Chip pressed={open} onClick={() => setOpen(true)}>لسه مفقود <span className="font-mono text-xs opacity-75">{nOpen}</span></Chip>
        <Chip pressed={!open} onClick={() => setOpen(false)}>كل التاريخ <span className="font-mono text-xs opacity-75">{all.length}</span></Chip>
        <span className="text-xs text-muted">إجمالي الناقص: <b className="num text-crit">{totalOpen}</b> قطعة</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالبوليصة أو رقم الأوردر أو الصنف" className="min-w-44 flex-1" aria-label="بحث في المفقود" />
      </div>
      {!list.length ? <Empty>مفيش نتائج.</Empty> : list.map((r, k) => {
        const miss = r.items.filter((i) => i.missing).length; const nowOpen = openCount(r);
        return (
          <div key={`${r.doc}-${r.ref}-${k}`} className="rounded-xl border border-line bg-surface p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span><span className="text-[11px] text-muted">البوليصة </span><b className="font-mono">{r.ref || '—'}</b></span>
                {r.orderNo && <span className="text-xs text-muted">رقم الأوردر <span className="font-mono">{r.orderNo}</span></span>}
                <span className="rounded-full bg-crit-bg px-2 py-0.5 text-xs font-semibold text-crit">ناقص {nowOpen} من {r.items.length} قطعة{miss > nowOpen ? ` · اتسوّى ${miss - nowOpen}` : ''}</span>
              </span>
              <span className="text-[11px] text-muted"><span className="font-mono">{r.doc}</span> · {r.date} · {r.by}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.items.map((i, j) => {
                const lost = i.missing && !i.settled;
                const on = lost && (left[i.sku] ?? 0) > 0; if (on) left[i.sku]--;
                const chip = <span className={cn('inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs',
                  on ? 'border-crit bg-crit font-semibold text-on-accent' : lost ? 'border-crit-line bg-crit-bg font-semibold text-crit' : i.missing ? 'border-line bg-lav text-muted line-through' : 'border-line bg-white text-ink')}>
                  {on && <Check className="size-3.5" />}{skuLabel(d.skuMap, i.sku)}{lost ? ' · ناقص' : i.missing ? ' · اتسوّى' : ''}</span>;
                return lost && onToggle
                  ? <button key={j} type="button" aria-pressed={on} title={on ? 'شيله من التسوية' : 'اختاره للتسوية'} onClick={() => onToggle(i.sku, !on)} className="rounded-lg transition hover:brightness-95">{chip}</button>
                  : <span key={j}>{chip}</span>;
              })}
            </div>
            {r.shared && <p className="mt-1.5 text-[11px] text-warn">المرتجع ده سجّل الإجمالي بس، والصنف موجود كمان في: <span className="font-mono">{r.shared.join('، ')}</span>. القطعة الناقصة من واحد فيهم.</p>}
          </div>
        );
      })}
    </div>
  );
}
