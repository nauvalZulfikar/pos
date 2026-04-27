# ADR 0001 — Monorepo with pnpm + Turborepo

- **Status:** Accepted
- **Date:** 2026-04-25
- **Owner:** Aureon

## Context

We need to share TypeScript code across 6 apps and ~7 packages: Zod schemas (the wire contract), domain logic, sync engine, db, ui, integrations. Type drift between client and server would be a recurring source of bugs in a multi-tenant system where tax computation, money math, and entitlement checks must be identical.

## Decision

- **pnpm** for package management (workspace protocol, fastest installs, content-addressable store).
- **Turborepo** for task orchestration (cached build/test/lint, dependency-aware execution).
- Single `tsconfig.base.json` + per-package extension via `@desain/config`.

## Consequences

- ✅ One `pnpm install` provisions every app + package.
- ✅ Cross-package types are exact — `@desain/types` is THE wire contract.
- ✅ Turbo caches typecheck and test; CI is fast even at 14 packages.
- ❌ Slightly higher onboarding cost for developers used to single-repo setups.
- ❌ pnpm's strict peer dep mode occasionally surprises React 19 / Next 15 combos; we set `auto-install-peers=true`.

## Alternatives considered

- **npm workspaces** — slower installs, weaker caching.
- **yarn berry** — PnP causes friction with Next.js + native deps (argon2).
- **Nx** — more opinionated than Turbo; we want lighter touch in early phases.
- **Polyrepo** — would require manual version pinning across packages and ad-hoc CI scripts. Friction outweighs benefits at this size.
