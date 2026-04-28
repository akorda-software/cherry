# Technical Delivery Plan

## Goal

Break implementation into a sequence that delivers a usable product quickly without leaving critical gaps.

## Phase 1: Product Foundations

Build the minimum required to create valid users and profiles.

Includes:

- Apple and Google auth integration finalization
- Profile and preference schema
- Tag catalog support
- Photo upload flow to R2
- Onboarding API and mobile flow
- Profile completeness enforcement

## Phase 2: Discovery And Matching

Build the core app experience.

Includes:

- Location persistence with PostGIS
- Discovery query pipeline
- Swipe persistence
- Mutual match creation
- New-user boost
- Low-supply distance fallback

## Phase 3: Chat And Match Lifecycle

Make matches useful.

Includes:

- Conversation and message model
- Text-only messaging
- Match expiry after 7 days without messages
- Unmatch handling

## Phase 4: Safety, Admin, And Metrics

Make the app operable in the real world.

Includes:

- Block and report flows
- Admin review endpoints or views
- Pause profile and delete account flows
- Product event capture
- Basic operational dashboards or queries

## Phase 5: Refinement

Tune the app after end-to-end behavior exists.

Includes:

- Ranking weight tuning
- Better low-supply behavior tuning
- Analytics-based UX improvements
- Admin workflow improvements

## Delivery Rules

- Do not build advanced ranking before the basic discovery path works end to end.
- Do not delay moderation and safety until after launch.
- Keep product rules centralized in backend domain services.
- Prefer complete thin slices over isolated technical foundations with no usable feature.

## Immediate Next Technical Document Work

The next pass should expand these areas in more detail:

- Exact PostgreSQL schema proposal
- Phoenix context and module map
- API contract list by endpoint
- Discovery scoring pseudocode
- Mobile screen map and navigation flow
- Background jobs and scheduling approach
