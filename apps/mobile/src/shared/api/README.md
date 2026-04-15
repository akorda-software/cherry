# Shared API

Reusable HTTP helpers for mobile features.

Current design:

- `createJsonHttpClient()` centralizes `GET`, `POST`, and `DELETE`
- request auth headers can be injected dynamically
- response errors preserve HTTP status for session and auth flows

Feature modules should build on this layer instead of calling `fetch()` directly.
