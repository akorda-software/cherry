# TDD Bootstrap

This batch establishes the minimum truth needed to switch the change into strict TDD.

Verified bootstrap commands for this repository:

1. `pnpm install`
2. `pnpm test:mobile`
3. `docker compose -f infra/docker-compose.yml up -d postgres`
4. `mix deps.get` inside `apps/backend`
5. `MIX_ENV=test mix test` inside `apps/backend` (the Phoenix `test` alias creates and migrates the test DB automatically)

Both foundations passed in this batch, so re-run `sdd-init` immediately now that Vitest and Phoenix/ExUnit are real, executable project capabilities.

Until that re-run happens, later apply batches should still treat strict TDD as REQUIRED BY CHANGE INTENT but must acknowledge the cached init state is stale.
