# Tasks: Mobile Phoenix Foundation

## Phase 1: Bootstrap & TDD Activation
Acceptance focus: unavoidable setup only; after this phase, strict TDD is active.

- [x] 1.1 Create `pnpm-workspace.yaml`, `turbo.json`, root `package.json`, `.nvmrc`, `.tool-versions`, and `infra/docker-compose.yml` for Expo + Phoenix + PostgreSQL orchestration.
- [x] 1.2 Scaffold `apps/mobile`, `apps/backend`, `packages/contracts`, `packages/mobile-shared`, `docs`, and `scripts` with boundary READMEs and minimal package manifests.
- [x] 1.3 Add mobile Vitest foundation in `apps/mobile/{package.json,vitest.config.ts,tsconfig.json,test/setup.ts}` and `packages/mobile-shared/package.json` so TypeScript tests can run first.
- [x] 1.4 Generate the Phoenix app in `apps/backend` with `mix.exs`, `config/test.exs`, `test/test_helper.exs`, and DB sandbox wiring so ExUnit is runnable immediately.
- [x] 1.5 Document `docs/tdd-bootstrap.md` with the exact point to re-run `sdd-init`; all later tasks assume strict TDD with Vitest on mobile and ExUnit on backend.

## Phase 2: Shared Contracts & Mobile Foundation (Strict TDD)
Acceptance focus: RED/GREEN/REFACTOR begins once Phase 1 runners pass.

- [x] 2.1 RED: write Vitest specs in `packages/contracts/src/{auth,session}.test.ts` and `apps/mobile/src/features/auth/application/*.test.ts` for callback DTOs, bootstrap, logout, and secure-storage-only persistence.
- [x] 2.2 GREEN: implement `packages/contracts/src/{auth.ts,session.ts}` plus `packages/mobile-shared/src/{api,config,storage}/` adapters to satisfy those tests.
- [x] 2.3 REFACTOR: scaffold `apps/mobile/src/features/auth/{presentation,application,domain,infrastructure}` and `src/shared/{api,config,storage,device,ui}` without breaking passing Vitest coverage.

## Phase 3: Phoenix Identity & Session Foundation (Strict TDD)
Acceptance focus: Phoenix owns users, identities, devices, and session lifecycle.

- [x] 3.1 RED: add ExUnit coverage in `apps/backend/test/snack/{accounts,identity,sessions}_test.exs` and controller tests for first login, returning login, refresh, reuse detection, and device logout.
- [x] 3.2 GREEN: implement `Snack.Accounts`, `Snack.Identity`, `Snack.Sessions`, Ecto migrations/schemas for `users`, `provider_identities`, `devices`, `session_families`, `refresh_tokens`, and API routes/controllers.
- [x] 3.3 REFACTOR: centralize backend auth config in `apps/backend/config/*.exs` and provider modules under `lib/snack/identity/providers/` while keeping ExUnit green.

## Phase 4: Provider Flows, Wiring & Verification (Strict TDD)
Acceptance focus: native providers, bootstrap, refresh rotation, and docs align with approved scope.

- [x] 4.1 RED: add Vitest mobile flow tests and ExUnit integration tests for Google/Apple callback handling, bootstrap recovery, 401-triggered refresh, and revoke/logout behavior.
- [x] 4.2 GREEN: implement Google/Apple mobile adapters, Phoenix provider verifiers, identity linking, token rotation/revocation, and navigation/token-manager wiring.
- [x] 4.3 REFACTOR: publish `docs/mobile-phoenix-foundation.md` with local setup, provider prerequisites, version matrix, and simulator/device caveats validated by the passing test suites.
