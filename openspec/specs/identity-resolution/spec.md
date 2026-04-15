# Identity Resolution Specification

## Purpose

Define Phoenix-owned identity resolution, backend domain separation, and initial identity data expectations.

## Requirements

### Requirement: Phoenix Context Separation

The backend MUST remain a Phoenix application with explicit `Accounts`, `Identity`, and `Sessions` contexts for domain separation.

#### Scenario: Backend auth behavior is assigned by context
- GIVEN auth-related backend behavior is implemented
- WHEN responsibilities are mapped
- THEN user records belong to Accounts, provider identity validation/linking belongs to Identity, and token lifecycle belongs to Sessions

### Requirement: Backend Identity Ownership

Phoenix MUST validate provider credentials, resolve or create the canonical user, and decide identity linking before issuing any session.

#### Scenario: First provider login creates user
- GIVEN no matching provider identity exists
- WHEN Phoenix validates a provider credential
- THEN Phoenix creates the internal user and linked provider identity before session issuance

#### Scenario: Existing provider login resolves user
- GIVEN a matching provider identity already exists
- WHEN Phoenix validates the credential
- THEN Phoenix resolves the existing user and does not create a duplicate account

### Requirement: Initial Auth Data Model

The system MUST support first-class records for users, provider identities, devices, and sessions using PostgreSQL latest stable.

#### Scenario: Auth state is persisted
- GIVEN a user signs in from a device
- WHEN the auth flow completes
- THEN PostgreSQL stores enough data to identify the user, provider identity, device, and issued session lineage
