# Proposal: Stripe-based Feature-Flagged Subscriptions

## Intent

Add a self-contained subscription module that derived apps can opt into via a runtime feature flag. When disabled, the app behaves as if subscriptions never existed. When enabled, it provides plan browsing, subscribe/cancel, status tracking, paywall gating, and billing management — backed by Stripe.

## Scope

### In Scope
- `Snack.Billing` Phoenix context (Customer, Subscription, Plan schemas + lifecycle)
- `Snack.Features` runtime flag module (backend) + `useFeatureFlag` hook (mobile)
- `Snack.Billing.StripeClient` behaviour with Req-based implementation
- Webhook processor with signature verification and idempotent event handling
- `features/subscriptions/` mobile module (all four layers)
- Paywall component (`<Paywall feature="X">`) and SubscriptionShellProvider
- Stripe Payment Sheet integration for native payment UX
- New contracts in `@snack/contracts` and API adapter in `@snack/mobile-shared`
- DB migrations for customers, subscriptions, plans tables
- REST API: list plans, subscribe, cancel, get status

### Out of Scope
- Invoicing, refunds, dispute management
- Usage-based / metered billing
- Apple Pay / Google Pay (defer to later change)
- Coupon / promotion code support
- Multi-currency (v1 uses single currency from Stripe config)
- Billing admin dashboard (backend only)
- Proration customization
- Stripe Customer Portal redirect

## Capabilities

### New Capabilities
- `billing-context`: Backend Billing context with Customer, Subscription, Plan schemas, Stripe integration, and webhook processing
- `subscription-feature-mobile`: Mobile subscriptions feature module with paywall, plan picker, and Stripe Payment Sheet
- `feature-flags`: Runtime feature flag system (backend `Snack.Features` + mobile `useFeatureFlag`)

### Modified Capabilities
- `mobile-shell-navigation`: Add conditional subscription screens to authenticated shell when flag is enabled

## Approach

Self-contained Billing context on backend, feature-first subscriptions module on mobile, both gated by a runtime feature flag. Backend uses `Snack.Billing.StripeClient` behaviour with Req for Stripe API calls (no Elixir SDK). Mobile uses Stripe Payment Sheet for native checkout. Plans are synced locally from Stripe and kept current via webhooks. Feature flag defaults to `false` — zero impact when disabled.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/backend/lib/snack/billing/` | New | Billing context, schemas, Stripe client behaviour |
| `apps/backend/lib/snack/features.ex` | New | Feature flag reader module |
| `apps/backend/lib/snack_web/controllers/api/` | New | BillingController, WebhookController |
| `apps/backend/lib/snack_web/router.ex` | Modified | Billing API scope + webhook route with feature pipeline |
| `apps/backend/priv/repo/migrations/` | New | Customers, subscriptions, plans tables |
| `apps/backend/config/` | Modified | Stripe keys, feature flag config |
| `apps/mobile/src/features/subscriptions/` | New | Full feature module (4 layers) |
| `apps/mobile/src/shared/config/` | Modified | Feature flag hook |
| `packages/contracts/src/` | Modified | Subscription/billing type contracts |
| `packages/mobile-shared/src/` | Modified | Subscription API adapter |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Stripe webhook out-of-order delivery | Medium | Idempotent processing by event ID + periodic reconciliation |
| Feature flag state drift between backend and mobile | Low | Backend includes feature availability in bootstrap/config response |
| Stripe API version drift | Low | Pin API version in all requests; document pinned version |
| Webhook secret exposure | Low | Env-var-only config; signature verification on every event |
| Migration breaks existing apps | Low | Flag defaults false; no existing table modifications |

## Rollback Plan

1. Set `ENABLE_SUBSCRIPTIONS=false` in all environments
2. Remove billing routes from router (or let feature pipeline 404 them)
3. Revert migrations (`mix ecto.rollback`)
4. Remove Stripe env vars — app runs as before

## Dependencies

- Stripe account with API keys (test + live)
- `req` HTTP client (already mandated by project conventions)
- `@stripe/stripe-react-native` or `expo-stripe` for mobile Payment Sheet

## Success Criteria

- [ ] Subscribe → cancel → resubscribe cycle works via Stripe test mode
- [ ] Paywall correctly gates premium content when subscribed and passes through when not
- [ ] With `ENABLE_SUBSCRIPTIONS=false`, no subscription code paths execute; no new DB tables queried
- [ ] Webhook events are processed idempotently; duplicate events cause no side effects
- [ ] All code has unit tests (StripeClient behaviour enables mocking); ≥2 integration tests with Stripe test mode
