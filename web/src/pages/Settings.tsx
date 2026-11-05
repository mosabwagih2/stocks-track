import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PageHead } from '@/components/PageHead';
import { Alert, Button, Card } from '@/components/ui';
import { repo } from '@/data';
import { SNAP_KEY } from '@/hooks/data';
import { useToast } from '@/components/toast';

export default function Settings() {
  const qc = useQueryClient(); const toast = useToast(); const [confirm, setConfirm] = useState(false);
  return (
    <>
      <PageHead title="الإعدادات" sub="الاتصال والبيانات." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="الاتصال">
          {repo.mode === 'supabase'
            ? <Alert tone="good">متصل بـ Supabase. تُسجَّل جميع التعديلات في قاعدة البيانات عبر دوال محمية، ولا يمكن تعديل السجل.</Alert>
            : <Alert tone="warn">نسخة تجريبية: البيانات محفوظة في هذا المتصفح فقط. للاتصال بـ Supabase أضف <span className="font-mono">VITE_SUPABASE_URL</span> و<span className="font-mono">VITE_SUPABASE_ANON_KEY</span> (راجع web/README.md).</Alert>}
        </Card>
        {repo.resetDemo && (
          <Card title="البيانات التجريبية">
            <p className="mb-3 text-muted">يحذف جميع العمليات والشحن والصور ويعيد البيانات الأصلية (الرصيد الافتتاحي وبيك أب 2-11).</p>
            {confirm ? <Alert tone="crit">سيتم حذف كل شيء. هل أنت متأكد؟<div className="mt-2 flex gap-2"><Button variant="danger" size="sm" onClick={async () => { await repo.resetDemo!(); await qc.invalidateQueries({ queryKey: SNAP_KEY }); setConfirm(false); toast('تمت استعادة البيانات الأصلية'); }}>نعم، احذف</Button><Button size="sm" onClick={() => setConfirm(false)}>لا</Button></div></Alert>
              : <Button variant="danger" onClick={() => setConfirm(true)}>استعادة البيانات الأصلية</Button>}
          </Card>
        )}
      </div>
    </>
  );
}
