import { useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import type { Derived } from '@/femini/hooks/data';
import { useAct } from '@/femini/hooks/data';
import { repo } from '@/femini/data';
import { dayClosed } from '@/femini/domain/reports';
import { dmy } from '@/femini/domain/dates';
import { Alert, Button } from './ui';

/**
 * The state of one work day, with the way to change it, so nobody has to go back to the main page: a closed day says so and
 * opens with one click; an open day can be closed from the same place (asked once more, so it is never closed by accident).
 * Put it in any form that records something on a day.
 */
export function DayLock({ d, day, className }: { d: Derived; day: string; className?: string }) {
  const act = useAct(); const [ask, setAsk] = useState(false);
  if (!day) return null;
  const closed = dayClosed(d.snap, day);
  if (closed) return (
    <Alert tone="warn" className={`flex flex-wrap items-center justify-between gap-2 ${className ?? ''}`}>
      <span className="inline-flex items-center gap-2"><Lock className="size-4" />يوم {dmy(day)} مقفول. افتحه الأول عشان تسجّل أو تعدّل عليه.</span>
      <Button size="sm" onClick={() => act(() => repo.reopenDay(day).then(() => true), `اتفتح يوم ${dmy(day)}`)}><LockOpen className="size-4" />افتح اليوم</Button>
    </Alert>
  );
  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs text-muted ${className ?? ''}`}>
      <span className="inline-flex items-center gap-1.5"><LockOpen className="size-3.5" />يوم {dmy(day)} مفتوح</span>
      {!ask
        ? <Button size="sm" variant="ghost" onClick={() => setAsk(true)}><Lock className="size-3.5" />قفل اليوم</Button>
        : <span className="inline-flex items-center gap-1.5">نقفل يوم {dmy(day)}؟
          <Button size="sm" variant="primary" onClick={async () => { await act(() => repo.closeDay(day).then(() => true), `اتقفل يوم ${dmy(day)}`); setAsk(false); }}>أيوه، اقفل</Button>
          <Button size="sm" onClick={() => setAsk(false)}>لأ</Button></span>}
    </div>
  );
}
