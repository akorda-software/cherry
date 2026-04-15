# Design: Mobile Phoenix Foundation

## Technical Approach
Build a greenfield polyglot monorepo where Expo owns native provider initiation, Phoenix owns credential validation/identity/session decisions, and PostgreSQL persists canonical users, identities, devices, and refresh-token lineage. This implements the proposal/specs while optimizing for future providers/clients without restructuring roots.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|---|---|---|---|
| Repo shape | Separate repos, umbrella backend, polyglot monorepo | Polyglot monorepo + single Phoenix app | Lowest coordination cost now; preserves clean ownership and future extraction paths. |
| JS tooling | npm, pnpm, bun | pnpm workspaces + Turbo | Fast workspaces/cache, good Expo support, no coupling to backend runtime. |
| Version pinning | Floating latest, exact pins | Root `.tool-versions` + `.nvmrc`, exact major/minor pins | Reduces JS/Elixir drift across machines/CI. |
| Backend auth ownership | Provider-managed sessions, Phoenix-owned sessions | Phoenix-owned access + rotating refresh | Required for control, revocation, linking, and future auth rules. |
| Backend structure | Phoenix umbrella, single app with contexts | Single app with `Accounts`, `Identity`, `Sessions` | Avoids premature OTP complexity while keeping domain boundaries explicit. |

## Data Flow

```text
Mobile UI -> auth use case -> native provider adapter
         -> backend /api/auth/:provider/callback
         -> Identity validates token + Accounts resolves user
         -> Sessions issues access/refresh + device session
         -> secure storage persists session bundle
```

Google/Apple refresh path:

```text
app start/API 401 -> session application service -> /api/session/refresh
                  -> Sessions rotates refresh token family
                  -> secure storage replaces prior bundle atomically
```

## File Changes

| File | Action | Description |
|---|---|---|
| `apps/mobile/` | Create | Expo app root with `src/features`, `src/shared`, platform config, tests. |
| `apps/backend/` | Create | Phoenix app with auth APIs, contexts, Ecto schemas, tests. |
| `packages/contracts/` | Create | Shared auth/session DTOs and schema validation. |
| `packages/mobile-shared/` | Create | API client, secure storage adapter, env/config, shared UI primitives. |
| `infra/docker-compose.yml` | Create | Local PostgreSQL and supporting dev services. |
| `pnpm-workspace.yaml`, `turbo.json`, `.tool-versions` | Create | Monorepo orchestration and version pinning. |

## Interfaces / Contracts

Top-level layout:

```text
apps/{mobile,backend}
packages/{contracts,mobile-shared}
infra/ docs/ scripts/
```

Mobile module rule:

```text
features/auth/{presentation,application,domain,infrastructure}
shared/{api,config,storage,ui,device}
Dependency direction: presentation -> application -> domain; infrastructure implements ports from application/domain only.
```

Phoenix module rule:

```text
Snack.Accounts    # users
Snack.Identity    # provider verification, identity linking
Snack.Sessions    # access/refresh issuance, rotation, revocation
SnackWeb.Controllers.Api.{AuthController,SessionController}
Dependency direction: Web -> contexts; Sessions depends on Accounts identities by IDs, never on web/mobile code.
```

Auth contract:

```ts
POST /api/auth/google|apple/callback
{ providerToken, idToken?, authorizationCode?, device:{installationId, platform, deviceName}, nonce? }
=> { accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, user }
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Mobile use cases, secure-storage adapter, Phoenix token/identity rules | Jest/Vitest in mobile packages; ExUnit for contexts. |
| Integration | Phoenix provider validation, user linking, refresh rotation/reuse revocation | ExUnit + Bypass/Mox + Postgres sandbox. |
| E2E | Native sign-in happy path, bootstrap, logout, expired access -> refresh | Detox for mobile; Phoenix API running against local Postgres. |

## Migration / Rollout

Phase 1 scaffold repo/tooling/contracts. Phase 2 scaffold Phoenix contexts/schema/auth APIs. Phase 3 scaffold mobile auth feature and secure storage. Phase 4 implement Google flow. Phase 5 implement Apple flow with nonce rules. Phase 6 implement refresh rotation/reuse detection/logout/bootstrap. No legacy migration required.

## Open Questions

- [ ] Final version matrix to pin at implementation time (`Expo SDK`, `React Native`, `Elixir`, `Phoenix`, `PostgreSQL`).
- [ ] Whether Apple web-flow fallback is needed for simulator/dev, or physical-device-only for first release.

## Security Notes

- Phoenix validates Google ID token against Google JWKS and Apple identity token against Apple JWKS, issuer, audience, nonce, and time claims; mobile never trusts provider payloads alone.
- `users`, `provider_identities`, `devices`, `session_families`, and `refresh_tokens` are first-class tables; `provider_identities` is unique on `(provider, provider_subject)`.
- Refresh tokens are opaque random secrets; only salted hashes are stored. Each row links to a family/root session and optional parent token for lineage.
- On refresh, rotate inside one DB transaction: mark prior token rotated, create successor, issue new access token. Reuse of a rotated/revoked token revokes the whole family/device session.
- Access token is short-lived JWT or signed token carrying `sub`, `session_id`, and expiry only. Refresh token lives only in secure device storage (Keychain/Keystore via SecureStore wrapper), never AsyncStorage.
- Logout clears secure storage first, then calls backend revoke; invalid session/bootstrap failure clears local state and returns user to signed-out flow.
