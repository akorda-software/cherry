# Dating App Implementation Specs

This folder contains the detailed implementation documentation for the dating app.

Use this folder when moving from planning into actual backend and mobile work.

It sits below the higher-level documents:

- `../dating-product-foundation.md`
- `../dating-prd/`
- `../dating-technical/`

## Files

- `schema.md` — concrete PostgreSQL and PostGIS schema proposal
- `backend-api.md` — endpoint plan, request/response shape, and domain rules
- `matching-engine.md` — ranking pipeline, fallback rules, and pseudocode
- `mobile-flows.md` — screen flow, client behavior, permissions, and upload flow
- `jobs-ops.md` — background jobs, moderation operations, metrics, and rollout notes

## Reading Order

1. `schema.md`
2. `backend-api.md`
3. `matching-engine.md`
4. `mobile-flows.md`
5. `jobs-ops.md`

## Goal

These documents should be detailed enough to implement the first version without having to re-decide product behavior.
