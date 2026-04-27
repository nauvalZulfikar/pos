# AGENTS.md — DESAIN POS

Single source of truth for AI coding agents (primarily Claude Code) working on the DESAIN POS codebase. This file is **mandatory reading at the start of every session**. If anything in this file conflicts with what a user prompt asks for, surface the conflict and ask before proceeding.

> **Last updated:** 2026-04 · **Owner:** Aureon · **Status:** pre-MVP, greenfield

---

## 0. TL;DR for Agents

- This is a **multi-tenant SaaS POS** for Indonesian restaurants (1–5 branches focus), **web-first (PWA)**.
- Pricing is **à la carte per feature** → architecture is **feature-flag-driven from day one**. Every billable feature is a toggleable module.
- **Offline-first is non-negotiable** for the kasir terminal. If anything you propose breaks offline operation, stop and discuss.
- Indonesian users, Indonesian context: **Bahasa Indonesia UI default**, **QRIS native**, **PPN 11%**, **e-Faktur**, multi-platform delivery (GoFood/GrabFood/ShopeeFood).
- Monorepo: **pnpm + Turborepo**. Don't add another package manager. Don't add another monorepo tool.
- Tests are not optional for: **sync engine, payment flows, tax calculations, inventory deduction, audit logging**. UI/animations can skip tests.
- When in doubt, prefer **boring, predictable, observable** over **novel, clever, fast-moving**.

---

## 1. Mission & Non-Goals

### 1.1 Mission

Build the most fairly-priced, fastest-to-onboard, and most actionable-insight POS for Indonesian restaurants with 1–5 branches. Not the most feature-rich. Not the cheapest. The most **useful per rupiah spent**.

Three concrete success criteria for any feature:

1. **A new kasir can use it without training within 30 minutes** of starting their shift.
2. **It works during a 4-hour internet outage** without losing a single transaction.
3. **An owner without finance background can act on it** — not just read it.

If a proposed feature fails all three, push back.

### 1.2 Non-Goals (explicit)

- ❌ Native mobile app (Android/iOS). PWA only. If a feature truly requires native, escalate.
- ❌ Competing on raw feature count with Majoo or iSeller.
- ❌ Full ERP / accounting software. Recipe costing + stock alerts only — no general ledger.
- ❌ Non-F&B verticals (retail, salon, laundry) in v1.
- ❌ Building our own delivery network. Aggregation only.
- ❌ Crypto, BNPL, or payment methods outside the QRIS / card ecosystem in v1.
- ❌ White-labelling for other brands in v1.

---

## 2. Core Principles

### 2.1 Offline-First, Always

The kasir terminal must work end-to-end with **no internet for at least 8 hours of typical operation**. Internet is a sync optimization, not a hard dependency. Every write operation has an offline path. Every read on the terminal serves from local cache first, then revalidates.

**Concrete rules:**

- Never block the UI on a network call in the kasir flow. Use optimistic updates + outbox.
- Never assume `Date.now()` from the server. Client clock is authoritative for `created_at`; server stamps `received_at`.
- Every domain mutation has a deterministic `client_op_id` (UUIDv7) so the server can deduplicate.

### 2.2 Modular by Construction

Every à la carte feature in the pricing table is a separately **deployable**, separately **disable-able** module. No feature can hard-depend on another **unless explicitly documented** (e.g., E-Wallet hard-depends on QRIS Native; Multi-Outlet Inventory hard-depends on Multi-Outlet Dashboard).

A feature module owns:

- Its database tables (named with module prefix, e.g., `inventory_recipe`, `delivery_gofood_orders`).
- Its API namespace (e.g., `/v1/inventory/...`, `/v1/delivery/gofood/...`).
- Its frontend route group.
- Its feature flag in the `features` table.
- Its background jobs.

If a tenant doesn't have the module enabled, **none of its code paths execute** — checked at the entitlement guard, not just the UI.

### 2.3 Multi-Tenant by Default

Every query touches `tenant_id`. Every cache key is namespaced with `tenant_id`. Every test fixture creates at least 2 tenants and asserts no cross-tenant leakage. **Single-tenant code is a code smell** and will be rejected in review.

Tenant isolation is enforced at three layers:

1. **Postgres Row-Level Security (RLS)** — primary defense.
2. **Application middleware** that injects `app.current_tenant_id` per request.
3. **Tenant guard** in every API handler (belt + suspenders).

### 2.4 Audit Everything That Touches Money or Stock

Voids, discounts, refunds, price edits, shift open/close, cash counts, manual stock adjustments, role changes: append-only audit log with user identity + timestamp + reason + before/after snapshot. **Never deletable. Never editable.** Append-only enforced at the database trigger level.

### 2.5 Bahasa Indonesia is the Default

Default locale is `id-ID`. English is a supported alternative, not the source of truth. All user-facing strings live in i18n catalogs (`messages/id.json`, `messages/en.json`). **Hardcoded user-facing English in code is a bug.**

This includes: error messages, toast notifications, email content, WhatsApp templates, AI-generated narratives.

### 2.6 Boring Tech Where It Counts

Postgres, not Mongo. Redis, not Kafka. REST + JSON, not GraphQL. We optimize for **predictability and operational simplicity**, not novelty. Novelty is allowed in places where it's reversible (UI libraries, dev tools). Novelty in the data layer or sync engine is forbidden.

### 2.7 Type Safety End-to-End

Zod schemas are the contract between client and server. Drizzle types feed from the schema. Server validates with the same schema the client sends. **No `any`. No `as` casts in business logic.** Type assertions are allowed only at trust boundaries (parsing external API responses), and only with a Zod parse immediately after.

### 2.8 Test What Breaks Money or State

Mandatory test coverage for:

- Sync engine (conflict resolution, idempotency, ordering)
- Payment processing (QRIS callback, refund, partial settlement)
- Tax calculation (PPN, service charge, rounding)
- Inventory deduction (recipe → stock with concurrent transactions)
- Audit log generation
- Multi-tenant isolation

UI animations, marketing copy, and admin dashboard chart styling don't need tests.

---

## 3. Tech Stack

Each choice is opinionated. **Don't propose alternatives without a strong reason that ties to a specific failing of the current choice in our context.**

### 3.1 Languages & Runtimes

| Layer              | Choice                  | Why                                                                                                           |
| ------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| Backend API        | **Node.js 22 LTS + TypeScript 5.6+** | Mature, fast enough, single language across stack, huge ecosystem, Owen's existing comfort zone.              |
| Frontend           | **TypeScript + React 19**           | Industry standard, hireable, PWA-friendly.                                                                    |
| ML / Forecasting   | **Python 3.12 (FastAPI)**           | Prophet, scikit-learn, statsmodels — TS ecosystem doesn't have peers. Isolated as a sidecar, not core path.    |
| Scripting / Ops    | **Bash + Node**                     | No Make. No Just. `package.json` scripts + small Node CLIs.                                                    |

### 3.2 Frameworks & Libraries

| Concern                  | Choice                            | Notes                                                                                  |
| ------------------------ | --------------------------------- | -------------------------------------------------------------------------------------- |
| API framework            | **Hono**                          | Lightweight, great TS ergonomics, edge-compatible if we ever need it. Not Express.    |
| ORM                      | **Drizzle**                       | SQL-first, lightweight, Postgres-native. Not Prisma — we want raw SQL escape hatches and faster cold starts. |
| Validation               | **Zod**                           | Single source of truth for shapes. Drizzle Zod for DB schemas.                        |
| Auth                     | **Lucia v3** (or Auth.js if Lucia v3 still unstable when we start) | Sessions in Postgres, refresh tokens for offline POS terminals. Roll-our-own JWT for the terminal-specific long-lived auth. |
| Background jobs          | **BullMQ (Redis)**                | Owen knows it. Mature. Fine-grained control over retry, priority, rate-limit.         |
| Realtime                 | **Socket.io** (self-hosted)       | KDS updates, multi-device order sync, owner dashboard live tiles.                     |
| Cache                    | **Redis 7**                       | Same Redis instance as BullMQ. Keyed by `tenant:{id}:...`.                            |
| POS terminal frontend    | **Vite + React 19 + Workbox PWA** | NOT Next.js. We need a true SPA for offline; SSR is dead weight here.                 |
| Admin dashboard          | **Next.js 15 App Router**         | Server components for heavy reports. SEO not critical (auth-gated) but DX matters.    |
| Marketing site           | **Next.js 15 App Router**         | Static + ISR. SEO matters here.                                                       |
| UI primitives            | **shadcn/ui + Tailwind 4**        | Owned components, copy-pastable, no lock-in.                                          |
| Client state             | **Zustand** (UI state) + **TanStack Query** (server state) | No Redux. No Recoil.                                                       |
| Forms                    | **React Hook Form + Zod resolver**| Same Zod schemas as the API.                                                          |
| Tables                   | **TanStack Table v8**             | Headless, composable.                                                                 |
| Charts                   | **Recharts** (admin) + **uPlot** (real-time owner dashboard tiles) | Recharts for static, uPlot for high-update-rate. |
| Offline storage (client) | **Dexie.js (IndexedDB)**          | Battle-tested. Simpler than RxDB. We build our own sync layer on top.                 |
| i18n                     | **next-intl** (Next apps) + **react-intl** (Vite app) | Both consume the same JSON catalogs.                                       |
| Date/time                | **Temporal polyfill** (or `@date-fns/tz` interim) | Asia/Jakarta timezone is everywhere; we never store local time without the zone. |
| Money                    | **`dinero.js` v2**                | Never use floats for money. Ever. Stored as integer cents (`bigint`).                 |

### 3.3 Infrastructure

| Concern             | Choice                                       | Notes                                                                          |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| Compute             | **Hetzner Cloud (CCX/CPX)**                  | Owen's existing pattern. Frankfurt (eu-central) for now; SG region when scale demands. |
| Container runtime   | **Docker + Docker Compose** (dev) / **Coolify** (prod) | Coolify > raw Compose for prod ops; still escape hatch to plain Compose. |
| Database            | **Postgres 16** (managed via Hetzner or self-hosted with `pg_back` + WAL-G to R2) | Start self-hosted, move to managed (Neon/Supabase) only if ops becomes pain. |
| Cache + Queue       | **Redis 7** (self-hosted, persistence on)    | Single instance MVP; Sentinel later.                                          |
| Object storage      | **Cloudflare R2**                            | Receipts, menu photos, exports, DB backups.                                   |
| CDN                 | **Cloudflare**                               | Asset cache + DDoS protection.                                                |
| Email               | **Resend** (transactional)                   | Cheap, good DX.                                                              |
| WhatsApp Business   | **Meta WhatsApp Business Platform** direct   | Don't go through resellers; we hit volume fast.                              |
| Error tracking      | **Sentry**                                   | Self-host an option later; managed for MVP.                                   |
| Product analytics   | **PostHog** (self-hosted)                    | Privacy-respecting, EU-friendly, owns the data.                              |
| Logs / metrics      | **Grafana Cloud free tier** → self-host Loki+Prometheus when paid tier crosses Rp500K/mo. |  |
| Secrets             | **Doppler** (or `.env` + `sops` if Doppler price hurts) |                                                                  |

### 3.4 Third-Party APIs

| Need                  | Provider                       | Adapter location                          |
| --------------------- | ------------------------------ | ----------------------------------------- |
| QRIS / e-wallet / card | **Midtrans** primary, **Xendit** fallback | `packages/integrations/src/payment/`     |
| GoFood                | GoBiz Merchant API             | `packages/integrations/src/delivery/gofood/` |
| GrabFood              | Grab Food Merchant API         | `packages/integrations/src/delivery/grabfood/` |
| ShopeeFood            | Shopee Open Platform           | `packages/integrations/src/delivery/shopeefood/` |
| WhatsApp              | Meta WhatsApp Business         | `packages/integrations/src/whatsapp/`     |
| LLM (narrative AI)    | **Anthropic Claude API**       | `packages/integrations/src/llm/`          |
| Maps / geocoding      | None in v1                     | —                                         |

---

## 4. Repository Structure

```
desain-pos/
├── apps/
│   ├── pos/                       # Vite + React PWA — kasir terminal
│   ├── admin/                     # Next.js — owner/manager dashboard
│   ├── api/                       # Hono API server
│   ├── worker/                    # BullMQ workers (sync, AI, integrations, notifications)
│   ├── ml/                        # FastAPI — forecasting, anomaly detection (Python)
│   └── marketing/                 # Next.js — public-facing site
├── packages/
│   ├── db/                        # Drizzle schema + migrations + RLS policies
│   ├── types/                     # Zod schemas + inferred TS types (THE contract)
│   ├── sync/                      # Offline sync engine (shared client+server)
│   ├── ui/                        # shadcn/ui components, tokens, Tailwind preset
│   ├── integrations/              # Payment, delivery, WhatsApp, LLM adapters
│   ├── domain/                    # Pure domain logic: tax, money, recipe costing, etc.
│   └── config/                    # tsconfig, eslint, prettier shared configs
├── infra/
│   ├── docker/                    # Dockerfiles + docker-compose.yml
│   ├── coolify/                   # Coolify app definitions
│   └── scripts/                   # backup, restore, db migrate runners
├── docs/
│   ├── architecture/              # ADRs (Architecture Decision Records)
│   ├── runbooks/                  # incident response playbooks
│   └── api/                       # OpenAPI generated from Zod
├── AGENTS.md                      # ← this file
├── README.md
├── package.json                   # workspace root
├── pnpm-workspace.yaml
├── turbo.json
└── .env.example
```

### 4.1 Why this split?

- **`apps/pos` is separate from `apps/admin`** because they have orthogonal requirements:
  - POS = offline-first SPA, limited screens, optimized for tablets at 7"–13".
  - Admin = online, data-heavy, server components, optimized for desktop.
  - Combining them in one Next.js app would mean compromising on offline support.
- **`apps/ml` is Python and isolated** because the rest of the stack is TS. The Python service is stateless: takes time-series in, returns predictions. Communication is via internal HTTP + signed JWT.
- **`packages/domain` is pure functions, no I/O.** This is where tax calculation, recipe costing, money math lives. Easy to test, no mocks.
- **`packages/types` is the contract.** Both `apps/api` and the frontend apps consume from here. Drift between client and server schemas is impossible by construction.

### 4.2 Naming conventions

- Files: `kebab-case.ts` (`menu-item.ts`, `qris-callback-handler.ts`).
- Types/Components: `PascalCase` (`MenuItem`, `QrisCallbackHandler`).
- Functions/variables: `camelCase`.
- Constants: `SCREAMING_SNAKE_CASE`.
- DB tables: `snake_case`, plural for collections (`menu_items`, `audit_logs`).
- DB columns: `snake_case`, no abbreviations (`tenant_id` not `tid`, `created_at` not `cdate`).
- API paths: `/v1/{resource}` lowercase plural.
- Branch names: `feat/`, `fix/`, `chore/`, `docs/`, `refactor/`.

---

## 5. Domain Model

### 5.1 Top-level entities

```
Tenant (the merchant company)
  └── Outlet (a branch / cabang)
       ├── Shift (kasir's working session)
       ├── Order (transaction)
       │    ├── OrderItem (line item)
       │    │    └── Modifier (topping, level pedas, etc.)
       │    └── Payment (one Order can have multiple Payments — split bill)
       └── Table (dine-in seating)

Tenant
  └── Menu (shared across outlets, can be overridden per outlet)
       ├── MenuCategory
       ├── MenuItem
       │    ├── ModifierGroup
       │    └── Recipe (links to Inventory items)
       └── PricingProfile (dine-in vs delivery vs happy hour)

Tenant
  └── Staff (User)
       └── Role (owner | manager | kasir | dapur)
            └── Permission (per-outlet)

Tenant
  └── Customer (CRM)
       └── LoyaltyAccount

Tenant
  └── InventoryItem (bahan baku)
       ├── Stock (per Outlet)
       └── PurchaseOrder

Tenant
  └── Subscription
       └── EnabledFeatures (modular pricing)
```

### 5.2 Identity

- Every entity has `id`: `UUIDv7` (sortable, generated client-side for offline creation).
- Every entity has `tenant_id`: foreign key to `tenants.id`. **Always.**
- Every entity has `created_at`, `updated_at`, `deleted_at` (soft delete except for audit logs).
- Every entity has `client_op_id`: nullable UUID, set when created offline, used for sync deduplication.

### 5.3 Money

- Stored as `bigint` representing **smallest currency unit** (sen / `Rp`× 100 cents).
- Never `numeric`/`decimal`. Never `float`.
- Always tagged with currency code (`IDR` only in v1).
- Use `dinero.js` v2 in TS. Helper: `packages/domain/src/money.ts`.

### 5.4 Time

- Stored as `timestamp with time zone` (UTC) in DB.
- Displayed in `Asia/Jakarta` unless tenant explicitly chose otherwise (rare in v1; we are Indonesia-only).
- Business day boundary: **04:00 Asia/Jakarta** (covers late-night closing). Configurable per outlet.

---

## 6. Module System (Pricing → Architecture)

The pricing table in the proposal maps **directly** to a feature flag system. Implementing it correctly from day one is non-negotiable.

### 6.1 The `features` table

```sql
features (
  code           text primary key,           -- e.g., 'qris_native', 'gofood_integration'
  group          text not null,              -- 'core', 'payment', 'delivery', 'multi_outlet', ...
  display_name   jsonb not null,             -- { id: 'QRIS Native', en: 'QRIS Native' }
  monthly_price  bigint not null,            -- in IDR sen
  depends_on     text[] not null default '{}', -- e.g., ['qris_native']
  active         boolean not null default true
)
```

### 6.2 The `tenant_features` table

```sql
tenant_features (
  tenant_id        uuid references tenants(id) on delete cascade,
  feature_code     text references features(code),
  enabled          boolean not null default true,
  enabled_at       timestamptz not null default now(),
  expires_at       timestamptz,                       -- null = no expiry
  source           text not null,                    -- 'subscription' | 'trial' | 'comp'
  primary key (tenant_id, feature_code)
)
```

### 6.3 The entitlement check

Every feature-gated code path runs through the entitlement check **before** any business logic:

```ts
// packages/domain/src/entitlement.ts
export function requireFeature(
  ctx: RequestContext,
  feature: FeatureCode
): asserts ctx is RequestContext & { features: { [K in typeof feature]: true } } {
  if (!ctx.features[feature]) {
    throw new FeatureNotEnabledError(feature);
  }
}
```

In the API:

```ts
app.post('/v1/delivery/gofood/orders', async (c) => {
  requireFeature(c.var, 'gofood_integration');
  // ...
});
```

In the frontend, gating uses a hook:

```tsx
const canSeeGoFood = useFeature('gofood_integration');
return canSeeGoFood ? <GoFoodPanel /> : null;
```

### 6.4 Bundling discount logic

Live in `packages/domain/src/billing.ts`. Pure function: `computeMonthlyBill(enabledFeatures, segment) → { subtotal, discountPct, discountAmount, total }`.

- Discount tier inference: by **total subtotal**, not by feature count (matches the proposal's segment definitions).
- Tiers: `0% | 10% | 20% | 30%` matching segments warung / cafe / multi-cabang / chain.
- Tier thresholds are config in DB (`pricing_config` table), not hardcoded.

### 6.5 Adding a new feature

When asked to add a new module:

1. Add an entry to `features` seed.
2. Create migration for any new tables, prefixed with the module name.
3. Add API routes under `/v1/{module}/...` with `requireFeature` guard.
4. Add Drizzle schema in `packages/db/schema/{module}.ts`.
5. Add Zod schemas in `packages/types/src/{module}.ts`.
6. Add a frontend route group and gate it with `useFeature`.
7. Add an entry in the billing tests (snapshot of `computeMonthlyBill` with the feature toggled).
8. Update `docs/architecture/features.md`.

---

## 7. Multi-Tenancy Patterns

### 7.1 Row-Level Security (RLS) is the primary defense

Every table that holds tenant data has RLS enabled. Example:

```sql
alter table menu_items enable row level security;

create policy menu_items_tenant_isolation on menu_items
  using (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

The API connection sets `app.current_tenant_id` at the start of every request:

```ts
await tx.execute(sql`set local app.current_tenant_id = ${tenantId}`);
```

### 7.2 No direct `db` access from handlers

Handlers always go through a `withTenantContext()` helper that sets the RLS variable. **Direct `drizzle()` calls without the helper are forbidden** and caught by a custom ESLint rule.

### 7.3 The owner-bypass pattern

Internal admin tools (Aureon staff) need cross-tenant queries (support, debugging). These run under a **different connection pool** (`db_admin`) with RLS bypass. **Never expose this pool to user-facing handlers.**

### 7.4 Tenant context comes from auth, never from request body

- Auth middleware extracts `tenant_id` from the session token.
- Request body cannot carry `tenant_id`. If a payload attempts to set `tenant_id`, the request is rejected.
- This eliminates IDOR attacks at the framework level.

### 7.5 Caching keys

Every Redis key is prefixed with `t:{tenant_id}:`. Example: `t:01H7Z..:menu:items:list`. Cache invalidation is per-tenant.

---

## 8. Offline-First & Sync Engine

This is the most subtle part of the system. **Read this section in full before touching anything in `packages/sync` or `apps/pos/src/sync`.**

### 8.1 Mental model

The kasir terminal is the **source of truth for write operations during the shift**. Server is eventually consistent. We use an **outbox + idempotent server** pattern, not CRDTs (overkill) and not last-write-wins blanket (loses data).

### 8.2 The op log

Every domain mutation on the terminal generates an `Op`:

```ts
type Op = {
  client_op_id: UUIDv7;       // generated client-side, sortable by time
  tenant_id: string;
  outlet_id: string;
  shift_id: string;
  user_id: string;
  type: OpType;               // e.g., 'order.create', 'order.add_item', 'payment.record'
  payload: Json;              // type-specific
  client_at: timestamp;       // client clock at op creation
  device_id: string;
};
```

Ops are stored in IndexedDB in two stores:

- `ops_pending` — not yet synced.
- `ops_applied` — already acknowledged by server (kept for 7 days for forensics, then GC'd).

### 8.3 Apply locally, then enqueue

The terminal:

1. Generates the `Op`.
2. Applies it to the local Dexie state (the materialized view of orders, menu, etc.).
3. Pushes it to `ops_pending`.
4. The sync worker (a Web Worker) drains `ops_pending` to the server in order, by shift.

If the user takes the terminal offline mid-shift, ops accumulate in `ops_pending`. When connectivity returns, they flush in order.

### 8.4 Server idempotency

The server's sync endpoint (`POST /v1/sync/ops`) deduplicates by `client_op_id`. If the same op arrives twice (network retry), the second is a no-op. The endpoint returns the canonical server-side row state.

### 8.5 Conflict resolution

Conflicts are rare in POS because:

- Orders are owned by a single shift on a single device.
- Menu edits are owner-only and rarely concurrent.

For the cases that do occur (e.g., menu price edit on admin while terminal is offline), the rule is:

| Entity            | Conflict resolution                                                       |
| ----------------- | ------------------------------------------------------------------------- |
| Order, OrderItem  | Terminal wins. The order is closed-state; admin shouldn't edit closed orders. |
| Menu, MenuItem    | Server wins. Admin is the source of truth for menu.                       |
| Inventory stock   | Sum of deltas. Both sides record deltas, never absolute values.           |
| Customer          | Server wins for profile fields; client wins for last-visit/loyalty deltas. |
| Settings          | Server wins.                                                              |

Encode these per-entity rules in `packages/sync/src/conflict.ts` as a `Resolver` per entity. Don't reinvent per call site.

### 8.6 Clock skew

Client clocks lie. We never trust `client_at` for authoritative ordering. Server stamps `received_at` on arrival. Reports use `received_at`. The receipt printed for the customer uses `client_at` (because that's what the kasir saw). Audit trail records both.

### 8.7 What never goes through the op log

- Authentication (always online; falls back to offline auth via cached refresh token).
- Payment confirmation from QRIS — the QRIS callback is an inbound webhook, separate channel.
- Reports — read-only, server-side.

### 8.8 Testing the sync engine

Mandatory test scenarios in `packages/sync/test/`:

1. Offline for 4 hours, 200 orders, full sync on reconnect → all orders present, all payments matched, no duplicates.
2. Two devices in same outlet, both offline, both create orders → no collision (different `device_id` in `client_op_id`).
3. Server returns 500 on every other request → eventual consistency, no data loss.
4. Tab closes mid-sync → on reopen, `ops_pending` resumes from where it stopped.
5. User clears browser data mid-shift → graceful degradation, prompt to re-auth, server has the orders that synced before.

---

## 9. API Design

### 9.1 Style

- **REST + JSON** over HTTPS.
- **Versioned** via URL prefix: `/v1/`.
- **Pluralized resource names**: `/v1/menu-items`, `/v1/orders`.
- **Filtering** via query string: `?outlet_id=...&status=open`.
- **Pagination** via cursor: `?cursor={opaque}&limit=50`. Never offset pagination on tenant-scoped data.
- **Errors** follow [RFC 7807 Problem Details](https://www.rfc-editor.org/rfc/rfc7807):

```json
{
  "type": "https://docs.desain.id/errors/feature-not-enabled",
  "title": "Feature not enabled",
  "status": 403,
  "detail": "The 'gofood_integration' feature is not enabled for this tenant.",
  "code": "FEATURE_NOT_ENABLED",
  "feature": "gofood_integration"
}
```

### 9.2 Request lifecycle (Hono middleware order)

1. `requestId` — assign per-request UUID.
2. `logger` — structured log start.
3. `cors` — strict origin allowlist per env.
4. `auth` — verify session, attach `user`, `tenant`, `outlet`.
5. `tenantContext` — set RLS variable on connection.
6. `rateLimit` — per-tenant + per-route.
7. `entitlement` — check feature flag for the route.
8. `validate` — Zod parse body/query.
9. **Handler.**
10. `errorHandler` — convert thrown errors to RFC 7807.

### 9.3 Idempotency

Mutating endpoints accept an `Idempotency-Key` header. Stored in Redis for 24h with the response. Re-sending with the same key returns the cached response, never re-executes.

### 9.4 Webhooks (inbound)

QRIS callbacks, delivery platform events, and WhatsApp delivery receipts are inbound webhooks. Each provider has a dedicated route under `/v1/webhooks/{provider}`. Mandatory:

- Signature verification using the provider's secret.
- Replay protection: check `event_id` against Redis dedupe set.
- Async processing: webhook handler enqueues a BullMQ job and returns 200 immediately.
- Idempotent worker: the job can be retried.

### 9.5 OpenAPI

OpenAPI 3.1 spec is **generated from Zod** (via `@asteasolutions/zod-to-openapi` or similar). Don't hand-write OpenAPI. The build fails if Zod and OpenAPI drift.

---

## 10. Database Conventions

### 10.1 Migrations

- Drizzle Kit migrations only. Never edit a migration after it's merged.
- Migrations are forward-only. Down migrations are documentation, not executed.
- Every migration is reviewed for: index strategy, RLS policy, audit trigger.
- Long-running migrations (e.g., backfills) run as **separate background jobs**, not in the migration step.

### 10.2 Indexes

- Every foreign key has a covering index.
- Every `(tenant_id, ...)` query path has a composite index starting with `tenant_id`.
- `created_at DESC` indexes for timeline views.
- `partial indexes` for soft-deleted: `where deleted_at is null`.

### 10.3 Audit triggers

A generic `audit_log()` Postgres function captures `INSERT/UPDATE/DELETE` on tables marked auditable. Audited tables include:

- `orders`, `order_items`, `payments`
- `menu_items`, `menu_prices`
- `users`, `roles`, `permissions`
- `inventory_stock_movements`
- `tenant_features`
- `shifts`, `cash_counts`

### 10.4 Soft delete

- Use `deleted_at timestamptz null`.
- Drizzle queries use a default scope that excludes deleted rows.
- Hard delete only for truly transient data (e.g., expired sessions, drained queue jobs).

### 10.5 No ENUMs

Postgres ENUMs are painful to evolve. Use `text` + `CHECK (value IN (...))` constraint. The list of valid values is also in the Zod schema.

### 10.6 Naming

- `snake_case`.
- `bool` fields are positive: `is_active`, `is_deleted` — not `inactive`.
- Foreign keys: `{table_singular}_id` (`order_id`, `menu_item_id`).
- Booleans default to `false` unless there's a strong reason.
- Timestamps: always `timestamp with time zone`.

---

## 11. Authentication & Authorization

### 11.1 Identity layers

- **Tenant** — the merchant.
- **User** — a person; can belong to multiple tenants (rare in v1, but architecturally supported).
- **Membership** — `(user_id, tenant_id, role)` join.
- **Role** — `owner`, `manager`, `kasir`, `dapur`.
- **Permission** — granular per-outlet capability (e.g., `void_order`, `apply_discount`, `view_reports`).

### 11.2 Sessions

- Admin dashboard: short-lived session cookies (1h) + refresh token (30d), httpOnly + Secure + SameSite=Lax.
- POS terminal: device-bound long-lived session (90d) tied to an outlet, refreshable while online. Offline-tolerant via cached session signature.

### 11.3 PIN-based kasir auth

Kasir staff log into a shared terminal session via 4-digit PIN, NOT password. The terminal is already authenticated as the outlet device; PIN authorizes the human in front of it. PIN attempts are rate-limited (5 wrong → 5 min lockout, audited).

### 11.4 Permissions check

Every protected handler:

```ts
requirePermission(ctx, 'order:void', { outletId });
```

Permission check considers:

1. User's role in the tenant.
2. Per-outlet permission overrides.
3. Feature flag (e.g., `audit_trail_immutable` enables stricter rules around void).

---

## 12. Payment Integration

### 12.1 QRIS (the foundation)

- Provider: **Midtrans Snap** for QRIS dynamic + e-wallet aggregation.
- Flow: Terminal calls `/v1/payments/intents` → server calls Midtrans → returns QR string → terminal renders.
- Confirmation: Midtrans calls our webhook → we mark payment as settled → push to terminal via Socket.io (or terminal long-polls if offline-of-sorts).
- Reconciliation: nightly job pulls Midtrans settlement report, matches to our records, flags mismatches for ops review.

### 12.2 Card

- Out-of-band: terminal prompts kasir to charge via EDC, kasir confirms in UI. We don't process the card ourselves — the EDC is the merchant's existing bank EDC.
- Reconciliation is the kasir's responsibility, but we provide a "card payments expected" total at end-of-shift to compare against the EDC settlement.

### 12.3 Cash

- Recorded directly in the order. Cash drawer reconciliation at shift close.

### 12.4 Split payment

Multiple `Payment` rows per `Order`. Sum must equal order total. Each payment is independently auditable.

### 12.5 Refund

Always partial-or-full referencing the original payment. Full audit trail. QRIS refunds via Midtrans Refund API; if not supported by the underlying e-wallet, manual refund flagged with operator instruction.

### 12.6 The payment integration adapter pattern

```ts
// packages/integrations/src/payment/types.ts
export interface PaymentProvider {
  id: 'midtrans' | 'xendit';
  createIntent(params: CreateIntentParams): Promise<PaymentIntent>;
  parseWebhook(headers: Headers, body: unknown): WebhookEvent;
  refund(paymentId: string, amount: Money): Promise<RefundResult>;
}
```

Switching providers per tenant is a config change. Don't hardcode `midtrans` anywhere outside the adapter folder.

---

## 13. Delivery Aggregator Architecture

### 13.1 Adapter pattern

Each platform implements:

```ts
export interface DeliveryProvider {
  id: 'gofood' | 'grabfood' | 'shopeefood';
  syncMenu(menu: Menu): Promise<void>;
  setItemAvailability(itemId: string, available: boolean): Promise<void>;
  acceptOrder(orderId: string): Promise<void>;
  rejectOrder(orderId: string, reason: string): Promise<void>;
  parseWebhook(headers: Headers, body: unknown): DeliveryEvent;
}
```

### 13.2 Inbound order flow

1. Platform webhook arrives at `/v1/webhooks/delivery/{provider}`.
2. Signature verified.
3. Job enqueued: `delivery:order:received`.
4. Worker normalizes the platform-specific payload to our internal `Order` shape.
5. Order written to DB with `source: '{provider}'`.
6. Socket.io broadcasts to the outlet's KDS + terminal.
7. Auto-accept logic: if enabled by tenant config, immediately confirm to platform.

### 13.3 Outbound menu sync

Menu changes in our system fan out to enabled platforms via the `menu_sync_one_click` feature. Each platform sync is a separate job that can fail independently. Status surfaced in the menu UI: per-platform sync status + last-error.

### 13.4 Margin-after-commission feature

- Per-platform commission rates stored in `platform_commission_rates` (per tenant per platform).
- Recipe cost from `inventory_recipe`.
- Computed live in `packages/domain/src/margin.ts`. Pure function. Tested.

---

## 14. AI Analytics Engine

### 14.1 Two distinct concerns

- **Numerical models** (forecasting, anomaly detection, peak hour clustering): Python (`apps/ml`), classic stats (Prophet, Z-score, Isolation Forest). NOT LLMs.
- **Narrative output** (Daily Brief, recommendations in Indonesian): Anthropic Claude API. The model is given pre-aggregated facts + structured prompt; it never sees raw transactions.

This separation matters: numerical accuracy is non-negotiable; LLM text quality is graded but tolerable to drift.

### 14.2 Daily Brief pipeline

```
00:30 Asia/Jakarta nightly job:
  1. Aggregate yesterday's metrics per tenant per outlet (TS).
  2. Run anomaly detection (Python).
  3. Run menu performance scoring (Python).
  4. Compose facts JSON → Claude API with structured prompt.
  5. Receive structured JSON response (Claude) — Bahasa Indonesia narrative + 1 priority recommendation.
  6. Store in `daily_briefs`.
  7. Push to owner via WhatsApp + in-app notification at owner's configured time (default 06:00).
```

### 14.3 Cold-start handling

- Menu Performance Scoring requires **30 days** of data. Until then, UI shows: "Data masih dikumpulkan. Skor akan tersedia pada {date}."
- Demand Forecasting requires **90 days**. Same pattern.
- Anomaly Detection works from week 1 (uses simple rolling baseline).

These thresholds are per-feature config, not hardcoded. Surface the threshold and current data day count in the UI explicitly.

### 14.4 LLM prompt management

- Prompts live in `packages/integrations/src/llm/prompts/{name}.ts` as typed templates.
- Prompts are versioned. Every LLM call records `prompt_version` for reproducibility.
- Output is **always structured JSON**, never free-form. We use Zod to validate the response. If the LLM returns malformed output, retry once; on second failure, fall back to a deterministic template.

### 14.5 Cost control

- Token budget per tenant per day for AI features. Soft cap warns; hard cap pauses generation.
- Cache identical prompts for 24h.
- Use Claude Haiku for short outputs (Daily Brief is fine on Haiku); reserve Sonnet for menu scoring narratives.

---

## 15. Tax & Compliance

### 15.1 PPN 11%

- Configurable per tenant (some tenants are non-PKP and don't charge PPN).
- Configurable per item (some items, e.g. bottled water resold, may have different treatment).
- Default: 11%, applied on subtotal **after discount**, **before service charge**.
- Service charge default 0%, configurable. When charged, applied to subtotal and **then** PPN applies to subtotal + service charge (this matches standard Indonesian F&B practice; verify with tenant during onboarding).
- All tax math in `packages/domain/src/tax.ts` as pure functions. **Tested with known good fixtures from real receipts.**

### 15.2 e-Faktur

- B2B transactions where the customer requests a tax invoice trigger e-Faktur generation.
- Integration with DJP (Directorate General of Taxes) sandbox in v1, production in v2 after KYB completion.
- e-Faktur records include the customer's NPWP. PII handling rules apply.

### 15.3 Receipt format

- Required fields per Dirjen Pajak guidance: tenant name, NPWP (if PKP), outlet address, transaction ID, date/time, itemized lines, subtotal, discount, service charge, PPN, total, payment method, kasir name.
- Format defined in `packages/domain/src/receipt.ts`. Renders to thermal-printer ESC/POS commands and to digital (HTML → PDF for WhatsApp).

### 15.4 QRIS regulatory

- Bank Indonesia mandates QRIS support for active merchants. Default QRIS to "on" during onboarding. Document the regulatory rationale in the UI.

---

## 16. Internationalization

### 16.1 The catalog

- Source of truth: `packages/ui/src/i18n/messages/id.json` (default), `en.json`.
- Format: ICU MessageFormat.
- Keys are dotted paths: `pos.order.cancel.confirm.title`.
- Never inline strings in components. ESLint rule enforces.

### 16.2 Currency, date, number formatting

- Use `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })`.
- Date: `Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', ... })`.
- Wrap in helpers in `packages/ui/src/format/` — don't sprinkle `Intl` calls everywhere.

### 16.3 LLM-generated content

Daily Brief and recommendations are generated **in Indonesian directly by the LLM** — we don't generate in English and translate. The prompt explicitly instructs Bahasa Indonesia output, casual professional register suitable for restaurant owners.

---

## 17. Frontend Conventions — POS Terminal (`apps/pos`)

### 17.1 Design constraints

- Target: 7"–13" tablets in landscape, also fine on laptops.
- Touch targets: min 44×44 px (Apple HIG), prefer 56 px for primary actions in the kasir flow.
- One-handed reachability is **not** a goal (terminal is on a stand).
- No animations longer than 200ms in the kasir hot path. Speed > polish.

### 17.2 Routes (high level)

```
/                       → outlet selector (if multi-outlet)
/login-pin              → kasir PIN entry
/order                  → main order entry screen
/order/tables           → table grid (if table management enabled)
/order/active/:id       → editing an open order
/kds                    → kitchen display
/shift                  → open/close shift, cash count
/settings               → minimal — most settings go to admin app
```

### 17.3 State management

- **Server state**: TanStack Query. `staleTime: Infinity` for menu, `staleTime: 0` for orders.
- **Local UI state**: Zustand. One store per major surface (`useOrderStore`, `useShiftStore`).
- **Persisted local state**: Dexie. Source of truth for offline operation.
- **Cross-tab sync**: `BroadcastChannel`. Two terminals on the same device should reflect each other's state.

### 17.4 PWA

- Workbox precaches the app shell.
- Runtime cache strategy: `staleWhileRevalidate` for menu images; `networkFirst` for receipt PDFs; `cacheFirst` for fonts.
- App is installable. We prompt installation on first non-installed visit (after 3 sessions).

### 17.5 What lives in IndexedDB

- Menu (full snapshot, refreshed on focus).
- Open orders for the current shift.
- Pending ops (sync outbox).
- Customer search index (top 1000 most recent).
- User session token (encrypted at rest with a key derived from PIN — yes, we know).

### 17.6 What does NOT live in IndexedDB

- Closed shifts older than 7 days.
- Reports.
- Inventory levels (always fetched live; if offline, last-known with stale indicator).

---

## 18. Frontend Conventions — Admin Dashboard (`apps/admin`)

### 18.1 Server components by default

Use Next.js Server Components for read-heavy pages (reports, tables, dashboards). Drop to Client Components only for interactivity. **Don't put `'use client'` on every file by reflex.**

### 18.2 Routing

App Router with route groups:

```
app/
  (auth)/login
  (auth)/signup
  (dashboard)/
    overview
    orders
    menu
    inventory
    customers
    reports
    delivery
    ai
    settings
```

### 18.3 Data fetching

- Read: Server Components with Drizzle queries directly. No API hop for SSR data. (The API exists for the POS terminal and external integrations.)
- Write: API hop, via TanStack Query mutations. Keeps the optimistic-update + retry semantics.
- Realtime tiles (live order count, today's revenue): Server-Sent Events from Next.js route handler subscribed to Redis pub-sub.

### 18.4 Charts

Recharts for static analytical charts. uPlot for live-updating tiles (>1 update/sec). Don't use Chart.js (canvas memory leaks under prolonged sessions).

---

## 19. Realtime (KDS, Multi-Device, Owner Tiles)

### 19.1 Topology

- One Socket.io namespace per concern: `/kds`, `/pos`, `/admin`.
- Rooms per outlet: `outlet:{id}`.
- Rooms per device: `device:{id}` (for direct device commands).
- Auth: JWT in `auth.token` on connect; verified server-side; tenant + outlet scope enforced before joining rooms.

### 19.2 Events (selected)

```ts
// /kds namespace
'order:new'            // new order arrived (any source)
'order:item:status'    // item moved between prep stages
'order:cancelled'

// /pos namespace
'menu:updated'         // menu changed elsewhere; refetch
'shift:closed:remote'  // another device closed the shift; lock UI
'payment:confirmed'    // QRIS payment settled (mirrors webhook)

// /admin namespace
'kpi:tick'             // 1Hz aggregate update for live tiles
```

### 19.3 Backpressure

If a client falls behind (e.g., bad WiFi), the server drops `kpi:tick` events for that client beyond a 3-event backlog. Order-related events are never dropped — they're queued.

### 19.4 Fallback

If WebSocket fails (corporate firewalls, etc.), fall back to long-polling on `/v1/sync/poll`. Auto-detect.

---

## 20. Background Jobs (BullMQ)

### 20.1 Queues

| Queue                   | Purpose                                              | Concurrency |
| ----------------------- | ---------------------------------------------------- | ----------- |
| `sync.ops`              | Process incoming op batches from terminals           | 4 per worker |
| `delivery.inbound`      | Normalize platform webhooks → orders                 | 8           |
| `delivery.outbound`     | Menu sync, availability updates                      | 4           |
| `payment.reconcile`     | Nightly Midtrans/EDC reconciliation                  | 1           |
| `notifications.whatsapp`| Outbound WhatsApp templated messages                 | 4 (rate-limited by Meta) |
| `ai.daily_brief`        | Per-tenant Daily Brief generation                    | 2           |
| `ai.menu_score`         | Weekly menu performance scoring                      | 1           |
| `reports.export`        | Owner-requested CSV/PDF exports                      | 2           |

### 20.2 Job design rules

- **Idempotent.** If retried, no double effects. Use `client_op_id` or job-level idempotency keys.
- **Time-bounded.** Every job has a hard timeout. Default 5 minutes; long jobs split into chunks.
- **Observable.** Every job emits start + end span to OpenTelemetry, with tenant_id and job-specific tags.
- **Failure-tolerant.** Default retry: 3 attempts, exponential backoff. After exhaustion, dead-letter queue + Sentry alert.

### 20.3 Schedules

- Cron via BullMQ repeatable jobs. Definitions live in `apps/worker/src/schedules.ts`.
- Schedules are tenant-scoped where possible (e.g., Daily Brief at the tenant's configured hour, not a global hour).

---

## 21. Testing Strategy

### 21.1 Test pyramid

- **Unit (Vitest)**: pure functions in `packages/domain`. Money, tax, recipe costing, billing. Fast. Many. No mocks.
- **Integration (Vitest + Testcontainers)**: API handlers against a real Postgres + Redis. Tests RLS enforcement, transactions, BullMQ side effects.
- **E2E (Playwright)**: Critical paths only — login, take an order, pay with QRIS (mocked Midtrans), close shift, view report.
- **Sync engine tests (Vitest)**: dedicated suite simulating offline scenarios. See §8.8.

### 21.2 Coverage expectations

- `packages/domain`: 90%+ line coverage.
- `packages/sync`: 90%+ branch coverage.
- API handlers: every route has at least one happy-path + one auth-failure + one validation-failure test.
- Frontend components: render + accessibility test for top 20 components. Snapshot tests are banned.

### 21.3 Fixtures

`test/fixtures/` contains realistic seed data:

- `tenant-warung.ts` — small UMKM with core features only.
- `tenant-multicabang.ts` — 3 outlets, full delivery + AI.
- `menu-cafe.ts`, `menu-resto-padang.ts` — varied menus.
- Run all multi-tenant tests against both fixture tenants to catch isolation bugs.

### 21.4 What we don't test

- Tailwind class output (it's just a string).
- Trivial getters.
- Third-party library internals.

---

## 22. Observability

### 22.1 Three signals

- **Logs**: structured JSON, one event per line, every log carries `tenant_id`, `outlet_id`, `request_id`, `user_id`. Loki for storage.
- **Metrics**: Prometheus pull. Default RED metrics per route. Custom: orders/sec per tenant, sync lag percentile, payment confirmation latency.
- **Traces**: OpenTelemetry with Tempo or Grafana Cloud Traces. Every API request is a trace; every BullMQ job is a trace; cross-service propagation via `traceparent`.

### 22.2 SLOs

| SLO                                              | Target            |
| ------------------------------------------------ | ----------------- |
| Kasir order entry → on-screen confirmation       | p95 < 200ms       |
| QRIS callback → terminal confirmation event      | p95 < 5s          |
| Sync ops queue drain (100 ops)                   | p95 < 30s         |
| Admin dashboard initial load                     | p95 < 2s          |
| Daily Brief generation completion                | 100% by 06:00 local |

### 22.3 Alerts

Alerts go to a single Slack channel + PagerDuty for SEV1. Alert design rule: **every alert is actionable**. If an alert fires three times without action, it's deleted or refined.

---

## 23. Security

### 23.1 Threat model snapshot

Top threats:

1. Cross-tenant data leakage (mitigated: RLS + middleware + tests).
2. Payment fraud — fake QRIS callbacks (mitigated: signature verification + replay protection).
3. Insider voids/discounts to skim cash (mitigated: immutable audit trail + role-permission separation).
4. Account takeover via stolen kasir PIN (mitigated: PIN attempts rate-limited, terminal device-bound).
5. Supply-chain via npm dependency (mitigated: dependency review on every PR, `pnpm audit` in CI, lockfile verification).

### 23.2 Secrets

- Never in git.
- Never in client bundles.
- Server reads from env at boot; rotated quarterly.
- LLM API keys especially: separate keys per env, billing alerts at 50%/80%/100% of budget.

### 23.3 PII handling

- Customer phone numbers are PII. Hash for indexes (`sha256(normalized_phone || tenant_salt)`); store plaintext only when needed for WhatsApp send. Never log phone numbers in plaintext.
- NPWP (tax IDs) for B2B e-Faktur: encrypted at rest with a per-tenant data key.
- Receipts in object storage: signed URLs with 24h expiry; never public.

### 23.4 Backup & DR

- Postgres: daily full + WAL streaming to Cloudflare R2.
- Tested restore: monthly restore drill on a separate server, scripted. **An untested backup is a wish, not a backup.**
- RPO: 5 minutes (WAL frequency). RTO: 4 hours.

---

## 24. Performance Budgets

### 24.1 POS terminal

- Initial JS bundle: < 250 KB gzipped.
- Time to interactive on a 2019 mid-range Android tablet: < 3s.
- Order entry roundtrip (touch → on-screen feedback): < 100ms perceived.
- Memory after 8h continuous use: < 300 MB.

### 24.2 Admin dashboard

- LCP: < 2.5s on 4G.
- Initial dashboard with 30-day data: server-rendered in < 1s.
- CSV export of 100k rows: streaming, first byte < 1s, full < 30s.

### 24.3 API

- p50 < 50ms, p95 < 250ms, p99 < 1s for read endpoints.
- p95 < 500ms for writes (excluding integrations).

---

## 25. Deployment & Infrastructure

### 25.1 Environments

- `dev` — local Docker Compose, all services on one machine.
- `staging` — single Hetzner VPS, production-shaped, stub integrations (Midtrans sandbox, fake delivery).
- `prod` — Hetzner cluster: 2× API node, 1× worker node, 1× DB node, 1× Redis node. Behind Cloudflare.

### 25.2 Deployment flow

- Trunk-based dev. Main branch is always deployable.
- Every merge to `main` triggers CI: lint, typecheck, test, build.
- On green: auto-deploy to `staging`.
- Manual promote to `prod` after smoke check on staging.
- **Database migrations run before app deploy**, with a 10-minute lock window.

### 25.3 Coolify-managed services

- API, worker, admin, marketing as Coolify apps with auto-deploy from GHCR.
- Postgres, Redis as Coolify-managed databases initially. Move to dedicated Hetzner instances when crossing 50 tenants.

### 25.4 Disaster scenarios

Documented runbooks in `docs/runbooks/` for: DB primary failure, Redis OOM, Midtrans outage, Cloudflare outage, GoFood API change, mass-tenant breach response.

---

## 26. Development Workflow

### 26.1 Setup

```bash
git clone ...
pnpm install
pnpm db:up         # docker compose up postgres redis
pnpm db:migrate
pnpm db:seed
pnpm dev           # runs all apps in parallel via Turborepo
```

### 26.2 Commit style

Conventional Commits: `feat(pos): add table merge`. Scopes match app/package names. Breaking changes flagged with `!`.

### 26.3 PRs

- Title: same convention as commits.
- Description template: what / why / how / risks / rollback plan.
- One approval required, two for changes touching `packages/sync`, `packages/db`, payment, or auth.
- CI must be green. No "I'll fix that later" merges.

### 26.4 ADRs

Architecture Decision Records in `docs/architecture/adr/NNNN-title.md`. Required for any decision that:

- Adds or replaces a major dependency.
- Changes the data model in a non-additive way.
- Changes the sync semantics.
- Introduces a new external integration.

---

## 27. Working with Claude Code

This section is for AI agents specifically. Read it carefully.

### 27.1 Before you start any task

1. **Read this file fully.** Don't skim.
2. **Check the relevant module README** in `apps/{app}/README.md` or `packages/{pkg}/README.md`.
3. **Search for ADRs** related to the area you're touching: `docs/architecture/adr/`.
4. **Run `pnpm typecheck` and `pnpm test --filter <package>`** in the package you're about to edit, before editing. Confirm the baseline is green.

### 27.2 Default behaviors

- **Do not invent file paths.** If you reference a file, it must exist or you create it explicitly.
- **Do not introduce new dependencies** without flagging it explicitly with rationale. We have a strict dependency budget.
- **Do not bypass type errors** with `any` or `@ts-ignore`. If the type system is wrong, model the type correctly. If you genuinely need an escape hatch, use `@ts-expect-error` with a comment explaining why and a TODO with a tracked ticket.
- **Do not write code that bypasses RLS or the entitlement guard.** Even in tests.
- **Do not write floating-point arithmetic for money.** Use `dinero.js`.
- **Do not hardcode tax rates, commission rates, or feature prices.** Read from config tables.

### 27.3 When the task is ambiguous

Stop. Ask. Specifically ask about:

- Tenant scoping: "Should this work cross-tenant or per-tenant?"
- Offline behavior: "Should this work when the terminal is offline?"
- Feature gating: "Is this part of an existing module, or a new à la carte feature?"
- Audit: "Does this mutation need to be audited?"

### 27.4 When proposing changes

For non-trivial changes, structure your proposal as:

1. **What**: one-line summary.
2. **Why**: business or technical reason.
3. **How**: file-level plan (which files added/changed).
4. **Risks**: what could go wrong, including in offline scenarios.
5. **Tests**: which tests will exercise the change.
6. **Rollback**: how to revert if it goes badly.

### 27.5 When you finish a task

- Run `pnpm lint && pnpm typecheck && pnpm test --filter <changed>`. If anything fails, the task is not done.
- Run `pnpm build` for any app you changed.
- Update related docs (README, ADR, this file if conventions changed).
- Summarize what you changed and what you didn't change but considered.

### 27.6 Things you should never do without explicit human approval

- Run `pnpm db:reset` or any destructive migration.
- Touch production credentials, secrets, or `.env` files (other than `.env.example`).
- Add a new external service integration (it's a partnership decision).
- Change the auth flow.
- Change the sync conflict resolution rules.
- Change the tax computation logic.
- Disable a test or skip an assertion.

### 27.7 Things you should default to doing

- Add a test for any logic in `packages/domain`.
- Add a Zod schema for any new external boundary.
- Wire feature flags for any new user-facing capability.
- Audit-log any new mutation that touches money, stock, or permissions.
- Use the existing money / time / tax helpers — don't reinvent.

---

## 28. Roadmap & Phasing

### 28.1 Phase 0 — Foundations (4 weeks)

- Monorepo, CI/CD, Hetzner staging.
- Auth, tenant + outlet model, RLS scaffolding.
- Drizzle schema for: tenants, users, outlets, menu, orders, payments, audit_log.
- POS terminal: PIN login, view menu, take a dine-in order, print receipt (mock printer).
- Admin: tenant signup, basic menu CRUD.
- **Exit criteria**: a single tenant can take an order end-to-end on the terminal, see it in admin.

### 28.2 Phase 1 — Core Kasir (6 weeks)

- Table management, KDS, shifts, cash drawer.
- QRIS via Midtrans (sandbox).
- Tax (PPN 11%, service charge), receipt format.
- Offline mode v1 — full sync engine.
- Reports v1 (daily/weekly/monthly).
- **Exit criteria**: first 5 friendly-merchant beta tenants live in production.

### 28.3 Phase 2 — Differentiators (8 weeks)

- Delivery aggregator: GoFood + GrabFood + ShopeeFood (in priority order based on partnership progress).
- Multi-outlet dashboard.
- Modular pricing + entitlement system fully wired.
- WhatsApp Business integration for digital receipts.
- **Exit criteria**: 30 paying tenants, NPS measured.

### 28.4 Phase 3 — Intelligence (6 weeks)

- Inventory + recipe costing.
- AI Daily Brief.
- Menu Performance Scoring.
- Anomaly Detection.
- Margin-after-commission per platform per menu.
- **Exit criteria**: 100 paying tenants, AI features show measurable retention lift.

### 28.5 Phase 4 — Scale (ongoing)

- Demand Forecasting.
- CRM + Loyalty.
- Advanced inventory (transfers, supplier mgmt).
- Hardware bundle program.
- e-Faktur production integration.

---

## 29. Glossary (Indonesian Terms)

For agents unfamiliar with Indonesian F&B context.

| Term                  | Meaning                                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| Kasir                 | Cashier / cashier station / cashier role.                                  |
| Struk                 | Receipt (printed or digital).                                              |
| Cabang                | Branch / outlet location.                                                  |
| PPN                   | Pajak Pertambahan Nilai — VAT (currently 11%).                             |
| PKP                   | Pengusaha Kena Pajak — VAT-registered business; only PKP charge PPN.      |
| NPWP                  | Tax identification number (individual or corporate).                       |
| e-Faktur              | Electronic tax invoice required for B2B PKP transactions.                  |
| QRIS                  | Quick Response Code Indonesian Standard — unified QR payment standard.    |
| GoFood / GrabFood / ShopeeFood | The three dominant food delivery platforms.                       |
| EDC                   | Electronic Data Capture — card terminal at the merchant.                   |
| Dine-in vs Delivery   | Distinct pricing profiles often required (delivery prices may include platform commission markup). |
| UMKM                  | Usaha Mikro, Kecil, dan Menengah — micro/small/medium enterprise.         |
| Warung                | Small traditional eatery/shop. The smallest segment we serve.              |
| Sapi Perah / Bintang / Tanda Tanya / Anjing | BCG matrix categories used in Menu Performance Scoring (cash cow / star / question mark / dog). |
| Bahasa Sunda Lemes    | High-register Sundanese — relevant if a tenant in West Java requests it for customer-facing comms (out of scope v1). |

---

## 30. Quick Reference Cheatsheet

```
Run dev:                 pnpm dev
Run a single app:        pnpm dev --filter pos
Migrate DB:              pnpm db:migrate
Reset DB (DEV ONLY):     pnpm db:reset
Seed fixtures:           pnpm db:seed
Run tests:               pnpm test
Run tests for one pkg:   pnpm test --filter domain
Typecheck:               pnpm typecheck
Lint:                    pnpm lint
Lint fix:                pnpm lint:fix
Build all:               pnpm build
Generate OpenAPI:        pnpm openapi:generate
Generate ADR template:   pnpm adr:new "title"
```

---

**End of AGENTS.md.**

Update this file when the conventions change. The git history of this file is the project's architectural memory.
