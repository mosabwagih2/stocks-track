import { useCallback, useEffect, useState } from 'react';
import { Download, LogOut, UserPlus } from 'lucide-react';
import { Alert, Button, Card, Field, TableWrap, th, td } from './ui';
import { useToast } from './toast';
import { boot, server } from '@/femini/data';
import { stateFromPull } from '@/femini/data/cpanel/v3';
import { downloadBlob } from '@/femini/data/backup';
import { RestoreCard } from './RestoreCard';

/** Server edition: the signed-in account, sign out, own password, and (with the "users" permission) users and roles.
 * Everything goes through the server API; the server checks every permission again. */
export const PERMS: [string, string][] = [
  ['money', 'يشوف الفلوس والتكلفة'], ['scan', 'شحن بالسكان'], ['returns', 'استلام المرتجع'], ['receive', 'استلام من المصنع'],
  ['internal', 'هالك / غسيل / مفقود / هولد'], ['ship', 'توريد للمحل'], ['count', 'الجرد'], ['pickup', 'رفع بيك أب'], ['cancel', 'إلغاء أوردر'],
  ['catalog', 'تعديل الأصناف والموديلات'], ['supplies', 'المستلزمات'], ['close', 'قفل اليوم وفتحه'], ['settings', 'الإعدادات'], ['users', 'المستخدمين والصلاحيات'],
];
const ROLE_AR: Record<string, string> = { admin: 'مدير', sup: 'مشرف مخزن', pack: 'موظف شحن', view: 'مراجعة (قراءة فقط)' };
interface User { id: string; username: string; name: string; role: string; active: boolean; arch: boolean; hasPassword: boolean }
type Roles = Record<string, { name: string; perms: string[] }>;

async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': boot?.csrf ?? '' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false) throw new Error(String(data.message ?? 'السيرفر رفض الطلب.'));
  return data as T;
}

export function ServerAccount() {
  const me = boot?.user; const toast = useToast();
  const [cur, setCur] = useState(''); const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const can = (p: string) => me?.role === 'admin' || (me?.perms ?? []).includes(p);
  const logout = async () => { try { await api('POST', '/api/auth/logout'); } finally { location.href = '/'; } };
  const changePw = async () => { setBusy(true); setErr(''); try { await api('POST', `/api/users/${me!.id}/password`, { current: cur, password: pw }); setCur(''); setPw(''); toast('اتغيرت كلمة السر، وباقي الأجهزة اتعملها خروج'); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  return (
    <>
      <Card title="الحساب">
        <p className="text-sm">داخل باسم <b>{me?.name}</b> · {ROLE_AR[me?.role ?? ''] ?? me?.role}</p>
        <p className="mt-1 text-xs text-muted">كل عملية بتتسجل باسمك، والسيرفر بيتأكد من صلاحياتك في كل مرة.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Field label="كلمة السر الحالية"><input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
          <Field label="كلمة السر الجديدة (8 حروف أو أكتر)"><input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        </div>
        {err && <Alert tone="crit" className="mt-2">{err}</Alert>}
        <div className="mt-3 flex flex-wrap gap-2"><Button disabled={busy || !cur || pw.length < 8} onClick={changePw}>تغيير كلمة السر</Button><Button variant="ghost" onClick={logout}><LogOut className="size-4" /> تسجيل الخروج</Button></div>
      </Card>
      <BackupCard canUsers={can('users')} />
      {me?.role === 'admin' && <RestoreCard />}
      {can('users') && <UsersCard isAdmin={me?.role === 'admin'} />}
    </>
  );
}

function UsersCard({ isAdmin }: { isAdmin: boolean }) {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]); const [roles, setRoles] = useState<Roles>({}); const [err, setErr] = useState('');
  const [nu, setNu] = useState({ username: '', name: '', role: 'pack', password: '' });
  const load = useCallback(async () => { try { const d = await api<{ users: User[]; roles: Roles }>('GET', '/api/users'); setUsers(d.users); setRoles(d.roles); } catch (e) { setErr((e as Error).message); } }, []);
  useEffect(() => { void load(); }, [load]);
  const run = async (fn: () => Promise<unknown>, ok: string) => { setErr(''); try { await fn(); toast(ok); await load(); return true; } catch (e) { setErr((e as Error).message); return false; } };
  const [adding, setAdding] = useState(false); const [saving, setSaving] = useState(false);
  const missing = !nu.name.trim() ? 'اكتب الاسم الظاهر.' : !/^[A-Za-z0-9_.@-]{3,60}$/.test(nu.username) ? 'اسم الدخول: 3 حروف أو أكتر، إنجليزي وأرقام بس.' : users.some((u) => u.username.toLowerCase() === nu.username.toLowerCase()) ? 'اسم الدخول ده مستخدم قبل كده.' : nu.password.length < 8 ? 'كلمة السر 8 حروف أو أكتر.' : '';
  const reset = (u: User) => { const p = window.prompt(`كلمة سر جديدة لـ ${u.name} (8 حروف أو أكتر)`); if (p) void run(() => api('POST', `/api/users/${u.id}/password`, { password: p }), `اتغيرت كلمة سر ${u.name}`); };
  const togglePerm = (role: string, p: string, on: boolean) => { const perms = new Set(roles[role].perms); if (on) perms.add(p); else perms.delete(p); void run(() => api('PUT', `/api/roles/${role}`, { perms: [...perms] }), 'اتعدّلت الصلاحيات'); };
  return (
    <Card title="المستخدمين والصلاحيات" className="md:col-span-2">
      {err && <Alert tone="crit" className="mb-3">{err}</Alert>}
      <TableWrap><table className="text-sm"><thead><tr><th className={th}>الاسم</th><th className={th}>اسم الدخول</th><th className={th}>الدور</th><th className={th}>الحالة</th><th className={th} /></tr></thead>
        <tbody>{users.filter((u) => !u.arch).map((u) => (
          <tr key={u.id}><td className={td}>{u.name}</td><td className={td + ' font-mono'}>{u.username}</td>
            <td className={td}><select value={u.role} onChange={(e) => run(() => api('PATCH', `/api/users/${u.id}`, { role: e.target.value }), 'اتغير الدور')}>{Object.keys(roles).filter((r) => isAdmin || r !== 'admin').map((r) => <option key={r} value={r}>{ROLE_AR[r] ?? roles[r].name}</option>)}</select></td>
            <td className={td}><label className="flex items-center gap-1.5"><input type="checkbox" checked={u.active} onChange={(e) => run(() => api('PATCH', `/api/users/${u.id}`, { active: e.target.checked }), e.target.checked ? 'اتفعّل' : 'اتوقف')} /> {u.active ? 'شغّال' : 'موقوف'}</label></td>
            <td className={td}><Button size="sm" variant="ghost" onClick={() => reset(u)}>كلمة سر جديدة</Button></td></tr>))}</tbody></table></TableWrap>
      {!adding ? <div className="mt-4"><Button variant="primary" onClick={() => setAdding(true)}><UserPlus className="size-4" /> حساب جديد</Button></div> : (
        <div className="mt-4 grid gap-3 rounded-xl border border-line bg-lav p-3">
          <b className="text-sm">حساب جديد</b>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="الاسم الظاهر (بيتسجل على كل عملية)"><input value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} placeholder="مثلًا: أحمد" autoFocus /></Field>
            <Field label="اسم الدخول (حروف إنجليزي وأرقام)"><input dir="ltr" autoComplete="off" value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value.trim() })} placeholder="ahmed" /></Field>
            <Field label="الدور"><select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>{Object.keys(roles).filter((r) => isAdmin || r !== 'admin').map((r) => <option key={r} value={r}>{ROLE_AR[r] ?? roles[r].name}</option>)}</select></Field>
            <Field label="كلمة السر (8 حروف أو أكتر)"><input type="password" autoComplete="new-password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} /></Field>
          </div>
          {missing && <p className="text-xs text-muted">{missing}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={!!missing || saving} onClick={async () => { setSaving(true); await run(() => api('POST', '/api/users', nu), `اتعمل حساب ${nu.name}`).then((ok) => { if (ok) { setNu({ username: '', name: '', role: 'pack', password: '' }); setAdding(false); } }); setSaving(false); }}><UserPlus className="size-4" /> {saving ? 'جارٍ الحفظ…' : 'إنشاء الحساب'}</Button>
            <Button onClick={() => { setAdding(false); setNu({ username: '', name: '', role: 'pack', password: '' }); }}>إلغاء</Button>
          </div>
        </div>)}
      <h3 className="mb-2 mt-5 text-sm font-semibold">صلاحيات الأدوار {isAdmin ? '' : '(المدير بس بيعدّلها)'}</h3>
      <TableWrap><table className="text-xs"><thead><tr><th className={th}>الصلاحية</th>{Object.keys(roles).map((r) => <th key={r} className={th}>{ROLE_AR[r] ?? roles[r].name}</th>)}</tr></thead>
        <tbody>{PERMS.map(([p, label]) => (
          <tr key={p}><td className={td}>{label}</td>{Object.keys(roles).map((r) => { const all = roles[r].perms.includes('*'); return <td key={r} className={td}><input type="checkbox" aria-label={`${label} · ${r}`} checked={all || roles[r].perms.includes(p)} disabled={!isAdmin || r === 'admin' || all} onChange={(e) => togglePerm(r, p, e.target.checked)} /></td>; })}</tr>))}</tbody></table></TableWrap>
    </Card>
  );
}

/** A complete copy of the server data, downloaded to this computer as one file: every move, order, document, pickup,
 * setting and the catalog, the users list, and the attached files themselves (photos and original sheets).
 * Same shape as the original app's backup (femini-stock v3), so php-app/tools/import_backup.php can restore it. */
function BackupCard({ canUsers }: { canUsers: boolean }) {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const run = async () => {
    setBusy(true); setErr(''); setMsg('بجيب البيانات من السيرفر…');
    try {
      const pr = await fetch('/api/sync/pull?since=0', { credentials: 'same-origin' }); if (!pr.ok) throw new Error('مقدرتش أجيب البيانات من السيرفر.');
      const pull = await pr.json();
      // every file the server keeps (admin: also originals later replaced on the same sheet), oldest first
      const all = await fetch('/api/files?all=1', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const files = (Array.isArray(all?.files) ? all.files : server()?.files() ?? []) as { id: number }[]; const photos: Record<string, string> = {}; const fileList: unknown[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i]; setMsg(`بنزّل الملفات ${i + 1} من ${files.length}…`);
        const r = await fetch(`/api/files/${f.id}`, { credentials: 'same-origin' }); if (!r.ok) continue;
        const b = await r.blob(); const data = await new Promise<string>((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.onerror = () => no(fr.error); fr.readAsDataURL(b); });
        photos[`f${f.id}`] = data; fileList.push({ ...f, data: `f${f.id}` });
      }
      const users = canUsers ? await fetch('/api/users', { credentials: 'same-origin' }).then((r) => r.json()).catch(() => null) : null;
      const at = Date.now(); const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date(at));
      const backup = { app: 'femini-stock', v: 3, at, source: location.host, rev: pull.rev, state: stateFromPull(pull), photos, files: fileList, users: users?.users ?? null, roles: users?.roles ?? null };
      downloadBlob(new Blob([JSON.stringify(backup)], { type: 'application/json' }), `femini-backup-${day}.json`);
      const n = (pull.moves ?? []).length;
      setMsg(`اتنزّلت النسخة: ${n.toLocaleString('en')} حركة، ${(backup.state.orders as unknown[]).length.toLocaleString('en')} أوردر، ${fileList.length} ملف.`);
    } catch (e) { setErr((e as Error).message); setMsg(''); } finally { setBusy(false); }
  };
  return (
    <Card title="النسخة الاحتياطية">
      <p className="text-sm text-muted">بتنزّل كل البيانات على الكمبيوتر في ملف واحد: الحركات والأوردرات والمستندات والبيك أب والكتالوج والإعدادات والمستخدمين، ومعاهم الملفات والصور نفسها.</p>
      {err && <Alert tone="crit" className="mt-2">{err}</Alert>}
      {msg && <p className="mt-2 text-xs text-muted" aria-live="polite">{msg}</p>}
      <Button variant="primary" className="mt-3" disabled={busy} onClick={run}><Download className="size-4" /> {busy ? 'بيتنزّل…' : 'نزّل نسخة احتياطية كاملة'}</Button>
      <p className="mt-2 text-[11px] text-muted">احتفظ بيها في مكان تاني غير الجهاز ده. السيرفر نفسه بيتعمله نسخة كمان من cPanel.</p>
    </Card>
  );
}
