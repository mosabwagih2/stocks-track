import seed from './seed.json';
import { ACTOR, type Repo, type ShipResult } from './repo';
import type { CancelInfo, Doc, Loc, Move, Order, Pickup, Snapshot, Sku, Supply, SupplyEntry } from '@/domain/types';
import { balancesFromMoves, qty } from '@/domain/ledger';
import { consumption } from '@/domain/supplies';
import { findByCode } from '@/domain/orders';
import { addDays, cairoToday } from '@/domain/dates';
import { clearPhotos, getPhoto, putPhoto, shrinkImage } from './photos';

interface State {
  v: 1; mid: number; sid: number; moves: Move[]; pickups: Pickup[]; orders: Order[]; supplies: Supply[]; log: SupplyEntry[]; docs: Doc[]; seq: Record<string, number>;
}
const KEY = 'femini-web-demo-1';
const skus: Sku[] = seed.skus.map((k) => ({ id: k.id, model: k.m, color: k.c, size: k.s, minAlert: k.min ?? 0 }));
const modelOf = new Map(skus.map((k) => [k.id, k.model]));
const fail = (m: string): never => { throw new Error(m); };

function fresh(): State {
  const moves: Move[] = []; let mid = 1;
  for (const k of seed.skus) if ((k.open ?? 0) > 0) moves.push({ id: mid++, ts: `${seed.asOf}T08:00:00Z`, date: seed.asOf, sku: k.id, qty: k.open!, from: 'EXT_OPEN', to: 'READY', type: 'OPN', doc: 'OPN-0001', by: 'system', note: 'رصيد افتتاحي من جرد 29-10' });
  const pickups: Pickup[] = []; const orders: Order[] = [];
  seed.pickups.forEach((p, i) => {
    const id = `P${i + 1}`; pickups.push({ id, label: p.label, date: seed.today, channel: 'VENDOOR', source: 'ملف فيندور 2-11-2026' });
    for (const o of p.orders) orders.push({ ref: o.ref, waybill: String(o.wb), type: String(o.type).includes('استبدال') ? 'exchange' : 'new', gov: o.gov, total: o.total, lines: o.lines.slice(), unmapped: [], pickupId: id, status: 'open' });
  });
  const mk = (id: string, name: string, unit: string, pack: number, packName: string, min: number, rule: Supply['rule'], open: number) =>
    ({ s: { id, name, unit, pack, packName, minAlert: min, note: '', archived: false, rule } as Supply, open });
  const sup = [
    mk('FLY', 'فلاير الشحن', 'قطعة', 1, '', 300, { kind: 'order', qty: 1 }, 2000),
    mk('PKS', 'تغليف فيميني S', 'قطعة', 1, '', 100, { kind: 'range', qty: 1, from: 1, to: 2 }, 600),
    mk('PKM', 'تغليف فيميني M', 'قطعة', 1, '', 100, { kind: 'range', qty: 1, from: 3, to: 5 }, 600),
    mk('PKL', 'تغليف فيميني L', 'قطعة', 1, '', 100, { kind: 'range', qty: 1, from: 6, to: 0 }, 300),
    mk('CUP', 'كاسات البرا', 'كاسة', 24, 'كيس', 200, { kind: 'pieces', qty: 2, model: 'BR1' }, 960),
  ];
  let sid = 1; const log: SupplyEntry[] = sup.map((x) => ({ id: sid++, date: seed.asOf, item: x.s.id, qty: x.open, kind: 'open', why: 'رصيد افتتاحي تجريبي. عدّله بجرد', doc: null, by: 'system', reversed: false }));
  return { v: 1, mid, sid, moves, pickups, orders, supplies: sup.map((x) => x.s), log, docs: [], seq: { OPN: 1 } };
}
function load(): State {
  try { const r = localStorage.getItem(KEY); if (r) { const s = JSON.parse(r) as State; if (s.v === 1) return s; } } catch { /* ignore */ }
  return fresh();
}

export function createMemoryRepo(): Repo {
  let S = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* quota */ } };
  const docNo = (t: string) => { S.seq[t] = (S.seq[t] ?? 0) + 1; return `${t}-${String(S.seq[t]).padStart(4, '0')}`; };
  const bal = () => balancesFromMoves(S.moves);
  const post = (rows: Omit<Move, 'id' | 'ts'>[]) => { for (const r of rows) S.moves.push({ ...r, id: S.mid++, ts: new Date().toISOString() }); };
  const supPush = (item: string, q: number, kind: SupplyEntry['kind'], why: string, doc: string | null = null, date = cairoToday()): SupplyEntry => {
    const e: SupplyEntry = { id: S.sid++, date, item, qty: q, kind, why, doc, by: ACTOR, reversed: false }; S.log.push(e); return e;
  };
  const supBal = (id: string) => S.log.reduce((a, e) => a + (e.item === id ? e.qty : 0), 0);
  const agg = (lines: string[]) => { const a: Record<string, number> = {}; for (const s of lines) a[s] = (a[s] ?? 0) + 1; return a; };

  return {
    mode: 'memory',
    async snapshot(): Promise<Snapshot> {
      const colors = [...new Map(skus.map((k) => [k.color, k.color])).keys()].map((ar) => ({ code: ar, ar }));
      // copies, so React Query's structural sharing can see in-place edits of the demo state
      const c = structuredClone({ pickups: S.pickups, orders: S.orders, supplies: S.supplies, supplyLog: S.log, docs: S.docs, moves: S.moves.slice(-400).reverse() });
      return { today: cairoToday(), models: seed.models.map((m) => ({ code: m.code, name: m.name })), skus, balances: bal(), ...c, colors, sizes: seed.sizes };
    },
    async importPickup(i) {
      const id = `P${S.pickups.reduce((a, p) => Math.max(a, +p.id.slice(1) || 0), 0) + 1}`;
      S.pickups.push({ id, label: i.label, date: i.date, channel: i.channel, source: i.source });
      const have = new Set(S.orders.map((o) => o.ref)); let n = 0; let d = 0;
      for (const o of i.orders) { if (have.has(o.ref)) { d++; continue; } have.add(o.ref); S.orders.push({ ...o, pickupId: id, status: 'open' }); n++; }
      save(); return { pickup: id, imported: n, duplicates: d };
    },
    async shipOrders({ refs, employee, source }): Promise<ShipResult> {
      const emp = employee.trim(); if (!emp) fail('اكتب اسم الموظف');
      const os = S.orders.filter((o) => refs.includes(o.ref) && o.status === 'open'); if (!os.length) fail('مفيش أوردرات مفتوحة في اللي اخترته');
      const doc = docNo('SCN'); const a = agg(os.flatMap((o) => o.lines));
      post(Object.keys(a).map((sku) => ({ date: cairoToday(), sku, qty: a[sku], from: 'READY' as const, to: 'EXT_CH' as const, type: 'SCN', doc, by: emp, note: `سكان: ${emp} (${source})` })));
      const sup: Record<string, number> = {};
      for (const o of os) { o.status = 'shipped'; o.shippedBy = emp; o.shippedAt = new Date().toISOString(); o.shipDoc = doc; for (const c of consumption(o.lines, S.supplies, (s) => modelOf.get(s) ?? '')) sup[c.item] = (sup[c.item] ?? 0) + c.qty; }
      for (const item of Object.keys(sup)) supPush(item, -sup[item], 'auto', `سكان ${emp}: ${os.length} أوردر`, doc);
      const b = bal(); const negative = Object.keys(a).map((sku) => ({ sku, ready: qty(b, sku, 'READY') })).filter((x) => x.ready < 0);
      save(); return { doc, shipped: os.length, pieces: os.reduce((x, o) => x + o.lines.length, 0), negative };
    },
    async reverseShipment(doc) {
      const rev = `${doc} (عكس)`; if (S.moves.some((m) => m.doc === rev)) fail('العملية اتعكست قبل كده');
      const orig = S.moves.filter((m) => m.doc === doc && m.type === 'SCN'); if (!orig.length) fail('مستند مش معروف');
      post(orig.map((m) => ({ date: cairoToday(), sku: m.sku, qty: m.qty, from: m.to, to: m.from, type: 'SCN', doc: rev, by: ACTOR, note: `عكس ${doc}` })));
      for (const o of S.orders) if (o.shipDoc === doc) { o.status = 'open'; o.shippedBy = null; o.shippedAt = null; o.shipDoc = null; }
      for (const e of S.log.filter((x) => x.doc === doc && x.kind === 'auto' && !x.reversed)) { supPush(e.item, -e.qty, 'rev', `reverse ${doc}`, rev); e.reversed = true; }
      save();
    },
    async receiveStock({ lines, date, ref, declared, photo }) {
      const total = lines.reduce((a, l) => a + l.qty, 0);
      if (total <= 0) fail('مفيش قطع'); if (declared !== total) fail(`المكتوب في الورقة (${declared}) مش بيساوي المضاف (${total})`);
      const today = cairoToday(); if (date > today || date < addDays(today, -3)) fail('التاريخ لازم يكون ضمن آخر 3 أيام');
      const no = docNo('RCV'); const path = `documents/${no}.jpg`; await putPhoto(path, await shrinkImage(photo));
      post(lines.filter((l) => l.qty > 0).map((l) => ({ date, sku: l.sku, qty: l.qty, from: 'EXT_FACTORY' as const, to: 'READY' as const, type: 'RCV', doc: no, by: ACTOR, note: `استلام ${ref}` })));
      S.docs.push({ no, type: 'RCV', date, by: ACTOR, status: 'done', hdr: { ref, declared }, lines, attachment: path }); save(); return { doc: no, pieces: total };
    },
    async moveState({ lines, from, to, reason }) {
      if (from === to) fail('نفس الحالة'); const b = bal();
      for (const l of lines) if (qty(b, l.sku, from) < l.qty) fail(`المتاح ${qty(b, l.sku, from)} بس`);
      const no = docNo('MOV'); const pcs = lines.reduce((a, l) => a + l.qty, 0);
      post(lines.filter((l) => l.qty > 0).map((l) => ({ date: cairoToday(), sku: l.sku, qty: l.qty, from, to, type: 'MOV', doc: no, by: ACTOR, note: reason })));
      S.docs.push({ no, type: 'MOV', date: cairoToday(), by: ACTOR, status: 'done', hdr: { from, to, reason }, lines }); save(); return { doc: no, pieces: pcs };
    },
    async cancelOrder({ code, reason, returnStock, photo }) {
      const o = findByCode(S.orders, code); if (!o) fail('مفيش أوردر بالكود ده'); const ord = o as Order;
      if (ord.status === 'cancelled') fail('الأوردر اتلغى قبل كده');
      const was = ord.status as 'open' | 'shipped'; const path = `documents/cancel-${ord.ref}.jpg`; await putPhoto(path, await shrinkImage(photo));
      let doc: string | null = null;
      if (was === 'shipped' && returnStock) {
        doc = docNo('CXL'); const a = agg(ord.lines);
        post(Object.keys(a).map((sku) => ({ date: cairoToday(), sku, qty: a[sku], from: 'EXT_CH' as const, to: 'READY' as const, type: 'CXL', doc: doc!, by: ACTOR, note: `إلغاء أوردر ${ord.ref}` })));
        for (const c of consumption(ord.lines, S.supplies, (s) => modelOf.get(s) ?? '')) supPush(c.item, c.qty, 'rev', `إلغاء أوردر ${ord.ref}`, doc);
      }
      const cancel: CancelInfo = { at: new Date().toISOString(), by: ACTOR, reason, was, returned: was === 'shipped' && returnStock, doc, attachment: path };
      ord.status = 'cancelled'; ord.cancel = cancel; save(); return { ref: ord.ref, returned: cancel.returned };
    },
    async restoreOrder(ref) {
      const o = S.orders.find((x) => x.ref === ref && x.status === 'cancelled'); if (!o) return fail('الأوردر مش ملغي');
      o.status = o.cancel?.was === 'shipped' && !o.cancel.returned ? 'shipped' : 'open'; o.cancel = null; save();
    },
    async supplyMove({ item, kind, qty: q, why }) {
      const bal0 = supBal(item); let delta = 0;
      if (kind === 'rcv') { if (q <= 0) fail('الكمية لازم أكبر من صفر'); delta = q; }
      else if (kind === 'issue') { if (q <= 0) fail('الكمية لازم أكبر من صفر'); if (q > bal0) fail(`مينفعش تصرف ${q} والرصيد ${bal0}`); delta = -q; }
      else { if (q < 0) fail('العدد مينفعش سالب'); delta = q - bal0; if (delta === 0) fail('العدد مطابق للرصيد'); }
      const e = supPush(item, delta, kind, why); save(); return { id: e.id, delta, balance: bal0 + delta };
    },
    async undoSupplyMove(id) {
      const e = S.log.find((x) => x.id === id && ['rcv', 'issue', 'count', 'open'].includes(x.kind) && !x.reversed); if (!e) return fail('مفيش حاجة تتراجع');
      supPush(e.item, -e.qty, 'rev', `تراجع عن: ${e.why}`); e.reversed = true; save();
    },
    async photoUrl(path) { const b = await getPhoto(path); return b ? URL.createObjectURL(b) : null; },
    async resetDemo() { await clearPhotos(); S = fresh(); save(); },
  };
}
export type { Loc };
