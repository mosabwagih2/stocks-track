import type { Derived } from '@/femini/hooks/data';
import { Button, Pill, TableWrap, th, td } from './ui';
import { channelName } from '@/femini/domain/constants';
import { dmy } from '@/femini/domain/dates';
import { fmt } from '@/femini/cn';

/** One archived pickup, with what you need to tell it from another: the file, the day, the channel, the orders and pieces by state, what came back through a return, and orders it shares with other pickups. */
export function ArchivedPickup({ x, d, who, dup, returned, onRestore }: { x: Derived['snap']['archivedPickups'][number]; d: Derived; who: (by?: string, at?: string) => string; dup: [string, number][]; returned: number; onRestore: () => void }) {
  const by = (st: string) => x.orders.filter((o) => o.status === st).length; const pieces = x.orders.reduce((a, o) => a + o.lines.length, 0);
  const models = new Map<string, number>(); for (const o of x.orders) for (const sku of o.lines) { const m = d.skuMap.get(sku)?.model ?? '؟'; models.set(m, (models.get(m) ?? 0) + 1); }
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <div className="flex flex-wrap items-center gap-2"><b>{x.pickup.label}</b><Pill tone="neutral">بيك أب</Pill><span className="text-sm text-muted">{channelName(x.pickup.channel)} · يوم {dmy(x.pickup.date)}</span></div>
          <p className="break-all text-xs text-muted" dir="ltr">{x.pickup.source || 'اسم الملف مش متسجّل'}</p>
          <p className="text-xs text-muted"><b className="num text-ink">{fmt(x.orders.length)}</b> أوردر · <b className="num text-ink">{fmt(pieces)}</b> قطعة · مفتوح {fmt(by('open'))}{by('shipped') ? ` · مشحون ${fmt(by('shipped'))}` : ''}{by('cancelled') ? ` · ملغي ${fmt(by('cancelled'))}` : ''}{returned ? ` · رجع منه ${fmt(returned)} بمرتجع` : ''}</p>
          <p className="text-xs text-muted">{who(x.by, x.at)}</p>
          {dup.length > 0 && <p className="text-xs text-warn">أوردرات مكررة مع: {dup.slice(0, 4).map(([l, n]) => `${l} (${fmt(n)})`).join('، ')}</p>}
        </div>
        <Button onClick={onRestore}>استرجاع</Button>
      </div>
      <details className="mt-3 rounded-lg border border-line">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">الأوردرات والأصناف اللي فيه</summary>
        <div className="grid gap-3 border-t border-line p-3">
          <div className="flex flex-wrap gap-1.5">{[...models].sort((a, b) => b[1] - a[1]).map(([m, n]) => <Pill key={m} tone="info">{m} · {fmt(n)}</Pill>)}</div>
          <TableWrap maxHeight="18rem"><table className="text-sm"><thead><tr>{['الكود', 'البوليصة', 'المحافظة', 'قطع', 'الحالة'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{x.orders.slice(0, 200).map((o) => <tr key={o.ref}><td className={td + ' font-mono'}>{o.ref}</td><td className={td + ' font-mono text-muted'}>{o.waybill}</td><td className={td}>{o.gov}</td><td className={td + ' font-mono'}>{o.lines.length}</td><td className={td}>{o.status === 'open' ? 'مفتوح' : o.status === 'shipped' ? 'مشحون' : 'ملغي'}</td></tr>)}</tbody></table></TableWrap>
          {x.orders.length > 200 && <p className="text-xs text-muted">أول 200 من {fmt(x.orders.length)} أوردر.</p>}
        </div>
      </details>
    </div>
  );
}
