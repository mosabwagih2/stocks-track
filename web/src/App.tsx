import { lazy, Suspense } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import Shell from './components/Shell';
import { Spinner } from './components/Spinner';

const Today = lazy(() => import('./pages/Today'));
const Orders = lazy(() => import('./pages/Orders'));
const Stock = lazy(() => import('./pages/Stock'));
const Operations = lazy(() => import('./pages/Operations'));
const Supplies = lazy(() => import('./pages/Supplies'));
const Insights = lazy(() => import('./pages/Insights'));
const Ledger = lazy(() => import('./pages/Ledger'));
const Files = lazy(() => import('./pages/Files'));
const Settings = lazy(() => import('./pages/Settings'));

export default function App() {
  return (
    <Shell>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/supplies" element={<Supplies />} />
          <Route path="/operations" element={<Operations />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/files" element={<Files />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}
