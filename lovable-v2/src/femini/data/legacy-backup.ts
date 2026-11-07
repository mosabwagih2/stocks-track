import seed from './seed.json';
import { validateBackup, type Backup } from './backup';
import { balancesFromMoves, qty } from '@/femini/domain/ledger';
import { LOCS } from '@/femini/domain/constants';
import type { Move, Order, Pickup, Sku, Supply, SupplyEntry, Doc, OpDraft } from '@/femini/domain/types';

type Rec = Record<string, unknown>;
const obj = (v: unknown): Rec => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('بيانات النسخة غير صالحة.'); return v as Rec; };
const list = (v: unknown): Rec[] => { if (!Array.isArray(v)) throw new Error('قائمة ناقصة في النسخة القديمة.'); return v.map(obj); };
const text = (v: unknown) => String(v ?? '');
const iso = (v: unknown) => { const d = new Date(typeof v === 'number' ? v : text(v)); if (!Number.isFinite(d.getTime())) throw new Error('وقت غير صالح في النسخة القديمة.'); return d.toISOString(); };
const day = (v: unknown) => { const s = text(v); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || new Date(s).toISOString().slice(0, 10) !== s) throw new Error('تاريخ غير صالح في النسخة.'); return s; };
const num = (v: unknown) => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('كمية غير صالحة في النسخة.'); return v; };
const fingerprint = (m: Move) => JSON.stringify([m.ts, m.date, m.sku, m.qty, m.from, m.to, m.type, m.doc, m.by, m.note]);

function uniqueMoves(moves: Move[]) {
  const seen = new Map<number, Move>(); let duplicates = 0;
  for (const m of moves) {
    const previous = seen.get(m.id);
    if (previous) { if (fingerprint(previous) !== fingerprint(m)) throw new Error(`رقم الحركة ${m.id} مكرر ببيانات مختلفة؛ لا يمكن الاستيراد.`); duplicates++; }
    else seen.set(m.id, m);
  }
  return { moves: [...seen.values()], duplicates };
}
function pickup(p: Rec): Pickup { return { ...p, id: text(p.id), label: text(p.label), date: day(p.date), channel: text(p.channel), source: text(p.src) }; }
function order(o: Rec): Order {
  if (!['open', 'done', 'cx'].includes(text(o.st))) throw new Error(`حالة الأوردر ${o.ref} غير مدعومة.`);
  const sc = o.sc ? obj(o.sc) : null; const cx = o.cx ? obj(o.cx) : null;
  if (o.st === 'done' && !sc) throw new Error(`الأوردر ${o.ref} مشحون بدون بيانات شحن.`);
  if (!Array.isArray(o.lines) || !o.lines.every((x) => typeof x === 'string')) throw new Error('أصناف الأوردر غير صالحة.');
  const returned = o.rt ?? o.returned;
  return { ...o, ref: text(o.ref), waybill: text(o.wb), type: text(o.type).includes('استبدال') ? 'exchange' : 'new', gov: text(o.gov), total: Number(o.total) || 0, lines: o.lines as string[], unmapped: Array.isArray(o.bad) ? o.bad : [], pickupId: text(o.pk), status: o.st === 'done' ? 'shipped' : o.st === 'cx' ? 'cancelled' : 'open', shippedBy: sc ? text(sc.by) : null, shippedAt: sc ? iso(sc.at) : null, shipDoc: sc ? text(sc.doc) : null, cancel: cx ? { ...cx, at: iso(cx.at), by: text(cx.by), reason: text(cx.reason), was: cx.was === 'done' ? 'shipped' : 'open', returned: !!cx.returned, doc: text(cx.doc) || null, attachment: `legacy/cx_${text(o.ref)}` } : null, returned: returned ? { doc: text(obj(returned).doc), at: obj(returned).at ? iso(obj(returned).at) : `${day(obj(returned).date)}T12:00:00Z` } : null };
}
function draft(d: Rec): OpDraft { return { id: text(d.id), type: text(d.type), date: day(d.date), hdr: d.hdr ? obj(d.hdr) : {}, lines: Array.isArray(d.lines) ? d.lines as Rec[] : [], updatedAt: d.at ? iso(d.at) : `${day(d.date)}T12:00:00Z` }; }

export interface ImportPreview {
  backup: Backup; duplicates: number; overlap: number; legacy: boolean;
  balances: { sku: string; loc: (typeof LOCS)[number]; source: number; imported: number; current: number }[];
  warnings: string[];
}
export function previewBackup(value: unknown, current: Move[]): ImportPreview {
  const raw = obj(value); const legacy = raw.app === 'femini-stock'; let duplicates = 0; let backup: Backup;
  const warnings: string[] = [];
  if (legacy) {
    const s = obj(raw.state); if (s.v !== 3) throw new Error('إصدار النسخة القديمة غير مدعوم؛ المطلوب الإصدار 3.');
    const originalMoves: Move[] = list(s.moves).map((m) => ({ ...m, id: num(m.id), ts: iso(m.t), date: day(m.date), sku: text(m.sku), qty: num(m.q), from: text(m.from) as Move['from'], to: text(m.to) as Move['to'], type: text(m.type), doc: text(m.doc), by: text(m.by), note: text(m.note) }));
    const dedup = uniqueMoves(originalMoves); duplicates = dedup.duplicates;
    const cat = s.cat ? obj(s.cat) : {}; const sup = obj(s.sup); const photos = raw.photos ? obj(raw.photos) : {};
    const skus: Sku[] = list(cat.skus ?? []).map((k) => ({ ...k, id: text(k.id), model: text(k.m), color: text(k.c), size: text(k.s), minAlert: Number(k.min) || 0 }));
    const catalogIds = new Set([...seed.skus.map((k) => k.id), ...skus.map((k) => k.id)]);
    const unknown = dedup.moves.filter((m) => !catalogIds.has(m.sku)); if (unknown.length) throw new Error(`النسخة تحتوي ${new Set(unknown.map((m) => m.sku)).size} صنف غير معروف؛ راجع كتالوج النسخة قبل الاستيراد.`);
    const docs: Doc[] = list(s.docs).filter((d) => d.status !== 'draft').map((d) => ({ ...d, no: text(d.no), type: text(d.type), date: day(d.date), by: text(d.by), status: d.status === 'reversed' ? 'reversed' : 'done', hdr: { ...(d.hdr ? obj(d.hdr) : {}), employee: d.hdr ? obj(d.hdr).emp : '', source: d.hdr ? obj(d.hdr).src : '' }, lines: list(d.lines ?? []).map((l) => ({ sku: text(l.sku), qty: Number(l.q) || 0 })), attachment: photos[text(d.id)] ? `legacy/${text(d.id)}` : null }));
    const supplies: Supply[] = list(sup.items).map((i) => ({ ...i, id: text(i.id), name: text(i.name), unit: text(i.unit), pack: Number(i.pack) || 1, packName: text(i.packName), minAlert: Number(i.min) || 0, note: text(i.note), archived: !!i.arch, rule: (i.auto ?? { kind: 'none' }) as Supply['rule'] }));
    const log: SupplyEntry[] = list(sup.log).map((e, i) => ({ ...e, id: typeof e.id === 'number' ? e.id : i + 1, date: day(e.date), item: text(e.item), qty: num(e.q), kind: (e.kind ?? (e.doc ? (/عكس/.test(text(e.doc)) ? 'rev' : 'auto') : /افتتاحي/.test(text(e.why)) ? 'open' : Number(e.q) > 0 ? 'rcv' : 'count')) as SupplyEntry['kind'], why: text(e.why), doc: text(e.doc) || null, by: text(e.by), reversed: !!e.rev }));
    if (new Set(log.map((e) => e.id)).size !== log.length) throw new Error('أرقام حركات المستلزمات مكررة؛ راجع النسخة.');
    const media: Record<string, string> = {}; for (const [key, data] of Object.entries(photos)) { if (typeof data !== 'string' || !/^data:[^;]+;base64,/.test(data)) throw new Error(`مرفق غير صالح: ${key}`); media[`legacy/${key}`] = data; }
    const seq: Record<string, number> = { ...(s.seq ? obj(s.seq) : {}) } as Record<string, number>;
    for (const m of dedup.moves) { const match = /^([A-Z]+)-(\d+)/.exec(m.doc); if (match) seq[match[1]] = Math.max(seq[match[1]] || 0, Number(match[2])); }
    const at = iso(raw.at);
    const convertible = (d: Rec) => ['RCV','RTN','SHP','CLN','FSD','FRC','CNT','LOS','SWP'].includes(text(d.type));
    const allDrafts = list(s.docs).filter((d) => d.status === 'draft');
    if (allDrafts.some((d) => !convertible(d))) warnings.push('مسودات الشحن القديمة محفوظة في النسخة الأصلية فقط؛ أكملها عبر رفع ملف الإسكان بعد الاستيراد.');
    const closes = list(s.closes ?? []).map((c) => { const sm = c.snap ? obj(c.snap) : {}; return { ...c, date: day(c.date), at: iso(c.at), by: text(c.by), auto: !!c.auto, status: c.status === 'reopened' ? 'reopened' : 'closed', summary: { requested: Number(sm.pcsIn) || 0, shipped: Number(sm.shipP) || 0, returned: Number(sm.ret) || 0, received: Number(sm.rcv) || 0, ready: Number(sm.ready) || 0, damaged: Number(sm.bad) || 0 } }; });
    backup = validateBackup({ app: 'femini-stock-dashboard', version: 1, at, media, state: { v: 2, moves: dedup.moves, mid: dedup.moves.reduce((max,m) => Math.max(max,m.id),0) + 1, sid: log.reduce((max,e) => Math.max(max,e.id),0) + 1, docs, orders: list(s.orders).map(order), pickups: list(s.pickups).map(pickup), supplies, log, seq, images: s.img ?? {}, costs: s.costs ?? {}, cat: { skus, models: list(cat.models ?? []).map((m) => ({ ...m, code: text(m.code), name: text(m.name) })), archived: cat.arch ?? {}, names: cat.names ?? {}, colors: cat.colors ?? [], sizes: cat.sizes ?? [] }, drafts: allDrafts.filter(convertible).map(draft), archivedPickups: list(s.archPk ?? []).map((a) => ({ pickup: pickup(obj(a.p)), orders: list(a.orders).map(order) })), archivedDrafts: list(s.archDocs ?? []).map((a) => obj(a.d)).filter(convertible).map(draft), shops: Array.isArray(s.shops) ? s.shops.filter((x) => typeof x === 'string') : [], closes, autoClose: s.st ? obj(s.st).autoClose !== false : true, lastBackup: at, legacyOriginal: raw } });
    warnings.push('حسابات الموظفين وصلاحيات النظام القديم غير مفعّلة هنا؛ النسخة الأصلية محفوظة ضمن بيانات الاسترجاع.', 'التقارير تعرض تكلفة الموديل المسجلة حاليًا، وليست تكلفة تاريخية.');
  } else {
    const s = obj(raw.state); const dedup = uniqueMoves(list(s.moves) as unknown as Move[]); duplicates = dedup.duplicates;
    backup = validateBackup({ ...raw, state: { ...s, moves: dedup.moves } });
  }
  const imported = backup.state.moves as Move[];
  const knownSkus = new Set([...seed.skus.map((k) => k.id), ...list(obj(backup.state.cat).skus).map((k) => text(k.id))]);
  const pickups = backup.state.pickups as Pickup[];
  if (new Set(pickups.map((p) => p.id)).size !== pickups.length) throw new Error('أرقام البيك أب مكررة في النسخة.');
  const pickupIds = new Set(pickups.map((p) => p.id));
  for (const o of backup.state.orders as Order[]) if (!pickupIds.has(o.pickupId) || o.lines.some((id) => !knownSkus.has(id))) throw new Error(`أوردر ${o.ref} مرتبط ببيك أب أو صنف غير موجود؛ راجع النسخة.`);
  const refs = new Set<string>(); for (const o of backup.state.orders as Order[]) { if (refs.has(o.ref)) throw new Error(`أوردر مكرر في النسخة: ${o.ref}`); refs.add(o.ref); }
  const source = balancesFromMoves(legacy ? list(obj(raw.state).moves).map((m) => ({ sku: text(m.sku), qty: num(m.q), from: text(m.from) as Move['from'], to: text(m.to) as Move['to'] })) : list(obj(raw.state).moves) as unknown as Move[]);
  const target = balancesFromMoves(imported); const before = balancesFromMoves(current);
  const balances = [...new Set([...Object.keys(source), ...Object.keys(target), ...Object.keys(before)])].sort().flatMap((sku) => LOCS.map((loc) => ({ sku, loc, source: qty(source, sku, loc), imported: qty(target, sku, loc), current: qty(before, sku, loc) }))).filter((r) => r.source || r.imported || r.current);
  const keys = new Set(current.map(fingerprint)); const overlap = imported.filter((m) => keys.has(fingerprint(m))).length;
  if (duplicates) warnings.push(`تم استبعاد ${duplicates} حركة مكررة بنفس الرقم والبيانات؛ فرق المصدر موضح في الجدول.`);
  if (balances.some((r) => r.imported < 0)) warnings.push('النسخة تحتوي أرصدة سالبة؛ محفوظة كما هي وتحتاج مراجعة جرد.');
  return { backup, duplicates, overlap, legacy, balances, warnings };
}