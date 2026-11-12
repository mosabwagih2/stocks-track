/**
 * Two-way bridge between the server's data (the PHP + MySQL edition, written by the original "Brand 2" app: state v3)
 * and this app's state (v2).
 *
 *  - The server is the only source of truth. `Mirror` is an exact copy of what it holds, row by row.
 *  - `toLovable(mirror)` builds the app's state from it.
 *  - `toPush(state, mirror)` computes what changed as server rows, ready for POST /api/sync/push.
 *
 * Rows are never rebuilt from scratch: a changed row starts from the server's row and only the fields the app changed
 * are written, so fields this app does not know (Brand 2 history, sheets, logs) are kept. Rows this app does not use
 * (old pickups `oldOrd`, employees `emps`, drafts of other types) are never touched.
 * The guarantee, checked on the live data: toPush(toLovable(m), m) is empty.
 */
import seed from '../seed.json';
import type { DayClose, Doc, Move, OpDraft, Order, OriginalFile, Pickup, Sku, Supply, SupplyEntry } from '@/femini/domain/types';
import type { Hold } from '@/femini/domain/holds';
import type { Settlement } from '@/femini/domain/settle';
import { cairoDay } from '@/femini/domain/dates';
import type { State } from '../memory';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** server collections: name -> key of a row */
export const COLLS = {
  docs: (r: Row) => String(r.id), orders: (r: Row) => String(r.ref), pickups: (r: Row) => String(r.id),
  sup_items: (r: Row) => String(r.id), sup_log: (r: Row) => String(r.id), closes: (r: Row) => String(r.id),
  shops: (r: unknown) => String(r), emps: (r: unknown) => String(r), archPk: (r: Row) => String(r.p?.id),
  archDocs: (r: Row) => String(r.d?.id), oldOrd: (r: Row) => String(r.ref), holds: (r: Row) => String(r.no),
  settles: (r: Row) => String(r.id),
} as const;
export type Coll = keyof typeof COLLS;
export const META_KEYS = ['mid', 'did', 'seq', 'sup_eid', 'bk', 'st', 'costs', 'alias', 'img', 'cat', 'lock'] as const;

export interface ServerFile { id: number; kind: string; ownerType: string; ownerId: string; name: string; mime: string; size: number; hasThumb: boolean; uploadedAt: string; key?: string }
export interface Mirror {
  rev: number;
  moves: Row[];
  moveIds: Set<number>;
  /** live rows per collection, in the server's order */
  rows: Record<Coll, Map<string, Row | string>>;
  meta: Record<string, unknown>;
  files: ServerFile[];
}

// ------------------------------------------------------------------ pull -> mirror

interface Pulled { rev: number; moves: Row[]; coll: Record<string, { k: string; row: unknown; gone: boolean }[]>; meta: Record<string, { v: unknown }> }
export function emptyMirror(): Mirror {
  return { rev: 0, moves: [], moveIds: new Set(), rows: Object.fromEntries(Object.keys(COLLS).map((c) => [c, new Map()])) as Mirror['rows'], meta: {}, files: [] };
}
/** applies a pull (since=0 for everything, or an increment) to the mirror */
export function applyPull(m: Mirror, p: Pulled): Mirror {
  for (const mv of p.moves ?? []) if (!m.moveIds.has(mv.id)) { m.moves.push(mv); m.moveIds.add(mv.id); }
  m.moves.sort((a, b) => a.id - b.id);
  for (const [name, rows] of Object.entries(p.coll ?? {})) {
    const map = m.rows[name as Coll]; if (!map) continue;
    for (const r of rows) { if (r.gone) map.delete(String(r.k)); else map.set(String(r.k), r.row as Row); }
  }
  for (const [k, x] of Object.entries(p.meta ?? {})) m.meta[k] = x.v;
  m.rev = Math.max(m.rev, p.rev ?? 0);
  return m;
}

/** The server embeds the whole state in the page (window.FEM_BOOT, built by Snapshot.php): turn it into a mirror. */
export interface Boot { rev: number; csrf?: string; /** changes on every restore from a backup */ epoch?: string; user?: { id: string; name: string; role: string; perms?: string[] }; state: Row; files?: ServerFile[]; empty?: boolean }
export function mirrorFromBoot(b: Boot): Mirror {
  const m = emptyMirror(); const s = b.state ?? {};
  const lists: Record<Coll, unknown[]> = {
    docs: s.docs ?? [], orders: s.orders ?? [], pickups: s.pickups ?? [], sup_items: s.sup?.items ?? [], sup_log: s.sup?.log ?? [], closes: s.closes ?? [],
    shops: s.shops ?? [], emps: s.emps ?? [], archPk: s.archPk ?? [], archDocs: s.archDocs ?? [], oldOrd: s.oldOrd ?? [], holds: s.holds ?? [], settles: s.settles ?? [],
  };
  for (const c of Object.keys(COLLS) as Coll[]) for (const r of lists[c]) m.rows[c].set(COLLS[c](r as Row), r as Row);
  for (const mv of s.moves ?? []) { m.moves.push(mv); m.moveIds.add(mv.id); }
  m.moves.sort((a, b) => a.id - b.id);
  const meta: Record<string, unknown> = { mid: s.mid, did: s.did, seq: s.seq, sup_eid: s.sup?.eid, bk: s.bk, st: s.st, costs: s.costs, alias: s.alias, img: s.img, cat: s.cat, lock: s.lock };
  for (const [k, v] of Object.entries(meta)) if (v !== undefined) m.meta[k] = v;
  m.rev = b.rev ?? 0; m.files = b.files ?? [];
  return m;
}

// ------------------------------------------------------------------ helpers

const iso = (ms: unknown): string => new Date(typeof ms === 'number' ? ms : Date.parse(String(ms))).toISOString();
const ms = (s: string | null | undefined): number => (s ? Date.parse(s) : Date.now());
const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));
export const same = (a: unknown, b: unknown) => canon(a) === canon(b);
const DRAFTABLE = ['RCV', 'RTN', 'SRT', 'SHP', 'CLN', 'FSD', 'FRC', 'CNT', 'LOS', 'SWP'];
const isOwnedDoc = (d: Row) => d.status !== 'draft' || DRAFTABLE.includes(String(d.type));
const isOwnedArchDoc = (a: Row) => DRAFTABLE.includes(String(a.d?.type));

/** Starts from the server row and re-applies only the field groups whose app value changed. */
function patch<L>(orig: Row | undefined, origL: L | undefined, next: L, groups: [(keyof L)[], (row: Row, next: L) => void][]): Row {
  const row: Row = orig ? structuredClone(orig) : {};
  for (const [keys, apply] of groups) if (!orig || !origL || keys.some((k) => !same(origL[k], next[k]))) apply(row, next);
  return row;
}

// ------------------------------------------------------------------ entities: server -> app

export const moveL = (m: Row): Move => ({ id: m.id, ts: iso(m.t), date: m.date, sku: m.sku, qty: m.q, from: m.from, to: m.to, type: m.type, doc: m.doc, by: m.by, note: m.note ?? '' });
const moveV = (m: Move): Row => ({ id: m.id, t: ms(m.ts), date: m.date, sku: m.sku, q: m.qty, from: m.from, to: m.to, type: m.type, doc: m.doc, by: m.by, note: m.note });

export function orderL(o: Row): Order {
  const sc = o.sc, cx = o.cx, rt = o.rt;
  return {
    ref: String(o.ref), waybill: String(o.wb ?? ''), type: String(o.type ?? '').includes('استبدال') ? 'exchange' : 'new', gov: String(o.gov ?? ''), total: Number(o.total) || 0,
    lines: Array.isArray(o.lines) ? o.lines.slice() : [], unmapped: Array.isArray(o.bad) ? structuredClone(o.bad) : [], pickupId: String(o.pk ?? ''),
    status: o.st === 'done' ? 'shipped' : o.st === 'cx' ? 'cancelled' : 'open',
    shippedBy: sc ? String(sc.by ?? '') : null, shippedAt: sc ? iso(sc.at) : null, shipDoc: sc ? String(sc.doc ?? '') : null,
    cancel: cx ? { at: iso(cx.at), by: String(cx.by ?? ''), reason: String(cx.reason ?? ''), was: cx.was === 'done' ? 'shipped' : 'open', returned: !!cx.returned, doc: cx.doc ? String(cx.doc) : null, attachment: `documents/cancel-${String(o.ref)}.jpg` } : null,
    returned: rt ? { doc: String(rt.doc ?? ''), at: `${rt.date}T10:00:00.000Z` } : null,
  };
}
const ORDER_GROUPS: [(keyof Order)[], (row: Row, o: Order) => void][] = [
  [['ref'], (r, o) => { r.ref = o.ref; }],
  [['waybill'], (r, o) => { r.wb = o.waybill; }],
  [['type'], (r, o) => { r.type = o.type === 'exchange' ? 'استبدال' : 'جديد'; }],
  [['gov'], (r, o) => { r.gov = o.gov; }],
  [['total'], (r, o) => { r.total = o.total; }],
  [['lines'], (r, o) => { r.lines = o.lines.slice(); }],
  [['pickupId'], (r, o) => { r.pk = o.pickupId; }],
  [['status'], (r, o) => { r.st = o.status === 'shipped' ? 'done' : o.status === 'cancelled' ? 'cx' : 'open'; }],
  [['shippedBy', 'shippedAt', 'shipDoc'], (r, o) => { r.sc = o.shipDoc ? { ...(r.sc && r.sc.doc === o.shipDoc ? r.sc : {}), by: o.shippedBy ?? '', at: ms(o.shippedAt), date: cairoDay(o.shippedAt ?? new Date().toISOString()), doc: o.shipDoc } : null; }],
  [['unmapped'], (r, o) => { r.bad = structuredClone(o.unmapped); }],
  [['cancel'], (r, o) => { const c = o.cancel; if (!c) { delete r.cx; return; } r.cx = { at: ms(c.at), date: cairoDay(c.at), by: c.by, reason: c.reason, was: c.was === 'shipped' ? 'done' : 'open', returned: c.returned, doc: c.doc ?? null }; }],
  [['returned'], (r, o) => { const t = o.returned; if (!t) { delete r.rt; return; } if (!(r.rt && r.rt.doc === t.doc)) r.rt = { doc: t.doc, date: cairoDay(t.at), exp: o.lines.length }; }],
];
export function orderV(o: Order, orig?: Row): Row {
  const row = patch(orig, orig ? orderL(orig) : undefined, o, ORDER_GROUPS);
  if (!orig) { row.sc ??= null; row.bad ??= []; }
  return row;
}

export const pickupL = (p: Row): Pickup => ({ id: String(p.id), label: String(p.label ?? ''), date: String(p.date), channel: String(p.channel ?? ''), source: String(p.src ?? '') });
export const pickupV = (p: Pickup, orig?: Row): Row => patch(orig, orig ? pickupL(orig) : undefined, p, [
  [['id'], (r, x) => { r.id = x.id; }], [['label'], (r, x) => { r.label = x.label; }], [['date'], (r, x) => { r.date = x.date; }],
  [['channel'], (r, x) => { r.channel = x.channel; }], [['source'], (r, x) => { r.src = x.source; }],
]);

/** confirmed (or reversed) document */
export function docL(d: Row, photoPath?: string): Doc {
  const hdr = { ...(d.hdr ?? {}) } as Record<string, unknown>;
  if (d.type === 'SCN') { hdr.employee = hdr.emp ?? d.by; hdr.source = hdr.src ?? ''; hdr.orders ??= Array.isArray(hdr.refs) ? (hdr.refs as unknown[]).length : undefined; }
  const lines = (Array.isArray(d.lines) ? d.lines : []).map((l: Row) => ({ sku: String(l.sku), qty: typeof l.q === 'number' ? l.q : (Number(l.r) || 0) + (Number(l.d) || 0) + (Number(l.x) || 0) }));
  return { no: String(d.no), type: String(d.type), date: String(d.date), by: String(d.by ?? ''), status: d.status === 'reversed' ? 'reversed' : 'done', hdr, lines, attachment: photoPath ?? null };
}
/** A confirmed document is frozen on the server: only its status (reversal), the employee name and the delivery proof may change. */
export function docV(x: Doc, orig: Row | undefined, ctx: { id: string; actor: string; now: number; nMoves: number }): Row {
  if (!orig) {
    const hdr = { ...x.hdr } as Record<string, unknown>;
    if (x.type === 'SCN') { hdr.emp = hdr.employee; hdr.src = hdr.source; }
    if (hdr.delivered === true) hdr.delivered = { at: ctx.now, date: cairoDay(new Date(ctx.now).toISOString()), by: ctx.actor };
    return { id: ctx.id, type: x.type, status: x.status, no: x.no, date: x.date, by: x.by, hdr, lines: x.lines.map((l) => ({ sku: l.sku, q: l.qty })), log: [{ t: ctx.now, by: ctx.actor, m: `اتأكدت وسجّلت ${ctx.nMoves} حركة` }], confirmedAt: ctx.now, nMoves: ctx.nMoves };
  }
  const row = structuredClone(orig); const before = docL(orig); const log = (m: string) => { row.log = [...(Array.isArray(row.log) ? row.log : []), { t: ctx.now, by: ctx.actor, m }]; };
  if (x.status !== before.status) { row.status = x.status; log(x.status === 'reversed' ? 'اتعكس المستند' : 'اتغيرت الحالة'); }
  if (x.type === 'SCN' && x.hdr.employee !== before.hdr.employee) { row.hdr = { ...row.hdr, emp: x.hdr.employee }; log(`اتعدّل اسم الموظف إلى ${String(x.hdr.employee)}`); }
  const note = typeof x.hdr._note === 'string' ? x.hdr._note : '';
  if (note && !(Array.isArray(row.log) ? row.log : []).some((l: Row) => l.m === note)) log(note);
  if (x.hdr.delivered && !before.hdr.delivered) { row.hdr = { ...row.hdr, delivered: { at: ctx.now, date: cairoDay(new Date(ctx.now).toISOString()), by: ctx.actor } }; log('اتأكد التسليم بالإذن الموقّع'); }
  return row;
}

export const draftL = (d: Row): OpDraft => ({ id: String(d.id), type: String(d.type), date: String(d.date), hdr: structuredClone(d.hdr ?? {}), lines: structuredClone(Array.isArray(d.lines) ? d.lines : []), updatedAt: iso(Array.isArray(d.log) && d.log.length ? d.log[d.log.length - 1].t : Date.parse(`${d.date}T10:00:00Z`)) });
export function draftV(x: OpDraft, orig: Row | undefined, ctx: { actor: string; now: number }): Row {
  if (!orig) return { id: x.id, type: x.type, status: 'draft', no: null, date: x.date, by: ctx.actor, hdr: structuredClone(x.hdr), lines: structuredClone(x.lines), log: [{ t: ctx.now, by: ctx.actor, m: 'اتفتحت مسودة' }] };
  return patch(orig, draftL(orig), x, [[['date'], (r, v) => { r.date = v.date; }], [['hdr'], (r, v) => { r.hdr = structuredClone(v.hdr); }], [['lines'], (r, v) => { r.lines = structuredClone(v.lines); }]]);
}

export const supplyL = (i: Row): Supply => ({ id: String(i.id), name: String(i.name ?? ''), unit: String(i.unit ?? ''), pack: Number(i.pack) || 1, packName: String(i.packName ?? ''), minAlert: Number(i.min) || 0, note: String(i.note ?? ''), archived: !!i.arch, ...(i.archBy ? { archivedBy: String(i.archBy) } : {}), rule: (i.auto ?? { kind: 'none' }) as Supply['rule'] });
export const supplyV = (s: Supply, orig?: Row): Row => patch(orig, orig ? supplyL(orig) : undefined, s, [
  [['id'], (r, v) => { r.id = v.id; }], [['name'], (r, v) => { r.name = v.name; }], [['unit'], (r, v) => { r.unit = v.unit; }], [['pack'], (r, v) => { r.pack = v.pack; }],
  [['packName'], (r, v) => { r.packName = v.packName; }], [['minAlert'], (r, v) => { r.min = v.minAlert; }], [['note'], (r, v) => { r.note = v.note; }],
  [['archived', 'archivedBy'], (r, v) => { r.arch = v.archived; if (v.archivedBy) r.archBy = v.archivedBy; else delete r.archBy; }], [['rule'], (r, v) => { r.auto = v.rule; }],
]);
const kindOf = (e: Row): SupplyEntry['kind'] => (e.kind ?? (e.doc ? (/عكس/.test(String(e.doc)) ? 'rev' : 'auto') : /افتتاحي/.test(String(e.why)) ? 'open' : Number(e.q) > 0 ? 'rcv' : 'count')) as SupplyEntry['kind'];
export const logL = (e: Row): SupplyEntry => ({ id: Number(e.id), date: String(e.date), item: String(e.item), qty: Number(e.q), kind: kindOf(e), why: String(e.why ?? ''), doc: e.doc ? String(e.doc) : null, by: String(e.by ?? ''), reversed: !!e.rev });
export const logV = (e: SupplyEntry, orig?: Row): Row => patch(orig, orig ? logL(orig) : undefined, e, [
  [['id'], (r, v) => { r.id = v.id; }], [['date'], (r, v) => { r.date = v.date; }], [['item'], (r, v) => { r.item = v.item; }], [['qty'], (r, v) => { r.q = v.qty; }],
  [['kind'], (r, v) => { r.kind = v.kind; }], [['why'], (r, v) => { r.why = v.why; }], [['doc'], (r, v) => { r.doc = v.doc; }], [['by'], (r, v) => { r.by = v.by; }], [['reversed'], (r, v) => { r.rev = v.reversed; }],
]);

export function closeL(c: Row): DayClose & { id: string } {
  const s = c.snap ?? {};
  return { id: String(c.id), date: String(c.date), at: iso(c.at), by: String(c.by ?? ''), auto: !!c.auto, status: c.status === 'reopened' ? 'reopened' : 'closed', summary: { requested: Number(s.pcsIn) || 0, shipped: Number(s.shipP) || 0, returned: Number(s.ret) || 0, received: Number(s.rcv) || 0, ready: Number(s.ready) || 0, damaged: Number(s.bad) || 0 }, ...(c.reopened?.at ? { reopenedAt: iso(c.reopened.at) } : {}) };
}
export function closeV(c: DayClose & { id?: string }, orig: Row | undefined, ctx: { id: string; actor: string }): Row {
  const L = (orig ? closeL(orig) : undefined) as (DayClose & { id?: string }) | undefined;
  return patch(orig, L, c, [
    [['date'], (r, v) => { r.id ??= ctx.id; r.date = v.date; }],
    [['at'], (r, v) => { r.at = ms(v.at); }],
    [['by', 'auto'], (r, v) => { r.auto = v.auto; r.by = v.auto ? 'تلقائي' : v.by; }],
    [['summary', 'report'], (r, v) => { r.snap = { date: v.date, ordIn: v.report?.requestedOrders ?? 0, pcsIn: v.summary.requested ?? 0, shipO: 0, shipP: v.summary.shipped ?? 0, ret: v.summary.returned ?? 0, rcv: v.summary.received ?? 0, bad: v.summary.damaged ?? 0, wash: 0, ready: v.summary.ready ?? 0 }; }],
    [['status', 'reopenedAt'], (r, v) => { r.status = v.status; if (v.status === 'reopened') r.reopened = { at: ms(v.reopenedAt ?? new Date().toISOString()), by: ctx.actor }; }],
  ]);
}

// catalog: server {skus:[{id,m,c,s,min,open}], models:[{code,name,colors,sizes}], colors, sizes, arch, names, ext, hex}
type Cat = State['cat'];
export function catL(c: Row | undefined): Cat {
  const x = c ?? {};
  return {
    skus: (x.skus ?? []).map((k: Row): Sku => ({ id: String(k.id), model: String(k.m), color: String(k.c), size: String(k.s), minAlert: Number(k.min) || 0 })),
    models: (x.models ?? []).map((m: Row) => ({ code: String(m.code), name: String(m.name ?? m.code) })),
    archived: { ...(x.arch ?? {}) }, names: { ...(x.names ?? {}) }, colors: (x.colors ?? []).map((k: Row) => ({ code: String(k.code), ar: String(k.ar) })), sizes: [...(x.sizes ?? [])],
    ...(x.bundles?.length ? { bundles: structuredClone(x.bundles) } : {}),
  };
}
export function catV(c: Cat, orig: Row | undefined): Row {
  const L = orig ? catL(orig) : undefined; const row: Row = orig ? structuredClone(orig) : { skus: [], models: [], colors: [], sizes: [], ext: {}, arch: {}, names: {}, hex: {} };
  if (!L || !same(L.skus, c.skus)) { const old = new Map((orig?.skus ?? []).map((k: Row) => [String(k.id), k])); row.skus = c.skus.map((k) => ({ ...(old.get(k.id) ?? { open: 0 }), id: k.id, m: k.model, c: k.color, s: k.size, min: k.minAlert })); }
  if (!L || !same(L.models, c.models)) { const old = new Map((orig?.models ?? []).map((m: Row) => [String(m.code), m])); row.models = c.models.map((m) => { const o = (old.get(m.code) ?? {}) as Row; const ks = c.skus.filter((k) => k.model === m.code); return { ...o, code: m.code, name: m.name, colors: o.colors ?? [...new Set(ks.map((k) => k.color))], sizes: o.sizes ?? [...new Set(ks.map((k) => k.size))] }; }); }
  if (!L || !same(L.archived, c.archived)) row.arch = { ...c.archived };
  if (!L || !same(L.names, c.names)) row.names = { ...c.names };
  if (!L || !same(L.colors, c.colors)) row.colors = c.colors.map((k) => ({ code: k.code, ar: k.ar }));
  if (!L || !same(L.sizes, c.sizes)) row.sizes = [...c.sizes];
  if (!same(L?.bundles ?? [], c.bundles ?? [])) row.bundles = structuredClone(c.bundles ?? []);
  return row;
}

// ------------------------------------------------------------------ whole state

/** where a document's photo / original lives in this app: "documents/<no>.jpg" (like the browser edition) */
export const docPhotoPath = (no: string) => `documents/${no}.jpg`;

export function toLovable(m: Mirror): State {
  const rows = <T,>(c: Coll) => [...m.rows[c].values()] as T[];
  const docRows = rows<Row>('docs');
  const photoOf = new Set(m.files.filter((f) => f.ownerType === 'doc' && f.kind === 'doc_photo').map((f) => f.ownerId));
  const log = rows<Row>('sup_log').map(logL);
  const meta = m.meta as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const S: State = {
    v: 2,
    mid: Math.max(Number(meta.mid) || 0, ...m.moves.map((x) => x.id + 1), 1),
    sid: Math.max(Number(meta.sup_eid) || 0, ...log.map((e) => e.id + 1), 1),
    moves: m.moves.map(moveL),
    pickups: rows<Row>('pickups').map(pickupL),
    orders: rows<Row>('orders').map(orderL),
    supplies: rows<Row>('sup_items').map(supplyL),
    log,
    docs: docRows.filter((d) => d.status !== 'draft').map((d) => docL(d, photoOf.has(String(d.id)) ? docPhotoPath(String(d.no)) : undefined)),
    seq: { ...(meta.seq ?? {}) },
    costs: structuredClone(meta.costs ?? {}),
    images: { ...(meta.img ?? {}) },
    cat: catL(meta.cat),
    drafts: docRows.filter((d) => d.status === 'draft' && DRAFTABLE.includes(String(d.type))).map(draftL),
    shops: rows<string>('shops').map(String),
    files: m.files.map((f): OriginalFile => ({ id: `srv-${f.id}`, owner: f.ownerType === 'doc' ? String((m.rows.docs.get(String(f.ownerId)) as Row | undefined)?.no ?? f.ownerId) : f.ownerId, kind: f.kind, name: f.name, mime: f.mime, size: f.size, at: new Date(f.uploadedAt.replace(' ', 'T') + 'Z').toISOString(), path: `srvfile:${f.id}` })),
    archivedPickups: rows<Row>('archPk').map((a) => ({ pickup: pickupL(a.p), orders: (a.orders ?? []).map(orderL), ...(a.by ? { by: String(a.by), at: String(a.at ?? '') } : {}) })),
    archivedDrafts: rows<Row>('archDocs').filter(isOwnedArchDoc).map((a) => ({ ...draftL(a.d), ...(a.by ? { archivedBy: String(a.by), archivedAt: iso(a.at) } : {}) })),
    closes: rows<Row>('closes').map(closeL),
    autoClose: meta.st ? meta.st.autoClose !== false : true,
    lastBackup: typeof meta.bk === 'number' ? new Date(meta.bk).toISOString() : undefined,
    holds: rows<Hold>('holds').map((h) => structuredClone(h)),
    settles: rows<Settlement>('settles').map((x) => structuredClone(x)),
    lock: typeof meta.lock === 'string' ? meta.lock : '',
    did: Number(meta.did) || 1,
  };
  return S;
}

export interface Push { moves: Row[]; coll: Partial<Record<Coll, { up: unknown[]; gone: string[] }>>; meta: Record<string, unknown> }
export const isEmpty = (p: Push) => !p.moves.length && !Object.values(p.coll).some((c) => c && (c.up.length || c.gone.length)) && !Object.keys(p.meta).length;

/** Everything the app state has that the server does not, as server rows. `actor` is the signed-in user's name. */
export function toPush(S: State, m: Mirror, actor: string, now = Date.now()): Push {
  const push: Push = { moves: [], coll: {}, meta: {} };
  const add = (c: Coll, up: unknown[], gone: string[]) => { if (up.length || gone.length) push.coll[c] = { up, gone }; };
  const sync = <X,>(c: Coll, items: X[], key: (x: X) => string, build: (x: X, orig: Row | undefined) => unknown, owned: (r: Row | string) => boolean = () => true) => {
    const map = m.rows[c]; const up: unknown[] = []; const seen = new Set<string>();
    for (const x of items) { const k = key(x); seen.add(k); const orig = map.get(k) as Row | undefined; const row = build(x, orig); if (!orig || !same(row, orig)) up.push(row); }
    const gone = [...map.entries()].filter(([k, r]) => !seen.has(k) && owned(r)).map(([k]) => k);
    add(c, up, gone);
  };

  // moves: append only
  for (const x of S.moves) if (!m.moveIds.has(x.id)) push.moves.push(moveV(x));

  // documents: confirmed ones by number, drafts by id; new ones get the next server id
  const byNo = new Map<string, Row>(); for (const r of m.rows.docs.values()) if ((r as Row).no) byNo.set(String((r as Row).no), r as Row);
  let did = Math.max(Number(m.meta.did) || 1, S.did ?? 1);
  const nMoves = (no: string) => S.moves.filter((x) => x.doc === no).length;
  const docUp: unknown[] = []; const seenDoc = new Set<string>();
  for (const d of S.docs) {
    const orig = byNo.get(d.no); const id = orig ? String(orig.id) : `d${did++}`; seenDoc.add(id);
    const row = docV(d, orig, { id, actor, now, nMoves: nMoves(d.no) }); if (!orig || !same(row, orig)) docUp.push(row);
  }
  for (const d of S.drafts ?? []) { const orig = m.rows.docs.get(d.id) as Row | undefined; seenDoc.add(d.id); const row = draftV(d, orig, { actor, now }); if (!orig || !same(row, orig)) docUp.push(row); }
  const docGone = [...m.rows.docs.entries()].filter(([k, r]) => !seenDoc.has(k) && isOwnedDoc(r as Row) && (r as Row).status === 'draft').map(([k]) => k);
  add('docs', docUp, docGone);

  sync('orders', S.orders, (o) => o.ref, (o, orig) => orderV(o, orig));
  sync('pickups', S.pickups, (p) => p.id, (p, orig) => pickupV(p, orig));
  sync('sup_items', S.supplies, (s) => s.id, (s, orig) => supplyV(s, orig));
  sync('sup_log', S.log, (e) => String(e.id), (e, orig) => logV(e, orig));
  sync('shops', S.shops ?? [], (s) => s, (s) => s);
  sync('holds', S.holds ?? [], (h) => h.no, (h) => structuredClone(h));
  sync('settles', S.settles ?? [], (x) => x.id, (x) => structuredClone(x));
  sync('archPk', S.archivedPickups ?? [], (a) => a.pickup.id, (a, orig) => ({ ...(orig ?? (a.by ? { by: a.by, at: a.at } : {})), p: pickupV(a.pickup, orig?.p), orders: a.orders.map((o) => orderV(o, (orig?.orders ?? []).find((x: Row) => x.ref === o.ref))) }));
  sync('archDocs', S.archivedDrafts ?? [], (d) => d.id, (d, orig) => (orig ?? { d: m.rows.docs.get(d.id) ?? draftV(d, undefined, { actor, now }), at: now, by: actor }), (r) => isOwnedArchDoc(r as Row));
  let cn = Math.max(0, ...[...m.rows.closes.keys()].map((k) => Number(String(k).replace(/\D/g, '')) || 0));
  sync('closes', (S.closes ?? []) as (DayClose & { id?: string })[], (c) => (c.id ??= `c${++cn}`), (c, orig) => closeV(c, orig, { id: c.id!, actor }));

  // single values
  const meta = m.meta as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const want: Record<string, unknown> = {
    mid: Math.max(Number(meta.mid) || 0, S.mid),
    did: did,
    seq: Object.fromEntries([...new Set([...Object.keys(meta.seq ?? {}), ...Object.keys(S.seq)])].map((k) => [k, Math.max(Number(meta.seq?.[k]) || 0, Number(S.seq[k]) || 0)])),
    sup_eid: Math.max(Number(meta.sup_eid) || 0, S.sid),
    costs: S.costs ?? {},
    img: S.images,
    cat: catV(S.cat, meta.cat),
    lock: S.lock ?? '',
    ...(S.lastBackup ? { bk: Date.parse(S.lastBackup) } : {}),
  };
  for (const [k, v] of Object.entries(want)) {
    const cur = meta[k];
    if (k === 'mid' && cur === undefined && !push.moves.length) continue;
    if (k === 'did' && (Number(cur) || 1) === v) continue;
    if (k === 'sup_eid' && (Number(cur) || 0) >= (v as number)) continue;
    if (k === 'lock' && (cur ?? '') === v) continue;
    if (k === 'costs' && same(cur ?? {}, v)) continue;
    if (k === 'img' && same(cur ?? {}, v)) continue;
    if (k === 'seq' && same(cur ?? {}, v)) continue;
    if (k === 'cat' && cur !== undefined && same(cur, v)) continue;
    if (k === 'cat' && cur === undefined && same(catL(undefined), S.cat)) continue;
    if (!same(cur, v)) push.meta[k] = v;
  }
  return push;
}

/** what the server holds after it accepted `p` at revision `rev` */
export function applyPush(m: Mirror, p: Push, rev: number, actor: string): Mirror {
  // the server writes every move under the signed-in user (only the opening balance keeps its author)
  for (const x of p.moves) { const mv: Row = { ...x, by: x.type === 'OPN' ? x.by : actor }; m.moves.push(mv); m.moveIds.add(Number(mv.id)); }
  for (const [c, ops] of Object.entries(p.coll) as [Coll, { up: Row[]; gone: string[] }][]) {
    const map = m.rows[c];
    for (const r of ops.up) map.set(COLLS[c](r), structuredClone(r));
    for (const k of ops.gone) map.delete(k);
  }
  for (const [k, v] of Object.entries(p.meta)) m.meta[k] = structuredClone(v);
  m.rev = rev;
  return m;
}

export const serverSeedSkus = seed.skus.length;

/** The whole server state in the original app's backup shape (state v3), from a full pull (since=0). */
export function stateFromPull(p: Pulled): Row {
  const live = (c: string) => (p.coll?.[c] ?? []).filter((r) => !r.gone).map((r) => r.row);
  const mv = (k: string) => p.meta?.[k]?.v;
  return {
    v: 3, moves: [...(p.moves ?? [])].sort((a, b) => a.id - b.id), mid: mv('mid'), docs: live('docs'), did: mv('did'), seq: mv('seq') ?? {},
    pickups: live('pickups'), orders: live('orders'), emps: live('emps'), sup: { log: live('sup_log'), items: live('sup_items'), eid: mv('sup_eid') },
    st: mv('st') ?? {}, costs: mv('costs') ?? {}, alias: mv('alias') ?? {}, img: mv('img') ?? {}, cat: mv('cat'), lock: mv('lock') ?? '', bk: mv('bk'),
    shops: live('shops'), closes: live('closes'), archPk: live('archPk'), archDocs: live('archDocs'), oldOrd: live('oldOrd'), holds: live('holds'), settles: live('settles'),
  };
}
