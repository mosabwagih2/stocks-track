import { useEffect, useState } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { SupplyFormSheet } from '@/femini/components/SupplyForm';
import { useAct, useDerived } from '@/femini/hooks/data';
import { PageHead } from '@/femini/components/PageHead';
import { Alert, Button, Card, Empty, Field, Pill, Seg, Sheet, Tabs, TableWrap, th, td } from '@/femini/components/ui';
import { ErrorBox } from '@/femini/components/shared';
import { Spinner } from '@/femini/components/Spinner';
import { dailyUse, supplyBalance, supplyStatus } from '@/femini/domain/supplies';
import { fmt } from '@/femini/cn';
import { repo } from '@/femini/data';
import type { Derived } from '@/femini/hooks/data';
import type { Supply, SupplyRule } from '@/femini/domain/types';

const ruleText = (r: SupplyRule): string => r.kind === 'order' ? `${r.qty} لكل أوردر` : r.kind === 'pieces' ? `${r.qty} لكل قطعة ${r.model || '(أي موديل)'}` : r.kind === 'range' ? `أوردر ${r.to ? `من ${r.from} لـ ${r.to} قطع` : `${r.from} قطع فأكثر`}: ${r.qty} لكل أوردر` : 'يدوي (بدون خصم تلقائي)';
const KIND_AR = { open: 'رصيد افتتاحي', rcv: 'استلام', issue: 'صرف / شطب', count: 'جرد', auto: 'تلقائي من الشحن', rev: 'تراجع' } as const;

function SupplySheet({ d, s, start, onClose }: { d: Derived; s: Supply; start: 'rcv' | 'issue' | 'count'; onClose: () => void }) {
  const act = useAct();
  const [tab, setTab] = useState<'move' | 'log'>('move'); const [kind, setKind] = useState<'rcv' | 'issue' | 'count'>(start);
  const [mode, setMode] = useState<'unit' | 'pack'>('unit'); const [v, setV] = useState(''); const [why, setWhy] = useState(''); const [busy, setBusy] = useState(false);
  const bal = supplyBalance(d.snap.supplyLog, s.id); const k = mode === 'pack' && s.pack > 1 ? s.pack : 1; const n = v === '' ? NaN : Math.floor(+v) * k;
  const delta = isNaN(n) ? 0 : kind === 'rcv' ? n : kind === 'issue' ? -n : n - bal;
  const err = kind === 'issue' && !isNaN(n) && n > bal ? `لا يمكن صرف ${fmt(n)} والرصيد ${fmt(bal)}` : '';
  const ok = !isNaN(n) && !err && (kind === 'count' ? delta !== 0 : n > 0);
  const log = d.snap.supplyLog.filter((e) => e.item === s.id).slice(-40).reverse();
  return (
    <Sheet title={s.name} onClose={onClose}>
      <div className="flex items-center justify-between"><div><div className="text-muted">الرصيد الحالي</div><b className="font-mono text-3xl">{fmt(bal)}</b> <span className="text-muted">{s.unit}</span>{s.pack > 1 && <div className="text-xs text-muted">= {Math.floor(bal / s.pack)} {s.packName} و {bal % s.pack} {s.unit}</div>}</div><Pill>{ruleText(s.rule)}</Pill></div>
      <Tabs value={tab} onChange={setTab} tabs={[['move', 'حركة'], ['log', 'السجل']]} />
      {tab === 'move' ? (
        <>
          <Seg value={kind} onChange={(x) => { setKind(x); setV(''); }} options={[['rcv', 'استلام (زيادة)'], ['issue', 'صرف / شطب (نقص)'], ['count', 'ضبط الرصيد بالجرد']]} label="نوع الحركة" />
          {kind === 'count' && <Alert tone="warn">يستبدل الجرد الرصيد الحالي بالعدد الفعلي الذي أدخلته. استخدمه فقط بعد عدّ المستلزم يدويًا.</Alert>}
          {s.pack > 1 && <Seg value={mode} onChange={setMode} options={[['unit', `بال${s.unit}`], ['pack', `بال${s.packName} (${s.pack})`]]} />}
          <Field label={kind === 'count' ? 'العدد الفعلي الآن' : kind === 'rcv' ? 'الكمية المستلمة' : 'الكمية المراد صرفها'}><input type="number" min={0} inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} className="w-full text-start" /></Field>
          <Field label={kind === 'issue' ? 'السبب' : 'ملاحظة (اختياري)'}><input value={why} onChange={(e) => setWhy(e.target.value)} placeholder={kind === 'issue' ? 'تالف، استخدام يدوي...' : 'مثال: فاتورة 123'} /></Field>
          {v !== '' && <Alert tone={err ? 'crit' : 'neutral'}>الرصيد الحالي <b className="font-mono">{fmt(bal)}</b> · سيصبح <b className="font-mono">{fmt(bal + delta)}</b> {delta !== 0 && <span className="font-mono">({delta > 0 ? '+' : ''}{fmt(delta)})</span>}{err && <div>{err}</div>}</Alert>}
          <Button variant="primary" disabled={!ok || busy} onClick={async () => {
            setBusy(true);
            const r = await act(() => repo.supplyMove({ item: s.id, kind, qty: kind === 'count' ? n : n, why }), (x) => `تم تسجيل ${kind === 'rcv' ? 'الاستلام' : kind === 'issue' ? 'الصرف' : 'الجرد'} (${x.delta > 0 ? '+' : ''}${fmt(x.delta)})`, { undo: (x) => { act(() => repo.undoSupplyMove(x.id), 'تم تسجيل التراجع'); } });
            setBusy(false); if (r) onClose();
          }}>{kind === 'rcv' ? 'تأكيد الاستلام' : kind === 'issue' ? 'تأكيد الصرف' : 'تأكيد الجرد'}</Button>
        </>
      ) : (
        log.length ? <TableWrap><table className="text-sm"><tbody>{log.map((e) => (
          <tr key={e.id} className={e.reversed ? 'opacity-55 line-through' : ''}><td className={td + ' font-mono text-muted'}>{e.date}</td><td className={td}><Pill tone={e.kind === 'rcv' ? 'good' : e.kind === 'issue' ? 'warn' : e.kind === 'count' ? 'info' : e.kind === 'rev' ? 'lost' : 'neutral'}>{KIND_AR[e.kind]}</Pill><div className="text-xs text-muted">{e.why}</div></td><td className={td + ' font-mono ' + (e.qty < 0 ? 'text-crit' : 'text-good')}>{e.qty > 0 ? '+' : ''}{e.qty}</td>
            <td className={td}>{!e.reversed && ['rcv', 'issue', 'count', 'open'].includes(e.kind) && <Button size="sm" variant="ghost" onClick={async () => { await act(() => repo.undoSupplyMove(e.id), 'تم تسجيل التراجع'); }}>تراجع</Button>}</td></tr>))}</tbody></table></TableWrap> : <Empty>لا توجد حركات.</Empty>
      )}
    </Sheet>
  );
}

export default function Supplies({ embedded, addSignal = 0, arch: archP, setArch: setArchP }: { embedded?: boolean; addSignal?: number; arch?: boolean; setArch?: (f: (x: boolean) => boolean) => void } = {}) {
  const { d, isLoading, error } = useDerived();
  const [open, setOpen] = useState<{ id: string; start: 'rcv' | 'issue' | 'count' } | null>(null);
  const [form, setForm] = useState<{ supply?: Supply } | null>(null); const [archS, setArchS] = useState(false); const arch = archP ?? archS; const setArch = setArchP ?? setArchS; const act = useAct();
  useEffect(() => { if (addSignal > 0) setForm({}); }, [addSignal]);
  if (error) return <ErrorBox error={error} />;
  if (isLoading || !d) return <Spinner />;
  const nArch = d.snap.supplies.filter((s) => s.archived).length; const items = d.snap.supplies.filter((s) => s.archived === arch); const sel = d.snap.supplies.find((s) => s.id === open?.id);
  const lg = [...d.snap.supplyLog].slice(-25).reverse(); const nameOf = (id: string) => d.snap.supplies.find((s) => s.id === id)?.name ?? id;
  return (
    <>
      {(() => { const btns = <>{(nArch > 0 || arch) && <Button onClick={() => setArch((x) => !x)}>{arch ? '← رجوع للمستلزمات' : `المؤرشفة (${nArch})`}</Button>}
        <Button variant="primary" onClick={() => setForm({})}><Plus className="size-4" /> إضافة مستلزم</Button></>;
        return embedded
          ? null
          : <PageHead title={arch ? 'المستلزمات المؤرشفة' : 'المستلزمات'} sub="عبوات وفلايرز وكاسات. تُخصم تلقائيًا مع كل أوردر يُشحن وفق قاعدة كل مستلزم.">{btns}</PageHead>; })()}
      {!items.length && <Card><Empty>{arch ? 'لا توجد مستلزمات مؤرشفة.' : 'لا توجد مستلزمات بعد. اضغط «إضافة مستلزم».'}</Empty></Card>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s) => {
          const b = supplyBalance(d.snap.supplyLog, s.id), u = dailyUse(d.snap.supplyLog, s.id, d.today), st = supplyStatus(s, b, u), c = u > 0 ? b / u : null;
          return (
            <Card key={s.id} className={st === 'crit' ? 'border-crit-line bg-crit-bg/40' : st === 'warn' ? 'border-warn-line bg-warn-bg/40' : ''}>
              <div className="flex items-center justify-between"><h2 className="font-display text-base font-semibold">{s.name}</h2><Pill tone={st}>{st === 'crit' ? (b < 0 ? 'سالب' : 'نفد') : st === 'warn' ? 'على وشك النفاد' : 'تمام'}</Pill></div>
              <div className="mt-3"><b className={`font-mono text-[32px] leading-none ${st === 'good' ? '' : st === 'warn' ? 'text-warn' : 'text-crit'}`}>{fmt(b)}</b> <span className="text-muted">{s.unit}</span></div>
              <div className="min-h-5 text-xs text-muted">{s.pack > 1 ? `= ${Math.floor(b / s.pack)} ${s.packName}` : ''}</div>
              <div className="my-2 h-2 overflow-hidden rounded-full bg-grid" aria-hidden><i className={`block h-full rounded-full ${st === 'good' ? 'bg-ready' : st === 'warn' ? 'bg-dirty' : 'bg-scrap'}`} style={{ width: `${c == null ? 0 : Math.min(100, (c / 30) * 100)}%` }} /></div>
              <div className="text-xs text-muted">{c != null ? <>يكفي <b className="font-mono">{Math.floor(c)}</b> يوم · الاستهلاك <span className="font-mono">{u.toFixed(1)}</span> / يوم</> : 'لا يوجد استهلاك مسجّل بعد'}{s.minAlert ? <> · حد التنبيه <span className="font-mono">{fmt(s.minAlert)}</span></> : null}</div>
              <div className="my-3"><Pill>{ruleText(s.rule)}</Pill></div>
              <div className="flex flex-wrap gap-2">{s.archived ? <Button size="sm" onClick={() => act(() => repo.supplyArchive(s.id, false), 'تمت الاستعادة')}>استعادة</Button> : <><Button size="sm" variant="primary" onClick={() => setOpen({ id: s.id, start: 'rcv' })}><Plus className="size-4" /> استلام</Button><Button size="sm" onClick={() => setOpen({ id: s.id, start: 'issue' })}>إدارة الرصيد</Button><Button size="sm" variant="ghost" onClick={() => setForm({ supply: s })} aria-label="إعدادات المستلزم"><Settings2 className="size-4" /> إعدادات</Button></>}</div>
            </Card>
          );
        })}
      </div>
      <h2 className="font-display mt-6 mb-2 text-lg font-semibold">آخر الحركات</h2>
      <TableWrap><table className="text-sm"><thead><tr>{['التاريخ', 'المستلزم', 'النوع', 'الكمية', 'السبب'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
        <tbody>{lg.map((e) => <tr key={e.id} className={e.reversed ? 'opacity-55 line-through' : ''}><td className={td + ' font-mono'}>{e.date}</td><td className={td}>{nameOf(e.item)}</td><td className={td}><Pill>{KIND_AR[e.kind]}</Pill></td><td className={td + ' font-mono ' + (e.qty < 0 ? 'text-crit' : 'text-good')}>{e.qty > 0 ? '+' : ''}{e.qty}</td><td className={td + ' text-muted'}>{e.why}</td></tr>)}</tbody></table></TableWrap>
      {form && <SupplyFormSheet d={d} supply={form.supply} onClose={() => setForm(null)} />}
      {sel && open && <SupplySheet d={d} s={sel} start={open.start} onClose={() => setOpen(null)} />}
    </>
  );
}
