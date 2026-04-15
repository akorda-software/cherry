## Exploration: Stripe-based Feature-Flagged Subscription Module

### Current State

The snack monorepo has three completed and archived changes providing:
- **Backend**: Phoenix 1.8 with `Snack.Accounts` (user CRUD), `Snack.Identity` (OAuth provider login via Google/Apple), `Snack.Sessions` (token-based session lifecycle with refresh-token rotation). API controllers under `SnackWeb.Controllers.Api` serve `/api/auth/:provider/callback`, `/api/session/refresh`, `/api/session`. Config via `Snack.Auth` module reads from application env.
- **Mobile**: Expo Router app with feature-first architecture. `features/auth/` has four layers (presentation, application, domain, infrastructure). Shared layers: `api`, `config`, `storage`, `ui`, `device`. Theme-aware UI system with tokens, primitives, composites, and app-shell components. Navigation uses `(app)` (authenticated drawer+tabs) and `(public)` (login) route groups.
- **Shared packages**: `@snack/contracts` (type contracts for auth/session), `@snack/mobile-shared` (infrastructure adapters: AuthApi, SessionApi, SecureSessionStorage, AuthConfig).

No billing or subscription code exists yet. The backend has no Stripe dependency. The mobile app has no paywall or plan concept.

### Affected Areas

#### Backend
- `apps/backend/lib/snack/` — new `Billing` context (customer, subscription, plan schemas + context module)
- `apps/backend/lib/snack_web/controllers/api/` — new `BillingController`, `WebhookController`
- `apps/backend/lib/snack_web/router.ex` — new route scope for billing API + webhook endpoint
- `apps/backend/lib/snack/application.ex` — optional supervision tree entry for webhook processor
- `apps/backend/config/` — Stripe API keys, feature flag config, webhook secret
- `apps/backend/mix.exs` — add Stripe client dependency (or use Req directly)
- `apps/backend/test/` — new test modules for Billing context + controller tests
- `apps/backend/priv/repo/migrations/` — new migrations for customers, subscriptions, plans tables

#### Mobile
- `apps/mobile/src/features/` — new `subscriptions/` feature with all four layers
- `apps/mobile/app/(app)/` — conditional navigation entries (plans screen in drawer or tabs)
- `apps/mobile/src/shared/config/` — feature flag configuration
- `apps/mobile/src/shared/router/` — conditional route registration utilities
- `apps/mobile/src/shared/ui/` — potentially new paywall composites
- `apps/mobile/test/` — new test files for subscription feature

#### Shared
- `packages/contracts/src/` — new subscription/billing type contracts
- `packages/mobile-shared/src/` — new subscription API adapter

### Approaches

#### 1. Self-Contained Billing Context with Runtime Feature Flag (RECOMMENDED)

A new `Snack.Billing` context that is structurally independent from existing contexts, gated by a runtime configuration flag. On mobile, a new `features/subscriptions/` feature module that is always compiled but conditionally rendered via a feature-flag hook.

**Backend**:
- `Snack.Billing` context owns: Customer, Subscription, Plan schemas; subscription lifecycle logic; Stripe API integration
- `Snack.Features` module reads `config :snack, :features, subscriptions: true/false`
- Router uses a custom pipeline `plug :require_feature, :subscriptions` that returns 404 when disabled
- Webhook endpoint always exists (returns 200 regardless) but only processes events when enabled
- `Snack.Billing.StripeClient` behaviour + `Req`-based implementation for Stripe API calls

**Mobile**:
- `features/subscriptions/` with presentation/application/domain/infrastructure layers
- `useFeatureFlag("subscriptions")` hook reads from config
- Drawer/tabs navigation conditionally includes subscription-related screens
- Paywall component renders children or lock screen based on flag + subscription status

- **Pros**: Clean separation; existing code untouched when disabled; testable in isolation; follows existing feature-first pattern; runtime flag allows A/B and per-environment control
- **Cons**: Code is always compiled and bundled (slightly larger binary); runtime flag check adds tiny overhead
- **Effort**: Medium

#### 2. Compile-Time Exclusion with OTP Conditional Compilation

Use Elixir's `Mix.env` and conditional compilation to entirely exclude billing modules. On mobile, use Metro bundler config to exclude subscription files from the bundle.

- **Pros**: Zero overhead when disabled; smallest possible bundle
- **Cons**: Requires build-time decision; cannot toggle per-environment easily; significantly more complex tooling; breaks the "one starter" simplicity goal; harder to test
- **Effort**: High

#### 3. Thin Proxy with Backend-Owned Feature Gate

Mobile always ships minimal subscription UI shell; backend controls all feature visibility via API responses. Mobile renders whatever the backend declares as available.

- **Pros**: Single source of truth (backend); mobile is pure display layer
- **Cons**: Requires network call to determine feature availability; slower UX; doesn't handle offline; backend coupling is too tight for a starter template
- **Effort**: Medium

### Recommendation

**Approach 1 — Self-Contained Billing Context with Runtime Feature Flag.**

This is the right call because:
1. **Follows existing patterns**: The `auth` feature already demonstrates the four-layer feature-first pattern. `Billing` should follow the same convention on both backend (context) and mobile (feature module).
2. **Runtime flag over compile-time**: This is a *starter* — derived apps need to toggle subscriptions per deployment, not per build. A runtime flag via application config (`config :snack, :features, subscriptions: true`) is idiomatic Elixir and trivially configurable via env vars in production.
3. **Backend context boundary is natural**: Phoenix contexts map perfectly to bounded contexts. `Snack.Billing` is a clean domain boundary — it references `Snack.Accounts.User` but doesn't modify it. It adds a `stripe_customer_id` to its own `Customer` schema rather than polluting the User schema.
4. **Mobile feature isolation**: The `features/subscriptions/` directory can be deleted by derived apps that don't need it, and the feature flag prevents any broken imports or navigation.
5. **Req for Stripe API**: AGENTS.md mandates Req. Rather than adding a Stripe Elixir SDK dependency, use Req directly with Stripe's REST API. It's well-documented, has no dependency overhead, and gives full control over request/response handling.

### Architecture Detail

#### Backend Module Boundaries

```
lib/snack/
├── billing.ex                    # Context module — public API for billing operations
├── billing/
│   ├── customer.ex               # Schema: stripe_customer_id, user_id reference
│   ├── subscription.ex           # Schema: status, plan_id, stripe_subscription_id, dates
│   ├── plan.ex                   # Schema: name, stripe_price_id, features, amount_cents
│   ├── stripe_client.ex          # Behaviour for Stripe API calls
│   ├── stripe_client/req_impl.ex # Req-based implementation
│   └── webhook_processor.ex      # Receives and processes Stripe webhook events
├── features.ex                   # Feature flag reader module
lib/snack_web/controllers/api/
├── billing_controller.ex         # REST API for plans, subscribe, cancel, status
├── webhook_controller.ex         # Stripe webhook endpoint
```

Key design decisions:
- **Customer schema links User via `user_id` FK** but lives in the Billing context — not Accounts. This respects context boundaries.
- **StripeClient is a behaviour** — enables test doubles without mocking HTTP. The Req implementation is swappable.
- **WebhookProcessor is a separate module** — handles event parsing, idempotency (via subscription `stripe_event_id` uniqueness), and dispatches to Billing context operations.
- **Plan data is synced locally** — Plans are fetched from Stripe and cached in the local DB for fast reads. Webhook `price.created`/`price.updated` events keep them in sync.
- **Router uses feature pipeline** — `plug :require_feature, :subscriptions` in the billing scope returns 404 when disabled. Webhook endpoint remains active but no-ops.

#### Mobile Feature Boundaries

```
src/features/subscriptions/
├── presentation/
│   ├── plan-picker-screen.tsx    # Plan selection UI
│   ├── subscription-status-card.tsx  # Current subscription display
│   ├── paywall.tsx               # Wraps gated content with lock screen
│   ├── billing-screen.tsx        # Manage/cancel subscription
│   ├── subscription-shell-provider.tsx  # Context provider for sub state
│   └── index.ts
├── application/
│   ├── check-access.ts           # Use case: does user have access to feature X?
│   ├── subscribe-to-plan.ts      # Use case: initiate subscription
│   ├── cancel-subscription.ts    # Use case: cancel at period end
│   ├── fetch-plans.ts            # Use case: get available plans
│   └── index.ts
├── domain/
│   ├── subscription-types.ts     # Plan, Subscription, Customer types
│   ├── access-rules.ts           # Feature gate logic (pure functions)
│   └── index.ts
├── infrastructure/
│   ├── stripe-payment-sheet.ts   # Expo integration with Stripe payment sheet
│   ├── subscription-api.ts       # HTTP calls to billing API
│   └── index.ts
```

Key design decisions:
- **SubscriptionShellProvider** mirrors `SessionShellProvider` pattern — wraps the app, provides subscription state context
- **Paywall component** is the key abstraction: `<Paywall feature="premium">{children}</Paywall>` renders children when subscribed, shows upgrade prompt when not
- **Feature flag at shared/config level** — `useFeatureFlag("subscriptions")` returns false when the module is disabled, causing Paywall to always render children (no gate) and navigation to hide subscription screens
- **Stripe Payment Sheet** — Uses `@stripe/stripe-react-native` (or `expo-stripe`) for native payment experience, not a webview
- **Navigation integration**: In the `(app)/_layout.tsx`, subscription screens are conditionally added to the Drawer based on the feature flag

#### Feature Flag Mechanism

**Backend** (`Snack.Features`):
```elixir
defmodule Snack.Features do
  def enabled?(feature) when is_atom(feature) do
    features_config()
    |> Keyword.get(feature, false)
  end

  defp features_config, do: Application.get_env(:snack, :features, [])
end
```

Config:
```elixir
# config/runtime.exs
config :snack, :features, subscriptions: System.get_env("ENABLE_SUBSCRIPTIONS") == "true"
```

**Mobile** (`shared/config/feature-flags.ts`):
```typescript
interface FeatureFlags {
  subscriptions: boolean;
}

const defaultFlags: FeatureFlags = {
  subscriptions: __DEV__ 
    ? Boolean(process.env.EXPO_PUBLIC_ENABLE_SUBSCRIPTIONS) 
    : false
};

export function useFeatureFlag(flag: keyof FeatureFlags): boolean {
  return defaultFlags[flag];
}
```

### Risks

1. **Stripe webhook security**: Webhook endpoint must verify Stripe signatures. A leaked webhook secret or misconfigured endpoint could allow forged events. Mitigation: always verify `Stripe-Signature` header; rotate secrets regularly; log all webhook processing.

2. **Data consistency between Stripe and local DB**: Stripe is the source of truth, but local reads need to be fast. Webhooks are async and can arrive out of order. Mitigation: idempotent event processing (dedup by event ID); periodic reconciliation job; always query Stripe API for critical operations (subscription creation/cancellation).

3. **Stripe API version drift**: Stripe pins API versions per account, but upgrades can change behavior. Mitigation: pin Stripe API version explicitly in requests; document the pinned version; test against Stripe test mode.

4. **Mobile payment UX complexity**: Native payment flows (Apple Pay, Google Pay) require additional configuration per platform. Mitigation: start with Stripe Payment Sheet (handles both); defer platform-specific Pay integration to a later change.

5. **Feature flag state synchronization**: Backend might have subscriptions enabled while mobile has them disabled, or vice versa. Mitigation: backend API includes feature availability in its config/bootstrap response; mobile can auto-detect.

6. **Migration path for existing apps**: Adding this change must not require action from apps that don't want subscriptions. Mitigation: feature flag defaults to `false`; no migration of existing tables; subscription code paths are never entered when disabled.

7. **Testing Stripe integration**: Full integration tests require Stripe test mode keys and careful cleanup. Mitigation: StripeClient behaviour enables pure unit tests with mocks; limit Stripe API integration tests to a few critical paths; use Stripe test clocks for time-based scenarios.

### Ready for Proposal

**Yes.** The exploration has identified a clear recommended approach that aligns with the existing architecture patterns. The proposal should formalize:

1. **Scope**: What's in and out for the first iteration (e.g., plan listing, subscribe, cancel, status — but NOT: invoicing, refunds, usage-based billing, Apple/Google Pay)
2. **Stripe dependency strategy**: Req-based client with behaviour vs. `stripity_stripe` package
3. **Payment flow on mobile**: Stripe Payment Sheet vs. custom checkout UI
4. **Webhook reliability requirements**: Idempotency guarantees, retry policy, dead-letter handling
5. **Feature flag defaults and configuration surface**: Which env vars, what the mobile config shape looks like
6. **Database schema design**: Exact table structures for customers, subscriptions, plans
7. **API contract**: REST endpoints, request/response shapes
8. **Mobile contracts package additions**: New types for `@snack/contracts`
9. **Rollout strategy**: How derived apps opt in (set flag, run migrations, configure Stripe keys)
