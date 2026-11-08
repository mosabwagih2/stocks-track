import logo from '@/femini/assets/femini-logo.png';
import { serverEdition } from '@/femini/data';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useRouter, useRouterState } from '@tanstack/react-router';
import { whenIdle } from '@/femini/components/Deferred';
import { BarChart3, Boxes, ClipboardList, FileText, Package, ReceiptText, Settings as Cog, LayoutGrid, Menu, X } from 'lucide-react';
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
  const path = useRouterState({ select: (state) => state.location.pathname });
  const isToday = path === '/';
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [path]);   // a choice in the phone menu closes it
  const current = NAV.find((n) => (n.to === '/' ? path === '/' : path.startsWith(n.to)));
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
      {menu && <div className="fixed inset-0 z-40 bg-black/40 md:hidden print:hidden" onClick={() => setMenu(false)} aria-hidden="true" />}
      <nav aria-label="التنقل" className={`print:hidden fixed inset-y-0 start-0 z-50 w-72 max-w-[85vw] flex-col gap-0.5 overflow-y-auto border-e border-line bg-rail p-4 shadow-xl transition-transform md:sticky md:top-0 md:z-auto md:flex md:h-screen md:w-auto md:max-w-none md:translate-x-0 md:shadow-none ${menu ? 'flex translate-x-0' : 'hidden'}`}>
        <div className="mb-5 flex items-start justify-between gap-2 px-2 pt-1">
          <div className="grid justify-items-center gap-1">
            <img src={logo} alt="Fémini" width={120} height={120} className="h-24 w-auto object-contain md:h-28" />
            <small className="text-[11px] text-rail-mute">Stock · نظام المخزن</small>
          </div>
          <button type="button" className="rounded-lg p-1.5 text-rail-mute hover:bg-lav md:hidden" onClick={() => setMenu(false)} aria-label="اقفل القائمة"><X className="size-5" /></button>
        </div>
        <span className="mb-1 px-3 text-[11px] font-semibold tracking-wide text-rail-mute">القائمة</span>
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} preload="intent" activeOptions={{ exact: to === '/' }}
            className="group relative flex flex-row items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rail-mute transition hover:bg-lav hover:text-on-rail data-[status=active]:bg-accent-soft data-[status=active]:text-accent">
            <Icon className="size-[18px] shrink-0" strokeWidth={1.8} />
            <span>{label}</span>
            {badge[to] ? <span className="ms-auto rounded-full bg-scrap px-1.5 py-0.5 font-mono text-[10px] leading-none font-semibold text-on-accent">{badge[to]}</span> : null}
          </Link>
        ))}
        <div className="flex-1" />
        <div className="mt-4 grid gap-2 rounded-2xl border border-line bg-lav p-3 text-xs text-rail-mute">
          <span className="flex items-center gap-2 px-2"><i className="size-2 rounded-full bg-good" />{serverEdition ? 'متصل بالسيرفر' : 'البيانات محفوظة في هذا المتصفح'}</span>
        </div>
      </nav>
      <div className="min-w-0">
        <header className="print:hidden sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-page/80 px-4 py-3 backdrop-blur md:px-8">
          <button type="button" className="relative -ms-1 rounded-lg p-1.5 hover:bg-lav md:hidden" onClick={() => setMenu(true)} aria-label="افتح القائمة" aria-expanded={menu}>
            <Menu className="size-6" />
            {Object.values(badge).some(Boolean) && <i className="absolute end-1 top-1 size-2 rounded-full bg-scrap" />}
          </button>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            {isToday ? <h1 className="font-display text-lg font-semibold">اليوم</h1> : current && <b className="font-display text-base font-semibold md:hidden">{current.label}</b>}
            <span className="text-sm text-muted">{d ? dayLabel(d.today) : ' '}</span>
          </div>
          <img src={logo} alt="Fémini" width={40} height={40} className="ms-auto h-10 w-auto object-contain md:hidden" />
        </header>
        <main className="mx-auto max-w-[1320px] px-4 pt-6 pb-12 md:px-8 md:pb-14 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}
