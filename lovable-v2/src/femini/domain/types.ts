export type Loc = 'READY' | 'DIRTY' | 'FACTORY' | 'SCRAP' | 'LOST';
export type ExtLoc = 'EXT_OPEN' | 'EXT_FACTORY' | 'EXT_CH' | 'EXT_SHOP' | 'EXT_ADJ' | 'EXT_OFF' | 'EXT_HOLD';
export type AnyLoc = Loc | ExtLoc;

export interface Model { code: string; name: string; /** data URL (demo) or storage path (Supabase) of the square product photo */ image?: string | null }
export interface Sku { id: string; model: string; color: string; size: string; minAlert: number }

export interface Move {
  id: number; ts: string; date: string; sku: string; qty: number;
  from: AnyLoc; to: AnyLoc; type: string; doc: string; by: string; note: string;
}

export type OrderStatus = 'open' | 'shipped' | 'cancelled';
export interface CancelInfo {
  at: string; by: string; reason: string; was: 'open' | 'shipped'; returned: boolean; doc?: string | null; attachment?: string;
}
export interface Order {
  ref: string; waybill: string; type: 'new' | 'exchange'; gov: string; total: number;
  /** one SKU id per piece */
  lines: string[];
  /** lines that could not be mapped to the catalog while importing */
  unmapped: unknown[];
  pickupId: string; status: OrderStatus;
  shippedBy?: string | null; shippedAt?: string | null; shipDoc?: string | null;
  cancel?: CancelInfo | null;
  /** set when a return (RTN) was confirmed for this order */
  returned?: { doc: string; at: string } | null;
}
export interface Pickup { id: string; label: string; date: string; channel: string; source: string }
export interface OriginalFile { id: string; owner: string; kind: string; name: string; mime: string; size: number; at: string; path: string }
export interface DayClose { date: string; at: string; by: string; auto: boolean; status: 'closed' | 'reopened'; summary: Record<string, number>; report?: { requestedOrders: number; open: number; blocked: number; team: [string, number][] } }

export type SupplyRule =
  | { kind: 'none' }
  | { kind: 'order'; qty: number }
  | { kind: 'pieces'; qty: number; model?: string }
  | { kind: 'range'; qty: number; from: number; to: number };
export interface Supply {
  id: string; name: string; unit: string; pack: number; packName: string; minAlert: number; note: string; archived: boolean; rule: SupplyRule;
}
export type SupplyKind = 'open' | 'rcv' | 'issue' | 'count' | 'auto' | 'rev';
export interface SupplyEntry {
  id: number; date: string; item: string; qty: number; kind: SupplyKind; why: string; doc: string | null; by: string; reversed: boolean;
}

export interface Doc {
  no: string; type: string; date: string; by: string; status: 'done' | 'reversed';
  hdr: Record<string, unknown>; lines: { sku: string; qty: number }[]; attachment?: string | null;
}

export type Balances = Record<string, Partial<Record<Loc, number>>>;

export interface Snapshot {
  today: string;
  models: Model[];
  skus: Sku[];
  /** removed (archived) variants, kept for the history and for restoring */
  archivedSkus: Sku[];
  balances: Balances;
  pickups: Pickup[];
  orders: Order[];
  supplies: Supply[];
  supplyLog: SupplyEntry[];
  docs: Doc[];
  /** unfinished operations saved to finish later */
  drafts: OpDraft[];
  /** shop names used before */
  shops: string[];
  /** most recent ledger rows (newest first) */
  moves: Move[];
  colors: { code: string; ar: string }[];
  sizes: string[];
  files: OriginalFile[];
  archivedPickups: { pickup: Pickup; orders: Order[] }[];
  archivedDrafts: OpDraft[];
  holds: import('./holds').Hold[];
  closes: DayClose[];
  autoClose: boolean;
  lastBackup: string | null;
  costs: Record<string, { cost: number; price: number }>;
}

export interface OpDraft { id: string; type: string; date: string; hdr: Record<string, unknown>; lines: Record<string, unknown>[]; updatedAt: string }
