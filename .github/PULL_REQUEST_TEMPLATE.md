## What

<!-- one-line summary -->

## Why

<!-- business or technical reason -->

## How

<!-- file-level plan, key changes -->

## Risks

<!-- what could go wrong; offline scenarios; multi-tenant impact -->

## Tests

- [ ] Unit tests added/updated
- [ ] Integration tests cover happy path + auth failure + validation failure
- [ ] Manual smoke test passed

## Rollback

<!-- how to revert if it goes badly -->

---

Reviewer checklist (per AGENTS.md §26.3):
- [ ] No `any` casts in business logic
- [ ] Money values are bigint sen, not floats
- [ ] Tenant guard / RLS-respected DB calls only
- [ ] Audit log generated for money/stock mutations
- [ ] Feature gate applied for à la carte modules
- [ ] i18n strings, not hardcoded text
