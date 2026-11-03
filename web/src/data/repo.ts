import type { Loc, Snapshot } from '@/domain/types';
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
  resetDemo?(): Promise<void>;
}
export const ACTOR = 'مصعب';
