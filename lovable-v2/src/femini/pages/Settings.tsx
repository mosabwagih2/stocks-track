import { lazy, Suspense, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { PageHead } from '@/femini/components/PageHead';
import { Alert, Button, Card, Sheet, Kpi, TableWrap, th, td } from '@/femini/components/ui';
import { repo } from '@/femini/data';
import { SNAP_KEY } from '@/femini/hooks/data';
import { useToast } from '@/femini/components/toast';
import { useDerived } from '@/femini/hooks/data';
import { downloadBlob } from '@/femini/data/backup';
import { previewBackup, type ImportPreview } from '@/femini/data/legacy-backup';
import { LOC_AR } from '@/femini/domain/constants';
import { backupDue } from '@/femini/domain/reports';
import { friendlyError } from '@/femini/data/errors';
// the cloud sign-in is only for the browser edition: loaded on demand, never in the server edition
const AccountPanel = lazy(() => import('@/femini/components/AccountPanel').then((m) => ({ default: m.AccountPanel })));
import { ServerAccount } from '@/femini/components/ServerAccount';
import { serverEdition } from '@/femini/data';
import { ModelCosts } from '@/femini/components/ModelCosts';

export default function Settings() {
  const qc = useQueryClient(); const toast = useToast(); const { d } = useDerived(); const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null); const [ack, setAck] = useState(false); const [search, setSearch] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); await qc.invalidateQueries({ queryKey: SNAP_KEY }); } catch(e) { setError(friendlyError(e)); } finally { setBusy(false); } };
  if (serverEdition) return (
    <>
      <PageHead title="الإعدادات" sub="الحساب والمستخدمين وتكلفة الموديلات." />
      <div className="grid gap-4 md:grid-cols-2"><ServerAccount /><ModelCosts /></div>
    </>
  );
  return (
    <>
      <PageHead title="الإعدادات" sub="النسخ الاحتياطي وسلامة البيانات." />
      {error && <div role="alert" className="mb-4"><Alert tone="crit">{error}</Alert></div>}
      {d && backupDue(d.snap.lastBackup) && <Alert tone="warn" className="mb-4">{d.snap.lastBackup ? 'مرّ أكثر من أسبوع على آخر نسخة احتياطية؛ نزّل نسخة حديثة لحماية شغلك.' : 'لم تؤخذ نسخة احتياطية بعد؛ نزّل نسخة لحماية شغلك.'}</Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        <Suspense fallback={null}><AccountPanel /></Suspense>
        <ModelCosts />
        <Card title="الاتصال">
          <Alert tone="warn">البيانات محفوظة في هذا المتصفح فقط؛ نسخة احتياطية منتظمة تحمي شغلك. إغلاق الأيام هنا محلي وليس حماية أمنية بين الموظفين.</Alert>
        </Card>
        <Card title="النسخة الاحتياطية">
          <p className="mb-3 text-sm text-muted">{d?.snap.lastBackup ? `آخر نسخة: ${new Date(d.snap.lastBackup).toLocaleString('ar-EG')}` : 'لم تُؤخذ نسخة احتياطية بعد.'}</p>
          <p className="mb-4 text-sm text-muted">تشمل العمليات والأوردرات والكتالوج والمستلزمات والصور والملفات المحفوظة.</p>
          <div className="flex flex-wrap gap-2"><Button variant="primary" disabled={busy} onClick={() => run(async () => { const b = await repo.exportBackup(); downloadBlob(new Blob([JSON.stringify(b)], { type:'application/json' }), `femini-backup-${d?.today ?? 'today'}.json`); toast('تم تجهيز النسخة الاحتياطية للتنزيل'); })}><Download className="size-4" />تنزيل نسخة احتياطية</Button><Button disabled={busy} onClick={() => input.current?.click()}><Upload className="size-4" />استيراد / استرجاع نسخة</Button></div>
          <input ref={input} hidden type="file" accept=".json" aria-label="ملف النسخة الاحتياطية" onChange={async (e) => { const f=e.target.files?.[0]; e.target.value=''; if(!f)return; setError(''); setPreview(null); try { const current = await repo.snapshot(); setPreview(previewBackup(JSON.parse(await f.text()), current.moves)); setAck(false); setSearch(''); } catch(e) {setError(friendlyError(e));} }} />
        </Card>
      </div>
      {preview && <Sheet wide title={preview.legacy ? 'معاينة استيراد النظام القديم' : 'معاينة استرجاع النسخة'} onClose={() => { if(!busy)setPreview(null); }} footer={<div className="flex gap-2"><Button variant="primary" disabled={busy || !ack} onClick={() => run(async () => { await repo.restoreBackup(preview.backup); setPreview(null); toast('تم استيراد النسخة والأرصدة بدون إضافة حركات مكررة'); })}>{busy ? 'جارٍ الاستيراد…' : 'تأكيد الاستيراد'}</Button><Button disabled={busy} onClick={() => setPreview(null)}>إلغاء</Button></div>}>
        <Alert tone="warn">استرجاع كامل، وليس دمجًا: بيانات النسخة تحل محل بيانات هذا المتصفح. لن تضاف حركاتها إلى الحركات الحالية، حتى عند استيراد نفس الملف مرة ثانية. تُحفظ نسخة أمان قبل الاستبدال.</Alert>
        <div className="grid grid-cols-2 gap-3"><Kpi label="حركات بعد إزالة التكرار" value={(preview.backup.state.moves as unknown[]).length} /><Kpi label="أوردرات" value={(preview.backup.state.orders as unknown[]).length} /><Kpi label="حركات موجودة حاليًا" value={preview.overlap} /><Kpi label="مرفقات" value={Object.keys(preview.backup.media).length} /></div>
        {preview.warnings.map((w) => <Alert key={w} tone="warn">{w}</Alert>)}
        <section><h3 className="mb-2 font-semibold">مطابقة الأرصدة حسب الصنف والحالة</h3><p className="mb-3 text-xs text-muted">المصدر مشتق من الحركات الأصلية، والمستورد بعد استبعاد التكرار. فرق الحالي يوضح أثر استبدال البيانات.</p><input className="mb-3 w-full" aria-label="بحث مطابقة الأرصدة" placeholder="بحث بكود الصنف" value={search} onChange={(e) => setSearch(e.target.value)} /><TableWrap><table className="text-sm"><thead><tr>{['الصنف','الحالة','المصدر','المستورد','الحالي','فرق المصدر','فرق الحالي'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead><tbody>{preview.balances.filter((r) => r.sku.toLowerCase().includes(search.toLowerCase())).map((r) => <tr key={`${r.sku}-${r.loc}`}><td className={td}>{r.sku}</td><td className={td}>{LOC_AR[r.loc]}</td>{[r.source,r.imported,r.current,r.imported-r.source,r.imported-r.current].map((n,i) => <td key={i} className={td + (i===3 && n!==0 ? ' text-warn font-semibold' : ' font-mono')}>{n}</td>)}</tr>)}</tbody></table></TableWrap></section>
        {error && <Alert tone="crit">{error}</Alert>}
        <label className="flex items-start gap-2 text-sm"><input className="mt-1 shrink-0" type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />راجعت الأرصدة والفروق وأوافق على استبدال بيانات هذا المتصفح بالنسخة المحددة.</label>
      </Sheet>}
    </>
  );
}
