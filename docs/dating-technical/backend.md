# Backend Plan

## Goal

Define how the Phoenix backend should own the dating domain logic.

## Proposed Context Boundaries

Suggested backend contexts:

- `Accounts` or existing identity/session contexts for auth-linked user state
- `Dating.Profiles` for dating profile CRUD and completion logic
- `Dating.Tags` for tag catalog and selection rules
- `Dating.Discovery` for candidate selection and ranking
- `Dating.Matching` for swipes, matches, and expirations
- `Dating.Chat` for conversations and messages
- `Dating.Moderation` for reports, blocks, and review actions
- `Dating.Analytics` for event capture and reporting support

Final naming should fit existing Phoenix structure.

## API Surface

Expected API groups:

- Auth/session endpoints built on the existing starter foundation
- Profile onboarding and edit endpoints
- Discovery feed endpoint
- Swipe action endpoint
- Match list endpoint
- Conversation list endpoint
- Message send/list endpoints
- Moderation action endpoints
- Visibility/account control endpoints

## Discovery Endpoint Behavior

The discovery endpoint should:

1. Load the viewer profile and preferences
2. Verify the profile is eligible to browse
3. Build candidate filters
4. Apply low-supply fallback when needed
5. Score candidates
6. Return paginated profiles with privacy-safe distance display fields

The endpoint should not leak raw location data.

## Match Creation Flow

When a like is stored:

1. Persist the swipe action
2. Check whether the reverse like already exists
3. If yes, create a match and conversation record
4. Set match expiration window if no message is sent

This flow must be idempotent enough to handle retries safely.

## Match Expiration

Matches should expire after 7 days without any message.

Recommended implementation:

- Store `expires_at` on the match
- Clear or deactivate expiration when the first message is sent
- Run a scheduled job to expire stale matches

## Chat Rules

V1 chat rules are intentionally narrow:

- Only matched users can send messages
- Messages are text-only
- Unmatched or expired matches can no longer receive messages

The backend must enforce all of these regardless of client behavior.

## Moderation Enforcement

The backend must enforce these rules in discovery and chat:

- Blocked users must not be shown or allowed to message each other
- Reported users may need visibility controls depending on moderation outcome
- Paused or deleted profiles must not continue appearing in discovery

## Anti-Abuse Enforcement

Suggested backend checks:

- Rate limits on repeated swipe requests
- Heuristics for impossible action velocity
- Guardrails on repeated account abuse patterns

These should be implemented as soft defense layers, not as monetization mechanics.

## Jobs And Scheduling

Background work likely includes:

- Match expiration jobs
- Analytics aggregation jobs
- Moderation queue support
- Optional feed precomputation later if needed

For the MVP, keep ranking request-time if acceptable, then optimize from real load.

## Admin Support

The backend should provide enough internal support for:

- Listing users
- Inspecting profiles
- Inspecting reports
- Disabling users
- Reviewing photos if necessary

This may start as internal API plus simple admin views rather than a polished operations product.
