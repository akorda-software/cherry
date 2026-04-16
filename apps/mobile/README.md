# Mobile App

Expo application that acts as the reusable mobile starter runtime.

## Responsibilities

- bootstraps runtime config from backend `/api/config`
- mounts feature flags and session providers
- owns the public/private Expo Router shell
- hosts reusable mobile feature modules

## Current Base Modules

- `features/auth` — Google and Apple native sign-in plus session orchestration
- `shared/ui` — reusable primitives, composites, and shell scaffolding
- `shared/config` — runtime bootstrap and feature flag access

## Optional Add-On Modules

- `features/subscriptions` — optional Stripe subscription module

The subscriptions route owns its own billing runtime so Stripe is not mounted by the base app shell.
Optional screens are registered through a shared add-on registry instead of being hardcoded into the private layout.
Optional navigation entries are also resolved from that same registry so settings or future menus do not need addon-specific wiring.

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
- `app/(app)/subscriptions.tsx` — optional subscription route wrapper
- `src/features/optional-modules.ts` — optional route and navigation registry
- `src/shared/authz/domain-access.ts` — reusable role/tier visibility rules

## Running The Mobile Tests

- `pnpm --dir apps/mobile test`

Or from the repo root:

- `pnpm test:mobile`
