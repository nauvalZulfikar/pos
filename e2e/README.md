# DESAIN POS — E2E tests

Playwright tests for critical user flows.

## Run locally

Smoke tests (no backend required for some):
```
pnpm --filter @desain/e2e install:browsers
pnpm --filter @desain/e2e test
```

Full stack tests (requires DB + Redis + all apps running):
```
pnpm db:up && pnpm db:seed
pnpm dev   # in another terminal
E2E_FULL=1 pnpm --filter @desain/e2e test
```

## Test layout

- `tests/pos/` — kasir terminal flows
- `tests/admin/` — owner dashboard flows

## CI

Smoke-only by default. The full stack flow runs when `E2E_FULL=1` is set.
