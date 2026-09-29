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

`demo_seeds.exs` refuses to run outside `MIX_ENV=dev` or against a database whose name does not end in `_dev`, re-seeds the tag catalog and is idempotent (re-running resets the demo scenario without duplicating anything). Log in with the dev endpoint:

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
- `APPLE_AUDIENCES`
- `MESSAGE_ENCRYPTION_KEY`
- `STORAGE_ADAPTER` (`local` | `r2`), `UPLOADS_DIR`, `PUBLIC_BASE_URL`, `UPLOAD_MAX_BYTES`, `UPLOAD_URL_TTL_SECONDS`
- `R2_*`, `S3_ENDPOINT`, `S3_REGION` (R2/S3 adapter)

## Verification

- `mix test` (localhost:5432/snack_test by default). With the compose PostGIS:
  `TEST_DATABASE_URL=ecto://postgres:postgres@localhost:5510/snack_test mix test`.
  `DATABASE_URL` is only honoured when its database name contains `_test`: tests
  wipe their database, so a dev `DATABASE_URL` exported in the shell makes
  `mix test` refuse to run instead of wiping `snack_dev`.
- `mix precommit`

## Releases and Docker

- `MIX_ENV=prod mix release` builds `_build/prod/rel/cherry` and the tarball
  `_build/prod/cherry-<version>.tar.gz`.
- `bin/migrate` runs the migrations and then syncs the tag catalog (idempotent;
  never the demo data); `bin/seed` only syncs the catalog. The Docker image runs
  `bin/migrate && exec bin/server` by default.
- In prod the release refuses to boot with missing or weak secrets, without
  `PHX_HOST`, or (with `STORAGE_ADAPTER=local`) without `UPLOADS_DIR` and
  `PUBLIC_BASE_URL`; the error lists every problem at once. A provider without
  audiences (`GOOGLE_WEB_CLIENT_ID`/`GOOGLE_IOS_CLIENT_ID`, `APPLE_AUDIENCES`) is
  logged at boot: its logins would all be rejected.
