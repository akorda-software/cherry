# Technical Architecture

## Goal

Build the dating app on top of the current Expo + Phoenix starter while keeping architecture simple, scalable, and aligned with the product's narrow scope.

## Core Stack

- Mobile app: Expo
- Backend API: Phoenix
- Database: PostgreSQL
- Geospatial support: PostGIS
- Image storage: Cloudflare R2

## Architectural Principles

- Keep the core domain logic on the backend.
- Keep the mobile app focused on presentation, local state, and device capabilities.
- Store image files outside the backend and persist only URLs and metadata in the database.
- Prefer explicit domain models over ad hoc ranking logic spread across controllers.
- Design for low complexity first, then tune based on metrics.

## Main System Responsibilities

### Mobile

- Authenticate users with Apple or Google
- Drive onboarding flow
- Request and refresh device location
- Upload images directly to R2 through backend-issued upload flows
- Render feed, match list, and chat
- Send user actions such as like, dislike, block, report, pause profile, and delete account

### Backend

- Resolve identity and session management
- Persist profile and preference state
- Persist location and geospatial search data
- Build discovery candidate sets
- Rank candidates
- Create matches on mutual like
- Manage chat threads and messages
- Enforce moderation and visibility rules
- Collect analytics events and operational metrics

## Discovery Pipeline Shape

The feed generation pipeline should follow this high-level order:

1. Load viewer profile and preferences
2. Build candidate pool using hard filters
3. Apply radius and low-supply fallback logic
4. Score remaining candidates
5. Shuffle lightly within score bands if needed
6. Return a paginated feed slice

This should live as backend domain logic, not as ad hoc controller code.

## Geospatial Strategy

PostGIS is the preferred approach for location filtering and ranking.

Reasons:

- Good support for radius queries
- Strong indexing support
- Avoids custom approximate geo math in application code
- Good long-term fit for scaling beyond the earliest phase

Location policy:

- Update on app open
- Store latest location snapshot
- Use approximate user-visible distance output
- Never expose raw coordinates to other users

## Media Strategy

Images should not flow through the backend as binary uploads when avoidable.

Preferred flow:

1. Mobile requests an upload intent or signed upload data
2. Mobile uploads directly to R2
3. Backend stores resulting asset URL and metadata

This keeps backend resource usage lower and simplifies scaling.

## Admin And Moderation Boundary

Moderation is operationally required from the start.

At minimum, the system must support:

- Report review
- User lookup
- Profile lookup
- Account disabling
- Photo review when necessary

This can start as backend-first tooling and evolve into a better admin surface later.

## Analytics Boundary

The system should record product and moderation-relevant events early.

Examples:

- Onboarding milestones
- Likes and dislikes
- Match creation
- Conversation start
- First reply
- Report and block actions

These events should support both product tuning and operational review.
