import type { Loc, Snapshot, SupplyRule } from '@/domain/types';
import type { ParsedOrder } from '@/domain/pickup';

export interface ShipResult { doc: string; shipped: number; pieces: number; negative: { sku: string; ready: number }[] }

/** Everything the UI can do. Two implementations: Supabase (RPC functions) and an in-browser demo. */
export interface Repo {
  readonly mode: 'supabase' | 'memory';
  snapshot(): Promise<Snapshot>;
  importPickup(i: { label: string; date: string; channel: string; source: string; orders: ParsedOrder[] }): Promise<{ pickup: string; imported: number; duplicates: number }>;
  shipOrders(i: { refs: string[]; employee: string; source: string }): Promise<ShipResult>;
  reverseShipment(doc: string): Promise<void>;
  receiveStock(i: { lines: { sku: string; qty: number }[]; date: string; ref: string; declared: number; photo: File }): Promise<{ doc: string; pieces: number }>;
  moveState(i: { lines: { sku: string; qty: number }[]; from: Loc; to: Loc; reason: string }): Promise<{ doc: string; pieces: number }>;
  cancelOrder(i: { code: string; reason: string; returnStock: boolean; photo: File }): Promise<{ ref: string; returned: boolean }>;
  restoreOrder(ref: string): Promise<void>;
  supplyMove(i: { item: string; kind: 'rcv' | 'issue' | 'count'; qty: number; why: string }): Promise<{ id: number; delta: number; balance: number }>;
  undoSupplyMove(id: number): Promise<void>;
  /** a displayable URL for an attachment path, or null when the file is not available */
  photoUrl(path: string): Promise<string | null>;
  // ---- product images, catalog ----
  setModelImage(code: string, file: File | null): Promise<void>;
  catalogNewModel(i: { code: string; name: string; colors: string[]; sizes: string[]; minAlert: number }): Promise<{ model: string; skus: number }>;
  catalogEditModel(i: { code: string; name: string; add: { color: string; size: string }[]; remove: string[] }): Promise<{ added: number; removed: number }>;
  catalogRemoveModel(code: string): Promise<number>;
  catalogRestore(i: { model: string; sku?: string }): Promise<number>;
  // ---- supplies administration ----
  supplySave(i: { id?: string; name: string; unit: string; pack: number; packName: string; minAlert: number; note: string; rule: SupplyRule; open: number }): Promise<string>;
  supplyArchive(id: string, archived: boolean): Promise<void>;
  // ---- pickup / shipment files ----
  pickupUpdate(i: { id: string; label: string; date: string; channel: string }): Promise<void>;
  pickupDelete(id: string): Promise<number>;
  renameShipmentEmployee(doc: string, name: string): Promise<number>;
  resetDemo?(): Promise<void>;
}
export const ACTOR = 'مصعب';
