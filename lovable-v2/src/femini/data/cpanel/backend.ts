/**
 * Server edition: the repository keeps working on the app state in memory (same rules as the browser edition), and this
 * backend turns every saved action into ONE atomic push to the PHP server. The server checks permissions, closed days,
 * frozen documents and who did it; if it refuses, nothing is applied anywhere and the screen goes back to what the
 * server holds. Other people's changes come in with every snapshot (pull since the last revision).
 */
import { applyPull, applyPush, docPhotoPath, emptyMirror, isEmpty, mirrorFromBoot, toLovable, toPush, type Boot, type Mirror, type ServerFile } from './v3';
import type { State } from '../memory';

export interface PullResult { rev: number; moves: Record<string, unknown>[]; coll: Record<string, { k: string; row: unknown; gone: boolean }[]>; meta: Record<string, { v: unknown }> }
export type PushReply = { ok: true; rev: number; prev: number } | { ok: false; status: number; error: string; message: string };
/** how the backend talks to the server (fetch in the app, an in-memory server in tests) */
export interface Transport {
  pull(since: number): Promise<PullResult>;
  push(body: Record<string, unknown>): Promise<PushReply>;
  upload(file: Blob, name: string, kind: string, ownerType: string, ownerId: string): Promise<ServerFile>;
}
/** what an attached file belongs to, in the app's terms */
export type FileOwner = { type: 'pickup'; id: string } | { type: 'doc'; no: string } | { type: 'order'; ref: string };
export type FileKind = 'pickup' | 'scan' | 'doc_photo' | 'cancel';

export interface Backend {
  readonly user: { id: string; name: string; role: string; perms: string[] };
  /** the app state as the server holds it now */
  current(): State;
  /** sends what changed; throws (with the server's Arabic message) when refused */
  persist(S: State): Promise<void>;
  /** other people's changes; null when nothing changed since the last look */
  refresh(): Promise<State | null>;
  /** a file attached by the action being saved: uploaded right after that action is accepted */
  queueFile(owner: FileOwner, kind: FileKind, file: File, path?: string): void;
  /** every file the server holds (originals and photos), as known to this page */
  files(): ServerFile[];
  fileUrl(path: string): Promise<string | null>;
}

const httpTransport = (csrf: string): Transport => ({
  async pull(since) {
    const r = await fetch(`/api/sync/pull?since=${since}`, { credentials: 'same-origin' });
    if (r.status === 401) { location.href = '/'; throw new Error('انتهت الجلسة؛ سجّل دخول تاني.'); }   // back to the sign-in page
    if (!r.ok) throw new Error('مقدرتش أجيب البيانات من السيرفر.');
    return r.json();
  },
  async push(body) {
    let r: Response;
    try { r = await fetch('/api/sync/push', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(body) }); }
    catch { return { ok: false, status: 0, error: 'offline', message: 'مفيش اتصال بالسيرفر؛ العملية ما اتسجلتش. جرّب تاني.' }; }
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) location.href = '/';
    return r.ok ? { ok: true, rev: data.rev, prev: data.prev } : { ok: false, status: r.status, error: String(data.error ?? 'error'), message: String(data.message ?? 'السيرفر رفض العملية.') };
  },
  async upload(file, name, kind, ownerType, ownerId) {
    const fd = new FormData(); fd.append('file', file, name); fd.append('kind', kind); fd.append('owner_type', ownerType); fd.append('owner_id', ownerId);
    const r = await fetch('/api/files', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': csrf }, body: fd });
    const data = await r.json().catch(() => ({}));
    if (r.status !== 201) throw new Error(String(data.message ?? 'مقدرتش أرفع الملف.'));
    return { ...data.file, ownerType, ownerId, kind };
  },
});

export function createServerBackend(boot: Boot, transport: Transport = httpTransport(boot.csrf ?? '')): Backend {
  let m: Mirror = mirrorFromBoot(boot);
  const user = { id: boot.user?.id ?? '', name: boot.user?.name ?? '', role: boot.user?.role ?? '', perms: boot.user?.perms ?? [] };
  const pending: { owner: FileOwner; kind: FileKind; file: File }[] = [];
  const reload = async () => { const files = m.files; m = applyPull(emptyMirror(), await transport.pull(0)); m.files = files; };
  const ownerOf = (o: FileOwner): [string, string] | null => {
    if (o.type === 'pickup') return ['pickup', o.id];
    if (o.type === 'order') return ['order', o.ref];
    const d = [...m.rows.docs.values()].find((r) => (r as { no?: string }).no === o.no) as { id: string } | undefined;
    return d ? ['doc', String(d.id)] : null;
  };
  async function flushFiles() {
    const errors: string[] = [];
    while (pending.length) {
      const f = pending.shift()!; const owner = ownerOf(f.owner); if (!owner) continue;
      try { m.files.push(await transport.upload(f.file, f.file.name || 'file', f.kind, owner[0], owner[1])); }
      catch (e) { errors.push((e as Error).message); }
    }
    if (errors.length) throw new Error(`العملية اتسجلت، بس الملف ما اترفعش: ${errors[0]}`);
  }

  return {
    user,
    current: () => toLovable(m),
    async persist(S) {
      const p = toPush(S, m, user.name);
      if (isEmpty(p)) { await flushFiles(); return; }
      const since = m.rev;
      const r = await transport.push({ since, moves: p.moves, coll: p.coll, meta: p.meta });
      if (!r.ok) {
        pending.length = 0;
        if (r.error === 'stale') { await reload(); throw new Error('حد تاني سجّل على نفس البيانات في نفس اللحظة. اتحدّثت البيانات؛ راجع وأعد العملية.'); }
        throw new Error(r.message);
      }
      applyPush(m, p, r.rev, user.name);
      if (r.prev !== since) { applyPull(m, await transport.pull(since)); }   // someone else wrote in between: take it too
      await flushFiles();
    },
    async refresh() {
      const p = await transport.pull(m.rev);
      const changed = p.moves.length || Object.values(p.coll).some((x) => x.length) || Object.keys(p.meta).length;
      if (!changed) { m.rev = Math.max(m.rev, p.rev); return null; }
      applyPull(m, p); return toLovable(m);
    },
    queueFile(owner, kind, file) { pending.push({ owner, kind, file }); },
    files: () => [...m.files],
    async fileUrl(path) {
      const direct = /^srvfile:(\d+)$/.exec(path); if (direct) return `/api/files/${direct[1]}`;
      const docs = [...m.rows.docs.values()] as { id: string; no?: string }[];
      const pick = (ownerType: string, ownerId: string, kind: string) => m.files.filter((f) => f.ownerType === ownerType && String(f.ownerId) === ownerId && f.kind === kind).at(-1);
      let f: ServerFile | undefined;
      const cancel = /^documents\/cancel-(.+)\.jpg$/.exec(path);
      if (cancel) f = pick('order', cancel[1], 'cancel');
      else {
        const no = /^documents\/(.+?)(?:-signed|-\d+)?\.jpg$/.exec(path)?.[1];
        const d = no ? docs.find((x) => x.no === no) : undefined;
        if (d) f = pick('doc', String(d.id), 'doc_photo');
      }
      return f ? `/api/files/${f.id}${f.hasThumb ? '?thumb=1' : ''}` : null;
    },
  };
}

export { docPhotoPath };
