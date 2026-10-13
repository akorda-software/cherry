# Contratos v2 (2026-09-29) — API social

Tipos en `@cherry/contracts`, clientes en `@cherry/mobile-shared`. JSON de respuesta en camelCase.
Errores: el `HttpClient` de la app lanza `Error(message = body.error)` con `.status`.

## Cambios en tipos existentes (rompen fixtures de tests)

- `Tag` → `+ emoji: string | null`; `category: TagCategory | string` (`TAG_CATEGORIES`, `isTagCategory`).
- `ProfileTag extends Tag { shared: boolean }` — etiquetas de OTRO perfil; `shared` = también es tuya.
- `PhotoSummary { id, url, position }` — fotos de otros (URL absoluta).
- `DiscoveryProfileCard` → `+ photos: PhotoSummary[]`, `+ tags: ProfileTag[]` (compartidas primero),
  `+ likedYou`, `+ isNewcomer`, `+ beyondPreferredDistance`; `distanceLabel`/`distanceKmApprox` ahora
  `| null` (solo pueden ser null fuera del feed); `score` es `0` fuera del feed. `photoUrl` = `photos[0]?.url`.
  Etiqueta >100 km: «A más de N km» (con tilde).
- `DiscoveryMatch` → `+ conversationId`, `expiresAt: string | null` (30 días), `otherProfile.photoUrl`.
- `Profile` (propio) → `+ hasLocation: boolean`. `ProfilePhoto` se mueve a `photos.ts` (mismo export).
- `ProfileApi.updateLocation(req: LocationUpdateRequest): Promise<void>` — antes enviaba `lat/lng` (roto).

## Endpoints y clientes

| Cliente (mobile-shared) | HTTP | Devuelve (cliente) |
|---|---|---|
| `createDiscoveryApi.getFeed(q?)` | `GET /api/discovery/feed?limit&cursor` | `DiscoveryFeedPage` · 403 `profile_incomplete` (+ `onboardingRequired: true`, `nextOnboardingStep`) · 403 `profile_paused` (`onboardingRequired: false`) |
| `.recordAction({targetProfileId, actionType})` | `POST /api/discovery/actions` | `DiscoveryActionResponse` · 409 `already_swiped` · 422 `cannot_swipe_self`/`invalid_action_type` · 404 `profile_not_found` |
| `.undo()` | `POST /api/discovery/undo` | `DiscoveryUndoResponse {undone, profile}` · 422 `nothing_to_undo` (solo el último swipe, si fue "no" y < 10 min) |
| `createLikesApi.listReceived(q?)` | `GET /api/likes/received?limit(1..50, def 30)&cursor` | `ReceivedLikesPage {likes: {likedAt, profile: DiscoveryProfileCard}[], nextCursor}` |
| `createPublicProfileApi.getProfile(id)` | `GET /api/profiles/:id` | `PublicProfile` · 404 `profile_not_found` |
| `createActivityApi.getSummary()` | `GET /api/me/summary` | `ActivitySummary {receivedLikesCount, newMatchesCount, unreadConversationsCount}` |
| `createMatchesApi.list()` | `GET /api/matches` | `MatchSummary[]` (con `conversationId`, `lastMessage`, `unreadCount`, foto) |
| `.unmatch(matchId)` | `POST /api/matches/:id/unmatch` | `void` |
| `createChatApi.listConversations()` | `GET /api/conversations` | `ConversationSummary[]` |
| `.listMessages(convId, q?)` | `GET /api/conversations/:id/messages?limit&cursor` | `ConversationMessagesPage {messages (nuevos primero), nextCursor}` · 403 `conversation_not_active` si ya no está activa |
| `.sendMessage(convId, body)` | `POST /api/conversations/:id/messages` | `ChatMessage` · 403 `conversation_not_active` (enviar también marca la conversación como leída) |
| `.markRead(convId)` | `POST /api/conversations/:id/read` | `void` |
| `createSafetyApi.block(profileId)` | `POST /api/users/:id/block` | `void` (idempotente) |
| `.report(profileId, {reason, details?})` | `POST /api/users/:id/report` | `ProfileReport` · 422 `invalid_report_reason` (`REPORT_REASONS`) / `details_too_long` (>1000) / `cannot_report_self` |
| `createSettingsApi.pause()/unpause()` | `POST /api/me/pause` · `/api/me/unpause` | `void` |
| `.deleteAccount()` | `DELETE /api/me/account` | `void` (después, limpiar sesión local) |
| `createProfileApi.listPhotos()` | `GET /api/me/photos` | `ProfilePhoto[]` |
| `.createPhotoUploadIntent({position, contentType, sizeBytes})` | `POST /api/me/photos/upload-intent` | `PhotoUploadIntent` → subir con `PUT uploadUrl` + TODOS los `headers` |
| `.completePhotoUpload({storageKey, publicUrl, position, contentType, sizeBytes, width?, height?})` | `POST /api/me/photos/complete` | `ProfilePhoto` |
| `.deletePhoto(id)` | `DELETE /api/me/photos/:id` | `void` |
| `.reorderPhotos(photoIds)` | `PUT /api/me/photos/order {photoIds}` | `ProfilePhoto[]` |
| `.updateLocation({latitude, longitude, accuracyMeters?, recordedAt?})` | `POST /api/me/location` | `void` |

Notas de comportamiento:

- **Likes**: responder a un like = `recordAction` con `like` → `matchCreated: true` al instante (`dislike` lo quita de la lista). Funciona aunque esa persona no salga en tu feed (distancia, pausa).
- **Perfil público**: visible si es descubrible, si hay match vivo o si te dio like; nunca con bloqueo/cuenta borrada. Pedir tu propio id devuelve una vista previa (`shared: false`).
- **Matches**: caducan a los **30 días** sin mensajes (`MATCH_EXPIRY_DAYS`); el primer mensaje pone `expiresAt: null`. Los caducados, deshechos y bloqueados no se listan.
- **Badges**: `newMatchesCount` = matches sin mensajes que aún no has abierto; `markRead` al abrir el chat (y al recibir mensajes con el chat abierto) los limpia junto con `unreadCount`.
- **Push**: `new_match` trae ahora también `data.conversationId`; copy «¡Match con Lucía! 💘» / «Lucía te ha escrito».
- **Cursores**: opacos; enviarlos tal cual. 422 `invalid_cursor` ⇒ recargar sin cursor.
- **WebSocket** `chat:{conversationId}`: `new_message` (payload `ChatMessage`) y `typing` (`ChatTypingEvent`); ver `ChatChannelServerEvents`.
- Helpers: `buildQueryPath`, `buildCursorPath`, `httpDelete` (exige `HttpClient.delete`, que la app ya implementa).
