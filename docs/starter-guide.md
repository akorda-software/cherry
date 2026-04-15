# Starter Guide

## What This Starter Includes

The starter is split into base modules and optional modules.

Base modules:

- Native auth with Google and Apple
- Session persistence and refresh
- Expo Router shell with public and private boundaries
- Shared UI primitives and shell components
- Runtime config bootstrap from backend
- Feature flags consumed inside the mobile tree

Optional modules:

- Subscriptions with Stripe Payment Sheet

The routes under `apps/mobile/app/(app)` — `home`, `user`, `settings` — are intentional placeholders: empty scaffolds that exercise the shell, navigation, and session wiring. Replace them with product-specific screens when building on top of the starter.

## Production Readiness

This repo is a robust reusable starter, not a turnkey production deploy.

Before shipping a real app on top of it, you still need to decide and wire:

- CORS policy (no plug wired by default — native-only apps may not need it; web builds do)
- Rate limiting on `/api/auth/:provider/callback` and `/api/session/refresh`
- A real TLS termination story (the Endpoint forces SSL in prod; your infra needs to actually terminate it)
- Real values for every env var flagged in the "Enabling Subscriptions" and "Auth Setup Notes" sections

Runtime config refuses to boot in prod when required env vars are missing, so you'll get a loud failure rather than a silent fall-through to test credentials.

## Architecture Rules

Keep these rules stable when extending the starter:

1. `packages/contracts` is the source of truth for backend/mobile payloads.
2. Runtime config comes from backend `/api/config`, not from ad-hoc props.
3. Shared shell code stays generic and must not own product-specific business logic.
4. Optional modules should disappear cleanly when their feature flag is disabled.
5. App-specific product features should follow the same `presentation/application/domain/infrastructure` split used by subscriptions.

## Mobile Bootstrap Flow

At startup the mobile app:

1. Resolves the API base URL
2. Fetches `/api/config`
3. Builds the runtime feature flag reader
4. Mounts `RuntimeConfigProvider`
5. Mounts `SessionShellProvider`
6. Mounts `StripeProvider` only when Stripe runtime config exists

This lets the same app tree support apps with or without subscriptions.

## Backend Responsibilities

The Phoenix backend currently owns:

- provider callback completion for Google and Apple auth
- session refresh and revoke flows
- runtime config bootstrap
- billing plans and subscription state
- Stripe Payment Sheet session initialization

## Enabling Subscriptions

Subscriptions are controlled by the backend runtime flag:

- `ENABLE_SUBSCRIPTIONS=true`

When enabled, the backend should also expose Stripe runtime configuration:

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_MERCHANT_DISPLAY_NAME`
- `STRIPE_MERCHANT_IDENTIFIER` for iOS if needed
- `STRIPE_URL_SCHEME`

In production, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET` are required when `ENABLE_SUBSCRIPTIONS=true` — the backend refuses to boot if any are missing. In dev/test, harmless placeholders are used if they are not set.

Production also requires these auth salts (generate with `mix phx.gen.secret`):

- `AUTH_ACCESS_TOKEN_SALT`
- `AUTH_REFRESH_TOKEN_SALT`

If `ENABLE_SUBSCRIPTIONS=false`, the mobile shell hides subscription navigation and the subscription route redirects away.

## Auth Setup Notes

Mobile auth expects Expo/native configuration to be present.

Current mobile app config lives in `apps/mobile/app.json`.

Important values:

- `expo.scheme` — used for native redirects and Stripe return URLs
- `expo.extra.googleWebClientId`
- iOS bundle identifier and Android package name

When cloning this starter into a new app idea, update these identifiers before shipping.

## Creating a New App on Top of This Starter

1. Rename app identity in `apps/mobile/app.json`
2. Update bundle/package identifiers
3. Point mobile to the correct backend base URL if needed
4. Configure auth provider credentials
5. Decide whether subscriptions are enabled for this app
6. Add product-specific features under `apps/mobile/src/features/<your-feature>`
7. Reuse `shared/ui`, `shared/config`, and existing shell boundaries

## Where To Extend Safely

Good extension points:

- `apps/mobile/src/features` for new product features
- `apps/mobile/src/shared/ui` for reusable design system pieces
- `packages/contracts` for shared payload changes
- `packages/mobile-shared` for reusable mobile adapters
- `apps/backend/lib/snack_web/controllers/api` for new API endpoints

Avoid:

- hardcoding feature flags in layouts
- bypassing shared contracts with one-off payload shapes
- putting app-specific domain logic into `shared/ui` or shell navigation

## Verification Workflow

Use these commands before treating changes as starter-safe:

- `pnpm test:mobile`
- `pnpm test:backend`

For backend-only changes, also run `mix precommit` inside `apps/backend`.
