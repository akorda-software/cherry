# Rendimiento y verificación

Las optimizaciones deben mantener los contratos y las reglas de visibilidad, seguridad y ranking. Menos consultas o menos trabajo por tecla no equivalen por sí solos a una cifra de usuarios concurrentes soportados.

## Onboarding móvil

- `TextField` separa la decoración de foco/sombra en un componente memoizado. Al cambiar únicamente el texto, sus dos estilos animados no vuelven a evaluarse desde el render de React; el campo sigue controlado y conserva selección, autocorrección y referencias nativas.
- Validación y contador de la bio comparten un único recuento de grafemas. El texto latino sencillo, incluidas las tildes españolas, tiene una vía rápida sin segmentación; marcas combinadas, emoji y CRLF mantienen la vía Unicode. Sin `Intl.Segmenter`, sigue usándose el fallback conservador por puntos de código.
- La bio y sus ideas se deshabilitan durante el guardado: no puede cambiar el borrador después de enviar una versión que va a provocar navegación. Un fallo conserva el texto y permite editar/reintentar.
- Perfil y catálogo comparten peticiones pendientes incluso con refrescos forzados. Resetear la sesión o guardar datos invalida las respuestas antiguas para que no sobrescriban el estado actual.
- La frontera de peticiones autenticadas comprueba una época de sesión en memoria antes de enviar y antes de devolver el resultado. Un guardado exitoso pero tardío de A no puede actualizar las cachés de B ni invalidar su GET pendiente. Cerrar sesión y volver con la misma cuenta también invalida las respuestas anteriores; rotar el token no. No añade lecturas de SecureStore por respuesta.

### Comprobaciones reproducibles

```bash
pnpm test:mobile
node scripts/benchmark-onboarding.mjs
```

El test de `TextField` verifica **3 → 1** invocaciones de `useAnimatedStyle` por cambio de texto en el entorno jsdom: las dos de foco quedan fuera de ese render. No mide ejecuciones por frame en el hilo UI.

También se han exportado correctamente los bundles de producción Hermes de Android e iOS con Metro (`pnpm --dir apps/mobile exec expo export --platform android --platform ios --output-dir <directorio-temporal> --max-workers 2`). Esto verifica el empaquetado/Babel de ambas plataformas; no sustituye compilar/instalar las apps ni probarlas en hardware.

Microbenchmark local de Node 24.11.1, 20.000 recuentos de un texto latino de 240 caracteres: **194,7 → 1,8 ms**. El caso Unicode conserva aproximadamente el mismo coste (**143,1 → 145,5 ms**). Son cifras orientativas de una ejecución, no un umbral de CI ni una medición de Hermes/FPS.

### Verificación en dispositivo pendiente

Usar un **build release**, no Metro en modo desarrollo, en Android e iOS y en el dispositivo menos potente soportado:

1. Escribir rápido y pegar una bio larga; comprobar cursor, autocorrección, selección, contador y teclado.
2. Añadir una idea, borrar texto y volver atrás/adelante. Probar tildes, saltos de línea y emoji.
3. Guardar con red lenta y con un fallo seguido de reintento; comprobar que no se pierden cambios ni se duplica el guardado.
4. Medir JS/UI frame time y commits de React antes/después sobre el mismo dispositivo. El presupuesto a 60 Hz es 16,7 ms por frame; a 120 Hz, 8,3 ms.
5. Comprobar foco, sombra, errores, lector de pantalla, texto grande y «reducir movimiento».

## Listas, imágenes y cargas del móvil (segunda pasada)

- **Chats:** las claves temporales se calculan una vez por match, no en cada comparación del sort. La regla de orden, los empates estables, el fallback de fechas inválidas y las referencias de los objetos se conservan. Store y secciones usan la misma implementación; no hay una caché de objetos que pueda quedarse obsoleta. La ordenación sigue siendo O(n log n), pero el parseo de fechas pasa a O(n).
- **Fotos:** cola de discovery, scroll del feed y carruseles comparten una precarga. Deduplica URLs repetidas/en vuelo y conserva `memory-disk`. El registro JS está limitado a 128 URLs con TTL de 30 segundos; los fallos se pueden reintentar y un fallo antiguo no invalida una precarga más reciente. La cola solo selecciona fotos: ya no retiene un segundo `Set` creciente que impedía reintentarlas durante toda la sesión. Es una reducción de llamadas a la API nativa, no una medición de descargas HTTP ahorradas: las cachés reales siguen perteneciendo a `expo-image`.
- **Likes:** una primera página refrescada invalida la paginación anterior, y una carga de otra sesión no puede soltar la promesa de la actual y provocar peticiones duplicadas. Cada lectura recuerda únicamente los perfiles respondidos/quitados mientras estaba pendiente, para no reinsertarlos desde un snapshot antiguo. Las lecturas futuras vuelven a ser autoritativas; no se mantienen tombstones durante toda la sesión.
- **Deshacer:** likes y discovery verifican la sesión antes de continuar tras esperar un swipe y después de la respuesta. Un deshacer antiguo no envía operaciones con la nueva cuenta ni modifica sus avisos o estado ocupado. Los fallos de acciones antiguas tampoco olvidan las decisiones de otra cuenta. Si el servidor confirma un undo tras una recarga de la misma sesión, se reconcilia la decisión para no ocultar indefinidamente el perfil, sin insertarlo directamente en un snapshot/filtro más reciente.

```bash
pnpm test:mobile
node scripts/benchmark-matches.mjs
```

Microbenchmark local de Node, 2.000 matches sintéticos y 100 ordenaciones: **838,3 → 56,0 ms**, con **67.735 → 3.500 parseos de fecha por ordenación** y resultados idénticos. El input mezcla conversaciones y matches sin mensajes; cada conversación tiene dos fechas. No mide React, scroll, Hermes ni FPS. Las pruebas verifican también el coste de parseo, los empates y que no se muta el input.

## Listas y trabajo en segundo plano (tercera pasada)

- **Chats virtualizados:** `FlashList` sustituye al `ScrollView` con todas las filas montadas. El modelo de filas, la presentación agrupada y la sección horizontal de nuevos matches tienen responsabilidades separadas. Ambos ejes reciclan celdas; se conservan orden, cabeceras, botón manual, pull-to-refresh, avisos y paginación al acercarse al final, sin encadenar cargas al montar. Cada avatar se remonta al cambiar de persona para no mostrar temporalmente la foto de la celda anterior.
- **Reloj de Chats:** las horas relativas se actualizan cada 60 s solo con la pantalla enfocada y la app activa; al volver se actualiza el instante sin mantener un intervalo oculto.
- **Avisos de leído:** un fallo rápido provocaba un reintento cada 400 ms (**151 intentos en un minuto simulado**). El nuevo controlador usa espera exponencial de 1,5–30 s con jitter de ±20% y tope de 30 s: **6 intentos** en la prueba de un minuto con jitter neutro. Los mensajes nuevos y el foco no saltan la espera; no hay timers de leído al ocultar/pausar/desmontar. Conserva mensajes pendientes durante peticiones y no resucita un aviso obsoleto si enviar ya confirmó la lectura. La vía exitosa mantiene su debounce de 400 ms.
- **Peticiones y fotos:** separados cliente JSON, errores y timeout, conservando imports públicos. Fallos síncronos no dejan timers vivos; se validan delays y se limpian señales externas. La subida alternativa por `fetch` ahora respeta su timeout de 120 s y la cancelación, incluso si el transporte ignora abort. Una respuesta tardía no informa falsamente de progreso completado. XHR libera el listener también cuando `send` lanza una excepción.
- **Actividad:** no solicita el resumen al montarse ni por refresh estando en segundo plano; lo pide al activarse. Conserva deduplicación/épocas de sesión y absorbe fallos síncronos del adaptador sin congelar el poller.
- **Configuración técnica:** presupuestos compartidos en `shared/config/performance.ts`; política de realtime y presentación junto a sus features. Son constantes de build con pruebas de coherencia, no flags remotos ni nuevas reglas de producto. Defaults y puntos de ajuste: [`shared/config/README.md`](../apps/mobile/src/shared/config/README.md).

```bash
pnpm test:mobile
node --experimental-strip-types apps/mobile/src/features/matches/presentation/testing/benchmark-chats-list.mjs
```

El benchmark del **modelo JS**, sin React/layout, dio medianas de **0,014 / 0,155 / 0,859 ms** para 1.000 / 10.000 / 50.000 conversaciones. La prueba con 2.400 matches verifica una ventana simulada, no cuántas vistas decide montar el reciclador nativo. No acredita ahorro de memoria nativa ni FPS. Quedan probar scroll profundo, reordenación, fotos lentas, fuentes grandes, lector de pantalla y vuelta de segundo plano en release Android/iOS.

## Editor e historial del chat (cuarta pasada)

- **Escribir queda dentro del editor:** `DraftComposer` se suscribe al borrador de su conversación. Cambiar texto no vuelve a ejecutar `ChatScreen`, la sesión ni la construcción de su historial. En jsdom, dos cambios de texto pasaban de **3 a 1 invocaciones** del hook de sesión, contando el montaje; no es una medición de commits nativos o FPS. Se conservan el campo controlado, su ref/foco, los avisos de typing y la inserción de ideas.
- **Borradores privados por sesión:** separados de la pantalla en `chat-draft-store.ts`. Solo se retienen textos no vacíos; enviar aceptado o borrar elimina la entrada. Logout/cambio de cuenta limpia los borradores, también en un editor todavía montado; rotar el token no. Cambiar de conversación sin desmontar ya no arrastra el texto ni la persona cacheada de la ruta anterior. No hay persistencia en disco ni una evicción silenciosa de trabajo sin enviar: la memoria de borradores reales sigue siendo proporcional a esos textos pendientes.
- **Reconexión y contadores:** una prueba reprodujo que el resumen de A se publicaba dentro del callback autenticado, antes de que la frontera rechazase `session_changed`; otra lo reproducía después de desmontar el chat. Ahora se devuelve el resultado sin efectos laterales y solo se publica después de validar la sesión y comprobar que el hook sigue activo.
- **Fusión de mensajes:** las entradas ordenadas se concatenan o fusionan de forma estable sin un sort general; si se detecta desorden interno se conserva el fallback anterior. Se mantienen los dos desempates, deduplicación sin reemplazos, orden de `added`, referencias originales, fechas inválidas y ausencia de mutación. Sigue habiendo un Set O(n) y copia/parseo O(n+k); no es una operación O(1).
- **Timeline:** se calcula el día local una sola vez por entrada, no de nuevo para cada pareja de vecinos. Se conservan agrupación, alias, separadores y fallback temporal. Continúa siendo O(mensajes + outbox), sin cachés que crezcan durante la sesión.

```bash
pnpm test:mobile
node scripts/benchmark-chat.mjs
TZ=Europe/Madrid pnpm --filter @cherry/mobile test src/features/chat/domain
TZ=America/New_York pnpm --filter @cherry/mobile test src/features/chat/domain
```

Las regresiones diferenciales comparan 1.000 pares deterministas de inputs con ambos desempates y 500 timelines con el algoritmo anterior. Incluyen desorden, duplicados, fechas inválidas, cambios de día/año y horario de verano. Las **50 pruebas del dominio** pasan también en las dos zonas horarias indicadas.

Microbenchmark sintético de Node, 2.000 mensajes y mediana de cinco tandas de 200 llamadas: timeline con el mismo remitente **175,5 → 68,2 ms**, con **11.997 → 2.002 construcciones de Date por llamada**. La mejora temporal de merge ordenado es pequeña; lo acreditado es eliminar sort/comparadores. El fallback desordenado permanece aproximadamente igual (**40,8 → 41,2 ms**). El script compara resultados completos antes de medir. No mide Hermes, memoria nativa, desplazamiento ni FPS.

## Capacidad del backend

### Optimizaciones implementadas

- Las filas de tarjetas incorporan ubicación/preferencias del viewer en el mismo statement: **2 → 1 consultas** por lote, sin cambiar los payloads ni exponer coordenadas.
- Las lecturas de likes/compatibilidad unen las preferencias actuales en la misma consulta: **2 → 1 consultas** sin preload. También corrige el uso de preferencias precargadas obsoletas que podían omitir filtros recién modificados.
- El historial del chat usa el rango compuesto `(inserted_at, id)` sobre el índice existente. Mantiene el desempate y los cursores legacy, y rechaza límites fuera de 1–100 antes de consultar.
- El barrido de matches caducados procesa **500 filas por tick** por defecto, con `SKIP LOCKED` y pausas entre lotes para no acaparar conexiones. Las reglas de caducidad en lectura/envío siguen siendo inmediatas, independientemente de este mantenimiento.

Benchmark SQL sintético local, 50.000 mensajes y cursor tras 45.000: mediana **3,965 → 0,028 ms**, con **45.001 → 0 filas descartadas** y resultados idénticos. Los tests verifican además el número de consultas y el procesamiento de filas sin esperar a un match bloqueado. Reproducción, límites y detalles: [`apps/backend/bench/README.md`](../apps/backend/bench/README.md).

### Feed de discovery — segunda pasada

En radios limitados, la exclusión de swipes mantiene una búsqueda exacta por el índice `(actor_profile_id, target_profile_id)` en vez de recorrer los swipes recibidos por cada candidato y filtrar luego por viewer. Sin expansión de distancia, se elimina además una segunda evaluación de `ST_DWithin` ya garantizada por el filtro. No hay índices nuevos, migraciones, cachés ni cambios de score; con distancia sin límite se conserva el SQL anterior.

Benchmark sintético en tablas temporales, con el SQL real y nueve muestras alternadas:

| Caso | Antes SQL | Después SQL |
|---|---:|---:|
| 5.001 perfiles, 3.202 candidatos, radio de 25 km + expansión | 141,899 ms | 46,493 ms |
| 5.001 perfiles, 1.637 candidatos, sin expansión | 72,752 ms | 24,767 ms |
| 10.001 perfiles, 6.375 candidatos, con expansión | 412,116 ms | 155,737 ms |

Se comparan filas completas idénticas —incluidos score, tier, fotos y señales— en páginas 1–2 y con un viewer con historial de actividad. El número de consultas sigue siendo dos (contexto + ranking) y el coste en candidatos sigue siendo lineal. Estos datos no son comparables directamente con el benchmark poblacional antiguo ni con producción. Script y EXPLAIN: [`apps/backend/bench/README.md`](../apps/backend/bench/README.md#discovery--segunda-pasada-2026-10-15).

### Actividad, autorización WS y push — tercera pasada

- `ActivitySummary` compone los agregados originales: **2 → 1 statements** para los contadores, sin hidratar listas y con un único snapshot SQL. Las reglas siguen en las consultas de Inbox/ReceivedLikes.
- `ConversationAccess` separa autorización de persistencia. Los checks booleanos de typing/broadcast seleccionan **1 en vez de 15 columnas**, sin construir structs de conversación/match ni cachear permisos. Las rutas que necesitan los datos completos conservan su resultado detallado y errores.
- Push carga **2 en vez de 12 columnas por dispositivo**. Los rechazos `DeviceNotRegistered` se actualizan juntos: **1 + N → 2 consultas**, sin actualizar si no hay rechazos y limitando los IDs a los tokens enviados/rechazados. `PushConfig` valida lotes y timeouts; defaults conservados, sin ajustar ningún entorno real.

Las regresiones acreditan menos roundtrips, columnas e hidratación y la eliminación de escrituras N+1. Dos procesos del benchmark **no mostraron una mejora de latencia estable**; no se atribuye una cifra de velocidad ni capacidad concurrente a este lote. Reproducción, configuración y límites: [`apps/backend/bench/README.md`](../apps/backend/bench/README.md#activity--ws--push--tercera-pasada-2026-10-15). Suite backend: **660 pruebas pasan** sobre la BD local de test verificada; fixtures revertidos y tablas vacías al terminar.

### Fotos y mantenimiento — cuarta pasada

- El barrido de fotos ya tenía `LIMIT` y default **200 por tipo**: se conserva ese presupuesto y se valida ahora el rango **1–1000** antes de consultar/borrar. El sweeper recibe `batch_size` configurable y valida sus temporizadores; la cadencia y la gracia de cinco minutos no cambian.
- Se seleccionan solo ID/clave de las fotos pendientes. Los borrados exitosos se marcan en una sola escritura; los fallos quedan pendientes para reintentar. No se mantiene una transacción SQL abierta durante las llamadas al storage. Con tres fotos y tres intents: **6 → 4 consultas**; sin pendientes: **2 consultas**, sin UPDATE vacío.
- Perfil propio y completitud precargan solo fotos activas. Un caso con 100 fotos inactivas y dos activas pasa de **102 → 2 filas de fotos hidratadas**, manteniendo payload, orden y reglas de completitud. Las cuotas históricas de subida no cambian.

Regresiones específicas: **8 pruebas pasan**; suite backend: **668**. Storage simulado y fixtures sandbox en una BD local de test verificada; no se han borrado objetos reales ni medido latencia/capacidad. Permanecen sin cambios la purga completa por cuenta y la selección del barrido sin cursor/orden: fallos persistentes en un lote pueden retrasar otras filas. No se promete drenaje inmediato de un backlog grande.

### Medir la capacidad real

La capacidad máxima todavía no está medida. Debe verificarse contra un entorno de pruebas aislado con datos ficticios, nunca mediante carga no acordada sobre producción o un servicio compartido.

Para una comparación útil:

- Mantener hardware, tamaño/distribución de datos, pool, índices y versión iguales entre baseline y cambio. Un feed de 50 perfiles no representa un radio con miles de candidatos.
- Simular **usuarios distintos** y una mezcla representativa de feed, resumen, likes, chats y conexiones WebSocket. Repetir consultas de una sola cuenta mide un caso caliente, no usuarios concurrentes.
- Subir la carga por etapas, con pausas reales entre acciones. Registrar peticiones/s, usuarios activos, conexiones abiertas, p50/p95/p99 y errores; no confundir conexiones de socket con peticiones en ejecución.
- Vigilar CPU/memoria del BEAM y PostgreSQL, tiempos de consulta y de espera del pool, procesos/mailboxes, bloqueos, I/O y temperaturas. Usar métricas/EXPLAIN antes de aumentar `POOL_SIZE` o `work_mem`.
- Comprobar bajo concurrencia que no aparecen matches duplicados, mensajes perdidos, respuestas incorrectas ni degradación del ranking/visibilidad.
- Detener la etapa cuando se incumpla el objetivo de latencia/error acordado, crezca sostenidamente una cola o se alcance un límite de recursos. Hacer también una prueba sostenida al nivel aceptado para detectar acumulaciones.

No se han cambiado la infraestructura, los límites del pool ni el número de réplicas. El backend sigue siendo de **una réplica**: añadir réplicas sin distribución Erlang/PubSub rompería los broadcasts del chat. Límites pendientes: [deuda técnica](./11-deuda-tecnica-pendiente.md).

## Cierre de la fase teórica

Cuatro pasadas locales, sin migraciones ni dependencias nuevas, mantienen contratos y separan los hotpaths identificados. A partir de aquí, otra optimización debe partir de una medición o un fallo reproducible, no de seguir reescribiendo por intuición.

La siguiente fase es validar el build release y los flujos reales en Android/iOS, y después medir carga representativa con usuarios ficticios distintos y objetivos de latencia/error acordados. El coste lineal del feed y la construcción del historial siguen siendo límites conocidos; no se ha establecido una cifra de usuarios concurrentes soportados ni se declara listo un lanzamiento con personas reales (ver deuda funcional/operativa pendiente).
