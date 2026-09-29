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

In this repo the routes under `apps/mobile/app/(app)` are Snack's product screens (Descubrir, Likes, Chats, Yo, settings…; see `docs/07-flujos-usuario.md`). When building another app on top of the starter, replace them with your own product screens.

## Production Readiness

This repo is a robust reusable starter, not a turnkey production deploy.

Before shipping a real app on top of it, you still need to decide and wire:

- CORS policy (`SnackWeb.Plugs.Cors`, driven by `CORS_ALLOWED_ORIGINS`: any origin in dev, none elsewhere unless listed — native-only apps do not need it; web builds do)
- Rate limiting on `/api/auth/:provider/callback` and `/api/session/refresh` (not implemented)
- A real TLS termination story (the Endpoint forces SSL in prod; your infra needs to actually terminate it)
- Real values for every env var flagged in the "Auth Setup Notes" section

Runtime config refuses to boot in prod when required env vars are missing or secrets are weak, so you'll get a loud failure rather than a silent fall-through to test credentials. Full self-hosting guide (Spanish): `docs/12-self-hosting.md`.

## Architecture Rules

Keep these rules stable when extending the starter:

1. `packages/contracts` is the source of truth for backend/mobile payloads.
2. Runtime config comes from backend `/api/config`, not from ad-hoc props.
3. Shared shell code stays generic and must not own product-specific business logic.
4. Optional modules should disappear cleanly when their feature flag is disabled.
5. App-specific product features should follow the same `presentation/application/domain/infrastructure` split used by the optional modules.

Optional routes and optional navigation entries should register themselves through the add-on registry instead of being hardcoded directly into the authenticated shell.
Domain visibility rules should live in reusable helpers and evaluate session data such as `user.roles` and `user.tier`, not ad-hoc booleans scattered across screens.

## Mobile Bootstrap Flow

At startup the mobile app:

1. Resolves the API base URL
2. Fetches `/api/config`
3. Builds the runtime feature flag reader
4. Mounts `RuntimeConfigProvider`
5. Mounts `SessionShellProvider`
6. Mounts add-on providers only when the active module needs them

This keeps the base app tree stable while optional modules mount their own runtime only when used.
The settings screen can resolve addon entry points from the same registry, which keeps future optional menus out of the shell core.

## Backend Responsibilities

The Phoenix backend currently owns:

- provider callback completion for Google and Apple auth
- session refresh and revoke flows
- runtime config bootstrap

Production requires these auth salts (generate with `mix phx.gen.secret`):

- `AUTH_ACCESS_TOKEN_SALT`
- `AUTH_REFRESH_TOKEN_SALT`

## Auth Setup Notes

Mobile auth expects Expo/native configuration to be present.

Current mobile app config lives in `apps/mobile/app.config.ts` and should be driven by env vars.

Important values:

- `expo.scheme` — used for native redirects
- `expo.extra.googleWebClientId`
- `expo.extra.googleIosClientId`
- iOS bundle identifier and Android package name

Recommended mobile env vars:

- `EXPO_APP_NAME`
- `EXPO_APP_SLUG`
- `EXPO_APP_SCHEME`
- `EXPO_ANDROID_PACKAGE`
- `EXPO_IOS_BUNDLE_IDENTIFIER`
- `EXPO_PUBLIC_API_BASE_URL_ANDROID`
- `EXPO_PUBLIC_API_BASE_URL_IOS`
- `EXPO_PUBLIC_API_BASE_URL_WEB`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `GOOGLE_IOS_URL_SCHEME`

Backend Google token verification expects matching provider audiences:

- `GOOGLE_WEB_CLIENT_ID`
- `GOOGLE_IOS_CLIENT_ID`

Backend runtime variables are documented in `apps/backend/.env.example`.

When cloning this starter into a new app idea, update these identifiers before shipping.

## Creating a New App on Top of This Starter

1. Rename app identity in `apps/mobile/.env` or your deploy env vars
2. Update bundle/package identifiers
3. Point mobile to the correct backend base URL if needed
4. Configure auth provider credentials
5. Add product-specific features under `apps/mobile/src/features/<your-feature>`
6. Reuse `shared/ui`, `shared/config`, and existing shell boundaries

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
- mixing role/tier visibility checks directly into random screens when the same rule can live in `src/shared/authz`

## Verification Workflow

Use these commands before treating changes as starter-safe:

- `pnpm test:mobile`
- `pnpm test:backend`

For backend-only changes, also run `mix precommit` inside `apps/backend`.
