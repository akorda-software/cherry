# Requisitos de producto

Reglas de negocio de la v1. Salvo donde se indica, están implementadas y el backend las aplica; lo pendiente está en `10-plan-fases.md` y `11-deuda-tecnica-pendiente.md`.

## Autenticación

- Solo **Sign in with Apple** y **Sign in with Google**.
- Sin contraseñas. Phoenix emite la sesión de app; las credenciales del provider solo prueban identidad.
- Un usuario nuevo autenticado sin perfil completo entra directamente a onboarding.

## Perfil

Campos obligatorios para completar:

- Nombre, fecha de nacimiento (la edad se deriva; 18+), género, interested-in, qué busco, bio, fotos, tags positivos, preferencias de discovery y ubicación. Los tags bloqueados son opcionales.

Reglas concretas:

| Regla | Valor |
|---|---|
| Bio | obligatoria, 20–240 caracteres |
| Fotos activas | 2–4 |
| Tags positivos | mín. 1 para completar el perfil (la app pide 3 en sus pantallas), máx. 8 (catálogo cerrado) |
| Tags bloqueados | opcionales, máx. 5 (catálogo cerrado); una etiqueta no puede ser a la vez positiva y bloqueada |
| Catálogo de tags | cerrado, sin texto libre: 52 etiquetas con emoji en 7 categorías (interests, active, lifestyle, values, personality, pets, relationship), definidas en `Snack.Dating.TagCatalog` y sincronizadas por `priv/repo/seeds.exs` / `bin/migrate` |

- `gender` y `interested_in` son conceptos separados; `interested_in` admite múltiples selecciones.
- Géneros: man / woman / non_binary.
- `looking_for`: 1–4 valores sin repetir (requerido) — relationship / casual / meet_people / go_with_the_flow.
- El perfil pasa por ciclo draft → complete; los drafts nunca aparecen en discovery.

## Preferencias de discovery

- Rango de edad entre 18 y 100 con mínimo ≤ máximo (el selector de la app llega a 99).
- Distancia: 10 / 25 / 50 / 100 km o sin límite (`999999`). Cualquier otro valor se rechaza.
- Al menos una selección en interested-in.
- «Ampliar distancia si hay poca oferta» (`expand_distance`), activada por defecto.
- «Solo compatibles» (`compatible_only`): exige al menos una etiqueta positiva compartida.
- Las reglas se validan en cada guardado, no solo al completar el perfil (D-2026-09-29).

## Ubicación

- Obligatoria para discovery en v1; sin fallback manual (código postal/ciudad).
- Se usa la ubicación actual del dispositivo (permiso de primer plano). Se envía en el paso de ubicación del onboarding, se refresca en silencio al abrir la app o volver a primer plano si el permiso ya está concedido (como mucho cada 30 min) y se puede actualizar a mano desde Ajustes.
- El backend ignora las actualizaciones a menos de 60 s de la anterior.
- Solo se almacena ubicación aproximada (rejilla de 500 m); nunca se exponen coordenadas exactas.
- Si el permiso se deniega, el onboarding no puede completarse y discovery queda bloqueado.

## Discovery feed

- Sin caps diarios artificiales; likes ilimitados.
- Filtros duros, reevaluados en cada página:
  - Perfil completo, descubrible y no pausado. Ni el perfil ni la cuenta pueden estar borrados.
  - Nunca aparece uno mismo ni alguien a quien ya se ha hecho swipe.
  - Tampoco aparece quien ya te ha dicho que no (dislike). Tu like nunca le llegaría, porque la pestaña de Likes solo muestra likes sin responder. Es simétrico: esa persona tampoco vuelve a verte. Si deshace su «no», vuelves a verla.
  - Bloqueos de usuario en ambas direcciones.
  - Compatibilidad recíproca de género y edad.
  - Intención compatible (ver abajo).
  - **Etiquetas bloqueadas en ambas direcciones.** Se excluye al candidato que tiene una etiqueta que yo bloqueo y al que bloquea una de mis etiquetas positivas: si A no puede ver a B, B tampoco ve a A.
  - «Solo compatibles» de cualquiera de los dos exige al menos una etiqueta compartida (simétrico por la misma razón).
- Intención, matriz simétrica: cada intención ve la suya y «a ver qué pasa»; «a ver qué pasa» ve todas; relación y casual nunca se cruzan. Con varias intenciones basta con que un par (mía, suya) encaje. Si A ve a B, B ve a A (con preferencias recíprocas).
- Distancia: primero siempre todo el radio preferido. Con «ampliar distancia» y un radio acotado, se añade un segundo tramo hasta min(2 × radio, radio + 100 km), que va siempre después de todo el primero. Nunca se relajan otras reglas para rellenar el feed.
- Ranking de 0 a 97 puntos. La compatibilidad por etiquetas pesa más que la proximidad pura:

  | Componente | Puntos |
  |---|---|
  | Afinidad de etiquetas: coseno ponderado por rareza (IDF), compartir una etiqueta rara vale más que una común | 0–45 |
  | Intención: comparten alguna intención / compatible solo vía «a ver qué pasa» | +10 / +4 |
  | Reciprocidad: el candidato ya te ha dado like | +12 |
  | Recién llegado: decrece linealmente en los 7 días posteriores a completar el perfil | hasta +8 |
  | Actividad real: última actividad hace menos de 24 h / 72 h / 7 días | +8 / +5 / +2 |
  | Distancia, dentro del radio del tramo | 0–10 |
  | Exploración determinista por pareja | 0–4 |
  | Reparto justo de atención: likes recibidos en 7 días sin contestar | −min(6, pendientes / 5) |

- El feed indica en cada card si el candidato ya te dio like, si es nuevo y si está fuera de tu radio preferido.
- Fuera de v2: ajustes de calidad por tasa de respuesta, ghosting o reportes.
- Las cards muestran solo campos seguros: nombre, edad, bio, fotos, intent, distancia aproximada (`distanceLabel`). Sin coordenadas ni datos de moderación.

## Matching

- Match solo por like mutuo; dislike oculta el perfil. Se puede deshacer gratis el último «no» durante 10 minutos (D-2026-09-29).
- Likes recibidos visibles y gratis: la pestaña «Likes» muestra quién te ha dado like; si le das like, es match al instante (D-2026-09-29).
- El match expira a los 30 días si nadie envía mensaje; el primer mensaje lo limpia (D-2026-09-29; antes 7 días).
- Unmatch permitido para ambos participantes.

## Chat

- Solo texto (sin imágenes/audio/vídeo), de 1 a 2000 caracteres, cifrado en reposo.
- Cualquiera de los dos puede enviar el primero.
- Existe solo tras match activo; participantes únicamente.

## Boost de usuarios nuevos

- Hasta +8 puntos de ranking al completar el perfil. Decrece linealmente hasta 0 en 7 días.
- Solo cuenta la primera vez que se completa: volver a completarlo no lo renueva.

## Anti-abuso

Protecciones técnicas (no límites de monetización). Implementadas hoy:

- Subida de fotos: máx. 4 intents vivos y 20 por hora por perfil, zona de espera no pública y verificación del binario.
- Ubicación: como mucho una actualización por minuto, siempre en rejilla de 500 m.
- Reportes idempotentes (uno abierto por pareja reporter–reportado).

Pendientes (ver `11-deuda-tecnica-pendiente.md`):

- Detección de velocidad de swipe imposible y rate-limiting de comportamiento sospechoso (también en login y refresh).
- Límites a patrones abusivos de creación de cuentas.
- Flags internas para usuarios sospechosos.

## Seguridad y moderación

Acciones de usuario:

- Block, report, unmatch; pausar perfil; borrar cuenta.
- «Ocultar» no es un estado separado en v1: equivale a dislike.

Capacidades de admin:

- Revisar usuarios, perfiles, reportes y fotos; deshabilitar cuentas.
- Los endpoints admin pueden permanecer privados fuera del contrato móvil.
- Hoy solo existen funciones de contexto (`list_reports`, `update_report`, `disable_profile`), sin rutas ni vistas.

## Métricas

Captura mínima sobre `analytics_events`: finalización de onboarding y perfil, likes enviados, matches creados, conversaciones iniciadas, primera respuesta, retención D1/D7, reportes y bloques. Pendiente: la tabla y `Snack.Dating.track_event/1` existen, pero hoy no se registra ningún evento.
