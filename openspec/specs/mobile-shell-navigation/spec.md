# Mobile Shell Navigation Specification

## Purpose

Define a reusable Expo Router shell with one public login route and one authenticated drawer-plus-tabs application shell.

## Requirements

### Requirement: Public and Private Route Separation

The app MUST expose `login` as the public entry and MUST gate all shell routes behind an authenticated session.

#### Scenario: Unauthenticated user requests a private route
- GIVEN no active authenticated session exists
- WHEN a private shell route is opened
- THEN the app routes the user to `login`

#### Scenario: Authenticated user completes sign-in
- GIVEN backend session creation succeeds
- WHEN auth completion finishes
- THEN the app enters the private shell instead of remaining in public auth flow

### Requirement: Drawer and Tabs Canonical Ownership

Navigation MUST use Expo Router with a private Drawer shell and nested Tabs; Tabs MUST own canonical `home` and `user` routes, while Drawer entries MUST be Home, User, Settings, and Logout.

#### Scenario: Drawer opens a canonical tab route
- GIVEN the authenticated shell is visible
- WHEN the user selects Home or User in the drawer
- THEN navigation resolves to the same canonical tab route already used by Tabs

### Requirement: Login Screen Entry Behavior

The `login` route MUST show placeholder welcome or branding content and MUST offer Google and Apple sign-in actions backed by the existing auth foundation.

#### Scenario: Login renders public sign-in choices
- GIVEN an unauthenticated user is on `login`
- WHEN the screen is shown
- THEN welcome placeholder content and Google/Apple actions are visible

### Requirement: Home Placeholder Screen

The canonical `home` route MUST render a generic authenticated landing screen and SHOULD avoid product-specific business content.

#### Scenario: User lands on Home after entering shell
- GIVEN an authenticated user enters the shell
- WHEN the default landing route resolves
- THEN the Home screen shows generic placeholder content

### Requirement: User Screen Authenticated Data

The canonical `user` route MUST present authenticated user information sourced from the existing session/auth foundation.

#### Scenario: User opens the User tab
- GIVEN authenticated user data is available
- WHEN the `user` route is displayed
- THEN the screen shows current authenticated user information

### Requirement: Settings Screen and Logout Access

The private `settings` route MUST be separate from `user`, MUST expose user/settings content, and MUST provide logout access.

#### Scenario: User signs out from Settings
- GIVEN an authenticated user is on Settings
- WHEN logout is invoked
- THEN the existing session/auth foundation clears the session and routes the user to `login`

### Requirement: Reusable Shell UI Boundaries

Shell layouts, drawer content, and placeholder screens SHOULD remain generic and reusable for future mobile apps, while auth/session orchestration MUST stay in existing auth foundations or adapters.

#### Scenario: Shell is reused with different feature content
- GIVEN another mobile app reuses shell primitives
- WHEN app-specific content changes
- THEN route shell structure remains reusable without moving auth ownership into shell UI components

### Requirement: Navigation Consistency and Deep Links

The app MUST NOT create duplicate Home or User screens; direct links, Tabs, and Drawer navigation MUST converge on the same canonical routes, and logout MUST prevent returning to private shell history.

#### Scenario: Deep link targets a canonical screen
- GIVEN an authenticated deep link targets Home or User
- WHEN the route resolves
- THEN the canonical tab-owned screen is shown exactly once within shell navigation

#### Scenario: Logged-out user attempts to return to shell history
- GIVEN logout completed successfully
- WHEN the user navigates back
- THEN private shell content is not restored

### Requirement: Conditional Subscription Navigation

When the subscriptions feature flag is enabled and the user is authenticated, the shell MUST include subscription-related navigation entries. When the flag is disabled, these entries MUST NOT appear and the shell MUST behave identically to the pre-subscriptions state.

#### Scenario: Subscription screen appears when flag enabled

- GIVEN the subscriptions feature flag is `true` and the user is authenticated
- WHEN the drawer is opened
- THEN a "Subscription" entry is visible and navigates to the subscriptions feature module

#### Scenario: No subscription screen when flag disabled

- GIVEN the subscriptions feature flag is `false`
- WHEN the drawer is opened
- THEN no subscription-related entries appear and the drawer matches the original spec

#### Scenario: Subscription tab appears when flag enabled

- GIVEN the subscriptions feature flag is `true` and the user is authenticated
- WHEN the tab bar is visible
- THEN a subscription indicator or tab is present within the authenticated shell

### Requirement: Shell Reusability Preserved

Adding subscription navigation MUST NOT break the existing reusable shell boundaries. Subscription entries MUST be registered dynamically so that apps without the subscription module render the original shell unchanged.

#### Scenario: App without subscription module uses shell

- GIVEN an app reuses the shell but does not include the subscription feature module
- WHEN the shell renders
- THEN the drawer and tabs show only the original entries with no errors or empty slots
