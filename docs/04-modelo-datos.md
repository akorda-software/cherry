# Modelo de datos

Esquema real de PostgreSQL/PostGIS, según las migraciones de `apps/backend/priv/repo/migrations/`. Convención: UUIDs como PK en las tablas de dominio (excepciones: `analytics_events` usa bigserial; `profile_tags`/`profile_blocked_tags` son join tables sin PK), timestamps en todas las tablas.

## Fundación auth (20260412195822)

- `users` — cuenta canónica.
- `provider_identities` — vinculación provider ↔ user (credenciales Google/Apple).
- `devices` — dispositivos de sesión (`user_id` + `installation_id` únicos).
- `session_families` — familias de sesión device-scoped.
- `refresh_tokens` — refresh tokens opacos: `token_hash` (SHA-256 salted), `status`, `parent_token_id` (linaje para rotación y detección de reuso), `expires_at`.

## Dating foundation (20260428120000)

Extensión PostGIS + uuid-ossp. Tablas:

| Tabla | Columnas clave | Notas |
|---|---|---|
| `tags` | slug (único), label, category, sort_order, is_active | catálogo cerrado; 47 tags seedeados |
| `profiles` | user_id (FK único), display_name, birth_date, gender, bio, what_i_am_looking_for, is_complete, is_discoverable, is_paused, deleted_at | campos core **nullable** desde 20260429100000 (draft profiles) |
| `discovery_preferences` | profile_id (FK único), age_min/max, distance_km, show_men/show_women/show_non_binary (booleanos, ≥1 true), compatible_only, discovery_mode* | *campo añadido en 20260617100000, aún sin uso en el feed |
| `profile_photos` | profile_id, storage_key, url, position, is_active | máx. 4 activas |
| `profile_tags` | profile_id, tag_id | únicos por par |
| `profile_blocked_tags` | profile_id, tag_id | únicos por par |
| `profile_locations` | profile_id, coordinates **geography(Point,4326)**, accuracy_meters, recorded_at | índice GiST sobre coordinates; solo última ubicación activa |
| `swipe_actions` | actor_profile_id, target_profile_id, action_type (like/dislike) | única acción activa por par actor-target |
| `matches` | profile_a_id, profile_b_id, status (active/unmatched; "expired" válido pero sin asignación — la expiración se aplica lazy en lectura), matched_at, expires_at, first_message_at, unmatched_at | expires_at = matched_at + 7 días hasta primer mensaje |
| `conversations` | match_id (FK único) | sin columna status: el gate de mensajería vive en `matches.status`/`expires_at` |
| `messages` | conversation_id, sender_profile_id, body (1–2000) | paginado por inserted_at; **body cifrado en reposo** (AES-256-GCM vía `Snack.Crypto`, clave en `MESSAGE_ENCRYPTION_KEY` — ver D-2026-08-21) |
| `user_blocks` | actor_profile_id, target_profile_id, reason | únicos por par |
| `reports` | reporter_profile_id, target_profile_id, reason, details, status, reviewed_at/by | revisión admin |
| `analytics_events` | profile_id/user_id, event_name, payload jsonb | append-only |

## Migraciones posteriores

| Migración | Qué añade |
|---|---|
| 20260429100000 | Campos core de `profiles` nullable para drafts |
| 20260429101000 | `profile_photo_upload_intents` — intents firmados R2 con expiración y single-use |
| 20260429102000 | `push_tokens` — token Expo por sesión/plataforma/installation, estado active/inactive |
| 20260617100000 | `discovery_preferences.discovery_mode` (sin uso aún — ver deuda técnica) |

## Índices y consultas prioritarias

- GiST en `profile_locations.coordinates` — candidatos por distancia.
- Índices de filtro discovery: perfiles activos/completos/no pausados.
- Único por par en `swipe_actions` — exclusión de ya vistos y creación de match O(1).
- Lookup de matches por participante; mensajes por conversación + tiempo; reportes por status.

## Privacidad

- Solo se persiste la coordenada normalizada a la rejilla de 500 m; ninguna API devuelve coordenadas crudas.
- No loguear bodies de requests de ubicación en producción.

## Desactivación de cuentas y verificación de fotos (2026-09-05)

`users.deleted_at` impide autenticación y emisión de nuevas sesiones. La migración `20260905170000` propaga los perfiles ya borrados a sus cuentas y revoca credenciales. La eliminación mediante API actualiza cuenta/perfil/sesiones/push en una transacción. Los registros se conservan.

`20260905170100` caduca los intents de fotos antiguos pendientes: las nuevas firmas incluyen `If-None-Match: *` para impedir sustituir una foto validada. No modifica fotos ya registradas.
