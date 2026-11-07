import type { ReactNode } from 'react';
export function PageHead({ title, sub, children, actionsClassName }: { title: ReactNode; sub?: ReactNode; children?: ReactNode; actionsClassName?: string }) {
  return (
    <div className="fade-up mb-6 flex flex-wrap items-end gap-4">
      <div>
        <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight max-md:text-[22px]">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {children && <div className={actionsClassName ?? 'ms-auto flex flex-wrap items-center gap-2'}>{children}</div>}
    </div>
  );
}
