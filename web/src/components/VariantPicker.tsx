import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Field } from './ui';
import type { Derived } from '@/hooks/data';
import type { Loc } from '@/domain/types';
import { qty } from '@/domain/ledger';
import { LOC_AR } from '@/domain/constants';

/** model -> color -> size selectors (three separate fields, never a typed code) */
export function VariantPicker({ d, onAdd, from }: { d: Derived; onAdd: (sku: string, q: number) => void; from?: Loc }) {
  const models = useMemo(() => [...d.snap.models].map((m) => m.code).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), [d]);
  const [model, setModel] = useState(models[0] ?? ''); const [color, setColor] = useState(''); const [size, setSize] = useState(''); const [q, setQ] = useState(1);
  const ms = useMemo(() => d.snap.skus.filter((s) => s.model === model), [d, model]);
  const colors = useMemo(() => [...new Set(ms.map((s) => s.color))], [ms]);
  const sizes = useMemo(() => d.snap.sizes.filter((z) => ms.some((s) => s.size === z)), [d, ms]);
  const c = colors.includes(color) ? color : colors[0] ?? ''; const z = sizes.includes(size) ? size : sizes[0] ?? '';
  const sku = ms.find((s) => s.color === c && s.size === z);
  return (
    <div className="grid gap-2 rounded-xl border border-line bg-lav p-3">
      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
        <Field label="الموديل"><select value={model} onChange={(e) => setModel(e.target.value)}>{models.map((m) => <option key={m} value={m}>{m} · {d.modelMap.get(m)?.name}</option>)}</select></Field>
        <Field label="اللون"><select value={c} onChange={(e) => setColor(e.target.value)}>{colors.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="المقاس"><select value={z} onChange={(e) => setSize(e.target.value)}>{sizes.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="الكمية"><input type="number" min={1} value={q} onChange={(e) => setQ(Math.max(1, Math.floor(+e.target.value || 1)))} className="w-20" /></Field>
        <Button variant="primary" disabled={!sku} onClick={() => sku && onAdd(sku.id, q)}><Plus className="size-4" /> إضافة</Button>
      </div>
      {sku && <p className="text-xs text-muted">{from ? `المتاح في ${LOC_AR[from]}` : 'جاهز حاليًا'}: <b className="font-mono">{qty(d.snap.balances, sku.id, from ?? 'READY')}</b></p>}
    </div>
  );
}
