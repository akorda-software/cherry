# API del backend

Superficie REST y WebSocket **implementada** en `apps/backend` (fuente: `lib/cherry_web/router.ex`). Contratos de payload en detalle: `06-contratos-mobile-backend.md`. OpenAPI machine-readable servida en `/openapi.yaml`.

Pipelines: `:api` (público), `:authenticated_api` (valida JWT + expiración + familia de sesión no revocada, y registra la actividad del perfil en `last_active_at` como mucho cada 15 min — `CherryWeb.Plugs.TrackActivity`).

## Salud (público)

| Ruta | Descripción |
|---|---|
| `GET /healthz` | Liveness sin BD: `{status: "ok", version}` (`APP_VERSION`, horneada en la imagen) |
| `GET /readyz` | Hace `SELECT 1` en la BD: `{status: "ready", version}` o 503 `{status: "unavailable"}` |
| `GET /openapi.yaml` | Contrato OpenAPI (fichero estático `priv/static/openapi.yaml`) |

## Auth y sesión (público)

| Ruta | Descripción |
|---|---|
| `POST /api/auth/:provider/callback` | Callback Google/Apple; valida credencial, resuelve/crea usuario, emite sesión. Si la persona había borrado su cuenta, la borra del todo y crea una nueva; una cuenta borrada por otro motivo → 401 `account_deleted` |
| `POST /api/auth/dev/test-login` | Solo dev (`:enable_dev_test_login`): login sin providers nativos. Body opcional: `{}` → usuario de prueba compartido; `{email, displayName?}` → entra como esa persona (la crea si no existe; así se usan las cuentas de `demo_seeds.exs`); `device` opcional y puede ser parcial. 422 `invalid_email`, 403 `account_deleted`, 404 si está desactivado |
| `POST /api/session/refresh` | Rotación de refresh token; reuso revoca la familia |
| `DELETE /api/session` | Logout device-scoped |
| `GET /api/config` | Runtime config para el móvil: feature flags, identidad de la instancia (`instance`) y edad mínima (`ageVerification.minimumAge`) |

## Bootstrap

| Ruta | Descripción |
|---|---|
| `GET /api/bootstrap` | Usuario + estado de perfil (`exists`, `isComplete`, `isDiscoverable`, `isPaused`, `onboardingRequired`, `nextOnboardingStep`) + `ageVerification: {required, status, providerAvailable}` (`status` ∈ `unverified`, `verified`, `revoked`; sin fila → `unverified`; `providerAvailable`: Didit configurado). Fuente de routing del móvil |

## Perfil y onboarding (`/api/me/*`, autenticado)

| Ruta | Reglas de servidor |
|---|---|
| `GET /api/me/profile` | Draft o perfil completo con fotos, tags y preferencias |
| `PUT /api/me/profile` | Upsert de draft (campos core); validación por campo |
| `POST /api/me/profile/complete` | Valida TODO server-side; si falta algo → `profile_incomplete` + `missing[]` + `nextOnboardingStep`; si ok → `is_complete = true` y `is_discoverable = true` salvo perfil pausado o borrado |
| `GET/PUT /api/me/discovery-preferences` | En cada PUT, también parcial, se valida el valor resultante: edades en [18,100] con `age_min ≤ age_max`, `distance_km` ∈ {10, 25, 50, 100, 999999 (sin límite)} y ≥1 interested-in. Errores 422 `{errors: {campo: [mensaje]}}`, sin guardar nada. Campos opcionales: `compatible_only`, `expand_distance` (default `true`) y `discovery_mode` (solo presentación) |
| `GET /api/me/photos` · `DELETE /api/me/photos/:id` | Lista (URLs absolutas) / borra foto (`{ok: true}`; 404 `photo_not_found`): la fila queda inactiva y el objeto se borra físicamente del almacenamiento al momento (si falla, lo reintenta el barrido periódico `Cherry.Dating.PhotoStorageSweeper`). Al borrar la cuenta se borran igual todas sus fotos |
| `POST /api/me/photos/upload-intent` | URL de subida de un solo uso según `STORAGE_ADAPTER`: local → `PUT /api/uploads/:token` firmado; R2/S3 → URL SigV4 prefirmada. La subida va a la zona de espera no pública `pending/<storageKey>`; `storageKey` es aleatoria (`photos/<32 hex>.<ext>`, sin id de perfil) y `publicUrl` es ya la definitiva. Content-type jpeg/png/webp, máx. 2 MB, intent expira en 600 s; 503 `storage_not_configured` sin almacenamiento. Límites: máx. 4 intents vivos (sin completar ni caducar) por perfil → 429 `too_many_upload_intents`; máx. 20 intents por hora → 429 `upload_rate_limited`. Los objetos de intents caducados sin completar se borran en el barrido periódico |
| `POST /api/me/photos/complete` | Valida intent no expirado/no usado + key/URL/content-type coincidentes y verifica el objeto (existencia, tamaño, MIME, cabecera binaria); posición y URL salen del intent (el body no las modifica). Máx. 4 activas. Al completar, el objeto pasa de `pending/` a su clave definitiva (local: enlace atómico; R2/S3: `CopyObject` + borrado); solo entonces es público |
| `PUT /api/me/photos/order` | `{photoIds}` con todas las fotos activas exactamente una vez → posiciones 1..n; responde `{photos}`. 422 `invalid_photo_ids` |
| `GET/PUT /api/me/tags` | Reemplaza positivos (`tag_ids`); máx. 8 (`too_many_tags`); IDs desconocidos, mal formados o inactivos → 422 `invalid_tags` + `tagIds`; etiqueta ya bloqueada → 422 `tag_conflict` + `tagIds`; duplicados ignorados |
| `GET/PUT /api/me/blocked-tags` | Reemplaza bloqueados; máx. 5 (`too_many_blocked_tags`); mismas validaciones (`tag_conflict` si es positiva) |
| `POST /api/me/location` | Payload `latitude/longitude/accuracyMeters/recordedAt`; normaliza **siempre** a rejilla 500 m antes de guardar. Solo se aceptan `latitude`/`longitude`: cualquier otra geometría (`coordinates` GeoJSON) se ignora, y sin lat/lng → 422. La BD solo admite puntos WGS 84 (CHECK `profile_locations_coordinates_point`). Actualizaciones a menos de 60 s de la anterior se ignoran y responden igual `{ok: true}` (dificulta triangular a alguien) |
| `POST /api/me/push-token` | Registro de token Expo ligado a la sesión; upsert + desactiva duplicados |

## Discovery (autenticado)

| Ruta | Reglas de servidor |
|---|---|
| `GET /api/discovery/feed?cursor&limit` | Exige perfil completo y descubrible (si no → 403 `profile_incomplete` con `onboardingRequired: true` + `nextOnboardingStep`, o 403 `profile_paused` si está en pausa); ranking v2 en PostgreSQL (`Cherry.Dating.Discovery`, D-2026-09-29). Los filtros duros se reevalúan en cada página: bloqueos y etiquetas bloqueadas en ambas direcciones, género/edad recíprocos, matriz de intención simétrica, `compatible_only` de cualquiera de los dos, cuentas y perfiles vivos y ya swipeados. Se excluye también a quien ya dio dislike al viewer: su like no se vería nunca, porque la pestaña de likes solo lista likes sin responder. Si deshace ese dislike (`POST /api/discovery/undo` borra el swipe), vuelve a aparecer. Puntuación: afinidad IDF 0–45, intención +10/+4, reciprocidad +12, recién llegado ≤ +8, actividad +8/+5/+2, distancia 0–10, exploración 0–4 y reparto de atención −0..6. Orden `tier ASC, score DESC, id ASC`: el tramo 2 (entre el radio y min(2×radio, radio+100 km), con `expand_distance`) va siempre detrás. Cards solo con campos seguros + `distanceLabel`/`distanceKmApprox` generados por backend; la puntuación ordena pero **no se envía** (`score` delataba actividad y likes pendientes). Las etiquetas desactivadas del catálogo (`tags.is_active = false`) no cuentan para la afinidad, `sharedTagsCount`, `compatible_only` ni los pesos IDF (los bloqueos por etiqueta sí aplican a todas) |
| `POST /api/discovery/actions` | `{target_profile_id, action_type: like\|dislike}`. Exige viewer activo (completo, descubrible, sin pausar): si no → 403 `profile_paused` / `profile_incomplete` (mismos cuerpos que el feed). Destino visible (misma regla que `GET /api/profiles/:id`, ver abajo); si no → 404 `profile_not_found`, sin revelar la razón. El bloqueo se revalida bajo el lock de la pareja, que `block` también toma: un like que compite con un bloqueo nunca crea un match después del bloqueo. Duplicado → 409 `already_swiped`; a uno mismo → 422 `cannot_swipe_self`; acción desconocida → 422 `invalid_action_type`. Los swipes de una misma pareja se serializan (advisory lock de transacción): de dos likes simultáneos, el segundo siempre ve el primero y se crea exactamente un match. Si hay like inverso crea match + conversación (`expires_at` a 30 días) y responde `{matchCreated, match{id, conversationId, matchedAt, expiresAt, otherProfile{id, displayName, age, photoUrl}}}` |
| `POST /api/discovery/undo` | Exige viewer activo (403 como arriba). Deshace el swipe más reciente solo si fue `dislike` y tiene < 10 min (entre swipes del mismo segundo prioriza el `dislike`); responde `{undone: true, profile: card}`, o `{undone: true, profile: null}` si el «no» se deshizo pero esa persona ya no es visible (pausa, bloqueo, filtros duros): no hay card que reinsertar. Si no hay nada que deshacer → 422 `nothing_to_undo` |

Cards (feed, likes recibidos, deshacer; `CherryWeb.ProfileCardJSON`): campos seguros + `distanceLabel`/`distanceKmApprox` aproximados (`null` fuera del feed si falta ubicación), `photos[]` activas por posición con URL absoluta, `tags[]` positivas activas con `emoji` y `shared` (compartidas primero, luego categoría/`sortOrder`), `likedYou`, `isNewcomer`, `beyondPreferredDistance`. Sin `score`. Fotos y etiquetas se cargan en lote (2 consultas por página, `Cherry.Dating.ProfileCards`).

## Social (autenticado, D-2026-09-29)

| Ruta | Reglas de servidor |
|---|---|
| `GET /api/profiles/:id` | Perfil público (`PublicProfile`). Siempre: sin bloqueo en ninguna dirección y ninguna cuenta/perfil borrado. Con match vivo → visible (aunque ya no casen los filtros, para el chat; también si el viewer está pausado o incompleto). Si no, exige viewer activo y que el perfil sea descubrible (completo, descubrible, sin pausar) y pase los filtros duros del feed: etiquetas bloqueadas en ambas direcciones, género/edad preferidos del viewer, intención compatible, `compatible_only` del viewer; y género/edad/`compatible_only` de la otra persona hacia el viewer, salvo que tenga un like **pendiente** al viewer (su like es su consentimiento, como en la bandeja). Un like histórico no da visibilidad: tras unmatch o caducidad la ex pareja solo se ve si es descubrible y pasa los filtros. Cualquier fallo → 404 `profile_not_found`, sin revelar la razón (`Cherry.Dating.Social`). Incluye `likedYou`, `youLiked`, `matchId`, `conversationId`, `isNewcomer`; nunca coordenadas. El propio id devuelve una vista previa (`shared: false`) |
| `GET /api/likes/received?cursor&limit` | Likes recibidos sin responder (like más reciente primero; `limit` 1–50, 30 por defecto; cursor firmado ligado al viewer, 24 h). Solo de perfiles completos, descubribles y sin pausar. Excluye bloqueos, cuentas/perfiles borrados, etiquetas bloqueadas (ambas direcciones), perfiles fuera del género/edad (misma fecha UTC y rango que el feed)/intención compatible del viewer y, si el viewer tiene `compatible_only`, los que no compartan una etiqueta activa. Responder = `POST /api/discovery/actions` |
| `GET /api/me/summary` | `{receivedLikesCount, newMatchesCount, unreadConversationsCount}` para badges: likes pendientes (misma regla que la lista), matches vivos sin mensajes aún no abiertos por el viewer y conversaciones con mensajes del otro sin leer |

## Matches y chat (autenticado)

| Ruta | Reglas de servidor |
|---|---|
| `GET /api/matches` | Matches visibles: activos, sin caducar (`expires_at` vencido = caducado aunque el barrido no haya actualizado `status`), sin bloqueo en ninguna dirección y ambas cuentas vivas. Por actividad (último mensaje o `matchedAt`). Cada uno con `conversationId`, `otherProfile{id, displayName, age, photoUrl}`, `lastMessage` (descifrado) y `unreadCount`. Una consulta (`Cherry.Dating.Inbox`) |
| `POST /api/matches/:id/unmatch` | Solo participantes (403 `not_participant`; 404 `match_not_found`); marca unmatched; la conversación deja de estar activa |
| `GET /api/conversations` | Mismas reglas y datos que `GET /api/matches`, con forma `ConversationSummary` |
| `GET /api/conversations/:id/messages` | Solo participantes de una conversación activa (si no → 403 `not_participant` / `conversation_not_active`). Más nuevos primero; `nextCursor` opaco `(inserted_at, id)` estable aunque haya varios mensajes en el mismo segundo (se sigue aceptando un instante ISO 8601 como cursor antiguo) |
| `POST /api/conversations/:id/messages` | Participante + match activo + texto 1–2000; primer mensaje fija `first_message_at` y limpia expiración; enviar marca la conversación como leída para el emisor hasta ese mensaje (`inserted_at`), y emite `new_message` en `chat:{id}` igual que el envío por socket (una sola emisión, en `Cherry.Dating.send_message/1`) |
| `POST /api/conversations/:id/read` | Solo participantes; guarda `last_read_at = now` en `conversation_reads` (nunca retrocede). Resetea `unreadCount` y el «match nuevo» |

Caducidad: 30 días sin mensajes (`config :cherry, :match_expiry_days`), aplicada al crear el match, en lecturas y en mensajería; `Cherry.Dating.MatchExpirySweeper` marca `expired` cada hora (desactivado bajo el sandbox de tests).

## Safety y settings (autenticado)

| Ruta | Efecto |
|---|---|
| `POST /api/users/:profile_id/block` | Bloqueo idempotente; oculta en ambas direcciones discovery, likes, perfil público, matches y conversaciones, y cierra la mensajería (REST y WS). 422 `cannot_block_self`; 404 `profile_not_found` (también si el perfil o su cuenta están borrados) |
| `POST /api/users/:profile_id/report` | Reporte de moderación: `reason` ∈ `fake_profile`, `inappropriate_photos`, `harassment`, `spam`, `underage`, `offensive_bio`, `other` (si no → 422 `invalid_report_reason`); `details` opcional ≤ 1000 (422 `details_too_long`); 422 `cannot_report_self`; 404 `profile_not_found` (también si el perfil o su cuenta están borrados: no se distingue de uno inexistente). Idempotente: con un reporte abierto del mismo reporter sobre el mismo perfil devuelve ese reporte sin crear otro |
| `POST /api/me/pause` / `POST /api/me/unpause` | Pausa/restaura descubribilidad (si el perfil sigue completo y, con la verificación de edad obligatoria, verificado) |
| `GET /api/me/verification` / `POST /api/me/verification/nfc` / `POST /api/me/verification/provider` / `POST /api/me/verification/provider/check` | Verificación de edad por NFC o con selfie + documento en Didit (contrato en `06-contratos-mobile-backend.md`). Con `AGE_VERIFICATION_REQUIRED=true`, un perfil sin verificación válida queda «pendiente de verificar»: se puede editar, pero `is_discoverable` es falso (distinto de `is_paused`) y la API social responde 403 `age_verification_required`. Verificarse lo hace descubrible si está completo y no pausado. Un documento de menor → 422 `{error: "underage", accountDeleted: true}` y borrado físico de toda la cuenta (`Cherry.Accounts.purge_account/1`): fotos y subidas del almacenamiento, usuario y, en cascada, perfil, matches, mensajes, reportes, sesiones, tokens e intentos; no se guarda nada del documento |
| `DELETE /api/me/account` | Borrado físico de la cuenta y sus datos vinculados, también sin perfil o suspendida: correo, identidad OAuth, huella del documento, perfil, actividad, conversaciones compartidas, expedientes, avisos y auditoría asociada. Sesiones/dispositivos/push desaparecen por cascada y se desconectan sus sockets. El mismo acceso/DNI puede volver a registrarse desde cero. Archivos y sesiones externas registradas tienen limpieza reintentable independiente; no promete borrar instantáneamente cachés/backups |

## Tags (autenticado)

| Ruta | Descripción |
|---|---|
| `GET /api/tags` | Catálogo activo en orden de catálogo: `{id, slug, label, category, sortOrder, emoji}` (52 etiquetas, `priv/repo/seeds.exs`) |

## Subidas del almacenamiento local (público)

Solo con `STORAGE_ADAPTER=local` (`Cherry.Storage.Local`, D-2026-09-29):

| Ruta | Descripción |
|---|---|
| `PUT /api/uploads/:token` | Destino de `uploadUrl`. Sin Bearer: el token firmado del intent autoriza una storage key, MIME, tamaño máximo y caducidad. Cuerpo crudo por fragmentos, cabecera JPEG/PNG/WebP, escritura atómica en `pending/<storageKey>` sin sobrescritura (tampoco si la foto ya se publicó). 200 `{ok: true}`; 403 `upload_token_invalid`/`upload_token_expired`; 413 `upload_too_large`; 415 `upload_content_type_mismatch`; 422 `upload_invalid_image`; 412 `upload_already_exists`; 404 con otro adaptador |
| `POST /api/webhooks/didit` | Webhook de Didit (evento `status.updated`, v3). Sin Bearer: HMAC-SHA256 del cuerpo crudo con `DIDIT_WEBHOOK_SECRET` (`X-Signature`, hex) y `X-Timestamp` a ±300 s; si no, 401 `invalid_signature` (Didit no reintenta). Sin secreto, 503 `webhook_unavailable`. Un estado final (aprobada, rechazada, caducada, abandonada) programa a los 60 s la misma comprobación que `…/provider/check` (`ProviderDecisionWorker`, cola `verification`), que pide la decisión a Didit y no se fía del cuerpo; el resto se ignora. 200 vacío. La ruta no se registra en el log |
| `GET /uploads/<storageKey>` | `Plug.Static` sobre `UPLOADS_DIR`: solo fotos publicadas (`photos/` y las antiguas `profiles/`; nunca `pending/` ni `.tmp/`), `Cache-Control: public, max-age=86400` (las fotos borradas desaparecen del disco, así que ya no es «immutable» de un año), `nosniff`, sin listados |

## WebSocket chat

- Endpoint `/socket/websocket?token=<accessToken>`; valida firma **y expiración**.
- Canal `chat:{conversationId}`; join denegado con `profile_required`, `not_participant` o `conversation_not_active`.
- Eventos: cliente `send_message {body}` → reply `{message}` + broadcast `new_message` (enviar marca la conversación como leída para el emisor); `typing` transitorio.
- REST es la fuente de historia; el socket solo entrega en vivo.

## Admin

Backoffice HTML en `/backoffice`, desactivado por defecto (`BACKOFFICE_ENABLED`), con cuentas independientes y roles `superadmin`, `admin`, `moderator`, `privacy`. Bootstrap/recuperación por código de consola; invitaciones de un uso y contraseña personal para el equipo, sesiones revocables, HTTPS/CSRF. Solo `superadmin` gestiona `/backoffice/team` y sus POST de alta, permisos y recuperación. Cola, detalle auditado, asignación, decisiones motivadas, advertencia/suspensión y revisión humana independiente. Mutaciones POST en `/backoffice/cases/:id/{claim,reassign,resolve}`. No acepta el Bearer móvil como privilegio de equipo. [Operación y límites](./14-backoffice.md).

Web pública en `/`, `/privacidad`, `/condiciones`, `/normas`, `/seguridad-infantil`, `/transparencia`, `/contacto` y `/eliminar-cuenta`. Textos marcados como borradores; contacto no operativo si falta `INSTANCE_CONTACT_EMAIL`. `GET /api/config` entrega por defecto las URLs propias de privacidad/condiciones, respetando las URLs externas configuradas. Sin rastreadores ni recursos web de terceros.

Desde el 2026-10-17, `SupportCase.kind` incluye `measure`: ficha mínima de una suspensión vigente sobre otra cuenta cuyo expediente original se borra. Solo la persona afectada puede consultarla/recurrirla por la API; no incluye identidad ni texto del denunciante. Los recursos ya presentados conservan su estado sin duplicarse. El POST público de solicitudes no permite crear `measure`. [Separación](./15-borrado-y-web-publica.md).

## Buzón y solicitudes de privacidad

Autenticación de usuario normal, sin exigir perfil completo, verificación de edad ni ausencia de suspensión. Todas las respuestas usan `Cache-Control: no-store`.

| Ruta | Efecto |
|---|---|
| `GET /api/me/cases?offset` | Hasta 50 expedientes propios o decisiones dirigidas al usuario; sin identidad de denunciante/equipo. Offset 0–10000 |
| `POST /api/me/cases` | `{kind: privacy\|complaint, category, statement}`. Privacidad: access/rectification/erasure/restriction/portability/objection; reclamación: service/safety/other. Texto 10–4000; máximo 10 solicitudes nuevas/24 h por cuenta. Recibo y auditoría atómicos |
| `GET /api/me/cases/:id` | Proyección privada del caso; ajeno, inexistente o UUID inválido → 404 `case_not_found` |
| `POST /api/me/cases/:id/appeal` | `{statement}`. Un recurso por persona/decisión de reporte o reclamación; 409 si duplicado/no recurrible; no lo decide la misma cuenta de equipo |
| `GET /api/me/notices?offset` | Justificantes y resoluciones de este destinatario, 50 por página; no envío externo |
| `POST /api/me/notices/:id/read` | Marca leído un aviso propio; ajeno/no existente → 404 |

El nuevo reporte de safety crea también expediente y justificante sin cambiar su respuesta anterior. Una suspensión devuelve 403 `account_suspended` en las rutas sociales y oculta al usuario a terceros; no impide el buzón, los reportes, la baja o las solicitudes de privacidad. **Solicitar supresión o marcar una solicitud respondida no ejecuta un borrado ni una exportación**. [Contratos y operación](./14-backoffice.md).

## Push

`Cherry.Notifications` envía por la Expo Push API un aviso de match nuevo y de mensaje nuevo a los tokens activos de la otra persona (formato en `06-contratos-mobile-backend.md`). La app móvil todavía no registra tokens (`POST /api/me/push-token` no se usa), así que en la práctica no sale ninguno.
