# Mobile Implementation Plan

## Purpose

This document defines the recommended order for implementing the Expo mobile app on top of the current Phoenix backend contracts.

Use it as the execution guide when starting mobile work. It assumes the backend contracts in `mobile-contracts-v1.md` are the source of truth.

For concrete route names, stacks, screen states, and visual direction, use `expo-screens-stacks-style-plan.md` before implementing UI screens.

## Implementation Principles

- Build vertical slices that can be tested against the backend.
- Keep backend domain state as the source of truth.
- Use local state for UX, drafts, cache, and optimistic transitions only.
- Do not introduce a local database for v1.
- Keep feature folders aligned with the existing mobile architecture.
- Prefer simple screens wired to real APIs over polished mock flows.
- Add push notification registration later in the flow, but keep the API client contract ready.

## Backend Contract Baseline

Mobile can rely on these backend contracts:

- Google and Apple auth callbacks issue Phoenix-owned sessions.
- Access tokens expire and refresh tokens rotate.
- `GET /api/bootstrap` returns user/profile onboarding state.
- `PUT /api/me/profile` creates or updates a draft profile.
- `POST /api/me/profile/complete` validates and activates a complete profile.
- Location accepts `latitude` and `longitude` JSON and stores an approximate point.
- Discovery cards return `distanceLabel` and `distanceKmApprox`.
- Photos use direct R2 upload intent and completion endpoints.
- Chat supports REST history and Phoenix WebSocket live messages.
- Push token registration exists at `POST /api/me/push-token`.

## Recommended Order

### Phase 1: Mobile API Foundation

Goal: make mobile talk to the real backend safely.

Implement:

1. Shared authenticated API client wrapper using the existing session manager.
2. Backend bootstrap client for `GET /api/bootstrap`.
3. Typed DTOs for bootstrap, profile, discovery, matches, chat, upload intent, and push token registration.
4. Common API error handling for `401`, `403`, `422`, and offline/network failures.
5. App-level loading/error boundaries for bootstrap.

Verification:

- App can restore a session, refresh if needed, and fetch bootstrap.
- Expired access-token behavior triggers refresh and one retry.
- Missing/invalid session returns to signed-out state.

### Phase 2: Auth To App Routing

Goal: route users correctly after login/bootstrap.

Implement:

1. Auth success calls backend and persists the session.
2. Bootstrap runs after auth success and on cold app open.
3. Routing decision:
   - no session: auth stack
   - session plus `onboardingRequired`: onboarding stack
   - session plus complete profile: main app shell
4. Basic signed-out and sign-out flow.

Verification:

- New authenticated user lands in onboarding.
- Complete profile lands in main shell.
- Refresh failure clears storage and routes to auth.

### Phase 3: Onboarding Draft Core

Goal: create and update a server-side draft profile.

Implement onboarding steps in this order:

1. Name.
2. Birth date.
3. Gender.
4. Interested in.
5. Relationship intent.
6. Bio.
7. Positive tags.
8. Blocked tags.
9. Distance preference.

Implementation notes:

- Save each logical step to the backend.
- Keep local draft values only for unsent form state.
- After each successful save, update local profile/bootstrap cache.
- Use backend validation errors for inline remediation.

Verification:

- Killing and reopening the app resumes from backend draft state.
- Invalid fields show step-local errors.
- Incomplete profile never reaches discovery.

### Phase 4: Location Permission And Completion Gate

Goal: finish onboarding prerequisites except photos.

Implement:

1. Location permission explanation screen.
2. Native location request.
3. `POST /api/me/location` with `latitude`, `longitude`, `accuracyMeters`, `recordedAt`.
4. Location-denied remediation screen.
5. App foreground location refresh when stale.

Verification:

- Permission granted stores backend location and advances onboarding.
- Permission denied blocks completion with clear UX.
- Mobile never receives or displays raw coordinates.

### Phase 5: Photo Upload To R2

Goal: support required profile photos without sending binaries through Phoenix.

Implement:

1. Image picker.
2. Image crop/resize/compression.
3. `POST /api/me/photos/upload-intent`.
4. Direct `PUT` upload to R2 using returned `uploadUrl` and headers.
5. `POST /api/me/photos/complete`.
6. Photo list refresh and delete support.
7. Upload progress and retry UI.

Verification:

- 2 to 4 photos can be uploaded and displayed.
- Unsupported image or oversized compressed file is rejected before/at upload intent.
- Failed R2 upload can be retried without creating a photo row.

### Phase 6: Profile Completion

Goal: activate the profile and enter the app.

Implement:

1. Review screen.
2. `POST /api/me/profile/complete`.
3. Missing-step handling from backend response.
4. Success transition to main shell.

Verification:

- Completion succeeds only with all backend requirements.
- Backend `missing` list routes user to the right remediation step.
- Main shell loads only after completion succeeds.

### Phase 7: Discovery Feed

Goal: implement the main browsing surface.

Implement:

1. `GET /api/discovery/feed` client.
2. Card UI with photo, name, age, bio, intent, tags, and `distanceLabel`.
3. Like/dislike actions via `POST /api/discovery/actions`.
4. Optimistic card removal with rollback on failure.
5. Empty, low-supply, incomplete-profile, paused-profile, and offline states.

Verification:

- Feed cards never require raw location.
- Dislike removes card and does not add separate hide state.
- Match response triggers match feedback.

### Phase 8: Matches

Goal: expose created matches and transition into chat.

Implement:

1. Match feedback modal/screen after mutual like.
2. `GET /api/matches` list.
3. Match expiry display before first message.
4. Open conversation from match.
5. Unmatch action.

Verification:

- New match appears immediately after like response.
- Unmatched conversations no longer allow sending.
- Expiry state is visible enough for user understanding.

### Phase 9: Chat REST History And WebSocket Live Messages

Goal: implement reliable text chat.

Implement:

1. `GET /api/conversations`.
2. `GET /api/conversations/:id/messages`.
3. Phoenix socket connection with current access token.
4. Join `chat:{conversationId}`.
5. `send_message` event.
6. `new_message` event merge by message id.
7. Optional `typing` event.
8. Reconnect and REST backfill.

Verification:

- Opening chat loads history from REST.
- Live messages arrive via WebSocket.
- Reconnect backfills missed messages via REST.
- Expired/unmatched conversations show read-only or inactive state.

### Phase 10: Safety And Settings

Goal: make the app operable and safe enough for MVP.

Implement:

1. Block user.
2. Report user.
3. Unmatch from conversation.
4. Pause profile.
5. Resume profile.
6. Delete account.
7. Edit profile and discovery preferences.

Verification:

- Block/report removes unsafe surfaces immediately.
- Paused profile cannot browse as discoverable until restored correctly.
- Delete account clears local state and exits private shell.

### Phase 11: Push Token Registration

Goal: prepare push notifications without building full notification sending UX first.

Implement:

1. Ask permission after onboarding completion or after first match/chat value is clear.
2. Get Expo push token.
3. Register with `POST /api/me/push-token`.
4. Retry registration when token changes or app opens with a valid session.
5. Do not block core app usage if permission is denied.

Verification:

- Valid token registers successfully.
- Denied permission is handled quietly.
- Logout/session revocation prevents future sending from the old session family.

### Phase 12: Polish And Release Readiness

Goal: improve quality after the core loop works end to end.

Implement:

1. Better loading skeletons.
2. Better empty states.
3. Analytics event hooks.
4. Performance tuning for swipe and chat.
5. EAS/device testing for Apple, Google, location, R2 upload, WebSocket, and push token registration.

Verification:

- Real-device happy paths pass.
- Network failure states are understandable.
- No critical flow depends on mock data.

## First Mobile Slice To Build

Start with phases 1 and 2 only:

1. Auth/session API wrapper.
2. Bootstrap client.
3. Auth/onboarding/main routing decision.
4. Minimal placeholder onboarding and main shell screens.

Do not start UI-heavy onboarding until bootstrap routing is real.

Before building the first UI-heavy onboarding slice, establish the style tokens and shared components described in `expo-screens-stacks-style-plan.md` so the dating screens do not inherit the generic starter look.

## Deferred Until Later

These should not block the initial mobile implementation:

- full push notification sending
- notification deep links
- local offline database
- offline queued swipes or messages
- advanced photo moderation
- admin mobile UI
- monetization or subscription screens for the dating MVP
