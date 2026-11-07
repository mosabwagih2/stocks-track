import { useQuery } from '@tanstack/react-query';
import { repo } from '@/femini/data';
import { cn } from '@/femini/cn';
import { Button, Sheet } from './ui';
import { useAct } from '@/femini/hooks/data';
import { useRef } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import type { Model } from '@/femini/domain/types';

const direct = (v: string) => /^(data:|blob:|https?:)/.test(v);
/** data URLs show as they are; storage paths are turned into signed URLs once and cached. */
export function useImageUrl(value?: string | null): string | null {
  const { data } = useQuery({ queryKey: ['img', value], enabled: !!value && !direct(value), staleTime: 50 * 60_000, queryFn: () => repo.photoUrl(value!) });
  if (!value) return null;
  return direct(value) ? value : data ?? null;
}

/** Square product photo, or a tile with the model code while there is none. */
export function Thumb({ model, size = 32, className }: { model?: Pick<Model, 'code' | 'image'>; size?: number; className?: string }) {
  const url = useImageUrl(model?.image);
  const st = { width: size, height: size, fontSize: Math.max(9, Math.round(size / 4)) };
  return url
    ? <img src={url} alt={model?.code ?? ''} style={st} className={cn('inline-block shrink-0 rounded-lg border border-line bg-surface object-contain align-middle', className)} />
    : <span style={st} className={cn('inline-grid shrink-0 place-items-center rounded-lg border border-line bg-lav align-middle font-mono font-semibold text-accent', className)}>{model?.code ?? '—'}</span>;
}

export function ModelImageSheet({ model, onClose }: { model: Model; onClose: () => void }) {
  const act = useAct(); const ref = useRef<HTMLInputElement>(null); const url = useImageUrl(model.image);
  return (
    <Sheet title={`صورة ${model.code} · ${model.name}`} onClose={onClose}>
      {url ? <img src={url} alt={model.code} className="mx-auto block aspect-square w-full max-w-[520px] rounded-xl border border-line bg-surface object-contain" />
        : <button type="button" onClick={() => ref.current?.click()} className="grid gap-1 rounded-xl border-2 border-dashed border-line2 bg-surface p-8 text-center hover:border-accent"><b>لا توجد صورة لهذا الموديل</b><span className="text-muted">اضغط لاختيار صورة (يُفضَّل أن يظهر المنتج كاملًا على خلفية فاتحة)</span></button>}
      <input ref={ref} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { await act(() => repo.setModelImage(model.code, f), 'تم حفظ الصورة'); onClose(); } }} />
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => ref.current?.click()}><Camera className="size-4" /> {url ? 'تغيير الصورة' : 'رفع صورة'}</Button>
        {url && <Button variant="danger" onClick={async () => { await act(() => repo.setModelImage(model.code, null), 'تمت إزالة الصورة'); onClose(); }}><Trash2 className="size-4" /> إزالة</Button>}
      </div>
      <p className="text-xs text-muted">تتحوّل أي صورة تلقائيًا إلى مربع 1:1 (600×600) دون قص، ويأخذ الهامش لون ركن الصورة. الأفضل رفعها مربعة من البداية (مثل 1000×1000).</p>
    </Sheet>
  );
}
