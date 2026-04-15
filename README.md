# Snack Starter

Reusable Expo mobile starter for building multiple apps on top of the same foundation.

This repository is organized around a stable mobile base:

- Google and Apple native sign-in
- Session bootstrap and refresh
- Reusable UI primitives and shell navigation
- Runtime feature flags
- Optional Stripe subscriptions module
- Phoenix backend that exposes auth, config, session, and billing APIs

## Workspace Layout

- `apps/mobile` — Expo app and reusable mobile feature modules
- `apps/backend` — Phoenix backend for auth, runtime config, and billing
- `packages/contracts` — shared request/response contracts between backend and mobile
- `packages/mobile-shared` — reusable mobile-only API and storage helpers
- `docs` — starter guides and setup notes
- `scripts` — test entrypoints and local helper scripts

## Core Idea

Treat this repo as a productized starter, not as a single app.

- `auth` is part of the base
- `shared/ui` is part of the base
- `subscriptions` is optional
- app-specific product logic should be added on top of this base, not mixed into it

When the `subscriptions` flag is disabled, the shell behaves as if the subscription module does not exist.

## Quick Start

1. Install dependencies with `pnpm install`
2. Start backend setup in `apps/backend` with `mix setup`
3. Run backend tests with `pnpm test:backend`
4. Run mobile and contracts tests with `pnpm test:mobile`
5. Start the Phoenix API from `apps/backend`
6. Start the Expo app from `apps/mobile`

## Test Commands

- `pnpm test`
- `pnpm test:mobile`
- `pnpm test:backend`
- `pnpm test:contracts`

## Documentation

- `docs/starter-guide.md` — how to use this repo as a reusable starter
- `apps/mobile/README.md` — mobile architecture and runtime bootstrap
- `apps/backend/README.md` — backend responsibilities and runtime config
- `packages/contracts/README.md` — shared contract boundaries
- `packages/mobile-shared/README.md` — reusable mobile helpers
