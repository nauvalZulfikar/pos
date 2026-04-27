# ADR 0003 — Sync engine: outbox + idempotent server, NOT CRDT

- **Status:** Accepted
- **Date:** 2026-04-25
- **Owner:** Aureon

## Context

The kasir terminal must operate offline for 8+ hours and sync when connectivity returns. Conflicts can occur when the same shift runs across multiple devices, or when admin edits the menu while a terminal is offline.

CRDTs (Yjs, Automerge) solve a more general problem than we have: orders are owned by a single shift on a single device, so true concurrent edits on the same row are rare.

## Decision

**Outbox + idempotent server**, with per-entity conflict resolution (AGENTS.md §8.5):

- Terminal generates an `Op` for every mutation. Op includes `client_op_id` (UUIDv7), `client_at`, `device_id`.
- Op is applied to local Dexie cache immediately (optimistic), then pushed to `ops_pending`.
- Sync worker drains `ops_pending` to the server in client-time order.
- Server endpoint is keyed on `client_op_id` — duplicates are no-ops.
- Per-entity resolvers:
  - Order/Items/Payments → terminal wins.
  - Menu/Settings → server wins.
  - Inventory → both record deltas; never absolutes.
  - Customer → server wins on profile fields, client wins on activity counters.

## Consequences

- ✅ Implementation fits in `~500 LOC`. CRDT framework would be 5-10× more.
- ✅ Easy to reason about: every mutation is a discrete op.
- ✅ Server canonical state is always authoritative for reporting.
- ❌ Truly concurrent edits on the same field of the same row would silently apply terminal-wins (not a real concern given our access patterns, but documented here).
- ❌ Inventory delta math means the server never sees absolute "stock = 12 kg" from the client; only deltas. Reconciliation requires sums.

## Alternatives considered

- **CRDT (Yjs/Automerge)** — overkill, framework lock-in, harder to debug.
- **Last-write-wins** — loses data when two devices edit the same order.
- **Session token with optimistic lock** — requires constant connectivity, defeats the purpose.
