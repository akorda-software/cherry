# Progress

Registro de avance del proyecto. Convención: una entrada por unidad de trabajo, con estado. Estado: `[ ]` pendiente · `[~]` en curso · `[x]` hecho.

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

- [x] Dominio `Snack.Dating` con PostGIS: perfiles draft, preferencias, fotos, tags, ubicaciones, swipes, matches, conversaciones, mensajes, bloques, reportes, eventos
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
- [ ] Admin: revisión de reportes/usuarios (hoy solo funciones de contexto, sin rutas)
- [ ] Purga de datos al borrar la cuenta

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

- **2026-04-15** — Primer commit: starter base (monorepo, auth Phoenix-owned, shell, design system).
- **2026-04-17** — Servicios auth mock para dev workflow; soporte react-native-svg y componentes UI.
- **2026-04-28** — Dominio dating completo en backend (PostGIS, contextos, API, tests) + WebSocket de chat con JWT + documentación de producto dating.
- **2026-05-06** — Contratos mobile-ready en backend (draft profiles, bootstrap, upload-intent, distanceLabel), bootstrap routing en móvil, plan de pantallas y anti-abuso documentados.
- **2026-06-17/18** — Trabajo sin commitear: onboarding móvil (perfil/preferencias/bio/tags), discovery feed con like/dislike, cliente tags, tema neobrutal, campo `discovery_mode` en preferencias, seeds de catálogo de tags (47), endpoint dev test-login.
- **2026-07-29** — Estandarización de puertos dev (pg=5510) en compose y `.env.example` (commit cdcc62f).
- **2026-08-21** — Reestructuración de documentación al sistema canónico actual: todo bajo `docs/` (índice numerado 00–11 + `decisions.md` + `progress.md`); material de planificación histórico y metodología openspec retirados (recuperables del historial de git). Auditoría de alineación código↔docs: backend ~95% conforme a contratos v1 (215 tests verdes), móvil ~40% (131 tests + 18 contracts verdes).
- **2026-08-21** — Cifrado en reposo de mensajes (D-2026-08-21): módulo `Snack.Crypto` (AES-256-GCM, clave en `MESSAGE_ENCRYPTION_KEY`, formato versionado `v1:`), tipo Ecto `Snack.Crypto.Encrypted` aplicado a `messages.body`, migración de backfill para filas legacy (con reversión) y 11 tests nuevos. Suite backend: 226 verdes.
- **2026-09-02** — Infraestructura de release y deploy del backend en el home server (MS-A2): `mix phx.gen.release --docker` (Dockerfile multi-stage, overlays `bin/server`/`bin/migrate`, `Snack.Release`), `infra/deploy/` con systemd unit, env de VM, script de deploy (build → tarball → `/opt/snack/releases` → migrate → restart) y runbook de VMs (app 8vCPU/16G, PostgreSQL 17+PostGIS sobre PM1735 en passthrough, exposición vía Caddy+Cloudflare). `config/test.exs` acepta `DATABASE_URL` para tests (5432 ocupado por otro proyecto). Verificado: imagen Docker arranca en prod simulado (200 en `/` y `/api/config`), suite backend 227 verdes.
- **2026-09-04** — Decisión de runtime definitiva (D-2026-09-04): Dokploy+Docker/Swarm+Traefik en la VM backend, PostgreSQL nativo, builds en GitHub Actions→GHCR (tag=sha), deploy vía API solo por VPN con verificación post-deploy `version==sha` (mitiga Dokploy #3987). Implementado: `GET /healthz` (liveness+`APP_VERSION` horneada en imagen) y `GET /readyz` (ping Repo) con tests (suite 229); Dockerfile con `EXPOSE 4000`, `HEALTHCHECK` (curl) y `APP_VERSION` ARG/ENV; workflow `.github/workflows/ci.yml` (PR: format+test backend con PostGIS service + móvil; main: build→GHCR→deploy→verificación de convergencia; rollback por `workflow_dispatch`); runbook `infra/deploy/README.md` reescrito a la topología definitiva (IPs .126/.142, cadena de confianza de IP real, reglas de migraciones, checklist pre-lanzamiento); `deploy-backend.sh`+unit degradados a plan B. Pendientes: dominio público, plug RemoteIp, secrets de CI (Tailscale/Dokploy), LUKS en PGDATA. Descripción de la infraestructura construida en `infra/arquitectura.md`.

- **2026-09-05** — Corregidos bloqueo en chat REST/WS (incluidos broadcasts pendientes), historial REST, desactivación de cuenta con revocación de sesiones/push y desconexión de sockets, paginación estable de discovery con scoring/límite SQL, y verificación de fotos en R2 con PUT condicional. Retirado el endpoint legacy de metadatos. Corregidos también reanudación del perfil y filtros/conteo de tags con UUID. Añadidas dos migraciones (desactivación de cuentas y caducidad de intents antiguos). Verificado en PostgreSQL/PostGIS local del proyecto, puerto 5510: **248 tests backend, 0 fallos**, **18 tests de contratos**, formato global y OpenAPI YAML válidos. Las pruebas HTTP de R2 usan respuestas simuladas; no se ha realizado despliegue ni prueba contra un bucket real.

- **2026-09-05 — Infraestructura:** actualizada documentación con los acuerdos de operación inicial: `stop-first`, downtime aceptado, backups local + R2 pendientes (frecuencia de una a varias horas y unas diez copias como objetivo), ausencia de failover externo y espera al ventilador del PM1735 antes del despliegue/pruebas. Diferenciados los componentes existentes y los pasos de CI/Dokploy pendientes. No se han modificado servicios remotos ni configurado backups.

- **2026-09-29** — Rediseño y ampliación completos (rama `feat/kawaii-overhaul`):
  - **Backend:** ranking de discovery v2 (afinidad IDF, matriz de intención simétrica, filtros duros en ambas direcciones, ampliación de distancia, cursor estable), API social (likes recibidos, perfil público, resumen para contadores, estado de lectura), caducidad de match a 30 días, deshacer el último «no», almacenamiento local de fotos para self-hosting con zona de espera y borrado físico, catálogo de 52 etiquetas con emoji y datos de demo (`demo_seeds.exs`).
  - **Seguridad y self-hosting:** una sola regla de visibilidad para feed, likes, perfil público y swipe; la puntuación ya no sale del servidor; ubicación solo lat/lng con límite de una por minuto; mensajes con orden estable al microsegundo; arranque de producción que rechaza configuración incompleta o secretos débiles; `bin/migrate` sincroniza el catálogo y `bin/seed`; dependencias actualizadas.
  - **Móvil:** sistema de diseño «Libreta kawaii», onboarding en 11 pasos, Descubrir con swipe y feed, Likes, Chats en tiempo real, Yo, Ajustes y Acerca de; sesión robusta ante carreras entre cuentas; copy revisado.
  - **Proyecto:** licencia AGPL-3.0 y guía de self-hosting (`docs/12-self-hosting.md`); documentación alineada con el código.
  - Verificado: **384 tests backend**, **678 tests móvil**, **43 mobile-shared** y **23 contracts**, 0 fallos, typecheck limpio. Verificación manual solo en Expo Web; queda probar en dispositivo real (ver `11-deuda-tecnica-pendiente.md`).

