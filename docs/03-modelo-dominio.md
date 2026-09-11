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
  4. *Pausado* (`is_paused = true`) → no descubrible, conservando el perfil.
  5. *Borrado* (`deleted_at`) → soft-delete; excluido de discovery para siempre.

Invariantes: los drafts jamás aparecen en discovery; la completitud solo la valida el backend; `nextOnboardingStep` es conveniencia de UI, no frontera de seguridad.

- **DiscoveryPreference** — edad min/max, distancia, interested-in selections (+ campo `discovery_mode` migrado, aún sin uso en el feed — ver deuda técnica).
- **ProfilePhoto** — metadatos de foto en R2 (storage_key, url, position, is_active). Máx. 4 activas; 2–4 requeridas para completar.
- **PhotoUploadIntent** — intención firmada de subida directa a R2 con expiración; single-use.
- **Tag / ProfileTag / ProfileBlockedTag** — catálogo cerrado + relaciones separadas positivos/bloqueados (máx. 8 / 5).
- **ProfileLocation** — última ubicación aproximada (rejilla 500 m) como punto PostGIS.

### Discovery y matching

- **SwipeAction** — like/dislike de actor sobre target. Única acción activa por par actor-target. Dislike = ocultación (no hay estado «hide» separado). Bloquea self-action.
- **Match** — se crea cuando existe like mutuo. Estados:
  - *Active*: con `expires_at = matched_at + 7 días` hasta el primer mensaje.
  - *Chateado* (estado lógico; `status` sigue "active"): primer mensaje fija `first_message_at` y limpia `expires_at`.
  - *Unmatched*: cualquiera de los participantes puede cerrarlo; la conversación deja de permitir mensajear.

  La expiración se aplica lazy (al enviar/listar), no hay job que marque matches como expired.
- **Conversation** — 1:1 con el match; se crea junto al match.
- **Message** — texto 1–2000 chars; solo participantes de match activo.

### Seguridad

- **UserBlock** — bloqueo entre perfiles: elimina del discovery en ambas direcciones. *Hoy no bloquea la mensajería de un match previo* (gap conocido — ver `11-deuda-tecnica-pendiente.md`).
- **Report** — reporte de moderación con reason/details/status para revisión admin.

### Métricas

- **AnalyticsEvent** — tabla append-only de eventos de producto.

## Push

- **PushToken** — token Expo por sesión/dispositivo con estado active/inactive; re-registro desactiva duplicados.
