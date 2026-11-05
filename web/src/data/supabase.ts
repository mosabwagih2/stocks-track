import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Repo, ShipResult } from './repo';
import { ACTOR } from './repo';
import type { Balances, Doc, Loc, Move, Order, Pickup, Sku, Snapshot, Supply, SupplyEntry } from '@/domain/types';
import { cairoToday } from '@/domain/dates';
import { shrinkImage } from './photos';
import { squareImage } from './image';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const PAGE = 1000; // PostgREST returns at most 1000 rows per request

async function fetchAll(sb: SupabaseClient, table: string, order = 'id'): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select('*').order(order).range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

const mapOrder = (r: Row): Order => ({
  ref: r.ref, waybill: r.waybill ?? '', type: r.type, gov: r.gov ?? '', total: Number(r.total ?? 0), lines: r.lines ?? [], unmapped: r.unmapped ?? [],
  pickupId: r.pickup_id, status: r.status, shippedBy: r.shipped_by, shippedAt: r.shipped_at, shipDoc: r.ship_doc, cancel: r.cancel,
});

/** Turns database exceptions into short Arabic messages. Unknown ones are shown as they are. */
export function friendlyError(e: unknown): string {
  const m = String((e as { message?: string })?.message ?? e);
  const map: [RegExp, string][] = [
    [/employee name is required/, 'أدخل اسم الموظف'],
    [/none of the orders is open/, 'لا توجد أوردرات مفتوحة ضمن المحدد (ربما شُحنت مسبقًا)'],
    [/photo of the signed paper is required/, 'يجب إرفاق صورة الورقة الموقّعة'],
    [/photo of the crossed-out waybill is required/, 'يجب إرفاق صورة البوليصة المشطوبة'],
    [/declared total (\d+) does not match lines total (\d+)/, 'الإجمالي المكتوب في الورقة لا يساوي المضاف'],
    [/date must be within the last 3 days/, 'يجب أن يكون التاريخ ضمن آخر 3 أيام'],
    [/not enough in/, 'الكمية غير متاحة في هذه الحالة'],
    [/no order with this code/, 'لا يوجد أوردر بهذا الكود'],
    [/order is already cancelled/, 'الأوردر ملغى مسبقًا'],
    [/cannot issue/, 'لا يمكن صرف كمية أكبر من الرصيد'],
    [/count equals the balance/, 'العدد مطابق للرصيد'],
    [/already reversed/, 'تم عكس العملية مسبقًا'],
    [/cannot remove (\S+): it has stock/, 'لا يمكن الإزالة: عليه رصيد'],
    [/cannot remove (\S+): it has open demand/, 'لا يمكن الإزالة: عليه طلب مفتوح'],
    [/model already exists/, 'كود الموديل موجود بالفعل'],
    [/bad model code/, 'كود الموديل حروف إنجليزية وأرقام، ويبدأ بحرف'],
    [/pickup has shipped orders/, 'لا يمكن حذف بيك أب فيه أوردرات مشحونة'],
  ];
  for (const [re, ar] of map) if (re.test(m)) return ar;
  return m;
}

export function createSupabaseRepo(url: string, key: string): Repo {
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const rpc = async <T,>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(friendlyError(error));
    return data as T;
  };
  const upload = async (prefix: string, file: File): Promise<string> => {
    const blob = await shrinkImage(file);
    const path = `${prefix}/${cairoToday()}-${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage.from('documents').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw new Error('تعذّر رفع الصورة: ' + error.message);
    return path;
  };

  return {
    mode: 'supabase',
    async snapshot(): Promise<Snapshot> {
      const [models, colors, skuRows, bal, pickups, orders, supplies, log, docs, moves] = await Promise.all([
        fetchAll(sb, 'models', 'code'), fetchAll(sb, 'colors', 'code'), fetchAll(sb, 'skus', 'id'), fetchAll(sb, 'stock_balances', 'sku'),
        fetchAll(sb, 'pickups', 'id'), fetchAll(sb, 'orders', 'ref'), fetchAll(sb, 'supplies', 'id'), fetchAll(sb, 'supply_log', 'id'), fetchAll(sb, 'docs', 'id'),
        sb.from('moves').select('*').order('id', { ascending: false }).limit(400).then((r) => { if (r.error) throw r.error; return r.data as Row[]; }),
      ]);
      const toSku = (r: Row): Sku => ({ id: r.id, model: r.model, color: r.color, size: r.size, minAlert: r.min_alert ?? 0 });
      const skus: Sku[] = skuRows.filter((r) => r.active).map(toSku);
      const archivedSkus: Sku[] = skuRows.filter((r) => !r.active).map(toSku);
      const balances: Balances = {};
      for (const r of bal) (balances[r.sku] ??= {})[r.loc as Loc] = r.qty;
      const sizes = [...new Set(skus.map((s) => s.size))];
      const sizeOrder = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
      sizes.sort((a, b) => (sizeOrder.indexOf(a) + 99) % 99 - (sizeOrder.indexOf(b) + 99) % 99);
      return {
        today: cairoToday(),
        models: models.filter((m) => m.active).map((m) => ({ code: m.code, name: m.name, image: m.image ?? null })),
        colors: colors.map((c) => ({ code: c.code, ar: c.ar })), sizes, skus, archivedSkus, balances,
        pickups: pickups.map((p): Pickup => ({ id: p.id, label: p.label, date: p.pickup_date, channel: p.channel, source: p.source })),
        orders: orders.map(mapOrder),
        supplies: supplies.map((s): Supply => ({ id: s.id, name: s.name, unit: s.unit, pack: s.pack, packName: s.pack_name, minAlert: s.min_alert, note: s.note, archived: s.archived, rule: s.rule })),
        supplyLog: log.map((e): SupplyEntry => ({ id: e.id, date: e.log_date, item: e.item, qty: e.qty, kind: e.kind, why: e.why, doc: e.doc, by: e.by, reversed: e.reversed })),
        docs: docs.map((d): Doc => ({ no: d.no, type: d.type, date: d.doc_date, by: d.by, status: d.status, hdr: d.hdr, lines: d.lines, attachment: d.attachment })),
        moves: moves.map((m): Move => ({ id: m.id, ts: m.ts, date: m.move_date, sku: m.sku, qty: m.qty, from: m.from_loc, to: m.to_loc, type: m.type, doc: m.doc, by: m.by, note: m.note })),
      };
    },
    async importPickup(i) {
      return rpc('import_pickup', { p_label: i.label, p_date: i.date, p_channel: i.channel, p_source: i.source, p_orders: i.orders });
    },
    async shipOrders({ refs, employee, source }) {
      return rpc<ShipResult>('ship_orders', { p_refs: refs, p_employee: employee, p_source: source });
    },
    async reverseShipment(doc) { await rpc('reverse_shipment', { p_doc: doc, p_by: ACTOR }); },
    async receiveStock({ lines, date, ref, declared, photo }) {
      const path = await upload('receipts', photo);
      return rpc('receive_stock', { p_lines: lines, p_date: date, p_by: ACTOR, p_ref: ref, p_declared: declared, p_attachment: path });
    },
    async moveState({ lines, from, to, reason }) {
      return rpc('move_state', { p_lines: lines, p_from: from, p_to: to, p_by: ACTOR, p_reason: reason });
    },
    async cancelOrder({ code, reason, returnStock, photo }) {
      const path = await upload('cancellations', photo);
      return rpc('cancel_order', { p_code: code, p_reason: reason, p_by: ACTOR, p_return: returnStock, p_attachment: path });
    },
    async restoreOrder(ref) { await rpc('restore_order', { p_ref: ref, p_by: ACTOR }); },
    async supplyMove({ item, kind, qty, why }) {
      return rpc('supply_move', { p_item: item, p_kind: kind, p_qty: qty, p_why: why, p_by: ACTOR });
    },
    async undoSupplyMove(id) { await rpc('undo_supply_move', { p_id: id, p_by: ACTOR }); },
    async setModelImage(code, file) {
      if (!file) { await rpc('set_model_image', { p_code: code, p_path: '' }); return; }
      const path = `models/${code}-${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from('documents').upload(path, await squareImage(file), { contentType: 'image/jpeg' });
      if (error) throw new Error('تعذّر رفع الصورة: ' + error.message);
      await rpc('set_model_image', { p_code: code, p_path: path });
    },
    async catalogNewModel(i) { return rpc('catalog_new_model', { p_code: i.code, p_name: i.name, p_colors: i.colors, p_sizes: i.sizes, p_min: i.minAlert }); },
    async catalogEditModel(i) { return rpc('catalog_edit_model', { p_code: i.code, p_name: i.name, p_add: i.add, p_remove: i.remove }); },
    async catalogRemoveModel(code) { return rpc('catalog_remove_model', { p_code: code }); },
    async catalogRestore({ model, sku }) { return rpc('catalog_restore', { p_model: model, p_sku: sku ?? null }); },
    async supplySave(i) {
      return rpc('supply_save', { p_id: i.id ?? null, p_name: i.name, p_unit: i.unit, p_pack: i.pack, p_pack_name: i.packName, p_min: i.minAlert, p_note: i.note, p_rule: i.rule, p_open: i.open, p_by: ACTOR });
    },
    async supplyArchive(id, archived) { await rpc('supply_archive', { p_id: id, p_archived: archived }); },
    async pickupUpdate(i) { await rpc('pickup_update', { p_id: i.id, p_label: i.label, p_date: i.date, p_channel: i.channel }); },
    async pickupDelete(id) { return rpc('pickup_delete', { p_id: id }); },
    async renameShipmentEmployee(doc, name) { return rpc('rename_shipment_employee', { p_doc: doc, p_name: name }); },
    async photoUrl(path) {
      const { data, error } = await sb.storage.from('documents').createSignedUrl(path, 3600);
      return error ? null : data.signedUrl;
    },
  };
}
