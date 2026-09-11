# API del backend

Superficie REST y WebSocket **implementada** en `apps/backend` (fuente: `lib/snack_web/router.ex`). Contratos de payload en detalle: `06-contratos-mobile-backend.md`. OpenAPI machine-readable servida en `/openapi.yaml`.

Pipelines: `:api` (público), `:authenticated_api` (valida JWT + expiración + familia de sesión no revocada).

## Auth y sesión (público)

| Ruta | Descripción |
|---|---|
| `POST /api/auth/:provider/callback` | Callback Google/Apple; valida credencial, resuelve/crea usuario, emite sesión |
| `POST /api/auth/dev/test-login` | Solo dev: login de prueba sin providers nativos |
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
| `GET/PUT /api/me/discovery-preferences` | Edad min/max en [18,100] y ≥1 interested-in; la distancia solo se valida contra las opciones permitidas (10/25/50/100/sin límite) al completar el perfil — el PUT acepta cualquier valor > 0 |
| `GET /api/me/photos` · `DELETE /api/me/photos/:id` | Lista / desactiva foto |
| `POST /api/me/photos/upload-intent` | URL firmada SigV4 para R2 (content-type jpeg/png/webp, máx. 2 MB, intent expira en 600 s) |
| `POST /api/me/photos/complete` | Valida intent no expirado/no usado + key/URL/content-type coincidentes; posición y URL salen del intent (el body no las modifica). Máx. 4 activas |
| `POST /api/me/photos` | Legacy: creación directa por metadatos (mantener o deprecar — ver deuda) |
| `GET/PUT /api/me/tags` | Reemplaza positivos; máx. 8; los IDs desconocidos se descartan silenciosamente (no se filtra por tags activas) |
| `GET/PUT /api/me/blocked-tags` | Reemplaza bloqueados; máx. 5; ídem |
| `POST /api/me/location` | Payload `latitude/longitude/accuracyMeters/recordedAt`; normaliza a rejilla 500 m antes de guardar |
| `POST /api/me/push-token` | Registro de token Expo ligado a la sesión; upsert + desactiva duplicados |

## Discovery (autenticado)

| Ruta | Reglas de servidor |
|---|---|
| `GET /api/discovery/feed?cursor&limit` | Exige perfil completo y descubrible (si no → 403 `profile_incomplete`); candidatos por distancia/edad recíproca/género/intent/bloques/ya-vistos/tags bloqueados; scoring con boost para usuarios nuevos; cards solo con campos seguros + `distanceLabel`/`distanceKmApprox` generados por backend. *Fallback por expansión de distancia con poca oferta: pendiente* |
| `POST /api/discovery/actions` | `{target_profile_id, action_type: like\|dislike}`; rechaza self-action y duplicados; persiste swipe; si hay like inverso crea match + conversación (`expires_at` a 7 días) y responde con match summary |

## Matches y chat (autenticado)

| Ruta | Reglas de servidor |
|---|---|
| `GET /api/matches` | Matches activos con resumen del otro perfil y expiración |
| `POST /api/matches/:id/unmatch` | Solo participantes; marca unmatched; la conversación deja de estar activa |
| `GET /api/conversations` | Conversaciones activas del usuario |
| `GET /api/conversations/:id/messages` | Historial paginado por cursor |
| `POST /api/conversations/:id/messages` | Participante + match activo + texto 1–2000; primer mensaje fija `first_message_at` y limpia expiración |

## Safety y settings (autenticado)

| Ruta | Efecto |
|---|---|
| `POST /api/users/:profile_id/block` | Bloqueo: fuera del discovery en ambas direcciones (hoy no bloquea la mensajería de un match previo — ver deuda) |
| `POST /api/users/:profile_id/report` | Reporte de moderación (reason + details) |
| `POST /api/me/pause` / `POST /api/me/unpause` | Pausa/restaura descubribilidad (si el perfil sigue completo) |
| `DELETE /api/me/account` | Soft-delete; excluido de discovery; datos mínimos para auditoría |

## Tags (autenticado)

| Ruta | Descripción |
|---|---|
| `GET /api/tags` | Catálogo activo (slug, label, category) |

## WebSocket chat

- Endpoint `/socket/websocket?token=<accessToken>`; valida firma **y expiración**.
- Canal `chat:{conversationId}`; join denegado con `profile_required`, `not_participant` o `conversation_not_active`.
- Eventos: cliente `send_message {body}` → reply `{message}` + broadcast `new_message`; `typing` transitorio.
- REST es la fuente de historia; el socket solo entrega en vivo.

## Admin

Sin rutas HTTP expuestas; capacidades en contexto (`list_reports`, `update_report`, `disable_profile`) para tooling interno futuro.
