/**
 * Per-entity conflict resolution. AGENTS.md §8.5.
 *
 * Encoded as small `Resolver`s; the sync engine looks up by entity kind.
 */

export type Resolver<TServer, TClient = TServer> = (args: {
  server: TServer | null;
  client: TClient;
}) => TServer | TClient;

/** Terminal wins for closed-state entities (orders, items, payments). */
export const terminalWins: Resolver<unknown> = ({ client }) => client;

/** Server wins (menu, settings, customer profile fields). */
export const serverWins: Resolver<unknown> = ({ server, client }) => server ?? client;

/** Sum of deltas — used for inventory. Both sides record deltas, never absolutes. */
export type DeltaState = { quantityMilli: bigint };
export type DeltaOp = { deltaMilli: bigint };

export function applyDelta(state: DeltaState, op: DeltaOp): DeltaState {
  return { quantityMilli: state.quantityMilli + op.deltaMilli };
}

/** Customer: server wins for profile fields, client wins for last-visit / loyalty deltas. */
export type CustomerLike = {
  fullName: string;
  email: string | null;
  phoneHash: string | null;
  lastVisitAt: string | null;
  visitCount: number;
};

export const customerResolver: Resolver<CustomerLike> = ({ server, client }) => {
  if (!server) return client;
  return {
    fullName: server.fullName,
    email: server.email,
    phoneHash: server.phoneHash,
    // Client wins on activity counters (it has the freshest visit data).
    lastVisitAt:
      laterIso(server.lastVisitAt, client.lastVisitAt) ?? server.lastVisitAt ?? client.lastVisitAt,
    visitCount: Math.max(server.visitCount, client.visitCount),
  };
};

function laterIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export type EntityKind =
  | 'order'
  | 'order_item'
  | 'payment'
  | 'menu_item'
  | 'menu_category'
  | 'modifier_group'
  | 'inventory_stock'
  | 'customer'
  | 'shift'
  | 'cash_movement'
  | 'settings';

export const RESOLVERS: Partial<Record<EntityKind, Resolver<unknown>>> = {
  order: terminalWins,
  order_item: terminalWins,
  payment: terminalWins,
  shift: terminalWins,
  cash_movement: terminalWins,
  menu_item: serverWins,
  menu_category: serverWins,
  modifier_group: serverWins,
  settings: serverWins,
  customer: customerResolver as Resolver<unknown>,
  // inventory uses delta math, not a regular resolver — handled by `applyDelta`.
};
