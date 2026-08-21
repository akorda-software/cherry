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
- Acción: `POST /api/discovery/actions` con `{ "target_profile_id": "…", "action_type": "like" | "dislike" }`. Respuesta: `{ "matchCreated": false }` o `{ "matchCreated": true, "match": { … } }`.
- No existe endpoint de «hide»: ocultar = dislike.

## Fotos (R2 directo)

1. `POST /api/me/photos/upload-intent` con `{position, contentType, sizeBytes}` →
   `{storageKey, uploadUrl, publicUrl, method: "PUT", headers, expiresAt, maxBytes}`.
2. El móvil sube el binario directo a R2 con `PUT uploadUrl` (+ headers).
3. `POST /api/me/photos/complete` con `{storageKey, publicUrl, position, contentType, sizeBytes, width?, height?}` → crea el registro.

Reglas: intent single-use con expiración; key debe pertenecer al perfil; máx. 4 activas; borrar foto desactiva metadato.

## Chat WebSocket

- Conexión `/socket/websocket?token=<accessToken>`; token expirado ⇒ rechazo; el móvil refresca y reconecta.
- Topic `chat:{conversationId}`. Errores de join: `not_participant`, `profile_required`, `conversation_not_active`.

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
