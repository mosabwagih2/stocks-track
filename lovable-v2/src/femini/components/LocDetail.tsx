import { useMemo } from 'react';
import { Alert, Empty, Sheet } from './ui';
import { LOC_AR, LOC_HINT } from '@/femini/domain/constants';
import { locTotal, qty } from '@/femini/domain/ledger';
import { fmt } from '@/femini/cn';
import { MoveRows } from './MoveRows';
import type { Derived } from '@/femini/hooks/data';
import type { Loc } from '@/femini/domain/types';

/** Details of one stock state: what is in it (by model, then by piece) and its latest moves. Compact on purpose. */
export function LocDetail({ d, loc, onClose }: { d: Derived; loc: Loc; onClose: () => void }) {
  const { items, models, total, negative, moves } = useMemo(() => {
    const all = d.snap.skus.map((s) => ({ s, q: qty(d.snap.balances, s.id, loc) })).filter((x) => x.q !== 0);
    const items = all.filter((x) => x.q > 0).sort((a, b) => b.q - a.q);
    const negative = all.filter((x) => x.q < 0);
    const byModel = new Map<string, number>();
    for (const x of items) byModel.set(x.s.model, (byModel.get(x.s.model) ?? 0) + x.q);
    const models = [...byModel].sort((a, b) => b[1] - a[1]);
    // the same net total as everywhere else (negative variants included), so the numbers never disagree
    const total = locTotal(d.snap.balances, loc);
    const moves = d.snap.moves.filter((m) => m.from === loc || m.to === loc).slice(0, 30);
    return { items, models, total, negative, moves };
  }, [d, loc]);
  const top = models[0]?.[1] ?? 1;
  return (
    <Sheet title={LOC_AR[loc]} onClose={onClose}>
      <div className="grid gap-4">
        <div className="flex items-end justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
          <div><p className="text-[11px] text-muted">إجمالي القطع</p><b className="num text-xl">{fmt(total)}</b></div>
          <div className="text-end"><p className="text-[11px] text-muted">أصناف فيها قطع</p><b className="num text-xl">{fmt(items.length)}</b></div>
        </div>
        <p className="-mt-2 text-xs text-muted">{LOC_HINT[loc]}</p>
        {negative.length > 0 && <Alert tone="warn" className="-mt-1 py-2 text-xs">{negative.length} صنف رصيده بالسالب ({fmt(negative.reduce((a, x) => a + x.q, 0))} قطعة) ومحسوب في الإجمالي. محتاجين جرد.</Alert>}
        {items.length === 0 ? <Empty>مفيش قطع في الحالة دي دلوقتي.</Empty> : (
          <section className="grid gap-1.5">
            <h3 className="text-xs font-semibold text-muted">حسب الموديل</h3>
            {models.map(([m, q]) => (
              <div key={m} className="grid grid-cols-[minmax(0,8.5rem)_1fr_3.5rem] items-center gap-2.5 text-[13px]">
                <span className="truncate"><b className="font-mono">{m}</b> <span className="text-muted">{d.modelMap.get(m)?.name ?? ''}</span></span>
                <span className="h-1.5 overflow-hidden rounded-full bg-lav"><span className="block h-full rounded-full bg-accent" style={{ width: `${(q / top) * 100}%` }} /></span>
                <b className="num text-end">{fmt(q)}</b>
              </div>
            ))}
          </section>
        )}
        <section className="grid gap-1.5">
          <h3 className="text-xs font-semibold text-muted">آخر الحركات</h3>
          {moves.length === 0 ? <Empty>مفيش حركات على الحالة دي.</Empty> : <MoveRows d={d} moves={moves} loc={loc} max={30} />}
        </section>
      </div>
    </Sheet>
  );
}
