# Subscription Feature Mobile Specification

## Purpose

Define the self-contained mobile subscriptions feature module with paywall gating, plan display, and Stripe Payment Sheet integration.

## Requirements

### Requirement: Feature Module Boundaries

The subscriptions feature MUST reside in `features/subscriptions/` following the four-layer convention: `presentation`, `application`, `domain`, and `infrastructure`.

#### Scenario: Module follows layered structure

- GIVEN the subscriptions feature is implemented
- WHEN its code structure is inspected
- THEN UI components, use-case hooks, domain types/rules, and API adapters are in separate layer directories

### Requirement: Paywall Enforcement

When a feature requires a subscription and the user lacks one, the system MUST display a paywall. When subscribed, gated content MUST render without interruption.

#### Scenario: Subscribed user accesses gated feature

- GIVEN an authenticated user with an active subscription
- WHEN a paywall-gated feature is accessed
- THEN the feature content renders normally

#### Scenario: Unsubscribed user accesses gated feature

- GIVEN an authenticated user with no subscription
- WHEN a paywall-gated feature is accessed
- THEN a paywall screen is shown offering subscription

#### Scenario: Flag disabled bypasses paywall

- GIVEN the subscriptions feature flag is `false`
- WHEN a feature that would normally be gated is accessed
- THEN content renders without paywall (flag off = no subscription system)

### Requirement: Plan Picker UI

The mobile app MUST present available plans from the billing API in a selectable list. Each plan MUST show name, price, billing interval, and a subscribe action.

#### Scenario: Plans are displayed

- GIVEN the subscriptions flag is enabled and plans are loaded
- WHEN the plan picker screen is shown
- THEN each plan displays name, price, interval, and a CTA

#### Scenario: Plan fetch fails

- GIVEN the API call to fetch plans fails
- WHEN the plan picker is displayed
- THEN an error state is shown with a retry action

### Requirement: Stripe Payment Sheet Integration

Subscription purchase MUST use the Stripe Payment Sheet for native checkout UX. The app MUST present the sheet using the client_secret from the backend checkout session.

#### Scenario: Payment sheet completes successfully

- GIVEN a checkout session client_secret is obtained
- WHEN the Stripe Payment Sheet is presented and payment succeeds
- THEN the subscription status is refreshed and the paywall dismisses

#### Scenario: Payment sheet is cancelled

- GIVEN the Stripe Payment Sheet is presented
- WHEN the user cancels the payment
- THEN the app returns to the plan picker with no subscription created

### Requirement: Subscription Status Display

The mobile app MUST show the current subscription status in a dedicated screen: plan name, renewal date, and a cancel option for active subscriptions.

#### Scenario: Active subscription displayed

- GIVEN an authenticated user with an active subscription
- WHEN the subscription status screen is shown
- THEN plan name, renewal date, and cancel button are displayed

#### Scenario: Cancellation reflected immediately

- GIVEN the user cancels from the status screen
- WHEN the cancel API call succeeds
- THEN the UI updates to show "canceling" state with period-end date

### Requirement: SubscriptionShellProvider

A `SubscriptionShellProvider` MUST wrap subscription state (status, plans, loading) and provide it to the feature tree. It MUST integrate with the existing auth session provider.

#### Scenario: Provider initializes with authenticated session

- GIVEN a user has an authenticated session and subscriptions flag is enabled
- WHEN SubscriptionShellProvider mounts
- THEN it fetches subscription status and plans from the API

#### Scenario: Provider skips when flag disabled

- GIVEN the subscriptions flag is `false`
- WHEN SubscriptionShellProvider mounts
- THEN no API calls are made and subscription state remains empty
