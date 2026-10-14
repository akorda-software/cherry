# Modelo de dominio

Entidades del dominio, sus ciclos de vida e invariantes. El detalle físico de tablas está en `04-modelo-datos.md`.

## Identidad y sesión (starter)

- **User** — cuenta canónica. Se crea/resuelve al validar una credencial de provider; sin duplicados por identidad.
- **ProviderIdentity** — vinculación user ↔ provider (Google/Apple) con credenciales de prueba.
- **Device** — dispositivo desde el que se autentica la sesión.
- **SessionFamily + RefreshToken** — familia de sesión device-scoped: access token corto + refresh tokens rotatorios con linaje (`parent_token_id`).

Invariantes:

- Phoenix es el único emisor de sesión de app; los providers nunca lo son.
- Un refresh token usado dos veces revoca toda su familia (detección de robo).
- Logout revoca la sesión del dispositivo y limpia el secure storage.

## Dating

### Perfil

- **Profile** — datos de dating del usuario. Ciclo de vida:
  1. *No existe* → usuario recién autenticado.
  2. *Draft* (`is_complete = false`, `is_discoverable = false`) → primer write de onboarding crea el borrador; campos core nullable; actualización incremental por pasos.
  3. *Completo* (`is_complete = true`) → solo tras `complete_profile` validando todos los requisitos server-side; pasa a `is_discoverable = true` salvo pausa/borrado.
  4. *Pausado* (`is_paused = true`) → no descubrible, conservando el perfil; tampoco puede hacer swipe ni deshacer, pero sigue viendo sus matches y chats.
  5. *Borrado* (`deleted_at`) → soft-delete del perfil y de la cuenta (`users.deleted_at`): sesiones y tokens push revocados, sockets desconectados y fotos borradas físicamente del almacenamiento. El resto de registros se conserva. `users.deletion_reason` dice por qué: `user_request` si lo pidió la persona desde la app; con ese motivo, volver a entrar con la misma cuenta de Google/Apple borra del todo la anterior (`purge_account/1`) y empieza una cuenta nueva desde cero. Con cualquier otro motivo (moderación, cuando exista) el login sigue bloqueado.

Invariantes: los drafts jamás aparecen en discovery; la completitud solo la valida el backend; `nextOnboardingStep` es conveniencia de UI, no frontera de seguridad.

- **DiscoveryPreference** — edad min/max (18–100), distancia (10/25/50/100 km o sin límite), a quién quiere ver (`show_men`/`show_women`/`show_non_binary`), `compatible_only`, `expand_distance` y `discovery_mode` (preferencia de presentación del cliente, swipe o feed; no afecta al ranking). Se valida en cada guardado.
- **ProfilePhoto** — metadatos de foto (storage_key, url, position, is_active, storage_deleted_at) en R2/S3 o en el almacenamiento local. Máx. 4 activas; 2–4 requeridas para completar. Al borrar la foto o la cuenta, el objeto se borra físicamente.
- **PhotoUploadIntent** — intención firmada de subida (URL prefirmada R2/S3 o token local) con expiración de 600 s; single-use. El binario espera en una zona no pública (`pending/`) hasta `complete`. Máx. 4 vivas por perfil y 20 por hora.
- **Tag / ProfileTag / ProfileBlockedTag** — catálogo cerrado + relaciones separadas positivos/bloqueados (máx. 8 / 5).
- **ProfileLocation** — última ubicación aproximada (rejilla 500 m) como punto PostGIS; como mucho una actualización por minuto.

El perfil guarda además `completed_at` (primera vez que se completó; da el impulso de recién llegado durante 7 días) y `last_active_at` (última petición autenticada, como mucho cada 15 min; alimenta la puntuación por actividad).

### Discovery y matching

- **SwipeAction** — like/dislike de actor sobre target. Única acción activa por par actor-target. Dislike = ocultación (no hay estado «hide» separado). Bloquea self-action. El último dislike de menos de 10 minutos se puede deshacer (se borra el swipe). Un like sin responder aparece en la pestaña Likes de la otra persona.
- **DiscoveryTagWeight** — caché versionada de pesos IDF por etiqueta (una generación cada 15 min) para la afinidad del ranking; el cursor del feed fija la generación.
- **Match** — se crea cuando existe like mutuo. Estados:
  - *Active*: con `expires_at = matched_at + 30 días` (`:match_expiry_days`) hasta el primer mensaje.
  - *Chateado* (estado lógico; `status` sigue "active"): primer mensaje fija `first_message_at` y limpia `expires_at`.
  - *Unmatched*: cualquiera de los participantes puede cerrarlo; la conversación deja de permitir mensajear.
  - *Expired*: `expires_at` vencido sin mensajes. Se aplica lazy en todas las lecturas y en la mensajería; `MatchExpirySweeper` pasa el `status` a `expired` cada hora.
- **Conversation** — 1:1 con el match; se crea junto al match.
- **Message** — texto 1–2000 chars, cifrado en reposo; solo participantes de match activo. Marcas de tiempo con microsegundos para un orden estable.
- **ConversationRead** — última lectura de una conversación por participante; define `unreadCount` y los badges.

### Seguridad

- **UserBlock** — bloqueo entre perfiles: oculta en ambas direcciones el feed, los likes, el perfil público, los matches y las conversaciones, y cierra la mensajería (REST y WebSocket, también en sockets ya conectados).
- **Report** — reporte de moderación con reason/details/status para revisión admin (idempotente mientras haya uno abierto del mismo reporter sobre el mismo perfil). Aún no hay panel de administración.

### Métricas

- **AnalyticsEvent** — tabla append-only de eventos de producto. Existe `Cherry.Dating.track_event/1`, pero hoy nada lo llama (ver `11-deuda-tecnica-pendiente.md`).

## Push

- **PushToken** — token Expo por sesión/dispositivo con estado active/inactive; re-registro desactiva duplicados. El backend envía push de match nuevo y mensaje nuevo a los tokens activos, pero la app móvil todavía no registra ninguno.
