# Tasks: Stripe-based Feature-Flagged Subscriptions

## Phase 1: Feature Flag Foundation

- [x] 1.1 RED — Test `Snack.Features.enabled?/1` reads from app env `:features` keyword; assert `enabled?(:subscriptions)` returns `false` by default, `true` when set. File: `test/snack/features_test.exs`
- [x] 1.2 GREEN — Create `lib/snack/features.ex` with `enabled?/1` reading `Application.get_env(:snack, :features, [])` keyword list
- [x] 1.3 RED — Test `RequireFeature` plug halts with 404 when flag off, passes through when on. File: `test/snack_web/plugs/require_feature_test.exs`
- [x] 1.4 GREEN — Create `lib/snack_web/plugs/require_feature.ex` calling `Snack.Features.enabled?/1`, halting conn on false
- [x] 1.5 REFACTOR — Extract common plug test helpers if duplication find
- [x] 1.6 Modify `config/runtime.exs` — add `config :snack, features: [subscriptions: System.get_env("ENABLE_SUBSCRIPTIONS") == "true"]`

## Phase 2: Billing Schemas + Migrations

- [x] 2.1 RED — Test `Billing.Customer` changeset: requires `user_id`, `stripe_customer_id` unique, `email`. File: `test/snack/billing/customer_test.exs`
- [x] 2.2 GREEN — Create migration `billing_customers` table; create `lib/snack/billing/customer.ex` schema with changeset
- [x] 2.3 RED — Test `Billing.Plan` changeset: requires `name`, `stripe_price_id` unique, `amount_cents`, `currency`, `interval`. File: `test/snack/billing/plan_test.exs`
- [x] 2.4 GREEN — Create migration `billing_plans` table; create `lib/snack/billing/plan.ex` schema
- [x] 2.5 RED — Test `Billing.Subscription` changeset: `stripe_event_id` unique, status defaults to `pending`, belongs_to plan/customer. File: `test/snack/billing/subscription_test.exs`
- [x] 2.6 GREEN — Create migration `billing_subscriptions` table; create `lib/snack/billing/subscription.ex` schema with unique constraint on `stripe_event_id`

## Phase 3: StripeClient Behaviour + Req Implementation

- [x] 3.1 RED — Define `StripeClient` behaviour module and a `MockStripeClient` (in `test/support/`); test that mock satisfies behaviour callbacks. File: `test/snack/billing/stripe_client_test.exs`
- [x] 3.2 GREEN — Create `lib/snack/billing/stripe_client.ex` with `@callback` for `create_customer/2`, `create_checkout_session/2`, `cancel_subscription/2`, `list_prices/1`
- [x] 3.3 RED — Test `ReqImpl` formats correct Req requests for each callback using bypass/mock HTTP. File: `test/snack/billing/stripe_client/req_impl_test.exs`
- [x] 3.4 GREEN — Create `lib/snack/billing/stripe_client/req_impl.ex` implementing behaviour via Req with `STRIPE_API_KEY` and `STRIPE_API_VERSION` from app env

## Phase 4: Billing Context Core

- [x] 4.1 RED — Test `Billing.list_plans/0` returns plans from repo. File: `test/snack/billing_test.exs` (DataCase)
- [x] 4.2 RED — Test `Billing.subscribe(user, plan_id)` creates customer if needed, calls `StripeClient.create_checkout_session/2`, returns `{:ok, %{client_secret: ...}}`; test 409 when already active
- [x] 4.3 RED — Test `Billing.cancel(user)` calls `StripeClient.cancel_subscription/2`, updates local status; test 404 when no subscription
- [x] 4.4 RED — Test `Billing.get_subscription(user)` returns subscription or `nil`
- [x] 4.5 RED — Test `Billing.handle_event/2` processes `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`; idempotent by `stripe_event_id`
- [x] 4.6 GREEN — Create `lib/snack/billing.ex` context with `list_plans/0`, `subscribe/2`, `cancel/1`, `get_subscription/1`, `handle_event/2`; inject `stripe_client` module via app env
- [x] 4.7 REFACTOR — Ensure Billing context has zero imports from other app contexts per isolation requirement

## Phase 5: Webhook Processing

- [x] 5.1 RED — Test `WebhookProcessor.process/1` deduplicates by `stripe_event_id`; second call returns `{:ok, :already_processed}`. File: `test/snack/billing/webhook_processor_test.exs`
- [x] 5.2 GREEN — Create `lib/snack/billing/webhook_processor.ex` with event parsing, idempotency check, dispatch to `Billing.handle_event/2`
- [x] 5.3 RED — Test webhook signature verification plug: valid HMAC → passes, invalid → 401. File: `test/snack_web/plugs/verify_stripe_signature_test.exs`
- [x] 5.4 GREEN — Create `lib/snack_web/plugs/verify_stripe_signature.ex` validating `Stripe-Signature` header with webhook secret from app env

## Phase 6: Backend Controllers + Routes

- [x] 6.1 RED — Test `BillingController` actions (plans, subscribe, cancel, subscription) via ConnCase; verify 404 when flag off. File: `test/snack_web/controllers/api/billing_controller_test.exs`
- [x] 6.2 GREEN — Create `lib/snack_web/controllers/api/billing_controller.ex` with `:plans`, `:subscribe`, `:cancel`, `:subscription` actions
- [x] 6.3 RED — Test `WebhookController` returns 200 for valid webhook, 401 for bad signature, skips processing when flag off. File: `test/snack_web/controllers/api/webhook_controller_test.exs`
- [x] 6.4 GREEN — Create `lib/snack_web/controllers/api/webhook_controller.ex` piping through signature plug + `WebhookProcessor`
- [x] 6.5 Modify `lib/snack_web/router.ex` — add `/api/billing` scope with `pipe_through [:api, :require_feature]`; add `/api/webhooks/stripe` route with signature plug; add bootstrap config endpoint returning feature flags
- [x] 6.6 REFACTOR — Verify all flag-off scenarios: billing routes 404, webhook acknowledges without processing, no Stripe calls

## Phase 7: Contracts + Mobile-Shared

- [x] 7.1 Create `packages/contracts/src/billing.ts` — `Plan`, `SubscriptionStatus`, `Subscription`, `BillingState` types; add type-level tests. File: `packages/contracts/src/billing.test.ts`
- [x] 7.2 Modify `packages/contracts/src/index.ts` — export billing types
- [x] 7.3 Create `packages/mobile-shared/src/api/billing-api.ts` — `BillingApi` interface + `createBillingApi(httpClient)` factory with `fetchPlans()`, `subscribe(planId)`, `cancel()`, `getSubscription()`; unit test with mock HttpClient. File: `packages/mobile-shared/src/api/billing-api.test.ts`
- [x] 7.4 Create `packages/mobile-shared/src/config/feature-flags.ts` — `FeatureFlags` type + `createFeatureFlagReader(bootstrap)` factory; test resolution from bootstrap response. File: `packages/mobile-shared/src/config/feature-flags.test.ts`
- [x] 7.5 Modify `packages/mobile-shared/src/index.ts` — export billing API + feature flags

## Phase 8: Mobile Feature Module — Domain + Application

- [x] 8.1 RED — Test `AccessRule.canAccess(subscription, feature)` pure function: subscribed → true, unsubscribed → false, flag off → true (bypass). File: `apps/mobile/src/features/subscriptions/domain/access-rules.test.ts`
- [x] 8.2 GREEN — Create `apps/mobile/src/features/subscriptions/domain/access-rules.ts` + `subscription-types.ts` + barrel `index.ts`
- [x] 8.3 RED — Test application hooks `useFetchPlans`, `useSubscribeToPlan`, `useCancelSubscription`, `useCheckAccess` with mock billing API. File: `apps/mobile/src/features/subscriptions/application/*.test.ts`
- [x] 8.4 GREEN — Create use-case hooks in `apps/mobile/src/features/subscriptions/application/` + barrel `index.ts`

## Phase 9: Mobile Feature Module — Infrastructure + Presentation

- [x] 9.1 RED — Test `SubscriptionApi` adapter maps HTTP responses to domain types. File: `apps/mobile/src/features/subscriptions/infrastructure/subscription-api.test.ts`
- [x] 9.2 GREEN — Create `apps/mobile/src/features/subscriptions/infrastructure/subscription-api.ts` + barrel `index.ts`
- [x] 9.3 RED — Test `SubscriptionShellProvider` state machine: loading → subscribed → unsubscribed transitions; skips API calls when flag off. File: `apps/mobile/src/features/subscriptions/presentation/subscription-shell-provider.test.tsx`
- [x] 9.4 GREEN — Create `apps/mobile/src/features/subscriptions/presentation/subscription-shell-provider.tsx` mirroring `SessionShellProvider` pattern
- [x] 9.5 RED — Test `Paywall` component: flag off → renders children; flag on + subscribed → renders children; flag on + unsubscribed → shows paywall CTA. File: `apps/mobile/src/features/subscriptions/presentation/paywall.test.tsx`
- [x] 9.6 GREEN — Create `apps/mobile/src/features/subscriptions/presentation/paywall.tsx`
- [x] 9.7 RED — Test `PlanPickerScreen` displays plans with name/price/interval CTA; shows error state on fetch failure. File: `apps/mobile/src/features/subscriptions/presentation/plan-picker-screen.test.tsx`
- [x] 9.8 GREEN — Create `apps/mobile/src/features/subscriptions/presentation/plan-picker-screen.tsx` + `billing-screen.tsx` + barrel `index.ts`

## Phase 10: Shell Integration + Navigation

- [x] 10.1 RED — Test `(app)/_layout.tsx` renders subscription drawer entry when flag enabled; no entry when disabled. File: integration test
- [x] 10.2 GREEN — Modify `apps/mobile/app/(app)/_layout.tsx` — conditionally add `<Drawer.Screen name="subscriptions">` when `useFeatureFlag("subscriptions")` is true
- [x] 10.3 Create `apps/mobile/app/(app)/subscriptions.tsx` — route rendering `PlanPickerScreen` or `BillingScreen` based on subscription state
- [x] 10.4 Create `apps/mobile/src/shared/config/index.ts` barrel exporting `useFeatureFlag` hook
- [x] 10.5 REFACTOR — Final pass: verify feature-flag-off leaves zero subscription footprint (no API calls, no UI, no drawer entries)

## Verification Fixes (Batch 3)

- [x] V1 Fix async race condition: set `async: false` in 7 test modules that modify global Application env
- [x] V2 Reorder webhook pipeline: RequireFeature before VerifyStripeSignature
- [x] V3 Add ConfigController test coverage (4 tests): flag enabled, disabled, absent, multiple flags
- [x] V4 Enhance ConfigController to dynamically return all registered feature flags
- [x] V5 Fix useFeatureFlag hook: context-based provider reading from FeatureFlagReader
- [x] V6 Fix TypeScript errors in subscription-api.test.ts: full mock objects via stubBillingApi helper

**Acceptance focus**: After Phase 10, verify the full subscribe→cancel→resubscribe cycle with Stripe test mode, confirm idempotent webhook processing, and confirm flag-off produces zero subscription artifact.
