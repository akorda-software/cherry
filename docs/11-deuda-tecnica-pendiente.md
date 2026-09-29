# Deuda técnica pendiente

Gaps conocidos entre contratos, documentación y código (auditoría 2026-08-21). Ordenados por impacto.

## Bloqueantes de flujo (móvil)

1. **Onboarding incompletable para usuarios nuevos.** El backend exige fotos y ubicación para `complete`; el móvil no tiene esos pasos y el resolver mapea `photos`→bio y `location`→preferences (`app/(onboarding)/index.tsx:6-25`). Un usuario nuevo queda atrapado en «Todavía faltan campos».

## Móvil

3. Sin cliente para: chat WS (sin dependencia de socket) y push-token. *(Los clientes REST de fotos, likes, perfil público, matches, chat, safety, settings y resumen existen desde 2026-09-29 en `@snack/mobile-shared`; falta usarlos en la app.)*
4. `isPaused` ignorado en el shell y el feed (el dominio lo modela y el backend lo expone).
5. Estados de feed diferenciados ausentes (poca oferta, perfil incompleto, pausado, offline); solo existe un empty-state genérico con reintento.
6. `home.tsx` sin renombrar a `discover.tsx`; falta tab Matches.
7. Modal de match sin CTA a conversación.
9. Sin tests de las pantallas de onboarding ni del resolver `stepToRoute` (justo donde está el bug de mapeo).
10. Dirección visual sin decidir: tema neobrutal activo vs paleta dating planificada (ver `08-identidad-visual.md`).

## Backend

17. Flag `strict_profile_completion` permite desactivar la exigencia de fotos/ubicación en completitud; el contrato v1 las hace obligatorias — **en dev está a `false`** (`config/dev.exs:8`); asegurar `true` en entornos reales.

## Proceso

24. Trabajo extenso sin commitear (~58 modificados + ~42 sin trackear tras la reestructuración de docs): consolidar en commits antes de seguir creciendo sobre él.

## Resuelto el 2026-09-29 (bienvenida, Yo y Ajustes)

- #8 El login ya no navega a Descubrir: tras entrar vuelve a `/` y `app/index.tsx` espera al bootstrap para decidir (onboarding o Descubrir).
- Recargar el bootstrap con uno ya cargado lo revalida en segundo plano (los guards no desmontan la zona privada al pausar el perfil) y descarta respuestas que llegan tras cerrar sesión o tras una recarga más reciente.
- Cerrar sesión deja la sesión local limpia aunque falle revocarla en el servidor (sin red o cuenta ya borrada).
- Pausa/reanudación y borrado de cuenta usados desde la app (pestaña Yo y Ajustes); el borrado limpia la sesión y vuelve a la bienvenida.

## Resuelto el 2026-09-29 (ranking de discovery v2)

- #13 `discovery_mode` se conserva como preferencia de presentación del cliente (swipe o feed): el feed y su orden son los mismos en ambos modos (D-2026-09-29).
- #22 `PUT /api/me/discovery-preferences` valida en cada guardado, también parcial: `distance_km` ∈ {10, 25, 50, 100, 999999}, edades 18–100 y `age_min ≤ age_max`. Si falla, 422 por campo sin guardar nada. La migración `20260929113715` normaliza los valores antiguos (distancia a la siguiente opción; edades invertidas se intercambian).
- Pendientes relacionados:
  - El paso de preferencias del móvil usa texto libre para la distancia y debe pasar a un selector cerrado; cualquier otro valor recibe 422.
  - El coste del feed es lineal en candidatos (unos 20–25 µs cada uno). Con decenas de miles de candidatos en un radio habrá que precalcular.
  - Aplicar `compatible_only` de forma simétrica está pendiente de validar con el propietario.

## Resuelto el 2026-09-29 (almacenamiento, etiquetas y datos de demo)

- #23 `PUT /api/me/tags` y `/api/me/blocked-tags` rechazan con 422 `invalid_tags` los IDs desconocidos, mal formados o inactivos y con 422 `tag_conflict` una etiqueta que quedaría a la vez positiva y bloqueada (con bloqueo de fila del perfil para evitar carreras).
- Fotos sin R2: almacenamiento local (`STORAGE_ADAPTER=local`, por defecto en dev) con el mismo contrato de subida; el paso de fotos del onboarding ya se puede completar en dev e instancias propias (el móvil sigue pendiente, #1).
- `PUT /api/me/photos/order` expuesto; la reordenación exige la lista completa de fotos activas y ya no deja fotos con posiciones temporales cuando alguna conserva su sitio.
- Login de desarrollo por persona (`{email}`) y `priv/repo/demo_seeds.exs` con datos de demo realistas.
- Pendiente relacionado: borrar una foto no elimina el binario (ni en disco ni en R2) ni compacta posiciones.

## Resuelto el 2026-09-29 (API social)

- #2 Cliente de ubicación con el contrato `latitude/longitude/accuracyMeters/recordedAt`.
- #11 `GET /api/matches` (y `GET /api/conversations`) con foto, último mensaje descifrado y `unreadCount` (tabla `conversation_reads`), en una consulta.
- #12 403 del feed con `onboardingRequired`/`nextOnboardingStep`; los perfiles en pausa reciben 403 `profile_paused`.
- #16 Swipes con errores semánticos: 409 `already_swiped`, 422 `cannot_swipe_self`/`invalid_action_type`, 404 `profile_not_found` si el destino no existe o no es visible.
- #18 Tests de controller para bootstrap, safety, settings, matches y chat.
- #21 Matches caducados (30 días) fuera de listas, badges y perfil público; historial REST cerrado para conversaciones no activas; barrido periódico que marca `expired`.
- Carrera de likes simultáneos: `record_swipe` serializa cada pareja con un advisory lock de transacción, así que el segundo like siempre ve el primero y se crea exactamente un match (garantía en BD: índice único `idx_matches_canonical_pair`). Test con conexiones reales concurrentes en `test/snack/swipe_concurrency_test.exs`.

## Resuelto el 2026-09-05

- Bloqueos aplicados al envío REST/WS y a broadcasts pendientes; envíos serializados con bloqueos por match.
- Historial REST carga el match antes de comprobar participantes; valida límite y cursor.
- Cuenta desactivada con revocación de todas las sesiones y push tokens, desconexión WS y denegación de nuevos logins; funciona antes del onboarding.
- Discovery extraído a `Snack.Dating.Discovery`, scoring/límite en SQL y cursor opaco coherente con el orden. Corregidos el filtro de tags bloqueados y el conteo de tags compartidos con UUIDs.
- Fotos verificadas contra R2 y subida condicional para impedir sobrescrituras posteriores. Retirado el endpoint de creación directa de metadatos.
- Reanudar un perfil completo restaura la visibilidad.

Las fotos se comprueban por metadatos y cabecera binaria; la decodificación completa/moderación y la purga física de datos tras borrar una cuenta siguen fuera de esta implementación.
