# Shared Config

Environment and runtime configuration adapters.

## Technical performance policy

`performance.ts` contains immutable **build-time** budgets, without importing React,
Zustand or platform modules. These are not feature flags or server-authoritative
product rules. Change the named policy, run its consistency tests and rebuild the
app; do not add public environment variables for every tuning knob.

| Policy | Defaults |
| --- | --- |
| `networkPerformance` | JSON request: 20 s; binary upload: 120 s |
| `activityPerformance` | Foreground polling: 45 s; minimum refresh gap: 2 s |
| `discoveryPerformance` | Page: 20 cards; request next at 5; image lookahead: 6; stop after 3 empty pages |
| `imagePrefetchPerformance` | 128 entries; reuse: 30 s; native cache: `memory-disk` |

Feature-specific policies stay with their owners:

- `features/chat/application/chat-session-config.ts`: page size, push/typing,
  socket reconnect, outgoing retries and read receipts. Read-receipt failures use
  exponential backoff (1.5–30 s, ±20% jitter, capped at 30 s), independently of the
  400 ms success-path debounce. Visibility changes and new messages cannot bypass
  that backoff. Hidden/paused/disposed sessions do not schedule receipts.
- `features/matches/presentation/chats-presentation-config.ts`: relative-time
  clock (60 s), pagination anticipation (240 px), scroll events (200 ms).

Product limits, ranking and visibility rules remain in their domains/backend.
