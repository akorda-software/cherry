# Mobile App

Expo application that acts as the reusable mobile starter runtime.

## Responsibilities

- bootstraps runtime config from backend `/api/config`
- mounts feature flags and session providers
- mounts Stripe only when runtime config includes Stripe mobile settings
- owns the public/private Expo Router shell
- hosts reusable mobile feature modules

## Current Base Modules

- `features/auth` — Google and Apple native sign-in plus session orchestration
- `shared/ui` — reusable primitives, composites, and shell scaffolding
- `shared/config` — runtime bootstrap and feature flag access
- `features/subscriptions` — optional Stripe subscription module

## Optional Module Rule

Subscriptions must be safe to disable.

- drawer entry disappears
- subscription route redirects away
- paywall checks short-circuit
- no billing API calls are made when the feature is off

## Key Runtime Files

- `app/_layout.tsx` — root bootstrap and provider composition
- `app/(app)/_layout.tsx` — authenticated shell
- `src/shared/config/index.tsx` — runtime config provider and feature flag hooks
- `src/features/subscriptions` — optional billing module

## Running The Mobile Tests

- `pnpm --dir apps/mobile test`

Or from the repo root:

- `pnpm test:mobile`
