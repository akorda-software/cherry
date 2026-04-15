# Mobile Phoenix Foundation

## Local setup

1. `pnpm install`
2. `docker compose -f infra/docker-compose.yml up -d postgres`
3. `pnpm test:mobile`
4. `pnpm test:backend`

Phoenix owns provider validation, identity resolution, user creation, session issuance, refresh rotation, and session revocation. Mobile only initiates native providers, sends callback credentials, and keeps the session bundle in secure storage.

## Provider prerequisites

- Google mobile sign-in must produce a backend callback payload with `providerToken` and device metadata.
- Apple sign-in must include `providerToken`, `authorizationCode`, `idToken`, `nonce`, and device metadata.
- The current foundation uses provider modules under `apps/backend/lib/snack/identity/providers/` so production-grade JWT/JWKS validation can replace the stubbed foundation rules without changing controller or context boundaries.

## Version matrix

| Surface | Version |
| --- | --- |
| Node.js | `22.15.1` (`.nvmrc`) |
| pnpm | `10.33.0` (`packageManager`) |
| TypeScript | `5.9.3` |
| Vitest | `3.2.4` |
| Elixir | `1.18` |
| Phoenix | `1.8.3` |
| PostgreSQL | `17` (`infra/docker-compose.yml`) |

## Flow summary

- Mobile provider adapters normalize Google/Apple native credentials into shared callback DTOs.
- `createCompleteAuthCallback` sends those DTOs to Phoenix and persists the issued session through secure storage only.
- `createSessionManager` restores cached sessions, refreshes expired access tokens, retries one 401 with a rotated token, and signs out if refresh recovery fails.
- Phoenix persists `users`, `provider_identities`, `devices`, `session_families`, and `refresh_tokens` so refresh-token lineage can be rotated or revoked per device.

## Simulator and device caveats

- Apple sign-in usually needs a real Apple-capable environment; the current foundation keeps the nonce requirement explicit so simulator/device differences stay visible in the adapter contract.
- Secure persistence MUST stay behind the secure-store adapter. Do not add AsyncStorage fallbacks for refresh tokens.
- If a refresh token is reused after rotation, Phoenix revokes the whole session family. Mobile should treat that as a forced sign-out and clear local state.
