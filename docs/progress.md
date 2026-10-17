# Progress

Registro de avance del proyecto. Convención: una entrada por unidad de trabajo, con estado. Estado: `[ ]` pendiente · `[~]` en curso · `[x]` hecho.

## 2026-10-17 — Preparación jurídica y backoffice operativo [x técnico / ~ jurídico]

Textos completos por instancia, aviso legal/cookies, Albert titular y cooperativa
solo futura; identidad pública propia configurada. RAT/proveedores, matriz de
aplicabilidad, conservación/bloqueo, riesgo/EIPD/LIA, procedimientos/plantillas y
transición en `compliance/12–16`, **no dictamen ni aprobación**. Especialmente
pendientes arts. 9.1 y 32 LOPDGDD, EIPD/DPD, contratos y cobertura real.
Prueba de tres declaraciones separadas, texto exacto/digest/fecha, idempotencia y
cascada de borrado; pantalla móvil con errores/reintento/derechos y retirada/baja
accesibles. Exigencia y aprobación desactivadas hasta revisión y distribución.

Backoffice activado con un superusuario nominativo, temporal privada y cambio
inicial obligatorio; rotación personal revoca sesiones. Recordatorio de mes
natural para privacidad, no 30 días ni prórroga automática. HTTPS/proxy con peer
Swarm real IPv4 mapeado, allowlist exacta y `no-transform` contra ocultación del
correo del borde, sin tocar firewall/DNS ni relajar CSP. Login/CSRF/cookies/logout
reales y HTTP/cabecera falsa rechazados. Un staff no acredita dos personas.

Commits `eb82e58` + corrección desplegada `4ce5ad0`; [CI 39037164818](https://github.com/akorda-software/cherry/actions/runs/39037164818)
correcto: **773 backend, 985 móvil, 54 compartidas, 29 contratos, seis backups**,
typechecks/formato/compile correctos. Avisos de mocks React/act existentes durante
tests UI; no avisos de compilación backend. Dokploy NiPoGi `jy3_WGK2kKafQb-YfV-hf`
en `done`, Swarm 1/1 y health/readiness públicos 200 con SHA exacto. Una cuenta,
dos fotos, un staff y cero tareas/credenciales staff tras prueba. `cherry_test`
sin usuarios/perfiles/consentimientos/staff persistentes. Recuperación privada
actualizada; copia offline a cargo del titular. Sin APK/IPA, OAuth, moderación de
fotos, bots ni CI deploy; `.expo/devices.json` ajeno conservado. [Estado](./14-backoffice.md).

## 2026-10-17 — Fotos privadas y recuperación protegida en producción [x]

R2 UE privado en tres buckets separados (fotos, copias, registro de bajas),
tokens distintos y limitados por bucket. Dos fotos migradas desde disco con
hashes verificados y claves conservadas para snapshots antiguos; GET firmado
300 s en respuestas autorizadas, renovación con visibilidad/bloqueo/edad/estado.
Sin firma se rechaza; firma caducada 403; antiguas rutas locales/CDN retiradas y
404. El móvil renueva URLs y evita nuevas cachés en disco, **solo código, sin
APK/IPA ni publicación móvil**. No se implementa moderación ni bots.

Copia completa diaria pg_dump→age→R2 privado, siete días, sin fotos, verificada
por descarga de ciphertext; limpieza cada 15 min, check horario y alertas en el
canal operativo existente (solo validación de lectura, sin envío de prueba).
Registro externo previo de bajas e instrucciones técnicas sin identidad/relatos,
acuse y GC condicionado por todas las copias y la BD viva. Recuperación aislada
reaplica todos los registros, invalida sesiones y conserva fotos disponibles;
solo retira referencias ausentes y objetos huérfanos, sin reiniciar galerías.
Ensayo real desde R2/age/PostgreSQL/migraciones: una cuenta, dos fotos, cero
sesiones/credenciales/jobs; BD y ciphertext del ensayo eliminados.

**754 backend, 979 móvil, 54 mobile-shared, 29 contratos y seis backups**, formato,
typechecks, compile sin avisos y diff correctos. Código previo aprobado incluido
en `d1a022d`; `c008473` incorpora CSS al contexto Docker. [CI 39027167214](https://github.com/akorda-software/cherry/actions/runs/39027167214)
correcto y GHCR publicado; deploy manual NiPoGi `hvlN93QbxGTGZ0qYuEWTY` en `done`,
Swarm 1/1, health/readiness 200 con SHA exacto. Borrado y migraciones publicados;
backoffice apagado, cero staff/tareas de borrado; una cuenta y dos fotos conservadas.
Primera copia protegida 11:08:23 UTC y tres timers activos. Sin cambios de
firewall/DNS/OAuth; CI deploy sigue pausado y `.expo/devices.json` ajeno intacto.
Clave age privada en Olares fuera de producción/R2: **pendiente copia offline
del titular**. Jurídico y validación nativa siguen pendientes. [Runbook](../infra/backup/README.md).

## 2026-10-17 — Medida ajena mínima tras borrar al denunciante [x]

Separación aprobada por el titular: el expediente original y todos sus textos/vínculos/avisos/auditoría desaparecen; una suspensión vigente sobre otra cuenta queda en una ficha nueva mínima, con su vía de revisión independiente. No conserva identidad, relato ni datos del denunciante ni cambia automáticamente la sanción. Los recursos pendientes mantienen fecha/asignación y los resueltos solo resultado/fecha/decisor, sin duplicarse. Borrar después la cuenta afectada elimina las fichas. Gate transaccional compartido/exclusivo para no perder decisiones o recursos simultáneos; migración `20261017100000`, API/contrato y etiqueta móvil actualizados.

**737 backend, 975 móvil, 53 mobile-shared y 29 contracts**, suites integradas y typechecks correctos. Cuatro regresiones PostgreSQL con conexiones reales y pruebas de minimización/recursos/rollback. Se resuelve el bloqueo del lote anterior; backups, reservas legales y validación jurídica quedan aplazados por el titular. Sin commit/push/despliegue ni compilación móvil. [Alcance](./15-borrado-y-web-publica.md).

## 2026-10-16 — Segundo lote local: borrado, equipo y web pública [x]

Borrado físico al solicitar baja, liberando correo/OAuth/huella del DNI; cascadas de expedientes/avisos/auditoría, limpieza de jobs y cola durable de archivos/sesiones de proveedor. Protección ante verificación tardía, firma de subida vigente y rollback; sin activar proveedores ni cambiar moderación de fotos. Superusuario y gestión web de equipo, invitaciones de un uso sin correo, contraseñas personales, revocación y bloqueo temporal, protección del último superusuario activado con concurrencia real. Landing y borradores legales/contacto/eliminación, enlaces propios desde config y estudio de agentes sin implementación.

**725/974/53/29**, typechecks, compile warnings-as-errors y formato/diff correctos; capturas Chromium offline a 1440/390 px. **Bloqueo descubierto y reproducido en ese cierre:** borrar al denunciante dejaba una suspensión ajena sin expediente/recurso; resuelto en la entrada del 2026-10-17 tras decisión explícita del titular. Siguen pendientes backups/reservas legales y textos/contactos definitivos. Sin commit/push/despliegue ni compilación móvil; `.expo/devices.json` ajeno intacto. [Estado](./15-borrado-y-web-publica.md).

## Fase 0 — Fundación del starter ✅

- [x] Monorepo pnpm + Turbo: `apps/mobile`, `apps/backend`, `packages/contracts`, `packages/mobile-shared`
- [x] Backend Phoenix: contextos `Accounts` / `Identity` / `Sessions`; callbacks Google/Apple con validación de credenciales; sesiones con refresh rotatorio y revocación de familia
- [x] Móvil: auth nativa Google/Apple, secure storage, session manager con refresh-on-401 y un retry
- [x] Shell Expo Router: público/privado, Stack + Tabs, logout como acción
- [x] Design system: tokens primitivos/semánticos, temas, primitivas y composites
- [x] Runtime config + feature flags vía `GET /api/config`
- [x] Servicios auth mock para dev + endpoint `POST /api/auth/dev/test-login`

## Fase 1 — Documentación de producto dating ✅

- [x] Foundation de producto, PRD (overview/experience/matching/roadmap), plan técnico
- [x] Specs de implementación: schema, contratos v1, plan móvil, pantallas/estilos, matching engine, jobs/ops, anti-abuso

## Fase 2 — Backend dating ✅

- [x] Dominio `Cherry.Dating` con PostGIS: perfiles draft, preferencias, fotos, tags, ubicaciones, swipes, matches, conversaciones, mensajes, bloques, reportes, eventos
- [x] API REST completa: bootstrap, onboarding/perfil, discovery feed + acciones, matches, conversaciones, safety, settings, push tokens
- [x] Subida directa R2: upload-intent firmado (SigV4) + complete
- [x] Chat WebSocket: canal `chat:{id}` con JWT, reglas de join, `send_message`/`new_message`/`typing`
- [x] Grid de privacidad 500 m para ubicación; `distanceLabel` generado por backend
- [x] OpenAPI servido en `/openapi.yaml`
- [x] Última verificación local de backend (2026-09-05): **248 tests**, 0 fallos

## Fase 3 — Contratos mobile-backend v1 ✅

- [x] Draft profiles con validación solo en completion (`profile_incomplete` + `missing` + `nextOnboardingStep`)
- [x] Ubicación JSON lat/lng normalizada a rejilla 500 m
- [x] Contratos de fotos upload-intent/complete, push-token, chat WS documentados

## Fase 4 — App móvil dating ✅ (2026-09-29)

- [x] Bootstrap routing real contra `GET /api/bootstrap` (signed-out / onboarding / app)
- [x] Sistema de diseño «Libreta kawaii» (tokens v2, fuentes, arte, movimiento) y armazón con pestañas Descubrir · Likes · Chats · Yo
- [x] Onboarding en 11 pasos (nombre, cumpleaños, género, a quién, intención, fotos, etiquetas, bloqueadas, bio, ubicación, listo) con reanudación
- [x] Descubrir en modo swipe y feed, perfil completo, filtros, deshacer y celebración de match
- [x] Likes recibidos gratis con match al instante
- [x] Chats: lista con matches nuevos, conversación REST + WebSocket con reconexión y lectura
- [x] Seguridad: bloquear y reportar desde el perfil y el chat; deshacer match
- [x] Yo y Ajustes: edición del perfil, pausa, cierre de sesión, borrado de cuenta y Acerca de
- [x] Clientes API en `mobile-shared` + DTOs en `contracts` para toda la API social

## Fase 5 — Endurecimiento previo a lanzamiento [ ]

- [ ] Pruebas en dispositivo real (Android/iOS): login nativo, cámara, ubicación, hápticos, teclado, WebSocket
- [ ] Push notifications en móvil (registro de token y recepción) sobre el envío ya implementado
- [ ] Refresco y cambio de ubicación después del onboarding
- [ ] Métricas de producto sobre `analytics_events`
- [ ] Anti-abuso: rate limits de swipes, login y creación de cuentas
- [x] Admin local: revisión de expedientes, roles, decisiones/suspensión, buzón y recursos; pendiente activar y operar en producción ([estado](./14-backoffice.md))
- [x] Recepción y gestión local de solicitudes de privacidad, con permisos separados y respuesta privada; no equivale a ejecutar exportaciones/supresión
- [x] Borrado físico de BD y protección externa de bajas; excepciones legales y demás derechos pendientes ([alcance](./15-borrado-y-web-publica.md))

**2026-10-16 — Primer lote interno de backoffice y cumplimiento:** panel privado por códigos de un solo uso, sesiones revocables, HTTPS/proxy de confianza y CSRF; cola, asignación/reasignación, decisiones motivadas, advertencia/suspensión reversible y auditoría. Buzón móvil con justificantes/reclamaciones/derechos de privacidad y recursos resueltos por una cuenta distinta; disponible antes de terminar el onboarding y durante una suspensión. Autor del reporte no expuesto y borradores/respuestas tardías aislados entre cuentas. **694 backend, 972 móvil, 53 mobile-shared y 29 contracts**, typechecks, compilación backend sin avisos, formato y OpenAPI correctos; concurrencia real de códigos/asignación/resolución probada. Nueva migración aplicada solo a la BD local de tests. Sin commit/push, despliegue, activación de personal real, proveedores externos ni compilación móvil. Fotos aplazadas expresamente; datos locales ajenos conservados. **No es cierre de cumplimiento:** ejecución de derechos, retención, textos/consentimientos y validación jurídica/operativa siguen pendientes ([detalle](./14-backoffice.md)).

---

## Infraestructura — preparación del primer despliegue

Referencia vigente: [arquitectura del servidor propio](../infra/arquitectura.md) y [runbook](../infra/deploy/README.md).

- [x] Acordada operación inicial con una réplica, `stop-first` y downtime aceptado de segundos o minutos.
- [x] Acordados backups en SATA local de ~1 TB y en R2; objetivo externo de una a varias horas y unas diez copias recuperables, por concretar al configurar.
- [x] Aceptada indisponibilidad si falla el MS-A2; sin HA, réplica externa ni VPS de reserva en esta fase.
- [x] Ventilador dedicado del PM1735 comprado; pendiente de entrega.
- [ ] Instalar ventilador y comprobar temperaturas en reposo/carga gradual antes del despliegue y las pruebas sostenidas.
- [ ] Preparar PostgreSQL y Dokploy; aplicar una réplica y `stop-first` en actualizaciones/rollback; verificar migraciones antes del arranque.
- [ ] Corregir rollback manual del workflow, verificar API Dokploy instalada y completar secrets/conectividad; añadir `/readyz` a la comprobación post-deploy.
- [ ] Preparar datos ficticios para pruebas privadas sin R2; completar dominio/IP real antes de exposición pública.
- [ ] Primer despliegue y pruebas de funcionamiento, interrupción/reconexión y carga gradual.
- [ ] Configurar backups locales y R2, fijar frecuencia/retención y probar restauración antes de conservar datos reales. R2 se configura más adelante.

## Registro de cambios

- **2026-10-16 — Revisión del backoffice:** separadas recepción, buzón, revisión, efectos de decisión, comunicaciones y restricciones de cuenta. Corregidos bypass indirecto de HTTPS vía `FORCE_SSL`, reapertura de reclamaciones estimadas, orden de locks de logout, directorio privado de códigos, logs SQL sensibles y chat concurrente con suspensión; detalle móvil autoritativo y errores de envío/recarga separados. **702 backend, 974 móvil, 53 mobile-shared, 29 contracts**, typechecks/formato/compilación backend sin avisos correctos. La regresión de contaminación de etiquetas de fixtures fue corregida y la suite integrada repetida en verde. Lista de cierre jurídico/operativo/técnico en `compliance/10-cierre-cumplimiento.md`. Sin despliegue, compilación móvil, servicios externos ni cambios de fotos; modificación ajena `.expo/devices.json` conservada.

- **2026-04-15** — Primer commit: starter base (monorepo, auth Phoenix-owned, shell, design system).
- **2026-04-17** — Servicios auth mock para dev workflow; soporte react-native-svg y componentes UI.
- **2026-04-28** — Dominio dating completo en backend (PostGIS, contextos, API, tests) + WebSocket de chat con JWT + documentación de producto dating.
- **2026-05-06** — Contratos mobile-ready en backend (draft profiles, bootstrap, upload-intent, distanceLabel), bootstrap routing en móvil, plan de pantallas y anti-abuso documentados.
- **2026-06-17/18** — Trabajo sin commitear: onboarding móvil (perfil/preferencias/bio/tags), discovery feed con like/dislike, cliente tags, tema neobrutal, campo `discovery_mode` en preferencias, seeds de catálogo de tags (47), endpoint dev test-login.
- **2026-07-29** — Estandarización de puertos dev (pg=5510) en compose y `.env.example` (commit cdcc62f).
- **2026-08-21** — Reestructuración de documentación al sistema canónico actual: todo bajo `docs/` (índice numerado 00–11 + `decisions.md` + `progress.md`); material de planificación histórico y metodología openspec retirados (recuperables del historial de git). Auditoría de alineación código↔docs: backend ~95% conforme a contratos v1 (215 tests verdes), móvil ~40% (131 tests + 18 contracts verdes).
- **2026-08-21** — Cifrado en reposo de mensajes (D-2026-08-21): módulo `Cherry.Crypto` (AES-256-GCM, clave en `MESSAGE_ENCRYPTION_KEY`, formato versionado `v1:`), tipo Ecto `Cherry.Crypto.Encrypted` aplicado a `messages.body`, migración de backfill para filas legacy (con reversión) y 11 tests nuevos. Suite backend: 226 verdes.
- **2026-09-02** — Infraestructura de release y deploy del backend en el home server (MS-A2): `mix phx.gen.release --docker` (Dockerfile multi-stage, overlays `bin/server`/`bin/migrate`, `Cherry.Release`), `infra/deploy/` con systemd unit, env de VM, script de deploy (build → tarball → `/opt/cherry/releases` → migrate → restart) y runbook de VMs (app 8vCPU/16G, PostgreSQL 17+PostGIS sobre PM1735 en passthrough, exposición vía Caddy+Cloudflare). `config/test.exs` acepta `DATABASE_URL` para tests (5432 ocupado por otro proyecto). Verificado: imagen Docker arranca en prod simulado (200 en `/` y `/api/config`), suite backend 227 verdes.
- **2026-09-04** — Decisión de runtime definitiva (D-2026-09-04): Dokploy+Docker/Swarm+Traefik en la VM backend, PostgreSQL nativo, builds en GitHub Actions→GHCR (tag=sha), deploy vía API solo por VPN con verificación post-deploy `version==sha` (mitiga Dokploy #3987). Implementado: `GET /healthz` (liveness+`APP_VERSION` horneada en imagen) y `GET /readyz` (ping Repo) con tests (suite 229); Dockerfile con `EXPOSE 4000`, `HEALTHCHECK` (curl) y `APP_VERSION` ARG/ENV; workflow `.github/workflows/ci.yml` (PR: format+test backend con PostGIS service + móvil; main: build→GHCR→deploy→verificación de convergencia; rollback por `workflow_dispatch`); runbook `infra/deploy/README.md` reescrito a la topología definitiva (IPs .126/.142, cadena de confianza de IP real, reglas de migraciones, checklist pre-lanzamiento); `deploy-backend.sh`+unit degradados a plan B. Pendientes: dominio público, plug RemoteIp, secrets de CI (Tailscale/Dokploy), LUKS en PGDATA. Descripción de la infraestructura construida en `infra/arquitectura.md`.

- **2026-09-05** — Corregidos bloqueo en chat REST/WS (incluidos broadcasts pendientes), historial REST, desactivación de cuenta con revocación de sesiones/push y desconexión de sockets, paginación estable de discovery con scoring/límite SQL, y verificación de fotos en R2 con PUT condicional. Retirado el endpoint legacy de metadatos. Corregidos también reanudación del perfil y filtros/conteo de tags con UUID. Añadidas dos migraciones (desactivación de cuentas y caducidad de intents antiguos). Verificado en PostgreSQL/PostGIS local del proyecto, puerto 5510: **248 tests backend, 0 fallos**, **18 tests de contratos**, formato global y OpenAPI YAML válidos. Las pruebas HTTP de R2 usan respuestas simuladas; no se ha realizado despliegue ni prueba contra un bucket real.

- **2026-09-05 — Infraestructura:** actualizada documentación con los acuerdos de operación inicial: `stop-first`, downtime aceptado, backups local + R2 pendientes (frecuencia de una a varias horas y unas diez copias como objetivo), ausencia de failover externo y espera al ventilador del PM1735 antes del despliegue/pruebas. Diferenciados los componentes existentes y los pasos de CI/Dokploy pendientes. No se han modificado servicios remotos ni configurado backups.

- **2026-09-29** — Rediseño y ampliación completos (rama `feat/kawaii-overhaul`):
  - **Backend:** ranking de discovery v2 (afinidad IDF, matriz de intención simétrica, filtros duros en ambas direcciones, ampliación de distancia, cursor estable), API social (likes recibidos, perfil público, resumen para contadores, estado de lectura), caducidad de match a 30 días, deshacer el último «no», almacenamiento local de fotos para self-hosting con zona de espera y borrado físico, catálogo de 52 etiquetas con emoji y datos de demo (`demo_seeds.exs`).
  - **Seguridad y self-hosting:** una sola regla de visibilidad para feed, likes, perfil público y swipe; la puntuación ya no sale del servidor; ubicación solo lat/lng con límite de una por minuto; mensajes con orden estable al microsegundo; arranque de producción que rechaza configuración incompleta o secretos débiles; `bin/migrate` sincroniza el catálogo y `bin/seed`; dependencias actualizadas.
  - **Móvil:** sistema de diseño «Libreta kawaii», onboarding en 11 pasos, Descubrir con swipe y feed, Likes, Chats en tiempo real, Yo, Ajustes y Acerca de; sesión robusta ante carreras entre cuentas; copy revisado.
  - **Proyecto:** licencia AGPL-3.0 y guía de self-hosting (`docs/12-self-hosting.md`); documentación alineada con el código.
  - Verificado: **384 tests backend**, **678 tests móvil**, **43 mobile-shared** y **23 contracts**, 0 fallos, typecheck limpio. Verificación manual solo en Expo Web; queda probar en dispositivo real (ver `11-deuda-tecnica-pendiente.md`).

- **2026-10-14 — Rendimiento y robustez:** aislada la decoración animada de `TextField` del render por tecla; recuento latino rápido y compartido entre validación/contador de bio; guardado bloqueado sin perder el borrador al fallar. Perfil/catálogo deduplican refrescos y descartan lecturas obsoletas; la frontera autenticada rechaza respuestas de sesiones anteriores para impedir cruces entre cuentas. Backend: consultas de tarjetas/likes reducidas de 2 a 1, preferencias actuales en SQL, keyset compuesto indexable del chat y barrido de caducidades limitado con `SKIP LOCKED`. Añadidas regresiones y benchmarks reproducibles ([rendimiento](./13-rendimiento.md)). **647 backend + 865 móvil + 51 mobile-shared + 28 contracts**, sin fallos; typechecks, formato backend y bundles de producción Hermes Android/iOS correctos. Sin despliegues ni cambios de infraestructura. Pendientes la medición nativa en release y la capacidad concurrente real mediante carga aislada.

- **2026-10-15 — Segunda pasada de rendimiento:** Discovery usa búsquedas exactas de swipes por índice compuesto en radios limitados y evita un `ST_DWithin` redundante sin expansión, conservando score/filtros/cursor. Benchmark sintético: 5.001 perfiles, **141,899 → 46,493 ms**, con filas completas idénticas. Móvil: cálculo único de fechas para ordenar chats, precarga compartida TTL/LRU acotada sin el `Set` creciente de la cola, cargas de likes protegidas frente a paginación/refresh y deshacer ligado a su sesión. Se reconcilia un undo confirmado tras recargar sin insertar cards fuera del snapshot actual. **649 backend + 890 móvil + 51 mobile-shared + 28 contracts**, sin fallos; typechecks y bundles Hermes Android/iOS correctos. Formato de los archivos backend de este lote y whitespace correctos; el formato global detecta un incumplimiento previo en `identity/document/mrz.ex`, no modificado. Sin servicios remotos, migraciones ni despliegue. Persisten la evaluación lineal de candidatos, Chats sin virtualización y las verificaciones de rendimiento/concurrencia en entorno real ([detalle](./13-rendimiento.md)).

- **2026-10-15 — Tercera pasada de rendimiento y mantenimiento:** Chats usa `FlashList` en ambos ejes, modelo y presentación separados, avatars aislados al reciclar, paginación sin cascadas al montar y reloj detenido fuera de foco/primer plano. Leído pasa de **151 a 6 intentos por minuto simulado** ante fallos rápidos mediante controlador con backoff/jitter; mantiene pendientes y confirmaciones por envío. Separados cliente JSON/errores/timeout y políticas técnicas; la subida alternativa respeta timeout/cancelación y actividad no consulta en background. Backend: resumen **2 → 1 consultas**, autorización booleana WS **15 → 1 columnas**, push **12 → 2 columnas** y rechazos **1 + N → 2 consultas**; configuración de transporte validada en `PushConfig`. **660 backend + 945 móvil + 51 mobile-shared + 28 contracts**, sin fallos; typechecks, whitespace y bundles de producción Hermes Android/iOS correctos. Formato backend propio correcto; persiste el formato previo de `mrz.ex`, no tocado. Benchmarks y límites en [rendimiento](./13-rendimiento.md): sin mejora de latencia estable atribuible al último lote backend, ni FPS/concurrencia real medidos. Sin commit, push, despliegue, migraciones ni cambios de infraestructura; `.expo/devices.json` ajeno conservado.

- **2026-10-15 — Cuarta pasada y cierre de optimización teórica:** editor del chat aislado de pantalla/historial al escribir; borradores privados separados, sin entradas vacías ni cruces de cuenta/ruta y sin evicción de texto pendiente. Corregido el resumen de reconexión que se publicaba antes de validar su sesión o tras desmontar. Merge estable sin sort para entradas ordenadas, fallback equivalente y día local calculado una vez por entrada del timeline; benchmark sintético de 2.000 mensajes × 200 llamadas, **175,5 → 68,2 ms**, sin claims de FPS. Backend: fotos pendientes con proyección mínima y marcado batch (**6 → 4 consultas** para 3 fotos/3 intents), tamaño de lote validado/configurable conservando default 200, perfil/completitud sin hidratar fotos inactivas (**102 → 2 filas** en el fixture). **668 backend + 966 móvil + 51 mobile-shared + 28 contracts**, typechecks y bundles Hermes Android/iOS correctos; revisión independiente de cada objetivo sin defectos pendientes. Con **Elixir 1.18.4 / OTP 28** (CI) pasan suite y formato global, sin tocar `mrz.ex`: no se reproduce el aviso anterior de otro toolchain. Sin commit, push, despliegue, migraciones ni infraestructura; trabajo ajeno conservado. Base local cerrada para avanzar a mediciones reales, no declaración de capacidad o preparación de lanzamiento ([límites y siguiente fase](./13-rendimiento.md)).

- **2026-10-16 — Publicación de las optimizaciones:** commit `fd9ce10` pusheado a `main`; CI [38871351664](https://github.com/akorda-software/cherry/actions/runs/38871351664) pasó tests/formato y publicó la imagen del backend. Desplegada por API del Dokploy de NiPoGi en `cherry.akorda.es`; Dokploy `done`, Swarm `completed`, health/readiness públicos y de origen 200 con versión exacta y estabilidad comprobada. Sin migraciones nuevas ni cambios de infraestructura, secretos, OAuth o tiendas; volumen de fotos y una réplica/stop-first preservados. No se compilaron APK/IPA por petición del propietario: iOS queda pendiente de configurar OAuth Apple/Google. Datos locales de `.expo/devices.json` excluidos del commit y conservados. [Registro y rollback](../infra/deploy/README.md).
