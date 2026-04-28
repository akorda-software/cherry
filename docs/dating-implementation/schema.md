# Schema Spec

## Goal

Define an initial PostgreSQL schema that is simple enough for v1 and supports the product decisions already made.

## Core Database Extensions

Required database capabilities:

- `uuid-ossp` or equivalent UUID generation support
- `postgis`

PostGIS is required for location filtering and distance calculations.

## Table Overview

Initial proposed tables:

1. `users`
2. `profiles`
3. `discovery_preferences`
4. `profile_photos`
5. `tags`
6. `profile_tags`
7. `profile_blocked_tags`
8. `profile_locations`
9. `swipe_actions`
10. `matches`
11. `conversations`
12. `messages`
13. `user_blocks`
14. `reports`
15. `analytics_events`

You may choose to fold a few of these together, but this separation is a clean starting point.

## `users`

Purpose:

- Authentication identity
- Session ownership
- Provider identity linkage

Suggested fields:

- `id uuid primary key`
- `apple_subject text null`
- `google_subject text null`
- `primary_provider text not null`
- `inserted_at utc_datetime`
- `updated_at utc_datetime`

Suggested constraints:

- unique index on `apple_subject` when not null
- unique index on `google_subject` when not null

## `profiles`

Purpose:

- Main dating-facing profile record

Suggested fields:

- `id uuid primary key`
- `user_id uuid not null references users(id)`
- `display_name text not null`
- `birth_date date not null`
- `gender text not null`
- `what_i_am_looking_for text not null`
- `bio text not null`
- `is_complete boolean not null default false`
- `is_paused boolean not null default false`
- `is_discoverable boolean not null default false`
- `deleted_at utc_datetime null`
- `inserted_at utc_datetime`
- `updated_at utc_datetime`

Suggested indexes:

- unique index on `user_id`
- partial index for discoverable active profiles

Suggested enums or allowed values:

- `gender`: `man`, `woman`, `non_binary`
- `what_i_am_looking_for`: `relationship`, `casual`, `meet_people`, `go_with_the_flow`

## `discovery_preferences`

Purpose:

- Search and visibility preferences that the user can change without mutating core profile identity

Suggested fields:

- `id uuid primary key`
- `profile_id uuid not null references profiles(id)`
- `age_min integer not null`
- `age_max integer not null`
- `distance_km integer not null`
- `show_men boolean not null default false`
- `show_women boolean not null default false`
- `show_non_binary boolean not null default false`
- `compatible_only boolean not null default false`
- `inserted_at utc_datetime`
- `updated_at utc_datetime`

Constraints:

- unique index on `profile_id`
- check constraint `age_min <= age_max`
- check constraint `distance_km in (10, 25, 50, 100, 999999)` where `999999` represents no limit, or use null for no limit

## `profile_photos`

Purpose:

- Ordered active profile photos

Suggested fields:

- `id uuid primary key`
- `profile_id uuid not null references profiles(id)`
- `storage_key text not null`
- `url text not null`
- `position integer not null`
- `is_active boolean not null default true`
- `inserted_at utc_datetime`
- `updated_at utc_datetime`

Constraints:

- unique index on `(profile_id, position)` for active photos
- check constraint on position between 1 and 4

Business rule:

- Profile completeness requires 2 to 4 active photos.

## `tags`

Purpose:

- Closed catalog of tags used by the product

Suggested fields:

- `id uuid primary key`
- `slug text not null`
- `label text not null`
- `category text not null`
- `is_active boolean not null default true`
- `sort_order integer not null default 0`
- `inserted_at utc_datetime`
- `updated_at utc_datetime`

Constraints:

- unique index on `slug`

## `profile_tags`

Purpose:

- Positive tags selected by the profile

Suggested fields:

- `profile_id uuid not null references profiles(id)`
- `tag_id uuid not null references tags(id)`
- `inserted_at utc_datetime`

Constraints:

- unique composite index on `(profile_id, tag_id)`

Business rule:

- Max 8 rows per profile.

## `profile_blocked_tags`

Purpose:

- Tags the user does not want to see in discovery

Suggested fields:

- `profile_id uuid not null references profiles(id)`
- `tag_id uuid not null references tags(id)`
- `inserted_at utc_datetime`

Constraints:

- unique composite index on `(profile_id, tag_id)`

Business rule:

- Max 5 rows per profile.

## `profile_locations`

Purpose:

- Latest known matching location for each profile

Suggested fields:

- `profile_id uuid primary key references profiles(id)`
- `coordinates geography(Point, 4326) not null`
- `accuracy_meters integer null`
- `recorded_at utc_datetime not null`
- `inserted_at utc_datetime`
- `updated_at utc_datetime`

Indexes:

- GiST index on `coordinates`
- optional index on `recorded_at`

Policy:

- Keep a single latest location row in v1.

## `swipe_actions`

Purpose:

- Persist likes and dislikes

Suggested fields:

- `id uuid primary key`
- `actor_profile_id uuid not null references profiles(id)`
- `target_profile_id uuid not null references profiles(id)`
- `action_type text not null`
- `inserted_at utc_datetime`

Constraints:

- unique index on `(actor_profile_id, target_profile_id)`
- check constraint preventing `actor_profile_id = target_profile_id`
- allowed values for `action_type`: `like`, `dislike`

Notes:

- For v1, keep only the latest action. No undo behavior is required.

## `matches`

Purpose:

- Mutual like relationship and lifecycle state

Suggested fields:

- `id uuid primary key`
- `profile_a_id uuid not null references profiles(id)`
- `profile_b_id uuid not null references profiles(id)`
- `status text not null`
- `matched_at utc_datetime not null`
- `expires_at utc_datetime null`
- `first_message_at utc_datetime null`
- `unmatched_at utc_datetime null`
- `inserted_at utc_datetime`
- `updated_at utc_datetime`

Constraints:

- unique canonical pair index using ordered profile ids
- allowed values for `status`: `active`, `expired`, `unmatched`

Policy:

- `expires_at` is set to `matched_at + 7 days`
- when first message arrives, clear `expires_at`

## `conversations`

Purpose:

- Conversation container for a match

Suggested fields:

- `id uuid primary key`
- `match_id uuid not null references matches(id)`
- `inserted_at utc_datetime`
- `updated_at utc_datetime`

Constraints:

- unique index on `match_id`

## `messages`

Purpose:

- Text messages between matched users

Suggested fields:

- `id uuid primary key`
- `conversation_id uuid not null references conversations(id)`
- `sender_profile_id uuid not null references profiles(id)`
- `body text not null`
- `inserted_at utc_datetime`
- `updated_at utc_datetime`

Constraints:

- check constraint for non-empty trimmed message body
- optional max body length constraint, for example 2000 characters

## `user_blocks`

Purpose:

- Prevent discovery and chat between two profiles

Suggested fields:

- `id uuid primary key`
- `actor_profile_id uuid not null references profiles(id)`
- `target_profile_id uuid not null references profiles(id)`
- `reason text null`
- `inserted_at utc_datetime`

Constraints:

- unique index on `(actor_profile_id, target_profile_id)`

## `reports`

Purpose:

- User-generated moderation reports

Suggested fields:

- `id uuid primary key`
- `reporter_profile_id uuid not null references profiles(id)`
- `target_profile_id uuid not null references profiles(id)`
- `reason text not null`
- `details text null`
- `status text not null default 'open'`
- `reviewed_by_user_id uuid null references users(id)`
- `reviewed_at utc_datetime null`
- `inserted_at utc_datetime`
- `updated_at utc_datetime`

Allowed statuses:

- `open`
- `reviewed`
- `dismissed`
- `actioned`

## `analytics_events`

Purpose:

- Append-only product analytics stream

Suggested fields:

- `id bigserial primary key`
- `user_id uuid null references users(id)`
- `profile_id uuid null references profiles(id)`
- `event_name text not null`
- `payload jsonb not null default '{}'::jsonb`
- `inserted_at utc_datetime`

Indexes:

- index on `event_name`
- index on `profile_id`
- index on `inserted_at`

## Completeness Rules

A profile is complete only if all of the following are true:

1. required profile fields are present
2. bio length is within range
3. 2 to 4 active photos exist
4. at least 1 interested-in option is selected
5. discovery preferences exist and are valid
6. 1 to 8 positive tags exist
7. 0 to 5 blocked tags exist
8. current location exists if location is required before browsing

## Seed Data

The initial seed plan should include:

- supported `what_i_am_looking_for` values
- initial tag catalog
- optional moderation reasons
- optional report reason catalog
