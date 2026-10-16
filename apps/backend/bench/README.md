# Backend social/chat — 2026-10-14

Lote acotado de cuatro mejoras, sin cambios de payloads, migraciones ni servicios:

1. `ProfileCards.rows/3`: el contexto de ubicación/preferencias del viewer se
   incorpora a la consulta del lote. **2 → 1 consultas**, incluso sin ubicación
   o sin viewer; no cambia la forma pública de las filas ni las señales sociales.
2. Compatibilidad social/likes: las preferencias se unen en la misma consulta,
   eliminando su carga previa. **2 → 1 consultas** para la página de likes y para
   su contador con un perfil sin preload. Un preload obsoleto ya no permite
   ignorar filtros recién cambiados; sin preferencias se conserva el fallback.
3. Historial de mensajes: comparación `(inserted_at, id)` indexable en vez de un
   `OR` que filtraba filas nuevas al paginar profundamente. Se conservan cursores
   `m2`, `m1`, ISO 8601 y el desempate por ID. El contexto ahora valida `limit`
   entre 1 y 100, igual que la API, antes de consultar.
4. Barrido de matches: una sola actualización por tick, como máximo 500 filas
   por defecto (configurable entre 1 y 1000), con `FOR UPDATE SKIP LOCKED`.
   Un lote lleno continúa un segundo después; la conexión se libera entre
   lotes. `expire_stale/1` conserva su contrato manual de actualizar todas las
   filas elegibles. La exclusión perezosa de matches caducados no cambia.

## Evidencia reproducible

Se verificó previamente la BD local `localhost:5510/cherry_test`, con PostGIS
3.5.7, cero usuarios/matches y ninguna conexión de otra aplicación. No se
utilizaron bases de desarrollo ni producción. Las pruebas de concurrencia usan
conexiones independientes y limpian sus fixtures; las demás usan sandbox.

Desde `apps/backend`, con `TEST_DATABASE_URL` apuntando a una **BD local de test
verificada** (no incluir credenciales reales en este documento):

```sh
ERL_FLAGS='+S 4:4' MIX_ENV=test mix run bench/message_keyset.exs
ERL_FLAGS='+S 4:4' mix test test/cherry/social_query_efficiency_test.exs \
  test/cherry/message_pages_test.exs test/cherry/match_expiry_batch_test.exs \
  test/cherry/match_expiry_concurrency_test.exs
```

`message_keyset.exs` exige entorno test, sandbox, host local y nombre de BD que
contenga `_test`. Crea solamente una tabla temporal con la estructura e índices
de `messages`; inserta datos sintéticos y revierte la transacción. Comprueba que
ambas consultas devuelven las mismas 51 filas.

Resultado local: 50.000 mensajes, cursor tras 45.000 filas, nueve ejecuciones
alternadas de `EXPLAIN (ANALYZE, BUFFERS)` después de una primera ejecución:

| Consulta | Mediana ejecución SQL | Filas descartadas por filtro |
| --- | ---: | ---: |
| Antes (`OR`) | 3,965 ms | 45.001 |
| Después (tupla) | 0,028 ms | 0 |

Ambas usan `Index Scan`. Antes, `Index Cond` solo acotaba `conversation_id`;
después incluye el límite compuesto `ROW(inserted_at, id)`. Las latencias son
orientativas, no un SLA ni una medición de producción. El cambio relevante es
dejar de recorrer el prefijo de mensajes en cada página profunda.

Las regresiones de consultas fallaban antes con dos statements; el test del
preload obsoleto devolvía un like ya excluido, y el de `limit: 0` devolvía éxito.
Las pruebas nuevas verifican además empates exactos de microsegundos, fallback
sin preferencias/ubicación, señales de distancia, drenaje de lotes e idempotencia.
La prueba de bloqueo espera el lote en otra conexión mientras mantiene el lock
del match: las otras dos filas caducan sin esperar; la bloqueada se procesa luego.

Suite integrada mediante `scripts/test-backend.sh`: **647 pruebas pasan**,
14,4 s, Elixir 1.20.3/OTP 29, con warnings preexistentes ajenos a este lote.

## Límites

- Si un lote queda incompleto porque todas las filas restantes están bloqueadas,
  se reintentará en el intervalo normal (una hora por defecto). La visibilidad y
  mensajería ya aplican la caducidad sin depender del barrido.
- Este primer lote no cambió ranking/feed, notificaciones, subida de fotos ni
  contratos de los helpers legacy que devuelven listas completas.

## Discovery — segunda pasada, 2026-10-15

Dos cambios acotados, sin migraciones, cachés nuevas ni cambios de scoring:

1. En feeds con radio limitado, `OFFSET 0` mantiene la exclusión de swipes como
   una búsqueda exacta del índice único `(actor_profile_id, target_profile_id)`.
   Es la misma barrera de planificación que ya usa fairness. Con poblaciones
   locales densas, `ST_DWithin` puede estimar una sola fila y provocar un anti
   join que recorra todos los swipes recibidos por cada candidato, filtrando
   después por el viewer. La búsqueda exacta evita ese recorrido. Sin límite de
   distancia se conserva la consulta anterior y su hash de swipes del viewer.
2. Sin expansión de distancia, el filtro geográfico ya garantiza tier 1. Se
   elimina su segunda evaluación de `ST_DWithin` por candidato; distancia,
   radios, redondeos y componentes del score no cambian.

### Reproducción segura

Se volvió a verificar `localhost:5510/cherry_test`: cero usuarios/perfiles y
ninguna conexión ajena antes del lote. PostgreSQL 17.11/PostGIS 3.5.7. Desde
`apps/backend`, con `TEST_DATABASE_URL` apuntando a esa BD local verificada:

```sh
ERL_FLAGS='+S 4:4' MIX_ENV=test mix run bench/discovery_swipe_probe.exs
ERL_FLAGS='+S 4:4' MIX_ENV=test BENCH_PROFILES=10000 \
  mix run bench/discovery_swipe_probe.exs
ERL_FLAGS='+S 4:4' mix test test/cherry/discovery_query_efficiency_test.exs \
  test/cherry/discovery_test.exs test/cherry_web/controllers/api/discovery*test.exs
```

El script exige sandbox, host local y nombre de BD con `_test`. Clona las tablas
e índices en tablas **temporales**, inserta solamente población sintética,
ejecuta `ANALYZE` y revierte al devolver la conexión al sandbox. No ejecuta el
benchmark antiguo `priv/repo/bench/discovery_bench.exs` (ese necesita una BD
`*_bench` y trunca datos). `BENCH_PLAN_DIR=/tmp/opencode/discovery-plans` permite
guardar los EXPLAIN JSON fuera del repositorio.

La muestra tiene 5.001 perfiles, ocho tags de un catálogo de 64, tres fotos y
40 swipes por perfil; todos tienen 30 años y preferencias recíprocas amplias.
Las ubicaciones cubren una franja de hasta unos 80 km al este de Madrid. Se
repite con un viewer que hizo 400 swipes y recibió 800. Se utiliza el mismo
instante de referencia en cada comparación y el SQL real de `PageQuery.build/5`.
El baseline reconstruye solamente las dos expresiones anteriores. Cada
comparación comprueba **21 filas completas idénticas**, incluidos score, tier,
fotos y señales, tanto en página 1 como en página 2.

### Resultados locales

Mediana de nueve `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` alternados por variante,
después de ejecutar ambas consultas una vez:

| Caso, 5.001 perfiles | Candidatos | Antes SQL | Después SQL |
| --- | ---: | ---: | ---: |
| 25 km + expansión, página 1 | 3.202 | 141,899 ms | 46,493 ms |
| 25 km + expansión, página 2 | 3.202 | 142,560 ms | 48,186 ms |
| 25 km sin expansión, página 1 | 1.637 | 72,752 ms | 24,767 ms |
| 25 km sin expansión, página 2 | 1.637 | 74,518 ms | 26,142 ms |
| Viewer activo, página 1 | 2.862 | 138,285 ms | 44,229 ms |
| Viewer activo, página 2 | 2.862 | 137,095 ms | 45,681 ms |
| Sin límite, página 1 (SQL idéntico) | 5.000 | 36,456 ms | 36,492 ms |
| Sin límite, página 2 (SQL idéntico) | 5.000 | 38,071 ms | 38,221 ms |

En el primer caso, el plan pasa de `Index Scan` por `target_profile_id`, con
40 filas descartadas por filtro × 3.202 loops, a `Index Only Scan` con **ambas
columnas en `Index Cond`**, sin filtro residual. Los hits de buffers locales del
statement bajan de 116.533 a 84.416. No cambia el número de consultas de `feed/2`:
contexto del viewer + ranking = **dos**.

El segundo cambio es pequeño: después de aplicar solo la búsqueda exacta, las
medianas sin expansión fueron 25,088/26,739 ms; eliminando además el predicado
duplicado, 24,767/26,142 ms. Lo verificable es pasar de dos llamadas geográficas
a una en el SQL; esa diferencia pequeña de latencia no se considera un SLA.

Con 10.001 perfiles, página 1 con expansión: **412,116 → 155,737 ms**, 6.375
candidatos. Sin expansión: 208,706 → 78,196 ms, 3.250 candidatos; la consulta
sin límite permaneció idéntica (77,945/77,599 ms). Las tablas temporales tienen
heap recién insertado, no se hace VACUUM y el conjunto mayor supera parte del
presupuesto de buffers locales: estas cifras **no son comparables directamente**
con el benchmark poblacional antiguo ni con producción.

### Regresiones y límites

- Nuevas pruebas comparan las filas completas con el SQL previo y comprueban
  páginas completas después de hacer un dislike entre páginas. Mantienen el
  cursor/snapshot, las exclusiones inmediatas y los dos statements por feed.
- Pruebas focales de Discovery: **79 pasan**. Suite integrada mediante
  `scripts/test-backend.sh`: **649 pasan**, 34,8 s, Elixir 1.20.3/OTP 29.
- `mix format --check-formatted` pasa para los cuatro archivos Elixir de este
  lote. El check global detecta formato previo en
  `lib/cherry/identity/document/mrz.ex`, ajeno a estos cambios; no se reformateó.
- El ranking sigue evaluando los candidatos elegibles: **no se ha eliminado su
  coste lineal** ni cambiado scoring, calibración, privacidad o invalidación.
  No se ha medido concurrencia, carga de producción ni capacidad de usuarios.

## Activity / WS / push — tercera pasada, 2026-10-15

Tres mejoras conectadas con los hotpaths existentes, sin migraciones, cachés,
nuevas dependencias ni cambios de payload o reglas de visibilidad:

1. `ActivitySummary` compone las consultas agregadas de `Inbox` y `ReceivedLikes`.
   El resumen pasa de **dos statements a uno**, con un único snapshot SQL y sin
   cargar listas. Los contadores individuales siguen disponibles; las reglas
   siguen siendo propiedad de sus consultas originales.
2. `ConversationAccess` separa autorización de persistencia de mensajes. Los
   checks booleanos de typing/broadcast seleccionan **una columna en vez de 15**
   y no construyen structs de conversación/match. Join, historial y envío siguen
   recibiendo el resultado detallado. Se mantienen los errores, la precisión de
   caducidad y la lectura fresca de bloqueos/cuentas borradas; no hay caché.
3. Push solo carga `id` y `expo_push_token`: **12 → 2 columnas por dispositivo**.
   Los tickets `DeviceNotRegistered` se desactivan juntos, con sus timestamps:
   **1 + N → 2 statements** si hay N tokens rechazados; con tres, **4 → 2**.
   Sin rechazos solo se consulta una vez, sin UPDATE. Se conservan el orden de
   tickets, la exclusión de sesiones revocadas y los errores que debe reintentar
   Oban. Los límites de transporte tienen un módulo de configuración dedicado.

### Reproducción y resultados

Se reverificó `localhost:5510/cherry_test`, PostgreSQL 17.11/PostGIS 3.5.7:
cero usuarios/perfiles/matches y **cero conexiones ajenas a esa BD** antes del
lote. El mismo servidor tiene conexiones a otra BD, que no se utilizó. Solo se
ejecutaron fixtures sintéticos en sandbox. Tras las comprobaciones quedaron
cero usuarios, perfiles, matches, mensajes y tokens push, y cero clientes en la
BD de test. No se hizo carga contra dev ni contra servicios externos.

Desde `apps/backend`, con `TEST_DATABASE_URL` dirigido a esa BD local de test
previamente verificada, sin imprimir la URL ni credenciales:

```sh
ERL_FLAGS='+S 4:4' mix test test/cherry/hotpath_query_efficiency_test.exs \
  test/cherry/social_query_efficiency_test.exs test/cherry/notifications_test.exs \
  test/cherry/notifications test/cherry/inbox_precision_test.exs \
  test/cherry_web/channels/chat_channel_test.exs \
  test/cherry_web/channels/chat_channel_read_test.exs \
  test/cherry_web/controllers/api/match_chat_controller_test.exs
ERL_FLAGS='+S 4:4' MIX_ENV=test mix run bench/activity_chat_probe.exs
ERL_FLAGS='+S 4:4' ../../scripts/test-backend.sh
```

Las regresiones fallaron antes con 2 statements de resumen, 15 columnas de
autorización y 4 statements/12 columnas de tokens push. Comprueban además:
resumen vacío, preferencias actualizadas con preload obsoleto, lectura,
caducidad, bloqueo, cuenta borrada, participantes en ambas posiciones, límite
exacto de caducidad, tickets mixtos y no modificar tokens de otro usuario.

El probe exige sandbox, host local, nombre con `_test` y tabla `users` vacía.
Hay que verificar la ausencia de otros clientes **antes de arrancar Mix**:
después también aparecerían las conexiones del propio pool. Crea 141 perfiles,
100 likes pendientes, 40 matches y 1.000 mensajes; revierte todos los fixtures al
devolver la conexión al sandbox. Reconstruye el resumen previo con los dos
contadores públicos y el booleano previo con la autorización detallada, y exige
resultados idénticos. Cada proceso toma 31 muestras alternadas tras tres warmups.

Medianas de tiempo de pared del contexto (dos procesos independientes, ms):

| Caso | Proceso 1 antes → después | Proceso 2 antes → después |
| --- | ---: | ---: |
| Resumen | 4,462 → 4,101 | 3,467 → 3,514 |
| Permiso booleano | 0,381 → 0,380 | 0,270 → 0,178 |

**No hay mejora de latencia local consistente que atribuir a estos cambios**:
la evidencia estable es menos roundtrips, menos columnas/hidratación y eliminar
las escrituras N+1. No se midió latencia de Expo ni capacidad/concurrencia de
producción. Los agregados aún evalúan las filas elegibles y los helpers legacy
que devuelven listas completas no han cambiado.

### Configuración técnica de push

`Cherry.Notifications.PushConfig` valida también configuración manual de
`Application` bajo `:cherry, :expo_push`; `runtime.exs` valida las variables al
arrancar. Los defaults son los anteriores. No se ajustó ningún entorno real.

| Variable | Clave | Default | Rango entero válido |
| --- | --- | ---: | ---: |
| `EXPO_PUSH_BATCH_SIZE` | `batch_size` | 100 | 1–100 |
| `EXPO_PUSH_RECEIVE_TIMEOUT_MS` | `receive_timeout_ms` | 5000 | 1–15000 |
| `EXPO_PUSH_POOL_TIMEOUT_MS` | `pool_timeout_ms` | 5000 | 1–15000 |
| `EXPO_PUSH_CONNECT_TIMEOUT_MS` | `connect_timeout_ms` | 5000 | 1–15000 |

La concurrencia existente `PUSH_CONCURRENCY` conserva default 4/rango 1–32.
Reducir lotes no reduce el total de dispositivos: aumenta las peticiones por
trabajo. Si un lote falla, se conserva el reintento del trabajo completo (puede
repetir pushes de lotes anteriores; comportamiento previo, no entrega exactly-once).
No se añaden reintentos HTTP internos. No se cambian URL ni credenciales de Expo.

Validación focal: **67 pruebas pasan**. La variable
`EXPO_PUSH_BATCH_SIZE=101` se rechazó antes del arranque con el error de rango
esperado. La suite integrada pasa con **660 pruebas**, más 11 respecto a las 649
anteriores. Formato de los archivos propios y `git diff --check` pasan. El
formato global sigue señalando únicamente `lib/cherry/identity/document/mrz.ex`,
preexistente y no modificado. Persisten warnings previos de OTP/Elixir ajenos.

## Fotos / perfil — cuarta pasada, 2026-10-15

El barrido **ya tenía `LIMIT` y default 200 por tipo**; no se presenta como una
nueva limitación de trabajo que antes fuese ilimitado. Este lote valida el rango
1–1000, expone `batch_size` en `:photo_storage_sweeper`, selecciona solo ID/clave
de las fotos y marca juntos los borrados exitosos. No actualiza lotes vacíos ni
marca fallos como resueltos, y no retiene una transacción durante el acceso al
storage. Cadencia (10 min) y gracia de intents (5 min) conservadas.

Además, perfil propio y completitud usan la consulta de fotos activas para sus
preloads, sin cambiar cuotas históricas, orden del payload ni reglas de perfil.

Desde `apps/backend`, con `TEST_DATABASE_URL` apuntando a la BD local de test
previamente verificada:

```sh
ERL_FLAGS='+S 4:4' mix test test/cherry/photo_storage_batch_test.exs \
  test/cherry_web/controllers/api/profile_photo_history_efficiency_test.exs
ERL_FLAGS='+S 4:4' ../../scripts/test-backend.sh
ERL_FLAGS='+S 4:4' MIX_ENV=test mix format --check-formatted
```

Las regresiones tuvieron **cinco fallos antes y ocho pruebas en verde después**:

- Tres fotos y tres intents: **6 → 4 consultas**, con un UPDATE por tipo; vacío:
  dos SELECT y ningún UPDATE. Se comprueba drenaje de páginas y reintentos.
- Solo se borran fotos elegibles e intents fuera de gracia; para intents
  completados solo se borra `pending/`, nunca la foto definitiva.
- Con 100 fotos históricas inactivas y dos activas, el preload pasa de
  **102 → 2 filas hidratadas**. GET/PUT/complete mantienen el payload; sin fotos
  activas sigue faltando `:photos`, también con asociaciones ya cargadas.
- Lotes y temporizadores inválidos se rechazan; el sweeper transmite su límite.

Storage totalmente simulado. `localhost:5510/cherry_test` reverificada sin otros
clientes ni fixtures antes del trabajo. Suite integrada: **668 pruebas pasan**;
también comprobada al cerrar con **Elixir 1.18.4 / OTP 28**, como CI, en 15,5 s.
En ese toolchain pasa el **formato global**, sin modificar `mrz.ex`; la incidencia
de formato anotada en las pasadas anteriores no se reproduce con esta versión.

No hay benchmark nuevo de latencia ni prueba de R2/carga/concurrencia real. El
barrido sigue sin cursor/orden de reintentos: fallos persistentes pueden retrasar
otras filas. La purga completa de una cuenta conserva su implementación previa;
no se ha cambiado la política de retención ni el trabajo de moderación.
