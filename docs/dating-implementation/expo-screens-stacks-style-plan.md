# Expo Screens, Stacks, And Style Plan

## Purpose

Define the concrete Expo Router structure, first mobile screens, user flows, and visual direction before building the dating UI.

This document is the implementation companion to `mobile-implementation-plan.md`. It translates backend contracts into mobile navigation and screen work.

## Current Foundation

The Expo app already has these route groups:

- `app/(public)` for signed-out screens.
- `app/(onboarding)` for authenticated users whose backend bootstrap says onboarding is required.
- `app/(app)` for complete authenticated users.
- `app/(app)/(tabs)` for the private tab shell.

The root route already decides between public login, onboarding, and the private app using session state plus `GET /api/bootstrap`.

The existing UI foundation already has theme tokens and primitives under `apps/mobile/src/shared/ui`. Use that system rather than creating ad-hoc styles inside screens.

## Navigation Principles

- Backend bootstrap is the source of routing truth.
- Expo Router route groups should mirror product state, not backend modules.
- Each product area gets a route group or stack only when it needs independent navigation depth.
- Tabs are for daily core surfaces only, not onboarding, settings detail, or modals.
- Modal routes are reserved for focused, reversible actions like match celebration, report, block confirmation, and photo actions.
- Deep links should target stable product entities: profile, match, conversation, settings.

## Proposed Route Tree

```text
app/
  _layout.tsx
  index.tsx
  (public)/
    _layout.tsx
    login.tsx
  (onboarding)/
    _layout.tsx
    index.tsx
    name.tsx
    birth-date.tsx
    gender.tsx
    interested-in.tsx
    intent.tsx
    bio.tsx
    tags.tsx
    blocked-tags.tsx
    distance.tsx
    location.tsx
    photos.tsx
    review.tsx
  (app)/
    _layout.tsx
    (tabs)/
      _layout.tsx
      discover.tsx
      matches.tsx
      profile.tsx
    profile/[profileId].tsx
    match/[matchId].tsx
    conversation/[conversationId].tsx
    edit-profile.tsx
    discovery-preferences.tsx
    safety/report/[profileId].tsx
    safety/block/[profileId].tsx
    settings.tsx
    subscriptions.tsx
```

The existing `home.tsx` tab should become `discover.tsx` when the discovery feed is implemented. Keep a redirect or temporary file only if needed during migration.

## Stack Ownership

### Public Stack

Purpose: signed-out entry only.

Screens:

- `login`: brand intro, Sign in with Apple, Sign in with Google, terms/privacy links, non-blocking auth errors.

Routing rules:

- If a valid session is restored, redirect to root bootstrap decision.
- If provider auth succeeds, persist the Phoenix session and refetch bootstrap.

### Onboarding Stack

Purpose: create a backend draft profile and complete all required profile gates.

Screens:

- `index`: resolver that redirects to backend `nextOnboardingStep`.
- `name`: display name.
- `birth-date`: age gate and birth date.
- `gender`: own gender.
- `interested-in`: discovery gender preferences.
- `intent`: relationship intent.
- `bio`: profile bio with character limits.
- `tags`: positive tags.
- `blocked-tags`: tag exclusions.
- `distance`: max distance preference.
- `location`: permission explanation, native permission request, backend location update.
- `photos`: image picker, compression, R2 upload intent, direct upload, completion.
- `review`: final validation and `POST /api/me/profile/complete`.

Routing rules:

- Every step saves to backend before advancing.
- Step success updates local bootstrap/profile cache.
- Root onboarding route resumes at backend `nextOnboardingStep`.
- Back navigation is allowed for editable profile steps.
- Location denial and photo upload failure keep the user in onboarding with remediation UI.
- Completion success refreshes bootstrap and routes to `/(app)/(tabs)/discover`.

### Private App Stack

Purpose: complete authenticated users.

Screens:

- Tabs: `discover`, `matches`, `profile`.
- Push screens: profile detail, match detail, conversation, edit profile, preferences, settings.
- Modal-like screens: report, block, match celebration if implemented as route.

Routing rules:

- If bootstrap later reports `onboardingRequired`, redirect back to onboarding.
- If session refresh fails, clear local session and route to public login.
- If profile is paused, allow private shell but show paused state and block feed interactions.

## Tab Design

### Discover Tab

Primary daily surface.

Screen states:

- loading first page.
- card stack ready.
- optimistic swipe in progress.
- match created.
- empty feed.
- profile incomplete fallback.
- profile paused fallback.
- location required fallback.
- offline/network error.

Core actions:

- like.
- dislike.
- open profile detail.
- report or block from profile detail/action sheet.

Backend endpoints:

- `GET /api/discovery/feed`.
- `POST /api/discovery/actions`.
- `POST /api/users/:profile_id/report`.
- `POST /api/users/:profile_id/block`.

### Matches Tab

Purpose: active match list and entry to chat.

Screen states:

- active matches.
- match with expiration before first message.
- empty matches.
- loading/error.

Core actions:

- open match detail.
- open conversation.
- unmatch.

Backend endpoints:

- `GET /api/matches`.
- `POST /api/matches/:id/unmatch`.
- `GET /api/conversations`.

### Profile Tab

Purpose: current user profile and settings entry.

Screen states:

- profile summary.
- paused visibility state.
- completion/regression warning if backend marks profile incomplete after edits.

Core actions:

- edit profile.
- edit preferences.
- manage photos.
- settings.
- pause/unpause.

Backend endpoints:

- `GET /api/me/profile`.
- `PUT /api/me/profile`.
- `GET /api/me/photos`.
- `DELETE /api/me/photos/:id`.
- `POST /api/me/pause`.
- `POST /api/me/unpause`.

## Detail And Modal Screens

### Profile Detail

Use for discovery candidates and match counterpart profiles.

Content:

- photo carousel.
- display name and age.
- distance label.
- bio.
- intent.
- visible tags.
- safety actions.

Do not show exact coordinates, internal blocked tags, moderation metadata, or backend scoring internals.

### Match Detail

Use when a match is created or opened before chat.

Content:

- other profile summary.
- match expiration hint.
- primary action to send/open message.
- unmatch action.

### Conversation

Use REST for history and Phoenix WebSocket for live delivery.

Required behavior:

- load messages with `GET /api/conversations/:id/messages` on open.
- connect `/socket/websocket?token=<accessToken>`.
- join `chat:{conversationId}`.
- merge `new_message` by message id.
- backfill after reconnect.
- disable composer when conversation is inactive.

### Report And Block

Report should collect a reason and optional details.

Block should be a short confirmation with immediate UI removal after success.

Both should be reachable from discovery profile detail and conversation context.

## Required User Flows

### Cold App Open

1. Restore secure session.
2. Refresh access token if needed.
3. Fetch `/api/bootstrap`.
4. Route to public, onboarding, or private app.

### New User Onboarding

1. User signs in.
2. Root fetches bootstrap.
3. Onboarding resolver routes to `name`.
4. User completes steps, each saved to backend.
5. User uploads 2 to 4 photos via R2 direct upload.
6. User grants location and backend stores approximate location.
7. Review calls completion endpoint.
8. Success refreshes bootstrap and opens Discover tab.

### Returning Incomplete User

1. Restore session.
2. Fetch bootstrap.
3. Onboarding resolver reads `nextOnboardingStep`.
4. User resumes from server truth.

### Discovery To Match

1. Discover loads feed.
2. User likes profile.
3. Backend returns `matchCreated` false or true.
4. False removes the card.
5. True shows match celebration and allows opening conversation.

### Chat

1. User opens match/conversation.
2. App loads REST history.
3. App joins Phoenix channel.
4. User sends messages via WebSocket or REST fallback if needed.
5. Reconnect triggers REST backfill.

### Safety

1. User opens profile action sheet.
2. User chooses report or block.
3. App submits backend action.
4. App removes unsafe profile/conversation surfaces locally.
5. App refreshes current feed or matches as needed.

### Settings And Account

1. User opens settings.
2. User can pause/unpause, edit profile, edit discovery preferences, delete account, or sign out.
3. Delete account clears local session after backend success.

## Visual Direction

### Product Feel

Snack should feel warm, social, fast, and slightly playful, not like a generic blue SaaS starter.

Target qualities:

- Human and direct.
- Photo-first but not visually noisy.
- Confident safety affordances.
- Fast tactile interactions.
- Premium enough for dating, casual enough for daily use.

Avoid:

- Corporate blue dominance.
- Generic white cards over gray backgrounds everywhere.
- Overly childish gradients.
- Hidden safety actions.
- Dense forms that feel like admin software.

### Style System Direction

Use the existing theme/token structure, but evolve the dating UI toward this palette:

```text
Ink:        #211A1D
Cream:      #FFF7ED
Paper:      #FFFCF7
Coral:      #FF5A5F
Tomato:     #E63B46
Apricot:    #FFB86B
Mint:       #7BDCB5
Lavender:   #B7A7FF
Slate:      #6F6A72
Line:       #E8D8CC
Danger:     #D92D20
Success:    #168A5B
```

Recommended semantic mapping:

- screen background: `Cream`.
- base surface: `Paper`.
- primary action: `Coral`.
- primary pressed state: `Tomato`.
- secondary action: `Ink` on `Paper` with `Line` border.
- positive/social accent: `Mint`.
- premium/boost accent: `Lavender`.
- destructive action: `Danger`.
- muted text: `Slate`.

### Typography

Use system fonts for v1 unless a brand font is intentionally added later.

Type scale:

- display: 40/44, weight 800, used only on login and match celebration.
- title: 30/36, weight 750, screen headers.
- section: 22/28, weight 700, card and form section titles.
- body: 16/23, weight 400, default content.
- body strong: 16/23, weight 650, labels and key values.
- caption: 13/18, weight 500, hints and metadata.
- micro: 11/14, weight 700, pills and counters.

### Layout And Components

Spacing should use an 8-point rhythm.

Recommended defaults:

- screen horizontal padding: 20.
- onboarding max content width on tablets/web: 520.
- card radius: 28.
- input radius: 18.
- button radius: pill.
- bottom tab height: 68 to 74.
- primary touch target: at least 48 high.
- photo card aspect: 4:5 for discovery, square thumbnails for onboarding.

Core components to establish before feature screens:

- `SnackScreen` with safe area, background, and scroll behavior variants.
- `SnackHeader` with title, subtitle, back/action slots.
- `PrimaryButton`, `SecondaryButton`, `GhostButton`, `DangerButton`.
- `ChoicePill` for onboarding selections.
- `ProgressHeader` for onboarding step count.
- `PhotoTile` with upload, progress, retry, delete states.
- `DiscoveryCard` for feed cards.
- `ProfileFactPill` for age, intent, distance, tags.
- `ActionSheet` for report/block/unmatch.
- `EmptyState` variants for feed, matches, chat, paused, location required.

### Motion And Interaction

Use motion where it clarifies state, not as decoration.

Recommended interactions:

- card swipe/remove animation under 220ms.
- match celebration with one strong animation, then stable CTA.
- optimistic like/dislike with rollback if backend fails.
- upload progress visible per photo tile.
- button pressed opacity or scale feedback.
- reduce motion support should disable decorative movement.

### Accessibility

Minimum requirements:

- all touch targets at least 48dp.
- labels for icon-only buttons.
- color never the only signal for error/success.
- readable contrast on `Coral`, `Mint`, and `Lavender` accents.
- dynamic type should not break onboarding steps.

## Implementation Order For Screens

1. Update theme tokens and shared components to match the visual direction.
2. Replace generic tab labels with dating tabs: Discover, Matches, Profile.
3. Implement onboarding resolver and the first core field steps.
4. Implement profile preferences, location, photos, and review.
5. Implement Discover tab with backend feed and action states.
6. Implement Match flow and conversation routes.
7. Implement Profile/settings/safety surfaces.
8. Add push permission/token registration after core value is visible.

## Verification Checklist

- New user routes to onboarding from backend bootstrap.
- Incomplete returning user resumes from backend `nextOnboardingStep`.
- Complete user routes to Discover.
- Paused user can enter app but sees paused feed state.
- Denied location blocks completion with remediation.
- R2 upload failures do not create photo rows.
- Match creation can open chat immediately.
- WebSocket reconnect backfills messages via REST.
- Report/block removes profiles from local UI immediately after backend success.
- All primary screens render acceptably on small iPhone, large iPhone, Android emulator, and web if web remains supported.
