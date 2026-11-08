import { useEffect, useState } from 'react';
import { History, Upload } from 'lucide-react';
import { Alert, Button, Card, Field, TableWrap, th, td } from './ui';
import { boot } from '@/femini/data';
import { fmt } from '@/femini/cn';

/**
 * Admin: put everything back from a full backup file (or back to the safety copy the server kept before a restore).
 * Shows what the file holds against what the server holds now, asks twice (the second time by typing the word), and reloads.
 */
interface Summary { at: number | null; source: string; rev: number | null; moves: number; orders: number; docs: number; pickups: number; holds: number; files: number; now: { moves: number; orders: number; docs: number; files: number; rev: number } }
interface Point { name: string; size: number; at: string }
const WORD = 'استرجاع';
const csrf = () => boot?.csrf ?? '';
async function send<T>(path: string, init: RequestInit): Promise<T> {
  const r = await fetch(path, { credentials: 'same-origin', ...init, headers: { 'X-CSRF-Token': csrf(), ...(init.headers ?? {}) } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false) throw new Error(String(data.message ?? 'السيرفر رفض الطلب.'));
  return data as T;
}
const when = (ms: number | null) => (ms ? new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }).format(new Date(ms)) : '—');

export function RestoreCard() {
  const [file, setFile] = useState<File | null>(null); const [sum, setSum] = useState<Summary | null>(null);
  const [step, setStep] = useState(0); const [word, setWord] = useState(''); const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  const [points, setPoints] = useState<Point[] | null>(null); const [undo, setUndo] = useState<string | null>(null); const [undoWord, setUndoWord] = useState('');
  useEffect(() => { send<{ points: Point[] }>('/api/admin/restore/points', { method: 'GET' }).then((x) => setPoints(x.points), () => setPoints([])); }, []);
  const form = (mode: 'check' | 'run') => { const fd = new FormData(); fd.append('backup', file!, file!.name); fd.append('mode', mode); if (mode === 'run') fd.append('confirm', word.trim()); return fd; };
  const check = async (f: File) => {
    setFile(f); setSum(null); setStep(0); setWord(''); setErr(''); setBusy('بفحص الملف…');
    try { const fd = new FormData(); fd.append('backup', f, f.name); fd.append('mode', 'check'); setSum((await send<{ summary: Summary }>('/api/admin/restore', { method: 'POST', body: fd })).summary); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(''); }
  };
  const run = async () => {
    setErr(''); setBusy('بسترجع… متقفلش الصفحة.');
    try {
      const r = await send<{ safety: string; files: number }>('/api/admin/restore', { method: 'POST', body: form('run') });
      setBusy(`اترجعت البيانات (${r.files} ملف). نسخة الأمان: ${r.safety}. الصفحة هتتحدّث…`); setTimeout(() => location.reload(), 1500);
    } catch (e) { setErr((e as Error).message); setBusy(''); }
  };
  const runUndo = async (name: string) => {
    setErr(''); setBusy('برجّع نسخة السيرفر… متقفلش الصفحة.');
    try { await send('/api/admin/restore/undo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, confirm: undoWord.trim() }) }); setBusy('اترجعت. الصفحة هتتحدّث…'); setTimeout(() => location.reload(), 1500); }
    catch (e) { setErr((e as Error).message); setBusy(''); }
  };
  const lost = sum ? Math.max(0, sum.now.moves - sum.moves) : 0;
  return (
    <Card title="استرجاع من نسخة احتياطية">
      <p className="text-sm text-muted">بيرجّع كل البيانات لحالة النسخة: الحركات والأوردرات والمستندات والبيك أب والكتالوج والإعدادات والملفات والصور. أي حاجة اتعملت بعد النسخة بتتشال. المستخدمين وكلمات السر مش بتتغير.</p>
      <p className="mt-1 text-xs text-muted">قبل أي استرجاع السيرفر بيحفظ نسخة أمان من الحالة الحالية، وتقدر ترجعلها من تحت.</p>
      <Field label="ملف النسخة الاحتياطية (femini-backup-….json)"><input type="file" accept=".json,application/json" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void check(f); }} /></Field>
      {err && <Alert tone="crit" className="mt-2">{err}</Alert>}
      {busy && <p className="mt-2 text-sm" aria-live="polite">{busy}</p>}
      {sum && !busy && (
        <div className="mt-3 grid gap-3">
          <TableWrap><table className="text-sm"><thead><tr><th className={th} /><th className={th}>في النسخة</th><th className={th}>على السيرفر دلوقتي</th></tr></thead>
            <tbody>
              <tr><td className={td}>التاريخ</td><td className={td}>{when(sum.at)}{sum.source ? ` · ${sum.source}` : ''}</td><td className={td}>—</td></tr>
              <tr><td className={td}>الحركات</td><td className={td + ' font-mono'}>{fmt(sum.moves)}</td><td className={td + ' font-mono'}>{fmt(sum.now.moves)}</td></tr>
              <tr><td className={td}>الأوردرات</td><td className={td + ' font-mono'}>{fmt(sum.orders)}</td><td className={td + ' font-mono'}>{fmt(sum.now.orders)}</td></tr>
              <tr><td className={td}>المستندات</td><td className={td + ' font-mono'}>{fmt(sum.docs)}</td><td className={td + ' font-mono'}>{fmt(sum.now.docs)}</td></tr>
              <tr><td className={td}>الملفات والصور</td><td className={td + ' font-mono'}>{fmt(sum.files)}</td><td className={td + ' font-mono'}>{fmt(sum.now.files)}</td></tr>
            </tbody></table></TableWrap>
          {lost > 0 && <Alert tone="warn">فيه {fmt(lost)} حركة على السيرفر بعد النسخة دي، هتتشال كلها.</Alert>}
          {step === 0 && <div><Button variant="danger" onClick={() => setStep(1)}><Upload className="size-4" /> استرجاع النسخة دي</Button></div>}
          {step === 1 && <div className="grid gap-2 rounded-xl border border-warn-line bg-warn-bg p-3">
            <p className="text-sm"><b>متأكد؟</b> كل البيانات هترجع زي النسخة بالظبط، وكل الأجهزة المفتوحة هتتحدّث.</p>
            <div className="flex gap-2"><Button variant="danger" onClick={() => setStep(2)}>أيوه، كمّل</Button><Button onClick={() => setStep(0)}>لأ</Button></div>
          </div>}
          {step === 2 && <div className="grid gap-2 rounded-xl border border-crit-line bg-crit-bg p-3">
            <Field label={`للتأكيد اكتب كلمة «${WORD}»`}><input value={word} onChange={(e) => setWord(e.target.value)} autoFocus autoComplete="off" /></Field>
            <div className="flex gap-2"><Button variant="danger" disabled={word.trim() !== WORD} onClick={run}>استرجاع دلوقتي</Button><Button onClick={() => { setStep(0); setWord(''); }}>إلغاء</Button></div>
          </div>}
        </div>
      )}
      {!!points?.length && (
        <details className="mt-4 rounded-xl border border-line p-3">
          <summary className="cursor-pointer text-sm font-semibold"><History className="me-1 inline size-4" />نسخ الأمان على السيرفر ({points.length})</summary>
          <p className="mt-2 text-xs text-muted">السيرفر بيحفظ نسخة قبل كل استرجاع. لو الاسترجاع طلع غلط، رجّع للنسخة اللي قبله.</p>
          <div className="mt-2 grid gap-2">{points.map((p) => (
            <div key={p.name} className="rounded-lg border border-line p-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs">{p.name}</span><span className="text-xs text-muted">{when(Date.parse(p.at))} · {Math.ceil(p.size / 1024)} KB</span>
                <Button size="sm" variant="danger" onClick={() => { setUndo(undo === p.name ? null : p.name); setUndoWord(''); }}>رجّع للنسخة دي</Button></div>
              {undo === p.name && <div className="mt-2 flex flex-wrap items-end gap-2">
                <Field label={`اكتب «${WORD}» للتأكيد`}><input value={undoWord} onChange={(e) => setUndoWord(e.target.value)} autoComplete="off" /></Field>
                <Button variant="danger" disabled={undoWord.trim() !== WORD || !!busy} onClick={() => runUndo(p.name)}>رجّع دلوقتي</Button>
              </div>}
            </div>))}</div>
        </details>
      )}
    </Card>
  );
}
