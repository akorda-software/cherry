# Backend

Phoenix backend for the mobile starter.

## Responsibilities

- completes provider auth callbacks for Google and Apple
- issues, refreshes, and revokes sessions
- exposes runtime config through `/api/config`
- exposes billing plans and subscription state
- initializes Stripe Payment Sheet sessions for mobile

## Local Setup

1. Run `mix setup`
2. Start the server with `mix phx.server`

## Runtime Flags

- `ENABLE_SUBSCRIPTIONS=true|false`

## Stripe Runtime Variables

- `STRIPE_SECRET_KEY`
- `STRIPE_BASE_URL`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_MERCHANT_DISPLAY_NAME`
- `STRIPE_MERCHANT_IDENTIFIER`
- `STRIPE_URL_SCHEME`

The backend publishes Stripe mobile settings through `/api/config` so the Expo app can mount `StripeProvider` without app-specific hardcoding.

## Verification

- `MIX_ENV=test mix test`
- `mix precommit`
