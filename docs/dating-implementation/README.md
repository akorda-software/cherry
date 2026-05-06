# Dating App Implementation Specs

This folder contains the detailed implementation documentation for the dating app.

Use this folder when moving from planning into actual backend and mobile work.

It sits below the higher-level documents:

- `../dating-product-foundation.md`
- `../dating-prd/`
- `../dating-technical/`

## Files

- `schema.md` — concrete PostgreSQL and PostGIS schema proposal
- `mobile-contracts-v1.md` — accepted backend/mobile contracts for the first mobile build
- `mobile-implementation-plan.md` — recommended mobile build order and verification checkpoints
- `backend-api.md` — endpoint plan, request/response shape, and domain rules
- `matching-engine.md` — ranking pipeline, fallback rules, and pseudocode
- `mobile-flows.md` — screen flow, client behavior, permissions, and upload flow
- `jobs-ops.md` — background jobs, moderation operations, metrics, and rollout notes
- `../../apps/backend/priv/static/openapi.yaml` — machine-readable OpenAPI 3.0 REST contract, also served by the backend at `/openapi.yaml`

## Reading Order

1. `schema.md`
2. `mobile-contracts-v1.md`
3. `mobile-implementation-plan.md`
4. `backend-api.md`
5. `matching-engine.md`
6. `mobile-flows.md`
7. `jobs-ops.md`

## Goal

These documents should be detailed enough to implement the first version without having to re-decide product behavior.
