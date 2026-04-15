# Proposal: Mobile Phoenix Foundation

## Intent
Create the long-term foundation for a new product using a mandatory monorepo, Expo mobile app, and Phoenix + PostgreSQL backend where Phoenix owns identity resolution, user creation, and session issuance.

## Scope

### In Scope
- Monorepo structure, workspace boundaries, and shared-package policy.
- Expo latest stable mobile foundation with feature-first layered architecture.
- Phoenix latest stable backend foundation with separated `Accounts`, `Identity`, and `Sessions` contexts.
- Native-first Google/Apple sign-in flow, backend provider validation, and app session issuance.
- Initial domain/data model for users, identities, devices, and rotating refresh sessions.

### Out of Scope
- Additional auth providers, web clients, admin tooling.
- Social graph, payments, notifications, analytics, or product-specific features.
- Full production infra hardening beyond foundation-level conventions.

## Capabilities

### New Capabilities
- `mobile-auth-foundation`: Native mobile sign-in, secure token storage, authenticated session bootstrap.
- `identity-resolution`: Provider credential validation, user creation/linking, canonical identity ownership in Phoenix.
- `session-management`: Short-lived access tokens, rotating refresh tokens, device-aware revocation and replay handling.
- `monorepo-platform-foundation`: Repo layout, package boundaries, shared contracts, and local-dev workflows.

### Modified Capabilities
- None.

## Approach
Use a polyglot monorepo with `apps/mobile` (Expo), `apps/backend` (Phoenix), `packages/contracts`, `packages/mobile-shared`, and `infra/`. Mobile features keep `presentation`, `application`, `domain`, and `infrastructure` layers. Backend remains a single Phoenix app for now, with strong context boundaries instead of an umbrella. Pin latest stable Expo, Phoenix, and PostgreSQL during implementation.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/mobile/` | New | Expo app foundation, auth flow, secure storage abstraction |
| `apps/backend/` | New | Phoenix contexts, auth/session APIs, Postgres persistence |
| `packages/contracts/` | New | Shared API schemas/contracts |
| `packages/mobile-shared/` | New | Shared mobile transport, config, storage, UI primitives |
| `infra/` | New | Local Postgres/dev bootstrap |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Apple auth setup/validation complexity | High | Specify nonce, identifiers, and test-device rules in design |
| Refresh rotation bugs weaken security | High | Design token family, reuse detection, and revocation before coding |
| Monorepo tooling drift across JS/Elixir | Medium | Define root tasks, version pinning, and ownership rules |

## Rollback Plan
Keep changes additive by foundation area; if a path proves wrong, revert the affected app/package scaffold without cross-cutting product migrations.

## Dependencies
- Expo latest stable
- Elixir/Phoenix latest stable
- PostgreSQL latest stable
- Google Sign-In and Sign in with Apple provider setup

## Success Criteria
- [ ] Specs clearly define monorepo, auth/session, and domain contracts.
- [ ] Design defines provider-validation and token-rotation flows end to end.
- [ ] Foundation preserves backend ownership and extensibility over short-term shortcuts.
