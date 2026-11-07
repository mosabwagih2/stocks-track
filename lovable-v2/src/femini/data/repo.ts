import type { Loc, OpDraft, Snapshot, SupplyRule } from '@/femini/domain/types';
import type { ParsedOrder } from '@/femini/domain/pickup';

export interface ShipResult { doc: string; shipped: number; pieces: number; negative: { sku: string; ready: number }[] }

/** Everything the UI can do. Two implementations: Supabase (RPC functions) and an in-browser demo. */
export interface Repo {
  readonly mode: 'supabase' | 'memory';
  snapshot(): Promise<Snapshot>;
  importPickup(i: { label: string; date: string; channel: string; source: string; orders: ParsedOrder[]; file?: File | null }): Promise<{ pickup: string; imported: number; duplicates: number }>;
  shipOrders(i: { refs: string[]; employee: string; source: string; file?: File | null }): Promise<ShipResult>;
  reverseShipment(doc: string): Promise<void>;
  receiveStock(i: { lines: { sku: string; qty: number }[]; date: string; ref: string; declared: number; photo: File }): Promise<{ doc: string; pieces: number }>;
  moveState(i: { lines: { sku: string; qty: number }[]; from: Loc; to: Loc; reason: string }): Promise<{ doc: string; pieces: number }>;
  /** any stock operation (RCV, RTN, SHP, CLN, FSD, FRC, CNT, LOS); rules in domain/ops.ts */
  postOp(i: { type: import('@/femini/domain/ops').OpType; date: string; hdr: import('@/femini/domain/ops').OpHdr; lines: import('@/femini/domain/ops').OpLine[]; photo?: File | null }): Promise<{ doc: string; pieces: number }>;
  /** shop delivery is confirmed only with the signed delivery-note photo */
  holdOut(i: { who: string; note: string; reason: import('@/femini/domain/holds').HoldReason; reasonText: string; lines: { sku: string; q: number }[]; photo: File | null }): Promise<string>;
  holdSettle(i: { no: string; ret: { sku: string; q: number; to: Loc }[]; off: { sku: string; q: number }[]; note: string; photo: File | null }): Promise<{ closed: boolean }>;
  confirmShopDelivery(doc: string, photo: File): Promise<void>;
  saveDraft(d: Omit<OpDraft, 'id' | 'updatedAt'> & { id?: string }): Promise<string>;
  deleteDraft(id: string): Promise<void>;
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
  exportBackup(): Promise<import('./backup').Backup>;
  restoreBackup(backup: import('./backup').Backup): Promise<void>;
  restoreArchive(kind: 'pickup' | 'draft', id: string): Promise<void>;
  closeDay(date: string, auto?: boolean): Promise<void>;
  reopenDay(date: string): Promise<void>;
  setAutoClose(on: boolean): Promise<void>;
  setModelCosts(model: string, cost: number, price: number): Promise<void>;
  resetDemo?(): Promise<void>;
}
export const ACTOR = 'مصعب';
