# Deploy del backend en el home server

Runbook operativo del despliegue de `apps/backend`. Arquitectura completa: [`../arquitectura.md`](../arquitectura.md) · Decisión de arquitectura: `docs/decisions.md` **D-2026-09-04**. Objetivo actual: primer despliegue y pruebas en el servidor propio. El acuerdo operativo vigente del 2026-09-05 acepta downtime de segundos o minutos, backups locales + R2 pendientes y ausencia de failover externo.

## Antes de empezar

Esperar al ventilador dedicado del PM1735 (ya pedido), instalarlo y comprobar temperaturas en reposo y con carga gradual. El despliegue y las pruebas sostenidas quedan para después de esta comprobación. La documentación fija la configuración objetivo; todavía hay pasos de CI/Dokploy pendientes.

## Topología definitiva

```
Internet → Cloudflare (proxied, Full strict)
        → UCG-Fiber (80/443 solo desde rangos IP de Cloudflare)
        → Caddy (DMZ 192.168.30.21)
        → Traefik (192.168.0.126:80, Swarm)
        → contenedor snack (:4000, nunca publicado directo)

GitHub Actions → tests → imagen ghcr.io/<repo>-backend:<sha> → API Dokploy (solo VPN)
snack-backend → PostgreSQL 192.168.0.142:5432 · fotos → R2 (UE)
```

| VM | IP | Contenido |
|---|---|---|
| caddy (VM 100) | 192.168.30.21 | Debian 13 + Caddy (systemd) |
| snack-backend (VM 101) | 192.168.0.126 | Debian 13 + Docker + Swarm 1 nodo + Dokploy + Traefik + snack |
| snack-db (VM 102) | 192.168.0.142 | Debian 13 + PostgreSQL 17 + PostGIS, PGDATA en PM1735 (raw block scsi1, ext4 noatime) |

## 1. Base de datos (snack-db)

Ya instalado: PG 17.11 + PostGIS 3.6.4 (PGDG), PGDATA en PM1735.

```bash
sudo -u postgres createuser snack --pwprompt        # contraseña: openssl rand -hex 32 → Bitwarden
sudo -u postgres createdb snack_prod --owner=snack
sudo -u postgres psql snack_prod -c 'CREATE EXTENSION postgis; CREATE EXTENSION pg_stat_statements;'
sudo -u postgres psql -c 'REVOKE ALL ON DATABASE snack_prod FROM PUBLIC;'
```

`postgresql.conf`:

- `listen_addresses = 'localhost,192.168.0.142'`
- `shared_preload_libraries = 'pg_stat_statements'` (reinicia; imprescindible para k6)
- Punto de partida: `shared_buffers = 4GB`, `effective_cache_size = 12GB`, `max_connections = 100`. `work_mem` al default hasta ver consultas reales.
- Backups previstos con pgBackRest en el SATA local de ~1 TB y en R2; frecuencia externa orientativa de una o varias horas y unas diez copias recuperables recientes. Cadencia, esquema de copias/WAL y retención final por concretar al configurarlo (ver §8).

`pg_hba.conf`: `host snack_prod snack 192.168.0.126/32 scram-sha-256`. Firewall VM: 5432 solo desde `.126`; SSH solo desde VPN.

**LUKS en PGDATA: decisión pendiente** (recomendado mientras la DB está vacía; GDPR art. 9). Coste: desbloqueo manual por SSH tras reboot.

## 2. Dokploy en snack-backend (VM 101)

```bash
curl -sSL https://dokploy.com/install.sh | bash   # instala Docker + Swarm 1 nodo + Dokploy + Traefik
```

- Panel (`:3000`) **solo por VPN** + 2FA TOTP. Nunca proxyficado, `/api/*` tampoco.
- Registry en Settings → Registry: bot de GitHub con PAT `read:packages` (rotación anual).
- Sistema de archivos: `daemon.json` con `log-driver json-file, max-size 50m, max-file 3`; cron semanal `docker image prune -a --filter until=168h`.
- Documentar en este runbook las versiones instaladas de Dokploy y Traefik (ciclos de actualización separados). **Snapshot de VM antes de cada actualización.**
- `/var/lib/docker` crece con imágenes: vigilar disco de 40GB.

## 3. Aplicación en Dokploy

- Aplicación tipo Docker, imagen `ghcr.io/<repo>-backend:<sha>` (nunca `latest`).
- Env del servicio (variables obligatorias en prod; el release no arranca sin ellas):
  `SECRET_KEY_BASE`, `AUTH_ACCESS_TOKEN_SALT`, `AUTH_REFRESH_TOKEN_SALT`, `MESSAGE_ENCRYPTION_KEY`, `DATABASE_URL` (`ecto://snack:…@192.168.0.142/snack_prod`), `PHX_HOST`, y `DATABASE_SSL=false`, `POOL_SIZE=20`, `ENABLE_SUBSCRIPTIONS=false`. Secretos generados con `openssl rand -base64 48` y guardados en Bitwarden.
- **Swarm (Advanced → Swarm)**: health check `curl -fsS localhost:4000/healthz`; UpdateConfig `order: stop-first`, `Parallelism 1`, `FailureAction rollback`, `Monitor 30s`; RollbackConfig también `order: stop-first` y `Parallelism 1`; `RestartPolicy on-failure`. **1 réplica**, sin distribución Erlang. Se acepta downtime de segundos o minutos y reconexión de los clientes; no se solapan versiones atendiendo chats.
- Comando/entrypoint objetivo: `sh -c "bin/migrate && exec bin/server"` (migraciones al arrancar, lock activo). Verificar el override en Dokploy: el CMD actual de la imagen solo ejecuta `/app/bin/server`.
- Dominio en Dokploy con HTTPS **desactivado** (TLS termina en Cloudflare/Caddy; Traefik escucha HTTP).

## 4. Publicación: cadena de confianza de IP real

1. **UCG-Fiber**: 80/443 hacia Caddy solo desde los rangos IP publicados de Cloudflare.
2. **Caddy**:
   ```
   api.snack.example {
       reverse_proxy 192.168.0.126:80
   }
   ```
   Con `trusted_proxies` estricto (solo rangos de Cloudflare) y preferencia por `CF-Connecting-IP`.
3. **Traefik** (traefik.yml editable desde Dokploy): en el entrypoint web, `forwardedHeaders.trustedIPs: ["192.168.30.21/32"]`. Sin redirecciones a HTTPS.
4. **Firewall snack-backend**: 80 solo desde `192.168.30.21`; 3000 solo VPN; SSH solo VPN.
5. **Phoenix** (pendiente en repo): plug `RemoteIp` con proxies explícitos (Caddy DMZ + subred Traefik); nunca confiar en redes privadas indiscriminadas.
6. Cloudflare: CNAME → `home.akorda.es` proxificado, Full strict. Verificar desde red externa. Nota: `vpn.akorda.es` (DNS-only) revela la WAN; riesgo aceptado para WireGuard.

## 5. CI/CD (`.github/workflows/ci.yml`)

- **Pausa inicial:** el job `deploy` tiene `if: ${{ false }}` para que los pushes guarden/verifiquen el trabajo sin desplegar antes de instalar el ventilador. Tests y build siguen habilitados. Rehabilitar el job al preparar el primer despliegue, corrigiendo también las condiciones del rollback manual.
- **PR**: `mix format` + `mix test` (service container PostGIS) + `pnpm test:mobile`. Nunca `pull_request_target`.
- **push a main**: build → `ghcr.io/<repo>-backend:<sha>` (`APP_VERSION=<sha>` horneado; cache GHA) → deploy (Environment `production`) → **verificación**: polling a `<PUBLIC_URL>/healthz` hasta `version == sha` (10 min); si no converge, workflow rojo. Mitiga Dokploy #3987 (rollbacks silenciosos de Swarm).
- **Rollback previsto**: `workflow_dispatch` con input `sha`, sobre una imagen ya publicada y con `stop-first`. **Pendiente de corregir en el workflow:** los jobs `build`/`deploy` solo admiten `push` y actualmente se saltan el despliegue manual. Nunca `ecto.rollback` en producción.
- Deploy vía API de Dokploy con Tailscale efímero desde Actions (secrets: `TAILSCALE_OAUTH_*`, `DOKPLOY_BASE_URL`, `DOKPLOY_APPLICATION_ID`, `DOKPLOY_API_KEY`; var `PUBLIC_URL`). Confirmar endpoints exactos contra el `/swagger` de la versión instalada.
- **Disponibilidad post-deploy pendiente:** añadir `/readyz` 200 a la verificación de versión. El workflow actual solo comprueba `/healthz`; no confundir liveness con conexión a PostgreSQL.
- Retención: GHCR últimos 30 SHAs (`actions/delete-package-versions` en el futuro); prune semanal en VM.

## 6. Migraciones: reglas

- Lock de migraciones **siempre activo**; para índices concurrentes solo `@disable_ddl_transaction true` (nunca `@disable_migration_lock true`).
- Expand/contract sin excepciones: nullable → dual-write → backfill por lotes → NOT NULL/índice → quitar lectura vieja → drop en el release siguiente. Nunca rename/DROP en el mismo release.
- Con `stop-first`, primero se detiene la app anterior y después se migra y arranca la nueva. El downtime incluye migraciones y arranque. Un fallo puede prolongarlo hasta el rollback de imagen o la intervención manual; no se garantiza servicio durante una migración fallida. Mantener compatibilidad con N−1.
- Incluir en el primer despliegue las migraciones `20260905170000` (desactivar cuentas ya borradas) y `20260905170100` (caducar intents de fotos antiguos pendientes). El rollback de imagen no deshace sus cambios de datos.

## 7. Pruebas de rendimiento (objetivo inmediato)

- Primero preparar cuentas/perfiles ficticios y comprobar arranque, `/healthz`, `/readyz`, login, feed, matching y chat por API; probar también despliegue con interrupción y recuperación del cliente. Se puede empezar en LAN/VPN y sin R2.
- Generar seeds con volumen realista (miles de perfiles con ubicación PostGIS) — sin datos, el feed no ejercita índices geoespaciales.
- k6 vía `https://<dominio>` (recorrido real) o directo a Traefik `http://192.168.0.126:80` con `Host` + `X-Forwarded-Proto: https`.
- Ventilador instalado antes de esta fase. Registrar de nuevo el reposo (última referencia: 62°C, aviso 65°C) y vigilar `smartctl -A` durante carga gradual; confirmar mejora antes de sostener la carga. La instalación del ventilador por sí sola no acredita el resultado.
- `pg_stat_statements` para atribuir latencias a queries concretas.

## 8. Backups y operación antes de conservar datos reales

Las primeras pruebas con datos ficticios regenerables pueden empezar con los backups y R2 todavía pendientes. Antes de conservar datos reales:

- [ ] Configurar backup consistente de PostgreSQL al SATA de ~1 TB. **PGDATA tiene `backup=0` y no entra en vzdump**; copiar solo la VM es insuficiente.
- [ ] Configurar también destino R2 como copia externa. Objetivo: una copia/punto recuperable cada hora o cada varias horas, reteniendo unas diez recientes. Fijar intervalo y política final según volumen/duración; no hay un cron ni una retención implementados todavía.
- [ ] Definir con pgBackRest la combinación de completas, diferenciales/incrementales y WAL. Mantener todas las dependencias de cada punto recuperable; diez puntos no equivalen a diez objetos S3. Diez copias horarias cubren aproximadamente diez horas.
- [ ] Guardar claves de backups y `MESSAGE_ENCRYPTION_KEY` fuera del servidor; comprobar una restauración desde la copia local y otra desde R2.
- [ ] Configurar backup de Dokploy (incluidos su PostgreSQL interno y configuración) y copias de VMs al SATA; ajustar retención al espacio compartido de ~1 TB.
- [ ] Completar monitorización de fallos de backup, disco, PostgreSQL y temperatura. Uptime externo informa de caídas, sin recuperación automática.
- [ ] Resolver la decisión pendiente de LUKS y, si se incorpora UPS, verificar su funcionamiento; no dar ninguna de estas medidas por instalada.

No se configura ahora alta disponibilidad, réplica externa ni VPS de reserva. Ante una caída del MS-A2 se acepta indisponibilidad hasta su recuperación, sin plazo garantizado. La restauración de backups recupera datos; no sustituye al servidor averiado.

## 9. Alternativa local a Dokploy y evolución futura

`deploy-backend.sh` + `snack-backend.service` quedan como referencia para operar el release directamente en el servidor propio si se decide abandonar Dokploy. No ofrecen failover ante una avería del hardware.

Si la aplicación consigue usuarios y justifica el coste, se podrá estudiar una recuperación temporal en VPS u otro proveedor. No se requiere contratar ese servicio ni preparar un simulacro de evacuación externo para empezar las pruebas actuales.
