import { StateDonut } from './charts';
import type { Derived } from '@/femini/hooks/data';
import type { Order } from '@/femini/domain/types';
import { Pill, Alert, Button, Field } from './ui';
import { skuLabel } from '@/femini/domain/orders';
import { cairoDay, timeCairo } from '@/femini/domain/dates';
import { useEffect, useState } from 'react';
import { repo } from '@/femini/data';

export function OrderPill({ o, d }: { o: Order; d: Derived }) {
  if (o.status === 'cancelled') return <Pill tone="lost" title={o.cancel ? `أُلغي ${cairoDay(o.cancel.at)} بواسطة ${o.cancel.by}` : ''}>ملغي</Pill>;
  if (o.status === 'shipped') return <Pill tone="good" title={o.shippedAt ? `${o.shippedBy} · ${timeCairo(o.shippedAt)}` : ''}>تم شحن · {o.shippedBy}</Pill>;
  if (o.unmapped.length) return <Pill tone="warn">كود غير مربوط</Pill>;
  const b = d.blocked.get(o.ref);
  if (b) return <Pill tone="crit" title={b.map((x) => `${skuLabel(d.skuMap, x.sku)} ناقص ${x.short}`).join('\n')}>متوقف · ناقص {skuLabel(d.skuMap, b[0].sku, false)}{b.length > 1 ? ` +${b.length - 1}` : ''}</Pill>;
  return <Pill tone="info">بانتظار الشحن</Pill>;
}

export function StockByState({ d }: { d: Derived }) { return <StateDonut d={d} />; }

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
