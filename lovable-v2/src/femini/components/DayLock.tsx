import { Lock, LockOpen } from 'lucide-react';
import type { Derived } from '@/femini/hooks/data';
import { useAct } from '@/femini/hooks/data';
import { repo } from '@/femini/data';
import { dayClosed } from '@/femini/domain/reports';
import { dmy } from '@/femini/domain/dates';
import { Alert, Button } from './ui';

/**
 * A closed day says so, with a button that opens it right there, so nobody has to go back to the main page.
 * An open day shows nothing at all (closing a day belongs to the main page). Put it in any form that records something on a day.
 */
export function DayLock({ d, day, className }: { d: Derived; day: string; className?: string }) {
  const act = useAct();
  if (!day || !dayClosed(d.snap, day)) return null;
  return (
    <Alert tone="warn" className={`flex flex-wrap items-center justify-between gap-2 ${className ?? ''}`}>
      <span className="inline-flex items-center gap-2"><Lock className="size-4" />يوم {dmy(day)} مقفول. افتحه الأول عشان تسجّل أو تعدّل عليه.</span>
      <Button size="sm" onClick={() => act(() => repo.reopenDay(day).then(() => true), `اتفتح يوم ${dmy(day)}`)}><LockOpen className="size-4" />افتح اليوم</Button>
    </Alert>
  );
}
