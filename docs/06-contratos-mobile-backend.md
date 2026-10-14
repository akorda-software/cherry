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
  },
  "ageVerification": { "required": false, "status": "unverified", "providerAvailable": true }
}
```

`ageVerification.status`: `unverified` (sin verificación) | `verified` | `revoked`; `required` refleja `AGE_VERIFICATION_REQUIRED`; `providerAvailable`: hay verificación con selfie + documento (Didit) configurada.

Reglas de routing móvil:

- Sin sesión → `(public)/login`.
- `onboardingRequired` → `(onboarding)`; el resolver navega según `nextOnboardingStep`.
- Perfil completo, no borrado y no pausado → shell `(app)`.
- Pausado → shell con estado de visibilidad pausada.
- `ageVerification.required` y `status` distinto de `verified` → perfil «pendiente de verificar»: editable, pero invisible (`isDiscoverable: false` con `isPaused: false`); no es una pausa.
- Discovery bloqueado hasta perfil completo y descubrible.

`nextOnboardingStep` es conveniencia del backend (derivado de `missing`), no frontera de seguridad.

## Sesiones

- Access token como `Authorization: Bearer <token>` en REST y `?token=` en WebSocket.
- 401 REST ⇒ refrescar una vez con el refresh token, persistir nuevo bundle y reintentar una vez; si falla, limpiar secure storage y volver a signed-out.
- Refresh rota siempre el token; el reuso de un refresh revoca la familia.
- `DELETE /api/me/account` desactiva el usuario, oculta su perfil, revoca todas sus sesiones y tokens push y desconecta sus sockets. Funciona aunque no haya perfil. Es borrado lógico: conserva los registros y no admite nuevas sesiones con esa cuenta. Si la persona vuelve a entrar con la misma cuenta de Google/Apple, el callback de login borra del todo la cuenta anterior y crea una nueva desde cero (onboarding y verificación de edad incluidos).
- En bootstrap, si el access token cacheado ya está expirado, refrescar antes de llamar.

## Onboarding draft

1. Solo `PUT /api/me/profile` crea el draft; el resto de endpoints de `/api/me/*` (preferencias, tags, fotos, ubicación) responden 404 `profile_not_found` hasta que existe perfil.
2. Cada paso valida solo sus campos.
3. La completitud se valida solo en `POST /api/me/profile/complete`.

### ¿Qué buscas? (`looking_for`)

- Varias respuestas: 1–4 intenciones de `relationship` / `casual` / `meet_people` / `go_with_the_flow`, sin repetir. `PUT /api/me/profile` con `{ "looking_for": ["relationship", "meet_people"] }`; el backend las guarda en ese orden canónico. Una lista vacía, un valor desconocido o un duplicado → 422 `{ "errors": { "looking_for": [...] } }`. `null` deja el borrador sin contestar (falta `looking_for` al completar → paso `intent`).
- Compatibilidad: se acepta también una sola cadena (lista de un elemento) y las claves antiguas `what_i_am_looking_for` / `whatIAmLookingFor`.
- Lectura: `lookingFor` (lista, `[]` si está sin contestar) en el perfil propio, las cards y el perfil público. `whatIAmLookingFor` sigue saliendo con la primera intención (o `null`) solo para versiones antiguas de la app: **obsoleto**, no usarlo.
- Emparejamiento: dos personas encajan si algún par (mía, suya) encaja con la regla de una intención (cada una ve la suya y «a ver qué pasa», que encaja con todas; relación y casual nunca se cruzan). Es simétrico. En el ranking, compartir al menos una intención suma lo mismo que antes «la misma intención» (+10); encajar solo a través de «a ver qué pasa», +4.

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
- Solo se aceptan `latitude`/`longitude`: cualquier otra clave de geometría (p. ej. `coordinates` GeoJSON) se ignora; sin lat/lng → 422.
- El backend normaliza **siempre** a rejilla de privacidad de **500 m** antes de persistir en PostGIS (la BD solo admite puntos).
- Una actualización a menos de 60 s de la anterior se ignora y responde igual `{ "ok": true }`: no reintentar en bucle.
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
  - La puntuación ordena el feed pero **no se envía** (delataba actividad y likes pendientes). `likedYou` indica que la otra persona ya te dio like (like = match al instante). `isNewcomer` indica que completó el perfil hace menos de 7 días.
- Estabilidad: el cursor fija el instante de referencia (novedad, actividad, likes pendientes) y la generación de pesos de etiquetas, así que el paso del tiempo o un recálculo de pesos no reordenan un feed en curso. Los filtros de seguridad se evalúan en cada petición. Que alguien edite su perfil a mitad de sesión puede moverlo de página: el cliente deduplica por `id`. Los cursores anteriores a v2 responden 422 `invalid_cursor`: reiniciar el feed.
- Acción: `POST /api/discovery/actions` con `{ "target_profile_id": "…", "action_type": "like" | "dislike" }`. Respuesta: `{ "matchCreated": false }` o `{ "matchCreated": true, "match": { "id", "conversationId", "matchedAt", "expiresAt", "otherProfile": { "id", "displayName", "age", "photoUrl" } } }`. Errores: 409 `already_swiped`, 422 `cannot_swipe_self` / `invalid_action_type`, 404 `profile_not_found` (destino inexistente o no visible, p. ej. porque ahora bloqueas alguna de sus etiquetas: retirar la card), 403 `profile_paused` / `profile_incomplete` (mismos cuerpos que el feed: el viewer tiene que estar activo para hacer swipe, también desde la pestaña de likes).
- No existe endpoint de «hide»: ocultar = dislike.
- Deshacer: `POST /api/discovery/undo` (sin body) → `{ "undone": true, "profile": card | null }` si el último swipe fue un «no» de hace < 10 min; si no, 422 `nothing_to_undo` (403 `profile_paused` / `profile_incomplete` con viewer inactivo). Reinsertar la card devuelta al principio de la pila. **`profile: null`** = el «no» se deshizo pero esa persona ya no es visible (pausa, bloqueo, filtros): no reinsertar nada.

Card (`DiscoveryProfileCard`, también en likes y deshacer):

```json
{
  "id": "…", "displayName": "Lucía", "age": 30, "bio": "…", "gender": "woman",
  "lookingFor": ["relationship", "meet_people"], "whatIAmLookingFor": "relationship",
  "distanceLabel": "A unos 2 km", "distanceKmApprox": 2,
  "sharedTagsCount": 1, "photoUrl": "https://…/1.png", "photoCount": 2,
  "photos": [{ "id": "…", "url": "https://…/1.png", "position": 1 }],
  "tags": [{ "id": "…", "slug": "music", "label": "Música", "category": "interests",
             "sortOrder": 1, "emoji": "🎵", "shared": true }],
  "likedYou": true, "isNewcomer": true, "beyondPreferredDistance": false
}
```

`tags` son las positivas activas del otro perfil, compartidas primero; `photos` las activas por posición (URL absoluta). `sharedTagsCount` solo cuenta etiquetas activas del catálogo (coincide con las `shared` visibles). `score` ya no se envía (queda como opcional obsoleto en `@cherry/contracts`).

## Likes recibidos y perfil público

- `GET /api/likes/received?cursor&limit` → `{ "likes": [{ "likedAt": "…", "profile": card }], "nextCursor": "…" | null }`. Solo likes de perfiles activos que pasan tus filtros (etiquetas, género, edad, intención y tu `compatibleOnly`). `limit` 1–50 (30 por defecto); cursor opaco (24 h). Responder con `POST /api/discovery/actions`: `like` → match al instante; `dislike` → sale de la lista.
- `GET /api/profiles/:id` → `{ "profile": PublicProfile }` (campos de la card sin `photoUrl`/`photoCount`/`sharedTagsCount`/`beyondPreferredDistance`, más `youLiked`, `matchId`, `conversationId`). 404 `profile_not_found` si no es visible: aplica los mismos filtros duros que el feed (etiquetas bloqueadas en ambas direcciones, intención, género/edad, `compatibleOnly`) y exige viewer activo, **salvo match vivo** (el perfil de un match sigue visible para el chat). Un like antiguo no da visibilidad (tras unmatch/caducidad, solo si es descubrible).
- `GET /api/me/summary` → `{ "receivedLikesCount": 1, "newMatchesCount": 0, "unreadConversationsCount": 2 }` para badges.

## Matches y chat REST

- `GET /api/matches?cursor&limit` → `{ "matches": [MatchSummary], "nextCursor": "…" | null }`, por actividad reciente:

```json
{
  "id": "…", "conversationId": "…", "matchedAt": "…", "expiresAt": null, "firstMessageAt": "…",
  "otherProfile": { "id": "…", "displayName": "Lucía", "age": 30, "photoUrl": "https://…" },
  "lastMessage": { "id": "…", "conversationId": "…", "senderProfileId": "…", "body": "¡Hola!", "insertedAt": "…" },
  "unreadCount": 1
}
```

- `GET /api/conversations?cursor&limit` → `{ "conversations": [ConversationSummary], "nextCursor": "…" | null }` (`id` = conversación, `matchId`, mismos `otherProfile`/`lastMessage`/`unreadCount`/`expiresAt`, `insertedAt`).
- Ambas listas usan `limit` 1–100 (50 por defecto), cursor firmado para el viewer (1 h) y actividad referida al instante de la primera página. Mensajes nuevos posteriores a ese instante aparecen al refrescar; bloqueos, borrados y caducidad se comprueban en cada página. Cursor o límite inválido → 422 `invalid_cursor` / `invalid_limit`. El móvil carga páginas sucesivas sin repetir matches y conserva mensajes más recientes recibidos durante la carga.
- `GET /api/conversations/:id/match` → `{ "match": MatchSummary }` para abrir directamente un chat desde una notificación, aunque no esté en la primera página. 403 si la conversación no es visible.
- `GET /api/conversations/:id/messages?cursor&limit` → `{ "messages": [ChatMessage] (nuevos primero), "nextCursor": "…" | null }`. 403 `conversation_not_active` si el match se deshizo, caducó, hay bloqueo o una cuenta se borró.
- `POST /api/conversations/:id/messages` `{ "body" }` → `{ "message": ChatMessage }`; `POST /api/conversations/:id/read` → `{ "ok": true }` (llamarlo al abrir el chat y al recibir mensajes con el chat abierto).
- `POST /api/matches/:id/unmatch`, `POST /api/users/:id/block` → `{ "ok": true }`; `POST /api/users/:id/report` `{ "reason": ReportReason, "details"? }` → `{ "report": { "id", "reason", "details", "status", "insertedAt" } }`. Reportar de nuevo con un reporte abierto devuelve el mismo reporte. Perfil o cuenta borrados → 404 `profile_not_found`, como un id inexistente.
- Caducidad: un match sin mensajes caduca a los **30 días** (`expiresAt`); tras el primer mensaje `expiresAt` es `null`. Los caducados desaparecen de las listas.

## Fotos

El flujo es el mismo con cualquier almacenamiento (`STORAGE_ADAPTER`, ver D-2026-09-29): el móvil nunca sabe si detrás hay disco local o un bucket.

1. `POST /api/me/photos/upload-intent` con `{position, contentType, sizeBytes}` →
   `{storageKey, uploadUrl, publicUrl, method: "PUT", headers, expiresAt, maxBytes}`. `contentType` ∈ `image/jpeg`, `image/png`, `image/webp`; `sizeBytes` ≤ `maxBytes` (2 MB por defecto); el intent caduca a los 600 s. `storageKey` es aleatoria (`photos/<hex>.<ext>`). Límites: 4 intents vivos por perfil y 20 por hora → 429 `too_many_upload_intents` / `upload_rate_limited` (no reintentar en bucle: esperar a que caduquen o completar los pendientes).
2. El móvil sube el binario con `PUT uploadUrl`, cuerpo crudo (no multipart) y **todos** los headers devueltos (`Content-Type` e `If-None-Match: *`). No puede sobrescribir ese objeto: un segundo PUT devuelve 412. Ante un resultado de red incierto, intentar `complete` antes de crear otro intent.
3. `POST /api/me/photos/complete` con `{storageKey, publicUrl, position, contentType, sizeBytes, width?, height?}` → `{photo}`. Posición y URL salen del intent: el body solo se contrasta con él (`publicUrl` puede ser la URL absoluta recibida en el paso 1). Hasta este paso el objeto vive en una zona de espera no pública; `publicUrl` no sirve nada antes de completar.

Reglas: intent single-use con expiración; key debe pertenecer al perfil; máx. 4 activas; borrar foto desactiva el metadato y borra el objeto (su URL deja de servir). Las subidas nunca completadas se borran al caducar.

URLs: la API devuelve **siempre URLs absolutas** (`uploadUrl`, `publicUrl`, `photo.url`, fotos de cards y perfiles). Con almacenamiento local la BD guarda la ruta relativa (`/uploads/<storageKey>`) y la API la resuelve contra `PUBLIC_BASE_URL` si está configurada o, si no, contra el host con el que llegó la petición (útil en dev: `localhost`, IP de la LAN o túnel).

### Almacenamiento local (`STORAGE_ADAPTER=local`, por defecto en dev)

- `uploadUrl` = `<base>/api/uploads/<token>`. El token (`Phoenix.Token`) firma la storage key, el MIME, el tamaño máximo y la caducidad del intent; la ruta es pública (sin `Authorization`): el token es la autorización, igual que una URL prefirmada.
- `PUT /api/uploads/:token` lee el cuerpo por fragmentos con límite de tamaño, exige el MIME firmado y la cabecera binaria JPEG/PNG/WebP, y escribe el objeto de forma atómica en la zona de espera `UPLOADS_DIR/pending/<storageKey>`; `complete` lo mueve a `UPLOADS_DIR/<storageKey>`. Responde `100 Continue` a `Expect: 100-continue`.
- Respuestas: 200 `{ "ok": true }`; 403 `upload_token_invalid` / `upload_token_expired`; 413 `upload_too_large`; 415 `upload_content_type_mismatch`; 422 `upload_invalid_image`; 412 `upload_already_exists`; 503 `storage_unavailable`; 404 si la instancia no usa almacenamiento local.
- Las fotos se sirven en `GET /uploads/<storageKey>` (`Plug.Static`, `Cache-Control: public, max-age=86400`, `X-Content-Type-Options: nosniff`); solo bajo `photos/` y `profiles/` (claves antiguas), nunca `pending/`, sin listados de directorios. Las claves son únicas y los objetos nunca se reescriben; se borran al borrar la foto o la cuenta.

### R2 / S3 compatible (`STORAGE_ADAPTER=r2`)

`uploadUrl` es una URL SigV4 prefirmada (path-style) que firma `Content-Type`, `host` e `If-None-Match: *`. Sin `S3_ENDPOINT` apunta a Cloudflare R2; con `S3_ENDPOINT` (+ `S3_REGION`) a MinIO, Garage u otro servicio S3. La configuración CORS del bucket debe permitir los headers devueltos y las credenciales del backend deben tener lectura/escritura/borrado de objetos (`complete` hace `CopyObject` de `pending/<storageKey>` a `<storageKey>` y borra el original). Un bucket público expone también `pending/` (claves aleatorias, borradas al caducar el intent): conviene una regla de ciclo de vida que borre `pending/` a 1 día. Las operaciones condicionales usadas están documentadas en [la compatibilidad S3 de R2](https://developers.cloudflare.com/r2/api/s3/api/).

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

`POST /api/auth/dev/test-login` (solo si `:enable_dev_test_login`, activo en dev; si no → 404 `dev_test_login_disabled`) → 201 con el mismo bundle de sesión que el login real. Body opcional: `{}` entra como el usuario de prueba compartido (`test@cherry.app`); `{ "email": "demo@cherry.dev", "displayName"?: "Lucía" }` entra como esa persona y la crea si no existe (`displayName` solo se usa al crearla). `device` es opcional y puede ser parcial. Errores: 422 `invalid_email`, 403 `account_deleted`. Las cuentas de `priv/repo/demo_seeds.exs` se usan así.

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

`typing` es transitorio y no requerido. Reconexión: socket fresco → rejoins → backfill REST por historial → merge por `id`. El WS nunca es historia durable. Enviar (REST o WS) emite `new_message` en `chat:{id}` una sola vez (también el envío REST llega a los sockets) y marca la conversación como leída para el emisor hasta ese mensaje; los mensajes recibidos por el socket con el chat abierto se marcan con `POST /api/conversations/:id/read`.

Push (sin cambios de mecanismo): `new_match` → título «¡Match con Lucía! 💘», `data {type, matchId, profileId, conversationId}`; `new_message` → «Lucía te ha escrito», `data {type, conversationId, messageId, senderProfileId}`.

## Push tokens

`POST /api/me/push-token` con `{expoPushToken, platform, installationId}` → `{ok, pushToken{id, platform, installationId, status, lastSeenAt}}`. Token válido `ExponentPushToken[...]`/`ExpoPushToken[...]`; ligado a la sesión autenticada; re-registro actualiza y desactiva duplicados. La app móvil todavía no llama a este endpoint (no registra tokens ni gestiona notificaciones).

## Verificación de edad (D-2026-10-09)

Diseño y estado: `docs/compliance/02-mayoria-de-edad.md`. Contrato en `packages/contracts/src/verification.ts`; cliente `createVerificationApi` en `mobile-shared`.

- `GET /api/me/verification` → `{verification: {status, method, verifiedAt}, required, providerAvailable}`. `status`: `unverified` | `verified` | `revoked`; `method`: `nfc_dni` (tarjetas de identidad: DNI y TIE/NIE) | `nfc_passport` | `provider` (Didit) | `eu_wallet` (aún no existe); `required` refleja `AGE_VERIFICATION_REQUIRED`; `providerAvailable`, si hay Didit configurado.
- `POST /api/me/verification/nfc` con `{dg1, dg2, sod}`: los ficheros del chip tal cual, en base64 (máx. 1 KB, 256 KB y 32 KB decodificados). El CAN o la MRZ nunca salen del móvil. El servidor hace la autenticación pasiva (firma del SOD → certificado del firmante → CSCA de confianza, hashes de DG1 y DG2, dígitos de control de la MRZ), exige 18 años cumplidos (fecha UTC) y guarda solo estado, método, fecha y la huella HMAC del documento. Respuesta 200 igual que el GET; repetir con el mismo documento es idempotente.
- Errores: 422 `invalid_payload` | `underage` con `accountDeleted` (`true`: la cuenta se ha borrado entera, ver abajo) | `document_expired` (caducado según la MRZ) | `document_not_verified` con `reason` (`malformed_sod`, `unsupported_algorithm`, `missing_document_signer`, `invalid_signature`, `untrusted_certificate`, `certificate_expired`, `data_group_mismatch`, `malformed_dg1`, `invalid_check_digit`, `unsupported_document`); 409 `document_already_used` (otra cuenta) | `already_verified` (con otro documento); 403 `verification_revoked`; 429 `too_many_attempts` con `retryAfter` y cabecera `Retry-After` (5 intentos por hora y 10 por día por usuario, cuenten o no); 503 `age_verification_unavailable` (sin `DOCUMENT_FINGERPRINT_KEY`); 500 `verification_error`.
- Selfie + documento con Didit:
  - `POST /api/me/verification/provider` con `{callback?}` (máx. 200 caracteres; esquema propio como `cherry://…` o `https://`; `http`, `file`, `javascript`, `data` → 422 `invalid_payload`) → 201 `{sessionId, url}`. La app abre `url` en el navegador. Cuenta como intento (mismos límites que el NFC). Errores: 409 `already_verified`, 403 `verification_revoked`, 429 `too_many_attempts`, 502 `provider_error`, 503 `age_verification_unavailable` (sin Didit o sin clave de huella).
  - `POST /api/me/verification/provider/check` con `{sessionId}` (UUID) → 200 `{result: "verified", verification, required}` | `{result: "pending"}` (no ha terminado) | `{result: "in_review"}` (revisión manual de Didit; preguntar más tarde). No cuenta como intento. Errores: 422 `invalid_payload` | `underage` + `accountDeleted` (igual que el NFC) | `document_expired` | `verification_declined` | `session_expired` (caducada o abandonada: empezar otra) | `unsupported_document` (solo DNI, TIE/permiso de residencia o pasaporte, y solo los tipos que acepta la instancia con `AGE_VERIFICATION_DOCUMENTS`); 409 `document_already_used` | `already_verified`; 403 `verification_revoked`; 404 `session_not_found` (desconocida, ya borrada o de otro usuario); 502 `provider_error`; 503 `age_verification_unavailable`; 500 `verification_error`.
  - Tras una decisión final el servidor borra la sesión en Didit. La huella es la misma que con el NFC para el mismo documento.
- Huella: «una persona, una cuenta». En DNI y TIE españoles se calcula con el número de DNI/NIE (sobrevive a las renovaciones); en el resto, con el número del documento (los pasaportes cambian de número al renovarse; su campo de número personal no se usa porque en pasaportes de menores puede llevar el DNI de un progenitor).
- Obligatoriedad (desactivada): con `AGE_VERIFICATION_REQUIRED=true`, discovery, perfiles públicos, likes, matches y conversaciones responden 403 `age_verification_required` hasta verificarse. Perfil propio, bootstrap, configuración, la propia verificación, bloquear y reportar siguen abiertos. El WebSocket del chat aún no lo comprueba.
- Perfil pendiente de verificar: con la obligatoriedad activa, el onboarding no cambia, pero un perfil sin verificación válida no es descubrible (nadie lo ve en discovery, likes ni perfil público). Verificarse lo hace descubrible si está completo y no lo ha pausado su dueño (una pausa se respeta). Hoy `is_discoverable` se recalcula al completar, editar, despausar y verificarse: al activar o desactivar el flag con usuarios existentes no se recalcula solo.
- Menor de edad: `{"error": "underage", "accountDeleted": true}` (422). Se borra toda la cuenta: fotos y subidas del almacenamiento y, en BD, usuario, perfil, matches, conversaciones, mensajes, bloqueos, reportes, sesiones, tokens e intentos de verificación. No se guarda nada del documento (ni huella). La sesión deja de valer: la app debe cerrar sesión localmente.
- Privacidad: `dg1`, `dg2`, `sod`, `can` y `mrz` están en `:filter_parameters` (los logs de petición muestran `[FILTERED]`); los fallos internos se registran sin argumentos ni mensaje; el log de resultado no incluye el usuario.

## Configuración pública de la instancia

`GET /api/config` (sin sesión) devuelve, además de `features`:

- `instance`: `{name, country, locale, operator, contactEmail, privacyUrl, termsUrl, sourceUrl}` (variables `INSTANCE_*`; los cinco últimos pueden ser `null`). La app los enseña en «Acerca de» (quién gestiona la instancia, contacto, textos legales y «Ver el código» si la compilación no trae `EXPO_PUBLIC_SOURCE_URL`).
- `ageVerification`: `{minimumAge}` (`AGE_VERIFICATION_MINIMUM_AGE`, 18 por defecto). La app la usa en el paso de la fecha de nacimiento; el backend la aplica al documento y a la fecha de nacimiento del perfil (`missing: ["birth_date"]`).

Ambos son opcionales en `BootstrapConfig` (`@cherry/contracts`): con un servidor anterior, la app no enseña datos de la instancia y usa 18.

## Feature flags

El móvil no hardcodea flags: los lee de `GET /api/config` (el bootstrap no incluye flags; solo repite `age_verification_required` en `ageVerification.required`). Flag off ⇒ sin entrada de navegación y pantalla autogateada del módulo opcional. Fuera de los tests, el backend publica `age_verification_required` (`AGE_VERIFICATION_REQUIRED`, `false` por defecto); el registro de módulos opcionales del móvil está vacío.
