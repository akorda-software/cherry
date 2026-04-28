# Mobile Flow Spec

## Goal

Define the concrete mobile flow and client behavior needed for implementation.

## Screen Groups

Recommended initial screen groups:

1. Auth entry
2. Onboarding
3. Discovery feed
4. Matches list
5. Conversation thread
6. Profile edit
7. Settings and account controls
8. Safety/report surfaces

## Auth Entry

Screens or actions:

- sign in with Apple
- sign in with Google

After auth:

- fetch bootstrap
- if no complete profile, route to onboarding
- otherwise route to main shell

## Onboarding Flow

Suggested step order:

1. name
2. birth date
3. gender
4. interested in
5. what I am looking for
6. bio
7. photos
8. positive tags
9. blocked tags
10. distance preference
11. location permission
12. review and finish

Implementation recommendations:

- persist draft state locally between steps
- submit each step incrementally or submit in grouped batches
- prefer grouped step submission over one giant final payload if it improves resilience

## Photo Upload Flow

Suggested sequence:

1. user selects image from device
2. mobile requests upload intent from backend
3. mobile uploads directly to R2
4. mobile calls backend completion endpoint
5. backend creates `profile_photos` row
6. mobile refreshes local photo list

The client should show:

- upload progress
- upload failure retry
- clear min/max constraints

## Location Flow

When to request permission:

- after distance preference is selected, just before finishing onboarding
- again when entering discovery if permission was denied earlier and the product requires it

Behavior:

- on app foreground/open, check whether location is stale
- if stale and permission exists, refresh and send to backend
- if permission is denied, show a product-specific blocked or degraded state

You should decide during implementation whether feed is fully blocked without location or whether a fallback mode exists.

Recommended v1 choice:

- block discovery until location is available, because distance is core product behavior

## Discovery Feed

Card should show:

- main photo
- name
- age
- bio
- intent
- tags if visible in product UI
- privacy-safe distance label

Actions:

- like
- dislike
- open profile detail if needed
- block/report from profile detail or action sheet

Client behavior:

- optimistic UI for like/dislike is fine if rollback is possible on failure
- prefetch next card batch to keep feed smooth
- handle no-results state gracefully

## Match Flow

When a match is created:

- show immediate match feedback
- allow open conversation
- add match to matches list

If no message is sent yet:

- show expiration hint or relative time if desired

## Chat Flow

Conversation thread should support:

- message list
- send text message
- unmatch action
- optional block/report access

Client rules:

- disable sending if conversation is no longer active
- handle first message transition cleanly if expiration gets cleared on send

## Settings And Account Controls

Minimum settings surfaces:

- edit profile
- edit discovery preferences
- pause profile
- resume profile
- delete account
- sign out

## Analytics Hooks

The mobile app should emit events for:

- auth success
- onboarding step viewed
- onboarding step completed
- photo upload started/completed/failed
- location permission granted/denied
- feed loaded
- like/dislike
- match shown
- conversation opened
- first message sent
