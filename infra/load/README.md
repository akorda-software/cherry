# Carga sostenida de Snack

Prueba HTTP y Phoenix WebSocket con perfiles, sesiones y mensajes sintéticos. Recorre autenticación, permisos, ranking, bandeja paginada, historial, escrituras, cifrado, broadcasts y outbox de push. No usa el login de desarrollo ni desactiva comprobaciones de negocio. La capacidad se mide en el servidor de destino: las pruebas locales breves validan el recorrido.

## Preparar una instancia de carga

Usar el mismo release y configuración de producción que se quiere medir, con una **base independiente cuyo nombre termine en `_load`**. El generador rechaza cualquier otro nombre. Ejecutar las migraciones antes de sembrar; no cargar datos de personas reales.

Desde la raíz del repositorio, iniciar el simulador de Expo en otra terminal:

```bash
node infra/load/expo-stub.mjs
```

Configurar la instancia y el proceso de generación con `EXPO_PUSH_BASE_URL=http://127.0.0.1:9320`. El simulador escucha solo en loopback por defecto. Si la API corre en un contenedor, colocar el simulador en su red privada con `EXPO_STUB_HOST=0.0.0.0` y usar su nombre DNS como base URL, sin publicar el puerto al exterior. No enviar los tokens sintéticos a Expo real.

En desarrollo, desde `apps/backend`:

```bash
export DATABASE_URL=ecto://postgres:postgres@localhost:5510/snack_scale_load
export EXPO_PUSH_BASE_URL=http://127.0.0.1:9320
mix ecto.create
mix ecto.migrate
LOAD_USERS=2000 LOAD_HISTORY=20 LOAD_SWIPES=100 LOAD_MATCHES_PER_USER=4 \
  LOAD_PUSH_TOKENS=1 mix run priv/repo/bench/load_fixture.exs
```

El generador crea 2.000 perfiles completos con ubicación y tags, cuatro matches por usuario, 4.000 conversaciones y 80.000 mensajes cifrados. El 10% de los perfiles usa distancia ilimitada. `LOAD_SWIPES` controla swipes adicionales por perfil. `LOAD_HISTORY` son mensajes por conversación; `LOAD_MATCHES_PER_USER` debe ser par, al menos dos y menor que `LOAD_USERS - 1`. Ejecuta `VACUUM ANALYZE` y actualiza los pesos del ranking al terminar.

En un release ya arrancado, el script equivalente es:

```bash
LOAD_USERS=2000 LOAD_HISTORY=20 LOAD_SWIPES=100 LOAD_MATCHES_PER_USER=4 \
  LOAD_PUSH_TOKENS=1 bin/snack eval 'Code.eval_file(Application.app_dir(:snack, "priv/repo/bench/load_fixture.exs"))'
```

La generación detiene los workers únicamente en su propio proceso temporal. La instancia que sirve tráfico mantiene sus workers. `LOAD_RESET=1` **borra los usuarios y jobs de esa base de carga** y reconstruye el escenario; sin él, una base poblada se rechaza.

Antes de cada ejecución, exportar sesiones nuevas sobre los mismos datos:

```bash
LOAD_EXPORT_ONLY=1 LOAD_PUSH_TOKENS=1 mix run priv/repo/bench/load_fixture.exs
```

Con release, usar los mismos flags y `bin/snack eval` anterior. Se revocan las sesiones de la exportación anterior. El manifiesto contiene credenciales reales de esas cuentas sintéticas, se escribe atómicamente con permisos `0600` y por defecto queda en `/tmp/snack-load-actors.json`; `LOAD_MANIFEST` permite cambiar la ruta. Exportar con los mismos secretos de autenticación que la API, copiarlo al generador si está en otra máquina y no compartirlo entre ejecuciones simultáneas. k6 rota sus tokens mediante `/api/session/refresh` antes de que caduquen.

## Ejecutar HTTP y WebSocket

Arrancar la API de carga, habilitar `METRICS_TOKEN` con un secreto propio y comprobar `/readyz`. Ejecutar k6 **desde otra máquina** al medir capacidad, para que el generador no compita por CPU, memoria o red con el servidor. El ejemplo utiliza la imagen de k6 con la que se verificó el escenario:

```bash
mkdir -p /tmp/snack-load-results
docker run --rm --network host --user "$(id -u):$(id -g)" \
  -v "$PWD/infra/load:/work:ro" \
  -v /tmp/snack-load-actors.json:/fixtures/actors.json:ro \
  -v /tmp/snack-load-results:/results \
  -e LOAD_MANIFEST=/fixtures/actors.json \
  -e BASE_URL=http://127.0.0.1:5511 \
  -e HTTP_VUS=100 -e WS_USERS=100 -e TARGET_RPS=50 \
  -e RAMP_DURATION=1m -e HOLD_DURATION=30m -e DOWN_DURATION=30s \
  -e WS_SESSION_SECONDS=300 -e WS_MESSAGE_SECONDS=30 \
  -e LOAD_RESULTS=/results/sustained.json \
  grafana/k6:1.3.0 run /work/sustained.js
```

`BASE_URL` debe apuntar al origen real de esa instancia; el script deriva `ws://` o `wss://` del mismo origen. El manifiesto necesita al menos `HTTP_MAX_VUS + WS_USERS` actores, cada uno con sesión independiente. `HTTP_MAX_VUS` vale `HTTP_VUS` si no se define. `/readyz` se comprueba al comenzar.

La mezcla HTTP incluye feed (30%), resumen de actividad (20%), bandeja (15%), historial (10%), likes recibidos (10%), swipes (5%), envío REST (5%) y lectura (5%). Si un VU no tiene candidato, sustituye el swipe por un envío. Cada socket se une a su conversación, envía mensajes, typing y heartbeats, y mide join, ACK y eventos recibidos. `WS_SESSION_SECONDS` controla la renovación de conexiones; `WS_MESSAGE_SECONDS` es el intervalo de envío **por socket**. Así, 10.000 sockets con intervalo de 30 s añaden unos 333 mensajes/s al tráfico REST.

Los parámetros separan conexiones abiertas de peticiones por segundo. Ajustar el ritmo por usuario a la actividad prevista y registrar ambos: «usuarios activos» por sí solo no define una carga.

Umbrales iniciales de diagnóstico, definidos en `sustained.js`:

| Señal | Umbral |
| --- | --- |
| Errores semánticos/HTTP de la API | < 0,5% / < 1% |
| HTTP p95 / p99 | < 500 / 1.500 ms |
| Join y ACK de mensaje correctos | > 99% |
| Join p95 | < 1.000 ms |
| ACK p95 / p99 | < 500 / 1.500 ms |
| Cierres inesperados de socket | < 1% |
| Iteraciones HTTP descartadas por el generador | 0 |

Los swipes que pierden una carrera contra otro actor (`already_swiped` / `profile_not_found`) se cuentan aparte. Un umbral incumplido devuelve código de salida distinto de cero. El JSON de resultados contiene métricas y umbrales; no incluye tokens ni URLs con parámetros de autenticación. Con `dropped_iterations > 0`, comprobar también el dimensionamiento del generador y sus VUs.

## Progresión y fallos del proveedor

1. Recorrido breve: 50–100 conexiones, 10–50 RPS y 2 minutos de meseta.
2. Referencia: 30 minutos a una carga que cumpla los umbrales, con datos suficientes para mantener candidatos durante toda la prueba.
3. Incrementos: subir conexiones a 1.000, 5.000, 10.000 y 20.000, con mesetas de 15–30 minutos. Ajustar los actores, el ritmo HTTP y el intervalo de mensajes antes de cada nivel.
4. Estabilidad: una hora a la carga objetivo, seguida de recuperación sin tráfico. La memoria y la cola deben estabilizarse y la instancia debe recuperar su latencia normal.
5. Proveedor degradado: repetir la referencia con latencia y fallos de Expo:

```bash
EXPO_STUB_DELAY_MS=500 EXPO_STUB_FAIL_EVERY=5 node infra/load/expo-stub.mjs
```

Parar la instancia anterior del simulador antes de cambiar sus flags. `/healthz` devuelve peticiones y tickets aceptados. Los envíos fallidos deben reintentarse en Oban mientras HTTP y los ACK del chat cumplen su presupuesto. Para comprobar recuperación, volver al simulador sin fallos y observar el drenaje. El móvil aún no registra push en producción; `LOAD_PUSH_TOKENS=1` activa explícitamente este recorrido para medirlo.

## Métricas y diagnóstico

`GET /metrics` requiere `Authorization: Bearer <METRICS_TOKEN>`; sin token configurado, devuelve 404. Peep agrega histogramas en memoria con almacenamiento repartido por scheduler: no acumula una fila por petición entre scrapes. Las etiquetas usan rutas/eventos normalizados, sin IDs de perfiles, SQL ni tokens. Scrape sugerido: 15 s; consultar cada instancia directamente para no mezclar scrapes alternos detrás del balanceador.

Latencias en **microsegundos** (dividir por 1.000 para milisegundos). Consultas Prometheus:

```promql
histogram_quantile(0.95, sum by (le, route) (rate(snack_http_duration_microseconds_bucket[5m]))) / 1000
histogram_quantile(0.95, sum by (le) (rate(snack_db_queue_microseconds_bucket[5m]))) / 1000
histogram_quantile(0.95, sum by (le) (rate(snack_db_query_microseconds_bucket[5m]))) / 1000
histogram_quantile(0.95, sum by (le, event) (rate(snack_channel_event_microseconds_bucket[5m]))) / 1000
histogram_quantile(0.95, sum by (le) (rate(snack_push_queue_microseconds_bucket[5m]))) / 1000
sum(rate(snack_push_failures[5m]))
vm_memory_total
vm_system_counts_process_count
vm_total_run_queue_lengths_total
```

Complementar con CPU, RSS, descriptores abiertos y sockets del host/proxy; conexiones, locks, I/O, consultas lentas y espacio de PostgreSQL; CPU/red/VUs del generador. Para ver backlog y recuperación sin introducir consultas en cada scrape, ejecutar ocasionalmente sobre la base de carga:

```sql
SELECT state, count(*) FROM oban_jobs GROUP BY state;
SELECT count(*) AS due,
       extract(epoch FROM now() - min(scheduled_at)) AS oldest_due_seconds
FROM oban_jobs
WHERE queue = 'push' AND state IN ('available', 'scheduled', 'retryable')
  AND scheduled_at <= now();
SELECT wait_event_type, wait_event, count(*) FROM pg_stat_activity
WHERE datname = current_database() GROUP BY wait_event_type, wait_event;
```

`PUSH_CONCURRENCY` es por nodo (4 por defecto); los workers comparten `POOL_SIZE` con la API. Medir antes de subirlos y sumar el presupuesto de conexiones de todos los nodos. `DB_QUEUE_TARGET_MS`, `DB_QUEUE_INTERVAL_MS` y `DB_QUERY_TIMEOUT_MS` permiten ajustar la respuesta a saturación. `DB_JIT=false` evita compilación de JIT en consultas cortas; comparar explícitamente si el patrón de consultas cambia.

Los jobs de push contienen IDs, se guardan en la misma transacción que el evento y vuelven a comprobar bloqueos, match activo, sesiones y lecturas antes de entregar. Máximo ocho intentos, 30 s por ejecución; mensajes con más de 15 minutos y matches con más de 24 horas se cancelan. Los jobs terminados se podan tras 24 horas. La entrega es al menos una vez: un reintento después de una respuesta incierta puede duplicar una notificación. Un ticket `ok` del simulador o de Expo mide aceptación, no llegada al teléfono; los receipts de Expo quedan pendientes.

El envío REST/WebSocket normal publica al terminar su propia transacción. Si otro módulo lo compone dentro de una transacción mayor, el broadcast se guarda como job de prioridad superior en esa misma cola (tres intentos, 5 s por ejecución). Así, un rollback del llamador no publica un mensaje inexistente.

Guardar junto a cada JSON: commit/diff probado, release y versiones, CPU/RAM, PostgreSQL y almacenamiento, configuración de pool/worker/JIT, tamaño e historial de los datos, conexiones, RPS, intervalo de mensajes, latencia/fallos del proveedor y métricas durante la meseta y recuperación. Comparar ejecuciones con el mismo escenario y cambiar una variable por vez.

## Verificación local del recorrido (2026-10-01)

Release de producción con OTP 28, Elixir 1.18.4, ocho schedulers y pool de diez conexiones. Datos: 60 perfiles, 120 conversaciones y 1.800 mensajes cifrados. Prueba breve: 12 sockets, hasta 30 RPS, meseta de 30 s y rampas de 5 s; Expo con 500 ms de latencia y un fallo cada cinco peticiones.

Se completaron 1.077 peticiones HTTP, incluidas 24 rotaciones de sesión; 36 joins y 102 ACK de mensajes, todos correctos. Cero errores de API, cierres inesperados e iteraciones HTTP descartadas. HTTP p95/p99: 15,2/22,4 ms; ACK p95/p99: 11,0/11,0 ms. La cola terminó con 150 jobs completados y 13 cancelados por eventos ya obsoletos, sin trabajo pendiente. El endpoint de métricas también se comprobó en ese release. Esta ejecución valida el escenario y la configuración de producción; la capacidad objetivo se comprobará con las mesetas largas y el volumen de datos del servidor de destino.
