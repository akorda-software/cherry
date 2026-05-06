# Mobile Contracts V1

## Purpose

This document captures the implementation decisions that connect the Phoenix backend and the Expo mobile app for the first dating-app mobile build.

Use this file as the fast reference before changing backend APIs, mobile onboarding, discovery, chat, photos, or session behavior.

## Scope

This document finalizes:

- session and token recovery behavior
- first-login profile creation
- onboarding draft persistence
- location payload and privacy handling
- discovery distance display
- chat WebSocket contract
- push notification contract scope
- hide versus dislike behavior
- direct photo upload to R2
- recommended implementation order

It does not replace the full PRD or schema documents. It resolves the mobile-facing contracts that were still ambiguous after the first backend pass.

## Contract Status

These decisions are accepted for v1:

- Auth is Google and Apple only.
- Phoenix owns app sessions, not Google or Apple.
- Mobile uses secure device storage for app session tokens.
- Onboarding uses a backend draft profile and incremental updates.
- A profile becomes usable only after backend completion validation succeeds.
- Location is mandatory for discovery in v1.
- No manual postal-code or manual city fallback exists in v1.
- The backend stores and serves privacy-safe approximate location/distance data.
- `hide user` is not a separate MVP state. Feed hiding is a `dislike`.
- Photos upload directly from mobile to R2. Backend stores metadata and URLs only.
- Push notifications are designed now but implemented after the core mobile chat/match flow is working.

## Auth And Session Contract

### Providers

The mobile app supports:

- Sign in with Apple
- Sign in with Google

Email/password and phone auth are out of scope for v1.

### Session Ownership

Native provider credentials are only used to prove identity to Phoenix.

Phoenix then issues the app session:

- short-lived access token
- rotating refresh token
- device-scoped session family

Mobile must never treat the Google or Apple credential as the app session.

### Token Expiry Behavior

Backend requirements:

- Access token `exp` must be explicitly validated on every REST and WebSocket auth path.
- Expired access tokens must be rejected with `401` for REST and connection rejection for WebSocket.
- Refresh tokens rotate on every successful refresh.
- Refresh token reuse revokes the affected session family.

Mobile requirements:

- Attach the access token as `Authorization: Bearer <token>` on authenticated REST calls.
- If an authenticated REST call returns `401`, refresh once using the refresh token.
- If refresh succeeds, persist the new session bundle and retry the original request once.
- If refresh fails, clear secure storage and return the user to signed-out state.
- On app bootstrap, refresh immediately if the cached access token is already expired.

This behavior is already mostly present in the mobile auth foundation. The backend still needs explicit access-token expiration enforcement.

## Bootstrap And Routing Contract

After auth success or app bootstrap, mobile calls `GET /api/bootstrap`.

The response must let mobile choose one of these states:

- signed out
- authenticated but onboarding required
- authenticated and ready for the main app shell

Recommended response shape:

```json
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "displayName": "User"
  },
  "profile": {
    "exists": true,
    "isComplete": false,
    "isDiscoverable": false,
    "isPaused": false,
    "onboardingRequired": true,
    "nextOnboardingStep": "photos"
  }
}
```

Routing rules:

- If no profile exists, route to onboarding.
- If profile exists but `isComplete` is false, route to onboarding.
- If profile is complete, not deleted, and not paused, route to the main app shell.
- If profile is paused, route to the main app shell but show paused visibility state.
- Discovery remains blocked until the profile is complete and discoverable.

`nextOnboardingStep` is a backend convenience, not a security boundary. Backend validation still decides whether completion is allowed.

## Onboarding Draft Contract

### Lifecycle

Profiles use this lifecycle for v1:

1. No profile exists yet.
2. First onboarding write creates a draft profile for the authenticated user.
3. Draft profile fields are updated incrementally across onboarding steps.
4. Photos, tags, preferences, and location are attached to the draft profile.
5. Final completion validates all requirements server-side.
6. Completion sets `isComplete = true` and `isDiscoverable = true` unless the profile is paused or deleted.

Draft profiles must not appear in discovery.

### Required Backend Change

The current backend assumes core profile fields are required at schema/changeset level.

For draft onboarding, backend must allow incomplete profile rows while `isComplete = false`.

Recommended backend behavior:

- Allow nullable profile fields for draft rows.
- Validate individual fields when a step updates them.
- Validate the complete profile only in the completion endpoint.
- Keep `isComplete = false` and `isDiscoverable = false` until completion passes.

Recommended endpoints:

- `GET /api/me/profile` returns the current draft or complete profile.
- `PUT /api/me/profile` creates or updates the current user's draft profile core fields.
- `PUT /api/me/discovery-preferences` creates or updates draft discovery preferences.
- `PUT /api/me/tags` replaces positive tags.
- `PUT /api/me/blocked-tags` replaces blocked tags.
- `POST /api/me/location` stores the latest approximate matching location.
- photo endpoints attach uploaded photo metadata to the draft profile.
- `POST /api/me/profile/complete` validates and activates the profile.

### Completion Rules

Completion succeeds only if all of these are true:

- required core fields are present
- birth date yields an allowed age
- gender is allowed
- interested-in selections are valid and non-empty
- relationship intent is valid
- bio length is 20 to 240 characters
- 2 to 4 active photos exist
- 1 to 8 positive tags exist
- 0 to 5 blocked tags exist
- discovery preferences are present and valid
- current approximate location exists

If completion fails, backend returns a structured remediation response.

Recommended error shape:

```json
{
  "error": "profile_incomplete",
  "missing": ["photos", "location"],
  "nextOnboardingStep": "photos"
}
```

### Local Draft State

Mobile may store local onboarding state for UX resilience, but the backend is the source of truth for submitted steps.

Local state may include:

- current screen index
- unsent form values
- selected local image assets before upload
- transient upload progress

Local state must not be treated as completed profile truth.

If the app is closed mid-onboarding, mobile should bootstrap, fetch the server draft, merge any safe unsent local fields, and resume the best next step.

## Location Contract

### Product Decision

Location is mandatory for discovery in v1.

There is no postal-code, city, or manual-location fallback in v1.

If permission is denied or location cannot be resolved:

- onboarding cannot complete
- discovery is blocked
- mobile shows a location-required remediation screen

### Mobile Request Payload

Mobile sends normal JSON. It must not send framework-specific `Geo.Point` structures.

`POST /api/me/location` payload:

```json
{
  "latitude": 40.4168,
  "longitude": -3.7038,
  "accuracyMeters": 25,
  "recordedAt": "2026-04-29T12:00:00Z"
}
```

Field rules:

- `latitude` must be between `-90` and `90`.
- `longitude` must be between `-180` and `180`.
- `accuracyMeters` is optional but should be sent when available.
- `recordedAt` is optional but should be sent when available.
- Backend rejects malformed or obviously stale values.

### Approximation Policy

Backend must normalize the received coordinate to an approximate 500 meter privacy grid before storing it in PostGIS.

Recommended policy:

- Mobile may also round before sending, but backend must enforce approximation.
- Store only the normalized point in `profile_locations.coordinates`.
- Do not return raw coordinates from any mobile API.
- Do not log raw location request bodies in production.
- Use the normalized point for discovery filtering and distance labels.

The goal is to preserve enough distance quality for matching while avoiding exact home or live-position storage/display.

### Refresh Policy

Mobile should refresh location:

- during onboarding before completion
- when entering discovery and no valid location exists
- when the app returns to foreground and the stored location is stale

Backend remains the source of truth for whether the current location is valid enough for discovery.

## Discovery Distance Display Contract

Mobile should display backend-provided distance text. Mobile should not compute user-facing distance from raw coordinates.

Recommended profile card distance payload:

```json
{
  "distanceLabel": "A unos 15 km",
  "distanceKmApprox": 15
}
```

`distanceKmApprox` is approximate and optional for UI decisions. `distanceLabel` is what should be shown to the user.

Distance label rules:

- `< 2 km`: `Cerca de ti`
- `2-10 km`: round to nearest 1 km, for example `A unos 7 km`
- `10-50 km`: round to nearest 5 km, for example `A unos 15 km`, `A unos 25 km`, `A unos 40 km`
- `50-100 km`: round to nearest 10 km, for example `A unos 70 km`
- `> 100 km`: use coarse labels, for example `A mas de 100 km` or nearest 25 km if product wants more detail

Do not expose exact coordinate pairs or high-precision distance values.

## Discovery Hide Contract

There is no separate `hide user` state in v1.

The product actions are:

- `like`: user is interested
- `dislike`: user does not want to see the profile again in discovery
- `block`: prevent discovery and messaging both ways
- `report`: send moderation report, and optionally hide from the reporter immediately
- `unmatch`: end an existing match

If the UI ever needs a softer label like "Hide", it should call the same backend path as dislike:

```json
{
  "target_profile_id": "profile-id",
  "action_type": "dislike"
}
```

Do not add a separate hidden-profiles table or `POST /hide` endpoint for MVP unless product semantics change.

## Chat WebSocket Contract

### Role Of REST And WebSocket

REST is the source of truth for loading conversations and message history.

WebSocket is used for live message delivery and transient chat events.

Mobile must always backfill via REST when opening a conversation or reconnecting.

### Connection

Phoenix socket endpoint:

```text
/socket/websocket?token=<accessToken>
```

Rules:

- Token is the backend-issued access token.
- Backend validates token signature and expiration.
- If socket connect fails because the token is expired, mobile refreshes the session and reconnects.
- If refresh fails, mobile signs out.

### Conversation Channel

Topic:

```text
chat:{conversationId}
```

Join rules:

- The authenticated user must have a profile.
- The profile must be a participant in the conversation's match.
- The match must still allow messaging.
- Non-participants receive `not_participant`.
- Missing profile receives `profile_required`.
- Expired or unmatched conversations receive `conversation_not_active`.

### Events

Client sends text message:

```json
{
  "event": "send_message",
  "payload": {
    "body": "hello"
  }
}
```

Successful reply:

```json
{
  "message": {
    "id": "message-id",
    "conversationId": "conversation-id",
    "senderProfileId": "profile-id",
    "body": "hello",
    "insertedAt": "2026-04-29T12:00:00Z"
  }
}
```

Server broadcasts:

```json
{
  "event": "new_message",
  "payload": {
    "id": "message-id",
    "conversationId": "conversation-id",
    "senderProfileId": "profile-id",
    "body": "hello",
    "insertedAt": "2026-04-29T12:00:00Z"
  }
}
```

Optional typing event:

```json
{
  "event": "typing",
  "payload": {
    "conversationId": "conversation-id",
    "profileId": "profile-id"
  }
}
```

Typing is transient. It must not be persisted or required for v1 correctness.
Typing events are only broadcast while the conversation still allows messaging.

### Reconnect And Backfill

On reconnect, mobile should:

1. reconnect the socket with a fresh access token
2. rejoin active conversation channels as needed
3. call REST message history for the open conversation
4. merge missing messages by message id

Do not rely on WebSocket as durable message history.

## Push Notification Contract

Push notifications add high value for matches and chat, but they do not block the first mobile vertical slice.

Decision:

- Design the contract now.
- Implement after auth, onboarding, discovery, matching, and chat are working end to end.
- Include before beta/public release if chat is part of the tested product experience.

### Initial Push Events

Only these push events are in v1 scope:

- new match
- new message

Out of scope for v1:

- marketing pushes
- daily reminders
- inactive-user campaigns
- like-received pushes unless product adds visible inbound likes

### Expo Push Strategy

Recommended architecture:

1. Mobile requests notification permission after the user has completed onboarding or after first match/chat value is clear.
2. Mobile obtains an Expo push token.
3. Mobile sends the token to Phoenix with device/session metadata.
4. Phoenix stores active push tokens per device/session.
5. Phoenix sends new-match and new-message pushes through Expo Push API.
6. Phoenix marks invalid tokens inactive when Expo reports them invalid.

Implemented endpoint:

```text
POST /api/me/push-token
```

Payload:

```json
{
  "expoPushToken": "ExponentPushToken[...]",
  "platform": "ios",
  "installationId": "device-installation-id"
}
```

Response:

```json
{
  "ok": true,
  "pushToken": {
    "id": "push-token-id",
    "platform": "ios",
    "installationId": "device-installation-id",
    "status": "active",
    "lastSeenAt": "2026-04-29T12:00:00Z"
  }
}
```

Backend rules:

- The endpoint requires an authenticated app session.
- The access token's `session_id` links the push token to the active session family.
- `installationId` and `platform` must match the device used for the authenticated session.
- Expo token must match `ExponentPushToken[...]` or `ExpoPushToken[...]`.
- Re-registering from the same session updates the existing push token row.
- Registering the same Expo token from a newer session deactivates older active rows for that token.
- Future push sending must only target active push tokens whose session family is not revoked.

Logout should clear local notification state and allow backend device/session revocation to stop future pushes for that session.

### Privacy Defaults

Initial notification copy should avoid sensitive message content.

Recommended examples:

- `Nuevo match`
- `Tienes un nuevo mensaje`

Message body previews can be added later if product wants them.

## Photo Upload Contract

### Decision

Photos upload directly from mobile to Cloudflare R2.

The backend does not receive or proxy photo binary data in v1.

Rationale:

- avoids Phoenix request body size and timeout problems
- avoids backend memory and bandwidth cost for media
- keeps the backend focused on metadata, validation, and ownership
- matches the existing technical architecture direction
- scales better if photo usage grows beyond onboarding

### Mobile Processing

Before upload, mobile should:

- crop or constrain to accepted aspect ratios if the UI requires it
- resize to a reasonable maximum dimension
- compress to a reasonable JPEG/WebP quality level
- capture width, height, content type, and size when available

Exact compression settings can be tuned during implementation. The goal is to avoid uploading full-resolution camera originals.

### Upload Flow

1. Mobile selects and compresses an image.
2. Mobile requests an upload intent from Phoenix.
3. Phoenix validates profile ownership and returns a signed R2 upload target.
4. Mobile uploads the binary directly to R2.
5. Mobile calls Phoenix to complete the upload.
6. Phoenix validates the storage key and creates the `profile_photos` row.
7. Mobile refreshes the draft profile photo list.

Recommended upload intent endpoint:

```text
POST /api/me/photos/upload-intent
```

Request:

```json
{
  "position": 1,
  "contentType": "image/jpeg",
  "sizeBytes": 420000
}
```

Response:

```json
{
  "storageKey": "profiles/profile-id/photo-id.jpg",
  "uploadUrl": "https://r2-signed-upload-url",
  "publicUrl": "https://cdn.example.com/profiles/profile-id/photo-id.jpg",
  "method": "PUT",
  "headers": {
    "Content-Type": "image/jpeg"
  },
  "expiresAt": "2026-04-29T12:10:00Z",
  "maxBytes": 2000000
}
```

Recommended completion endpoint:

```text
POST /api/me/photos/complete
```

Request:

```json
{
  "storageKey": "profiles/profile-id/photo-id.jpg",
  "publicUrl": "https://cdn.example.com/profiles/profile-id/photo-id.jpg",
  "position": 1,
  "contentType": "image/jpeg",
  "sizeBytes": 420000,
  "width": 1080,
  "height": 1350
}
```

Backend rules:

- storage key must belong to the current user's profile
- upload intent must be unexpired
- content type must be allowed
- max active photos remains 4
- completion creates metadata only
- deleting a photo deactivates metadata and may delete the R2 object asynchronously later

## Recommended Implementation Order

Implement backend contract fixes before building full mobile screens.

### Backend Contracts First

1. Enforce access-token expiration in REST and WebSocket auth.
2. Add profile draft/upsert lifecycle for first-login users.
3. Add profile completion endpoint with structured missing-step errors.
4. Adapt profile schema/changesets to allow incomplete draft rows.
5. Change location API to accept `latitude` and `longitude` JSON.
6. Normalize stored location to the 500 meter privacy grid.
7. Add backend-generated `distanceLabel` and approximate distance payloads.
8. Implement direct R2 upload intent and completion endpoints.
9. Harden/document chat WebSocket join/send/reconnect behavior.
10. Add push-token storage contract later, before push implementation.

### Mobile Vertical Slices

1. Auth bootstrap and session recovery against the backend contracts.
2. Onboarding draft flow.
3. Location permission and location-required remediation.
4. Photo selection, compression, direct R2 upload, and completion.
5. Profile completion and transition into app shell.
6. Discovery feed with like/dislike.
7. Match feedback and matches list.
8. Chat REST history plus WebSocket live messages.
9. Push notifications for match/message near beta readiness.

## Explicit Non-Goals For V1

Do not implement these unless product decisions change:

- local offline database for swipes or chat
- offline queued likes
- offline queued messages
- manual postal-code location fallback
- separate `hide user` state
- backend-proxied photo binary uploads
- marketing push notifications
- image, audio, or video messages
