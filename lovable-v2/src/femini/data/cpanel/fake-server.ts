/**
 * TEST ONLY. An in-memory copy of the PHP server's sync rules (php-app/app/src/Sync/SyncService.php, Rules.php,
 * Collections.php, Auth/Permissions.php), line by line, INCLUDING the small additions this edition needs
 * (holds: EXT_HOLD / HLD, state change: MOV, and hold moves filed under the hold's number).
 * It lets every action of the app be pushed against the real rules with the live data, before anything reaches the server.
 */
import { COLLS, type Boot, type Coll, type ServerFile } from './v3';
import type { PullResult, PushReply, Transport } from './backend';
import { cairoToday } from '@/femini/domain/dates';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const LOCATIONS = ['READY', 'DIRTY', 'FACTORY', 'SCRAP', 'LOST', 'EXT_CH', 'EXT_SHOP', 'EXT_FACTORY', 'EXT_OPEN', 'EXT_ADJ', 'EXT_OFF', 'EXT_HOLD'];
const MOVE_TYPES = ['RCV', 'RTN', 'SCN', 'SHP', 'CLN', 'FSD', 'FRC', 'CNT', 'LOS', 'CXL', 'OPN', 'SWP', 'HLD', 'MOV'];
export const DOC_PERM: Record<string, string> = { SCN: 'scan', RTN: 'returns', RCV: 'receive', FRC: 'internal', FSD: 'internal', CLN: 'internal', LOS: 'internal', SHP: 'ship', CNT: 'count', CXL: 'cancel', SWP: 'count', HLD: 'internal', MOV: 'internal' };
const META_PERM: Record<string, string | null> = { mid: null, did: null, seq: null, sup_eid: null, bk: null, st: 'settings', costs: 'settings', alias: 'catalog', img: 'catalog', cat: 'catalog', lock: 'close' };
const COUNTERS = ['mid', 'did', 'sup_eid'];
const DOC_MUTABLE_HDR = ['delivered', 'file', 'shpRecv', 'emp'];
const DOC_MUTABLE_TOP = ['log', 'photo'];

class HttpError extends Error { constructor(public status: number, public code: string, msg: string) { super(msg); } }
const encode = (v: unknown) => JSON.stringify(v);
const sortKeys = (v: unknown): unknown => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v as Row).sort().map((k) => [k, sortKeys((v as Row)[k])])) : v);
const core = (d: Row) => { const hdr = { ...(d.hdr ?? {}) }; for (const k of DOC_MUTABLE_HDR) delete hdr[k]; const c = { ...d }; for (const k of DOC_MUTABLE_TOP) delete c[k]; c.hdr = hdr; return encode(sortKeys(c)); };

interface Stored { payload: string; gone: boolean; rev: number; ord: number }
export interface FakeUser { id: string; name: string; role: string; perms: string[] }

export function createFakeServer(boot: Boot, user: FakeUser) {
  let rev = boot.rev || 1;
  let moves: Row[] = (boot.state.moves ?? []).map((m: Row) => ({ ...m, rev: 1 }));
  let rows: Record<Coll, Map<string, Stored>> = Object.fromEntries(Object.keys(COLLS).map((c) => [c, new Map()])) as Record<Coll, Map<string, Stored>>;
  let meta = new Map<string, { v: string; rev: number }>();
  const s = boot.state;
  const lists: Record<Coll, unknown[]> = { docs: s.docs ?? [], orders: s.orders ?? [], pickups: s.pickups ?? [], sup_items: s.sup?.items ?? [], sup_log: s.sup?.log ?? [], closes: s.closes ?? [], shops: s.shops ?? [], emps: s.emps ?? [], archPk: s.archPk ?? [], archDocs: s.archDocs ?? [], oldOrd: s.oldOrd ?? [], holds: s.holds ?? [] };
  for (const c of Object.keys(COLLS) as Coll[]) lists[c].forEach((r, i) => rows[c].set(COLLS[c](r as Row), { payload: encode(r), gone: false, rev: 1, ord: i + 1 }));
  for (const [k, v] of Object.entries({ mid: s.mid, did: s.did, seq: s.seq, sup_eid: s.sup?.eid, bk: s.bk, st: s.st, costs: s.costs, alias: s.alias, img: s.img, cat: s.cat, lock: s.lock })) if (v !== undefined) meta.set(k, { v: encode(v), rev: 1 });
  const files: ServerFile[] = [...(boot.files ?? [])];

  const can = (p: string) => user.role === 'admin' || user.perms.includes(p);
  const need = (p: string) => { if (!can(p)) throw new HttpError(403, 'forbidden', `دورك مش بيسمح بالإجراء ده (${p}).`); };
  const lockDate = () => { const x = meta.get('lock'); return x ? String(JSON.parse(x.v) ?? '') : ''; };

  function push(body: Row): PushReply {
    // transaction: work on copies, keep them only if everything passes
    const M = moves.map((m) => ({ ...m })); const R = Object.fromEntries(Object.entries(rows).map(([c, m]) => [c, new Map(m)])) as typeof rows; const ME = new Map(meta);
    try {
      const since = Math.max(0, Number(body.since) || 0); const prev = rev; const nrev = prev + 1; const lock = lockDate(); const today = cairoToday();
      const conflicts: unknown[] = []; let changed = 0; const newMoves: Row[] = []; const pushedOrders: Row[] = []; const pushedHolds = new Set<string>();
      const openDay = (date: string) => { if (lock && date && date <= lock) throw new HttpError(409, 'day_locked', `اليوم ${date} مقفول.`); };
      const actorField = (by: unknown, old: unknown) => { if (by == null || by === old) return; if (by !== user.name && !['النظام', 'تلقائي'].includes(String(by))) throw new HttpError(403, 'forged_actor', 'اسم المنفّذ لازم يكون اسمك.'); };
      // moves
      for (const m of (body.moves ?? []) as Row[]) {
        const type = String(m.type ?? '');
        if (!MOVE_TYPES.includes(type)) throw new HttpError(422, 'bad_move', `نوع حركة غير معروف: ${type}`);
        if (type === 'OPN') { if (user.role !== 'admin') throw new HttpError(403, 'forbidden', 'OPN admin'); } else need(DOC_PERM[type]);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(m.date))) throw new HttpError(422, 'bad_move', 'تاريخ الحركة غلط.');
        if (type !== 'OPN') openDay(m.date);
        for (const f of ['from', 'to']) if (!LOCATIONS.includes(m[f])) throw new HttpError(422, 'bad_move', `مكان الحركة غلط: ${m[f]}`);
        if (!Number.isInteger(m.id) || m.id < 1 || !Number.isInteger(m.q) || m.q === 0 || Math.abs(m.q) > 1e6 || typeof m.sku !== 'string' || !/^[A-Za-z0-9_.-]{1,40}$/.test(m.sku) || typeof m.doc !== 'string' || m.doc.length > 40) throw new HttpError(422, 'bad_move', `بيانات الحركة ناقصة أو غلط: ${encode(m)}`);
        const dup = M.find((x) => x.id === m.id);
        if (dup) { if (!(dup.sku === m.sku && dup.q === m.q && dup.from === m.from && dup.to === m.to && dup.doc === m.doc)) conflicts.push({ coll: 'moves', k: m.id }); continue; }
        M.push({ ...m, by: type === 'OPN' ? m.by : user.name, rev: nrev }); changed++;
        if (type !== 'OPN') newMoves.push({ doc: m.doc, type, date: m.date });
      }
      // collections
      for (const [name, ops] of Object.entries((body.coll ?? {}) as Record<string, { up?: Row[]; gone?: string[] }>)) {
        if (!(name in COLLS)) throw new HttpError(422, 'bad_collection', 'Unknown collection.');
        const map = R[name as Coll]; let nextOrd = Math.max(0, ...[...map.values()].map((x) => x.ord)) + 1;
        for (const row of ops.up ?? []) {
          const key = COLLS[name as Coll](row); if (!key || key === 'undefined' || key.length > 80) throw new HttpError(422, 'bad_row', `Row in ${name} has no valid key.`);
          const payload = encode(row); const ex = map.get(key);
          if (ex && ex.rev > since) { if (ex.payload !== payload || ex.gone) conflicts.push({ coll: name, k: key }); continue; }
          if (ex && ex.payload === payload && !ex.gone) continue;
          const old = ex ? JSON.parse(ex.payload) : null;
          if (name === 'docs') checkDoc(row, old, { need, can, actorField, openDay, user });
          else if (name === 'orders') { if (!['scan', 'cancel', 'returns', 'pickup', 'receive'].some(can)) throw new HttpError(403, 'forbidden', 'orders'); pushedOrders.push(JSON.parse(payload)); }
          else if (name === 'pickups') need('pickup');
          else checkRows(name, row, old, { need, can, actorField, today });
          if (name === 'holds') pushedHolds.add(key);
          map.set(key, { payload, gone: false, rev: nrev, ord: ex ? ex.ord : nextOrd++ }); changed++;
        }
        for (const key of ops.gone ?? []) {
          const ex = map.get(key); if (!ex || ex.gone) continue;
          if (ex.rev > since) { conflicts.push({ coll: name, k: key }); continue; }
          const old = JSON.parse(ex.payload);
          if (name === 'docs') { if (['done', 'reversed'].includes(old.status)) throw new HttpError(409, 'immutable', 'المستند المؤكد مش بيتأرشف.'); }
          else if (name === 'orders') { if (!['scan', 'cancel', 'returns', 'pickup', 'receive'].some(can)) throw new HttpError(403, 'forbidden', 'orders'); }
          else if (name === 'pickups') need('pickup');
          else checkRows(name, old, old, { need, can, actorField, today });
          map.set(key, { ...ex, gone: true, rev: nrev }); changed++;
        }
      }
      // meta
      for (const [key, v] of Object.entries((body.meta ?? {}) as Row)) {
        if (!(key in META_PERM)) throw new HttpError(422, 'bad_meta', `Unknown setting: ${key}`);
        const json = encode(v); const ex = ME.get(key);
        if (ex && ex.rev > since) { if (ex.v !== json) conflicts.push({ coll: 'meta', k: key }); continue; }
        if (ex && ex.v === json) continue;
        const old = ex ? JSON.parse(ex.v) : null;
        if (key === 'lock') { const isAuto = typeof v === 'string' && v < today && String(old ?? '') <= v; if (!isAuto) need('close'); }
        else {
          if (META_PERM[key]) need(META_PERM[key]!);
          if (COUNTERS.includes(key) && (!Number.isInteger(v) || (old !== null && (v as number) < old))) throw new HttpError(409, 'counter_back', `العداد ${key} ما ينفعش يرجع لورا.`);
          if (key === 'seq') for (const [p, n] of Object.entries((old ?? {}) as Row)) if (((v as Row)?.[p] ?? 0) < n) throw new HttpError(409, 'counter_back', 'ترقيم المستندات ما ينفعش يرجع لورا.');
        }
        ME.set(key, { v: json, rev: nrev }); changed++;
      }
      // every new move belongs to a document confirmed in this same push
      const groups: Record<string, Record<string, string[]>> = {};
      for (const m of newMoves) ((groups[m.doc] ??= {})[m.type] ??= []).push(m.date);
      for (const [doc, types] of Object.entries(groups)) {
        const failM = (why: string) => new HttpError(409, 'orphan_moves', `الحركات لازم تكون تابعة لمستند مؤكّد (${doc}): ${why}`);
        if (Object.keys(types).length !== 1) throw failM('رقم المستند مستخدم لنوعين');
        const type = Object.keys(types)[0]; const dates = types[type];
        if (type === 'CXL') { if (pushedOrders.some((o) => o.st === 'cx' && o.cx?.doc === doc)) continue; throw failM('مفيش أوردر ملغي بالرقم ده'); }
        if (type === 'HLD' && pushedHolds.has(doc)) continue;   // a hold's return / write-off: its hold record is updated in this push
        const isRev = doc.endsWith(' (عكس)'); const no = isRev ? doc.slice(0, -' (عكس)'.length) : doc;
        const ent = [...R.docs.values()].find((x) => !x.gone && JSON.parse(x.payload).no === no);
        const d = ent ? JSON.parse(ent.payload) : null;
        if (!d || d.type !== type || d.status !== (isRev ? 'reversed' : 'done') || ent!.rev !== nrev) throw failM('مفيش مستند مؤكّد بالرقم ده في نفس الحفظ');
        for (const dt of dates) if (!isRev && dt !== d.date) throw failM('تاريخ الحركة مش تاريخ المستند');
        const total = M.filter((x) => x.doc === doc).length;
        if (Number.isInteger(d.nMoves) && (isRev ? total > d.nMoves : d.nMoves !== total)) throw failM(`عدد الحركات (${total}) مش زي اللي المستند معلنه (${d.nMoves})`);
      }
      if (conflicts.length) throw Object.assign(new HttpError(409, 'stale', 'حد تاني عدّل نفس البيانات. اتحدّث البيانات.'), { conflicts });
      if (!changed) return { ok: true, rev: prev, prev };
      moves = M; rows = R; meta = ME; rev = nrev;
      return { ok: true, rev: nrev, prev };
    } catch (e) {
      if (e instanceof HttpError) return { ok: false, status: e.status, error: e.code, message: e.message };
      throw e;
    }
  }

  function pull(since: number): PullResult {
    const coll: PullResult['coll'] = {};
    for (const [c, map] of Object.entries(rows)) coll[c] = [...map.entries()].filter(([, x]) => x.rev > since).sort((a, b) => a[1].ord - b[1].ord).map(([k, x]) => ({ k, row: JSON.parse(x.payload), gone: x.gone }));
    const metaOut: PullResult['meta'] = {}; for (const [k, x] of meta) if (x.rev > since) metaOut[k] = { v: JSON.parse(x.v) };
    return { rev, moves: moves.filter((m) => m.rev > since).map(({ rev: _r, ...m }) => m), coll, meta: metaOut };
  }

  const transport: Transport = {
    pull: async (since) => structuredClone(pull(since)),
    push: async (body) => push(structuredClone(body)),
    upload: async (file, name, kind, ownerType, ownerId) => { const f: ServerFile = { id: files.length + 1000, kind, ownerType, ownerId, name, mime: file.type || 'image/jpeg', size: file.size, hasThumb: kind === 'doc_photo', uploadedAt: '2026-11-08 10:00:00' }; files.push(f); return f; },
  };
  return { transport, pull, push, files, get rev() { return rev; }, user, bootNow: (): Boot => ({ rev, csrf: 'x', user, files: [...files], state: stateFromRows() }) };

  /** the page boot as Snapshot.php builds it from the tables */
  function stateFromRows(): Row {
    const live = (c: Coll) => [...rows[c].values()].filter((x) => !x.gone).sort((a, b) => a.ord - b.ord).map((x) => JSON.parse(x.payload));
    const mv = (k: string) => (meta.has(k) ? JSON.parse(meta.get(k)!.v) : undefined);
    return { v: 3, moves: moves.map(({ rev: _r, ...m }) => m).sort((a, b) => a.id - b.id), mid: mv('mid'), docs: live('docs'), did: mv('did'), seq: mv('seq') ?? {}, pickups: live('pickups'), orders: live('orders'), emps: live('emps'), sup: { log: live('sup_log'), items: live('sup_items'), eid: mv('sup_eid') }, st: mv('st') ?? {}, costs: mv('costs') ?? {}, alias: mv('alias') ?? {}, img: mv('img') ?? {}, cat: mv('cat'), lock: mv('lock') ?? '', bk: mv('bk'), shops: live('shops'), closes: live('closes'), archPk: live('archPk'), archDocs: live('archDocs'), oldOrd: live('oldOrd'), holds: live('holds') };
  }
}

function checkDoc(doc: Row, existing: Row | null, x: { need: (p: string) => void; can: (p: string) => boolean; actorField: (b: unknown, o: unknown) => void; openDay: (d: string) => void; user: FakeUser }) {
  const type = String(doc.type ?? ''); const perm = DOC_PERM[type];
  if (!perm) throw new HttpError(422, 'bad_doc', `نوع مستند غير معروف: ${type}`);
  const oldLog = new Set(((existing?.log ?? []) as unknown[]).map(encode));
  for (const e of (doc.log ?? []) as Row[]) if (!oldLog.has(encode(e))) x.actorField(e.by, null);
  const status = String(doc.status ?? ''); const isAdmin = x.user.role === 'admin';
  const allowed = isAdmin || (existing?.status === 'done' && x.can(perm)) ? ['draft', 'done', 'reversed'] : ['draft', 'done'];
  if (!allowed.includes(status)) throw new HttpError(422, 'bad_doc', 'حالة المستند غير مسموحة.');
  if (!existing) { x.need(perm); if (doc.by !== x.user.name) throw new HttpError(403, 'forged_actor', 'اسم منفّذ المستند لازم يكون اسمك.'); if (status === 'done') x.openDay(String(doc.date ?? '')); return; }
  if (existing.status === 'done' && status === 'reversed' && (isAdmin || x.can(perm))) { if (core({ ...existing, status: 'reversed' }) === core(doc)) return; }
  if (['done', 'reversed'].includes(existing.status)) { if (status !== existing.status || core(existing) !== core(doc)) throw new HttpError(409, 'immutable', `المستند اتأكد ومش بيتعدّل (${doc.no}).`); return; }
  x.need(perm); if (status === 'done') x.openDay(String(doc.date ?? ''));
}

function checkRows(coll: string, row: Row, old: Row | null, x: { need: (p: string) => void; can: (p: string) => boolean; actorField: (b: unknown, o: unknown) => void; today: string }) {
  if (['sup_log', 'closes'].includes(coll)) x.actorField(row.by, old?.by);
  if (coll === 'sup_items') x.need('supplies');
  else if (coll === 'sup_log') { if (!['supplies', 'scan'].some(x.can)) throw new HttpError(403, 'forbidden', 'sup_log'); }
  else if (coll === 'closes') { if (!row.auto) x.need('close'); else if (String(row.date ?? '') >= x.today) throw new HttpError(422, 'bad_close', 'القفل التلقائي لأيام فاتت بس.'); }
  else if (coll === 'shops') x.need('ship');
  else if (coll === 'archPk') x.need('pickup');
  else if (coll === 'holds') x.need('internal');
}
