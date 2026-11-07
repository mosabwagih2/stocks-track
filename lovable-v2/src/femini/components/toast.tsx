import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Button } from './ui';

interface T { id: number; msg: string; undo?: () => void; tone?: 'ok' | 'err' }
const Ctx = createContext<(msg: string, o?: { undo?: () => void; tone?: 'ok' | 'err' }) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((msg: string, o?: { undo?: () => void; tone?: 'ok' | 'err' }) => {
    const id = Date.now() + Math.random();
    setItems((a) => [...a, { id, msg, ...o }]);
    setTimeout(() => setItems((a) => a.filter((x) => x.id !== id)), o?.undo ? 9000 : o?.tone === 'err' ? 6000 : 3200);
  }, []);
  const v = useMemo(() => push, [push]);
  return (
    <Ctx.Provider value={v}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom,0px))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex max-w-[min(520px,100%)] items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-pop fade-up ${t.tone === 'err' ? 'bg-crit text-on-accent' : 'bg-ink text-page'}`}>
            <span>{t.msg}</span>
            {t.undo && <Button size="sm" onClick={() => { t.undo?.(); setItems((a) => a.filter((x) => x.id !== t.id)); }}>تراجع</Button>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
