# Mobile Shared Package

Reusable mobile-only helpers that sit above shared contracts and below app features.

Current contents:

- auth and session API clients
- runtime config API client
- profile/photos, discovery (feed, swipe, undo), likes, public profile, activity summary,
  matches, chat REST, safety and settings API clients (see `packages/contracts/CHANGELOG-v2.md`)
- feature flag reader helpers
- secure session storage helpers

Not included yet: a push-token client (`POST /api/me/push-token`) and the chat WebSocket, which lives in `apps/mobile/src/features/chat` on top of the `phoenix` client.

This package should stay reusable across multiple Expo apps built from the starter.
