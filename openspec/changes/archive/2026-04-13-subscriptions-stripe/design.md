# Design: Stripe-based Feature-Flagged Subscriptions

## Technical Approach

Self-contained `Snack.Billing` Phoenix context and `features/subscriptions/` mobile module, both gated by a runtime feature flag read from application config. Backend uses a `StripeClient` behaviour with Req for all Stripe API calls (no SDK). Mobile uses Stripe Payment Sheet for native checkout. Plans are synced locally from Stripe and kept current via idempotent webhooks. Feature flag defaults `false` — zero impact when disabled. Follows existing patterns: Phoenix context boundary like `Snack.Accounts`, mobile four-layer feature module like `features/auth/`.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Stripe HTTP client | `StripeClient` behaviour + Req impl | `stripity_stripe` Elixir SDK | AGENTS.md mandates Req; behaviour enables test doubles without mocking HTTP |
| Feature flag source | `Application.get_env(:snack, :features)` via `runtime.exs` | Compile-time exclusion, DB-backed flags | Runtime flag allows per-deployment toggle; idiomatic Elixir; env-var-driven for containers |
| Mobile flag source | Bootstrap/config API response from backend | Hardcoded env vars on mobile | Backend is single source of truth; prevents state drift |
| Payment UX | Stripe Payment Sheet (native) | Custom checkout UI, WebView | Native UX with minimal integration effort; handles card collection + 3DS |
| Plan storage | Local DB synced from Stripe via webhooks | Always query Stripe API | Fast reads; offline-capable list; webhook events keep local data current |
| Customer association | `Billing.Customer` has `user_id` FK, lives in Billing context | Add `stripe_customer_id` to `Accounts.User` | Respects context boundaries; Billing owns its own schema |
| Webhook idempotency | Unique constraint on `stripe_event_id` column | Redis-based dedup, ETS cache | DB constraint survives restarts; simple; no new infrastructure |
| Webhook signature | Plug verifying `Stripe-Signature` header using HMAC-SHA256 | Skip in dev only | Mandatory for production; test mode webhooks include signatures too |

## Data Flow

### Subscribe Flow

```text
Mobile                          Backend                           Stripe
  |                               |                                |
  |---GET /api/billing/plans----->|                                |
  |<--[{id, name, price}]--------|                                |
  |                               |                                |
  |---POST /api/billing/subscribe-|                                |
  |   {plan_id}                   |--create_customer------------->|
  |                               |--create_checkout_session------>|
  |<--{client_secret}-------------|<--{client_secret}--------------|
  |                               |                                |
  |--present Payment Sheet--------|                                |
  |  (Stripe SDK)                 |                                |
  |                               |<--checkout.session.completed--|
  |                               |   (webhook)                    |
  |                               |--upsert subscription---------->|
  |                               |                                |
  |---GET /api/billing/subscription->                             |
  |<--{active subscription}-------|                                |
```

### Webhook Processing

```text
Stripe ──POST /api/webhooks/stripe──> WebhookController
                                           |
                                     verify_signature (Plug)
                                           |
                                     WebhookProcessor.process(event)
                                           |
                                     dedup by stripe_event_id
                                           |
                                     dispatch to Billing context
                                           |
                                     Billing.handle_event(type, data)
                                           |
                                     upsert Subscription / Plan / Customer
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/backend/lib/snack/billing.ex` | Create | Context module: list_plans, subscribe, cancel, get_subscription, handle_event |
| `apps/backend/lib/snack/billing/customer.ex` | Create | Schema: `stripe_customer_id`, `user_id` FK, `email` |
| `apps/backend/lib/snack/billing/subscription.ex` | Create | Schema: `status`, `plan_id`, `stripe_subscription_id`, `stripe_event_id` (unique), `current_period_end`, `cancel_at_period_end` |
| `apps/backend/lib/snack/billing/plan.ex` | Create | Schema: `name`, `stripe_price_id`, `amount_cents`, `currency`, `interval` |
| `apps/backend/lib/snack/billing/stripe_client.ex` | Create | Behaviour: `create_customer/2`, `create_checkout_session/2`, `cancel_subscription/2`, `list_prices/1` |
| `apps/backend/lib/snack/billing/stripe_client/req_impl.ex` | Create | Req-based implementation of StripeClient behaviour |
| `apps/backend/lib/snack/billing/webhook_processor.ex` | Create | Event parsing, idempotency check, dispatch to Billing context |
| `apps/backend/lib/snack/features.ex` | Create | Generic flag reader: `enabled?(feature)` from `:features` app env |
| `apps/backend/lib/snack_web/controllers/api/billing_controller.ex` | Create | REST: plans, subscribe, cancel, subscription status |
| `apps/backend/lib/snack_web/controllers/api/webhook_controller.ex` | Create | Webhook endpoint with signature verification |
| `apps/backend/lib/snack_web/plugs/require_feature.ex` | Create | Plug: returns 404 when feature flag disabled |
| `apps/backend/lib/snack_web/router.ex` | Modify | Add billing API scope with `require_feature` pipeline + webhook route |
| `apps/backend/lib/snack/application.ex` | Modify | No supervision changes needed — webhook is synchronous in controller |
| `apps/backend/config/runtime.exs` | Modify | Add `:features` config + Stripe env vars |
| `apps/backend/priv/repo/migrations/` | Create | Migrations for customers, plans, subscriptions tables |
| `packages/contracts/src/billing.ts` | Create | `Plan`, `Subscription`, `SubscriptionStatus`, `BillingState` types |
| `packages/contracts/src/index.ts` | Modify | Export billing types |
| `packages/mobile-shared/src/api/billing-api.ts` | Create | `BillingApi` interface + `createBillingApi(httpClient)` factory |
| `packages/mobile-shared/src/config/feature-flags.ts` | Create | `FeatureFlags` type + `createFeatureFlagReader(bootstrap)` factory |
| `packages/mobile-shared/src/index.ts` | Modify | Export billing API + feature flags |
| `apps/mobile/src/shared/config/index.ts` | Modify | Export `useFeatureFlag` hook |
| `apps/mobile/src/features/subscriptions/domain/` | Create | Types: `SubscriptionPlan`, `AccessRule` pure functions |
| `apps/mobile/src/features/subscriptions/application/` | Create | Use cases: `fetchPlans`, `subscribeToPlan`, `cancelSubscription`, `checkAccess` |
| `apps/mobile/src/features/subscriptions/infrastructure/` | Create | `SubscriptionApi` adapter, `StripePaymentSheet` integration |
| `apps/mobile/src/features/subscriptions/presentation/` | Create | `PlanPickerScreen`, `BillingScreen`, `Paywall`, `SubscriptionShellProvider` |
| `apps/mobile/app/(app)/subscriptions.tsx` | Create | Route: plan picker / billing screen |
| `apps/mobile/app/(app)/_layout.tsx` | Modify | Conditional subscription drawer/tab entry when flag enabled |

## Interfaces / Contracts

### Backend — StripeClient Behaviour

```elixir
defmodule Snack.Billing.StripeClient do
  @callback create_customer(email: String.t()) :: {:ok, map()} | {:error, term()}
  @callback create_checkout_session(customer_id: String.t(), price_id: String.t(), success_url: String.t(), cancel_url: String.t()) :: {:ok, map()} | {:error, term()}
  @callback cancel_subscription(subscription_id: String.t()) :: {:ok, map()} | {:error, term()}
  @callback list_prices() :: {:ok, [map()]} | {:error, term()}
end
```

### Backend — Feature Flag Module

```elixir
defmodule Snack.Features do
  @callback enabled?(feature :: atom()) :: boolean()
end
```

Read from `Application.get_env(:snack, :features, [])`. Plug `require_feature` calls `Snack.Features.enabled?/1` and halts with 404 when false.

### Backend — API Contracts

```text
GET  /api/billing/plans          → 200 [{id, name, amount_cents, currency, interval, stripe_price_id}]
POST /api/billing/subscribe      → 200 {client_secret} | 409 {error: "already_subscribed"}
POST /api/billing/cancel         → 200 {status: "canceling"} | 404 {error: "no_subscription"}
GET  /api/billing/subscription   → 200 {subscribed: true, plan, status, current_period_end, cancel_at_period_end} | 200 {subscribed: false}
POST /api/webhooks/stripe        → 200 (always, with or without processing)
GET  /api/config/bootstrap       → 200 {features: {subscriptions: {enabled: bool}}}
```

### Mobile — Contracts Package

```ts
interface Plan {
  id: string;
  name: string;
  amountCents: number;
  currency: string;
  interval: "month" | "year";
  stripePriceId: string;
}

type SubscriptionStatus = "active" | "canceling" | "canceled" | "past_due" | "trialing";

interface Subscription {
  id: string;
  plan: Plan;
  status: SubscriptionStatus;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface BillingState {
  subscribed: boolean;
  subscription: Subscription | null;
  plans: Plan[];
  loading: boolean;
  error: string | null;
}
```

### Mobile — SubscriptionShellProvider

Mirrors `SessionShellProvider` pattern: accepts `services` prop with billing API adapters, provides `{ state, subscribe, cancel, refresh }` via context. Skips all API calls when `useFeatureFlag("subscriptions")` is false.

### Mobile — Paywall Component

```tsx
<Paywall feature="premium">
  <PremiumContent />
</Paywall>
```

Logic: if flag disabled → render children (no subscription system). If flag enabled + subscribed → render children. If flag enabled + not subscribed → show paywall screen with plan picker CTA.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (BE) | StripeClient behaviour contract | Define `MockStripeClient` in test env; verify callbacks match spec |
| Unit (BE) | Billing context operations (subscribe, cancel, status) | `DataCase` with mock StripeClient; no HTTP calls |
| Unit (BE) | WebhookProcessor idempotency | Same event ID processed twice → single side effect |
| Unit (BE) | WebhookProcessor signature verification | Invalid signature → rejected; valid → processed |
| Unit (BE) | Features.enabled? reads from app env | Toggle env, assert flag resolution |
| Unit (BE) | RequireFeature plug | Feature off → 404 halt; feature on → passes through |
| Unit (BE) | Plan/Subscription/Customer schema changesets | Validation constraints |
| Integration (BE) | BillingController endpoints with ConnCase | Full conn pipeline with feature plug + mock StripeClient |
| Integration (BE) | WebhookController with valid/invalid payloads | Signature verification + idempotent processing via Repo |
| Unit (Mobile) | Domain: `AccessRule` pure functions | `canAccess(subscription, feature) → boolean` |
| Unit (Mobile) | Application: `fetchPlans`, `subscribeToPlan`, `cancelSubscription` use cases | Mock billing API; assert state transitions |
| Unit (Mobile) | SubscriptionShellProvider state machine | Render with mock services; test loading/subscribed/unsubscribed transitions |
| Unit (Mobile) | Paywall component: renders children vs paywall screen | Testing Library; flag on/off + subscribed/unsubscribed |
| Unit (Mobile) | useFeatureFlag hook | Mock bootstrap response; assert loading → resolved |
| Unit (Contracts) | Billing type contracts | Type-level validation via test assertions |
| Unit (Shared) | `createBillingApi` adapter | Mock HttpClient; verify correct paths and payloads |
| Integration (Mobile) | Navigation shows/hides subscription screens | Render shell with flag on/off; assert drawer entries |

## Migration / Rollout

1. **Backend migrations**: Three new tables — `billing_customers`, `billing_plans`, `billing_subscriptions`. No modifications to existing tables. Run via `mix ecto.migrate`.
2. **Feature flag default**: `ENABLE_SUBSCRIPTIONS=false` in all environments. Derived apps opt in by setting env var + running migrations + configuring Stripe keys.
3. **Mobile**: No migration. Flag off = no subscription UI. Flag on = subscription screens appear in navigation.
4. **Rollback**: Set flag false → billing routes return 404 → revert migrations → remove Stripe env vars.

## Open Questions

- [ ] Exact `@stripe/stripe-react-native` vs `expo-stripe` package choice — depends on Expo SDK version at implementation time
- [ ] Whether `/api/config/bootstrap` endpoint already exists or needs creation (currently no config/bootstrap route exists in router)

## Implementation Decomposition Guidance

1. **Backend — Feature flag foundation**: `Snack.Features` module, `RequireFeature` plug, `features` config in `runtime.exs`. Tests first.
2. **Backend — Schemas + migrations**: `Customer`, `Plan`, `Subscription` schemas and their migrations. Schema tests first.
3. **Backend — StripeClient behaviour + Req impl**: Define behaviour, implement `ReqImpl`. Unit tests with mock.
4. **Backend — Billing context**: `list_plans`, `subscribe`, `cancel`, `get_subscription`, `handle_event`. Context tests with mock StripeClient.
5. **Backend — WebhookProcessor**: Event parsing, signature verification plug, idempotency, dispatch. Integration tests.
6. **Backend — Controllers + routes**: `BillingController`, `WebhookController`, router modifications. ConnCase integration tests.
7. **Contracts — Billing types**: `billing.ts` in `@snack/contracts`. Type tests.
8. **Mobile-Shared — Billing API + Feature flags**: `createBillingApi`, `createFeatureFlagReader` in `@snack/mobile-shared`. Unit tests.
9. **Mobile — Domain layer**: `subscription-types.ts`, `access-rules.ts`. Pure function tests.
10. **Mobile — Application layer**: Use case hooks: `fetchPlans`, `subscribeToPlan`, `cancelSubscription`, `checkAccess`. Mock API tests.
11. **Mobile — Infrastructure layer**: `SubscriptionApi` adapter, `StripePaymentSheet` integration. Unit tests.
12. **Mobile — Presentation layer**: `SubscriptionShellProvider`, `Paywall`, `PlanPickerScreen`, `BillingScreen`. Component tests.
13. **Mobile — Navigation integration**: Conditional drawer/tab entry in `(app)/_layout.tsx`. Integration test.
