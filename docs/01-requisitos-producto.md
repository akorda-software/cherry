# Requisitos de producto

Reglas de negocio de la v1. Son requisitos de producto: el estado de implementación de cada uno se consulta en `10-plan-fases.md`.

## Autenticación

- Solo **Sign in with Apple** y **Sign in with Google**.
- Sin contraseñas. Phoenix emite la sesión de app; las credenciales del provider solo prueban identidad.
- Un usuario nuevo autenticado sin perfil completo entra directamente a onboarding.

## Perfil

Campos obligatorios para completar:

- Nombre, fecha de nacimiento (la edad se deriva), género, interested-in, qué busco, bio, fotos, tags positivos, tags bloqueados, preferencias de discovery y ubicación.

Reglas concretas:

| Regla | Valor |
|---|---|
| Bio | obligatoria, 20–240 caracteres |
| Fotos activas | 2–4 |
| Tags positivos | máx. 8 (catálogo cerrado) |
| Tags bloqueados | máx. 5 (catálogo cerrado) |
| Catálogo de tags | cerrado, sin texto libre (~47 tags seedeados en categorías: interests, active, lifestyle, values, personality, pets, relationship) |

- `gender` y `interested_in` son conceptos separados; `interested_in` admite múltiples selecciones.
- Géneros: man / woman / non_binary.
- `what_i_am_looking_for`: un único valor requerido — relationship / casual / meet_people / go_with_the_flow.
- El perfil pasa por ciclo draft → complete; los drafts nunca aparecen en discovery.

## Preferencias de discovery

- Rango de edad (min/max) sano.
- Distance: 10 / 25 / 50 / 100 km o sin límite.
- Al menos una selección en interested-in.

## Ubicación

- Obligatoria para discovery en v1; sin fallback manual (código postal/ciudad).
- Se usa la ubicación actual del dispositivo, refrescada al abrir la app.
- Solo se almacena ubicación aproximada (rejilla de 500 m); nunca se exponen coordenadas exactas.
- Si el permiso se deniega, el onboarding no puede completarse y discovery queda bloqueado.

## Discovery feed

- Sin caps diarios artificiales; likes ilimitados.
- Los perfiles del feed respetan filtros duros: compatibilidad mutua de género/edad/intent y tags bloqueados.
- La distancia se respeta primero; si hay poca oferta, se expande gradualmente (sin saltos bruscos) antes que relajar reglas críticas.
- Nunca se ignoran tags bloqueados ni compatibilidad de género.
- Ranking por capas: elegibilidad → score de compatibilidad (overlap de tags, reciprocidad, completitud, actividad, bonus de distancia, factor exploratorio) → ajustes de calidad (reply/ghost/report rate, con peso ligero).
- Compatibilidad pesa más que distancia pura.
- Las cards muestran solo campos seguros: nombre, edad, bio, fotos, intent, distancia aproximada (`distanceLabel`). Sin coordenadas ni datos de moderación.

## Matching

- Match solo por like mutuo; dislike oculta el perfil; sin undo en v1.
- El match expira a los 7 días si nadie envía mensaje; el primer mensaje lo limpia.
- Unmatch permitido para ambos participantes.

## Chat

- Solo texto (sin imágenes/audio/vídeo), mensajes no vacíos.
- Cualquiera de los dos puede enviar el primero.
- Existe solo tras match activo; participantes únicamente.

## Boost de usuarios nuevos

- Boost temporal controlado de visibilidad para nuevos usuarios, reducido cuando hay datos de interacción suficientes.

## Anti-abuso

Protecciones técnicas (no límites de monetización):

- Detección de velocidad de swipe imposible y rate-limiting de comportamiento sospechoso.
- Límites a patrones abusivos de creación de cuentas.
- Flags internas para usuarios sospechosos.

## Seguridad y moderación

Acciones de usuario:

- Block, report, unmatch; pausar perfil; borrar cuenta.
- «Ocultar» no es un estado separado en v1: equivale a dislike.

Capacidades de admin:

- Revisar usuarios, perfiles, reportes y fotos; deshabilitar cuentas.
- Los endpoints admin pueden permanecer privados fuera del contrato móvil.

## Métricas

Captura mínima sobre `analytics_events`: finalización de onboarding y perfil, likes enviados, matches creados, conversaciones iniciadas, primera respuesta, retención D1/D7, reportes y bloques.
