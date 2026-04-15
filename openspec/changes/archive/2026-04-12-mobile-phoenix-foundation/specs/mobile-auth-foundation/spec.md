# Mobile Auth Foundation Specification

## Purpose

Define mobile-side auth architecture, provider-first sign-in initiation, and secure device session handling.

## Requirements

### Requirement: Feature-First Mobile Boundaries

The mobile app MUST organize code by feature with explicit `presentation`, `application`, `domain`, and `infrastructure` boundaries plus shared infrastructure modules.

#### Scenario: Auth feature follows layered boundaries
- GIVEN the authentication feature exists
- WHEN its code is organized
- THEN UI, use-case orchestration, domain rules, and provider/storage adapters remain separated

### Requirement: Native Provider Initiation

The mobile app MUST initiate Google Sign-In and Sign in with Apple natively, then submit provider credentials to the backend for validation and app-session issuance.

#### Scenario: Google sign-in succeeds
- GIVEN a user completes native Google sign-in on device
- WHEN the credential is sent to Phoenix
- THEN the app receives backend-issued session tokens instead of treating the Google credential as the session

#### Scenario: Apple sign-in succeeds
- GIVEN a user completes native Apple sign-in on device
- WHEN the credential is sent to Phoenix
- THEN the app receives backend-issued session tokens under the same ownership model as Google

### Requirement: Secure Device Session Storage

Sensitive session data MUST be stored only through secure device storage and MUST NOT be stored in insecure local persistence.

#### Scenario: Session is cached on device
- GIVEN backend session tokens are issued
- WHEN the mobile app persists them for reuse
- THEN access and refresh token material is written only to secure device storage
