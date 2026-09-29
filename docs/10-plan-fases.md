# Plan de fases

Secuencia de entrega con **estado real**. El detalle de avance vivo está en [`progress.md`](./progress.md); las reglas de entrega originales pueden recuperarse del historial de git (`docs/dating-technical/delivery-plan.md`).

Reglas: slices verticales completas antes que fundaciones aisladas; no construir ranking avanzado antes de que discovery funcione end-to-end; moderación y seguridad nunca pospuestas tras el lanzamiento; reglas de producto centralizadas en el backend.

## Fase 1 — Fundaciones de producto ✅ (backend)

- [x] Auth Apple/Google con sesiones Phoenix
- [x] Schema de perfil y preferencias (drafts incluidos)
- [x] Catálogo de tags (52 con emoji, seedeado)
- [x] Upload de fotos (upload-intent + complete) con almacenamiento local o R2/S3
- [x] API y contratos de onboarding
- [x] Enforcement de completitud server-side
- [ ] *Móvil:* flujo de onboarding completo (parcial — ver Fase 4)

## Fase 2 — Discovery y matching ✅ (backend) / ~ (móvil)

- [x] Ubicación con PostGIS + rejilla 500 m
- [x] Pipeline de discovery query + scoring + boost de nuevos usuarios
- [ ] Fallback por expansión de distancia con poca oferta (hoy solo devuelve lo encontrado)
- [x] Persistencia de swipes + match mutuo
- [x] `distanceLabel` privacy-safe generado por backend
- [x] Móvil: feed con like/dislike optimista
- [ ] Móvil: estados de feed (vacío, poca oferta, perfil incompleto, pausado, offline)

## Fase 3 — Chat y ciclo de match ✅ (backend) / [ ] (móvil)

- [x] Modelo conversación/mensaje; mensajería solo texto
- [x] Expiración del match a 30 días sin mensajes (D-2026-09-29; antes 7); primer mensaje la limpia
- [x] Unmatch; WebSocket en vivo con REST como historia
- [ ] Móvil: lista de matches, chat REST+WS, feedback de match con CTA a conversación

## Fase 4 — Seguridad, admin y métricas ~

- [x] Backend: block/report/pause/unpause/delete account; reportes con estado para revisión
- [x] Backend: `analytics_events` append-only
- [ ] Móvil: block/report desde el feed; settings de cuenta (pause/delete)
- [ ] Admin: endpoints/vistas de revisión (hoy solo funciones de contexto)
- [ ] Captura real de eventos de producto desde el móvil

## Fase 5 — Refinamiento [ ]

- [ ] Ajuste de pesos de ranking con métricas reales
- [ ] Tuning del fallback por poca oferta
- [ ] Push notifications lado móvil (registro de token y recepción). *El envío backend ya está implementado: new match/new message vía Expo Push (`notifications.ex`)*
- [ ] Anti-abuso activo (rate limits de swipes, patrones de creación)
- [ ] Mejoras de admin workflow

## Orden recomendado para desbloquear el MVP móvil

1. Corregir resolver `nextOnboardingStep` y payload de ubicación del cliente.
2. Paso **location** (expo-location → `POST /api/me/location` + remediación por permiso denegado).
3. Paso **photos** (picker + compresión + upload-intent → PUT → complete; en dev, almacenamiento local).
4. Pantalla review + completion → entrada al shell.
5. Matches list → chat REST+WS.
6. Safety + settings de cuenta.
7. Push tokens y notificaciones.
