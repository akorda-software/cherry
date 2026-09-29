# Decisiones

Registro de decisiones **significativas** de producto y tecnología (no de implementaciones concretas). Cada entrada: fecha, contexto, decisión y motivación. Las decisiones que cambien contratos o rumbo se reflejan también en `docs/`.

Convención: una decisión por entrada, orden cronológico inverso. Solo se anota lo que cambia el rumbo o fija un rumbo importante. Cuando una decisión sustituye a otra, se indica explícitamente; el histórico completo vive aquí, no en `docs/` (que describe solo lo implementado hoy). Si este archivo crece demasiado, evoluciona a carpeta `docs/decisions/` con un archivo por decisión.

---

## D-2026-09-29 — Visibilidad social coherente con el feed y medios efímeros

- **Contexto:** La revisión de seguridad del overhaul encontró que el perfil público y el destino de un swipe saltaban los filtros duros del feed (etiquetas bloqueadas, intención, género/edad), que un like histórico mantenía visible a una ex pareja (y su distancia en vivo), que cualquiera sin perfil activo podía hacer swipe, que la card exponía la puntuación (actividad, likes pendientes), que la ubicación aceptaba cualquier geometría y que las fotos subidas o borradas quedaban públicas para siempre.
- **Decisión:**
  1. **Una sola regla de visibilidad** para feed, likes, perfil público y swipe: si no hay match vivo, el otro perfil tiene que ser descubrible y pasar los filtros duros en ambas direcciones; las preferencias de la otra persona hacia mí se relajan solo si tiene un like pendiente hacia mí (su like es su consentimiento). Con match vivo el perfil sigue visible para el chat. Un like antiguo no da visibilidad. Los fallos responden 404 indistinguible.
  2. **Viewer activo** (completo, descubrible, sin pausar) para hacer swipe, deshacer y ver perfiles ajenos, salvo el perfil de un match vivo.
  3. **La puntuación no sale del servidor.**
  4. **Ubicación:** solo lat/lng desde el cliente, siempre en rejilla de 500 m, como mucho una actualización por minuto; la BD solo guarda puntos.
  5. **Fotos efímeras:** claves aleatorias sin id de perfil, subida a zona de espera no pública y publicación al completar; límites de intents; borrado físico al borrar foto o cuenta y barrido periódico de subidas abandonadas; caché de un día en lugar de «immutable».
  6. Deshacer un «no» no depende de que la otra persona siga visible: se deshace y la respuesta lleva `profile: null`.
- **Motivación:** `PRODUCT.md` (anti-predatoria, las etiquetas mandan, bloqueos siempre). Evita acoso tras un unmatch, triangulación por distancia y hosting gratuito en nuestro almacenamiento.
- **Referencias:** `docs/05-backend-api.md`, `docs/06-contratos-mobile-backend.md`, `Snack.Dating.Social`, `Snack.Dating.PhotoStorage`.

---

## D-2026-09-29 — Ranking de discovery v2

- **Contexto:** El ranking v1 tenía estos huecos:
  - Filtraba la intención por igualdad exacta.
  - Solo excluía por etiquetas bloqueadas en una dirección e ignoraba `compatible_only`.
  - Contaba etiquetas compartidas sin distinguir su rareza y usaba `updated_at` como proxy de actividad.
  - No tenía expansión de distancia, y `PUT /api/me/discovery-preferences` aceptaba cualquier distancia.

  `PRODUCT.md` fija que las etiquetas mandan, que los bloqueos se respetan siempre y que la app es anti-predatoria. Con los likes recibidos visibles y gratis, un perfil que se muestra a alguien que no lo habría visto recibe likes que saltan sus preferencias.
- **Decisión:**
  1. **Intención como matriz simétrica** (confirmada por el propietario el 2026-09-29). Cada intención es compatible consigo misma y con `go_with_the_flow`, y `go_with_the_flow` con todas. `relationship` y `casual` nunca se cruzan. Misma intención +10; vía `go_with_the_flow` +4.
  2. **Visibilidad simétrica.** Las etiquetas bloqueadas cuentan en ambas direcciones, como fija `PRODUCT.md`: no se ve a quien tiene una etiqueta que bloqueo ni a quien bloquea una de las mías. Por el mismo principio (si A no puede ver a B, B no ve a A), `compatible_only` de cualquiera de los dos exige al menos una etiqueta compartida. Aplicar `compatible_only` de forma simétrica es una interpretación de implementación y queda pendiente de validar con el propietario.
     **Quien ya dio dislike al viewer tampoco aparece en su feed** (decisión del orquestador del 2026-09-29). La pestaña de likes solo lista likes sin responder, así que un like a quien ya te descartó no lo vería nadie. Es simétrico: quien descartó tampoco vuelve a ver a quien descartó. Deshacer el dislike (`POST /api/discovery/undo` borra el swipe) levanta la exclusión. El índice parcial `swipe_actions_dislikes_received_index` (`(target_profile_id, actor_profile_id) WHERE action_type = 'dislike'`, migración `20260929154521`) permite leer los dislikes recibidos con un index-only scan.
  3. **Puntuación 0–97 en PostgreSQL, en una sola sentencia.** Orden `tier ASC, score DESC, id ASC` con cursor firmado:
     - Afinidad de etiquetas 0–45: Ochiai/coseno ponderado por IDF, `Σw(compartidas) / √(Σw(mías) · Σw(suyas))`, con `w = ln(1 + N / (1 + n_tag))`.
     - Intención +10/+4 y reciprocidad +12 (`liked_viewer`).
     - Recién llegado hasta +8, que decrece en 7 días desde `profiles.completed_at` (la primera vez que se completa).
     - Actividad real +8/+5/+2 (<24 h/<72 h/<7 d) sobre `profiles.last_active_at`. Lo escribe el plug `TrackActivity` como mucho cada 15 min, con un único UPDATE por PK.
     - Distancia 0–10 dentro del radio del tramo y exploración determinista 0–4.
     - Reparto justo de atención: −min(6, likes recibidos en 7 días sin contestar / 5).
  4. **Expansión de distancia.** `discovery_preferences.expand_distance`, activa por defecto. Con distancia acotada, añade un tramo 2 hasta min(2 × radio, radio + 100 km), siempre detrás de todo el tramo 1; el cursor incluye el tramo. Sin límite (999999) no hay tramos. Nunca se relajan otros filtros.
  5. **Pesos IDF en caché versionada** (`discovery_tag_weights`). Un GenServer (`Discovery.TagWeights`) escribe una generación nueva cada 15 min y purga las de más de 2 h. El cursor fija la generación y el instante de referencia, así que ni el paso del tiempo ni un recálculo reordenan un feed en curso.
  6. **Validación de preferencias en cada guardado:** distancia ∈ {10, 25, 50, 100, 999999}, edades 18–100 y `age_min ≤ age_max`. La migración normaliza los valores antiguos.
- **Rechazadas:**
  - Calcular el IDF en cada petición: O(perfiles) por feed para un dato global que cambia despacio.
  - Vista materializada: su refresco bloquea y no deja fijar una versión por cursor.
  - Rellenar el feed relajando filtros duros.
  - Distancia recíproca: se mantiene el radio del viewer, como en v1.
- **Motivación:**
  - La compatibilidad declarada pesa más que la proximidad (45 frente a 10 puntos).
  - La reciprocidad y la actividad real llevan a matches que ocurren.
  - El reparto de atención evita concentrar likes en unos pocos perfiles saturados, sin castigar a nadie más de 6 puntos.
- **Rendimiento:** medido con `priv/repo/bench/discovery_bench.exs` (BD aparte `snack_bench`, 5.000 perfiles sintéticos con unos 490.000 swipes, página de 20). Resultados p50:
  - Sentencia en PostgreSQL: 6–22 ms.
  - `feed/2` de extremo a extremo: 10–23 ms; la página 2 cuesta lo mismo que la 1. El peor caso es distancia sin límite y todos los géneros, con 1.149 candidatos.
  - El viewer con más swipes recibidos (1.385) se sirve en 10 ms.
  - Con 3.000 perfiles: 9–16 ms; con 10.000: 17–42 ms.
  - El coste es lineal en candidatos (unos 20–25 µs cada uno).
  - Medido ya con la exclusión por dislike, que no empeora el benchmark: el índice parcial evita leer del heap el resto de swipes recibidos.
- **Consecuencias:**
  - Con decenas de miles de candidatos dentro de un mismo radio hará falta precalcular (cola de candidatos por usuario o estadísticas de atención por perfil).
  - Los cursores v1 dejan de valer (422 `invalid_cursor`: el cliente reinicia el feed).
  - `discovery_mode` queda como preferencia de presentación del cliente; el feed es el mismo en swipe y feed (cierra la deuda #13).
  - El selector de distancia del móvil debe ser cerrado.
- **Sustituye:**
  - El filtro exacto de intención y la fórmula de scoring de D-2026-09-05, del que se mantiene el patrón SQL + cursor opaco.
  - El «boost reducido con datos de interacción» de las decisiones heredadas, que pasa a ser un decaimiento en 7 días.
- **Referencias:** `apps/backend/lib/snack/dating/discovery.ex`, `apps/backend/lib/snack/dating/discovery/tag_weights.ex`, `docs/01-requisitos-producto.md` (reglas), `docs/06-contratos-mobile-backend.md` (`expandDistance` y semántica del feed).

---

## D-2026-09-29 — Almacenamiento local de fotos para self-hosting

- **Contexto:** Las fotos solo podían subirse a Cloudflare R2 (host `*.r2.cloudflarestorage.com` fijo). Sin R2 configurado, `upload-intent` respondía 503: no se podía completar el onboarding en desarrollo ni montar una instancia propia sin contratar un bucket, lo que choca con «open source y self-hosteable» (`PRODUCT.md`).
- **Decisión:**
  1. Behaviour `Snack.Storage` (`upload_config/1`, `presign_put/3`, `verify_upload/1`, `public_url/1`) con dos adaptadores elegidos por `STORAGE_ADAPTER`: `local` (`Snack.Storage.Local`) y `r2` (`Snack.Storage.R2`, alias `s3`). Por defecto `local` en dev; en prod es obligatorio declararlo.
  2. **Local:** el contrato del móvil no cambia (intent → `PUT uploadUrl` con los headers → `complete`). `uploadUrl` = `<base>/api/uploads/<token>`, con un `Phoenix.Token` que firma storage key, MIME, tamaño máximo y caducidad (el TTL del intent). La ruta es pública y el token es la autorización, como una URL prefirmada. El backend lee el cuerpo crudo por fragmentos con límite, valida MIME y cabecera JPEG/PNG/WebP y publica de forma atómica en `UPLOADS_DIR/<storage_key>` (temporal + enlace duro): nunca sobrescribe (412), igual que `If-None-Match: *`. Las fotos se sirven con `Plug.Static` en `/uploads` (caché inmutable, sin listados). `verify_upload` mantiene la semántica y los errores de R2.
  3. En BD, las fotos locales guardan la ruta relativa (`/uploads/...`) y la API siempre devuelve URLs absolutas: base `PUBLIC_BASE_URL` o, si no está definida, el host de la petición (la misma BD sirve a `localhost`, a la IP de la LAN o a un túnel en dev).
  4. **R2/S3:** el adaptador R2 admite `S3_ENDPOINT` + `S3_REGION` para MinIO, Garage u otro S3 (path-style), sin cambiar el comportamiento con R2.
- **Consecuencias:** en local las fotos pasan a formar parte del estado del servidor: `UPLOADS_DIR` debe estar en un volumen persistente e incluirse en los backups. Phoenix sirve los binarios (suficiente para el volumen esperado; se puede poner una CDN o proxy con caché delante gracias a las cabeceras inmutables). Cambiar de adaptador no migra fotos: las ya guardadas siguen sirviéndose desde `/uploads` mientras exista el directorio. Sin moderación ni decodificación completa de imagen (igual que con R2). Borrar una foto solo la desactiva; la purga física sigue pendiente.
- **Rechazadas:** exigir MinIO/Garage para self-hosting (otro servicio que operar para instancias pequeñas); subida multipart a Phoenix (cambiaría el contrato del móvil); URLs absolutas en BD (rompe al cambiar de host o de dominio).
- **Referencias:** `docs/06-contratos-mobile-backend.md` (Fotos), `docs/05-backend-api.md`, `infra/deploy/README.md`, `lib/snack/storage.ex`.

---

## D-2026-09-29 — Likes recibidos visibles y gratuitos

- **Contexto:** En las apps comerciales ver quién te ha dado like es la función de pago estrella. Snack es 100 % gratuita y anti-predatoria (`PRODUCT.md`).
- **Decisión:** Pestaña «Likes» gratuita. `GET /api/likes/received` lista (like más reciente primero, cursor opaco firmado) a quienes te han dado like y aún no has respondido, con la misma card que el feed; darles like crea el match al instante (`POST /api/discovery/actions`) y un «no» los retira. Se excluyen bloqueos (ambas direcciones), cuentas o perfiles borrados, perfiles pausados, etiquetas bloqueadas (ambas direcciones) y perfiles fuera del género, edad o intención compatible del receptor. Las cards del feed marcan `likedYou`, y `GET /api/me/summary` da los contadores de las pestañas.
- **Motivación:** Gratis sin asteriscos. Los filtros garantizan que un like «forzado» por API nunca salte las preferencias ni los bloqueos de quien lo recibe.
- **Referencias:** `docs/05-backend-api.md`, `docs/06-contratos-mobile-backend.md`, `packages/contracts/CHANGELOG-v2.md`.

---

## D-2026-09-29 — Caducidad de match a 30 días

- **Contexto:** 7 días para escribir generaba una urgencia artificial, contraria al tono de la app («nunca presiona»).
- **Decisión:** Un match sin mensajes caduca a los **30 días** (`config :snack, :match_expiry_days, 30`); el primer mensaje elimina la caducidad. Se aplica al crear el match, de forma perezosa en todas las lecturas (matches, conversaciones, historial, badges, perfil público) y en la mensajería. `Snack.Dating.MatchExpirySweeper` marca `status = "expired"` cada hora para que el estado persistido sea veraz. La migración `20260929120000` alarga a 30 días los matches pendientes creados con la regla anterior.
- **Motivación:** Sin escasez ni culpa; 30 días dejan margen real sin acumular matches muertos.
- **Sustituye:** la caducidad de 7 días de las decisiones heredadas (2026-04-28).

---

## D-2026-09-29 — Deshacer el último «no» gratis

- **Contexto:** En Tinder deshacer es de pago; un swipe accidental a la izquierda frustra.
- **Decisión:** `POST /api/discovery/undo` deshace el swipe más reciente solo si fue un `dislike` de hace menos de 10 minutos y el perfil sigue visible, y devuelve su card para reinsertarla. Se pueden encadenar mientras cada último swipe cumpla la regla. Los likes no se deshacen (pueden haber creado un match y notificado a la otra persona).
- **Motivación:** Comodidad del usuario sin coste; la ventana corta evita convertirlo en un historial de rechazos.
- **Sustituye:** «sin undo» de las decisiones heredadas (2026-04-28).

---

## D-2026-09-05 — Operación inicial: downtime aceptado, backups local + R2 y sin failover

- **Contexto:** Primera aplicación del equipo con aspiración de escala; se prioriza empezar las pruebas en el MS-A2 propio y mantener un coste y una carga de operación asumibles. Acuerdo explícito con el propietario de la infraestructura.
- **Decisión:**
  1. Mantener las tres VMs y el reparto de recursos de `infra/arquitectura.md`. Una réplica de Phoenix sin distribución Erlang.
  2. Usar `stop-first` en actualizaciones y rollback. Aceptar interrupciones de segundos o incluso minutos; el cliente tendrá que reconectar y recuperar historial. No exigir despliegues sin interrupción.
  3. Preparar backups consistentes de PostgreSQL en el SATA local de ~1 TB y también en R2. Frecuencia externa orientativa: cada hora o cada varias horas; retención objetivo: unas diez copias/puntos recuperables recientes. Intervalo y esquema exactos se fijarán al implementar. R2 y las tareas de backup siguen pendientes.
  4. No implantar alta disponibilidad, réplica externa, failover automático ni VPS de reserva en esta fase. Si el MS-A2 falla se acepta la indisponibilidad hasta recuperarlo, sin plazo garantizado. Una alternativa externa solo se estudiará si el uso y el coste lo justifican.
  5. Ventilador dedicado para el PM1735 ya comprado, con entrega prevista en unos dos días según lo indicado el 2026-09-05. Instalarlo y comprobar temperaturas en reposo/carga gradual antes del despliegue y las pruebas sostenidas. La mejora térmica no se da por verificada.
- **Consecuencias:** el tiempo de migración entra en el downtime. Con PGDATA en un disco `backup=0`, vzdump no sustituye a un backup de PostgreSQL. La retención debe preservar las dependencias de restauración; diez copias horarias cubren aproximadamente diez horas. Las primeras pruebas serán con datos ficticios regenerables; configurar y probar backups antes de conservar datos reales.
- **Sustituye:** la propuesta de `start-first` en arquitectura/runbook, el calendario anterior de backups full semanal/diferencial diario como requisito fijo y el simulacro de evacuación a VPS como requisito de esta fase. También retira cualquier promesa de recuperación externa en un día. El resto de la decisión D-2026-09-04 se mantiene.
- **Estado:** decisiones documentadas; no se ha desplegado, cambiado Swarm remotamente ni configurado R2/backups en esta actualización.
- **Referencias:** [Arquitectura](../infra/arquitectura.md), [runbook](../infra/deploy/README.md).

---

## D-2026-09-04 — Runtime del backend: Dokploy+Docker (Swarm) en VM dedicada; systemd queda como plan B

- **Contexto:** Despliegue del backend en el home server (MS-A2, Proxmox, exclusivo para Snack), primero para pruebas de rendimiento y luego producción. Cuatro modelos sobre la mesa: release+systemd+scripts, runner local de Actions, Dokploy de NiPoGi, Dokploy dedicado. Equipo de 2 personas sin dedicación DevOps.
- **Decisión:**
  1. **VM `snack-backend` (.126)**: Dokploy + Docker/Swarm 1 nodo + Traefik + contenedor Snack (imagen GHCR, tag = sha). Builds siempre fuera (GitHub Actions); Dokploy solo descarga y despliega. Panel y API de Dokploy solo por VPN, nada públicos.
  2. **VM `snack-db` (.142)**: PostgreSQL 17 + PostGIS nativos sobre PM1735; la DB nunca pasa por Dokploy.
  3. **Entrada**: Cloudflare → UCG → Caddy → Traefik:80, con cadena de confianza de IP real completa; el 4000 del contenedor nunca se publica.
  4. **Verificación post-deploy**: `/healthz` expone `version` (sha horneado); CI hace polling hasta `version == sha` (mitiga Dokploy #3987: rollbacks silenciosos de Swarm). `/healthz` = liveness sin DB; `/readyz` = ping a Repo.
  5. **Migraciones**: al arrancar el contenedor, con lock siempre activo; expand/contract; nunca `ecto.rollback` en producción (redesplegar N−1).
  6. **1 réplica**, sin distribución Erlang hasta ≥2 (sin libcluster el PubSub del chat no cruza nodos). **Sin runner local**; si algún día: en NiPoGi, nunca en el MS-A2.
- **Rechazadas:** systemd+scripts como principal (habría que construir rollback/health/historial propios; queda plan B en `infra/deploy/`); Dokploy de NiPoGi (jerarquía de confianza); VM separada para el panel (misma caja física = cero HA); rebuild a Ubuntu 24.04 o PG 18 (churn; Debian 13 + PG 17 ya validados).
- **Motivación original:** Operabilidad diaria con UI para 2 devs e imágenes inmutables para facilitar una reconstrucción futura. **Actualización D-2026-09-05:** la recuperación en VPS queda fuera de la fase inicial y sin plazo comprometido.
- **Referencias:** `infra/arquitectura.md` (descripción completa), `infra/deploy/README.md` (runbook), `.github/workflows/ci.yml`.

---

## D-2026-08-21 — Mensajes persistentes con cifrado en reposo (sin relay puro ni E2EE)

- **Contexto:** La app será open source y sin monetización, así que se evaluó convertir el backend en relay puro de mensajería (sin persistir mensajes; historial solo local en cada dispositivo) como bandera de privacidad. El análisis descartó esa vía: un relay puro pierde mensajes para receptores offline salvo que se implementen colas transitorias con ACKs y purga, además de una store local cifrada en móvil con toda la sincronización asociada; degrada la moderación/safety (reportes sin evidencia del servidor) y rompe el historial al cambiar de dispositivo. E2EE real (protocolo tipo Signal) resuelve lo segundo pero añade gestión de claves multi-dispositivo y backups cifrados: complejidad desproporcionada para v1.
- **Decisión:** Mantener el modelo actual — Postgres como fuente de historia (REST paginado + canal WS como transporte en vivo), con matches/conversaciones/mensajes persistidos — y añadir **cifrado en reposo** de los cuerpos de mensaje: los `body` se cifran a nivel de aplicación con una clave gestionada fuera de la base de datos (secreto de entorno/KMS); nada de contenido de mensajes en claro en disco ni backups. Las alternativas quedan registradas como rechazadas para v1: relay puro (pérdida de entrega asíncrona y complejidad de colas/ACKs) y E2EE (evolución futura posible, no compromiso). La narrativa de privacidad del proyecto se apoya en política verificable — código auditable, retención declarada, sin venta de datos, sin ads — no en «no guardamos nada».
- **Motivación:** Mejor producto para el usuario (el historial sobrevive a cambios de dispositivo), safety/moderación intactas y coste mínimo sobre un modelo ya implementado y testeado; el cifrado en reposo neutraliza el escenario de fuga o robo de la base de datos sin tocar contratos ni app.
- **Referencias:** `docs/04-modelo-datos.md` (tabla `messages`), `docs/05-backend-api.md` (chat REST+WS).

---

## D-2026-06-18 — Dirección visual «neobrutal» para la app móvil (en curso)

- **Contexto:** El plan visual de dating (plan de pantallas original, recuperable del historial de git) definía una paleta cálida (Cream/Coral/Mint/Lavender) sobre tokens semánticos. El trabajo en curso de onboarding/discovery aplicó en su lugar un tema «neobrutal» con azul `#3A41E0` como primario (`light-theme.ts`, `tokens/primitives/*`, sin commitear).
- **Decisión:** Avanzar con la dirección neobrutal como tema activo del starter mientras no se retome la paleta dating. La arquitectura de tokens (primitivos → semánticos → temas) no cambia: retematizar sigue siendo editar `themes/` + `tokens/primitives/`.
- **Motivación:** El sistema de temas intercambiables permite cambiar de dirección visual sin tocar componentes. Pendiente de decidir si la paleta dating (Coral) sustituye al neobrutal antes de lanzar las pantallas de producto.
- **Estado:** En curso, sin commitear.

---

## D-2026-05-06 — Contratos mobile-backend v1 para dating

- **Contexto:** Tras el primer pase de backend dating quedaban ambigüedades que bloqueaban el móvil: ciclo de vida del perfil durante onboarding, formato de ubicación, etiquetas de distancia, subida de fotos y semántica de ocultación.
- **Decisión:** Contratos aceptados para v1:
  1. **Draft profiles:** el primer write de onboarding crea un perfil borrador con campos nullable; la validación completa solo ocurre en `POST /api/me/profile/complete`, que devuelve errores estructurados `{error, missing, nextOnboardingStep}`.
  2. **Ubicación:** payload JSON `latitude/longitude/accuracyMeters/recordedAt`; el backend normaliza a una **rejilla de privacidad de 500 m** antes de guardar en PostGIS; ninguna API devuelve coordenadas crudas.
  3. **Distancia:** el backend genera `distanceLabel` y `distanceKmApprox`; el móvil nunca calcula distancia por su cuenta.
  4. **Fotos:** subida directa a R2 con `POST /api/me/photos/upload-intent` (URL firmada SigV4) + `POST /api/me/photos/complete`; Phoenix solo guarda metadatos.
  5. **Ocultar = dislike:** no existe estado separado «hide user» ni endpoint propio.
  6. **Push:** contrato diseñado (`POST /api/me/push-token`) pero implementación después del flujo core.
  7. **Bootstrap:** `GET /api/bootstrap` devuelve `user` + `profile{exists, isComplete, isDiscoverable, isPaused, onboardingRequired, nextOnboardingStep}` y es la fuente de routing del móvil.
- **Motivación:** Fijar los contratos antes de construir pantallas evita rehacer UI. El backend es la fuente de verdad del estado de producto; el móvil solo mantiene estado local transitorio.
- **Referencias:** `docs/06-contratos-mobile-backend.md`; material original en el historial de git.

---

## D-2026-04-28 — Dominio dating en backend con PostGIS y chat WebSocket

- **Contexto:** El discovery necesita filtrado geográfico eficiente y el chat requiere entrega en vivo sobre las sesiones ya resueltas.
- **Decisión:** Contexto `Snack.Dating` con PostgreSQL + PostGIS (`geography(Point,4326)` con índice GiST) para ubicaciones y cálculo de distancias. Chat en tiempo real vía Phoenix Channel (`chat:{conversationId}`) autenticado con el access token JWT validando expiración; REST sigue siendo la fuente de historia.
- **Motivación:** PostGIS da consultas de proximidad indexadas sin infraestructura adicional; el socket de Phoenix reutiliza el mismo token y reglas de sesión que REST.
- **Referencias:** `docs/02-arquitectura.md`, `docs/04-modelo-datos.md`.

---

## D-2026-04-17 — Servicios de auth mock para desarrollo

- **Contexto:** Probar el flujo de sesión en Expo sin configurar Google/Apple nativos ralentiza el desarrollo.
- **Decisión:** Infraestructura de auth con doble implementación: servicios nativos reales y servicios mock seleccionables por entorno, más un endpoint dev `POST /api/auth/dev/test-login` en el backend.
- **Motivación:** Permite desarrollar y testear bootstrap/routing/onboarding end-to-end sin credenciales de provider ni builds nativos.

---

## D-2026-04-13 — Design system con capas de tokens

- **Contexto:** El starter debía ser rebrandeable por app sin reescribir componentes.
- **Decisión:** Tokens primitivos (valores crudos) separados de roles semánticos (surface/primary/text...); los componentes consumen solo semánticos a través de `ThemeProvider`/`useTheme()`; temas intercambiables por contrato. `shared/ui` prohíbe lógica de producto, routing y workflows.
- **Motivación:** Cambiar de marca = editar tokens/tema, no componentes. Evita leakage de producto en la capa reutilizable.
- **Referencias:** `docs/08-identidad-visual.md`.

---

## D-2026-04-13 — Navegación canónica: tabs dueños de rutas, logout como acción

- **Contexto:** Drawer + Tabs anidados pueden duplicar pantallas y deep links.
- **Decisión:** Los Tabs son los únicos dueños canónicos de sus rutas (`home`, `user`); el Drawer solo linkea, nunca registra duplicados. Headers propiedad del layout del Drawer. Logout no es ruta: es acción de presentación que limpia sesión y hace `router.replace` al login. Rutas de módulos opcionales se registran dinámicamente vía registry (`optional-modules.ts`).
- **Motivación:** Una sola pantalla = un solo estado, test y deep link. El registro dinámico permite compilar apps sin el módulo opcional.

---

## D-2026-04-12 — Fundación: monorepo y sesiones propiedad de Phoenix

- **Contexto:** Arranque del proyecto como starter reusable multi-app.
- **Decisión:**
  1. Monorepo pnpm workspaces + Turbo con `apps/mobile`, `apps/backend`, `packages/contracts`, `packages/mobile-shared`; contratos cross-runtime solo en `packages/contracts`. Phoenix single app (no umbrella) con contextos `Accounts` / `Identity` / `Sessions`.
  2. **Phoenix posee la sesión de app**, no Google/Apple: access token corto (JWT con `sub` + `session_id`) + refresh token opaco rotatorio; solo hashes salted en DB con linaje (familia + parent); la rotación es transaccional y la **reutilización de un refresh revoca toda la familia**. Refresh tokens solo en Keychain/Keystore.
  3. Versiones pinned con `.tool-versions` + `.nvmrc`.
- **Motivación:** Control total de emisión/revocación/vinculación de identidades; detección de robo de tokens; menor coste de coordinación que repos separados.
- **Referencias:** `docs/02-arquitectura.md`, `docs/03-modelo-dominio.md`.

---

## Decisiones heredadas de producto dating (2026-04-28)

Fijadas en el foundation de producto dating (2026-04-28, recuperable del historial de git) y vigentes; se listan porque condicionan contratos:

- Auth solo Google/Apple; sin email/password en v1.
- Bio obligatoria 20–240 caracteres; 2–4 fotos activas; máx. 8 tags positivos y 5 bloqueados de catálogo cerrado (~47 tags seedeados).
- `gender` e `interested_in` son conceptos separados; `interested_in` multi-selección.
- `what_i_am_looking_for` único valor requerido (relationship/casual/meet_people/go_with_the_flow).
- Match solo por like mutuo; sin undo (sustituido: D-2026-09-29, deshacer el último «no»); match expira a los 7 días sin primer mensaje (sustituido: D-2026-09-29, 30 días); chat solo texto.
- Likes ilimitados (sin caps de monetización) con protección anti-abuso técnica.
- Compatibilidad pesa más que distancia; la distancia se expande gradualmente si hay poca oferta; jamás se ignoran blocked tags ni compatibilidad de género.
- Boost temporal controlado para usuarios nuevos.


## D-2026-09-05 — Correcciones de acceso, discovery y fotos

- El borrado de cuenta sigue siendo lógico: `users.deleted_at`, perfil oculto, sesiones/refresh/push revocados y sockets desconectados. Un bloqueo impide mensajear en ambas direcciones, incluidas conexiones abiertas.
- Discovery puntúa en PostgreSQL y pagina por `(score DESC, id ASC)`. Cursor firmado y ligado al usuario (1 h); exploración determinista por pareja. Se mantiene el DTO `nextCursor: string | null` y los filtros se vuelven a evaluar por petición.
- Fotos: firma de `Content-Type` e `If-None-Match: *`, verificación autenticada de existencia/tamaño/MIME/cabecera y lectura condicionada por ETag. Se retira la creación directa de metadatos por REST. La migración de fotos caduca intents antiguos pendientes para exigir URLs que no permitan sobrescritura.
- El despliegue requiere ambas migraciones `20260905170000` y `20260905170100`. La primera desactiva también cuentas cuyos perfiles ya estaban borrados; la segunda obliga a repetir las subidas pendientes antiguas. No se purgan datos ni se reactiva ninguna credencial al revertir las migraciones.

---
