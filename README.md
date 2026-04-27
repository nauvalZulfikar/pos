# DESAIN POS

Multi-tenant SaaS POS for Indonesian F&B (1–5 outlet focus). Web-first PWA, offline-first kasir terminal, à la carte modular pricing.

> **For AI agents:** read [`AGENTS.md`](./AGENTS.md) before any work. It is mandatory.

## Quick start

```bash
# 1. Install
pnpm install

# 2. Bring up dev infra (Postgres + Redis)
pnpm db:up

# 3. Migrate + seed
pnpm db:migrate
pnpm db:seed

# 4. Run everything
pnpm dev
```

Apps will be available at:

| App        | URL                       | Purpose                      |
| ---------- | ------------------------- | ---------------------------- |
| POS        | http://localhost:5173     | Kasir terminal (PWA)         |
| Admin      | http://localhost:3001     | Owner / manager dashboard    |
| API        | http://localhost:3000     | Hono backend                 |
| Marketing  | http://localhost:3002     | Public landing page          |
| ML         | http://localhost:8000     | Forecasting / anomalies      |
| Worker     | (no UI)                   | BullMQ background jobs       |

## Project structure

See [§4 of `AGENTS.md`](./AGENTS.md#4-repository-structure).

## Phases

- **Phase 0** — Foundations (auth, multi-tenant, basic POS). 4 weeks.
- **Phase 1** — Core kasir (KDS, shifts, QRIS, offline sync, reports). 6 weeks.
- **Phase 2** — Delivery aggregator + multi-outlet + modular pricing. 8 weeks.
- **Phase 3** — Inventory + AI Daily Brief + menu scoring. 6 weeks.
- **Phase 4** — Forecasting, CRM, advanced inventory, e-Faktur. Ongoing.

## License

Proprietary — © Aureon. All rights reserved.
