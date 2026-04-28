# Dating App Product Foundation

This document captures the current product decisions for the dating app that will be built on top of this starter. It is the source of truth for product scope before writing the technical implementation document.

## Product Goal

Build a simple dating app with very few features, fast onboarding, and a strong matching experience.

Product priorities:

- Keep the experience small and focused.
- Make profile creation fast.
- Show relevant people, not endless noisy profiles.
- Optimize for product quality and reputation, not early monetization.
- Avoid machine learning or feature sprawl in the first version.

## Product Principles

- The MVP should feel complete, not overloaded.
- Matching quality matters more than adding many features.
- Compatibility should matter more than pure proximity, but proximity must still matter.
- Hard blockers must be respected strictly.
- The app should work well in both low-supply and higher-supply environments.
- Safety, moderation, and admin tooling are part of the product, not optional extras.

## Non-Goals For The First Release

The following are intentionally out of scope for the initial release:

- Monetization
- Super likes, boosts, or premium mechanics
- Audio or video chat
- Sending images in chat
- Complex personality systems
- Machine learning ranking
- Hinge-style prompts
- Advanced verification flows

## Authentication

Initial sign-in methods:

- Sign in with Apple
- Sign in with Google

Notes:

- Email/password will not be part of v1.
- Phone auth may be added later if cost and implementation complexity are acceptable.
- The app is intended for mobile distribution, so Apple sign-in support is expected.

## User Profile

The profile should be short and mandatory enough to maintain quality.

Required fields:

- Name
- Date of birth
- Gender
- Interested in
- What I am looking for
- Bio
- Photos
- Positive tags
- Blocked tags

Field decisions:

- Age is derived from date of birth.
- Bio is required.
- Bio minimum length: 20 characters.
- Bio maximum length: 240 characters.
- Photos minimum: 2.
- Photos maximum: 4.

## Gender And Preference Model

These are separate concepts.

- `gender`: how the user identifies
- `interested_in`: who the user wants to see

`interested_in` should support multiple selections.

Initial gender options should remain small and explicit, for example:

- Man
- Woman
- Non-binary

The exact wording can be refined later, but the product model should keep `gender` and `interested_in` separate.

## Relationship Intent

`what_i_am_looking_for` is a first-class product field, not a tag.

It should be a single required value.

Initial values:

- Relationship
- Casual
- Meet people
- Go with the flow

Decision:

- Only one value is allowed.
- `Go with the flow` acts as the most flexible intent.

## Tags

Tags are part of matching, but must stay constrained.

Product decisions:

- Use a closed catalog of tags.
- Do not allow free-text tags.
- Keep the global catalog intentionally limited.
- Final catalog size target: roughly 50 to 70 tags.

Per-profile limits:

- Positive tags: maximum 8
- Blocked tags: maximum 5

Tag taxonomy design is still pending and will be documented separately before implementation.

## Location And Distance

Distance is part of the MVP because physical relevance matters in a dating product.

Product decisions:

- Use the device's current location.
- Refresh location when the user opens the app.
- Store approximate location only.
- Never expose exact coordinates to other users.

Distance options:

- 10 km
- 25 km
- 50 km
- 100 km
- No limit

User-facing distance should remain privacy-safe, for example:

- In your area
- Less than 10 km away
- 18 km away

The product should not expose exact home or live position.

## Match Rules

Core matching behavior:

- A match happens only after mutual like.
- A dislike hides the profile.
- There is no undo in v1.
- Unmatch is allowed.
- Chat becomes available only after a match.

Chat rules for v1:

- Text only
- Either user can send the first message
- No image sending
- A match expires after 7 days if nobody sends a message

## Discovery Feed Strategy

The feed must feel relevant, but not mechanically repetitive.

Principles:

- Most of the feed should be highly relevant.
- A small portion can be exploratory.
- Exploratory ranking must never break hard filters.

This balances precision with variety.

## Matching Algorithm Strategy

The first algorithm should be strong but simple.

It has three layers:

1. Eligibility filters
2. Compatibility scoring
3. Quality and behavior adjustments

### Hard Filters

The following are hard filters:

- Gender and mutual interest compatibility
- Age range
- Relationship intent (`what_i_am_looking_for`)
- Blocked tags

Distance is not a strict permanent blocker in low-supply scenarios.

Distance behavior:

- First, respect the selected radius.
- If supply is too low, expand the radius gradually.
- Do not jump immediately to very large distances.

### Score Signals

Profiles that pass hard filters should then be ranked by a simple score using signals such as:

- Positive tag overlap
- Mutual preference reciprocity
- Profile completeness
- Recent activity
- Distance bonus inside the current radius
- Small exploration factor

Important rule:

- Compatibility matters more than pure distance.

### Quality Signals

Behavioral quality should affect ranking only after enough data exists.

Examples:

- Reply rate
- Ghost rate
- Block rate
- Report rate

Decision:

- These signals should have light weight in v1.
- Do not heavily penalize users with very little data.

## Cold Start And Low Supply Strategy

The app must work when the user base is still small.

Product decisions:

- If there are too few profiles, expand distance gradually.
- If supply is still too low, relax secondary ranking pressure before relaxing critical compatibility rules.
- Never ignore blocked tags.
- Never break core gender compatibility.

This is necessary to avoid a dead feed during early growth.

## New User Boost

New users need controlled visibility to make the first session feel alive.

Decision:

- Apply a temporary ranking boost for new users.
- Keep it controlled, not extreme.
- Remove or reduce it once enough interaction data exists.

## Likes And Usage Limits

The product will not use usage caps as a monetization tool in v1.

Decisions:

- Likes are unlimited.
- The feed can continue as long as profiles exist.
- There are no product-level daily swipe caps.

However, anti-abuse protection is still required.

## Anti-Abuse Principles

The app should prevent obvious automation and spam without punishing normal usage.

Initial protection goals:

- Detect impossible swipe speed
- Rate-limit suspicious behavior
- Limit abusive account creation patterns
- Keep internal flags for suspicious users

These are technical protections, not visible monetization limits.

## Safety And Moderation

Safety must be present in the first version.

Required user actions:

- Block user
- Report user
- Hide user
- Pause profile
- Delete account

Required admin capabilities:

- Review users
- Review profiles
- Review reports
- Disable or block accounts
- Review photos when necessary

## Profile Visibility Controls

Users should have basic visibility controls in v1.

Required controls:

- Pause profile visibility
- Delete account
- Temporarily hide profile
- Option to be shown only to compatible profiles, if it remains simple enough in implementation

## Metrics And Learning

Metrics are part of the MVP because the product depends on ranking quality.

The first version should capture at least:

- Onboarding completion rate
- Profile completion rate
- Likes sent
- Matches created
- Conversations started
- First reply rate
- Retention D1 and D7
- Reports
- Blocks

These metrics are required to iterate on matching quality later.

## Infrastructure Constraints That Affect Product

These product decisions already assume the following infrastructure direction:

- Mobile app built with Expo
- Backend built with Phoenix
- Images uploaded directly to Cloudflare R2
- Backend stores image URLs, not the image files themselves
- App runs on self-hosted infrastructure with PostgreSQL

These choices support a lean MVP without introducing unnecessary product complexity.

## v1 Scope

The following belong in v1:

- Apple and Google sign-in
- Required profile creation flow
- Bio, photos, intent, and tags
- Distance-based discovery with graceful fallback
- Mutual-like matching
- Text-only chat
- Match expiration after 7 days without messages
- Unlimited likes with anti-abuse protection
- New-user boost
- Safety actions
- Basic admin moderation tools
- Basic product metrics

## v1.1 Scope

The following are planned improvements after the initial release:

- Phone authentication
- Better tag catalog tuning
- Ranking weight adjustments based on real metrics
- Better low-supply fallback tuning
- Better admin tooling
- More advanced moderation workflows
- More detailed analytics
- Optional manual search area in addition to current location

## Open Items

The following still need dedicated follow-up documents before implementation:

- Final tag catalog
- Final onboarding screen flow and copy
- Detailed ranking weights
- Technical data model
- API and backend boundaries
- Admin panel scope and implementation approach
- Privacy and legal policy content

## Summary

This product foundation defines a minimal but serious dating MVP:

- Fast onboarding
- Strong core profile signal
- Hard compatibility filters
- Good local relevance
- Simple but effective ranking
- Unlimited basic usage
- Safety and moderation from day one

The next document should translate this into a technical implementation plan without reopening the core product decisions above.
