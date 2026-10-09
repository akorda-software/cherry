# Modelo de datos

Esquema real de PostgreSQL/PostGIS, según las migraciones de `apps/backend/priv/repo/migrations/`. Convención: UUIDs como PK en las tablas de dominio (excepciones: `analytics_events` usa bigserial; `profile_tags`/`profile_blocked_tags` son join tables sin PK), timestamps en todas las tablas.

## Fundación auth (20260412195822)

Extensión `pgcrypto`. Tablas:

- `users` — cuenta canónica.
- `provider_identities` — vinculación provider ↔ user (credenciales Google/Apple).
- `devices` — dispositivos de sesión (`user_id` + `installation_id` únicos).
- `session_families` — familias de sesión device-scoped.
- `refresh_tokens` — refresh tokens opacos: `token_hash` (SHA-256 salted), `status`, `parent_token_id` (linaje para rotación y detección de reuso), `expires_at`.

## Dating foundation (20260428120000)

Extensión PostGIS + uuid-ossp. Tablas:

| Tabla | Columnas clave | Notas |
|---|---|---|
| `tags` | slug (único), label, category, sort_order, is_active, emoji | catálogo cerrado; 52 etiquetas seedeadas (`priv/repo/seeds.exs`); `sort_order` global en orden de presentación; `emoji` nullable desde 20260929114512 |
| `profiles` | user_id (FK único), display_name, birth_date, gender, bio, looking_for (text[], 1–4 intenciones, GIN), is_complete, is_discoverable, is_paused, deleted_at, completed_at, last_active_at | campos core **nullable** desde 20260429100000 (draft profiles). `completed_at`: primera vez que se completó (boost de recién llegado). `last_active_at`: última petición autenticada, escrita como mucho cada 15 min |
| `discovery_preferences` | profile_id (FK único), age_min/max (18–100, min ≤ max), distance_km (10/25/50/100/999999), show_men/show_women/show_non_binary (booleanos, ≥1 true), compatible_only, expand_distance (default true), discovery_mode* | *preferencia de presentación del cliente (swipe/feed); no afecta al ranking |
| `profile_photos` | profile_id, storage_key, url, position, is_active, storage_deleted_at | máx. 4 activas; claves nuevas aleatorias `photos/<hex>.<ext>` (las antiguas `profiles/<profile_id>/…` se conservan); al borrar la foto o la cuenta el objeto se borra físicamente y `storage_deleted_at` lo marca; `url` absoluta (R2/S3) o ruta relativa `/uploads/<storage_key>` (almacenamiento local, D-2026-09-29) que la API devuelve absoluta |
| `profile_tags` | profile_id, tag_id | únicos por par |
| `profile_blocked_tags` | profile_id, tag_id | únicos por par |
| `profile_locations` | profile_id, coordinates **geography(Point,4326)**, accuracy_meters, recorded_at | índice GiST sobre coordinates; solo última ubicación activa; CHECK `profile_locations_coordinates_point` (solo puntos WGS 84 no vacíos) |
| `swipe_actions` | actor_profile_id, target_profile_id, action_type (like/dislike) | única acción activa por par actor-target |
| `discovery_tag_weights` | generation, tag_id, profile_count, total_profiles, weight, computed_at | caché versionada de pesos IDF `ln(1 + N / (1 + n_tag))`. PK (generation, tag_id); secuencia `discovery_tag_weights_generation_seq`. Se regenera cada 15 min y se purga lo calculado hace más de 2 h, salvo la última generación |
| `matches` | profile_a_id, profile_b_id, status (active/unmatched/expired), matched_at, expires_at, first_message_at, unmatched_at | un match por pareja (índice único `idx_matches_canonical_pair` sobre `LEAST/GREATEST` de los dos perfiles). expires_at = matched_at + 30 días (`:match_expiry_days`) hasta el primer mensaje, que lo pone a NULL. La caducidad se aplica lazy en todas las lecturas (`expires_at <= now` = caducado) y `MatchExpirySweeper` pasa el status a `expired` cada hora |
| `conversations` | match_id (FK único) | sin columna status: el gate de mensajería vive en `matches.status`/`expires_at` |
| `conversation_reads` | conversation_id, profile_id, last_read_at | único por (conversation_id, profile_id); no leídos = mensajes del otro con `inserted_at > last_read_at`. Upsert que nunca retrocede |
| `messages` | conversation_id, sender_profile_id, body (1–2000) | paginado por `(inserted_at, id)`, marcas de tiempo con microsegundos desde 20260929170000; **body cifrado en reposo** (AES-256-GCM vía `Snack.Crypto`, clave en `MESSAGE_ENCRYPTION_KEY` — ver D-2026-08-21) |
| `user_blocks` | actor_profile_id, target_profile_id, reason | únicos por par |
| `reports` | reporter_profile_id, target_profile_id, reason, details, status, reviewed_at/by | revisión admin |
| `analytics_events` | profile_id/user_id, event_name, payload jsonb | append-only |

## Migraciones posteriores

| Migración | Qué añade |
|---|---|
| 20260429100000 | Campos core de `profiles` nullable para drafts |
| 20260429101000 | `profile_photo_upload_intents` — intents de subida firmados (R2/S3 o token local) con expiración y single-use |
| 20260429102000 | `push_tokens` — token Expo por sesión/plataforma/installation, estado active/inactive |
| 20260617100000 | `discovery_preferences.discovery_mode`: preferencia de presentación del cliente; no afecta al ranking |
| 20260821100000 | Cifra en reposo los cuerpos de mensaje que aún estaban en claro (D-2026-08-21); el `down` los descifra |
| 20260905170000 | Propaga los perfiles ya borrados a sus cuentas (`users.deleted_at`) y revoca sus credenciales (ver abajo) |
| 20260905170100 | Caduca los intents de subida de fotos antiguos pendientes (ver abajo) |
| 20260929113715 | Ranking de discovery v2 (D-2026-09-29): `profiles.completed_at`/`last_active_at` (backfill: `updated_at` en perfiles completos; actividad = máximo de `updated_at` y último login de dispositivo), `discovery_preferences.expand_distance`. Normaliza preferencias guardadas: distancias fuera de catálogo suben a la siguiente opción; `age_min > age_max` se intercambian. Añade el índice parcial de likes recibidos y la tabla `discovery_tag_weights` |
| 20260929114512 | `tags.emoji` (nullable) para el catálogo con emoji |
| 20260929120000 | `conversation_reads` (estado de lectura por participante) y ampliación a 30 días de los matches pendientes creados con la regla de 7 días (D-2026-09-29), solo si aún no han caducado (`expires_at > now()`: nunca resucita un match caducado). El `down` solo elimina la tabla |
| 20260929154521 | `swipe_actions_dislikes_received_index`: índice parcial para excluir del feed a quien ya dio dislike al viewer (D-2026-09-29). Sin `CONCURRENTLY` (ver [Reglas de migraciones](#reglas-de-migraciones)) |
| 20260929170000 | `messages.inserted_at`/`updated_at` y `conversation_reads.last_read_at` con microsegundos: dos mensajes del mismo segundo ya no se desordenan al recargar y un mensaje llegado en el mismo segundo en que se abre el chat no cuenta como leído |
| 20260929180000 | `profile_locations` solo admite puntos: las filas no-punto existentes pasan a su centroide en la rejilla de 500 m (las vacías se borran) y se añade el CHECK `profile_locations_coordinates_point` |
| 20260929181000 | Limpieza física de fotos: `storage_deleted_at` en `profile_photos` y `profile_photo_upload_intents`, índices para el barrido y para el límite de intents por perfil/hora. Las fotos ya inactivas o de cuentas ya borradas se limpian en el primer barrido |

## Índices y consultas prioritarias

- GiST en `profile_locations.coordinates` — candidatos por distancia (`ST_DWithin` del radio exterior del tramo).
- Índices de filtro discovery: perfiles activos/completos/no pausados. La edad se filtra como rango de `birth_date` para usar estadísticas.
- Único por par en `swipe_actions`: exclusión de ya vistos, creación de match O(1) y comprobación de «like contestado» del reparto de atención.
- `swipe_actions_likes_received_index`: `(target_profile_id, inserted_at) INCLUDE (actor_profile_id) WHERE action_type = 'like'`. Sirve para la reciprocidad, los likes pendientes de 7 días y la pestaña de likes, sin tocar el heap.
- `swipe_actions_dislikes_received_index`: `(target_profile_id, actor_profile_id) WHERE action_type = 'dislike'`. Sirve para excluir del feed a quien ya dio dislike al viewer, con un index-only scan de solo sus dislikes recibidos.
- `profile_tags(profile_id, tag_id)` / `profile_tags(tag_id)` y equivalentes en `profile_blocked_tags`: afinidad por candidato y bloqueos de etiquetas en ambas direcciones.
- `discovery_tag_weights` PK `(generation, tag_id)`: pesos de la generación fijada por el cursor.
- Lookup de matches por participante; mensajes por conversación + tiempo; reportes por status.

## Privacidad

- Solo se persiste la coordenada normalizada a la rejilla de 500 m; ninguna API devuelve coordenadas crudas.
- No loguear bodies de requests de ubicación en producción.

## Desactivación de cuentas y verificación de fotos (2026-09-05)

`users.deleted_at` impide autenticación y emisión de nuevas sesiones. La migración `20260905170000` propaga los perfiles ya borrados a sus cuentas y revoca credenciales. La eliminación mediante API actualiza cuenta/perfil/sesiones/push en una transacción. Los registros se conservan.

`20260905170100` caduca los intents de fotos antiguos pendientes: las nuevas firmas incluyen `If-None-Match: *` para impedir sustituir una foto validada. No modifica fotos ya registradas.
