# API del backend

Superficie REST y WebSocket **implementada** en `apps/backend` (fuente: `lib/snack_web/router.ex`). Contratos de payload en detalle: `06-contratos-mobile-backend.md`. OpenAPI machine-readable servida en `/openapi.yaml`.

Pipelines: `:api` (público), `:authenticated_api` (valida JWT + expiración + familia de sesión no revocada, y registra la actividad del perfil en `last_active_at` como mucho cada 15 min — `SnackWeb.Plugs.TrackActivity`).

## Auth y sesión (público)

| Ruta | Descripción |
|---|---|
| `POST /api/auth/:provider/callback` | Callback Google/Apple; valida credencial, resuelve/crea usuario, emite sesión |
| `POST /api/auth/dev/test-login` | Solo dev (`:enable_dev_test_login`): login sin providers nativos. Body opcional: `{}` → usuario de prueba compartido; `{email, displayName?}` → entra como esa persona (la crea si no existe; así se usan las cuentas de `demo_seeds.exs`); `device` opcional y puede ser parcial. 422 `invalid_email`, 403 `account_deleted`, 404 si está desactivado |
| `POST /api/session/refresh` | Rotación de refresh token; reuso revoca la familia |
| `DELETE /api/session` | Logout device-scoped |
| `GET /api/config` | Runtime config + feature flags para el móvil |

## Bootstrap

| Ruta | Descripción |
|---|---|
| `GET /api/bootstrap` | Usuario + estado de perfil (`exists`, `isComplete`, `isDiscoverable`, `isPaused`, `onboardingRequired`, `nextOnboardingStep`). Fuente de routing del móvil |

## Perfil y onboarding (`/api/me/*`, autenticado)

| Ruta | Reglas de servidor |
|---|---|
| `GET /api/me/profile` | Draft o perfil completo con fotos, tags y preferencias |
| `PUT /api/me/profile` | Upsert de draft (campos core); validación por campo |
| `POST /api/me/profile/complete` | Valida TODO server-side; si falta algo → `profile_incomplete` + `missing[]` + `nextOnboardingStep`; si ok → `is_complete = true` y `is_discoverable = true` salvo perfil pausado o borrado |
| `GET/PUT /api/me/discovery-preferences` | En cada PUT, también parcial, se valida el valor resultante: edades en [18,100] con `age_min ≤ age_max`, `distance_km` ∈ {10, 25, 50, 100, 999999 (sin límite)} y ≥1 interested-in. Errores 422 `{errors: {campo: [mensaje]}}`, sin guardar nada. Campos opcionales: `compatible_only`, `expand_distance` (default `true`) y `discovery_mode` (solo presentación) |
| `GET /api/me/photos` · `DELETE /api/me/photos/:id` | Lista (URLs absolutas) / desactiva foto (`{ok: true}`; 404 `photo_not_found`) |
| `POST /api/me/photos/upload-intent` | URL de subida de un solo uso según `STORAGE_ADAPTER`: local → `PUT /api/uploads/:token` firmado; R2/S3 → URL SigV4 prefirmada. Content-type jpeg/png/webp, máx. 2 MB, intent expira en 600 s; 503 `storage_not_configured` sin almacenamiento |
| `POST /api/me/photos/complete` | Valida intent no expirado/no usado + key/URL/content-type coincidentes y verifica el objeto (existencia, tamaño, MIME, cabecera binaria); posición y URL salen del intent (el body no las modifica). Máx. 4 activas |
| `PUT /api/me/photos/order` | `{photoIds}` con todas las fotos activas exactamente una vez → posiciones 1..n; responde `{photos}`. 422 `invalid_photo_ids` |
| `GET/PUT /api/me/tags` | Reemplaza positivos (`tag_ids`); máx. 8 (`too_many_tags`); IDs desconocidos, mal formados o inactivos → 422 `invalid_tags` + `tagIds`; etiqueta ya bloqueada → 422 `tag_conflict` + `tagIds`; duplicados ignorados |
| `GET/PUT /api/me/blocked-tags` | Reemplaza bloqueados; máx. 5 (`too_many_blocked_tags`); mismas validaciones (`tag_conflict` si es positiva) |
| `POST /api/me/location` | Payload `latitude/longitude/accuracyMeters/recordedAt`; normaliza a rejilla 500 m antes de guardar |
| `POST /api/me/push-token` | Registro de token Expo ligado a la sesión; upsert + desactiva duplicados |

## Discovery (autenticado)

| Ruta | Reglas de servidor |
|---|---|
| `GET /api/discovery/feed?cursor&limit` | Exige perfil completo y descubrible (si no → 403 `profile_incomplete` con `onboardingRequired: true` + `nextOnboardingStep`, o 403 `profile_paused` si está en pausa); ranking v2 en PostgreSQL (`Snack.Dating.Discovery`, D-2026-09-29). Los filtros duros se reevalúan en cada página: bloqueos y etiquetas bloqueadas en ambas direcciones, género/edad recíprocos, matriz de intención simétrica, `compatible_only` de cualquiera de los dos, cuentas y perfiles vivos y ya swipeados. Se excluye también a quien ya dio dislike al viewer: su like no se vería nunca, porque la pestaña de likes solo lista likes sin responder. Si deshace ese dislike (`POST /api/discovery/undo` borra el swipe), vuelve a aparecer. Puntuación: afinidad IDF 0–45, intención +10/+4, reciprocidad +12, recién llegado ≤ +8, actividad +8/+5/+2, distancia 0–10, exploración 0–4 y reparto de atención −0..6. Orden `tier ASC, score DESC, id ASC`: el tramo 2 (entre el radio y min(2×radio, radio+100 km), con `expand_distance`) va siempre detrás. Cards solo con campos seguros + `distanceLabel`/`distanceKmApprox` generados por backend |
| `POST /api/discovery/actions` | `{target_profile_id, action_type: like\|dislike}`. Destino visible = existe, sin bloqueo en ninguna dirección, cuentas vivas y (descubrible, o te dio like, o match vivo); si no → 404 `profile_not_found`. Duplicado → 409 `already_swiped`; a uno mismo → 422 `cannot_swipe_self`; acción desconocida → 422 `invalid_action_type`. Los swipes de una misma pareja se serializan (advisory lock de transacción): de dos likes simultáneos, el segundo siempre ve el primero y se crea exactamente un match. Si hay like inverso crea match + conversación (`expires_at` a 30 días) y responde `{matchCreated, match{id, conversationId, matchedAt, expiresAt, otherProfile{id, displayName, age, photoUrl}}}` |
| `POST /api/discovery/undo` | Deshace el swipe más reciente solo si fue `dislike`, tiene < 10 min y el perfil sigue visible (entre swipes del mismo segundo prioriza el `dislike`); responde `{undone: true, profile: card}`. Si no → 422 `nothing_to_undo` |

Cards (feed, likes recibidos, deshacer; `SnackWeb.ProfileCardJSON`): campos seguros + `distanceLabel`/`distanceKmApprox` aproximados (`null` fuera del feed si falta ubicación), `photos[]` activas por posición con URL absoluta, `tags[]` positivas activas con `emoji` y `shared` (compartidas primero, luego categoría/`sortOrder`), `likedYou`, `isNewcomer`, `beyondPreferredDistance`. Fotos y etiquetas se cargan en lote (2 consultas por página, `Snack.Dating.ProfileCards`).

## Social (autenticado, D-2026-09-29)

| Ruta | Reglas de servidor |
|---|---|
| `GET /api/profiles/:id` | Perfil público (`PublicProfile`): visible si no hay bloqueo en ninguna dirección, ninguna cuenta está borrada y el perfil es descubrible, o hay match vivo, o esa persona dio like al viewer; si no → 404 `profile_not_found`. Incluye `likedYou`, `youLiked`, `matchId`, `conversationId`, `isNewcomer`; nunca coordenadas. El propio id devuelve una vista previa (`shared: false`) |
| `GET /api/likes/received?cursor&limit` | Likes recibidos sin responder (like más reciente primero; `limit` 1–50, 30 por defecto; cursor firmado ligado al viewer, 24 h). Excluye bloqueos, cuentas/perfiles borrados, perfiles pausados, etiquetas bloqueadas (ambas direcciones) y perfiles fuera del género/edad/intención compatible del viewer. Responder = `POST /api/discovery/actions` |
| `GET /api/me/summary` | `{receivedLikesCount, newMatchesCount, unreadConversationsCount}` para badges: likes pendientes (misma regla que la lista), matches vivos sin mensajes aún no abiertos por el viewer y conversaciones con mensajes del otro sin leer |

## Matches y chat (autenticado)

| Ruta | Reglas de servidor |
|---|---|
| `GET /api/matches` | Matches visibles: activos, sin caducar (`expires_at` vencido = caducado aunque el barrido no haya actualizado `status`), sin bloqueo en ninguna dirección y ambas cuentas vivas. Por actividad (último mensaje o `matchedAt`). Cada uno con `conversationId`, `otherProfile{id, displayName, age, photoUrl}`, `lastMessage` (descifrado) y `unreadCount`. Una consulta (`Snack.Dating.Inbox`) |
| `POST /api/matches/:id/unmatch` | Solo participantes (403 `not_participant`; 404 `match_not_found`); marca unmatched; la conversación deja de estar activa |
| `GET /api/conversations` | Mismas reglas y datos que `GET /api/matches`, con forma `ConversationSummary` |
| `GET /api/conversations/:id/messages` | Solo participantes de una conversación activa (si no → 403 `not_participant` / `conversation_not_active`). Más nuevos primero; `nextCursor` opaco `(inserted_at, id)` estable aunque haya varios mensajes en el mismo segundo (se sigue aceptando un instante ISO 8601 como cursor antiguo) |
| `POST /api/conversations/:id/messages` | Participante + match activo + texto 1–2000; primer mensaje fija `first_message_at` y limpia expiración; enviar marca la conversación como leída para el emisor |
| `POST /api/conversations/:id/read` | Solo participantes; guarda `last_read_at = now` en `conversation_reads` (nunca retrocede). Resetea `unreadCount` y el «match nuevo» |

Caducidad: 30 días sin mensajes (`config :snack, :match_expiry_days`), aplicada al crear el match, en lecturas y en mensajería; `Snack.Dating.MatchExpirySweeper` marca `expired` cada hora (desactivado bajo el sandbox de tests).

## Safety y settings (autenticado)

| Ruta | Efecto |
|---|---|
| `POST /api/users/:profile_id/block` | Bloqueo idempotente; oculta en ambas direcciones discovery, likes, perfil público, matches y conversaciones, y cierra la mensajería (REST y WS). 422 `cannot_block_self`; 404 `profile_not_found` |
| `POST /api/users/:profile_id/report` | Reporte de moderación: `reason` ∈ `fake_profile`, `inappropriate_photos`, `harassment`, `spam`, `underage`, `offensive_bio`, `other` (si no → 422 `invalid_report_reason`); `details` opcional ≤ 1000 (422 `details_too_long`); 422 `cannot_report_self`; 404 `profile_not_found` |
| `POST /api/me/pause` / `POST /api/me/unpause` | Pausa/restaura descubribilidad (si el perfil sigue completo) |
| `DELETE /api/me/account` | Soft-delete; excluido de discovery; datos mínimos para auditoría |

## Tags (autenticado)

| Ruta | Descripción |
|---|---|
| `GET /api/tags` | Catálogo activo en orden de catálogo: `{id, slug, label, category, sortOrder, emoji}` (52 etiquetas, `priv/repo/seeds.exs`) |

## Subidas del almacenamiento local (público)

Solo con `STORAGE_ADAPTER=local` (`Snack.Storage.Local`, D-2026-09-29):

| Ruta | Descripción |
|---|---|
| `PUT /api/uploads/:token` | Destino de `uploadUrl`. Sin Bearer: el token firmado del intent autoriza una storage key, MIME, tamaño máximo y caducidad. Cuerpo crudo por fragmentos, cabecera JPEG/PNG/WebP, escritura atómica sin sobrescritura. 200 `{ok: true}`; 403 `upload_token_invalid`/`upload_token_expired`; 413 `upload_too_large`; 415 `upload_content_type_mismatch`; 422 `upload_invalid_image`; 412 `upload_already_exists`; 404 con otro adaptador |
| `GET /uploads/<storageKey>` | `Plug.Static` sobre `UPLOADS_DIR` (solo `profiles/`, caché inmutable de un año, `nosniff`, sin listados) |

## WebSocket chat

- Endpoint `/socket/websocket?token=<accessToken>`; valida firma **y expiración**.
- Canal `chat:{conversationId}`; join denegado con `profile_required`, `not_participant` o `conversation_not_active`.
- Eventos: cliente `send_message {body}` → reply `{message}` + broadcast `new_message` (enviar marca la conversación como leída para el emisor); `typing` transitorio.
- REST es la fuente de historia; el socket solo entrega en vivo.

## Admin

Sin rutas HTTP expuestas; capacidades en contexto (`list_reports`, `update_report`, `disable_profile`) para tooling interno futuro.
