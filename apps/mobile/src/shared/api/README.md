# Shared API

Reusable HTTP helpers for mobile features.

Current design:

- `json-http-client.ts` centralizes `GET`, `POST`, `PUT` and `DELETE`
- request auth headers can be injected dynamically
- `api-errors.ts` preserves response status/code/body and user-facing error copy
- `request-timeout.ts` bounds headers and body, including work that ignores abort;
  it always returns a promise, cleans up timers/listeners and optionally accepts
  an external cancellation signal
- `index.ts` preserves the public imports; defaults live in `config/performance.ts`

Timeouts must be positive timer-safe integer milliseconds. Timeout errors remain
transient `TypeError`s with `timedOut: true`; external cancellation is an
`AbortError`, and other rejections retain their original identity. A timed-out
upload may already have reached storage: this helper does not retry mutations.

Feature modules should build on this layer instead of calling `fetch()` directly.
