# ADR 0004 — Modular pricing via feature flags

- **Status:** Accepted
- **Date:** 2026-04-25
- **Owner:** Aureon

## Context

Pricing is à la carte. Tenants pay only for the modules they use. The pricing page maps directly to architecture: every billable feature must be independently disable-able, and disabled features must NOT execute their code paths (otherwise we leak abuse risk and audit complexity).

## Decision

- `features` table: catalog of every feature with `code`, `group`, `monthly_price`, `depends_on`.
- `tenant_features` table: per-tenant enablement. Source = `subscription | trial | comp`.
- Single guard: `requireFeature(ctx, 'gofood_integration')` — runs **before** any business logic at the API layer, AND in the worker before processing jobs scoped to that feature.
- Frontend uses `useFeature('gofood_integration')` to gate UI.
- Bundling discount inferred by total subtotal (not feature count) per the segment thresholds in `PRICING_TIERS`.

## Consequences

- ✅ Code paths are quarantined. A tenant without `gofood_integration` literally cannot trigger the GoFood worker.
- ✅ Adding a new feature is a checklist (AGENTS.md §6.5), not an architectural choice.
- ✅ Pricing changes are config-only.
- ❌ Hard dependencies between features (e.g. `multi_outlet_inventory` requires `inventory_recipe`) must be enforced at billing time AND at the entitlement guard.

## Alternatives considered

- **Per-tier plans (Starter / Pro / Enterprise)** — locks tenants into bundles they don't want; misaligned with our "useful per rupiah" positioning.
- **Code-only flags** — would require a redeploy to toggle per tenant.
