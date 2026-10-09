# Backend

Phoenix backend of Snack (dating API, sessions, chat and photo storage). Self-hosting guide (Spanish): `../../docs/12-self-hosting.md`.

## Responsibilities

- completes provider auth callbacks for Google and Apple
- issues, refreshes, and revokes sessions
- exposes runtime config through `/api/config`
- exposes the dating REST API for bootstrap, onboarding, discovery (ranking v2, undo), received likes, public profiles, activity summary, matches, chat, safety, settings, photo uploads, and push-token registration
- serves the chat WebSocket (`/socket`, channel `chat:{conversationId}`)
- exposes `/healthz` (liveness + version) and `/readyz` (database ping)
- serves the OpenAPI spec at `/openapi.yaml`

## Code boundaries

`Snack.Dating` is the public context; it delegates to focused modules. The
paginated inbox contract is shared with the mobile SDK and OpenAPI:

| Module | Responsibility |
| --- | --- |
| `Dating.Profiles` | Profile lifecycle, completeness and visibility state |
| `Dating.Preferences` | Discovery preference persistence |
| `Dating.Photos` / `Dating.PhotoUploads` | Photo ordering/deletion and verified uploads/quotas |
| `Dating.Tags` | Catalog and positive/blocked selections |
| `Dating.Locations` | Privacy grid and client location throttling |
| `Dating.Matching` / `Dating.PairLock` | Swipes, matches and shared pair serialization |
| `Dating.Messaging` | Message persistence and current conversation permissions |
| `Dating.Safety` / `Dating.Analytics` | Moderation and event persistence |
| `Dating.Discovery` + `Discovery.{Eligibility,Ranking,PageQuery}` | Feed orchestration, hard filters, integer scoring/pruning and bound SQL |
| `Dating.Social` + `Social.{Swipes,PublicProfiles,ReceivedLikes,Compatibility}` | Social facade and focused interaction/read modules |
| `Dating.Inbox` / `Dating.InboxCursor` | Bounded activity pages, current visibility and signed cursors |
| `Dating.ConversationReads` / `Dating.MessagePages` | Monotonic read watermarks and message-history keysets |
| `Notifications.Outbox` / `Notifications.PushWorker` | Transactional event jobs and asynchronous delivery |

The profile HTTP endpoints have separate controllers for profile fields,
preferences, photos, tags and location. `SnackWeb.OwnProfileJSON` serializes
preloaded data without querying the database; `SnackWeb.ChangesetJSON` formats
validation errors.

Concurrency guarantees live in the write modules. Refresh rotation locks the
session family before reading its current token state; logout revokes the family
and tokens in one transaction. Upload quotas and the first location write lock
the profile before checking limits. Swipes/blocks share `PairLock`, and messages
take the match lock before rechecking permissions. These checks rely on
[PostgreSQL's READ COMMITTED statement snapshots](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-READ-COMMITTED).

`Snack.Identity.JwksCache` owns each provider's ETS table under supervision. Cache
hits read ETS directly; misses share a single download, and provider failures
back off for 30 seconds (including failures with no cached keys). Existing keys
remain available on failed refreshes. TTLs use monotonic time. This prevents the
cache from disappearing when a login request exits, as described by
[ETS table ownership](https://www.erlang.org/doc/apps/stdlib/ets.html).

Match and message transactions insert recipient-specific Oban jobs containing
IDs only. HTTP replies and chat ACKs no longer wait for Expo. Workers recheck
privacy, active sessions and read watermarks, retry failures independently and
expire stale events. Delivery is at least once; Expo tickets confirm acceptance,
while receipt polling remains future work. Completed jobs are pruned after a day.

Ordinary sends broadcast directly after commit. If a caller composes a send
inside an outer transaction, `Dating.ChatBroadcastWorker` persists the broadcast
as an ID-only job; a caller rollback cannot publish a nonexistent message. It
has higher queue priority than external push and never changes the normal send
path into a queued broadcast.

`GET /api/matches` and `/api/conversations` now return at most 50 entries by
default (limit 1–100), plus `nextCursor`. Activity uses the first page's reference
time; visibility is checked on every page. Enrichment and decryption only touch
the selected page. `/api/conversations/:id/match` opens a chat directly, including
matches outside that first page. Typing events are limited to one permission
check/broadcast per second per channel, including denied senders.

## API Documentation

- `priv/static/openapi.yaml` is the machine-readable OpenAPI 3.0 contract for REST clients and Swagger tooling.
- `/openapi.yaml` serves the same spec when the Phoenix endpoint is running.
- `../../docs/06-contratos-mobile-backend.md` is the human contract for mobile behavior, including the Phoenix WebSocket chat contract.
- `../../docs/10-plan-fases.md` defines the implementation phases and their current status.

## Local Setup

1. Start PostGIS: `docker compose -f ../../infra/docker-compose.yml up postgres -d` (port 5510)
2. `cp .env.example .env` (in dev, `config/runtime.exs` loads `.env`; its `DATABASE_URL` already points to port 5510)
3. `mix setup` (deps, database, migrations and the tag catalog)
4. `mix phx.server` (port 4000, all interfaces)

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

To test Discover with your own dev account (anywhere, not only Madrid), create profiles around it, compatible both ways with your gender, filters and intents (idempotent; re-running also clears their swipes so they show up again):

```bash
EMAIL=you@example.com COUNT=24 mix run priv/repo/demo_nearby.exs
```

With the compose PostGIS on port 5510: `DATABASE_URL=ecto://postgres:postgres@localhost:5510/snack_dev mix run priv/repo/demo_seeds.exs`.

## Core Runtime Variables

- `PORT`
- `PHX_SERVER`
- `PHX_HOST`
- `DATABASE_URL`
- `DATABASE_SSL`
- `POOL_SIZE`
- `DB_JIT` (`false`), `DB_QUEUE_TARGET_MS` (50), `DB_QUEUE_INTERVAL_MS` (1000), `DB_QUERY_TIMEOUT_MS` (15000)
- `METRICS_TOKEN` (unset disables `/metrics`; otherwise use its own Bearer)
- `PUSH_CONCURRENCY` (4 workers per node, maximum 32)
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
- `CORS_ALLOWED_ORIGINS` (web clients only)
- `APPLE_JWKS_CACHE_TTL_MS`, `EXPO_PUSH_*`, `APP_VERSION`, `ECTO_IPV6`

Full list with defaults and which ones are mandatory in prod: `../../docs/12-self-hosting.md` §4.

## Verification

- `mix test` (localhost:5432/snack_test by default). With the compose PostGIS:
  `TEST_DATABASE_URL=ecto://postgres:postgres@localhost:5510/snack_test mix test`.
  `DATABASE_URL` is only honoured when its database name contains `_test`: tests
  wipe their database, so a dev `DATABASE_URL` exported in the shell makes
  `mix test` refuse to run instead of wiping `snack_dev`.
- `mix precommit`

Concurrency regressions in `test/snack/backend_concurrency_test.exs` and
`test/snack/swipe_concurrency_test.exs` use independent committed connections,
then remove their own fixtures. A shared sandbox connection would serialize
the transactions and hide these races.

## Performance measurement

Use a dedicated database whose name ends in `_bench`:

```bash
export DATABASE_URL=ecto://postgres:postgres@localhost:5510/snack_review_bench
mix ecto.create
mix ecto.migrate
mix run priv/repo/seeds.exs
BENCH_REQUESTS=5000 BENCH_CONCURRENCY=1,8,32 mix run priv/repo/bench/chat_authorization_bench.exs
BENCH_PROFILES=10000 BENCH_RUNS=5 BENCH_PLAN=1 mix run priv/repo/bench/discovery_bench.exs
```

The chat benchmark creates and removes its own fixtures and reports throughput,
p50/p95/p99, query count and errors. The discovery benchmark rebuilds synthetic
data in the benchmark database and prints the actual SQL execution plan.

Measured locally on 2026-10-01 (OTP 28, Elixir 1.18.4, 8 schedulers, database pool
of 10 connections, 100 chat pairs, 5,000 checks per run): chat authorization
changed from four queries to one. With 32 concurrent requests, throughput went
from 22,849 to 40,516 checks/s and p95 from 2.40 to 1.45 ms, with no errors.
This isolates authorization and connection-pool waiting; it excludes HTTP,
WebSocket fan-out, external push delivery and a production-sized chat history.

Before this follow-up, discovery with 10,000 synthetic profiles and 995,757
swipes took 59.0 ms (feed p50) with unlimited distance in the first five-run
measurement. A fresh sequential comparison with 20 runs per probe on the same
data, still on the shared development host, gave:

| Probe | Eligible candidates | Before p50 / p95 (ms) | After p50 / p95 (ms) |
| --- | ---: | ---: | ---: |
| 25 km + expansion, relationship | 677 | 33.8 / 52.2 | 19.3 / 34.2 |
| 50 km + expansion, go with the flow | 1,306 | 38.7 / 56.2 | 24.6 / 26.6 |
| 100 km + expansion, casual | 659 | 26.2 / 34.6 | 19.9 / 20.5 |
| Unlimited distance, all genders | 2,553 | 57.4 / 63.0 | 20.5 / 26.4 |
| 25 km, heavy swiper, compatible only | 576 | 29.3 / 30.1 | 25.5 / 27.1 |
| Most-swiped profile (2,088 received swipes) | 528 | 27.9 / 29.3 | 16.9 / 18.1 |

The original and optimized implementation returned exactly the same 5,612 rows
and ordering across every page of the first five viewers at a pinned reference
time. These runs measure feed cost, rather than sustained application capacity.

The follow-up removes synchronous Expo delivery and unbounded inbox endpoints.
Discovery aggregates tag weights over the eligible set and only computes the
expensive fairness penalty for candidates that can still enter the page. Its
six-point maximum gives a safe pruning bound; it keeps the full ranking rather
than imposing an arbitrary candidate cap. Regression tests compare every page
against exhaustive scoring. `DB_JIT=false` is scoped to Snack connections, as JIT
compilation outweighed execution time in these short feed queries.

The [sustained-load procedure](../../infra/load/README.md) includes isolated data
generation, real rotating sessions, a mixed HTTP/WebSocket k6 scenario, controlled
Expo latency/failures, metrics and recovery checks. `Snack.Metrics` exports
bounded, aggregated histograms (microseconds) for HTTP, database query/pool wait,
chat and push, plus VM memory/process/run-queue gauges. It uses Peep storage
distributed across schedulers and never retains a row per request until scrape.

Capacity for tens of thousands of active users still needs the complete workload
on deployment hardware. Measure connection count and actions per second
separately, including WebSocket fan-out, message history, push backlog and
generator limits. Size the database pool from observed queue/query times and the
connection budget across all nodes; push workers share that pool. If the push
queue grows at the target workload, measure batching across recipients as the
next step. New concurrent message indexes replace the redundant chronological
index; advisory migration locks serialize these migrations across replicas.

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
