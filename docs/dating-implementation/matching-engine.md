# Matching Engine Spec

## Goal

Define a clear matching pipeline that is strong enough for v1 and easy to implement and tune.

## Pipeline Overview

The discovery pipeline should run in this order:

1. load viewer profile and preferences
2. confirm viewer eligibility
3. collect candidate pool with hard filters
4. apply distance fallback if supply is too low
5. compute ranking score
6. apply small exploration variance
7. return a paginated result set

## Viewer Eligibility

Before generating feed results, require:

- complete profile
- discoverable and not paused state
- valid discovery preferences
- valid current location if location is mandatory for feed access

If any of these fail, return onboarding or settings remediation state.

## Hard Filters

Candidates must satisfy:

1. candidate is discoverable and not deleted
2. candidate matches viewer's interested-in preferences
3. viewer matches candidate's interested-in preferences
4. candidate age is inside viewer age range
5. viewer age is inside candidate age range if you want full reciprocity as hard filtering, or keep this for scoring
6. candidate `what_i_am_looking_for` equals viewer `what_i_am_looking_for`
7. candidate does not have any tag in viewer blocked tags
8. candidate is not blocked either way
9. candidate has not already been actioned by viewer
10. candidate is not the viewer

Recommended v1 choice:

- Keep item 5 as score, not hard filter, unless feed quality is poor without it.

## Distance Strategy

### Base Radius

Use the viewer-selected radius as the first search boundary.

### Fallback Expansion

If too few candidates exist, widen gradually.

Suggested expansion map:

- from `10` to `25`
- from `25` to `40`, then `60`
- from `50` to `75`, then `100`
- from `100` to `150`
- from `no limit` stay unlimited

You can refine these later, but the key rule is to expand in small steps.

### Supply Threshold

The fallback should only trigger when the candidate set is below a threshold.

Suggested first-pass threshold:

- fewer than `30` candidates after hard filters

This value should be tuned later from metrics.

## Score Components

Use a simple additive score.

Suggested components:

1. positive tag overlap
2. intent reciprocity
3. reciprocal age fit
4. profile quality
5. recent activity
6. distance bonus
7. interaction quality adjustment
8. small random exploration value

## Suggested Initial Weights

These are starting points, not final truths.

- positive tag overlap: `+10` per shared tag, capped at `+50`
- candidate also prefers viewer age: `+15`
- candidate also prefers viewer gender: `+20`
- complete profile quality bonus: `+15`
- recent activity bonus: `0` to `+10`
- distance bonus: `0` to `+15`
- good interaction quality: `-10` to `+10`
- exploration noise: `0` to `+5`

Important:

- Compatibility should outweigh proximity.
- Distance should not dominate the score once the candidate is already within the acceptable radius.

## Distance Bonus Function

Avoid a harsh linear penalty.

Suggested first-pass bucket approach:

- `0-2 km`: `+15`
- `2-10 km`: `+12`
- `10-25 km`: `+8`
- `25-50 km`: `+5`
- `50-100 km`: `+2`
- beyond fallback radius: `0`

This is easier to reason about than a formula and simpler to tune.

## Profile Quality Bonus

Suggested profile quality factors:

- has 4 photos: `+5`
- bio length >= 60 chars: `+5`
- has at least 5 positive tags: `+5`

This rewards richer profiles slightly without making them mandatory beyond the minimum.

## Interaction Quality Adjustment

Only apply when enough data exists.

Minimum signal thresholds could be:

- at least `5` matches lifetime before using reply metrics
- at least `3` conversations before using ghost metrics

Possible adjustments:

- strong reply behavior: `+5` to `+10`
- weak reply behavior: `-5` to `-10`
- high report/block rate: stronger negative treatment or moderation review

## New User Boost

Suggested behavior:

- apply a `+10` to `+20` visibility boost for the first 3 days or first 50 feed impressions
- disable once behavioral data becomes available

This should affect ordering opportunity, not override hard filters.

## Exploration

Add a tiny random value after core scoring to avoid a static feed.

Rule:

- exploration never bypasses hard filters
- exploration should be small enough that obviously stronger profiles still stay near the top

## Pseudocode

```text
viewer = load_viewer(profile_id)
assert viewer.complete and viewer.discoverable

candidate_radius = viewer.distance_km
candidates = query_candidates(viewer, candidate_radius)

if count(candidates) < 30:
  candidate_radius = expand_radius(viewer.distance_km)
  candidates = query_candidates(viewer, candidate_radius)

scored = []

for candidate in candidates:
  score = 0
  score += shared_tag_score(viewer, candidate)
  score += reciprocal_gender_score(viewer, candidate)
  score += reciprocal_age_score(viewer, candidate)
  score += profile_quality_score(candidate)
  score += activity_score(candidate)
  score += distance_score(viewer, candidate)
  score += interaction_quality_score(candidate)
  score += exploration_noise()
  scored.append({candidate, score})

return paginate(sort_desc(scored, by=score))
```

## Query Strategy Notes

The candidate query should do as much filtering as possible in SQL:

- discoverable state
- deletion state
- age range
- intent equality
- blocked-tag exclusion
- swipe exclusion
- block exclusion
- geospatial radius filter

Then score in SQL or in Elixir depending on complexity and maintainability.

Recommended v1 approach:

- do filtering in SQL
- do simple scoring in SQL if practical
- move complex score shaping to Elixir only if query readability becomes poor
