## Exploration: Architecture foundation for a new mobile product with Expo + React Native frontend and Elixir Phoenix backend

### Current State
This repository is effectively greenfield today. The only detected project file is `.atl/skill-registry.md`; there is no existing mobile app, Phoenix backend, OpenSpec scaffold, or shared runtime code yet.

### Affected Areas
- `openspec/changes/mobile-phoenix-foundation/exploration.md` — exploration artifact for this change.
- `apps/mobile/` — proposed Expo React Native application root.
- `apps/backend/` — proposed Phoenix application root.
- `packages/contracts/` — proposed shared API contracts, schemas, and generated client types.
- `packages/mobile-shared/` — proposed shared mobile primitives (networking, storage, config, design-system foundations).
- `infra/` — proposed local infrastructure and deployment bootstrap (Postgres, env templates, scripts).

### Approaches
1. **Polyglot monorepo with Expo app + single Phoenix app organized by contexts** — keep one repository, one Phoenix application, and strict internal boundaries.
   - Pros: Lowest structural overhead, clear ownership, fast to evolve, Phoenix contexts map well to domain boundaries, easier onboarding than umbrella from day one.
   - Cons: Requires discipline to keep contexts clean, cross-language tooling needs explicit conventions, some future extractions may be manual.
   - Effort: Medium

2. **Polyglot monorepo with Expo app + Phoenix umbrella from day one** — split backend into multiple OTP apps immediately.
   - Pros: Strong backend isolation early, easier future extraction of subsystems, explicit compile-time boundaries.
   - Cons: Higher upfront complexity, more ceremony before domain pressure exists, slower initial development, can overfit a system that is still finding its shape.
   - Effort: High

3. **Use provider-managed auth/session ownership** — mobile signs in with Google/Apple and a third-party auth platform owns sessions.
   - Pros: Faster setup, less auth code, fewer backend responsibilities initially.
   - Cons: Violates the requirement that Phoenix owns identity and sessions, weakens control over security/domain rules, makes future auth customization harder.
   - Effort: Low

### Recommendation
Recommend **Approach 1**: a **polyglot monorepo** with `apps/mobile` (Expo), `apps/backend` (Phoenix), and a small set of shared packages; keep the backend as a **single Phoenix app with explicit contexts**, not an umbrella yet. This gives strong long-term control without paying umbrella complexity before the domain proves it is needed.

For the mobile side, use a **feature-first architecture with clear layers per feature**: `presentation`, `application`, `domain`, and `infrastructure`, plus a small `shared` foundation for transport, secure storage, UI primitives, and config. For the backend, separate **Accounts**, **Identity**, and **Sessions** concerns so Phoenix validates provider credentials, decides whether/how to create or link users, and issues the app's own short-lived access token plus rotating refresh token.

Auth should be **native/mobile-first**: the device obtains a Google or Apple credential, sends it to Phoenix, Phoenix validates it against the provider, resolves or creates the internal user, and issues app session tokens. Sensitive tokens on device should be stored behind a storage abstraction backed by **Expo SecureStore** (or a compatible secure keychain wrapper), never AsyncStorage.

### Risks
- **Apple sign-in is the sharp edge early**: nonce handling, token validation rules, simulator/device differences, and bundle/service identifiers need careful proposal-level detail.
- **Refresh rotation is security-critical**: replay detection, token family invalidation, concurrent refresh handling, and device-scoped revocation must be designed before implementation.
- **Cross-language monorepo tooling can get messy**: JS and Elixir need explicit task orchestration, version pinning, and local-dev conventions.
- **Email is not a safe identity key by itself**: Google and Apple may expose different email semantics; provider identities must be first-class records.

### Ready for Proposal
Yes — the proposal should formalize: monorepo layout and tooling, Phoenix context boundaries, mobile feature/layer boundaries, auth/session sequence flows, initial schema/entities, secure storage policy, token lifetimes/rotation rules, and the exact latest stable version matrix to pin at implementation time.
