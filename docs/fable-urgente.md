# Revisión urgente (Fable 5.1) del overhaul «Libreta kawaii»

Revisión de 10 minutos, 2026-09-29 12:50–13:00 UTC, sobre `feat/kawaii-overhaul` (9 commits, 563 ficheros, hecho por la sesión Opus 5.5). 11 revisores en paralelo; aquí van los informes recibidos. Los que faltan se añaden al final según lleguen.

## Estado general

- Todo commiteado. Typecheck a 0, 650 tests de móvil en verde, backend arranca y sirve peticiones.
- Opus está en «revisión final»: regenera datos de demo y saca capturas de 24 pantallas en dos tamaños. No está bloqueado.
- Contratos coherentes: todas las rutas que llama el móvil existen en el router; campos, enums, paginación, formas de error y canal de chat (`chat:{id}`, `new_message`, `typing`, `send_message`) coinciden entre backend, `@snack/contracts` y app.

## Arreglado en el árbol de trabajo (sin commitear)

1. `apps/mobile/src/features/discovery/presentation/discover-screen.tsx:98`. **Alto.** Tras un 403 `profile_incomplete` la cola quedaba en `incomplete` para siempre; al volver del onboarding, Descubrir redirigía al onboarding en bucle. Ahora se resetea la cola antes de redirigir. 56 tests de discovery en verde.
2. `apps/mobile/src/features/me/domain/profile-summaries.ts:70`. **Bajo.** La distancia sin límite se mostraba como «999999 km» en la pestaña Yo. Ahora «Sin límite».

Opus commitea con `git add -A apps/mobile`, así que se llevará estos cambios en su siguiente commit. Avisarle.

## Para Opus: arreglar

### Backend (ranking y social)

- `apps/backend/lib/snack/dating/social.ex:65-107` y `:185-196`. **Medio.** `swipe_target_status` y `public_visible?` no aplican los bloqueos de etiquetas bidireccionales (ni intención, ni género/edad). Flujo real: cargo el feed, añado una etiqueta bloqueada, abro una tarjeta cacheada en el cliente: `GET /profiles/:id` la devuelve y el like funciona. Si esa persona ya me había dado like, se crea un match entre dos personas cuyas etiquetas dicen que nunca deben verse. El feed y la bandeja de likes sí lo aplican; solo estas dos entradas lo saltan. Arreglo: añadir el mismo `NOT EXISTS` sobre `profile_tags × profile_blocked_tags` en ambas direcciones que usa `received_likes_query`, salvo que ya exista un match vivo entre la pareja. **Resuelto:** perfil público y swipe aplican los filtros duros del feed en ambas direcciones (etiquetas, intención, género/edad, `compatible_only`) salvo match vivo; fallo = 404 `profile_not_found` indistinguible (`Social.compatible?/2`). Con tests (`social_visibility_test.exs`).
- `apps/backend/lib/snack/dating/discovery.ex:219-221` y `:437-445`. **Bajo.** La afinidad y `shared_tags_count` cuentan etiquetas inactivas del catálogo, mientras las tarjetas las ocultan. El número puede superar las etiquetas que se ven. `TagWeights` también pesa etiquetas inactivas. Decidir junto. **Resuelto:** afinidad, `shared_tags_count`, `compatible_only` y pesos IDF ignoran etiquetas inactivas (los bloqueos por etiqueta siguen aplicando a todas). Benchmark sin cambios apreciables. Con tests.
- `apps/backend/lib/snack_web/controllers/api/discovery_controller.ex:82`. **Bajo.** Deshacer un «no» devuelve 404 `profile_not_found` si el perfil dejó de ser visible, aunque el undo ya se aplicó. El móvil muestra error genérico. Devolver algo tipo `{undone: true, profile: null}` y tratarlo en `discovery-queue.ts`. *Móvil listo:* `discovery-queue.ts` y `received-likes-store.ts` tratan `profile: null` con un aviso amable («Deshecho, pero esa persona ya no está disponible.»), sin error. Backend a cargo de su agente. **Resuelto (backend):** el undo ya no depende de la visibilidad; responde 200 `{undone: true, profile: null}` si la persona ya no es visible. Contrato `DiscoveryUndoResponse.profile: DiscoveryProfileCard | null`.

Verificado correcto en backend: simetría de bloqueos en feed y likes, matriz de intenciones, cursor coherente con el `ORDER BY`, 29 de febrero en Elixir y en SQL, caducidad a 30 días perezosa e idempotente, `discovery_mode` no afecta al ranking, validaciones de distancia y edad, ninguna coordenada expuesta.

### Móvil (onboarding)

- `apps/mobile/src/features/onboarding/presentation/steps/location-step.tsx:512`. **Medio.** Botón atrás de Android desde el paso final: vuelve al paso de ubicación con el CTA deshabilitado y sin auto-avance. Nada que pulsar. Falta `BackHandler` en `done` (solo hay `gestureEnabled: false`, que no cubre Android) o mantener el CTA «Continuar» una vez guardado. **Resuelto:** ubicación ya ofrecía «Continuar» con la zona guardada; `done-step.tsx` consume el atrás de Android mientras confirma y una vez completado (solo deja volver si falla).
- `apps/mobile/src/features/onboarding/domain/resume.ts:47`. **Bajo.** El móvil exige 3 etiquetas positivas para completar; el backend acepta 1. Un perfil con 1 o 2 etiquetas que reentra en onboarding rebota al paso de etiquetas. Decidir 1 o 3 en ambos lados. **Resuelto:** al reanudar basta 1 positiva (`BACKEND_MIN_POSITIVE_TAGS`); dentro del paso la UI sigue pidiendo 3.
- `apps/mobile/src/features/onboarding/domain/preferences.ts:79`. **Bajo.** El paso «a quién quieres conocer» reenvía edades y distancia guardadas sin controles para corregirlas; si el backend las rechaza con 422, el paso no se puede guardar. Fallback a valores por defecto y reintentar. **Resuelto:** ante 422, `saveInterested` reintenta una vez con edad derivada y 50 km (`buildFallbackInterestedPreferences`).

Verificado como ya resuelto: el mapeo de pasos del resolver (bloqueante 1 de `11-deuda-tecnica-pendiente.md`) y el selector cerrado de distancia. **Actualizar ese documento**, que aún los lista como pendientes. **Hecho:** documento actualizado.

### Móvil (discovery, likes, chat)

- `apps/mobile/src/features/likes/application/received-likes-store.ts:251`. **Medio.** Al responder a un like, `recordAction` queda fuera del `try`; si lanza síncronamente, el like desaparece sin rollback, `pending` no se limpia y el contador queda mal. Copiar el patrón de `discovery-queue.ts:384-392`. **Resuelto:** `recordAction` síncrono dentro del `try` (rollback, `pending` y contador correctos). Con test.
- `apps/mobile/src/features/discovery/presentation/swipe/swipe-card.tsx:401`. **Bajo.** `fling()` solo comprueba `isTop`; dos pulsaciones rápidas en los botones lanzan la misma tarjeta dos veces (solo visual). **Resuelto:** marca «ya saliendo» en `fling()` y en el gesto.
- `apps/mobile/src/features/discovery/application/discovery-queue.ts:262`. **Bajo.** `load()` tras guardar filtros conserva `lastPass` y `pending`; «deshacer» reinserta una tarjeta que ya no cumple los filtros. Decisión de producto. **Resuelto:** `load({ filtersChanged: true })` olvida el último «no» y apaga ↺ (`canUndo`) hasta la siguiente decisión. Con tests.

Verificado correcto: worklets con `runOnJS`, reconexión del socket con backoff, limpieza de listeners y `AppState`, feed y swipe comparten una sola cola y cursor, todas las rutas de tabs existen.

### API y contratos

- `packages/mobile-shared/src/api/auth-api.ts:40`. **Bajo.** Fallback de revocación a `/api/session/revoke`, ruta inexistente. Código muerto en la app real; quitarlo o enrutarlo a `DELETE /api/session`. **Resuelto:** siempre `DELETE /api/session`; sin `delete` en el cliente HTTP lanza un error claro. Con tests.

### Seguridad backend (lote 2) — resuelto

- **Alto.** Ubicación: desde HTTP solo `latitude`/`longitude` (rejilla siempre); CHECK de solo puntos + saneado (migración `20260929180000`). Subidas: zona de espera `pending/` no pública, publicación al completar, 4 intents vivos y 20/hora por perfil (429), barrido de subidas abandonadas. Visibilidad: un like histórico ya no da visibilidad (ex pareja solo si descubrible y pasa filtros).
- **Medio.** Swipe/deshacer/perfiles ajenos exigen viewer activo (403 como el feed; salvo match vivo para el perfil público); likes recibidos solo de perfiles completos y descubribles. `score` fuera de la card (opcional obsoleto en el contrato; `person.ts` del móvil ya no depende de él). Envío REST emite `new_message` (una sola vez, en `Dating.send_message/1`). Fotos: borrado físico al borrar foto o cuenta, claves aleatorias, caché de 1 día. Migración `20260929120000` ya no resucita matches caducados.
- **Bajo.** Lock de pareja en `block_profile` + revalidación en `record_swipe`; `mark_read` hasta `message.inserted_at`; ubicación como mucho cada 60 s; likes recibidos con `compatible_only` del receptor y fecha UTC del feed; reportes idempotentes y 404 para perfiles borrados; `demo_seeds` exige BD `*_dev`; `PUBLIC_BASE_URL` obligatoria en prod con `local`; `local.ex` cierra el fd aunque falle `datasync`. Índices `CONCURRENTLY`: no aplicados (chocan con el lock de migraciones obligatorio).

### Build y self-hosting (lote 3) — resuelto

- **Alto.** Aviso al arrancar si un proveedor no tiene audiencias (error si ninguno); variables documentadas en los `env.example`. `Snack.Release.seed/0` + `bin/seed`; `bin/migrate` sincroniza el catálogo tras migrar; la imagen ejecuta `bin/migrate && exec bin/server`. `mix release` genera el tarball (`steps: [:assemble, :tar]`). Verificado con un release real contra una BD vacía (52 etiquetas).
- **Medio.** `PHX_HOST` obligatorio; secretos débiles rechazados; healthcheck en `${PORT:-4000}`; `mix test` solo usa `TEST_DATABASE_URL` o un `DATABASE_URL` cuya BD contenga `_test`.
- **Bajo.** `PORT` inválido con mensaje claro; las variables obligatorias que faltan se listan en un solo error. Dependencias actualizadas (bandit, phoenix, plug, postgrex, mint, hpax, req, phoenix_live_view, lazy_html…); queda `decimal 2.4.1` (el arreglo está en 3.x y `ecto 3.13` exige `~> 2.0`).

## Pendiente de recibir

Informes aún en curso: seguridad backend, chat WS y migraciones, veracidad de docs, copy y tono, rendimiento y app-shell, sistema de diseño, build y self-hosting. Se añaden aquí cuando lleguen.
