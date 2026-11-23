import { useState } from 'react';
import { useAct, useDerived } from '@/femini/hooks/data';
import { repo } from '@/femini/data';
import { priceConflicts, supplyPrice } from '@/femini/domain/price';
import { fmt } from '@/femini/cn';
import { Alert, Button, Card, Field, TableWrap, td, th } from './ui';

/**
 * «سعر التوريد»: one price per model, used for every amount that is worked out from pieces (stock value, shop supply,
 * counts, pieces still out). Saved into both old fields (`cost` and `price`) so the stored shape, the server and the
 * backups stay the same.
 */
export function ModelCosts() {
  const { d } = useDerived(); const act = useAct();
  const [model, setModel] = useState(''); const [price, setPrice] = useState('');
  if (!d) return null;
  const conflicts = priceConflicts(d.snap.costs);
  const rows = Object.entries(d.snap.costs).sort((a, b) => a[0].localeCompare(b[0]));
  const ok = !!model && price !== '' && Number.isFinite(Number(price)) && Number(price) >= 0;
  return (
    <Card title="سعر التوريد" hint="سعر القطعة لكل موديل · كل حساب بالفلوس من عدد القطع بيتعمل بيه">
      {conflicts.length > 0 && <Alert tone="warn">الموديلات دي كان ليها رقمين مختلفين (تكلفة وسعر بيع)، والمستخدم دلوقتي هو التكلفة: {conflicts.map((c) => `${c.model}: تكلفة ${fmt(c.cost)}، بيع ${fmt(c.price)}`).join(' · ')}. لو عايز الرقم التاني، اختار الموديل واحفظه.</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الموديل">
          <select value={model} onChange={(e) => { const code = e.target.value; setModel(code); setPrice(String(supplyPrice(d.snap.costs[code]))); }}>
            <option value="">اختر الموديل</option>
            {d.snap.models.map((m) => <option key={m.code} value={m.code}>{m.code} · {m.name}</option>)}
          </select>
        </Field>
        <Field label="سعر التوريد (جنيه)"><input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
      </div>
      <Button className="my-3" variant="primary" disabled={!ok} onClick={() => act(() => repo.setModelCosts(model, Number(price), Number(price)), 'تم حفظ سعر التوريد')}>حفظ السعر</Button>
      <TableWrap><table><thead><tr>{['الموديل', 'سعر التوريد'].map((h) => <th className={th} key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map(([code, c]) => <tr key={code}><td className={td}>{code}</td><td className={td + ' num'}>{fmt(supplyPrice(c))}</td></tr>)}</tbody></table></TableWrap>
    </Card>
  );
}
