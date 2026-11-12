import type { AnyLoc, Balances, Loc } from './types';
import { LOCS } from './constants';
import { qty } from './ledger';
import { addDays } from './dates';

/** Stock operations, as in the main Fémini app. Pure: given the inputs and current balances, compute the ledger moves and the checks. */
export type OpType = 'RCV' | 'RTN' | 'SRT' | 'SHP' | 'CLN' | 'FSD' | 'FRC' | 'CNT' | 'LOS' | 'SWP';
export type OpGroup = 'in' | 'out' | 'internal' | 'control';

export const OPS: { type: OpType; ar: string; grp: OpGroup; desc: string }[] = [
  { type: 'RCV', ar: 'استلام توريد', grp: 'in', desc: 'قطع جت من المصنع بورقة موقّعة' },
  { type: 'RTN', ar: 'مرتجعات العملاء', grp: 'in', desc: 'اللي رجع من القنوات بالبوليصة: سليم، نضافة، هالك، والناقص مفقود' },
  { type: 'SRT', ar: 'مرتجع المحل', grp: 'in', desc: 'قطع راجعة من المحل بحالتها، وبتطلع إذن استلام للطباعة' },
  { type: 'SHP', ar: 'توريد للمحل', grp: 'out', desc: 'قطع للمحل، وبتطلع إذن تسليم للطباعة' },
  { type: 'CLN', ar: 'تصنيف حالة', grp: 'internal', desc: 'قطعة بقت هالك نظافة أو هالك نهائي' },
  { type: 'FSD', ar: 'إرسال للمصنع', grp: 'internal', desc: 'غسيل (هيرجع) أو هالك للتسليم' },
  { type: 'FRC', ar: 'استلام من المصنع', grp: 'internal', desc: 'المغسول اللي رجع، وفيه المرفوض' },
  { type: 'SWP', ar: 'تبديل مقاس', grp: 'internal', desc: 'قطع بتتخصم من مقاس وتتضاف لمقاس تاني' },
  { type: 'CNT', ar: 'جرد', grp: 'control', desc: 'عدّ فعلي ومقارنة بالسيستم' },
  { type: 'LOS', ar: 'معالجة المفقود', grp: 'control', desc: 'لقيناه، اتعوّض، ولا مفقود نهائي' },
];
export const GROUP_AR: Record<OpGroup, string> = { in: 'دخول', out: 'خروج', internal: 'داخلي', control: 'رقابة' };
export const opName = (t: string) => OPS.find((o) => o.type === t)?.ar;

/** one input line. Fields used depend on the type: q (qty), rej (FRC rejected), r/d/x/exp (RTN), res (LOS) */
export interface OpLine { sku: string; q: number; rej?: number; r?: number; d?: number; x?: number; exp?: number; res?: 'FOUND' | 'COMP' | 'OFF'; to?: string }
export interface OpHdr {
  ref?: string; declared?: number | null; hasPhoto?: boolean; // RCV
  shop?: string; note?: string; // SHP, SRT
  from?: Loc; to?: Loc; reason?: string; // CLN
  kind?: 'wash' | 'scrap'; // FSD
  refs?: string[]; counted?: boolean; // RTN
  state?: Loc; cnt?: Record<string, number>; snap?: Record<string, number>; reveal?: boolean; ack?: boolean; // CNT
}
export interface OpMove { sku: string; qty: number; from: AnyLoc; to: AnyLoc; note: string }
export interface OpResult { moves: OpMove[]; checks: { ok: boolean; t: string }[]; warn: string[]; err: string[]; ok: boolean }

const n = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
/** the states a piece can come back from the shop in */
export const SRT_TO: Loc[] = ['READY', 'DIRTY', 'SCRAP'];
const INTERNAL = new Set<string>(LOCS);

export function buildOp(type: OpType, hdr: OpHdr, lines: OpLine[], b: Balances, date: string, today: string, name: (sku: string) => string = (s) => s): OpResult {
  const moves: OpMove[] = []; const checks: OpResult['checks'] = []; const warn: string[] = [];
  const add = (sku: string, q: number, from: AnyLoc, to: AnyLoc, note: string) => { if (q > 0) moves.push({ sku, qty: q, from, to, note }); };
  const chk = (ok: unknown, t: string) => checks.push({ ok: !!ok, t });
  const L = lines;
  if (type === 'RCV') {
    L.forEach((l) => add(l.sku, n(l.q), 'EXT_FACTORY', 'READY', 'استلام من المصنع' + (hdr.ref ? ` · إذن ${hdr.ref}` : '')));
    const tot = L.reduce((a, l) => a + n(l.q), 0);
    chk(tot > 0, 'فيه أصناف مضافة'); chk(hdr.hasPhoto, 'صورة الورقة الموقّعة مرفوعة');
    const has = hdr.declared != null && !Number.isNaN(hdr.declared);
    chk(has, 'إجمالي القطع المكتوب في الورقة متسجّل');
    if (has) chk(hdr.declared === tot, `المكتوب في الورقة (${hdr.declared}) = المضاف (${tot})`);
  } else if (type === 'SHP') {
    L.forEach((l) => add(l.sku, n(l.q), 'READY', 'EXT_SHOP', 'توريد للمحل' + (hdr.shop ? ` · ${hdr.shop}` : '') + (hdr.note ? ` · ${hdr.note}` : '')));
    chk(L.length > 0, 'فيه أصناف مضافة'); chk((hdr.shop ?? '').trim(), 'اسم المحل مكتوب');
  } else if (type === 'SRT') {
    // back from the shop, each line in the state it came back in (سليم / نضافة / هالك)
    L.forEach((l) => add(l.sku, n(l.q), 'EXT_SHOP', SRT_TO.includes(l.to as Loc) ? (l.to as Loc) : 'READY', 'مرتجع من المحل' + (hdr.shop ? ` · ${hdr.shop}` : '') + (hdr.note ? ` · ${hdr.note}` : '')));
    chk(L.some((l) => n(l.q) > 0), 'فيه أصناف مضافة'); chk((hdr.shop ?? '').trim(), 'اسم المحل مكتوب');
  } else if (type === 'CLN') {
    const from = hdr.from ?? 'READY'; const to = hdr.to ?? 'DIRTY';
    L.forEach((l) => add(l.sku, n(l.q), from, to, 'تصنيف حالة' + (hdr.reason ? ` · ${hdr.reason}` : '')));
    chk(L.length > 0, 'فيه أصناف مضافة'); chk(from !== to, 'الحالتان مختلفتان');
  } else if (type === 'FSD') {
    L.forEach((l) => (hdr.kind === 'scrap' ? add(l.sku, n(l.q), 'SCRAP', 'EXT_FACTORY', 'هالك اتسلّم للمصنع') : add(l.sku, n(l.q), 'DIRTY', 'FACTORY', 'غسيل')));
    chk(L.length > 0, 'فيه أصناف مضافة');
  } else if (type === 'FRC') {
    L.forEach((l) => { add(l.sku, n(l.q), 'FACTORY', 'READY', 'رجع مغسول'); add(l.sku, n(l.rej), 'FACTORY', 'SCRAP', 'مرفوض بعد الغسيل'); });
    chk(L.length > 0, 'فيه أصناف مضافة');
  } else if (type === 'LOS') {
    // found → back for sale · COMP → settled: paid for (counted in money at cost) · OFF → lost for good
    L.forEach((l) => (l.res === 'FOUND' ? add(l.sku, n(l.q), 'LOST', 'READY', 'لقيناه') : l.res === 'COMP' ? add(l.sku, n(l.q), 'LOST', 'EXT_COMP', 'تسوية: اتعوّض') : add(l.sku, n(l.q), 'LOST', 'EXT_OFF', 'مفقود نهائي (شطب)')));
    chk(L.length > 0, 'فيه أصناف مضافة');
  } else if (type === 'SWP') {
    L.forEach((l) => { if (!l.to || l.to === l.sku) return; add(l.sku, n(l.q), 'READY', 'EXT_ADJ', `تبديل مقاس → ${name(l.to)}`); add(l.to, n(l.q), 'EXT_ADJ', 'READY', `تبديل مقاس ← ${name(l.sku)}`); });
    chk(L.some((l) => l.to && l.to !== l.sku && n(l.q) > 0), 'فيه تبديل مضاف');
  } else if (type === 'RTN') {
    let lost = 0;
    L.forEach((l) => {
      const r = n(l.r), d = n(l.d), x = n(l.x), got = r + d + x, exp = n(l.exp);
      add(l.sku, r, 'EXT_CH', 'READY', 'مرتجع سليم'); add(l.sku, d, 'EXT_CH', 'DIRTY', 'مرتجع محتاج نظافة'); add(l.sku, x, 'EXT_CH', 'SCRAP', 'مرتجع هالك نهائي');
      if (got < exp) { add(l.sku, exp - got, 'EXT_CH', 'LOST', 'ناقص من المرتجع'); lost += exp - got; }
      if (got > exp) warn.push(`${name(l.sku)}: استلمت أكتر من المتوقع بـ ${got - exp} (هتتسجل زيادة)`);
    });
    chk(L.length > 0, 'فيه أصناف متوقعة'); chk(hdr.counted, 'خلّصت عدّ كل الأصناف');
    if (lost) warn.push(`الناقص ${lost} قطعة هيتسجل مفقود`);
  } else if (type === 'CNT') {
    const state = hdr.state ?? 'READY'; const cnt = hdr.cnt ?? {}; const snap = hdr.snap ?? {};
    const keys = Object.keys(cnt).filter((s) => cnt[s] != null && !Number.isNaN(cnt[s]));
    let conflict = 0;
    keys.forEach((s) => {
      const now = qty(b, s, state); const diff = n(cnt[s]) - now;
      if (s in snap && snap[s] !== now) conflict++;
      if (diff > 0) add(s, diff, 'EXT_ADJ', state, 'زيادة جرد'); else if (diff < 0) add(s, -diff, state, 'EXT_ADJ', 'عجز جرد');
    });
    chk(keys.length > 0, 'فيه أصناف اتعدّت'); chk(hdr.reveal, 'كشفت الفروق وراجعتها');
    if (conflict) chk(hdr.ack, `${conflict} صنف رصيده اتغيّر من وقت بداية الجرد. وافقت إن الفرق يتحسب على الرصيد الحالي`);
  }
  // any past day (a closed day is refused when posting); never the future. Shown only when it fails.
  if (date > today) chk(false, 'التاريخ في المستقبل');
  // simulate: an internal state can never go below zero because of this operation
  const err: string[] = []; const sim: Record<string, number> = {};
  for (const m of moves) {
    if (!INTERNAL.has(m.from)) continue;
    const k = `${m.sku}|${m.from}`; const cur = k in sim ? sim[k] : qty(b, m.sku, m.from as Loc);
    if (cur < m.qty) err.push(`${name(m.sku)}: المتاح في ${LOC_SHORT[m.from]} هو ${cur} والمطلوب ${m.qty}`);
    sim[k] = cur - m.qty;
    if (INTERNAL.has(m.to)) { const k2 = `${m.sku}|${m.to}`; sim[k2] = (k2 in sim ? sim[k2] : qty(b, m.sku, m.to as Loc)) + m.qty; }
  }
  const ok = checks.every((c) => c.ok) && !err.length && (moves.length > 0 || (type === 'CNT' && checks.every((c) => c.ok)));
  return { moves, checks, warn, err, ok };
}
const LOC_SHORT: Record<string, string> = { READY: 'جاهز', DIRTY: 'هالك نظافة', FACTORY: 'عند المصنع', SCRAP: 'هالك نهائي', LOST: 'مفقود' };

/** per-SKU before/after for every internal state the moves touch */
export function effects(moves: OpMove[], b: Balances): { sku: string; ch: { loc: Loc; now: number; after: number }[] }[] {
  const by: Record<string, Partial<Record<Loc, number>>> = {};
  for (const m of moves) {
    const o = (by[m.sku] ??= {});
    if (INTERNAL.has(m.from)) o[m.from as Loc] = (o[m.from as Loc] ?? 0) - m.qty;
    if (INTERNAL.has(m.to)) o[m.to as Loc] = (o[m.to as Loc] ?? 0) + m.qty;
  }
  return Object.keys(by).map((sku) => ({ sku, ch: (Object.keys(by[sku]) as Loc[]).filter((l) => by[sku][l]).map((loc) => ({ loc, now: qty(b, sku, loc), after: qty(b, sku, loc) + (by[sku][loc] ?? 0) })) }));
}

/** expected return lines for shipped orders: pieces per SKU */
export function expectedReturn(orderLines: string[][]): OpLine[] {
  const a: Record<string, number> = {};
  for (const ls of orderLines) for (const s of ls) a[s] = (a[s] ?? 0) + 1;
  return Object.keys(a).map((sku) => ({ sku, q: 0, exp: a[sku], r: a[sku], d: 0, x: 0 }));
}
