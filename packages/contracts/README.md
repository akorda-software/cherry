# Contracts Package

Shared DTOs between Phoenix backend and Expo mobile.

Use this package whenever a payload crosses the backend/mobile boundary.

Current responsibilities:

- auth callback payloads
- session bundle payloads
- runtime bootstrap config payloads
- profile, photos, tags and discovery payloads
- social payloads: received likes, public profile, activity summary, matches, chat and safety

API v2 (2026-09-29) summary for mobile: `CHANGELOG-v2.md`.

Rule: if backend and mobile disagree on a payload, fix it here first.
