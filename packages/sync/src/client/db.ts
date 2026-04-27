/**
 * IndexedDB schema for the kasir terminal. Dexie-backed.
 *
 * Stores:
 *   - menu, modifierGroups, outlets, tables — read-mostly cache.
 *   - orders, orderItems, payments, shifts, cashMovements — write cache.
 *   - opsPending — sync outbox (drained by the worker).
 *   - opsApplied — kept for 7 days for forensics, then GC'd.
 */

import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { Op, OpResult } from '@desain/types';

export type CachedRow = {
  id: string;
  tenantId: string;
  outletId?: string;
  data: unknown;
  updatedAt: string;
};

export type AppliedOp = Op & {
  status: 'applied' | 'duplicate';
  receivedAt: string;
};

export class TerminalDB extends Dexie {
  menuCategories!: Table<CachedRow, string>;
  menuItems!: Table<CachedRow, string>;
  modifierGroups!: Table<CachedRow, string>;
  outlets!: Table<CachedRow, string>;
  // `posTables` not `tables` — Dexie's base class owns `tables` (Table[]).
  posTables!: Table<CachedRow, string>;
  orders!: Table<CachedRow, string>;
  orderItems!: Table<CachedRow, string>;
  payments!: Table<CachedRow, string>;
  shifts!: Table<CachedRow, string>;
  cashMovements!: Table<CachedRow, string>;
  customers!: Table<CachedRow, string>;
  opsPending!: Table<Op, string>;
  opsApplied!: Table<AppliedOp, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor(name = 'desain-pos') {
    super(name);
    this.version(1).stores({
      menuCategories: 'id, tenantId, updatedAt',
      menuItems: 'id, tenantId, updatedAt',
      modifierGroups: 'id, tenantId, updatedAt',
      outlets: 'id, tenantId',
      posTables: 'id, tenantId, outletId',
      orders: 'id, tenantId, outletId, [tenantId+outletId+status], updatedAt',
      orderItems: 'id, tenantId, [tenantId+orderId], updatedAt',
      payments: 'id, tenantId, [tenantId+orderId], updatedAt',
      shifts: 'id, tenantId, [tenantId+outletId+status], updatedAt',
      cashMovements: 'id, tenantId, [tenantId+shiftId]',
      customers: 'id, tenantId, phoneHash, updatedAt',
      opsPending: 'clientOpId, [tenantId+outletId+shiftId], clientAt',
      opsApplied: 'clientOpId, receivedAt',
      meta: 'key',
    });
  }
}

let _db: TerminalDB | null = null;

export function getTerminalDb(): TerminalDB {
  if (!_db) _db = new TerminalDB();
  return _db;
}

/** For tests: replace the global instance with a named one. */
export function _setTerminalDb(name: string): TerminalDB {
  _db = new TerminalDB(name);
  return _db;
}

export function _resetTerminalDb(): void {
  _db = null;
}

export function appliedToCacheTable(kind: string, db: TerminalDB): Table<CachedRow, string> | null {
  const map: Record<string, Table<CachedRow, string>> = {
    menu_category: db.menuCategories,
    menu_item: db.menuItems,
    modifier_group: db.modifierGroups,
    outlet: db.outlets,
    table: db.posTables,
    order: db.orders,
    order_item: db.orderItems,
    payment: db.payments,
    shift: db.shifts,
    cash_movement: db.cashMovements,
    customer: db.customers,
  };
  return map[kind] ?? null;
}

export type { OpResult };
