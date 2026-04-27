# ADR 0002 — Multi-tenancy via Postgres RLS

- **Status:** Accepted
- **Date:** 2026-04-25
- **Owner:** Aureon

## Context

Multi-tenant SaaS demands strict tenant isolation. Application-level checks alone are not enough — one missed guard in a handler is a cross-tenant leak. We also need staff (Aureon support) to occasionally query across tenants.

## Decision

Three-layer defence (AGENTS.md §7):

1. **Postgres Row-Level Security (RLS)** on every tenant-owned table. Policies key off `current_setting('app.current_tenant_id')`.
2. **Application middleware** sets `app.current_tenant_id` from the session at the start of every request (and inside `withTenantContext` for transactions).
3. **Tenant guard** in handlers (belt + suspenders).

Two distinct connection pools:
- `db` — RLS enforced. User-facing handlers use only this.
- `dbAdmin` — `BYPASSRLS` role. Internal staff tooling only; never exposed to user-facing routes.

## Consequences

- ✅ Catastrophic failure mode (forgetting a tenant filter in a query) becomes impossible — RLS blocks the read.
- ✅ Audit triggers can also rely on `app.current_tenant_id` for attribution.
- ❌ RLS adds query plan complexity; we mitigate with composite indexes starting on `tenant_id`.
- ❌ Connection pooling discipline matters — `set_config(...)` must use `set local` inside transactions or `set` per-request.

## Alternatives considered

- **Schema-per-tenant** — operationally painful at 100+ tenants (migrations, backups, monitoring).
- **DB-per-tenant** — even worse operationally; only justified for compliance carve-outs.
- **App-only checks** — single point of failure; rejected.
