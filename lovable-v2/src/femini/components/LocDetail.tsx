import { useMemo } from 'react';
import { Empty, Sheet } from './ui';
import { LOC_AR, LOC_HINT, TYPE_AR } from '@/femini/domain/constants';
import { qty } from '@/femini/domain/ledger';
import { skuLabel } from '@/femini/domain/orders';
import { fmt } from '@/femini/cn';
import type { Derived } from '@/femini/hooks/data';
import type { Loc } from '@/femini/domain/types';

/** Details of one stock state: what is in it (by model and piece) and its latest moves. */
export function LocDetail({ d, loc, onClose }: { d: Derived; loc: Loc; onClose: () => void }) {
  const { items, models, total, moves } = useMemo(() => {
    const items = d.snap.skus.map((s) => ({ s, q: qty(d.snap.balances, s.id, loc) })).filter((x) => x.q > 0).sort((a, b) => b.q - a.q);
    const byModel = new Map<string, number>();
    for (const x of items) byModel.set(x.s.model, (byModel.get(x.s.model) ?? 0) + x.q);
    const models = [...byModel].sort((a, b) => b[1] - a[1]);
    const total = items.reduce((a, x) => a + x.q, 0);
    const moves = d.snap.moves.filter((m) => m.from === loc || m.to === loc).slice(-30).reverse();
    return { items, models, total, moves };
  }, [d, loc]);
  return (
    <Sheet title={LOC_AR[loc]} onClose={onClose} wide>
      <div className="grid gap-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-xs text-muted">إجمالي القطع</p><b className="num text-2xl">{fmt(total)}</b></div>
          <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-xs text-muted">عدد الأصناف</p><b className="num text-2xl">{fmt(items.length)}</b></div>
        </div>
        <p className="text-xs text-muted">{LOC_HINT[loc]}</p>
        {total === 0 ? <Empty>مفيش قطع في الحالة دي دلوقتي.</Empty> : (
          <>
            <section className="grid gap-2">
              <h3 className="text-sm font-semibold">حسب الموديل</h3>
              {models.map(([m, q]) => (
                <div key={m} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
                  <span className="truncate font-medium"><b className="font-mono">{m}</b> <span className="text-muted">{d.modelMap.get(m)?.name ?? ""}</span></span>
                  <span className="h-2 overflow-hidden rounded-full bg-lav"><span className="block h-full rounded-full bg-accent" style={{ width: `${(q / total) * 100}%` }} /></span>
                  <b className="num">{fmt(q)}</b>
                </div>
              ))}
            </section>
            <section className="grid gap-2">
              <h3 className="text-sm font-semibold">الأصناف</h3>
              <ul className="grid max-h-72 gap-1 overflow-y-auto rounded-xl border border-line p-1">
                {items.map(({ s, q }) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm odd:bg-lav/50">
                    <span className="min-w-0 truncate">{skuLabel(d.skuMap, s.id)}</span><b className="num shrink-0">{fmt(q)}</b>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
        <section className="grid gap-2">
          <h3 className="text-sm font-semibold">آخر الحركات</h3>
          {moves.length === 0 ? <Empty>مفيش حركات على الحالة دي.</Empty> : (
            <ul className="grid max-h-72 gap-1 overflow-y-auto rounded-xl border border-line p-1">
              {moves.map((m) => {
                const inn = m.to === loc;
                return (
                  <li key={m.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm odd:bg-lav/50">
                    <span className="min-w-0">
                      <span className="block truncate">{skuLabel(d.skuMap, m.sku)}</span>
                      <span className="block text-[11px] text-muted">{TYPE_AR[m.type] ?? m.type} · {m.date}{m.by ? ` · ${m.by}` : ''}</span>
                    </span>
                    <b className={`num shrink-0 ${inn ? 'text-good' : 'text-crit'}`}>{inn ? '+' : '−'}{fmt(m.qty)}</b>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Sheet>
  );
}
