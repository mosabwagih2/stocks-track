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
            ? <Alert tone="good">متصل بـ Supabase. كل التعديلات بتتسجّل في قاعدة البيانات من خلال دوال محمية، والسجل مش بيتعدّل.</Alert>
            : <Alert tone="warn">نسخة تجريبية: البيانات متخزنة في المتصفح ده بس. لتوصيل Supabase ضيف <span className="font-mono">VITE_SUPABASE_URL</span> و<span className="font-mono">VITE_SUPABASE_ANON_KEY</span> (شوف web/README.md).</Alert>}
        </Card>
        {repo.resetDemo && (
          <Card title="البيانات التجريبية">
            <p className="mb-3 text-muted">بيمسح كل العمليات والشحن والصور ويرجّع للبيانات الأصلية (الرصيد الافتتاحي وبيك أب 2-11).</p>
            {confirm ? <Alert tone="crit">هتمسح كل حاجة. متأكد؟<div className="mt-2 flex gap-2"><Button variant="danger" size="sm" onClick={async () => { await repo.resetDemo!(); await qc.invalidateQueries({ queryKey: SNAP_KEY }); setConfirm(false); toast('رجعنا للبيانات الأصلية'); }}>أيوه، امسح</Button><Button size="sm" onClick={() => setConfirm(false)}>لأ</Button></div></Alert>
              : <Button variant="danger" onClick={() => setConfirm(true)}>رجوع للبيانات الأصلية</Button>}
          </Card>
        )}
      </div>
    </>
  );
}
