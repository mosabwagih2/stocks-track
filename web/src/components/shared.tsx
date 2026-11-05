import type { Derived } from '@/hooks/data';
import type { Order } from '@/domain/types';
import { Pill, Dot, Alert, Button, Field } from './ui';
import { skuLabel } from '@/domain/orders';
import { LOC_COLOR, LOCS, LOC_AR } from '@/domain/constants';
import { fmt } from '@/lib/cn';
import { locTotal } from '@/domain/ledger';
import { timeCairo } from '@/domain/dates';
import { useEffect, useState } from 'react';
import { repo } from '@/data';

export function OrderPill({ o, d }: { o: Order; d: Derived }) {
  if (o.status === 'cancelled') return <Pill tone="lost" title={o.cancel ? `أُلغي ${o.cancel.at.slice(0, 10)} بواسطة ${o.cancel.by}` : ''}>ملغي</Pill>;
  if (o.status === 'shipped') return <Pill tone="good" title={o.shippedAt ? `${o.shippedBy} · ${timeCairo(o.shippedAt)}` : ''}>تم شحن · {o.shippedBy}</Pill>;
  if (o.unmapped.length) return <Pill tone="warn">كود غير مربوط</Pill>;
  const b = d.blocked.get(o.ref);
  if (b) return <Pill tone="crit" title={b.map((x) => `${skuLabel(d.skuMap, x.sku)} ناقص ${x.short}`).join('\n')}>متوقف · ناقص {skuLabel(d.skuMap, b[0].sku, false)}{b.length > 1 ? ` +${b.length - 1}` : ''}</Pill>;
  return <Pill tone="info">بانتظار الشحن</Pill>;
}

export function StockByState({ d }: { d: Derived }) {
  const t = Object.fromEntries(LOCS.map((l) => [l, locTotal(d.snap.balances, l)])) as Record<(typeof LOCS)[number], number>;
  const sum = LOCS.reduce((a, l) => a + Math.max(0, t[l]), 0) || 1;
  return (
    <div>
      <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-grid">
        {LOCS.filter((l) => t[l] > 0).map((l) => <i key={l} className={LOC_COLOR[l]} style={{ width: `${(t[l] / sum) * 100}%`, minWidth: 2 }} title={`${LOC_AR[l]}: ${fmt(t[l])}`} />)}
      </div>
      <div className="mt-3 grid gap-1.5">
        {LOCS.map((l) => <div key={l} className="flex items-center justify-between"><span><Dot className={LOC_COLOR[l]} /> {LOC_AR[l]}</span><b className="font-mono">{fmt(t[l])}</b></div>)}
      </div>
    </div>
  );
}

/** Stored photo (signed URL on Supabase, object URL in the demo). */
export function Photo({ path, className }: { path?: string | null; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let alive = true; if (path) repo.photoUrl(path).then((u) => alive && setUrl(u)); return () => { alive = false; }; }, [path]);
  if (!path) return null;
  return url ? <img src={url} alt="" className={className} /> : <div className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-line2 text-xs text-muted">الصورة غير متاحة</div>;
}

export function PhotoInput({ file, onChange, label }: { file: File | null; onChange: (f: File | null) => void; label: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => { if (!file) { setPreview(null); return; } const u = URL.createObjectURL(file); setPreview(u); return () => URL.revokeObjectURL(u); }, [file]);
  return (
    <div className="grid gap-2">
      <Field label={label}><input type="file" accept="image/*" capture="environment" onChange={(e) => onChange(e.target.files?.[0] ?? null)} /></Field>
      {preview && <img src={preview} alt="معاينة" className="max-h-60 w-full rounded-xl border border-line object-contain" />}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return <Alert tone="crit">تعذّر تحميل البيانات: {String((error as Error)?.message ?? error)}</Alert>;
}
export { Button };
