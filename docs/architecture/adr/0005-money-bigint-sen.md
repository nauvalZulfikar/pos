# ADR 0005 — Money as bigint sen, never floats

- **Status:** Accepted
- **Date:** 2026-04-25
- **Owner:** Aureon

## Context

POS arithmetic is unforgiving: floats lose precision, `numeric` is slow at scale, mixing the two creates rounding mismatches between client and server. PPN 11% on lots of small items compounds float drift fast.

## Decision

All money values are stored as **`bigint` minor units (sen)**. IDR has 2 nominal decimals → we multiply by 100. PPN is computed via `bps()` helper using banker's rounding (half-to-even). All math lives in `packages/domain/src/money.ts`.

Rules (also in AGENTS.md §27.2):
- No `number` for money. Ever.
- No `numeric` / `decimal` in Postgres for money columns.
- Display conversion only happens at the leaf: `formatIDR(sen)` for output, `fromRupiah(input)` for parse.

## Consequences

- ✅ Client and server compute identical totals.
- ✅ JSON-safe: bigint serialized as string at the API boundary; deserialized via Zod.
- ❌ All arithmetic is verbose (`a + b` requires both to be bigint).
- ❌ Some libs assume `number`; we wrap them.

## Alternatives considered

- **`dinero.js` v2** — we still use it for the `Currency` abstraction in some places, but the storage representation is integer sen.
- **Postgres `numeric(20,2)`** — operationally fine, but doubles the surface area for client/server drift; rejected.
- **JS floats** — never. Past projects have lost money to this; not repeating.
