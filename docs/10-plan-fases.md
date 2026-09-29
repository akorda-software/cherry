# Plan de fases

Secuencia de entrega con **estado real** a 2026-09-29. El detalle de avance está en [`progress.md`](./progress.md) y los huecos concretos en [`11-deuda-tecnica-pendiente.md`](./11-deuda-tecnica-pendiente.md); las reglas de entrega originales pueden recuperarse del historial de git (`docs/dating-technical/delivery-plan.md`).

Reglas: slices verticales completas antes que fundaciones aisladas; moderación y seguridad nunca pospuestas tras el lanzamiento; reglas de producto centralizadas en el backend.

## Fase 1 — Fundaciones de producto ✅

- [x] Auth Apple/Google con sesiones Phoenix
- [x] Schema de perfil y preferencias (drafts incluidos)
- [x] Catálogo cerrado de 52 etiquetas con emoji, sincronizado en cada migración
- [x] Fotos (upload-intent + subida + complete) con almacenamiento local o R2/S3, zona de espera y borrado físico
- [x] API y contratos de onboarding; completitud validada en el servidor
- [x] Móvil: onboarding completo en 11 pasos, con reanudación en el primer paso pendiente

## Fase 2 — Discovery y matching ✅

- [x] Ubicación con PostGIS + rejilla 500 m
- [x] Ranking v2 en PostgreSQL: afinidad IDF, matriz de intención simétrica, reciprocidad, recién llegados, actividad real, reparto de atención
- [x] Filtros duros simétricos (etiquetas bloqueadas, género/edad, intención, `compatible_only`, dislikes recibidos)
- [x] Ampliación de distancia con poca oferta (`expand_distance`)
- [x] Persistencia de swipes + match mutuo; deshacer el último «no» (10 min)
- [x] Likes recibidos visibles y gratis
- [x] `distanceLabel` privacy-safe generado por backend
- [x] Móvil: Descubrir en modo swipe y feed con una sola cola, perfil completo, filtros y celebración de match
- [x] Móvil: estados de vacío, pausa, perfil incompleto y error
- [ ] Móvil: estado «sin conexión»
- [ ] Móvil: refrescar la ubicación al abrir la app y poder cambiarla después del onboarding

## Fase 3 — Chat y ciclo de match ✅

- [x] Conversación/mensajes de solo texto, cifrados en reposo
- [x] Caducidad del match a 30 días sin mensajes; el primer mensaje la limpia
- [x] Unmatch; WebSocket en vivo con REST como historia; estado de lectura y contadores
- [x] Móvil: lista de chats con matches nuevos, conversación en tiempo real con reconexión, rompehielos y menú de seguridad

## Fase 4 — Seguridad, cuenta, admin y métricas ~

- [x] Backend: bloquear, reportar, pausar/reanudar y borrar cuenta; reportes con estado para revisión
- [x] Móvil: bloquear y reportar desde el perfil y el chat; pausa en Yo y Ajustes; borrado de cuenta
- [x] Móvil: pestaña Yo con edición de fotos, etiquetas, bio y datos básicos; Ajustes y Acerca de
- [ ] Admin: rutas y vistas de revisión (hoy solo funciones de contexto)
- [ ] Purga de datos al borrar la cuenta (hoy solo se borran las fotos)
- [ ] Captura real de eventos de producto (`analytics_events` no se escribe)

## Fase 5 — Endurecimiento previo a lanzamiento [ ]

- [ ] Pruebas en dispositivo real (Android e iOS): login nativo, cámara, ubicación, hápticos, teclado, socket
- [ ] Regenerar el prebuild nativo y sacar `apps/mobile/android/` de git
- [ ] Push notifications en móvil (registro de token, recepción y apertura). *El envío backend ya existe*
- [ ] Anti-abuso activo (rate limits de swipes, login y refresh; creación de cuentas)
- [ ] Modo oscuro
- [ ] Ajuste de pesos de ranking con métricas reales
- [ ] Build móvil reproducible (EAS o equivalente)

## Self-hosting ✅

- [x] Imagen Docker y release con `bin/migrate` (migraciones + catálogo) y `bin/seed`
- [x] Arranque en producción que rechaza configuración incompleta o secretos débiles
- [x] Fotos sin servicios externos (`STORAGE_ADAPTER=local`)
- [x] Guía genérica: [`12-self-hosting.md`](./12-self-hosting.md)
- [x] Licencia AGPL-3.0

## Orden recomendado para lo siguiente

1. Pruebas en dispositivo real y prebuild limpio.
2. Refresco y cambio de ubicación.
3. Push notifications.
4. Panel mínimo de moderación de reportes.
5. Purga de datos al borrar la cuenta.
6. Anti-abuso activo y métricas.
