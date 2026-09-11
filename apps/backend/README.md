# Backend

Phoenix backend for the mobile starter.

## Responsibilities

- completes provider auth callbacks for Google and Apple
- issues, refreshes, and revokes sessions
- exposes runtime config through `/api/config`
- exposes the dating REST API for bootstrap, onboarding, discovery, matches, chat, safety, settings, photo uploads, and push-token registration
- serves the OpenAPI spec at `/openapi.yaml`

## API Documentation

- `priv/static/openapi.yaml` is the machine-readable OpenAPI 3.0 contract for REST clients and Swagger tooling.
- `/openapi.yaml` serves the same spec when the Phoenix endpoint is running.
- `../../docs/06-contratos-mobile-backend.md` is the human contract for mobile behavior, including the Phoenix WebSocket chat contract.
- `../../docs/10-plan-fases.md` defines the implementation phases and their current status.

## Local Setup

1. Run `mix setup`
2. Start the server with `mix phx.server`
3. Use `.env.example` as the local runtime template when wiring real env vars

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

## Verification

- `MIX_ENV=test mix test`
- `mix precommit`
