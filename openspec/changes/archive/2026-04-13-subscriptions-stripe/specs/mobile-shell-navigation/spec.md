# Delta for Mobile Shell Navigation

## ADDED Requirements

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
