import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart3, Boxes, ClipboardList, FileText, Package, Moon, ReceiptText, Settings as Cog, ShoppingBag, Sun, LayoutGrid } from 'lucide-react';
import { useDerived } from '@/hooks/data';
import { cn } from '@/lib/cn';
import { repo } from '@/data';
import { qty } from '@/domain/ledger';

const NAV = [
  { to: '/', label: 'اليوم', icon: LayoutGrid, end: true },
  { to: '/stock', label: 'المخزون', icon: Boxes },
  { to: '/supplies', label: 'المستلزمات', icon: ShoppingBag },
  { to: '/operations', label: 'العمليات', icon: ClipboardList },
  { to: '/insights', label: 'التحليلات', icon: BarChart3 },
  { to: '/orders', label: 'الأوردرات', icon: Package },
  { to: '/ledger', label: 'السجل', icon: ReceiptText },
  { to: '/files', label: 'الملفات', icon: FileText },
  { to: '/settings', label: 'الإعدادات', icon: Cog },
] as const;

export default function Shell({ children }: { children: ReactNode }) {
  const { d } = useDerived();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('femini-theme', dark ? 'dark' : 'light'); } catch { /* private mode */ }
  }, [dark]);
  const badge: Record<string, number> = {};
  if (d) {
    badge['/orders'] = d.blocked.size;
    badge['/stock'] = d.snap.skus.filter((s) => qty(d.snap.balances, s.id, 'READY') < 0).length;
  }
  return (
    <div className="grid min-h-screen md:grid-cols-[224px_minmax(0,1fr)]">
      <nav aria-label="التنقل" className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-line2 bg-rail px-1.5 pt-1.5 pb-safe md:sticky md:inset-auto md:top-0 md:h-screen md:flex-col md:gap-1 md:overflow-y-auto md:border-0 md:p-3">
        <div className="mb-3 hidden items-center gap-2.5 px-2.5 pt-2 md:flex">
          <i className="grid size-8 place-items-center rounded-[10px] bg-linear-to-br from-[#9a7fe0] to-[#5e4394] font-semibold text-white not-italic">F</i>
          <div className="text-on-rail"><b className="text-xl font-semibold">Fémini</b><small className="block text-[11px] leading-tight text-rail-mute">Stock · مخزن</small></div>
        </div>
        {NAV.map(({ to, label, icon: Icon, ...rest }) => (
          <NavLink key={to} to={to} end={'end' in rest}
            className={({ isActive }) => cn('relative flex min-w-[62px] flex-1 flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[11px] font-medium md:flex-none md:flex-row md:gap-3 md:px-3 md:py-2.5 md:text-sm', isActive ? 'bg-white/12 text-white' : 'text-rail-mute hover:bg-white/7 hover:text-on-rail')}>
            <Icon className="size-5 shrink-0" strokeWidth={1.7} />
            <span>{label}</span>
            {badge[to] ? <span className="absolute top-0.5 end-2 rounded-full bg-scrap px-1.5 py-0.5 font-mono text-[10px] leading-none font-semibold text-white md:static md:ms-auto">{badge[to]}</span> : null}
          </NavLink>
        ))}
        <div className="hidden flex-1 md:block" />
        <div className="hidden gap-2 p-2.5 text-xs text-rail-mute md:grid">
          <button type="button" onClick={() => setDark((x) => !x)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-start hover:bg-white/7 hover:text-white">
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />} {dark ? 'المظهر الفاتح' : 'المظهر الداكن'}
          </button>
          <span>{repo.mode === 'supabase' ? 'متصل بـ Supabase' : 'نسخة تجريبية (المتصفح)'}</span>
        </div>
      </nav>
      <main className="min-w-0 max-w-[1240px] px-4 pt-5 pb-28 md:pb-12 pe-[max(16px,env(safe-area-inset-right,0px))] ps-[max(16px,env(safe-area-inset-left,0px))]">{children}</main>
    </div>
  );
}
