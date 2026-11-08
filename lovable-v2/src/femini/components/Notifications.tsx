import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Bell } from 'lucide-react';
import { useDerived } from '@/femini/hooks/data';
import { useNavigate } from '@/femini/router';
import { comparePeriods, riskAlerts } from '@/femini/insights-tools';
import { cn } from '@/femini/cn';
import { Pill } from './ui';

/** The important alerts (same as Insights › risks, last 14 days), one click away on every page. */
export function Notifications() {
  const { d } = useDerived(); const nav = useNavigate();
  const [open, setOpen] = useState(false); const box = useRef<HTMLDivElement>(null);
  const alerts = useMemo(() => (d ? riskAlerts(d, comparePeriods(d, 14)) : []), [d]);
  const urgent = alerts.filter((a) => a.level === 'crit').length;
  const important = alerts.filter((a) => a.level !== 'info').length;
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('mousedown', out); addEventListener('keydown', esc);
    return () => { removeEventListener('mousedown', out); removeEventListener('keydown', esc); };
  }, [open]);
  const tone = { crit: 'border-crit-line bg-crit-bg', warn: 'border-warn-line bg-warn-bg', info: 'border-line bg-surface' };
  const lbl = { crit: 'عاجل', warn: 'انتبه', info: 'للعلم' };
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} aria-label={important ? `التنبيهات: ${important}` : 'التنبيهات'}
        className="relative grid size-10 place-items-center rounded-xl border border-line bg-surface text-ink transition hover:bg-lav">
        <Bell className="size-5" strokeWidth={1.8} />
        {important > 0 && <span className={cn('absolute -end-1 -top-1 min-w-5 rounded-full px-1 py-0.5 text-center font-mono text-[10px] leading-none font-semibold text-on-accent', urgent ? 'bg-crit' : 'bg-warn')}>{important}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="التنبيهات" className="absolute end-0 top-full z-40 mt-2 w-[min(92vw,380px)] rounded-2xl border border-line bg-surface p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between px-1"><b className="font-display">التنبيهات المهمة</b><span className="text-xs text-muted">{alerts.length ? `${urgent} عاجل · ${alerts.length} إجمالي` : ''}</span></div>
          {!alerts.length ? <p className="px-1 py-3 text-sm text-muted">مفيش تنبيهات دلوقتي. المخزون والأوردرات تمام.</p> : (
            <div className="grid max-h-[60vh] gap-2 overflow-y-auto">{alerts.map((a, i) => (
              <button key={i} type="button" onClick={() => { setOpen(false); nav(a.to); }} className={cn('grid grid-cols-[auto_1fr] items-start gap-2.5 rounded-xl border p-2.5 text-start transition hover:brightness-[0.98]', tone[a.level])}>
                <AlertTriangle className={cn('mt-0.5 size-4', a.level === 'crit' ? 'text-crit' : a.level === 'warn' ? 'text-warn' : 'text-muted')} />
                <span className="min-w-0"><span className="flex flex-wrap items-center gap-1.5"><b className="text-sm text-ink">{a.title}</b><Pill tone={a.level === 'info' ? 'info' : a.level}>{lbl[a.level]}</Pill></span>
                  <span className="mt-0.5 block text-xs text-muted">{a.body}</span>
                  <span className="mt-1 block text-xs font-semibold text-accent">{a.cta} ←</span></span>
              </button>))}</div>
          )}
        </div>
      )}
    </div>
  );
}
