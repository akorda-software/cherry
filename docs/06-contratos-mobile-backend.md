# Contratos mobile-backend

Formatos de payload aceptados entre la app Expo y Phoenix. Complementa `05-backend-api.md` con las formas exactas de mensaje. Fuente de verdad compartida: `packages/contracts`.

## Bootstrap y routing

`GET /api/bootstrap` (autenticado):

```json
{
  "user": { "id": "…", "email": "…", "displayName": "User" },
  "profile": {
    "exists": true,
    "isComplete": false,
    "isDiscoverable": false,
    "isPaused": false,
    "onboardingRequired": true,
    "nextOnboardingStep": "photos"
  }
}
```

Reglas de routing móvil:

- Sin sesión → `(public)/login`.
- `onboardingRequired` → `(onboarding)`; el resolver navega según `nextOnboardingStep`.
- Perfil completo, no borrado y no pausado → shell `(app)`.
- Pausado → shell con estado de visibilidad pausada.
- Discovery bloqueado hasta perfil completo y descubrible.

`nextOnboardingStep` es conveniencia del backend (derivado de `missing`), no frontera de seguridad.

## Sesiones

- Access token como `Authorization: Bearer <token>` en REST y `?token=` en WebSocket.
- 401 REST ⇒ refrescar una vez con el refresh token, persistir nuevo bundle y reintentar una vez; si falla, limpiar secure storage y volver a signed-out.
- Refresh rota siempre el token; el reuso de un refresh revoca la familia.
- `DELETE /api/me/account` desactiva el usuario, oculta su perfil, revoca todas sus sesiones y tokens push y desconecta sus sockets. Funciona aunque no haya perfil. Es borrado lógico: conserva los registros; no permite iniciar nuevas sesiones con esa cuenta.
- En bootstrap, si el access token cacheado ya está expirado, refrescar antes de llamar.

## Onboarding draft

1. Solo `PUT /api/me/profile` crea el draft; el resto de endpoints de `/api/me/*` (preferencias, tags, fotos, ubicación) responden 404 `profile_not_found` hasta que existe perfil.
2. Cada paso valida solo sus campos.
3. La completitud se valida solo en `POST /api/me/profile/complete`.

Error estructurado de completion:

```json
{
  "error": "profile_incomplete",
  "missing": ["photos", "location"],
  "nextOnboardingStep": "photos"
}
```

El móvil puede guardar estado local de UX (índice de pantalla, formularios no enviados), pero el backend es la única verdad del progreso enviado. Reabrir la app = bootstrap + fetch del draft + resumir el mejor paso.

## Ubicación

`POST /api/me/location` — JSON normal (sin tipos Geo de framework):

```json
{
  "latitude": 40.4168,
  "longitude": -3.7038,
  "accuracyMeters": 25,
  "recordedAt": "2026-04-29T12:00:00Z"
}
```

- Rangos válidos: lat −90..90, lng −180..180; `accuracyMeters` y `recordedAt` opcionales.
- El backend normaliza a rejilla de privacidad de **500 m** antes de persistir en PostGIS.
- Ninguna API devuelve coordenadas crudas.

## Distancia en cards

Generada por backend; el móvil la muestra tal cual:

```json
{ "distanceLabel": "A unos 15 km", "distanceKmApprox": 15 }
```

Reglas de etiqueta: `<2 km` → «Cerca de ti»; 2–10 → redondeo a 1 km; 10–50 → a 5 km; 50–100 → a 10 km; `>100` → «A más de N km» (grano de 25 km). Fuera del feed (likes, deshacer, perfil público) ambos campos son `null` si falta alguna de las dos ubicaciones.

## Preferencias de discovery

`GET /api/me/discovery-preferences` y `PUT` (parcial, snake_case) → `{ "discoveryPreferences": DiscoveryPreferences }`:

```json
{
  "ageMin": 25, "ageMax": 35, "distanceKm": 25,
  "showMen": true, "showWomen": false, "showNonBinary": false,
  "compatibleOnly": false, "expandDistance": true, "discoveryMode": "feed"
}
```

- `distanceKm` ∈ 10 / 25 / 50 / 100 / 999999 (sin límite): usar un selector cerrado, no texto libre.
- Edades 18–100 con `ageMin ≤ ageMax` y al menos un `show*`. Se validan en cada PUT contra el resultado final. Si falla, 422 `{ "errors": { "distance_km": ["must be one of 10, 25, 50, 100 or 999999 (no limit)"] } }` (o `age_min`/`age_max`/`show_men`) y no se guarda nada.
- `expandDistance` (por defecto `true`): con poca oferta, el feed continúa más allá del radio (ver abajo). No aplica con distancia sin límite.
- `compatibleOnly`: solo perfiles con al menos una etiqueta positiva compartida. Es simétrico: quien lo activa tampoco aparece a quien no comparte etiquetas.
- `discoveryMode` (`swipe` | `feed`) es preferencia de presentación del cliente; el feed es idéntico en ambos modos.

## Discovery

- Feed: `GET /api/discovery/feed?cursor&limit`; paginación por cursor. Con perfil incompleto responde 403 `{ "error": "profile_incomplete", "onboardingRequired": true, "nextOnboardingStep": "photos" | … | null }` (`null` = solo falta confirmar con `POST /api/me/profile/complete`); con perfil en pausa, 403 `{ "error": "profile_paused", "onboardingRequired": false, "nextOnboardingStep": null }` (mostrar estado de pausa, no onboarding).
- `limit` acepta 1–100 (20 por defecto). `nextCursor` es opaco, firmado y ligado al usuario, con validez de una hora; enviarlo sin interpretar. Cursor inválido/expirado o límite inválido → 422 `invalid_cursor`/`invalid_limit`; reiniciar el feed sin cursor.
- Ranking v2 (D-2026-09-29), calculado en PostgreSQL. Orden: tramo de distancia ascendente, puntuación descendente y UUID ascendente para desempatar.
  - Primero va todo el radio preferido. Con `expandDistance` y distancia acotada, detrás llegan los perfiles hasta min(2 × radio, radio + 100 km), marcados con `beyondPreferredDistance: true` (p. ej. un aviso «un poco más lejos»).
  - Cuando se acaba el feed (`nextCursor: null`), ya no queda nadie compatible en el radio ampliado. Es el estado de «poca oferta»: invita a ampliar distancia o edad, sin insistir.
  - `score` (0–97) es orientativo y no debe mostrarse como nota. `likedYou` indica que la otra persona ya te dio like (like = match al instante). `isNewcomer` indica que completó el perfil hace menos de 7 días.
- Estabilidad: el cursor fija el instante de referencia (novedad, actividad, likes pendientes) y la generación de pesos de etiquetas, así que el paso del tiempo o un recálculo de pesos no reordenan un feed en curso. Los filtros de seguridad se evalúan en cada petición. Que alguien edite su perfil a mitad de sesión puede moverlo de página: el cliente deduplica por `id`. Los cursores anteriores a v2 responden 422 `invalid_cursor`: reiniciar el feed.
- Acción: `POST /api/discovery/actions` con `{ "target_profile_id": "…", "action_type": "like" | "dislike" }`. Respuesta: `{ "matchCreated": false }` o `{ "matchCreated": true, "match": { "id", "conversationId", "matchedAt", "expiresAt", "otherProfile": { "id", "displayName", "age", "photoUrl" } } }`. Errores: 409 `already_swiped`, 422 `cannot_swipe_self` / `invalid_action_type`, 404 `profile_not_found` (destino inexistente o no visible: retirar la card).
- No existe endpoint de «hide»: ocultar = dislike.
- Deshacer: `POST /api/discovery/undo` (sin body) → `{ "undone": true, "profile": card }` si el último swipe fue un «no» de hace < 10 min; si no, 422 `nothing_to_undo`. Reinsertar la card devuelta al principio de la pila.

Card (`DiscoveryProfileCard`, también en likes y deshacer):

```json
{
  "id": "…", "displayName": "Lucía", "age": 30, "bio": "…", "gender": "woman",
  "whatIAmLookingFor": "relationship", "distanceLabel": "A unos 2 km", "distanceKmApprox": 2,
  "score": 0, "sharedTagsCount": 1, "photoUrl": "https://…/1.png", "photoCount": 2,
  "photos": [{ "id": "…", "url": "https://…/1.png", "position": 1 }],
  "tags": [{ "id": "…", "slug": "music", "label": "Música", "category": "interests",
             "sortOrder": 1, "emoji": "🎵", "shared": true }],
  "likedYou": true, "isNewcomer": true, "beyondPreferredDistance": false
}
```

`tags` son las positivas activas del otro perfil, compartidas primero; `photos` las activas por posición (URL absoluta); `score` solo tiene sentido en el feed (0 en el resto).

## Likes recibidos y perfil público

- `GET /api/likes/received?cursor&limit` → `{ "likes": [{ "likedAt": "…", "profile": card }], "nextCursor": "…" | null }`. `limit` 1–50 (30 por defecto); cursor opaco (24 h). Responder con `POST /api/discovery/actions`: `like` → match al instante; `dislike` → sale de la lista.
- `GET /api/profiles/:id` → `{ "profile": PublicProfile }` (campos de la card sin `score`/`photoUrl`/`photoCount`/`sharedTagsCount`/`beyondPreferredDistance`, más `youLiked`, `matchId`, `conversationId`). 404 `profile_not_found` si no es visible.
- `GET /api/me/summary` → `{ "receivedLikesCount": 1, "newMatchesCount": 0, "unreadConversationsCount": 2 }` para badges.

## Matches y chat REST

- `GET /api/matches` → `{ "matches": [MatchSummary] }`, por actividad reciente:

```json
{
  "id": "…", "conversationId": "…", "matchedAt": "…", "expiresAt": null, "firstMessageAt": "…",
  "otherProfile": { "id": "…", "displayName": "Lucía", "age": 30, "photoUrl": "https://…" },
  "lastMessage": { "id": "…", "conversationId": "…", "senderProfileId": "…", "body": "¡Hola!", "insertedAt": "…" },
  "unreadCount": 1
}
```

- `GET /api/conversations` → `{ "conversations": [ConversationSummary] }` (`id` = conversación, `matchId`, mismos `otherProfile`/`lastMessage`/`unreadCount`/`expiresAt`, `insertedAt`).
- `GET /api/conversations/:id/messages?cursor&limit` → `{ "messages": [ChatMessage] (nuevos primero), "nextCursor": "…" | null }`. 403 `conversation_not_active` si el match se deshizo, caducó, hay bloqueo o una cuenta se borró.
- `POST /api/conversations/:id/messages` `{ "body" }` → `{ "message": ChatMessage }`; `POST /api/conversations/:id/read` → `{ "ok": true }` (llamarlo al abrir el chat y al recibir mensajes con el chat abierto).
- `POST /api/matches/:id/unmatch`, `POST /api/users/:id/block` → `{ "ok": true }`; `POST /api/users/:id/report` `{ "reason": ReportReason, "details"? }` → `{ "report": { "id", "reason", "details", "status", "insertedAt" } }`.
- Caducidad: un match sin mensajes caduca a los **30 días** (`expiresAt`); tras el primer mensaje `expiresAt` es `null`. Los caducados desaparecen de las listas.

## Fotos

El flujo es el mismo con cualquier almacenamiento (`STORAGE_ADAPTER`, ver D-2026-09-29): el móvil nunca sabe si detrás hay disco local o un bucket.

1. `POST /api/me/photos/upload-intent` con `{position, contentType, sizeBytes}` →
   `{storageKey, uploadUrl, publicUrl, method: "PUT", headers, expiresAt, maxBytes}`. `contentType` ∈ `image/jpeg`, `image/png`, `image/webp`; `sizeBytes` ≤ `maxBytes` (2 MB por defecto); el intent caduca a los 600 s.
2. El móvil sube el binario con `PUT uploadUrl`, cuerpo crudo (no multipart) y **todos** los headers devueltos (`Content-Type` e `If-None-Match: *`). No puede sobrescribir ese objeto: un segundo PUT devuelve 412. Ante un resultado de red incierto, intentar `complete` antes de crear otro intent.
3. `POST /api/me/photos/complete` con `{storageKey, publicUrl, position, contentType, sizeBytes, width?, height?}` → `{photo}`. Posición y URL salen del intent: el body solo se contrasta con él (`publicUrl` puede ser la URL absoluta recibida en el paso 1).

Reglas: intent single-use con expiración; key debe pertenecer al perfil; máx. 4 activas; borrar foto desactiva metadato.

URLs: la API devuelve **siempre URLs absolutas** (`uploadUrl`, `publicUrl`, `photo.url`, fotos de cards y perfiles). Con almacenamiento local la BD guarda la ruta relativa (`/uploads/<storageKey>`) y la API la resuelve contra `PUBLIC_BASE_URL` si está configurada o, si no, contra el host con el que llegó la petición (útil en dev: `localhost`, IP de la LAN o túnel).

### Almacenamiento local (`STORAGE_ADAPTER=local`, por defecto en dev)

- `uploadUrl` = `<base>/api/uploads/<token>`. El token (`Phoenix.Token`) firma la storage key, el MIME, el tamaño máximo y la caducidad del intent; la ruta es pública (sin `Authorization`): el token es la autorización, igual que una URL prefirmada.
- `PUT /api/uploads/:token` lee el cuerpo por fragmentos con límite de tamaño, exige el MIME firmado y la cabecera binaria JPEG/PNG/WebP, y publica el objeto de forma atómica en `UPLOADS_DIR/<storageKey>`. Responde `100 Continue` a `Expect: 100-continue`.
- Respuestas: 200 `{ "ok": true }`; 403 `upload_token_invalid` / `upload_token_expired`; 413 `upload_too_large`; 415 `upload_content_type_mismatch`; 422 `upload_invalid_image`; 412 `upload_already_exists`; 503 `storage_unavailable`; 404 si la instancia no usa almacenamiento local.
- Las fotos se sirven en `GET /uploads/<storageKey>` (`Plug.Static`, `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`); solo bajo `profiles/`, sin listados de directorios. Las claves son únicas y los objetos nunca se reescriben.

### R2 / S3 compatible (`STORAGE_ADAPTER=r2`)

`uploadUrl` es una URL SigV4 prefirmada (path-style) que firma `Content-Type`, `host` e `If-None-Match: *`. Sin `S3_ENDPOINT` apunta a Cloudflare R2; con `S3_ENDPOINT` (+ `S3_REGION`) a MinIO, Garage u otro servicio S3. La configuración CORS del bucket debe permitir los headers devueltos y las credenciales del backend deben tener lectura/escritura de objetos. Las operaciones condicionales usadas están documentadas en [la compatibilidad S3 de R2](https://developers.cloudflare.com/r2/api/s3/api/).

### Verificación en `complete`

Ambos adaptadores comprueban existencia, tamaño exacto frente al intent, límite global, MIME y cabecera JPEG/PNG/WebP (R2/S3 por la API autenticada, con lectura parcial condicionada por ETag para detectar cambios; local, en disco). No hay decodificación completa ni moderación de imagen. Errores 422: `upload_object_not_found`, `upload_size_mismatch`, `upload_content_type_mismatch`, `upload_invalid_image`, `upload_object_changed` (solo R2/S3), `upload_url_mismatch`; 503 `storage_unavailable` si el storage no responde y `storage_not_configured` si la instancia no lo tiene configurado. No consume el intent en caso de fallo. El antiguo `POST /api/me/photos` se ha retirado para impedir saltarse la verificación.

### Gestionar fotos

- `GET /api/me/photos` → `{ "photos": [ProfilePhoto] }` activas por posición (`{id, storageKey, url, position, isActive}`).
- `PUT /api/me/photos/order` con `{ "photoIds": ["…", "…"] }` → `{ "photos": [ProfilePhoto] }`. La lista debe contener **todas** las fotos activas exactamente una vez; las posiciones pasan a 1..n en ese orden (la primera es la principal). Si no → 422 `invalid_photo_ids`.
- `DELETE /api/me/photos/:id` → `{ "ok": true }` (desactiva la foto; también si ya estaba desactivada). 404 `photo_not_found` si no es tuya o el id no existe. No compacta posiciones: el hueco se puede rellenar con una subida nueva en esa posición o con `PUT /api/me/photos/order`.

## Etiquetas

- `GET /api/tags` → `{ "tags": [Tag] }`: catálogo activo en orden de catálogo (52 etiquetas en 7 categorías). `Tag` = `{ "id", "slug", "label", "category", "sortOrder", "emoji" }` (`emoji` puede ser `null`). La misma forma se usa en `/api/me/tags`, `/api/me/blocked-tags` y en el perfil propio.
- `PUT /api/me/tags` / `PUT /api/me/blocked-tags` con `{ "tag_ids": ["…"] }` (también se acepta `tagIds`) → `{ "tags": [Tag] }` / `{ "blockedTags": [Tag] }`. Reemplazan la selección completa; los duplicados se ignoran. Errores 422: `too_many_tags` (> 8) / `too_many_blocked_tags` (> 5); `{ "error": "invalid_tags", "tagIds": [...] }` si algún id no existe, está mal formado o la etiqueta está inactiva; `{ "error": "tag_conflict", "tagIds": [...] }` si una etiqueta quedaría a la vez en positivas y bloqueadas (hay que quitarla primero de la otra lista).

## Login de desarrollo

`POST /api/auth/dev/test-login` (solo si `:enable_dev_test_login`, activo en dev; si no → 404 `dev_test_login_disabled`) → 201 con el mismo bundle de sesión que el login real. Body opcional: `{}` entra como el usuario de prueba compartido (`test@snack.app`); `{ "email": "demo@snack.dev", "displayName"?: "Lucía" }` entra como esa persona y la crea si no existe (`displayName` solo se usa al crearla). `device` es opcional y puede ser parcial. Errores: 422 `invalid_email`, 403 `account_deleted`. Las cuentas de `priv/repo/demo_seeds.exs` se usan así.

## Chat WebSocket

- Conexión `/socket/websocket?token=<accessToken>`; token expirado ⇒ rechazo; el móvil refresca y reconecta.
- Topic `chat:{conversationId}`. Errores de join: `not_participant`, `profile_required`, `conversation_not_active`.
- Un bloqueo en cualquiera de las direcciones o la eliminación de una cuenta impide enviar mensajes y typing, incluso en sockets ya conectados. Los broadcasts pendientes se comprueban antes de entregarlos. REST y WS comparten estas reglas.

Cliente envía:

```json
{ "event": "send_message", "payload": { "body": "hola" } }
```

Reply y broadcast:

```json
{ "message": { "id": "…", "conversationId": "…", "senderProfileId": "…", "body": "hola", "insertedAt": "…" } }
```
```json
{ "event": "new_message", "payload": { "id": "…", "conversationId": "…", "senderProfileId": "…", "body": "hola", "insertedAt": "…" } }
```

`typing` es transitorio y no requerido. Reconexión: socket fresco → rejoins → backfill REST por historial → merge por `id`. El WS nunca es historia durable. Enviar (REST o WS) marca la conversación como leída para el emisor; los mensajes recibidos por el socket con el chat abierto se marcan con `POST /api/conversations/:id/read`.

Push (sin cambios de mecanismo): `new_match` → título «¡Match con Lucía! 💘», `data {type, matchId, profileId, conversationId}`; `new_message` → «Lucía te ha escrito», `data {type, conversationId, messageId, senderProfileId}`.

## Push tokens

`POST /api/me/push-token` con `{expoPushToken, platform, installationId}` → `{ok, pushToken{id, platform, installationId, status, lastSeenAt}}`. Token válido `ExponentPushToken[...]`/`ExpoPushToken[...]`; ligado a la sesión autenticada; re-registro actualiza y desactiva duplicados.

## Feature flags

El móvil no hardcodea flags: los lee de `GET /api/config` (el bootstrap no incluye flags). Flag off ⇒ sin entrada de navegación y pantalla autogateada del módulo opcional.
