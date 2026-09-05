# Arquitectura de infraestructura — Snack en el home server

Arquitectura acordada para Snack en el servidor propio: hardware, VMs, red, runtime, CI/CD, seguridad y backups. Decisiones con su contexto: [docs/decisions.md](../docs/decisions.md). Procedimientos: [runbook de despliegue](deploy/README.md). El estado de implementación y los pasos pendientes se distinguen en §10.

**Acuerdo de operación inicial (2026-09-05):** un único MS-A2, una réplica de la app y despliegues con downtime aceptado de segundos o minutos. Backups previstos en el SATA local de ~1 TB y en R2. Sin alta disponibilidad ni VPS de respaldo en esta fase. Se esperará al ventilador del PM1735 para instalarlo y comprobar temperaturas antes del despliegue y las pruebas.

## 1. Visión general

```
                         ┌─────────────────┐
   Internet ──▶ Cloudflare (proxied, Full strict)
                         └────────┬────────┘
                                  ▼
                    UCG-Fiber (80/443 solo rangos CF)
                                  ▼
              VM caddy · DMZ 192.168.30.21 (VLAN 30)
                                  ▼
              Traefik · VM 101 192.168.0.126:80 (Swarm)
                                  ▼
                  contenedor snack (:4000 interno)
                          │           │
                          ▼           ▼
        VM 102 · PostgreSQL    Cloudflare R2 (UE)
        192.168.0.142:5432     fotos (subida directa móvil)

  GitHub Actions ── tests ──▶ GHCR ghcr.io/<repo>-backend:<sha>
       │                                │
       └── deploy vía API Dokploy ──────┘  (solo VPN/Tailscale)
                 └──▶ verifica /healthz version == sha
```

| Pieza | Dónde | Rol |
|---|---|---|
| Cloudflare | Externo | DNS proxified, TLS edge, absorbe DDoS. CNAME → `home.akorda.es` (A maestro DDNS, IP dinámica) |
| UCG-Fiber | Router casa | Firewall stateful; 80/443 solo desde rangos Cloudflare; WireGuard 10.77.0.0/24 = acceso admin |
| VM 100 caddy | DMZ, Debian 13 | Única entrada web pública; enruta por Host a Traefik |
| VM 101 snack-backend | LAN .126, Debian 13 | Docker + Swarm 1 nodo + Dokploy (panel) + Traefik + contenedor snack |
| VM 102 snack-db | LAN .142, Debian 13 | PostgreSQL 17 + PostGIS nativos, PGDATA en PM1735 |
| GitHub Actions + GHCR | GitHub | CI, build de imágenes inmutables, orquestación de deploy |

## 2. Hardware y virtualización

**MS-A2** (MinisForum): 16 cores / 32 hilos, 64 GB RAM. Proxmox VE 9.2 (`pve-msa2`, 192.168.0.212).

| Disco | Uso |
|---|---|
| Samsung 990 Pro 2 TB (`local-lvm`) | Proxmox + discos de sistema de las VMs + `/var/lib/docker` |
| **Samsung PM1735 U.2 1,62 TB** | **PGDATA** — raw block a VM 102 (`scsi1`, virtio-scsi-single, iothread, cache=none, discard, `backup=0`) |
| SATA ~1 TB | Destino previsto de backups locales de PostgreSQL y de las VMs; capacidad compartida con ISOs. Configuración y restauración pendientes. |

| VM | vCPU | RAM | IP | Contenido |
|---|---|---|---|---|
| 100 caddy | 2 | 2 GB | 192.168.30.21 | Debian 13, Caddy systemd |
| 101 snack-backend | 8 (host) | 16 GB | 192.168.0.126 | Debian 13, Docker, Swarm, Dokploy, Traefik, snack |
| 102 snack-db | 8 (host) | 24 GB | 192.168.0.142 | Debian 13, PostgreSQL 17.11 + PostGIS 3.6.4 |

Asignación: 18 vCPU sobre 32 hilos lógicos y 42/64 GB de RAM; las vCPU comparten el procesador físico. Sin ballooning ni pinning; ampliación por métricas (CPU>60% 15 min, p95 latencia, cache hit<99%, IO wait sostenido).

**Refrigeración pendiente:** última temperatura documentada del PM1735: 62°C en reposo (aviso 65°C). Se ha comprado un ventilador dedicado para el U.2; entrega prevista en unos dos días según lo indicado el 2026-09-05. Instalarlo al recibirlo, registrar temperatura en reposo y comprobarla con carga gradual antes de iniciar las pruebas sostenidas. La mejora térmica todavía no está verificada.

## 3. Red y entrada pública

- **Recorrido de una petición**: CF → UCG → Caddy → Traefik → contenedor. El `:4000` del contenedor nunca se publica; Caddy habla al `:80` de Traefik (enrutado por Host).
- **Cadena de IP real**: UCG acepta 80/443 solo de rangos CF · Caddy `trusted_proxies` strict + `CF-Connecting-IP` · Traefik `forwardedHeaders.trustedIPs = [192.168.30.21/32]` · Phoenix plug `RemoteIp` con proxies explícitos *(pendiente de implementar)*.
- **DNS**: CNAME proxificados hacia `home.akorda.es`; DDNS en UCG con fallback en VM Caddy. `vpn.akorda.es` es DNS-only (revela la WAN; aceptado, solo WireGuard).
- **Firewall por VM** (entrada deny por defecto):

| Origen | Destino | Puerto |
|---|---|---|
| rangos Cloudflare | 192.168.30.21 | 80/443 |
| 192.168.30.21 (Caddy) | 192.168.0.126 | 80 |
| VPN 10.77.0.0/24 | ambas VMs | 22 y 3000 (panel Dokploy) |
| 192.168.0.126 | 192.168.0.142 | 5432 |

- **Admin**: solo WireGuard (Tailscale de respaldo). SSH por clave, sin root, usuarios `kukapu`/`oscar`.

## 4. Runtime del backend (VM 101)

- **Dokploy** (panel `:3000`, solo VPN + 2FA): gestiona la app como servicio Swarm de un nodo. Es un controlador: su caída no tumba el tráfico (Traefik corre bajo Docker; los servicios Swarm bajo dockerd).
- **Traefik**: entrypoint web `:80`, sin HTTPS (TLS termina en Cloudflare/Caddy), sin redirecciones.
- **Contenedor snack**: imagen `ghcr.io/<repo>-backend:<sha>` (nunca `latest`), usuario `nobody`, sin socket Docker. Arranque: `bin/migrate && bin/server`.
- **Swarm (configuración acordada, pendiente de aplicar en Dokploy)**: healthcheck `curl -fsS localhost:4000/healthz` · UpdateConfig y RollbackConfig con `order: stop-first`, `Parallelism 1` · UpdateConfig `FailureAction: rollback`, `Monitor 30s` · `RestartPolicy on-failure` · **1 réplica**. Se detiene la versión anterior antes de arrancar la nueva; se acepta una interrupción de segundos o minutos, sin prometer una duración máxima. Así se evita que dos versiones atiendan chats simultáneamente con PubSub aislados. Distribución Erlang desactivada; `dns_cluster` permanece inactivo.
- **Cliente durante el despliegue:** debe tolerar la desconexión, reconectar y recuperar mensajes persistidos por REST. Este comportamiento se comprobará cuando esté implementado el chat móvil.
- **Mantenimiento**: `daemon.json` con log rotation (`json-file` 50m×3); `docker image prune -a --filter until=168h` semanal; snapshot de VM antes de actualizar Dokploy o Traefik (ciclos separados, versiones anotadas en el runbook).

## 5. Base de datos (VM 102)

- PostgreSQL 17.11 (PGDG) + PostGIS 3.6.4, nativos. Rol `snack` owner de `snack_prod`; extensiones `postgis`, `pgcrypto`, `uuid-ossp` (las migraciones las crean), `pg_stat_statements`.
- `listen_addresses = 'localhost,192.168.0.142'` · `pg_hba`: `host snack_prod snack 192.168.0.126/32 scram-sha-256`.
- Tuning: `shared_buffers=4GB`, `effective_cache_size=12GB`, `max_connections=100`, `work_mem` default (subir solo con evidencia de `pg_stat_statements`).
- PGDATA: `/var/lib/postgresql` sobre PM1735 (ext4, noatime, fstrim activo). LUKS pendiente de decisión (ver §10).
- Conexión desde la app: `DATABASE_URL=ecto://snack:…@192.168.0.142/snack_prod`, `DATABASE_SSL=false` (LAN privada), `POOL_SIZE=20`.

## 6. CI/CD (`.github/workflows/ci.yml`)

**Estado inicial:** job `deploy` explícitamente pausado con `if: ${{ false }}` hasta instalar el ventilador y preparar el primer despliegue. Los pushes siguen ejecutando tests y build; la secuencia de despliegue siguiente describe el objetivo una vez rehabilitado.

```
PR    → mix format + mix test (service container PostGIS 17) + pnpm test:mobile
main  → build imagen (APP_VERSION=sha, cache GHA) → push GHCR:<sha>
      → deploy: Tailscale efímero → API Dokploy (imagen + redeploy)
      → verificación: polling <PUBLIC_URL>/healthz hasta version == sha (10 min, si no: rojo)
```

- **Verificación independiente de la UI**: Dokploy #3987 — Swarm puede revertir un deploy silenciosamente; la verdad está en `/healthz`.
- **Rollback previsto**: redesplegar una imagen existente mediante `workflow_dispatch` con `sha`, también con `stop-first`. El workflow actual todavía limita `build` y `deploy` a eventos `push`: el rollback manual requiere corregir esas condiciones antes de usarlo. En producción nunca `ecto.rollback`.
- **Secretos**: GitHub solo guarda OAuth de Tailscale y `DOKPLOY_API_KEY`/`DOKPLOY_BASE_URL`/`DOKPLOY_APPLICATION_ID` (Environment `production`, solo main). El env completo de la app vive en Dokploy (fuente: Bitwarden).
- **GHCR→Dokploy**: cuenta bot con PAT `read:packages`. Retención: ~30 SHAs en GHCR.

## 7. Migraciones — reglas

1. Al arrancar el contenedor, con **lock de migraciones siempre activo**. Índices `CONCURRENTLY`: solo `@disable_ddl_transaction true` (nunca `@disable_migration_lock true`).
2. Expand/contract: nullable → dual-write → backfill por lotes → NOT NULL → dejar de leer → drop en release siguiente. Nunca rename/DROP en el mismo release.
3. Con `stop-first`, la versión anterior ya está detenida cuando la nueva ejecuta migraciones y arranca. Ese tiempo forma parte del downtime aceptado. Si una migración falla, la app nueva no arranca y la indisponibilidad puede prolongarse hasta el rollback de imagen o la intervención manual. Se mantiene la compatibilidad de esquema para poder arrancar N−1; revertir la imagen no deshace cambios de datos.

## 8. Health checks

| Endpoint | Semántica | Respuesta |
|---|---|---|
| `GET /healthz` | Liveness + versión, **sin DB** (reiniciar Phoenix no arregla una DB caída) | `{"status":"ok","version":"<sha>"}` |
| `GET /readyz` | Disponibilidad para tráfico (ping Repo) | `{"status":"ready"}` / 503 |

`version` = `APP_VERSION` (env horneada por CI) vía `config :snack, :app_version` en `runtime.exs`. Swarm mantiene `/healthz` como liveness. La comprobación post-deploy prevista debe exigir también `/readyz` 200; el workflow todavía comprueba solo versión en `/healthz`.

## 9. Seguridad — capas y secretos

1. Cloudflare (edge) → UCG (stateful, saltos exactos) → firewall VM (deny default) → SO (SSH clave+VPN+sin root) → contenedor (`nobody`, sin socket Docker).
2. Panel Dokploy: VPN + 2FA, jamás proxyficado (ni UI ni `/api/*`).
3. Secretos y dónde viven: **Bitwarden** = fuente de verdad · **Dokploy** = copia runtime del env de la app (inevitable, lo inyecta) · **GitHub** = solo API key de Dokploy + OAuth Tailscale. Rotaciones: API key trimestral, PAT GHCR anual, `SECRET_KEY_BASE` solo por incidente. No se leen secretos de Bitwarden al arrancar contenedores.
4. Mensajes cifrados en reposo (AES-256-GCM, clave `MESSAGE_ENCRYPTION_KEY`, D-2026-08-21) sobre la DB.
5. Distribución Erlang desactivada (1 réplica): puertos BEAM fuera de la overlay.

## 10. Estado actual y siguientes pasos

**Infraestructura descrita en el registro anterior:** VMs 101/102 endurecidas; PostgreSQL 17 + PostGIS sobre PM1735; Dockerfile y scripts de release existentes. Esta actualización documental no comprueba las VMs ni aplica configuración remota.

**Última verificación local (2026-09-05):** 248 tests backend y 18 de contratos, sin fallos; formato y OpenAPI válidos. Hay dos migraciones nuevas (`20260905170000` y `20260905170100`). R2 se ha probado con HTTP simulado; su configuración real sigue pendiente.

**Antes del despliegue y las primeras pruebas:**

1. Recibir e instalar el ventilador del PM1735; medir reposo y carga gradual y confirmar que permite las pruebas sostenidas.
2. Preparar rol/DB/extensiones, `pg_hba` y conexión desde VM 101; aplicar el tuning inicial del runbook. La decisión sobre LUKS sigue pendiente.
3. Instalar/configurar Dokploy y acceso a GHCR en VM 101. Aplicar una réplica y `stop-first` tanto en actualizaciones como en rollback; verificar el comando `bin/migrate && bin/server`.
4. Corregir el rollback manual del workflow, confirmar la API de la versión instalada de Dokploy y completar secrets de CI. Incorporar la comprobación post-deploy de `/readyz`.
5. Para acceso público: elegir dominio, configurar Caddy/Cloudflare, `PHX_HOST` y `PUBLIC_URL`, completar IP real y límites de peticiones. Las primeras pruebas pueden ser privadas por LAN/VPN.
6. Preparar cuentas y perfiles ficticios reproducibles para probar sin R2; probar login, feed, matching y chat mediante API. Las pruebas completas desde móvil dependerán de terminar sus pantallas pendientes.
7. Comprobar arranque, migraciones, REST, WebSocket y un despliegue con reconexión; después realizar carga progresiva y medir latencias/temperatura.

**Antes de conservar datos reales:** implementar y probar las copias descritas en §11, guardar las claves necesarias para restaurar y verificar recuperación. R2 (fotos y backups) se configurará más adelante. Las pruebas iniciales usarán datos ficticios que puedan regenerarse.

## 11. Backups y disponibilidad acordados

| Aspecto | Acuerdo inicial | Estado |
|---|---|---|
| Backup local | Copias de PostgreSQL en el SATA de ~1 TB, además de copias de las VMs/configuración | Pendiente de configurar y probar restauración |
| Backup externo | R2 como respaldo independiente del servidor | Pendiente; no se configura en esta fase |
| Frecuencia externa | Objetivo de cada hora o cada varias horas; cadencia exacta por fijar al implementar según volumen y duración | Orientación aceptada, sin tarea programada todavía |
| Retención externa | Objetivo de unas 10 copias/puntos de recuperación recientes | Pendiente de concretar política automática |
| Caída del MS-A2 | Se acepta que la aplicación quede fuera de servicio hasta recuperar el servidor | Sin failover, réplica externa ni VPS de reserva |

PGDATA está en el disco con `backup=0`: **el backup de la VM no incluye los datos de PostgreSQL**. El plan local debe incluir expresamente una copia consistente de la base de datos. pgBackRest sigue siendo la herramienta prevista; el esquema de completas/diferenciales/incrementales y WAL se decidirá al implementar las copias. La retención debe conservar todo lo necesario para restaurar cada punto, no limitarse a borrar objetos S3 hasta dejar diez archivos.

La cobertura temporal de las diez copias dependerá de su frecuencia: diez copias horarias cubren aproximadamente diez horas, no diez días. Ante una avería se recuperará hasta la última copia válida; la pérdida de datos posible dependerá de ese intervalo y de si se configura archivado de WAL. No hay todavía un tiempo de recuperación comprometido ni una política de copias operativa.

Las claves de cifrado de los backups y `MESSAGE_ENCRYPTION_KEY` deben conservarse fuera del MS-A2. También queda pendiente proteger la configuración de Dokploy y las VMs. Las copias solo se considerarán operativas después de comprobar una restauración.

## 12. Evolución posterior y plan B

- **Continuidad:** si la aplicación consigue usuarios y justifica el coste, se podrá estudiar recuperación en un VPS u otro proveedor. No se contrata, implementa ni exige un simulacro de failover externo para esta fase. Los backups externos permitirán una recuperación manual futura cuando exista un destino; no mantienen el servicio disponible por sí solos.
- **Escala:** nuevas réplicas y distribución Erlang se valorarán según métricas; no forman parte del arranque inicial. Lo mismo aplica a réplica externa de PostgreSQL y observabilidad más avanzada.
- **Alternativa local a Dokploy:** los scripts de release y la unit systemd en `infra/deploy/` se conservan como referencia para operar en el mismo servidor si se decide cambiar de runtime; no son respaldo ante una avería del MS-A2.
