import { useEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/femini/cn';
import { parseDmy, toDmyText } from '@/femini/domain/dateInput';

/**
 * The date box of the whole app: the day is written dd-mm-yyyy with Latin digits in the app's own font. The browser's own date
 * field cannot do that (it draws the day in the browser's language and digits), so it only lends its calendar: the button opens it.
 * Typing a day that exists (and is not after `max` / before `min`) sets it; anything else goes back to the day that was set.
 */
export function DateField({ value, onChange, max, min, className, disabled, ariaLabel }: {
  value: string; onChange: (iso: string) => void; max?: string; min?: string; className?: string; disabled?: boolean; ariaLabel?: string;
}) {
  const [text, setText] = useState(toDmyText(value)); const [bad, setBad] = useState(false); const picker = useRef<HTMLInputElement>(null);
  useEffect(() => { setText(toDmyText(value)); setBad(false); }, [value]);
  const ok = (iso: string) => (!max || iso <= max) && (!min || iso >= min);
  const take = (raw: string, final: boolean) => {
    const iso = parseDmy(raw);
    if (iso && ok(iso)) { setBad(false); if (iso !== value) onChange(iso); return; }
    if (final) { setText(toDmyText(value)); setBad(false); } else setBad(raw.trim().length >= 10);
  };
  return (
    <span className={cn('relative inline-flex items-center', className)}>
      <input type="text" inputMode="numeric" dir="ltr" lang="en" autoComplete="off" disabled={disabled} aria-label={ariaLabel ?? 'التاريخ'} aria-invalid={bad || undefined} placeholder="dd-mm-yyyy" maxLength={10}
        value={text} onChange={(e) => { setText(e.target.value); take(e.target.value, false); }} onBlur={(e) => take(e.target.value, true)} onKeyDown={(e) => { if (e.key === 'Enter') take((e.target as HTMLInputElement).value, true); }}
        className={cn('w-full pe-10 text-center tabular-nums', bad && 'border-crit')} />
      <button type="button" disabled={disabled} aria-label="افتح التقويم" title="افتح التقويم" onClick={() => { const p = picker.current; if (!p) return; try { p.showPicker(); } catch { p.click(); } }}
        className="absolute end-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-lav hover:text-ink disabled:opacity-50"><CalendarDays className="size-4" /></button>
      {/* only the browser's calendar: invisible, on top of the box so the calendar opens right there */}
      <input ref={picker} type="date" lang="en-GB" tabIndex={-1} aria-hidden="true" disabled={disabled} value={value} max={max} min={min}
        onChange={(e) => { if (e.target.value && ok(e.target.value)) onChange(e.target.value); }} className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-0" />
    </span>
  );
}
