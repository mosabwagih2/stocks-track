import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft } from 'lucide-react';
import { cn } from '@/femini/cn';

type Tone = 'neutral' | 'crit' | 'warn' | 'good' | 'info' | 'lost';
const toneCls: Record<Tone, string> = {
  neutral: 'bg-lav text-ink border-line', crit: 'bg-crit-bg text-crit border-crit-line', warn: 'bg-warn-bg text-warn border-warn-line',
  good: 'bg-good-bg text-good border-good-line', info: 'bg-info-bg text-info border-info-line', lost: 'bg-lost-bg text-lost border-lost-bg',
};
const dotCls: Record<Tone, string> = { neutral: 'bg-muted', crit: 'bg-crit', warn: 'bg-warn', good: 'bg-good', info: 'bg-info', lost: 'bg-lost' };

export function Pill({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', toneCls[tone])}>
      <i className={cn('size-1.5 rounded-full', dotCls[tone])} />{children}
    </span>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'ghost' | 'danger'; size?: 'md' | 'sm' };
export function Button({ variant = 'default', size = 'md', className, ...p }: BtnProps) {
  return (
    <button
      type="button"
      {...p}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[10px] border font-medium whitespace-nowrap transition-all duration-150 active:scale-[.97] disabled:opacity-45 disabled:pointer-events-none',
        size === 'md' ? 'h-9 px-3.5 text-sm' : 'h-7 px-2.5 text-[13px]',
        variant === 'primary' && 'border-accent bg-accent text-on-accent shadow-card hover:brightness-110',
        variant === 'default' && 'border-line2 bg-surface text-ink hover:border-accent/60 hover:bg-lav',
        variant === 'ghost' && 'border-transparent bg-transparent text-accent hover:bg-accent-soft',
        variant === 'danger' && 'border-crit-line bg-surface text-crit hover:bg-crit-bg',
        className,
      )}
    />
  );
}

export function Card({ title, hint, children, className, action }: { title?: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn('fade-up min-w-0 rounded-2xl border border-line bg-surface p-5 shadow-card', className)}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">{title}</h2>
          {hint && <span className="ms-auto text-xs text-muted">{hint}</span>}
          {action && <span className={hint ? '' : 'ms-auto'}>{action}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, sub, tone, onClick, children }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'crit' | 'warn' | 'good'; onClick?: () => void; children?: ReactNode }) {
  const accent = tone === 'crit' ? 'bg-crit' : tone === 'warn' ? 'bg-warn' : tone === 'good' ? 'bg-good' : 'bg-accent';
  const body = (
    <>
      <span className="flex items-center gap-2 text-[13px] font-medium text-muted">
        <i className={cn('h-3.5 w-1 rounded-full', accent)} />{label}
        {onClick && <ChevronLeft className="ms-auto size-4 opacity-0 transition group-hover:opacity-100" />}
      </span>
      <b className={cn('num mt-1 text-[28px] leading-none font-semibold tracking-tight', tone === 'crit' && 'text-crit', tone === 'warn' && 'text-warn', tone === 'good' && 'text-good')}>{value}</b>
      {sub && <em className="mt-1 text-xs text-muted not-italic">{sub}</em>}
      {children}
    </>
  );
  const cls = 'group relative grid content-start overflow-hidden rounded-2xl border border-line bg-surface px-4 py-3.5 text-start shadow-card transition';
  return onClick
    ? <button type="button" onClick={onClick} className={cn(cls, 'w-full cursor-pointer hover:-translate-y-0.5 hover:border-accent/50')}>{body}</button>
    : <div className={cls}>{body}</div>;
}

export function Alert({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl border px-4 py-3 text-sm', toneCls[tone], className)}>{children}</div>;
}

export function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label?: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex gap-0.5 rounded-xl border border-line bg-lav p-0.5">
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
          className={cn('rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition', value === v ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink')}>{l}</button>
      ))}
    </div>
  );
}

export function Chip({ pressed, onClick, children }: { pressed?: boolean; onClick?: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={pressed} onClick={onClick}
    className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium transition', pressed ? 'border-accent bg-accent text-on-accent' : 'border-line2 bg-surface text-ink hover:border-accent/60')}>{children}</button>;
}

export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: [T, string][]; className?: string }) {
  return (
    <div role="tablist" className={cn('flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-line bg-lav p-1', className ?? 'mb-5')}>
      {tabs.map(([v, l]) => (
        <button key={v} role="tab" aria-selected={value === v} type="button" onClick={() => onChange(v)}
          className={cn('rounded-lg px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition', value === v ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink')}>{l}</button>
      ))}
    </div>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <label className={cn('grid gap-1.5 text-xs font-medium text-muted', className)}>{label}<span className="text-sm text-ink [&>*]:w-full">{children}</span></label>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="grid place-items-center gap-2 px-3 py-10 text-center text-sm text-muted"><span className="grid size-10 place-items-center rounded-full bg-lav text-lg">∅</span>{children}</div>;
}

export function Dot({ className }: { className?: string }) { return <i className={cn('inline-block size-2.5 rounded-full', className)} />; }

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('max-h-[640px] overflow-auto rounded-xl border border-line bg-surface', className)}>{children}</div>;
}
export const th = 'sticky top-0 z-[1] border-b border-line bg-lav/95 px-3 py-2.5 text-start text-xs font-semibold text-muted whitespace-nowrap backdrop-blur';
export const td = 'border-b border-grid px-3 py-2.5 align-middle';

export function Bar({ label, value, max, right, tone = 'accent' }: { label: ReactNode; value: number; max: number; right: ReactNode; tone?: 'accent' | 'warn' | 'crit' | 'good' | 'info' | 'muted' }) {
  const bg = { accent: 'bg-accent', warn: 'bg-dirty', crit: 'bg-scrap', good: 'bg-ready', info: 'bg-factory', muted: 'bg-line2' }[tone];
  return (
    <div className="grid grid-cols-[minmax(80px,160px)_1fr_auto] items-center gap-3 py-1">
      <span className="truncate text-sm">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-grid"><i className={cn('block h-full rounded-full transition-all duration-500', bg)} style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} /></div>
      <span className="num min-w-10 text-end text-[13px]">{right}</span>
    </div>
  );
}

/** Side panel. Mounted once per open, so typing, scrolling and focus are never reset by state changes. */
export function Sheet({ title, onClose, children, wide, footer }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
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
      <div className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} dir="rtl"
        className={cn('sheet-in fixed inset-y-0 left-0 z-50 flex w-full flex-col border-e border-line bg-page shadow-pop max-md:top-[6%] max-md:rounded-t-3xl', wide ? 'md:w-[720px]' : 'md:w-[580px]')}>
        <header className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-5 py-4 max-md:rounded-t-3xl">
          <h2 id={id} className="font-display text-lg font-semibold">{title}</h2>
          <button type="button" className="ms-auto grid size-8 place-items-center rounded-lg text-muted hover:bg-lav hover:text-ink" onClick={onClose} aria-label="إغلاق"><X className="size-4" /></button>
        </header>
        <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto p-5 pb-safe">{children}</div>
        {footer && <footer className="shrink-0 border-t border-line bg-surface px-5 py-4 pb-safe">{footer}</footer>}
      </aside>
    </>,
    document.body,
  );
}
