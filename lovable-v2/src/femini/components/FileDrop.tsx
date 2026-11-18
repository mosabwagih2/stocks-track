import { useRef, useState, type ReactNode } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/femini/cn';
import { acceptsFile } from '@/femini/domain/fileAccept';

/**
 * Every place the app takes a file looks and works like this: drag the file onto the box or click it to choose one.
 * `accept` is the same list the file input takes (".xlsx,.xls", "image/*", ".json"); a file of another kind that is dropped
 * is refused with a line saying what is wanted, never silently. `fileName` shows what was chosen.
 */
export function FileDrop({ accept, onFile, title, hint, fileName, disabled, capture, compact, className }: {
  accept: string; onFile: (f: File) => void; title?: ReactNode; hint?: ReactNode; fileName?: string; disabled?: boolean;
  capture?: 'environment' | 'user'; compact?: boolean; className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null); const [over, setOver] = useState(false); const [bad, setBad] = useState('');
  const take = (f: File | undefined | null) => {
    if (!f || disabled) return;
    if (!acceptsFile(f, accept)) { setBad(`الملف ده مش من النوع المطلوب (${accept.split(',').map((x) => x.trim()).join(' ')}).`); return; }
    setBad(''); onFile(f);
  };
  return (
    <div className={cn('grid gap-1', className)}>
      <button type="button" disabled={disabled} onClick={() => ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }} onDragEnter={(e) => { e.preventDefault(); if (!disabled) setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}
        className={cn('grid place-items-center gap-1 rounded-2xl border-2 border-dashed bg-surface text-center transition hover:border-accent hover:bg-lav disabled:cursor-not-allowed disabled:opacity-60',
          compact ? 'p-3' : 'p-6', over ? 'border-accent bg-lav' : 'border-line2')}>
        <b className="inline-flex items-center gap-2">{compact && <Upload className="size-4 shrink-0" />}{fileName || title || 'اسحب الملف هنا أو اضغط للاختيار'}</b>
        {hint && <span className="text-sm text-muted">{hint}</span>}
      </button>
      <input ref={ref} type="file" hidden accept={accept} capture={capture} disabled={disabled} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; take(f); }} />
      {bad && <p role="alert" className="text-xs text-crit">{bad}</p>}
    </div>
  );
}
