import { useDeferredValue, useMemo, useState } from 'react';
import { useDerived } from '@/hooks/data';
import { PageHead } from '@/components/PageHead';
import { Empty, TableWrap, th, td } from '@/components/ui';
import { ErrorBox } from '@/components/shared';
import { Spinner } from '@/components/Spinner';
import { LOC_AR, TYPE_AR } from '@/domain/constants';
import { skuLabel } from '@/domain/orders';

export default function Ledger() {
  const { d, isLoading, error } = useDerived();
  const [q, setQ] = useState(''); const dq = useDeferredValue(q); const [type, setType] = useState('');
  const rows = useMemo(() => {
    if (!d) return [];
    const w = dq.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return d.snap.moves.filter((m) => (!type || m.type === type) && w.every((x) => `${m.sku} ${skuLabel(d.skuMap, m.sku)} ${m.doc}`.toLowerCase().includes(x)));
  }, [d, dq, type]);
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !d) return <Spinner />;
  const types = [...new Set(d.snap.moves.map((m) => m.type))];
  return (
    <>
      <PageHead title="سجل الحركات" sub="كل حركة اتسجلت. مفيش حاجة بتتعدّل أو بتتمسح، والتصحيح بحركة عكسية. بيعرض آخر 400 حركة." />
      <div className="mb-3 flex flex-wrap gap-2">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالصنف أو المستند" className="min-w-52 max-w-xs flex-1" aria-label="بحث" />
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="النوع"><option value="">كل الأنواع</option>{types.map((t) => <option key={t} value={t}>{TYPE_AR[t] ?? t}</option>)}</select>
      </div>
      <TableWrap>
        <table className="text-sm"><thead><tr>{['التاريخ', 'المستند', 'الصنف', 'كمية', 'من', 'إلى', 'ملاحظة'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.slice(0, 200).map((m) => (
            <tr key={m.id}><td className={td + ' font-mono'}>{m.date}</td><td className={td + ' font-mono'}>{m.doc}</td><td className={td}>{skuLabel(d.skuMap, m.sku)}</td><td className={td + ' font-mono'}>{m.qty}</td><td className={td}>{LOC_AR[m.from]}</td><td className={td}>{LOC_AR[m.to]}</td><td className={td + ' text-muted'}>{m.note}</td></tr>
          ))}{!rows.length && <tr><td colSpan={7}><Empty>مفيش حركات.</Empty></td></tr>}</tbody></table>
      </TableWrap>
    </>
  );
}
