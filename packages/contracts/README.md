# Contracts Package

Shared DTOs between Phoenix backend and Expo mobile.

Use this package whenever a payload crosses the backend/mobile boundary.

Current responsibilities:

- auth callback payloads
- session bundle payloads
- billing plans and subscription payloads
- runtime bootstrap config payloads

Rule: if backend and mobile disagree on a payload, fix it here first.
