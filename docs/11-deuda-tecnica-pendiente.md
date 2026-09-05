# Deuda técnica pendiente

Gaps conocidos entre contratos, documentación y código (auditoría 2026-08-21). Ordenados por impacto.

## Bloqueantes de flujo (móvil)

1. **Onboarding incompletable para usuarios nuevos.** El backend exige fotos y ubicación para `complete`; el móvil no tiene esos pasos y el resolver mapea `photos`→bio y `location`→preferences (`app/(onboarding)/index.tsx:6-25`). Un usuario nuevo queda atrapado en «Todavía faltan campos».
2. **Payload de ubicación divergente.** El cliente (`packages/mobile-shared/src/api/profile-api.ts:126-134`) envía `{lat, lng, city, region, country}`; el contrato vigente es `latitude/longitude/accuracyMeters/recordedAt`. De usarse hoy, fallaría con 422.

## Móvil

3. Sin cliente para: upload-intent/complete de fotos, matches/unmatch, chat REST+WS (sin dependencia de socket), block/report, pause/unpause/delete account, push-token.
4. `isPaused` ignorado en el shell y el feed (el dominio lo modela y el backend lo expone).
5. Estados de feed diferenciados ausentes (poca oferta, perfil incompleto, pausado, offline); solo existe un empty-state genérico con reintento.
6. `home.tsx` sin renombrar a `discover.tsx`; falta tab Matches.
7. Modal de match sin CTA a conversación.
8. Login navega a home sin esperar bootstrap (carrera latente; `index.tsx` la corrige después).
9. Sin tests de las pantallas de onboarding ni del resolver `stepToRoute` (justo donde está el bug de mapeo).
10. Dirección visual sin decidir: tema neobrutal activo vs paleta dating planificada (ver `08-identidad-visual.md`).

## Backend

11. `GET /api/matches` sin preview del último mensaje (lo pedía el spec original).
12. Feed con perfil incompleto responde 403 `profile_incomplete` sin `onboardingRequired`/`nextOnboardingStep`, a diferencia del resto de la API.
13. Campo `discovery_mode` huérfano: migrado y serializado pero sin uso en filtros/scoring del feed — decidir si se implementa o se elimina.
16. Swipe duplicado devuelve 422 genérico por unique constraint, sin error semántico («ya swipé»).
17. Flag `strict_profile_completion` permite desactivar la exigencia de fotos/ubicación en completitud; el contrato v1 las hace obligatorias — **en dev está a `false`** (`config/dev.exs:8`); asegurar `true` en entornos reales.
18. Tests de controller ausentes para bootstrap, safety, settings y match.
19. Webhook Stripe con flag off responde 404 (plug RequireFeature corta antes) donde el spec original decía «200 sin procesar» — desviación aceptada, mantener documentada.
21. **Expiración de match solo lazy**: no hay job que marque `expired`; matches caducados siguen apareciendo en `GET /api/matches` y sus conversaciones son legibles (solo el envío está bloqueado).
22. `PUT /api/me/discovery-preferences` acepta cualquier `distance_km > 0` y no valida `age_min <= age_max` fuera de la completitud; un perfil ya completo puede quedar silenciosamente incompleto al guardar preferencias inválidas.
23. `set_tags`/`set_blocked_tags` descartan silenciosamente IDs desconocidos e ignoran el flag activo del catálogo.

## Proceso

24. Trabajo extenso sin commitear (~58 modificados + ~42 sin trackear tras la reestructuración de docs): consolidar en commits antes de seguir creciendo sobre él.

## Resuelto el 2026-09-05

- Bloqueos aplicados al envío REST/WS y a broadcasts pendientes; envíos serializados con bloqueos por match.
- Historial REST carga el match antes de comprobar participantes; valida límite y cursor.
- Cuenta desactivada con revocación de todas las sesiones y push tokens, desconexión WS y denegación de nuevos logins; funciona antes del onboarding.
- Discovery extraído a `Snack.Dating.Discovery`, scoring/límite en SQL y cursor opaco coherente con el orden. Corregidos el filtro de tags bloqueados y el conteo de tags compartidos con UUIDs.
- Fotos verificadas contra R2 y subida condicional para impedir sobrescrituras posteriores. Retirado el endpoint de creación directa de metadatos.
- Reanudar un perfil completo restaura la visibilidad.

Las fotos se comprueban por metadatos y cabecera binaria; la decodificación completa/moderación y la purga física de datos tras borrar una cuenta siguen fuera de esta implementación.
