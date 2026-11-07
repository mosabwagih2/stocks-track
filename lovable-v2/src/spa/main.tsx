/**
 * The server edition (cPanel): a static single-page build of the same pages, served by php-app after sign-in.
 * The PHP page embeds the whole server state (window.FEM_BOOT) before this script runs, so the app starts with real data.
 * Built with `npm run build:cpanel` into php-app/public/app/.
 */
import '../styles.css';
import { StrictMode, useEffect, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Outlet, RouterProvider, createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import Shell from '@/femini/components/Shell';
import { ToastProvider } from '@/femini/components/toast';
import Today from '@/femini/pages/Today';
import Stock from '@/femini/pages/Stock';
import Orders from '@/femini/pages/Orders';
import Operations from '@/femini/pages/Operations';
import Ledger from '@/femini/pages/Ledger';
import Insights from '@/femini/pages/Insights';
import Files from '@/femini/pages/Files';
import Settings from '@/femini/pages/Settings';

function NotFound() {
  return <div className="grid min-h-[50vh] place-items-center text-center"><div><h1 className="text-2xl font-semibold">الصفحة دي مش موجودة</h1><Link to="/" className="mt-3 inline-block text-accent">ارجع للنهارده</Link></div></div>;
}
function Failed({ error }: { error: unknown }) {
  console.error(error);
  return <div className="grid min-h-[50vh] place-items-center text-center"><div><h1 className="text-xl font-semibold">الصفحة ما اتفتحتش</h1><p className="mt-2 text-sm text-muted">{String((error as Error)?.message ?? error)}</p><button className="mt-4 rounded-lg border px-4 py-2" onClick={() => location.reload()}>حدّث الصفحة</button></div></div>;
}

const root = createRootRoute({
  component: () => <ToastProvider><Shell><Outlet /></Shell></ToastProvider>,
  notFoundComponent: NotFound,
  errorComponent: Failed,
});
const page = (path: string, C: ComponentType, title: string) => createRoute({
  getParentRoute: () => root, path,
  component: function Page() { useEffect(() => { document.title = `${title} · Fémini Stock`; }, []); return <C />; },
});
const routeTree = root.addChildren([
  page('/', Today, 'اليوم'), page('/stock', Stock, 'المخزون'), page('/orders', Orders, 'الأوردرات'), page('/operations', Operations, 'العمليات'),
  page('/ledger', Ledger, 'الدفتر'), page('/insights', Insights, 'التحليلات'), page('/files', Files, 'الملفات'), page('/settings', Settings, 'الإعدادات'),
  createRoute({ getParentRoute: () => root, path: '/supplies', beforeLoad: () => { throw redirect({ to: '/stock', search: { view: 'supplies' } as never }); } }),
]);
const router = createRouter({ routeTree, scrollRestoration: true, defaultPreloadStaleTime: 0 });
declare module '@tanstack/react-router' { interface Register { router: typeof router } }

const queryClient = new QueryClient();
createRoot(document.getElementById('root')!).render(
  <StrictMode><QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider></StrictMode>,
);
