import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter } from 'react-router-dom';
import './index.css';
import './brand.css';
import { BRAND } from './lib/brand';
import markPurple from './assets/femini-mark.png';
import App from './App';
import { ToastProvider } from './components/toast';

if (BRAND) {
  document.documentElement.dataset.brand = '1';
  const l = document.querySelector<HTMLLinkElement>('link[rel="icon"]'); if (l) { l.href = markPurple; l.type = 'image/png'; }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#2b2150');
}
const qc = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
