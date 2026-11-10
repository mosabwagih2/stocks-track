import { StateDonut } from './charts';
import type { Derived } from '@/femini/hooks/data';
import type { Order } from '@/femini/domain/types';
import { Pill, Alert, Button, Field } from './ui';
import { skuLabel } from '@/femini/domain/orders';
import { cairoDay, timeCairo } from '@/femini/domain/dates';
import { useEffect, useState } from 'react';
import { repo } from '@/femini/data';

export function OrderPill({ o, d }: { o: Order; d: Derived }) {
  if (o.status === 'cancelled') return <Pill tone="neutral" title={o.cancel ? `أُلغي ${cairoDay(o.cancel.at)} بواسطة ${o.cancel.by}` : ''}>ملغي</Pill>;
  // shipped = left with the scan; collected = the money came (the channel's settlement sheet)
  const paid = o.status === 'shipped' ? d.collected.get(o.ref) : undefined;
  if (paid) return <Pill tone="good" title={`${paid.stl} · ${paid.date}`}>تم التحصيل ✓</Pill>;
  if (o.status === 'shipped') return <Pill tone="info" title={o.shippedAt ? `${o.shippedBy} · ${timeCairo(o.shippedAt)}` : ''}>مشحون · {o.shippedBy}</Pill>;
  if (o.unmapped.length) return <Pill tone="crit">كود غير مربوط</Pill>;
  const b = d.blocked.get(o.ref);
  if (b) return <Pill tone="crit" title={b.map((x) => `${skuLabel(d.skuMap, x.sku)} ناقص ${x.short}`).join('\n')}>متوقف · ناقص {skuLabel(d.skuMap, b[0].sku, false)}{b.length > 1 ? ` +${b.length - 1}` : ''}</Pill>;
  return <Pill tone="warn">بانتظار الشحن</Pill>;
}

export function StockByState({ d }: { d: Derived }) { return <StateDonut d={d} />; }

/** Stored photo (signed URL on Supabase, object URL in the demo). */
export function Photo({ path, className, zoom }: { path?: string | null; className?: string; zoom?: boolean }) {
  const [url, setUrl] = useState<string | null>(null); const [open, setOpen] = useState(false);
  useEffect(() => { let alive = true; if (path) repo.photoUrl(path).then((u) => alive && setUrl(u)); return () => { alive = false; }; }, [path]);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [open]);
  if (!path) return null;
  if (!url) return <div className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-line2 text-xs text-muted">الصورة غير متاحة</div>;
  if (!zoom) return <img src={url} alt="" className={className} />;
  return <>
    <button type="button" className="block w-full cursor-zoom-in" onClick={(e) => { e.stopPropagation(); setOpen(true); }} aria-label="افتح الصورة"><img src={url} alt="" className={className} /></button>
    {open && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
      <img src={url.replace(/[?&]thumb=1$/, '')} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
      <button type="button" className="absolute end-4 top-4 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-ink" onClick={() => setOpen(false)}>إغلاق</button>
    </div>}
  </>;
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
