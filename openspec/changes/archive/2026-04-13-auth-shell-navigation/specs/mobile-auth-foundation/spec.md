# Delta for Mobile Auth Foundation

## MODIFIED Requirements

### Requirement: Native Provider Initiation

The mobile app MUST initiate Google Sign-In and Sign in with Apple natively, then submit provider credentials to the backend for validation and app-session issuance; after successful authenticated session completion, the mobile app MUST hand off into the private shell boundary rather than remaining in a public auth-only flow.
(Previously: Native provider initiation ended at backend-issued session ownership without defining the authenticated shell handoff.)

#### Scenario: Google sign-in succeeds
- GIVEN a user completes native Google sign-in on device
- WHEN the credential is sent to Phoenix
- THEN the app receives backend-issued session tokens instead of treating the Google credential as the session

#### Scenario: Apple sign-in succeeds
- GIVEN a user completes native Apple sign-in on device
- WHEN the credential is sent to Phoenix
- THEN the app receives backend-issued session tokens under the same ownership model as Google

#### Scenario: Auth success enters the private shell
- GIVEN provider authentication and backend session issuance succeed
- WHEN auth completion finishes
- THEN the app navigates into the authenticated shell boundary
