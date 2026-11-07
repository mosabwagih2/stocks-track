import { serverEdition } from '@/femini/data';
import { useEffect, type ReactNode } from 'react';
import { Link, useRouter, useRouterState } from '@tanstack/react-router';
import { whenIdle } from '@/femini/components/Deferred';
import { BarChart3, Boxes, ClipboardList, FileText, Package, ReceiptText, Settings as Cog, LayoutGrid } from 'lucide-react';
import { useDerived } from '@/femini/hooks/data';
import { qty } from '@/femini/domain/ledger';
import { dayLabel } from '@/femini/domain/dates';
import { startAccount } from '@/femini/data/account';

const NAV = [
  { to: '/', label: 'اليوم', icon: LayoutGrid },
  { to: '/stock', label: 'المخزون', icon: Boxes },
  { to: '/orders', label: 'الأوردرات', icon: Package },
  { to: '/operations', label: 'العمليات', icon: ClipboardList },
  { to: '/insights', label: 'التحليلات', icon: BarChart3 },
  { to: '/ledger', label: 'السجل', icon: ReceiptText },
  { to: '/files', label: 'الملفات', icon: FileText },
  { to: '/settings', label: 'الإعدادات', icon: Cog },
] as const;

export default function Shell({ children }: { children: ReactNode }) {
  useEffect(() => startAccount(), []);   // the signed-in account's name is who did each operation
  const { d } = useDerived();
  const isToday = useRouterState({ select: (state) => state.location.pathname === '/' });
  const router = useRouter();
  // Like the original app (all views ready in one page): preload every section's code once the app is idle,
  // so the first click on a section never waits for its files to download.
  useEffect(() => {
    let i = 0;
    let stop = false;
    const next = () => {
      const item = NAV[i++];
      if (!item || stop) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.preloadRoute({ to: item.to as any }).catch(() => {}).finally(() => whenIdle(next));
    };
    const cancel = whenIdle(next, 1500);
    return () => { stop = true; cancel(); };
  }, [router]);
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    try { localStorage.removeItem('femini-theme'); } catch { /* private mode */ }
  }, []);
  const badge: Record<string, number> = {};
  if (d) {
    badge['/orders'] = d.blocked.size;
    badge['/stock'] = d.snap.skus.filter((s) => qty(d.snap.balances, s.id, 'READY') < 0).length;
  }
  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_minmax(0,1fr)] print:block">
      <nav aria-label="التنقل" className="print:hidden fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-line bg-rail/95 px-1.5 pt-1.5 pb-safe backdrop-blur md:sticky md:inset-auto md:top-0 md:h-screen md:flex-col md:gap-0.5 md:overflow-y-auto md:border-t-0 md:border-e md:p-4">
        <div className="mb-6 hidden items-center gap-3 px-2 pt-1 md:flex">
          <span className="grid size-10 place-items-center rounded-xl bg-accent font-display text-lg font-bold text-on-accent shadow-card">F</span>
          <div className="leading-tight">
            <b className="font-display text-lg font-semibold tracking-tight">Fémini</b>
            <small className="block text-[11px] text-rail-mute">Stock · نظام المخزن</small>
          </div>
        </div>
        <span className="mb-1 hidden px-3 text-[11px] font-semibold tracking-wide text-rail-mute md:block">القائمة</span>
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} preload="intent" activeOptions={{ exact: to === '/' }}
            className="group relative flex min-w-[64px] flex-1 flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-rail-mute transition hover:bg-lav hover:text-on-rail md:flex-none md:flex-row md:gap-3 md:px-3 md:py-2.5 md:text-sm data-[status=active]:bg-accent-soft data-[status=active]:text-accent">
            <Icon className="size-5 shrink-0 md:size-[18px]" strokeWidth={1.8} />
            <span>{label}</span>
            {badge[to] ? <span className="absolute end-2 top-0.5 rounded-full bg-scrap px-1.5 py-0.5 font-mono text-[10px] leading-none font-semibold text-on-accent md:static md:ms-auto">{badge[to]}</span> : null}
          </Link>
        ))}
        <div className="hidden flex-1 md:block" />
        <div className="hidden gap-2 rounded-2xl border border-line bg-lav p-3 text-xs text-rail-mute md:grid">
          <span className="flex items-center gap-2 px-2"><i className="size-2 rounded-full bg-good" />{serverEdition ? 'متصل بالسيرفر' : 'البيانات محفوظة في هذا المتصفح'}</span>
        </div>
      </nav>
      <div className="min-w-0">
        <header className="print:hidden sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-page/80 px-4 py-3 backdrop-blur md:px-8">
          <span className="grid size-8 place-items-center rounded-lg bg-accent font-display font-bold text-on-accent md:hidden">F</span>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {isToday && <h1 className="font-display text-lg font-semibold">اليوم</h1>}
            <span className="text-sm text-muted">{d ? dayLabel(d.today) : ' '}</span>
          </div>
        </header>
        <main className="mx-auto max-w-[1320px] px-4 pt-6 pb-28 md:px-8 md:pb-14 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}
