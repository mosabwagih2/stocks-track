import { useMemo, useState } from 'react';
import type { Derived } from '@/femini/hooks/data';
import type { Sku } from '@/femini/domain/types';
import { qty } from '@/femini/domain/ledger';
import { skuLabel } from '@/femini/domain/orders';
import { fmt } from '@/femini/cn';
import { Card, Chip, Empty, Kpi, TableWrap, th, td } from './ui';
import { Thumb } from './Thumb';

/** What is out of sale: needs cleaning, at the factory, final scrap, and what went to the factory and came back. */
const KIND: Record<string, string> = { 'DIRTY>FACTORY': 'اتبعت غسيل', 'SCRAP>EXT_FACTORY': 'هالك اتسلّم للمصنع', 'FACTORY>READY': 'رجع مغسول', 'FACTORY>SCRAP': 'رجع مرفوض', 'READY>DIRTY': 'اتصنّف هالك نظافة', 'READY>SCRAP': 'اتصنّف هالك نهائي', 'DIRTY>SCRAP': 'هالك نظافة ← نهائي', 'DIRTY>READY': 'اتنضّف هنا', 'SCRAP>READY': 'اتصلّح' };

export function WasteView({ d, onSku }: { d: Derived; onSku: (s: Sku) => void }) {
  const b = d.snap.balances;
  const [only, setOnly] = useState<'all' | 'DIRTY' | 'FACTORY' | 'SCRAP'>('all');
  const rows = useMemo(() => d.snap.skus.map((s) => ({ s, dirty: qty(b, s.id, 'DIRTY'), factory: qty(b, s.id, 'FACTORY'), scrap: qty(b, s.id, 'SCRAP'),
    lastSent: d.snap.moves.find((m) => m.sku === s.id && m.from === 'DIRTY' && m.to === 'FACTORY')?.date ?? '' }))
    .filter((r) => r.dirty || r.factory || r.scrap)
    .sort((a, x) => x.dirty + x.factory + x.scrap - (a.dirty + a.factory + a.scrap)), [d, b]);
  const shown = rows.filter((r) => only === 'all' || (only === 'DIRTY' ? r.dirty : only === 'FACTORY' ? r.factory : r.scrap) !== 0);
  const sum = (k: 'dirty' | 'factory' | 'scrap') => rows.reduce((a, r) => a + r[k], 0);
  const out = (from: string, to: string) => d.snap.moves.reduce((a, m) => a + (m.from === from && m.to === to ? m.qty : 0), 0);
  // the history: every move into or out of cleaning, the factory or scrap, grouped by document
  const history = useMemo(() => {
    const g = new Map<string, { doc: string; date: string; by: string; kind: string; pieces: number }>();
    for (const m of d.snap.moves) {
      const k = KIND[`${m.from}>${m.to}`]; if (!k || m.doc.endsWith('(عكس)')) continue;
      const key = `${m.doc}|${k}`; const e = g.get(key) ?? { doc: m.doc, date: m.date, by: m.by, kind: k, pieces: 0 }; e.pieces += m.qty; g.set(key, e);
    }
    return [...g.values()].slice(0, 60);
  }, [d]);
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="هالك نظافة" value={fmt(sum('dirty'))} sub="محتاج غسيل" tone={sum('dirty') ? 'warn' : undefined} />
        <Kpi label="عند المصنع" value={fmt(sum('factory'))} sub="مستني يرجع" />
        <Kpi label="هالك نهائي" value={fmt(sum('scrap'))} sub="لسه في المخزن" tone={sum('scrap') ? 'crit' : undefined} />
        <Kpi label="اتسلّم للمصنع" value={fmt(out('SCRAP', 'EXT_FACTORY'))} sub="هالك خرج من المخزون" />
        <Kpi label="رجع من الغسيل" value={fmt(out('FACTORY', 'READY'))} sub={`مرفوض ${fmt(out('FACTORY', 'SCRAP'))}`} />
      </div>
      <Card title="الأصناف خارج البيع" hint={`${rows.length} صنف`}>
        <div className="mb-3 flex flex-wrap gap-2">
          {([['all', 'الكل'], ['DIRTY', 'هالك نظافة'], ['FACTORY', 'عند المصنع'], ['SCRAP', 'هالك نهائي']] as const).map(([v, l]) => <Chip key={v} pressed={only === v} onClick={() => setOnly(v)}>{l}</Chip>)}
        </div>
        {!shown.length ? <Empty>مفيش أصناف هنا.</Empty> : (
          <TableWrap><table className="text-sm"><thead><tr>{['الصنف', 'هالك نظافة', 'عند المصنع', 'هالك نهائي', 'آخر إرسال للمصنع'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{shown.slice(0, 300).map((r) => (
              <tr key={r.s.id} className="cursor-pointer hover:bg-lav" onClick={() => onSku(r.s)}>
                <td className={td}><Thumb model={d.modelMap.get(r.s.model)} size={36} className="me-1.5" />{skuLabel(d.skuMap, r.s.id)}</td>
                <td className={td + ' font-mono'}>{fmt(r.dirty)}</td><td className={td + ' font-mono'}>{fmt(r.factory)}</td><td className={td + ' font-mono'}>{fmt(r.scrap)}</td>
                <td className={td + ' font-mono text-muted'}>{r.lastSent || '—'}</td>
              </tr>))}</tbody></table></TableWrap>
        )}
      </Card>
      <Card title="سجل الهالك والمصنع" hint="آخر 60 عملية">
        {!history.length ? <Empty>مفيش عمليات لسه.</Empty> : (
          <TableWrap><table className="text-sm"><thead><tr>{['التاريخ', 'المستند', 'العملية', 'القطع', 'بواسطة'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{history.map((h) => <tr key={`${h.doc}|${h.kind}`}><td className={td + ' font-mono'}>{h.date}</td><td className={td + ' font-mono'}>{h.doc}</td><td className={td}>{h.kind}</td><td className={td + ' font-mono'}>{fmt(h.pieces)}</td><td className={td}>{h.by}</td></tr>)}</tbody></table></TableWrap>
        )}
      </Card>
    </div>
  );
}
