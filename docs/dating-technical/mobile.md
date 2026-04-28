# Mobile Plan

## Goal

Define how the Expo client should implement the dating experience on top of the starter.

## Main Mobile Areas

The mobile app should include product modules for:

- Authentication entry and session bootstrap
- Onboarding and profile completion
- Discovery feed
- Match list
- Chat
- Settings and account controls
- Safety and reporting flows

## Onboarding Responsibilities

The mobile app should:

- Drive the multi-step onboarding flow
- Validate required fields before completion
- Request location permission at the right moment
- Handle photo selection and direct upload flow to R2
- Persist progress safely if onboarding is interrupted

## Discovery Responsibilities

The mobile app should:

- Request feed pages from backend
- Render profile cards efficiently
- Send like or dislike actions quickly
- Keep the interaction feeling responsive even when network latency exists
- Handle empty or low-supply states gracefully

## Location Responsibilities

The mobile app should:

- Request location permission clearly
- Refresh location when the app opens or returns active
- Send updated location to backend when needed
- Handle denied permissions gracefully

If location is unavailable, the product behavior must be defined explicitly during implementation.

## Chat Responsibilities

The mobile app should:

- Show active matches
- Show expiration state where relevant
- Open conversations
- Send and display text messages
- Support unmatch and safety actions from conversation context if needed

## Settings Responsibilities

The settings area should include at least:

- Edit profile
- Distance preference
- Pause profile
- Delete account
- Sign out

## State Boundaries

Suggested state separation:

- Auth and session state
- Onboarding draft state
- Discovery feed state
- Match and chat state
- Settings/profile state

Keep domain truth on the server. Client state should optimize UX, not become the source of record.

## UX Performance Expectations

The mobile app should feel fast in the areas users notice most:

- App open to feed
- Swipe response time
- Match creation feedback
- Chat send latency
- Photo upload progress and reliability

## Instrumentation

The mobile app should emit analytics events for:

- Onboarding steps
- Permission results
- Likes and dislikes
- Matches opened
- Chats started
- Safety actions initiated

Exact event naming can be finalized during implementation.
