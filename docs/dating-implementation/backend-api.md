# Backend API Spec

## Goal

Define the first-pass API surface and the server-side rules each endpoint must enforce.

## API Groups

1. Authentication and session bootstrap
2. Onboarding and profile management
3. Discovery
4. Swipe and matching
5. Chat
6. Safety and moderation
7. Settings and account lifecycle
8. Internal admin support

Exact routes should fit existing Phoenix conventions.

## Authentication

This area should build on the current starter auth foundation.

Expected operations:

- sign in with Apple
- sign in with Google
- fetch current session
- refresh or restore current user bootstrap

Required response shape for bootstrap:

- session user identity
- whether a dating profile exists
- whether onboarding is complete
- feature flags if needed

## Onboarding And Profile Management

### `GET /api/me/profile`

Returns:

- current profile fields
- discovery preferences
- photo list
- selected positive tags
- selected blocked tags
- completeness status

### `PUT /api/me/profile`

Updates core profile data:

- display name
- birth date
- gender
- what I am looking for
- bio

Validation:

- all required fields must be present for completion
- bio length 20 to 240
- allowed enum values only

### `PUT /api/me/discovery-preferences`

Updates:

- age min and max
- distance
- interested-in selections
- compatible-only flag if included in v1

Validation:

- age range sane
- at least one interested-in selection
- distance in allowed options

### `POST /api/me/photos`

Preferred behavior:

- returns upload intent or signed upload data for direct R2 upload

### `POST /api/me/photos/complete`

Registers a completed uploaded asset and creates the photo record.

Payload:

- storage key
- public URL
- intended position

Validation:

- max 4 active photos
- valid position

### `DELETE /api/me/photos/:id`

Removes or deactivates a photo.

Validation:

- if profile is already complete, deleting below minimum may mark it incomplete

### `PUT /api/me/tags`

Replaces positive tags.

Validation:

- tags must exist and be active
- max 8 tags

### `PUT /api/me/blocked-tags`

Replaces blocked tags.

Validation:

- tags must exist and be active
- max 5 tags

### `POST /api/me/location`

Updates latest location snapshot.

Payload:

- latitude
- longitude
- accuracy meters optional
- recorded at client timestamp optional

Validation:

- coordinates valid
- reject obviously invalid stale or malformed values

## Discovery

### `GET /api/discovery/feed`

Query params suggested:

- `cursor`
- `limit`

Behavior:

1. confirm profile is complete and discoverable
2. load current preferences
3. build candidate set
4. apply fallback rules if needed
5. rank candidates
6. return a page of profile cards

Profile card response should include only safe fields:

- profile id
- display name
- computed age
- bio
- photo URLs
- positive tags if product wants them visible
- intent
- privacy-safe distance label

Must not include:

- exact coordinates
- blocked-tag internals of the viewer
- moderation-sensitive fields

### Feed eligibility failures

If profile is incomplete, the API should return a clear onboarding-required state rather than a generic failure.

## Swipe And Matching

### `POST /api/discovery/actions`

Payload:

- `target_profile_id`
- `action_type` where action is `like` or `dislike`

Server rules:

- reject self-action
- reject duplicate invalid transitions if any
- persist the swipe
- if reverse like exists, create match and conversation

Response suggested:

- accepted action
- whether a match was created
- match summary if created

## Matches

### `GET /api/matches`

Returns active matches and their lightweight state:

- match id
- other profile summary
- whether chat started
- match expiry if no first message yet
- latest message preview if any

### `POST /api/matches/:id/unmatch`

Rules:

- only participants can unmatch
- mark match as unmatched
- conversation becomes read-only or hidden from active messaging

## Chat

### `GET /api/conversations`

Returns conversation list for current user.

### `GET /api/conversations/:id/messages`

Returns paginated messages.

### `POST /api/conversations/:id/messages`

Payload:

- `body`

Rules:

- sender must be a participant in the parent match
- match must still be active
- message must be non-empty text
- if this is the first message, clear match expiration and set `first_message_at`

## Safety And Moderation

### `POST /api/users/:profile_id/block`

Rules:

- create block relation
- remove profile from discovery
- prevent messaging both ways

### `POST /api/users/:profile_id/report`

Payload:

- reason
- optional details

Rules:

- create moderation report
- optionally also hide the target immediately for the reporting user

### `POST /api/users/:profile_id/hide`

Purpose:

- hide a profile from the viewer without a full block if you want to support it separately

If you want to keep the MVP smaller, this can be treated as a dislike and omitted as a distinct endpoint.

## Settings And Account Lifecycle

### `POST /api/me/pause`

Effect:

- makes profile non-discoverable

### `POST /api/me/unpause`

Effect:

- restores discoverability if profile remains complete

### `DELETE /api/me/account`

Effect:

- soft-delete account or mark profile deleted
- revoke future discovery
- preserve enough data for moderation/audit needs depending on policy

## Internal Admin Endpoints

Likely internal capabilities:

- list users
- inspect profile
- list reports by status
- mark report reviewed
- disable or re-enable account

Admin endpoints can remain private and undocumented in the public mobile contract.
