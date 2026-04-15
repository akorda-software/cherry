# Session Management Specification

## Purpose

Define Phoenix-owned access, refresh, rotation, revocation, and logout behavior.

## Requirements

### Requirement: Backend Session Lifecycle Ownership

The backend MUST own session issuance, refresh, rotation, revocation, and logout; providers MUST NOT directly control app session state.

#### Scenario: Session is issued after provider validation
- GIVEN Phoenix accepts a provider credential
- WHEN login completes
- THEN Phoenix issues its own access token and refresh token for the app session

### Requirement: Short-Lived Access With Rotating Refresh

The system MUST use a short-lived access token and a rotating refresh token, replacing the refresh token on successful refresh.

#### Scenario: Refresh succeeds
- GIVEN a valid active refresh token is presented
- WHEN the client requests refresh
- THEN Phoenix issues a new access token and replacement refresh token and invalidates the prior refresh token

#### Scenario: Refresh token reuse is detected
- GIVEN an already-rotated or revoked refresh token is presented
- WHEN Phoenix processes refresh
- THEN the affected session lineage is rejected or revoked rather than extended

### Requirement: Device-Aware Logout

The system SHOULD support device-scoped logout semantics so a device session can be revoked without requiring provider disconnect.

#### Scenario: User logs out on device
- GIVEN an authenticated device session exists
- WHEN the user logs out
- THEN local secure storage is cleared and the backend revokes that device session
