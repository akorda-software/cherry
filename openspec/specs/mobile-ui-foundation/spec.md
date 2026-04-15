# Mobile UI Foundation Specification

## Purpose

Define a reusable mobile design-token, theming, and shared-component foundation that skins current and future apps without changing screen business ownership.

## Requirements

### Requirement: Layered Token Taxonomy

The UI foundation MUST separate primitive tokens from semantic tokens. Primitive tokens SHALL represent raw scales and semantic tokens SHALL represent usage roles consumed by shared UI.

#### Scenario: Shared component resolves a role token
- GIVEN a shared UI component needs color, spacing, or border values
- WHEN it reads theme data
- THEN it consumes semantic roles rather than raw primitive values directly

#### Scenario: Primitive catalog changes safely
- GIVEN a theme remaps a semantic role to different primitive values
- WHEN shared components render
- THEN their public APIs remain unchanged

### Requirement: Theme Composition and Switchability

The system MUST define a theme contract that maps semantic tokens to concrete values and SHALL support swapping semantic mappings for alternate looks without requiring component rewrites.

#### Scenario: Theme variant is applied
- GIVEN two themes implement the same semantic contract
- WHEN the active theme changes
- THEN shared UI resolves the new semantic values through the same component surface

### Requirement: Shared UI Component Boundaries

The shared UI layer MUST provide reusable primitives and starter composites for generic mobile presentation, and MUST NOT own routing, feature orchestration, auth state, or product workflows.

#### Scenario: Screen composes shared UI
- GIVEN a feature screen needs layout and presentational elements
- WHEN it uses the shared UI layer
- THEN navigation and business decisions remain in the screen or feature layer

### Requirement: Semantic-Only Shared Component Styling

Shared components MUST consume semantic tokens for visual decisions and MUST NOT embed screen-specific constants, route-specific copy, or product-only styling rules.

#### Scenario: Generic component is reused on multiple screens
- GIVEN login, home, user, and settings screens reuse the same shared component
- WHEN each screen supplies its own content
- THEN the component styling remains driven by semantic tokens and generic props only

### Requirement: Screen Adoption Without Logic Rewrites

The current login, home, user, and settings screens MUST be able to adopt the shared UI system without recreating their existing business logic, route ownership, or auth/session behavior.

#### Scenario: Existing screen migrates presentation only
- GIVEN a current screen already owns feature orchestration
- WHEN its visual structure is rebuilt with shared UI primitives or composites
- THEN its non-UI business behavior remains unchanged

### Requirement: Future-App Reusability

The foundation SHOULD make alternate app looks achievable primarily through theme and token composition, while generic shared components remain reusable across future apps.

#### Scenario: New app brand is introduced
- GIVEN a future app needs a different visual identity
- WHEN it provides alternate semantic mappings within the same token contract
- THEN existing shared components can be reused without product-specific forks

### Requirement: Product-Specific Leakage Prevention

The foundation MUST stay generic. Shared primitives and composites SHALL NOT encode product names, domain entities, or app-exclusive workflows beyond generic UI patterns.

#### Scenario: Product feature requests a bespoke widget
- GIVEN a requested UI element depends on product-specific business meaning
- WHEN it cannot be expressed as a generic pattern
- THEN it remains outside the shared UI foundation

### Requirement: Accessibility and Style Consistency

Shared UI components MUST preserve accessibility-oriented behavior where applicable, including consistent state communication, generic interactive semantics, and theme-driven visual consistency across screens.

#### Scenario: Interactive component changes state
- GIVEN a shared interactive component is enabled, disabled, or selected
- WHEN it renders on any adopted screen
- THEN its semantic role, state indication, and token-driven styling remain consistent and testable

### Requirement: Strict-TDD Verifiable UI Contracts

The foundation MUST express token, theme, and shared-component behavior through deterministic contracts that can be verified with automated tests under the project's strict TDD workflow.

#### Scenario: Theme contract is exercised by tests
- GIVEN automated tests render shared UI under a theme contract
- WHEN a semantic token mapping or component state changes
- THEN tests can assert the resolved role usage, stable component API, and preserved non-UI screen ownership
