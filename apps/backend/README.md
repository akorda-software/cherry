# Backend

Phoenix backend for the mobile starter.

## Responsibilities

- completes provider auth callbacks for Google and Apple
- issues, refreshes, and revokes sessions
- exposes runtime config through `/api/config`

## Optional Billing Add-On

- exposes billing plans and subscription state when subscriptions are enabled
- publishes Stripe mobile runtime settings for the optional subscriptions module

## Local Setup

1. Run `mix setup`
2. Start the server with `mix phx.server`
3. Use `.env.example` as the local runtime template when wiring real env vars

## Runtime Flags

- `ENABLE_SUBSCRIPTIONS=true|false`

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

## Stripe Runtime Variables

- `STRIPE_SECRET_KEY`
- `STRIPE_BASE_URL`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_MERCHANT_DISPLAY_NAME`
- `STRIPE_MERCHANT_IDENTIFIER`
- `STRIPE_URL_SCHEME`

The backend publishes Stripe mobile settings through `/api/config` so the optional subscriptions module can mount Stripe only when that add-on is active.

## Verification

- `MIX_ENV=test mix test`
- `mix precommit`
