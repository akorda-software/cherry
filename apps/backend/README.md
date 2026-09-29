# Backend

Phoenix backend for the mobile starter.

## Responsibilities

- completes provider auth callbacks for Google and Apple
- issues, refreshes, and revokes sessions
- exposes runtime config through `/api/config`
- exposes the dating REST API for bootstrap, onboarding, discovery, matches, chat, safety, settings, photo uploads, and push-token registration
- serves the OpenAPI spec at `/openapi.yaml`

## API Documentation

- `priv/static/openapi.yaml` is the machine-readable OpenAPI 3.0 contract for REST clients and Swagger tooling.
- `/openapi.yaml` serves the same spec when the Phoenix endpoint is running.
- `../../docs/06-contratos-mobile-backend.md` is the human contract for mobile behavior, including the Phoenix WebSocket chat contract.
- `../../docs/10-plan-fases.md` defines the implementation phases and their current status.

## Local Setup

1. Run `mix setup`
2. Start the server with `mix phx.server`
3. Use `.env.example` as the local runtime template when wiring real env vars

## Photo storage

Photos go through `Snack.Storage` (`STORAGE_ADAPTER`):

- `local` (dev default): files under `UPLOADS_DIR` (`priv/uploads` in dev, gitignored), uploaded with a signed `PUT /api/uploads/:token` and served at `/uploads`. Nothing to configure in dev; URLs follow the host you call the API with (`localhost`, LAN IP, tunnel) unless `PUBLIC_BASE_URL` is set.
- `r2`: Cloudflare R2, or any S3-compatible service with `S3_ENDPOINT` + `S3_REGION` (MinIO, Garage...).

Prod requires `STORAGE_ADAPTER` (and `UPLOADS_DIR` on a persistent volume plus `PUBLIC_BASE_URL` for `local`). See `../../docs/12-self-hosting.md` §5 and `docs/decisions.md` D-2026-09-29.

## Demo data (dev only)

```bash
mix run priv/repo/seeds.exs        # 52-tag catalog (any environment, idempotent)
mix run priv/repo/demo_seeds.exs   # dev only: ~55 realistic profiles around Madrid
```

`demo_seeds.exs` refuses to run outside `MIX_ENV=dev`, re-seeds the tag catalog and is idempotent (re-running resets the demo scenario without duplicating anything). Log in with the dev endpoint:

```bash
curl -X POST localhost:4000/api/auth/dev/test-login -H 'content-type: application/json' \
  -d '{"email": "demo@snack.dev"}'
```

- `demo@snack.dev` — Lucía (29): 8 unanswered likes, 5 matches (2 without messages, 3 conversations, two of them with unread messages) and some swipes.
- `demo2@snack.dev` — Hugo (33, "a ver qué pasa"): clean profile to test live matches between two sessions.
- Every synthetic persona can log in too: `<name>@demo.snack.dev` (e.g. `pablo@demo.snack.dev`).

With the compose PostGIS on port 5510: `DATABASE_URL=ecto://postgres:postgres@localhost:5510/snack_dev mix run priv/repo/demo_seeds.exs`.

## Core Runtime Variables

- `PORT`
- `PHX_SERVER`
- `PHX_HOST`
- `DATABASE_URL`
- `DATABASE_SSL`
- `POOL_SIZE`
- `SECRET_KEY_BASE`
- `AUTH_ACCESS_TOKEN_SALT`
- `AUTH_REFRESH_TOKEN_SALT`
- `GOOGLE_WEB_CLIENT_ID`
- `GOOGLE_IOS_CLIENT_ID`
- `GOOGLE_JWKS_CACHE_TTL_MS`
- `STORAGE_ADAPTER` (`local` | `r2`), `UPLOADS_DIR`, `PUBLIC_BASE_URL`, `UPLOAD_MAX_BYTES`, `UPLOAD_URL_TTL_SECONDS`
- `R2_*`, `S3_ENDPOINT`, `S3_REGION` (R2/S3 adapter)

## Verification

- `MIX_ENV=test mix test`
- `mix precommit`
