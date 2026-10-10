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

## Fase 4 — App móvil dating (~ en curso)

- [x] Bootstrap routing real contra `GET /api/bootstrap` (signed-out / onboarding / app)
- [x] Onboarding parcial: perfil (nombre+fecha+género+intent), preferencias (interested-in+edad+distancia), bio, tags (+bloqueados) con stepper
- [x] Discovery feed: grilla de cards, like/dislike optimista con rollback, modal de match
- [x] Cliente API perfil/discovery en `mobile-shared` + DTOs en `contracts`
- [ ] **Paso location**: permiso expo-location, `POST /api/me/location`, pantalla de remediación *(bloqueante: sin esto el onboarding no puede completarse)*
- [ ] **Paso photos**: picker, compresión, upload-intent/complete a R2 *(bloqueante: ídem)*
- [ ] Pantalla review + `POST /api/me/profile/complete`
- [ ] Corregir resolver `nextOnboardingStep` → ruta (hoy mapea photos→bio y location→preferences)
- [ ] Alinear payload de ubicación del cliente al contrato vigente
- [ ] Matches: lista, expiración, unmatch
- [ ] Chat: historial REST + WebSocket en vivo
- [ ] Safety: block/report desde el feed; settings: pause/unpause/delete account
- [ ] Tab matches + renombrar `home.tsx` → `discover.tsx`

## Fase 5 — Endurecimiento previo a lanzamiento [ ]

- [ ] Push notifications (new match / new message) sobre el contrato ya implementado
- [ ] Métricas de producto sobre `analytics_events`
- [ ] Anti-abuso: rate limits de swipes y patrones de creación de cuentas
- [ ] Admin: revisión de reportes/usuarios (hoy solo funciones de contexto, sin rutas)
- [ ] Decidir destino del campo `discovery_mode` (huérfano: migrado pero sin uso en el feed)
- [ ] Pruebas E2E en dispositivo real (auth nativa, location, R2, WebSocket)

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
- **2026-08-21** — Cifrado en reposo de mensajes (D-2026-08-21): módulo `Cherry.Crypto` (AES-256-GCM, clave en `MESSAGE_ENCRYPTION_KEY`, formato versionado `v1:`), tipo Ecto `Cherry.Crypto.Encrypted` aplicado a `messages.body`, migración de backfill para filas legacy (con reversión) y 11 tests nuevos. Suite backend: 226 verdes.
- **2026-09-02** — Infraestructura de release y deploy del backend en el home server (MS-A2): `mix phx.gen.release --docker` (Dockerfile multi-stage, overlays `bin/server`/`bin/migrate`, `Cherry.Release`), `infra/deploy/` con systemd unit, env de VM, script de deploy (build → tarball → `/opt/cherry/releases` → migrate → restart) y runbook de VMs (app 8vCPU/16G, PostgreSQL 17+PostGIS sobre PM1735 en passthrough, exposición vía Caddy+Cloudflare). `config/test.exs` acepta `DATABASE_URL` para tests (5432 ocupado por otro proyecto). Verificado: imagen Docker arranca en prod simulado (200 en `/` y `/api/config`), suite backend 227 verdes.
- **2026-09-04** — Decisión de runtime definitiva (D-2026-09-04): Dokploy+Docker/Swarm+Traefik en la VM backend, PostgreSQL nativo, builds en GitHub Actions→GHCR (tag=sha), deploy vía API solo por VPN con verificación post-deploy `version==sha` (mitiga Dokploy #3987). Implementado: `GET /healthz` (liveness+`APP_VERSION` horneada en imagen) y `GET /readyz` (ping Repo) con tests (suite 229); Dockerfile con `EXPOSE 4000`, `HEALTHCHECK` (curl) y `APP_VERSION` ARG/ENV; workflow `.github/workflows/ci.yml` (PR: format+test backend con PostGIS service + móvil; main: build→GHCR→deploy→verificación de convergencia; rollback por `workflow_dispatch`); runbook `infra/deploy/README.md` reescrito a la topología definitiva (IPs .126/.142, cadena de confianza de IP real, reglas de migraciones, checklist pre-lanzamiento); `deploy-backend.sh`+unit degradados a plan B. Pendientes: dominio público, plug RemoteIp, secrets de CI (Tailscale/Dokploy), LUKS en PGDATA. Descripción de la infraestructura construida en `infra/arquitectura.md`.

- **2026-09-05** — Corregidos bloqueo en chat REST/WS (incluidos broadcasts pendientes), historial REST, desactivación de cuenta con revocación de sesiones/push y desconexión de sockets, paginación estable de discovery con scoring/límite SQL, y verificación de fotos en R2 con PUT condicional. Retirado el endpoint legacy de metadatos. Corregidos también reanudación del perfil y filtros/conteo de tags con UUID. Añadidas dos migraciones (desactivación de cuentas y caducidad de intents antiguos). Verificado en PostgreSQL/PostGIS local del proyecto, puerto 5510: **248 tests backend, 0 fallos**, **18 tests de contratos**, formato global y OpenAPI YAML válidos. Las pruebas HTTP de R2 usan respuestas simuladas; no se ha realizado despliegue ni prueba contra un bucket real.

- **2026-09-05 — Infraestructura:** actualizada documentación con los acuerdos de operación inicial: `stop-first`, downtime aceptado, backups local + R2 pendientes (frecuencia de una a varias horas y unas diez copias como objetivo), ausencia de failover externo y espera al ventilador del PM1735 antes del despliegue/pruebas. Diferenciados los componentes existentes y los pasos de CI/Dokploy pendientes. No se han modificado servicios remotos ni configurado backups.

