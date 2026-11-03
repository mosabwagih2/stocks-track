import type { ReactNode } from 'react';
export function PageHead({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-4">
      <div><h1 className="font-display text-[26px] leading-tight font-semibold max-md:text-[22px]">{title}</h1>{sub && <p className="mt-0.5 text-muted">{sub}</p>}</div>
      {children && <div className="ms-auto flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
