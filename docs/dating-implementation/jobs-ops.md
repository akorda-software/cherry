# Jobs And Operations Spec

## Goal

Define the non-request-time operational behavior required for the MVP.

## Background Jobs

### Match Expiration Job

Responsibility:

- find active matches where `expires_at <= now()` and `first_message_at is null`
- mark them expired

Suggested frequency:

- every 15 minutes

### Analytics Aggregation Job

Responsibility:

- roll up raw event data into reporting-friendly tables or dashboards if needed

Suggested frequency:

- hourly or daily depending on volume

### Moderation Queue Support

Responsibility:

- surface open reports in ordered review queues
- optionally detect repeated reports against the same profile

This may start as query support rather than a true job.

## Operational Dashboards Or Queries

The MVP should make it easy to answer:

1. how many users completed onboarding
2. how many discoverable profiles exist
3. how many likes were sent today
4. how many matches were created today
5. how many matches became conversations
6. how many reports are still open
7. how many users are paused or disabled

## Moderation Operations

At minimum, internal operations must support:

- inspect a reported profile
- see report history
- disable or re-enable a profile
- understand recent moderation actions

## Rollout Notes

Suggested rollout order:

1. complete profile creation and discovery end-to-end
2. complete mutual match and chat lifecycle
3. complete safety tooling
4. validate metrics and moderation visibility

## Implementation Guidance

- Keep scheduled jobs simple in v1.
- Avoid premature feed precomputation unless request-time ranking is clearly too slow.
- Prefer database indexes and careful filtering before introducing architectural complexity.
- Add observability around feed latency and match creation latency early.

## Early Performance Watchpoints

Watch these first:

- discovery query latency
- geospatial filtering performance
- swipe write throughput
- match creation correctness under concurrent likes
- message send latency
- photo upload completion reliability

## Early Abuse Watchpoints

Track suspicious patterns such as:

- very high swipe velocity
- repeated account creation from same device or network if available
- unusual report concentration on a profile
- spammy first-message patterns
