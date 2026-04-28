# PRD Matching Behavior

## Goal

The matching system should feel accurate, understandable, and strong enough to make the app worth using, without becoming technically overcomplicated in the first version.

## Matching Model

The matching system is structured in layers:

1. Hard eligibility filters
2. Compatibility ranking
3. Quality adjustments
4. Controlled exploration

## Hard Eligibility Filters

These constraints must be respected first:

- Gender and mutual interest compatibility
- Age range compatibility
- Relationship intent compatibility
- Blocked tags
- Excluded profiles such as blocked, reported, or already actioned profiles

These are product guarantees, not suggestions.

## Distance Behavior

Distance is a strong preference and should usually behave like a hard filter.

However, in low-supply conditions the system may expand the search radius gradually.

Expected product behavior:

- Start with the selected radius
- If too few candidates are available, widen the search in small steps
- Avoid large abrupt jumps
- Keep local relevance as the default behavior

## Ranking Signals

After eligibility, the system should rank profiles using simple and strong signals:

- Positive tag overlap
- Mutual preference reciprocity
- Profile completeness
- Recent activity
- Distance bonus within the active search radius
- Small exploration factor

Compatibility should matter more than pure proximity.

## Reciprocity

The ranking should not only consider whether user A is likely to want user B.

It should also consider whether user B is likely to want user A.

This should improve the probability that feed impressions can become real matches.

## Exploration

The feed should not become too rigid.

Product rule:

- Most feed items should be highly relevant.
- A small percentage can come from exploratory ranking.
- Exploratory ranking must never break hard compatibility rules.

## New User Boost

New users should receive temporary visibility support because they start with no behavioral data.

Expected behavior:

- Controlled boost in the first sessions or early days
- Not strong enough to damage feed quality
- Fades out once enough data exists

## Quality Signals

Behavioral quality signals should be used carefully.

Examples:

- Reply rate
- Ghost rate
- Block rate
- Report rate

Product rules:

- Do not rely on these signals when sample size is too small.
- Use them as light adjustments in v1.
- Avoid punishing users based on noise.

## Low-Supply Behavior

The system must stay useful even with a small user base.

If there are not enough profiles:

- Expand distance gradually
- Relax ranking strictness before breaking critical constraints
- Preserve blocked-tag filtering
- Preserve core gender compatibility

## Anti-Abuse Relevance

Unlimited likes do not mean unlimited abuse.

The matching experience should remain protected from:

- Bot-like swipe velocity
- Spam account behavior
- Suspicious activity patterns

These controls should protect the feed without becoming visible product restrictions for normal users.
