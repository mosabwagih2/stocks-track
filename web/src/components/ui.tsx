import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'crit' | 'warn' | 'good' | 'info' | 'lost';
const toneCls: Record<Tone, string> = {
  neutral: 'bg-lav text-ink border-line2', crit: 'bg-crit-bg text-crit border-crit-line', warn: 'bg-warn-bg text-warn border-warn-line',
  good: 'bg-good-bg text-good border-good-line', info: 'bg-info-bg text-info border-info-line', lost: 'bg-lost-bg text-lost border-lost-bg',
};

export function Pill({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return <span title={title} className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', toneCls[tone])}>{children}</span>;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'ghost' | 'danger'; size?: 'md' | 'sm' };
export function Button({ variant = 'default', size = 'md', className, ...p }: BtnProps) {
  return (
    <button
      type="button"
      {...p}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border font-medium whitespace-nowrap transition active:scale-[.98] disabled:opacity-45 disabled:pointer-events-none',
        size === 'md' ? 'px-3.5 py-2' : 'px-2.5 py-1 text-[13px]',
        variant === 'primary' && 'bg-accent border-accent text-on-accent hover:brightness-110',
        variant === 'default' && 'bg-surface border-line2 hover:border-accent',
        variant === 'ghost' && 'border-transparent bg-transparent text-accent hover:bg-lav',
        variant === 'danger' && 'bg-surface border-crit-line text-crit hover:bg-crit-bg',
        className,
      )}
    />
  );
}

export function Card({ title, hint, children, className, action }: { title?: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn('rounded-xl border border-line bg-surface p-4 min-w-0', className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          {hint && <span className="ms-auto text-xs text-muted">{hint}</span>}
          {action && <span className={hint ? '' : 'ms-auto'}>{action}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, sub, tone, onClick }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'crit' | 'warn' | 'good'; onClick?: () => void }) {
  const body = (
    <>
      <small className="text-muted font-medium">{label}{onClick ? ' ‹' : ''}</small>
      <b className={cn('font-mono text-[28px] leading-tight font-semibold tracking-tight', tone === 'crit' && 'text-crit', tone === 'warn' && 'text-warn', tone === 'good' && 'text-good')}>{value}</b>
      {sub && <em className="not-italic text-xs text-muted">{sub}</em>}
    </>
  );
  const cls = 'grid gap-0.5 rounded-xl border border-line bg-surface px-4 py-3 text-start';
  return onClick ? <button type="button" onClick={onClick} className={cn(cls, 'hover:border-accent cursor-pointer w-full')}>{body}</button> : <div className={cls}>{body}</div>;
}

export function Alert({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl border px-3.5 py-2.5 text-sm', toneCls[tone], className)}>{children}</div>;
}

export function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label?: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-xl border border-line2 bg-surface">
      {options.map(([v, l], i) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
          className={cn('px-3.5 py-1.5 text-[13px] font-medium', i > 0 && 'border-s border-line2', value === v ? 'bg-accent text-on-accent' : 'hover:bg-lav')}>{l}</button>
      ))}
    </div>
  );
}

export function Chip({ pressed, onClick, children }: { pressed?: boolean; onClick?: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={pressed} onClick={onClick}
    className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium', pressed ? 'bg-ink text-page border-ink dark:bg-accent dark:text-on-accent dark:border-accent' : 'bg-surface border-line2 hover:border-accent')}>{children}</button>;
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: [T, string][] }) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map(([v, l]) => (
        <button key={v} role="tab" aria-selected={value === v} type="button" onClick={() => onChange(v)}
          className={cn('whitespace-nowrap border-b-2 px-3.5 py-2 font-medium', value === v ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink')}>{l}</button>
      ))}
    </div>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <label className={cn('grid gap-1 text-xs font-medium text-muted', className)}>{label}<span className="text-sm text-ink [&>*]:w-full">{children}</span></label>;
}

export function Empty({ children }: { children: ReactNode }) { return <div className="px-3 py-8 text-center text-muted">{children}</div>; }

export function Dot({ className }: { className?: string }) { return <i className={cn('inline-block size-2.5 rounded-full', className)} />; }

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('overflow-x-auto rounded-xl border border-line bg-surface', className)}>{children}</div>;
}
export const th = 'bg-lav px-3 py-2 text-start text-xs font-semibold text-muted whitespace-nowrap sticky top-0';
export const td = 'border-b border-grid px-3 py-2 align-middle';

export function Bar({ label, value, max, right, tone = 'accent' }: { label: ReactNode; value: number; max: number; right: ReactNode; tone?: 'accent' | 'warn' | 'crit' | 'good' }) {
  const bg = { accent: 'bg-accent', warn: 'bg-dirty', crit: 'bg-scrap', good: 'bg-ready' }[tone];
  return (
    <div className="grid grid-cols-[minmax(80px,150px)_1fr_auto] items-center gap-3 py-0.5">
      <span className="truncate">{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-grid"><i className={cn('block h-full rounded-full', bg)} style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} /></div>
      <span className="min-w-10 text-end font-mono text-[13px]">{right}</span>
    </div>
  );
}

/** Right-hand popup. Mounted once per open, so typing, scrolling and focus are never reset by state changes. */
export function Sheet({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button[data-autofocus]')?.focus({ preventScroll: true });
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.({ preventScroll: true }); };
  }, [onClose]);
  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/45" onClick={onClose} />
      <aside ref={ref} role="dialog" aria-modal="true" aria-labelledby={id}
        className={cn('sheet-in fixed inset-y-0 left-0 z-50 flex w-full flex-col border-e border-line2 bg-page shadow-card max-md:top-[8%] max-md:rounded-t-2xl', wide ? 'md:w-[680px]' : 'md:w-[560px]')}>
        <header className="flex items-center gap-2 border-b border-line px-4 py-3.5">
          <h2 id={id} className="font-display text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="sm" className="ms-auto" onClick={onClose} aria-label="إغلاق"><X className="size-4" /> إغلاق</Button>
        </header>
        <div className="grid flex-1 content-start gap-4 overflow-y-auto p-4 pb-safe">{children}</div>
      </aside>
    </>,
    document.body,
  );
}
