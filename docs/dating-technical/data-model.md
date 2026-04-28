# Data Model

## Goal

Define a clean initial domain model that supports the product without overengineering.

## Core Entities

Expected first-pass entities:

- User
- Profile
- ProfilePhoto
- ProfileLocation
- Tag
- ProfileTag
- ProfileBlockedTag
- DiscoveryPreference
- SwipeAction
- Match
- Conversation
- Message
- Report
- UserBlock
- ProfileVisibilityState
- AnalyticsEvent

Exact naming can adapt to the existing backend conventions.

## User And Profile Split

The user identity record and dating profile should remain separate concepts.

Suggested split:

- `users`: authentication and account identity
- `profiles`: dating-facing profile data and status

This keeps account concerns separate from product data.

## Profile Fields

Expected profile fields:

- `user_id`
- `display_name`
- `birth_date`
- `gender`
- `bio`
- `what_i_am_looking_for`
- `is_complete`
- `is_paused`
- `deleted_at`
- timestamps

## Discovery Preferences

Preferences should be separated from the core profile when they are clearly mutable search preferences.

Suggested fields:

- `profile_id`
- `age_min`
- `age_max`
- `distance_km`
- `show_me_men`
- `show_me_women`
- `show_me_non_binary`
- timestamps

Alternative representation can use an enum array or join table if that fits existing backend style better.

## Photos

`profile_photos` should store:

- `profile_id`
- `storage_key` or equivalent asset identifier
- `url`
- `position`
- `is_active`
- timestamps

The system should enforce 2 to 4 active photos for a complete profile.

## Tags

The tag system should use a closed catalog.

`tags` should store:

- `slug`
- `label`
- `category`
- `is_active`

Positive and blocked tag selections should remain separate relationships to simplify matching and filtering.

## Location

Use a dedicated table or embedded structure for latest profile location.

Suggested location fields:

- `profile_id`
- `coordinates` as PostGIS geography or geometry point
- `accuracy_meters` if available
- `recorded_at`
- timestamps

Recommended approach:

- Use a geospatial indexed point column
- Keep only the latest active location for matching initially
- Optionally retain location history later if needed for debugging or analytics

## Swipes

Swipes should be persisted because they drive both feed exclusions and match creation.

Suggested fields:

- `actor_profile_id`
- `target_profile_id`
- `action_type` such as like or dislike
- `inserted_at`

Likely constraints:

- Unique active action per actor-target pair, depending on update strategy

## Matches And Conversations

Suggested approach:

- `matches` stores the mutual match relationship and lifecycle state
- `conversations` can be 1:1 with matches for v1
- `messages` belongs to conversations

Important match fields:

- `profile_a_id`
- `profile_b_id`
- `expires_at`
- `first_message_at`
- `unmatched_at`
- timestamps

## Moderation Entities

At minimum:

- `reports`
- `user_blocks`

Possible report fields:

- `reporter_profile_id`
- `target_profile_id`
- `reason`
- `details`
- `status`
- `reviewed_at`
- `reviewed_by`

## Visibility State

Profile visibility can be represented either as fields on `profiles` or as a separate state table if lifecycle complexity grows.

For the MVP, fields on `profiles` may be enough:

- `is_paused`
- `is_discoverable`
- `deleted_at`

## Analytics Events

The simplest implementation may use an append-only events table.

Candidate fields:

- `profile_id` or `user_id`
- `event_name`
- `payload`
- `inserted_at`

This can later be exported or summarized into reporting tables.

## Indexing Priorities

The initial database design should prioritize indexes for:

- Geospatial candidate lookup
- Active profile discovery filters
- Swipe existence checks
- Match lookup by participant
- Conversation messages by conversation and time
- Reports by status
