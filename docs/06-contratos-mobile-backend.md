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

Reglas de etiqueta: `<2 km` → «Cerca de ti»; 2–10 → redondeo a 1 km; 10–50 → a 5 km; 50–100 → a 10 km; `>100` → «A mas de N km» (grano de 25 km, sin tilde tal como lo emite el backend).

## Discovery

- Feed: `GET /api/discovery/feed?cursor&limit`; paginación por cursor. Con perfil incompleto responde 403 `profile_incomplete`.
- `limit` acepta 1–100 (20 por defecto). `nextCursor` es opaco, firmado y ligado al usuario, con validez de una hora; enviarlo sin interpretar. Cursor inválido/expirado o límite inválido → 422 `invalid_cursor`/`invalid_limit`; reiniciar el feed sin cursor.
- Puntuación y límite se calculan en PostgreSQL. Orden: puntuación descendente, UUID ascendente para desempatar. La exploración es determinista por pareja; el cursor fija el instante usado para la bonificación por actividad. La paginación es estable mientras no cambien los datos de los perfiles/preferencias; los filtros de seguridad se evalúan en cada petición.
- Acción: `POST /api/discovery/actions` con `{ "target_profile_id": "…", "action_type": "like" | "dislike" }`. Respuesta: `{ "matchCreated": false }` o `{ "matchCreated": true, "match": { … } }`.
- No existe endpoint de «hide»: ocultar = dislike.

## Fotos (R2 directo)

1. `POST /api/me/photos/upload-intent` con `{position, contentType, sizeBytes}` →
   `{storageKey, uploadUrl, publicUrl, method: "PUT", headers, expiresAt, maxBytes}`.
2. El móvil sube el binario directo a R2 con `PUT uploadUrl` y **todos** los headers devueltos (`Content-Type` e `If-None-Match: *`). No puede sobrescribir ese objeto; un segundo PUT devuelve 412. Ante un resultado de red incierto, intentar `complete` antes de crear otro intent.
3. `POST /api/me/photos/complete` con `{storageKey, publicUrl, position, contentType, sizeBytes, width?, height?}` → crea el registro.

Reglas: intent single-use con expiración; key debe pertenecer al perfil; máx. 4 activas; borrar foto desactiva metadato.

`complete` consulta R2 por la API autenticada: verifica existencia, tamaño exacto frente al intent, límite global, MIME y cabecera JPEG/PNG/WebP. La lectura parcial usa `If-Match` con el ETag para detectar cambios. No realiza decodificación completa ni moderación de imagen. Errores 422: `upload_object_not_found`, `upload_size_mismatch`, `upload_content_type_mismatch`, `upload_invalid_image`, `upload_object_changed`; 503 si el storage no responde. No consume el intent en caso de fallo. El antiguo `POST /api/me/photos` se ha retirado para impedir saltarse la verificación.

La configuración CORS del bucket debe permitir los headers devueltos y las credenciales del backend deben tener lectura/escritura de objetos. Las operaciones condicionales usadas están documentadas en [la compatibilidad S3 de R2](https://developers.cloudflare.com/r2/api/s3/api/).

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

`typing` es transitorio y no requerido. Reconexión: socket fresco → rejoins → backfill REST por historial → merge por `id`. El WS nunca es historia durable.

## Push tokens

`POST /api/me/push-token` con `{expoPushToken, platform, installationId}` → `{ok, pushToken{id, platform, installationId, status, lastSeenAt}}`. Token válido `ExponentPushToken[...]`/`ExpoPushToken[...]`; ligado a la sesión autenticada; re-registro actualiza y desactiva duplicados.

## Feature flags

El móvil no hardcodea flags: los lee de `GET /api/config` (el bootstrap no incluye flags). Flag off ⇒ sin entrada de navegación y pantalla autogateada del módulo opcional.
