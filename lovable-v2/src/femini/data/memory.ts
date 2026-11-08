import seed from './seed.json';
import { actor, type Repo, type ShipResult } from './repo';
import type { OpDraft, CancelInfo, Doc, Loc, Model, Move, Order, Pickup, Snapshot, Sku, Supply, SupplyEntry } from '@/femini/domain/types';
import { balancesFromMoves, qty, totalOwned } from '@/femini/domain/ledger';
import { consumption } from '@/femini/domain/supplies';
import { findByCode, skuLabel } from '@/femini/domain/orders';
import { itemMapper } from '@/femini/domain/pickup';
import { BACKDATE_DAYS } from '@/femini/domain/constants';
import { buildOp } from '@/femini/domain/ops';
import { buildHoldOut, buildHoldSettle, HOLD_REASON_AR, outstanding, type Hold } from '@/femini/domain/holds';
import type { Settlement } from '@/femini/domain/settle';
import { addDays, cairoDay, cairoToday } from '@/femini/domain/dates';
import { clearPhotos, getPhoto, putPhoto, shrinkImage } from './photos';
import { blobToDataUrl, squareImage } from './image';
import { exportMedia, replaceMedia } from './photos';
import { validateBackup } from './backup';
import type { Backend } from './cpanel/backend';
import type { OriginalFile, DayClose } from '@/femini/domain/types';
import { dayReport } from '@/femini/domain/reports';

interface Catalog { skus: Sku[]; models: Model[]; archived: Record<string, true>; names: Record<string, string>; colors: { code: string; ar: string }[]; sizes: string[] }
export interface State {
  v: 2; mid: number; sid: number; moves: Move[]; pickups: Pickup[]; orders: Order[]; supplies: Supply[]; log: SupplyEntry[]; docs: Doc[]; seq: Record<string, number>; costs?: Record<string,{cost:number;price:number}>;
  images: Record<string, string | null>; cat: Catalog; drafts?: OpDraft[]; shops?: string[]; files?: OriginalFile[]; archivedPickups?: { pickup: Pickup; orders: Order[] }[]; archivedDrafts?: OpDraft[]; closes?: DayClose[]; autoClose?: boolean; lastBackup?: string; holds?: Hold[]; settles?: Settlement[];
  /** server edition only: every day up to this date is closed (the server's single lock), and the next document id */
  lock?: string; did?: number;
}
const KEY = 'femini-web-demo-2';
const baseSkus: Sku[] = seed.skus.map((k) => ({ id: k.id, model: k.m, color: k.c, size: k.s, minAlert: k.min ?? 0 }));
const baseModels: Model[] = seed.models.map((m) => ({ code: m.code, name: m.name }));
const seedImg = (seed as unknown as { img?: Record<string, string> }).img ?? {};
const fail = (m: string): never => { throw new Error(m); };
const SERVER_BACKUP = 'النسخة الاحتياطية في نسخة السيرفر بتتاخد من cPanel (قاعدة البيانات وفولدر الملفات مع بعض).';

function fresh(): State {
  const moves: Move[] = []; let mid = 1;
  for (const k of seed.skus) if ((k.open ?? 0) > 0) moves.push({ id: mid++, ts: `${seed.asOf}T08:00:00Z`, date: seed.asOf, sku: k.id, qty: k.open!, from: 'EXT_OPEN', to: 'READY', type: 'OPN', doc: 'OPN-0001', by: 'system', note: 'رصيد افتتاحي من جرد 29-10' });
  const pickups: Pickup[] = []; const orders: Order[] = [];
  seed.pickups.forEach((p, i) => {
    const id = `P${i + 1}`; pickups.push({ id, label: p.label, date: cairoToday(), channel: 'VENDOOR', source: 'ملف فيندور 2-11-2026' }); // demo: the sample pickups are dated today
    for (const o of p.orders) orders.push({ ref: o.ref, waybill: String(o.wb), type: String(o.type).includes('استبدال') ? 'exchange' : 'new', gov: o.gov, total: o.total, lines: o.lines.slice(), unmapped: [], pickupId: id, status: 'open' });
  });
  const mk = (id: string, name: string, unit: string, pack: number, packName: string, min: number, rule: Supply['rule'], open: number) =>
    ({ s: { id, name, unit, pack, packName, minAlert: min, note: '', archived: false, rule } as Supply, open });
  const sup = [
    mk('FLY', 'فلاير الشحن', 'قطعة', 1, '', 300, { kind: 'order', qty: 1 }, 2000),
    mk('PKS', 'تغليف فيميني S', 'قطعة', 1, '', 100, { kind: 'range', qty: 1, from: 1, to: 2 }, 600),
    mk('PKM', 'تغليف فيميني M', 'قطعة', 1, '', 100, { kind: 'range', qty: 1, from: 3, to: 5 }, 600),
    mk('PKL', 'تغليف فيميني L', 'قطعة', 1, '', 100, { kind: 'range', qty: 1, from: 6, to: 0 }, 300),
    mk('CUP', 'كابات البرا', 'كاب', 24, 'كيس', 200, { kind: 'pieces', qty: 2, model: 'BR1' }, 960),
  ];
  let sid = 1; const log: SupplyEntry[] = sup.map((x) => ({ id: sid++, date: seed.asOf, item: x.s.id, qty: x.open, kind: 'open', why: 'رصيد افتتاحي تجريبي. عدّله بجرد', doc: null, by: 'system', reversed: false }));
  return { v: 2, mid, sid, moves, pickups, orders, supplies: sup.map((x) => x.s), log, docs: [], seq: { OPN: 1 }, images: {}, cat: { skus: [], models: [], archived: {}, names: {}, colors: [], sizes: [] } };
}
function load(): State {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw) as State; if (s && s.v === 2) return s; } } catch { /* unreadable: kept below */ }
  if (raw) {
    // Something is stored but it cannot be used (damaged, or written by another version). The next save would overwrite it with an
    // empty system, so keep the original text first. It can be recovered from the browser storage key below.
    try { const k = `${KEY}-unreadable`; localStorage.setItem(localStorage.getItem(k) === null || localStorage.getItem(k) === raw ? k : `${k}-${Date.now()}`, raw); } catch { /* no room left to keep it */ }
    console.error('[femini] saved data could not be read; a copy was kept under "' + KEY + '-unreadable"');
  }
  return fresh();
}

/** `backend`: the server edition (PHP + MySQL). Without it the state lives in this browser (localStorage + IndexedDB). */
export function createMemoryRepo(backend?: Backend): Repo {
  let S = backend ? backend.current() : load();
  let baseline = backend ? null : localStorage.getItem(KEY);
  let dirty = false;        // server edition: the action changed the state and must be sent
  let skipAuto = false;
  const guard = () => { if (backend) return; if (localStorage.getItem(KEY) !== baseline) { S = load(); baseline = localStorage.getItem(KEY); throw new Error('البيانات تغيّرت في تبويب آخر. أعد تحميل الصفحة قبل التسجيل.'); } };
  const save = () => { if (backend) { dirty = true; return; } guard(); try { const next = JSON.stringify(S); localStorage.setItem(KEY, next); baseline = next; } catch { S = load(); throw new Error('لم تُحفظ العملية؛ مساحة المتصفح غير كافية. نزّل نسخة احتياطية وفرّغ مساحة.'); } };
  const inWindow = (date: string) => { const t = cairoToday(); if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > t) fail('لا يمكن أن يكون التاريخ في المستقبل'); if (date < addDays(t, -BACKDATE_DAYS)) fail(`ينفع تسجّل بتاريخ قديم لحد ${BACKDATE_DAYS} أيام بس`); };
  const unlocked = (date = cairoToday()) => { guard(); if (backend) { if (S.lock && date <= S.lock) fail('اليوم مقفول؛ افتحه من تقرير اليوم قبل تسجيل عملية.'); return; } if ((S.closes ?? []).some((c) => c.date === date && c.status === 'closed')) fail('اليوم مقفول؛ افتحه من تقرير اليوم قبل تسجيل عملية.'); };
  // the server edition keeps every photo and original on the server (uploaded right after the action is accepted)
  const keepPhoto = backend ? async (_path: string, _blob: Blob) => {} : putPhoto;
  const original = async (owner: string, kind: string, file?: File | null) => {
    if (!file) return;
    if (backend) {
      if (kind === 'pickup') backend.queueFile({ type: 'pickup', id: owner }, 'pickup', file);
      else if (kind === 'scan') backend.queueFile({ type: 'doc', no: owner }, 'scan', file);
      else if (kind === 'cancel') backend.queueFile({ type: 'order', ref: owner }, 'cancel', file);
      else if (kind === 'settle') backend.queueFile({ type: 'settle', id: owner }, 'doc_file', file);
      else backend.queueFile({ type: 'doc', no: owner }, 'doc_photo', file);
      return;
    }
    const id = `${owner}-${kind}-${Date.now()}`; const path = `originals/${id}`;
    await keepPhoto(path, file); S.files ??= []; S.files.push({ id, owner, kind, path, name: file.name, mime: file.type, size: file.size, at: new Date().toISOString() });
  };
  const report = (date: string) => dayReport({ moves: S.moves, orders: S.orders, pickups: S.pickups, docs: S.docs } as Snapshot, date);
  const closeRecord = (date: string, auto: boolean): DayClose => { const r = report(date); return { date, at: new Date().toISOString(), by: auto ? 'system' : actor(), auto, status: 'closed', summary: r.summary, report: { requestedOrders: r.requestedOrders, open: r.open, blocked: r.blocked, team: r.team } }; };
  const docNo = (t: string) => { S.seq[t] = (S.seq[t] ?? 0) + 1; return `${t}-${String(S.seq[t]).padStart(4, '0')}`; };
  const bal = () => balancesFromMoves(S.moves);
  const post = (rows: Omit<Move, 'id' | 'ts'>[]) => { for (const r of rows) S.moves.push({ ...r, id: S.mid++, ts: new Date().toISOString() }); };
  const supPush = (item: string, q: number, kind: SupplyEntry['kind'], why: string, doc: string | null = null, date = cairoToday()): SupplyEntry => {
    const e: SupplyEntry = { id: S.sid++, date, item, qty: q, kind, why, doc, by: actor(), reversed: false }; S.log.push(e); return e;
  };
  const supBal = (id: string) => S.log.reduce((a, e) => a + (e.item === id ? e.qty : 0), 0);
  /** stock lines as whole pieces, one line per variant; a fraction or a negative quantity is refused, zero lines dropped */
  const pieces = (lines: { sku: string; qty: number }[]) => {
    const t: Record<string, number> = {};
    for (const l of lines) { if (!Number.isInteger(l.qty) || l.qty < 0) fail(`الكمية لازم تكون عدد قطع صحيح موجب (${l.sku}: ${l.qty})`); if (l.qty) t[l.sku] = (t[l.sku] ?? 0) + l.qty; }
    return Object.entries(t).map(([sku, qty]) => ({ sku, qty }));
  };
  const agg = (lines: string[]) => { const a: Record<string, number> = {}; for (const s of lines) a[s] = (a[s] ?? 0) + 1; return a; };
  const allSkus = () => baseSkus.concat(S.cat.skus);
  const modelOf = (s: string) => allSkus().find((k) => k.id === s)?.model ?? '';
  const colorCode = (ar: string): string => {
    const f = seed.colors.find((c) => c.ar === ar) ?? S.cat.colors.find((c) => c.ar === ar); if (f) return f.code;
    const used = new Set([...seed.colors, ...S.cat.colors].map((c) => c.code)); let n = S.cat.colors.length + 1; while (used.has(`X${n}`)) n++;
    S.cat.colors.push({ code: `X${n}`, ar }); return `X${n}`;
  };
  const demandOf = (id: string) => S.orders.reduce((a, o) => a + (o.status === 'open' ? o.lines.filter((l) => l === id).length : 0), 0);
  // Links the items of open orders that could not be matched when the pickup was imported (unknown code, or a model added to the
  // catalog later). Only open orders: a shipped one already left the stock without them.
  const relink = (): number => {
    const map = itemMapper(allSkus().filter((k) => !S.cat.archived[k.id]), seed.alias as Record<string, string>); let n = 0;
    for (const o of S.orders) {
      if (o.status !== 'open' || !o.unmapped.length) continue; const keep: unknown[] = [];
      for (const u of o.unmapped) {
        if (Array.isArray(u) && u.length === 4) { const [code, size, color, q] = u as [string, string, string, number]; const { id } = map(code, size, color); if (id && Number.isInteger(+q) && +q > 0) { for (let i = 0; i < +q; i++) o.lines.push(id); n++; continue; } }
        keep.push(u);
      }
      o.unmapped = keep;
    }
    return n;
  };
  // pieces of a variant still outside on an open hold: they come back into the warehouse later, so the variant must stay
  const heldOf = (id: string) => (S.holds ?? []).reduce((a, h) => a + (h.status === 'open' ? outstanding(h)[id] ?? 0 : 0), 0);
  const blockers = (id: string): string | null => (totalOwned(bal(), id) !== 0 ? `${id}: عليه رصيد` : demandOf(id) ? `${id}: عليه طلب مفتوح` : heldOf(id) ? `${id}: عليه ${heldOf(id)} قطعة برا في هولد مفتوح. لو رجعت سجّل رجوعها، ولو مش راجعة اخصمها نهائي من الهولد بصورة، وبعدين امسح الصنف` : null);

  const api: Repo = {
    mode: backend ? 'server' : 'memory',
    async snapshot(): Promise<Snapshot> {
      if (backend) {
        const fresh = await backend.refresh(); if (fresh) S = fresh;
        // The server keeps one lock date (every day up to it is closed). At midnight the past days close by themselves, but a
        // day reopened today stays open until tomorrow.
        if (S.autoClose !== false && !skipAuto) {
          const today = cairoToday(); const y = addDays(today, -1); const lock = S.lock ?? '';
          if (lock < y) {
            let last = lock;
            for (let d = lock ? addDays(lock, 1) : addDays(today, -7); d <= y; d = addDays(d, 1)) {
              const rec = (S.closes ?? []).filter((c) => c.date === d).at(-1);
              if (rec && rec.status === 'reopened' && cairoDay(rec.reopenedAt ?? rec.at) === today) break;
              if (S.moves.some((m) => m.date === d) && !(rec && rec.status === 'closed')) { S.closes ??= []; S.closes.push(closeRecord(d, true)); }
              last = d;
            }
            if (last !== lock) { S.lock = last; save(); }
          }
        }
      } else if (S.autoClose !== false) {
        const today = cairoToday(); let changed = false; S.closes ??= [];
        // A day reopened today stays open until tomorrow (it was compared with the close time, so a day closed before today was
        // closed again right after reopening and could not be corrected).
        for (let i=1;i<=7;i++) { const date=addDays(today,-i); if (!S.moves.some((m)=>m.date===date) || S.closes.some((c)=>c.date===date&& (c.status==='closed' || cairoDay(c.reopenedAt ?? c.at)===today))) continue; S.closes.push(closeRecord(date,true)); changed=true; }
        if (changed) save();
      }
      const all = allSkus(); const skus = all.filter((k) => !S.cat.archived[k.id]); const archivedSkus = all.filter((k) => S.cat.archived[k.id]);
      const active = new Set(skus.map((k) => k.model));
      const models = baseModels.concat(S.cat.models).filter((m) => active.has(m.code)).map((m) => ({ code: m.code, name: S.cat.names[m.code] ?? m.name, image: m.code in S.images ? S.images[m.code] : seedImg[m.code] ?? null }));
      const sizes = [...new Set([...seed.sizes, ...S.cat.sizes])];
      const colors = [...seed.colors, ...S.cat.colors];
      // copies, so React Query's structural sharing can see in-place edits of the demo state
      const c = structuredClone({ drafts: S.drafts ?? [], shops: S.shops ?? [], pickups: S.pickups, orders: S.orders, supplies: S.supplies, supplyLog: S.log, docs: S.docs, moves: S.moves.slice().reverse() });
      return { today: cairoToday(), models, skus, archivedSkus, balances: bal(), ...c, colors, sizes, files: structuredClone(S.files ?? []), archivedPickups: structuredClone(S.archivedPickups ?? []), archivedDrafts: structuredClone(S.archivedDrafts ?? []), holds: structuredClone(S.holds ?? []), settles: structuredClone(S.settles ?? []), closes: structuredClone(S.closes ?? []), autoClose: S.autoClose ?? true, lastBackup: S.lastBackup ?? null, costs: structuredClone(S.costs??{}), ...(backend ? { lock: S.lock ?? '' } : {}) };
    },
    async importPickup(i) {
      inWindow(i.date); unlocked(i.date);
      const id = `P${[...S.pickups, ...(S.archivedPickups ?? []).map((a) => a.pickup)].reduce((a, p) => Math.max(a, +p.id.slice(1) || 0), 0) + 1}`;
      S.pickups.push({ id, label: i.label, date: i.date, channel: i.channel, source: i.source });
      const have = new Set(S.orders.map((o) => o.ref)); let n = 0; let d = 0;
      for (const o of i.orders) { if (have.has(o.ref)) { d++; continue; } have.add(o.ref); S.orders.push({ ...o, pickupId: id, status: 'open' }); n++; }
      await original(id, 'pickup', i.file); save(); return { pickup: id, imported: n, duplicates: d };
    },
    async shipOrders({ refs, employee, source, file, date: day, ...rest }): Promise<ShipResult> {
      // `as`: internal use by redateShipment only (an admin moving a sheet to its real day keeps the original scanner)
      const as = (rest as { as?: { employee: string; redateOf: string } }).as;
      const today = cairoToday(); const date = day ?? today; if (!as) inWindow(date); unlocked(date);
      const emp = employee.trim(); if (!emp) fail('أدخل اسم الموظف'); const scanner = as?.employee ?? emp;
      const os = S.orders.filter((o) => refs.includes(o.ref) && o.status === 'open'); if (!os.length) fail('لا توجد أوردرات مفتوحة ضمن المحدد');
      // Pieces that are not in the catalog could never leave the stock: the order would ship with part of it uncounted.
      const bad = os.filter((o) => o.unmapped.length); if (bad.length) fail(`أوردرات فيها أصناف مش متعرّفة، صحّحها الأول: ${bad.map((o) => o.ref).join('، ')}`);
      // an order cannot leave before the day its pickup was requested
      const early = os.filter((o) => (S.pickups.find((p) => p.id === o.pickupId)?.date ?? '') > date);
      if (early.length) fail(`أوردرات البيك أب بتاعها بتاريخ بعد ${date}: ${early.map((o) => o.ref).join('، ')}`);
      // a past day's sheet is stamped at midday Cairo of that day, so every report puts it on the right day
      const at = date === today ? new Date().toISOString() : new Date(`${date}T10:00:00Z`).toISOString();
      const doc = docNo('SCN'); const a = agg(os.flatMap((o) => o.lines));
      post(Object.keys(a).map((sku) => ({ date, sku, qty: a[sku], from: 'READY' as const, to: 'EXT_CH' as const, type: 'SCN', doc, by: emp, note: `سكان: ${emp} (${source})` })));
      const sup: Record<string, number> = {};
      for (const o of os) { o.status = 'shipped'; o.shippedBy = scanner; o.shippedAt = at; o.shipDoc = doc; for (const c of consumption(o.lines, S.supplies, modelOf)) sup[c.item] = (sup[c.item] ?? 0) + c.qty; }
      for (const item of Object.keys(sup)) supPush(item, -sup[item], 'auto', `سكان ${emp}: ${os.length} أوردر`, doc, date);
      const pieces = os.reduce((x, o) => x + o.lines.length, 0);
      S.docs.push({ no: doc, type: 'SCN', date, by: emp, status: 'done', hdr: { employee: scanner, source, orders: os.length, pieces, ...(as ? { redateOf: as.redateOf } : {}), ...(date !== today ? { recordedAt: new Date().toISOString() } : {}) }, lines: [] });
      const b = bal(); const negative = Object.keys(a).map((sku) => ({ sku, ready: qty(b, sku, 'READY') })).filter((x) => x.ready < 0);
      await original(doc, 'scan', file); save(); return { doc, shipped: os.length, pieces, negative };
    },
    async reverseShipment(doc) {
      unlocked();
      const rev = `${doc} (عكس)`; if (S.moves.some((m) => m.doc === rev) || S.docs.some((x) => x.no === doc && x.status === 'reversed')) fail('تم عكس العملية مسبقًا');
      const orig = S.moves.filter((m) => m.doc === doc && m.type === 'SCN'); if (!orig.length) fail('مستند غير معروف');
      // Put back only the pieces that are still out because of this sheet: orders still shipped from it, and orders cancelled
      // without taking their stock back (also in archived pickups). Pieces already back (a customer return, a cancellation that
      // returned the stock, an order restored to open) are never put back a second time. Cancelled orders stay cancelled.
      const linked = [...S.orders, ...(S.archivedPickups ?? []).flatMap((a) => a.orders)].filter((o) => o.shipDoc === doc);
      const stillOut = linked.filter((o) => !o.returned && (o.status === 'shipped' || (o.status === 'cancelled' && o.cancel?.was === 'shipped' && !o.cancel.returned)));
      const out: Record<string, number> = {}; for (const o of stillOut) for (const s of o.lines) out[s] = (out[s] ?? 0) + 1;
      const undo = orig.map((m) => { const t = Math.min(m.qty, out[m.sku] ?? 0); out[m.sku] = (out[m.sku] ?? 0) - t; return { m, q: t }; }).filter((x) => x.q > 0);
      post(undo.map(({ m, q }) => ({ date: cairoToday(), sku: m.sku, qty: q, from: m.to, to: m.from, type: 'SCN', doc: rev, by: actor(), note: `عكس ${doc}` })));
      // shipped orders reopen; an open order still linked (data saved before restoring cleared the link) just loses the link
      for (const o of linked) if ((o.status === 'shipped' && !o.returned) || o.status === 'open') { o.status = 'open'; o.shippedBy = null; o.shippedAt = null; o.shipDoc = null; }
      // packaging comes back for the same orders whose pieces come back
      const refund: Record<string, number> = {}; for (const o of stillOut) for (const c of consumption(o.lines, S.supplies, modelOf)) refund[c.item] = (refund[c.item] ?? 0) + c.qty;
      for (const e of S.log.filter((x) => x.doc === doc && x.kind === 'auto' && !x.reversed)) {
        const give = Math.min(-e.qty, refund[e.item] ?? 0); refund[e.item] = (refund[e.item] ?? 0) - give;
        if (give > 0) supPush(e.item, give, 'rev', `reverse ${doc}`, rev); e.reversed = true;
      }
      const d = S.docs.find((x) => x.no === doc); if (d) d.status = 'reversed';
      save();
    },
    async receiveStock({ lines: raw, date, ref, declared, photo }) {
      unlocked(date);
      const lines = pieces(raw);                     // whole pieces only; what is posted is exactly what is checked
      const total = lines.reduce((a, l) => a + l.qty, 0);
      if (total <= 0) fail('لا توجد قطع'); if (declared !== total) fail(`الإجمالي المكتوب في الورقة (${declared}) لا يساوي المضاف (${total})`);
      const today = cairoToday(); if (date > today) fail('لا يمكن أن يكون التاريخ في المستقبل');
      const no = docNo('RCV'); const path = `documents/${no}.jpg`; await keepPhoto(path, await shrinkImage(photo)); await original(no, 'photo', photo);
      post(lines.filter((l) => l.qty > 0).map((l) => ({ date, sku: l.sku, qty: l.qty, from: 'EXT_FACTORY' as const, to: 'READY' as const, type: 'RCV', doc: no, by: actor(), note: `استلام ${ref}` })));
      S.docs.push({ no, type: 'RCV', date, by: actor(), status: 'done', hdr: { ref, declared }, lines, attachment: path }); save(); return { doc: no, pieces: total };
    },
    async moveState({ lines: raw, from, to, reason }) {
      unlocked();
      if (from === to) fail('الحالتان متطابقتان'); const b = bal();
      const lines = pieces(raw); if (!lines.length) fail('لا توجد قطع');   // the same variant twice is checked as one total
      for (const l of lines) if (qty(b, l.sku, from) < l.qty) fail(`المتاح ${qty(b, l.sku, from)} فقط`);
      const no = docNo('MOV'); const pcs = lines.reduce((a, l) => a + l.qty, 0);
      post(lines.filter((l) => l.qty > 0).map((l) => ({ date: cairoToday(), sku: l.sku, qty: l.qty, from, to, type: 'MOV', doc: no, by: actor(), note: reason })));
      S.docs.push({ no, type: 'MOV', date: cairoToday(), by: actor(), status: 'done', hdr: { from, to, reason }, lines }); save(); return { doc: no, pieces: pcs };
    },
    async postOp({ type, date, hdr, lines, photo }) {
      unlocked(date);
      const today = cairoToday(); const skuMap = new Map(allSkus().map((k) => [k.id, k]));
      const h = { ...hdr, hasPhoto: !!photo };
      if (type === 'RTN') {
        for (const ref of h.refs ?? []) { const o = S.orders.find((x) => x.ref === ref); if (!o || o.status !== 'shipped') fail(`الأوردر ${ref} مش متشحن`); if (o!.returned) fail(`الأوردر ${ref} اتسجل له مرتجع قبل كده (${o!.returned.doc})`); }
      }
      const r = buildOp(type, h, lines, bal(), date, today, (s) => skuLabel(skuMap, s));
      if (!r.ok) fail(r.err[0] ?? r.checks.find((c) => !c.ok)?.t ?? 'العملية ناقصة');
      const no = docNo(type); let attachment: string | null = null;
      if (photo) { attachment = `documents/${no}.jpg`; await keepPhoto(attachment, await shrinkImage(photo)); await original(no, 'photo', photo); }
      post(r.moves.map((m) => ({ date, sku: m.sku, qty: m.qty, from: m.from, to: m.to, type, doc: no, by: actor(), note: m.note })));
      const pieces = r.moves.reduce((a, m) => a + m.qty, 0);
      const { hasPhoto: _p, snap: _s, ...keep } = h as typeof h & { snap?: unknown };
      if (type === 'SHP') { const shop = (h.shop ?? '').trim(); keep.shop = shop; S.shops = S.shops ?? []; if (shop && !S.shops.includes(shop)) S.shops.push(shop); (keep as Record<string, unknown>).delivered = false; (keep as Record<string, unknown>).at = new Date().toISOString(); }
      if (type === 'RTN') for (const ref of h.refs ?? []) { const o = S.orders.find((x) => x.ref === ref); if (o) o.returned = { doc: no, at: new Date().toISOString() }; }
      S.docs.push({ no, type, date, by: actor(), status: 'done', hdr: { ...keep, pieces, moves: r.moves.map((m) => ({ sku: m.sku, qty: m.qty, from: m.from, to: m.to })) }, lines: r.moves.map((m) => ({ sku: m.sku, qty: m.qty })), attachment });
      save(); return { doc: no, pieces };
    },
    async holdOut({ who, note, reason, reasonText, lines, photo }) {
      const date = cairoToday(); unlocked(date);
      const skuMap = new Map(allSkus().map((k) => [k.id, k]));
      const r = buildHoldOut({ who, reason, reasonText, lines, hasPhoto: !!photo }, bal(), (s) => skuLabel(skuMap, s));
      if (!r.ok) fail(r.err[0]);
      const no = docNo('HLD'); const path = `documents/${no}.jpg`; await keepPhoto(path, await shrinkImage(photo!)); await original(no, 'photo', photo);
      post(r.moves.map((m) => ({ date, sku: m.sku, qty: m.qty, from: m.from as Move['from'], to: m.to as Move['to'], type: 'HLD', doc: no, by: actor(), note: m.note })));
      const at = new Date().toISOString(); const ls = r.moves.map((m) => ({ sku: m.sku, q: m.qty }));
      S.holds ??= []; S.holds.push({ no, who: who.trim(), note: note.trim(), reason, reasonText: reasonText.trim(), at, date, by: actor(), lines: ls, photo: path, status: 'open', events: [{ at, by: actor(), kind: 'out', lines: ls, photo: path, note: note.trim() }] });
      S.docs.push({ no, type: 'HLD', date, by: actor(), status: 'done', hdr: { who: who.trim(), reason: reason === 'other' ? reasonText.trim() : HOLD_REASON_AR[reason], moves: r.moves.map((m) => ({ sku: m.sku, qty: m.qty, from: m.from, to: m.to })) }, lines: r.moves.map((m) => ({ sku: m.sku, qty: m.qty })), attachment: path });
      save(); return no;
    },
    async holdSettle({ no, ret, off, note, photo }) {
      const date = cairoToday(); unlocked(date);
      const h = (S.holds ?? []).find((x) => x.no === no); if (!h) return fail('هولد غير معروف');
      const skuMap = new Map(allSkus().map((k) => [k.id, k]));
      const r = buildHoldSettle(h, { ret, off, hasPhoto: !!photo }, (s) => skuLabel(skuMap, s));
      if (!r.ok) fail(r.err[0]);
      const k = h.events.length; let path: string | null = null;
      if (photo) { path = `documents/${no}-${k}.jpg`; await keepPhoto(path, await shrinkImage(photo)); await original(no, 'photo', photo); }
      post(r.moves.map((m) => ({ date, sku: m.sku, qty: m.qty, from: m.from as Move['from'], to: m.to as Move['to'], type: 'HLD', doc: no, by: actor(), note: m.note })));
      const at = new Date().toISOString();
      const rl = ret.filter((l) => l.q > 0), ol = off.filter((l) => l.q > 0);
      if (rl.length) h.events.push({ at, by: actor(), kind: 'return', lines: rl, photo: ol.length ? null : path, note: note.trim() });
      if (ol.length) h.events.push({ at, by: actor(), kind: 'writeoff', lines: ol, photo: path, note: note.trim() });
      if (r.closes) h.status = 'closed';
      save(); return { closed: r.closes };
    },
    async confirmShopDelivery(doc, photo) {
      unlocked();
      const d = S.docs.find((x) => x.no === doc && x.type === 'SHP'); if (!d) return fail('إذن توريد غير معروف');
      if (d.hdr.delivered) fail('التسليم متأكد قبل كده'); if (!photo) fail('صورة الإذن الموقّع إجبارية');
      const path = `documents/${doc}-signed.jpg`; await keepPhoto(path, await shrinkImage(photo));
      await original(doc, 'signed', photo); d.attachment = path; d.hdr.delivered = true; d.hdr.deliveredAt = new Date().toISOString(); save();
    },
    async saveDraft(i) {
      unlocked(i.date);
      S.drafts = S.drafts ?? []; const id = i.id ?? `D${Date.now().toString(36)}`;
      const rec: OpDraft = { id, type: i.type, date: i.date, hdr: i.hdr, lines: i.lines, updatedAt: new Date().toISOString() };
      const k = S.drafts.findIndex((x) => x.id === id); if (k >= 0) S.drafts[k] = rec; else S.drafts.push(rec); save(); return id;
    },
    async deleteDraft(id) { guard(); const draft = (S.drafts ?? []).find((x) => x.id === id); if (draft) { unlocked(draft.date); S.archivedDrafts ??= []; S.archivedDrafts.push(draft); } S.drafts = (S.drafts ?? []).filter((x) => x.id !== id); save(); },
    async cancelOrder({ code, reason, returnStock, photo }) {
      unlocked();
      if (!photo) fail('صورة البوليصة المشطوبة إجبارية');
      const o = findByCode(S.orders, code); if (!o) fail('لا يوجد أوردر بهذا الكود'); const ord = o as Order;
      if (ord.status === 'cancelled') fail('الأوردر ملغى مسبقًا');
      await original(ord.ref, 'cancel', photo); const was = ord.status as 'open' | 'shipped'; const path = `documents/cancel-${ord.ref}.jpg`; await keepPhoto(path, await shrinkImage(photo));
      let doc: string | null = null;
      if (was === 'shipped' && returnStock && ord.returned) {
        doc = ord.returned.doc;   // the pieces came back with the return: nothing more to post, only the link to it
      } else if (was === 'shipped' && returnStock) {
        doc = docNo('CXL'); const a = agg(ord.lines);
        post(Object.keys(a).map((sku) => ({ date: cairoToday(), sku, qty: a[sku], from: 'EXT_CH' as const, to: 'READY' as const, type: 'CXL', doc: doc!, by: actor(), note: `إلغاء أوردر ${ord.ref}` })));
        for (const c of consumption(ord.lines, S.supplies, modelOf)) supPush(c.item, c.qty, 'rev', `إلغاء أوردر ${ord.ref}`, doc);
      }
      const cancel: CancelInfo = { at: new Date().toISOString(), by: actor(), reason, was, returned: was === 'shipped' && returnStock, doc, attachment: path };
      ord.status = 'cancelled'; ord.cancel = cancel; save(); return { ref: ord.ref, returned: cancel.returned };
    },
    async restoreOrder(ref) {
      unlocked();
      const o = S.orders.find((x) => x.ref === ref && x.status === 'cancelled'); if (!o) return fail('الأوردر غير ملغى');
      // It is still shipped only while its pieces are still out: returned by the customer (RTN), or cancelled without taking the
      // stock back from a shipment sheet that was not reversed since. Otherwise its pieces are on the shelf and it is open again,
      // with no link to the old sheet (a later reversal of that sheet must not put its pieces back a second time).
      const sheetStands = !!o.shipDoc && S.docs.some((d) => d.no === o.shipDoc && d.status === 'done');
      const stillOut = o.cancel?.was === 'shipped' && (!!o.returned || (!o.cancel.returned && sheetStands));
      if (stillOut) o.status = 'shipped';
      else { o.status = 'open'; o.shippedBy = null; o.shippedAt = null; o.shipDoc = null; }
      o.cancel = null; save();
    },
    async supplyMove({ item, kind, qty: q, why }) {
      unlocked();
      if (!S.supplies.some((s) => s.id === item)) fail('مستلزم غير معروف');
      if (!Number.isInteger(q)) fail('الكمية لازم تكون عدد صحيح');
      const bal0 = supBal(item); let delta = 0;
      if (kind === 'rcv') { if (q <= 0) fail('يجب أن تكون الكمية أكبر من صفر'); delta = q; }
      else if (kind === 'issue') { if (q <= 0) fail('يجب أن تكون الكمية أكبر من صفر'); if (q > bal0) fail(`لا يمكن صرف ${q} والرصيد ${bal0}`); delta = -q; }
      else { if (q < 0) fail('لا يمكن أن يكون العدد سالبًا'); delta = q - bal0; if (delta === 0) fail('العدد مطابق للرصيد'); }
      const e = supPush(item, delta, kind, why); save(); return { id: e.id, delta, balance: bal0 + delta };
    },
    async undoSupplyMove(id) {
      unlocked();
      const e = S.log.find((x) => x.id === id && ['rcv', 'issue', 'count', 'open'].includes(x.kind) && !x.reversed); if (!e) return fail('لا يوجد ما يمكن التراجع عنه');
      const after = supBal(e.item) - e.qty;
      if (after < 0) fail(`التراجع هيخلّي الرصيد ${after}؛ اتصرف من الكمية دي بعد ما اتسجلت. اعمل جرد بدل التراجع.`);
      supPush(e.item, -e.qty, 'rev', `تراجع عن: ${e.why}`); e.reversed = true; save();
    },
    async photoUrl(path) { if (backend) return backend.fileUrl(path); const b = await getPhoto(path); return b ? URL.createObjectURL(b) : null; },

    // ---------- product images ----------
    async setModelImage(code, file) {
      S.images[code] = file ? await blobToDataUrl(await squareImage(file)) : null; save();
    },
    // ---------- catalog ----------
    async catalogNewModel({ code, name, colors: c0, sizes: z0, minAlert }) {
      const c = code.toUpperCase().replace(/[^A-Z0-9]/g, ''); // pa-3 / pa 3 / PA3 are one code
      // a colour or size picked twice is one variant, never two with the same code
      const colors = [...new Set(c0.map((x) => x.trim()).filter(Boolean))]; const sizes = [...new Set(z0.map((x) => x.trim()).filter(Boolean))];
      if (!/^[A-Z][A-Z0-9]{0,9}$/.test(c)) fail('كود الموديل حروف إنجليزية وأرقام، ويبدأ بحرف (مثل PAN6)');
      if (baseModels.concat(S.cat.models).some((m) => m.code === c)) fail('كود الموديل موجود بالفعل');
      if (!name.trim()) fail('أدخل نوع الموديل'); if (!colors.length || !sizes.length) fail('اختر لونًا ومقاسًا على الأقل');
      for (const z of sizes) if (![...seed.sizes, ...S.cat.sizes].includes(z)) S.cat.sizes.push(z);
      S.cat.models.push({ code: c, name: name.trim() }); let n = 0;
      for (const col of colors) for (const z of sizes) { S.cat.skus.push({ id: `${c}-${colorCode(col)}-${z}`, model: c, color: col, size: z, minAlert }); n++; }
      relink(); save(); return { model: c, skus: n };
    },
    async catalogEditModel({ code, name, add, remove }) {
      if (!baseModels.concat(S.cat.models).some((m) => m.code === code)) fail('موديل غير معروف');
      if (name.trim()) S.cat.names[code] = name.trim(); let a = 0; let r = 0;
      for (const x of add) {
        if (![...seed.sizes, ...S.cat.sizes].includes(x.size)) S.cat.sizes.push(x.size);
        const ex = allSkus().find((k) => k.model === code && k.color === x.color && k.size === x.size);
        if (ex) { if (S.cat.archived[ex.id]) { delete S.cat.archived[ex.id]; a++; } } else { S.cat.skus.push({ id: `${code}-${colorCode(x.color)}-${x.size}`, model: code, color: x.color, size: x.size, minAlert: 0 }); a++; }
      }
      for (const id of remove) { const b = blockers(id); if (b) fail(`لا يمكن إزالته: ${b}`); S.cat.archived[id] = true; r++; }
      relink(); save(); return { added: a, removed: r };
    },
    async catalogRemoveModel(code) {
      const ids = allSkus().filter((k) => k.model === code && !S.cat.archived[k.id]).map((k) => k.id);
      for (const id of ids) { const b = blockers(id); if (b) fail(`لا يمكن إزالة الموديل: ${b}`); }
      for (const id of ids) S.cat.archived[id] = true; save(); return ids.length;
    },
    async catalogRestore({ model, sku }) {
      let n = 0; for (const k of allSkus()) if (k.model === model && (!sku || k.id === sku) && S.cat.archived[k.id]) { delete S.cat.archived[k.id]; n++; }
      relink(); save(); return n;
    },
    async remapUnmapped() { const n = relink(); save(); return n;
    },
    // ---------- supplies administration ----------
    async supplySave(i) {
      if (!i.name.trim()) fail('أدخل اسم المستلزم');
      if (i.rule.kind !== 'none' && !(i.rule.qty > 0)) fail('يجب أن تكون الكمية في قاعدة الخصم أكبر من صفر');
      const ex = i.id ? S.supplies.find((s) => s.id === i.id) : undefined;
      const body = { name: i.name.trim(), unit: i.unit.trim() || 'قطعة', pack: Math.max(1, Math.floor(i.pack) || 1), packName: i.packName.trim(), minAlert: Math.max(0, Math.floor(i.minAlert) || 0), note: i.note.trim(), rule: i.rule };
      if (ex) { Object.assign(ex, body); save(); return ex.id; }
      let n = S.supplies.length + 1; while (S.supplies.some((s) => s.id === `S${n}`)) n++;
      const id = `S${n}`; S.supplies.push({ id, archived: false, ...body });
      if (i.open > 0) supPush(id, Math.floor(i.open), 'open', 'رصيد افتتاحي'); save(); return id;
    },
    async supplyArchive(id, archived) { const s = S.supplies.find((x) => x.id === id); if (s) s.archived = archived; save(); },
    // ---------- files ----------
    async pickupUpdate({ id, label, date, channel, force }) {
      const p = S.pickups.find((x) => x.id === id); if (!p) fail('بيك أب غير معروف'); if (!label.trim()) fail('أدخل اسم البيك أب');
      // `force`: an admin correcting the date of a pickup on a closed day (a pickup moves no stock, so no ledger is touched)
      if (!force) { if (p) unlocked(p.date); unlocked(date); }
      if (date > cairoToday()) fail('لا يمكن أن يكون التاريخ في المستقبل');
      // its orders cannot have left before the day they were requested
      const early = S.orders.filter((o) => o.pickupId === id && o.shippedAt && cairoDay(o.shippedAt) < date);
      if (early.length) fail(`فيه ${early.length} أوردر من البيك أب ده اتشحن قبل ${date} (مثلًا ${early[0].ref}). اختار تاريخ قبل أول شحن، أو صحّح تاريخ ورقة الشحن الأول.`);
      Object.assign(p as Pickup, { label: label.trim(), date, channel }); save();
    },
    async redateShipment(doc, date) {
      // A scan sheet is a confirmed document: the ledger is never edited. Moving it to its real day = counter-moves under
      // "<no> (عكس)" dated on the sheet's OWN day (so that day nets to zero and no other day changes), then its orders recorded
      // again on the right day, in ONE save (one push on the server). Orders a customer returned later move too: their return
      // stays as recorded. Works again on a sheet already reversed, for orders still left on it (e.g. returned ones that an
      // older version of this tool left behind). The new sheet keeps the scanner's name and points to the old one.
      const d = S.docs.find((x) => x.no === doc && x.type === 'SCN'); if (!d) return fail('ورقة شحن غير معروفة');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > cairoToday()) fail('لا يمكن أن يكون التاريخ في المستقبل');
      if (date === d.date) fail('الورقة متسجلة على اليوم ده فعلًا');
      unlocked(date); unlocked(d.date);
      const os = S.orders.filter((o) => o.shipDoc === doc && o.status === 'shipped');
      if (!os.length) fail('مفيش أوردرات مشحونة على الورقة دي تتنقل.');
      const late = os.filter((o) => (S.pickups.find((p) => p.id === o.pickupId)?.date ?? '') > date);
      if (late.length) fail(`${late.length} أوردر البيك أب بتاعه بتاريخ بعد ${date} (مثلًا ${late[0].ref}). صحّح تاريخ البيك أب الأول.`);
      // an order of this sheet cancelled without its pieces coming back: moving would put pieces on the shelf that are not there
      const gone = S.orders.filter((o) => o.shipDoc === doc && o.status === 'cancelled' && o.cancel?.was === 'shipped' && !o.cancel.returned && !o.returned);
      if (gone.length) fail(`الورقة فيها ${gone.length} أوردر اتلغى من غير ما القطع ترجع (مثلًا ${gone[0].ref})؛ نقلها هيرجّع قطع مش موجودة. استرجع الأوردر الأول أو سيب الورقة على تاريخها.`);
      const rev = `${doc} (عكس)`;
      // what is still out under this sheet per sku: its moves minus what an earlier reversal already put back
      const left: Record<string, number> = {}; const way: Record<string, Move> = {};
      for (const m of S.moves) {
        if (m.doc === doc && m.type === 'SCN') { left[m.sku] = (left[m.sku] ?? 0) + m.qty; way[m.sku] ??= m; }
        else if (m.doc === rev) left[m.sku] = (left[m.sku] ?? 0) - m.qty;
      }
      const need = agg(os.flatMap((o) => o.lines));
      const short = Object.keys(need).find((sku) => (left[sku] ?? 0) < need[sku]);
      if (short) fail(`الورقة مش شايلة كل قطع أوردراتها (${short})؛ مينفعش تتنقل.`);
      const scanner = String(d.hdr.employee ?? d.by);
      post(Object.keys(need).map((sku) => ({ date: d.date, sku, qty: need[sku], from: way[sku].to, to: way[sku].from, type: 'SCN', doc: rev, by: actor(), note: `نقل ${doc} ليوم ${date}` })));
      // packaging of the same orders comes back (capped by what this sheet took and what was already given back)
      const refund: Record<string, number> = {}; for (const o of os) for (const c of consumption(o.lines, S.supplies, modelOf)) refund[c.item] = (refund[c.item] ?? 0) + c.qty;
      const given: Record<string, number> = {}; for (const e of S.log) if (e.doc === rev && e.kind === 'rev') given[e.item] = (given[e.item] ?? 0) + e.qty;
      for (const e of S.log.filter((x) => x.doc === doc && x.kind === 'auto')) {
        const room = -e.qty - (given[e.item] ?? 0); const give = Math.min(room, refund[e.item] ?? 0);
        refund[e.item] = (refund[e.item] ?? 0) - Math.max(give, 0); given[e.item] = (given[e.item] ?? 0) + Math.max(give, 0);
        if (give > 0) supPush(e.item, give, 'rev', `نقل ${doc} ليوم ${date}`, rev, d.date); e.reversed = true;
      }
      const wasDone = d.status === 'done'; d.status = 'reversed';
      // the orders reopen for a moment and are recorded again on the right day; a customer return stays on the order
      for (const o of os) { o.status = 'open'; o.shippedBy = null; o.shippedAt = null; o.shipDoc = null; }
      const r = await api.shipOrders({ refs: os.map((o) => o.ref), employee: actor(), source: String(d.hdr.source ?? ''), date, as: { employee: scanner, redateOf: doc } } as Parameters<Repo['shipOrders']>[0]);
      // history line on the old sheet (on the server a reversed sheet only takes history lines)
      d.hdr._note = `${wasDone ? '' : 'اتنقل الباقي: '}${os.length} أوردر اتنقلوا لـ ${r.doc} يوم ${date}`;
      save();
      return { doc: r.doc, orders: r.shipped };
    },
    async importSettlement({ settle, source, file }) {
      guard();
      if (!settle.rows.length) fail('الشيت مفيهوش أوردرات.');
      const seen = new Set((S.settles ?? []).flatMap((s) => s.rows.map((r) => `${r.ref}|${r.type}|${r.cod}|${r.supply}`)));
      const same = (S.settles ?? []).find((s) => s.rows.length === settle.rows.length && settle.rows.every((r) => seen.has(`${r.ref}|${r.type}|${r.cod}|${r.supply}`)));
      if (same) fail(`الشيت ده اترفع قبل كده (${same.id} بتاريخ ${same.date}).`);
      const id = docNo('STL'); S.settles ??= [];
      S.settles.push({ ...structuredClone(settle), id, source, at: new Date().toISOString(), by: actor() });
      await original(id, 'settle', file); save();
      return { id, collected: settle.rows.filter((r) => r.type === 'collect').length, returned: settle.rows.filter((r) => r.type === 'return').length, due: settle.totals.due };
    },
    async deleteSettlement(id) {
      guard();
      const n = (S.settles ?? []).length; S.settles = (S.settles ?? []).filter((s) => s.id !== id);
      if (S.settles.length === n) fail('التسوية دي مش موجودة.');
      save();
    },
    async pickupDelete(id) {
      const existing=S.pickups.find((p)=>p.id===id);if(existing)unlocked(existing.date);
      if (S.orders.some((o) => o.pickupId === id && o.status === 'shipped')) fail('لا يمكن حذف بيك أب فيه أوردرات مشحونة');
      const p = S.pickups.find((p) => p.id === id); if (!p) fail('بيك أب غير معروف'); S.archivedPickups ??= []; S.archivedPickups.push({ pickup: p as Pickup, orders: S.orders.filter((o) => o.pickupId === id) }); const n = S.orders.filter((o) => o.pickupId === id).length; S.orders = S.orders.filter((o) => o.pickupId !== id); S.pickups = S.pickups.filter((p) => p.id !== id); save(); return n;
    },
    async renameShipmentEmployee(doc, name) {
      if (!name.trim()) fail('أدخل اسم الموظف'); const os = S.orders.filter((o) => o.shipDoc === doc); if (!os.length) fail('مستند شحن غير معروف');
      const sheet = S.docs.find((x) => x.no === doc); if (sheet) unlocked(sheet.date);   // a closed day keeps its team as frozen
      for (const o of os) o.shippedBy = name.trim(); const d = S.docs.find((x) => x.no === doc); if (d) { d.by = name.trim(); d.hdr.employee = name.trim(); } save(); return os.length;
    },
    async exportBackup() { if (backend) fail(SERVER_BACKUP); guard(); const media = await exportMedia(); S.lastBackup = new Date().toISOString(); save(); return { app: 'femini-stock-dashboard', version: 1, at: S.lastBackup, state: structuredClone(S) as unknown as Record<string, unknown>, media }; },
    async restoreBackup(input) {
      if (backend) fail(SERVER_BACKUP);
      guard(); const b = validateBackup(input); const previousMedia=await exportMedia(); const safe = JSON.stringify({ app: 'femini-stock-dashboard', version: 1, at: new Date().toISOString(), state: S, media: previousMedia });
      try { localStorage.setItem(`${KEY}-pre-restore`, safe); } catch { fail('لا توجد مساحة لنسخة الأمان؛ لم يبدأ الاسترجاع.'); }
      const next = structuredClone(b.state) as unknown as State; const max = Math.max(0, ...next.moves.map((m) => m.id)); next.mid = Math.max(next.mid || 0, max + 1); next.sid = Math.max(next.sid || 0, ...next.log.map((e)=>e.id+1));
      // Document counters never trail the numbers already used in the file (a hand-made or old backup may have them behind),
      // otherwise the next document would reuse an existing number.
      next.seq = { ...(next.seq ?? {}) };
      for (const no of [...next.docs.map((x) => x.no), ...next.moves.map((m) => m.doc), ...(next.holds ?? []).map((h) => h.no)]) { const m = /^([A-Z]+)-(\d+)$/.exec(no); if (m) next.seq[m[1]] = Math.max(next.seq[m[1]] ?? 0, Number(m[2])); }
      guard(); await replaceMedia(b.media); try { S = next; save(); } catch(e) { await replaceMedia(previousMedia); throw e; }
    },
    async restoreArchive(kind, id) {
      guard(); if (kind === 'draft') { const x = (S.archivedDrafts ?? []).find((d)=>d.id===id); if (!x) fail('مسودة غير معروفة'); S.drafts ??= []; S.drafts.push(x as OpDraft); S.archivedDrafts = (S.archivedDrafts ?? []).filter((d)=>d.id!==id); }
      else { const x = (S.archivedPickups ?? []).find((p)=>p.pickup.id===id); if (!x) fail('بيك أب غير معروف'); if (x) { if (S.pickups.some((p) => p.id === x.pickup.id)) fail('رقم البيك أب ده مستخدم دلوقتي؛ راجع البيك أبات قبل الاسترجاع.'); unlocked(x.pickup.date); if (x.orders.some((o)=>S.orders.some((a)=>a.ref===o.ref))) fail('يوجد أوردر بنفس الكود؛ لا يمكن الاسترجاع بدون مراجعة.'); S.pickups.push(x.pickup); S.orders.push(...x.orders); } S.archivedPickups = (S.archivedPickups ?? []).filter((p)=>p.pickup.id!==id); } save();
    },
    async closeDay(date, auto = false) {
      guard(); if (date > cairoToday()) fail('لا يمكن إغلاق يوم مستقبلي'); S.closes ??= [];
      if (backend) {   // closing a day closes every day before it too (the server's single lock)
        if (S.lock && date <= S.lock) return;
        if (!S.closes.some((c) => c.date === date && c.status === 'closed')) S.closes.push(closeRecord(date, auto));
        S.lock = date; save(); return;
      } if (S.closes.some((c)=>c.date===date && c.status==='closed')) return; S.closes.push(closeRecord(date,auto)); save(); },
    async reopenDay(date) {
      if (backend) {   // reopening a day reopens the days after it too (the server's single lock)
        if (!S.lock || date > S.lock) return; const at = new Date().toISOString();
        for (const c of S.closes ?? []) if (c.date >= date && c.date <= S.lock && c.status === 'closed') { c.status = 'reopened'; c.reopenedAt = at; }
        // The automatic close recognises "reopened today" by the day's record. A day with no moves never got one (the lock
        // simply passed it), so without this it was closed again on the very next refresh.
        S.closes ??= [];
        if (!S.closes.some((c) => c.date === date && c.status === 'reopened' && c.reopenedAt === at)) S.closes.push({ ...closeRecord(date, false), status: 'reopened', reopenedAt: at });
        S.lock = addDays(date, -1); save(); return;
      }
      guard(); const at = new Date().toISOString(); for (const c of S.closes ?? []) if (c.date === date && c.status === 'closed') { c.status = 'reopened'; c.reopenedAt = at; } save(); },
    async setAutoClose(on) { guard(); S.autoClose = on; save(); },
    async setModelCosts(model,cost,price) { guard();if(!baseModels.concat(S.cat.models).some((m)=>m.code===model))fail('موديل غير معروف');if(!Number.isFinite(cost)||!Number.isFinite(price)||cost<0||price<0)fail('التكلفة والسعر يجب أن يكونا رقمين غير سالبين');S.costs??={};S.costs[model]={cost,price};save(); },
    async resetDemo() { fail('استبدال البيانات التجريبية متوقف لحماية شغلك؛ استخدم النسخ الاحتياطي.'); },
  };
  // One action at a time. Actions await photo storage half way; if a second action ran meanwhile and failed, its rollback replaced
  // the whole state and the first action's later changes landed on the discarded copy (e.g. a cancellation lost while its stock
  // return was kept). The snapshot waits too, so it never reads or auto-saves a half-done action.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T,>(task: () => Promise<T>): Promise<T> => { const p = queue.then(task, task); queue = p.catch(() => undefined); return p; };
  return new Proxy(api, { get(target, key: keyof Repo) {
    const value = target[key]; if (typeof value !== 'function' || key === 'photoUrl') return value;
    const fn = value as (...a: unknown[]) => Promise<unknown>;
    if (key === 'snapshot') return () => serial(async () => {
      const r = await fn();
      if (backend && dirty) {
        dirty = false;
        try { await backend.persist(S); } catch (e) { console.error('[femini] automatic close not saved', e); S = backend.current(); skipAuto = true; try { return await fn(); } finally { skipAuto = false; } }
      }
      return r;
    });
    return (...args: unknown[]) => serial(async () => {
      guard(); const before = backend ? null : structuredClone(S); dirty = false;
      try {
        const r = await fn(...args);
        if (backend && dirty) { dirty = false; await backend.persist(S); }
        return r;
      } catch (e) {
        dirty = false;
        S = backend ? backend.current() : localStorage.getItem(KEY) === baseline ? before! : load();
        throw e;
      }
    });
  } });
}
export type { Loc };
