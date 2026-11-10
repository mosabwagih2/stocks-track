import type { Order, Snapshot } from './types';
import { cairoDay, dayDiff } from './dates';
import type { Settlement } from './settle';

/**
 * «تقفيل يوم المخزن»: every order counted on the day it LEFT the warehouse (the scan day), whatever day its money
 * came on. A day is closed when every order that left on it is collected or came back. Pure.
 *
 * Per order, the settlement rows of the same waybill are added up (a correction row adds to its order):
 *  - collected: it has a collect row (delivered and paid). Money: total (customer paid), fees, cod (net), supply (Fémini).
 *  - returned: a return / partial row and no collect row, or a customer-return document (RTN) in the warehouse.
 *  - pending: neither yet.
 *
 * A day CLOSES when none of its orders is pending; it closed on the last day anything on it was collected or came back
 * (`closedOn`). A day still open after LATE_WARN days is late, after LATE_CRIT days very late (`lateLevel`).
 */
export const LATE_WARN = 7;
export const LATE_CRIT = 10;
/** 0 fine, 1 late (7+ days open), 2 very late (10+) */
export const lateLevel = (age: number): 0 | 1 | 2 => (age >= LATE_CRIT ? 2 : age >= LATE_WARN ? 1 : 0);
export type WhState = 'collected' | 'returned' | 'pending';
export interface WhOrder { ref: string; /** the day it left the warehouse */ day: string; waybill: string; pieces: number; expected: number; state: WhState; sales: number; fees: number; cod: number; due: number; stl: string[]; on: string; /** the day it closed (collected / came back), '' while pending */ closedOn: string }
export interface WhDay {
  day: string; orders: number; pieces: number; expected: number;
  collected: number; returned: number; pending: number; pendingValue: number;
  /** pieces in each state, and what the returned orders were worth (their order total) */
  collectedPieces: number; returnedPieces: number; pendingPieces: number; returnedValue: number;
  /** the last day anything on this day was collected or came back, once nothing is pending; '' while open */
  closedOn: string;
  sales: number; fees: number; cod: number; due: number;
  /** which settlement days paid this day's orders, and how many each */
  paidOn: { date: string; n: number }[];
  list: WhOrder[];
}

export function orderMoney(settles: Settlement[]) {
  const by = new Map<string, { collect: boolean; ret: boolean; total: number; fees: number; cod: number; due: number; stl: Set<string>; on: string; retOn: string }>();
  for (const s of [...settles].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    for (const r of s.rows) {
      const e = by.get(r.ref) ?? { collect: false, ret: false, total: 0, fees: 0, cod: 0, due: 0, stl: new Set<string>(), on: '', retOn: '' };
      if (r.type === 'collect') { e.collect = true; if (!e.on) e.on = r.date || s.date; }
      if (r.type === 'return' || r.type === 'partial') { e.ret = true; if (!e.retOn) e.retOn = r.date || s.date; }
      if (r.type === 'collect' || r.type === 'adjust') { e.total += r.total || 0; e.fees += r.fees || 0; e.cod += r.cod || 0; e.due += r.supply || 0; }
      e.stl.add(s.id); by.set(r.ref, e);
    }
  }
  return by;
}

export function warehouseDays(s: Pick<Snapshot, 'orders' | 'settles'>, from: string, to: string): WhDay[] {
  const money = orderMoney(s.settles ?? []);
  const days = new Map<string, WhDay>();
  for (const o of s.orders as Order[]) {
    if (!o.shippedAt || (o.status !== 'shipped' && !o.returned)) continue;   // left the warehouse (a later cancel keeps it out)
    if (o.status === 'cancelled') continue;
    const day = cairoDay(o.shippedAt); if (day < from || day > to) continue;
    const m = money.get(o.ref);
    const state: WhState = m?.collect ? 'collected' : m?.ret || o.returned ? 'returned' : 'pending';
    const closedOn = state === 'collected' ? m!.on : state === 'returned' ? (m?.retOn || (o.returned?.at ? cairoDay(o.returned.at) : '')) : '';
    const w: WhOrder = { ref: o.ref, day, closedOn, waybill: o.waybill, pieces: o.lines.length, expected: o.total || 0, state, sales: m?.total ?? 0, fees: m?.fees ?? 0, cod: m?.cod ?? 0, due: m?.due ?? 0, stl: m ? [...m.stl] : [], on: m?.on ?? '' };
    const d = days.get(day) ?? { day, orders: 0, pieces: 0, expected: 0, collected: 0, returned: 0, pending: 0, pendingValue: 0, collectedPieces: 0, returnedPieces: 0, pendingPieces: 0, returnedValue: 0, closedOn: '', sales: 0, fees: 0, cod: 0, due: 0, paidOn: [], list: [] };
    d.orders++; d.pieces += w.pieces; d.expected += w.expected; d[state]++;
    if (state === 'pending') { d.pendingValue += w.expected; d.pendingPieces += w.pieces; }
    else if (state === 'returned') { d.returnedValue += w.expected; d.returnedPieces += w.pieces; }
    else d.collectedPieces += w.pieces;
    d.sales += w.sales; d.fees += w.fees; d.cod += w.cod; d.due += w.due; d.list.push(w);
    days.set(day, d);
  }
  for (const d of days.values()) {
    d.closedOn = d.pending ? '' : d.list.reduce((a, w) => (w.closedOn > a ? w.closedOn : a), '') || d.day;
    const on: Record<string, number> = {}; for (const w of d.list) if (w.state === 'collected' && w.on) on[w.on] = (on[w.on] ?? 0) + 1;
    d.paidOn = Object.entries(on).sort((a, b) => a[0].localeCompare(b[0])).map(([date, n]) => ({ date, n }));
    d.list.sort((a, b) => (a.state === b.state ? a.ref.localeCompare(b.ref) : a.state === 'pending' ? -1 : b.state === 'pending' ? 1 : a.state.localeCompare(b.state)));
  }
  return [...days.values()].sort((a, b) => b.day.localeCompare(a.day));
}

/** How late the open days are, over all days: how many are 7+ days old, and how many 10+ (for the dots on the menu). */
export function lateDays(s: Pick<Snapshot, 'orders' | 'settles'>, today: string): { level: 0 | 1 | 2; late: number; veryLate: number; oldest: number } {
  let late = 0, veryLate = 0, oldest = 0;
  for (const x of warehouseDays(s, '', today)) {
    if (!x.pending) continue;
    const age = dayDiff(x.day, today); oldest = Math.max(oldest, age);
    if (lateLevel(age) >= 1) late++;
    if (lateLevel(age) === 2) veryLate++;
  }
  return { level: veryLate ? 2 : late ? 1 : 0, late, veryLate, oldest };
}
