# Feature Flags Specification

## Purpose

Define a runtime feature flag system that gates subscription capabilities on both backend and mobile. When disabled, the system behaves as if subscriptions never existed.

## Requirements

### Requirement: Runtime Flag Resolution

The backend MUST read feature flags from application config (env-driven) and expose them in the bootstrap/config endpoint response. The mobile app MUST read flag state from this response and MUST NOT hardcode flag values.

#### Scenario: Flag enabled in environment

- GIVEN `ENABLE_SUBSCRIPTIONS=true` is set in backend config
- WHEN the bootstrap/config endpoint is called
- THEN the response includes `features.subscriptions.enabled: true`

#### Scenario: Flag disabled or absent

- GIVEN `ENABLE_SUBSCRIPTIONS` is not set or is `false`
- WHEN the bootstrap/config endpoint is called
- THEN the response includes `features.subscriptions.enabled: false`
- AND all billing routes return 404

#### Scenario: Mobile reads flag from bootstrap

- GIVEN the mobile app receives the bootstrap response
- WHEN the subscriptions feature flag is `false`
- THEN no subscription UI renders and no subscription API calls are made

### Requirement: Backend Flag Gating Pipeline

When the subscriptions flag is disabled, the backend MUST reject all billing API requests with 404 and MUST NOT execute billing logic or Stripe calls.

#### Scenario: Billing request with flag disabled

- GIVEN the subscriptions flag is `false`
- WHEN any billing API endpoint is called
- THEN the backend returns 404 without contacting Stripe

#### Scenario: Webhook arrives with flag disabled

- GIVEN the subscriptions flag is `false`
- WHEN a Stripe webhook is received
- THEN the webhook is acknowledged with 200 but no processing occurs

### Requirement: Mobile useFeatureFlag Hook

The mobile app MUST provide a `useFeatureFlag` hook that accepts a flag key and returns `{ enabled, loading }`. The hook MUST source state from the bootstrap response.

#### Scenario: Hook reflects flag state

- GIVEN the bootstrap response indicates `subscriptions` is enabled
- WHEN `useFeatureFlag('subscriptions')` is called
- THEN `{ enabled: true, loading: false }` is returned

#### Scenario: Bootstrap not yet loaded

- GIVEN the bootstrap response has not completed
- WHEN `useFeatureFlag('subscriptions')` is called
- THEN `{ enabled: false, loading: true }` is returned

### Requirement: Flag Extensibility

The flag system MUST be generic — not coupled to subscriptions alone. New flags MUST be addable by registering a key and a config source.

#### Scenario: New flag is registered

- GIVEN a developer adds a new feature flag key `feature-x`
- WHEN the backend config includes `ENABLE_FEATURE_X=true`
- THEN the bootstrap response includes it and `useFeatureFlag('feature-x')` resolves correctly
