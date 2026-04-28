# PRD Experience Flows

## Overview

This document describes the expected user experience for the main product flows.

## Authentication Flow

The user can sign in using:

- Apple
- Google

Expected behavior:

- Sign-in should be quick and low-friction.
- The user should not need to create a password.
- A newly authenticated user without a completed profile should be pushed into onboarding immediately.

## Onboarding Flow

The onboarding should be short and mandatory.

Suggested flow order:

1. Authentication completed
2. Name
3. Date of birth
4. Gender
5. Interested in
6. What I am looking for
7. Bio
8. Photo upload
9. Positive tags
10. Blocked tags
11. Distance preference
12. Location permission
13. Finish and enter feed

Principles:

- The user should always understand why a field matters.
- The flow should feel finite and lightweight.
- Validation should happen inline.
- The user should not reach the feed with an incomplete low-quality profile.

## Profile Rules

The profile must include:

- Name
- Date of birth
- Gender
- Interested in
- What I am looking for
- Bio with minimum 20 and maximum 240 characters
- 2 to 4 photos
- Up to 8 positive tags
- Up to 5 blocked tags

Expected UX behavior:

- Photo upload should clearly show minimum and maximum requirements.
- Bio should encourage short, useful descriptions.
- Tag selection should be searchable or grouped cleanly if needed.

## Discovery Feed Flow

The discovery feed is the main product surface.

The user should be able to:

- Browse profiles one by one
- Like or dislike profiles
- Continue browsing without artificial daily caps
- Trust that profiles broadly fit their hard preferences

Expected feed behavior:

- Profiles should mostly respect the preferred distance.
- Profiles should strongly match gender, age, intent, and blocked-tag constraints.
- The feed should remain fresh enough to avoid repetition.

## Match Flow

When two users like each other:

- A match is created
- Both users can access a chat thread
- Either user can send the first message

If neither user sends a message:

- The match expires after 7 days

The product should communicate this clearly enough that users understand matches are not permanent if ignored.

## Chat Flow

The chat in v1 is intentionally narrow.

Rules:

- Text only
- No image sending
- No audio
- No video
- Unmatch is allowed

The chat exists to validate the match and support the simplest path to conversation.

## Safety Flow

At any relevant point, the user should be able to:

- Block another user
- Report another user
- Hide another user
- Unmatch another user

The user should also be able to:

- Pause their own profile
- Delete their account

These flows should be accessible, not hidden behind confusing navigation.

## Visibility Flow

Users need basic control over whether they are visible in the app.

Required capabilities:

- Pause visibility temporarily
- Delete account
- Optionally hide profile while still keeping the account

The exact final UX can be refined later, but these controls are part of the product scope.

## Metrics-Relevant Experience Events

The product should be instrumented to observe key flow steps, including:

- Sign-in success
- Onboarding started
- Onboarding completed
- Profile completeness reached
- Like sent
- Match created
- Chat started
- First reply sent
- Report submitted
- Account paused or deleted
