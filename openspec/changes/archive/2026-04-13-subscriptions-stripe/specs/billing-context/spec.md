# Billing Context Specification

## Purpose

Define the self-contained `Snack.Billing` Phoenix context handling plans, subscriptions, Stripe integration, and webhook processing.

## Requirements

### Requirement: Plan Listing

The system MUST expose a REST endpoint returning available subscription plans. Plans MUST be sourced from the local database and synced from Stripe.

#### Scenario: Plans returned when subscriptions enabled

- GIVEN the subscriptions flag is enabled and plans exist in DB
- WHEN `GET /api/billing/plans` is called
- THEN a list of plans with id, name, price, interval, and stripe_price_id is returned

#### Scenario: No plans available

- GIVEN the subscriptions flag is enabled but no plans exist
- WHEN `GET /api/billing/plans` is called
- THEN an empty list is returned (not an error)

### Requirement: Subscription Creation

An authenticated user MUST be able to subscribe to a plan. The system MUST create a Stripe Customer (if not existing), create a Stripe Checkout or Payment Sheet session, and record a pending subscription locally.

#### Scenario: New subscriber starts checkout

- GIVEN an authenticated user with no existing subscription and the flag is enabled
- WHEN `POST /api/billing/subscribe` with `{ plan_id }` is called
- THEN a Stripe payment session is created and its client_secret is returned

#### Scenario: Already-subscribed user attempts subscribe

- GIVEN an authenticated user with an active subscription
- WHEN `POST /api/billing/subscribe` is called
- THEN the system returns 409 Conflict

### Requirement: Subscription Cancellation

An authenticated user MUST be able to cancel an active subscription. Cancellation MUST be communicated to Stripe and reflected locally.

#### Scenario: Cancel active subscription

- GIVEN an authenticated user with an active subscription
- WHEN `POST /api/billing/cancel` is called
- THEN Stripe subscription is scheduled for period-end cancellation
- AND the local subscription status becomes `canceling`

#### Scenario: Cancel with no active subscription

- GIVEN an authenticated user with no active subscription
- WHEN `POST /api/billing/cancel` is called
- THEN the system returns 404

### Requirement: Subscription Status Checking

An authenticated user MUST be able to retrieve their current subscription status.

#### Scenario: User checks active subscription

- GIVEN an authenticated user with an active subscription
- WHEN `GET /api/billing/subscription` is called
- THEN plan details, status, current_period_end, and cancel_at_period_end are returned

#### Scenario: User with no subscription checks status

- GIVEN an authenticated user with no subscription
- WHEN `GET /api/billing/subscription` is called
- THEN `{ subscribed: false }` is returned

### Requirement: StripeClient Behaviour

All Stripe API interactions MUST go through a `Snack.Billing.StripeClient` behaviour. The production implementation MUST use Req. Tests MUST use a mock implementation.

#### Scenario: Behaviour is used for checkout

- GIVEN the billing context creates a checkout session
- WHEN the Stripe call is made
- THEN it goes through the StripeClient behaviour, not a direct HTTP call

### Requirement: Webhook Processing — Signature Verification

Every incoming Stripe webhook MUST have its signature verified against the webhook secret. Invalid signatures MUST be rejected with 401.

#### Scenario: Valid signature webhook

- GIVEN a Stripe webhook with a valid signature
- WHEN `POST /api/webhooks/stripe` receives it
- THEN the event payload is parsed and processing continues

#### Scenario: Invalid signature webhook

- GIVEN a Stripe webhook with an invalid signature
- WHEN `POST /api/webhooks/stripe` receives it
- THEN 401 is returned and no processing occurs

### Requirement: Webhook Processing — Idempotency

Each webhook event MUST be processed idempotently by Stripe event ID. Duplicate events MUST NOT cause duplicate side effects.

#### Scenario: Duplicate event arrives

- GIVEN a webhook event with ID `evt_123` was already processed
- WHEN the same event ID arrives again
- THEN the system returns 200 with no additional side effects

#### Scenario: Events arrive out of order

- GIVEN `customer.subscription.updated` arrives before `customer.subscription.created`
- WHEN each event is processed
- THEN each is recorded by event ID and the subscription state reflects the latest event

### Requirement: Billing Context Isolation

`Snack.Billing` MUST be a self-contained Phoenix context. It MUST NOT import modules from other app contexts. Other contexts MAY subscribe to billing events via a published event bus.

#### Scenario: Billing context has no inbound dependencies

- GIVEN the billing context is compiled
- WHEN its module dependencies are inspected
- THEN no imports from other app contexts (e.g., `Snack.Accounts`) exist
