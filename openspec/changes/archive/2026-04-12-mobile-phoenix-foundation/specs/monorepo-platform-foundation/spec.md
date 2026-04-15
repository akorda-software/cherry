# Monorepo Platform Foundation Specification

## Purpose

Define the mandatory repository structure, package boundaries, and extension rules for the Expo + Phoenix foundation.

## Requirements

### Requirement: Polyglot Monorepo Structure

The system MUST use one monorepo containing `apps/mobile`, `apps/backend`, `packages/contracts`, `packages/mobile-shared`, and `infra`.

#### Scenario: Foundation layout exists
- GIVEN the repository is initialized for this change
- WHEN a contributor inspects the top-level structure
- THEN mobile, backend, shared package, contracts, and infrastructure roots are present

### Requirement: Shared Contract Boundary

The system MUST keep cross-runtime contracts in `packages/contracts`; apps MUST NOT depend on each other's internal code.

#### Scenario: Cross-app integration uses shared contracts
- GIVEN mobile calls backend APIs
- WHEN request or response shapes are defined
- THEN the shapes are expressed through shared contracts rather than app-internal modules

### Requirement: Extensible Foundation Rules

The system SHOULD allow new apps, packages, and auth methods to be added without restructuring existing roots or violating ownership boundaries.

#### Scenario: Future capability is added
- GIVEN a future auth or client capability is introduced
- WHEN the capability is scaffolded
- THEN it fits under existing app/package boundaries with unchanged backend session ownership
