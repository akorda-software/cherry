# Deploy del backend en el home server

Runbook operativo del despliegue de `apps/backend`. Arquitectura completa:
[`../arquitectura.md`](../arquitectura.md). Se acepta downtime de segundos/minutos,
sin failover externo. La política de copias del 2026-10-17 sustituye los planes
antiguos de copias locales/pgBackRest: [circuito vigente](../backup/README.md).

## Estado (2026-10-17)

**Producción actual:** `c0084736b734f2e31ea820f7a192d7c577eee3ea`, [CI
39027167214](https://github.com/akorda-software/cherry/actions/runs/39027167214)
correcto, despliegue manual Dokploy `hvlN93QbxGTGZ0qYuEWTY` en `done`, Swarm
1/1 e imagen exacta. Incluye borrado físico y sus migraciones previas, fotos
privadas R2 y registro externo; backoffice explícitamente **desactivado**, sin
personal provisionado. La landing/textos publicados siguen siendo borradores,
no apertura ni cierre jurídico. Sin APK/IPA ni cambios OAuth, DNS o firewall.

Traslado de dos fotos sin cambiar claves: GET privado firmado 200/206, sin firma
rechazado (400), firma caducada 403. Los dos originales locales se retiraron tras
verificar hashes en R2; caché de las URLs antiguas purgada por archivo. Esas rutas
responden 404 también desde Internet. `/healthz`, `/readyz`, CSS y acceso no
autenticado a fotos verificados. Tokens R2 deniegan otros buckets. El bind local
sigue configurado pero vacío; no se usa para servir/subir ni se respalda.

Backups activos en cherry-db: diario 03:15 UTC (+0–5 min), limpieza cada 15 min y
comprobación horaria, tres servicios con resultado `success`. Primera copia
protegida 2026-10-17 11:08:23 UTC, cifrada y verificada por descarga; retirada la
copia transitoria anterior al corte. Registro probado con UUID sintético inexistente
y acuse real; ambos objetos de prueba retirados. Inventario final: una cuenta,
dos fotos, cero tareas de borrado y cero staff. No ejecutar rollback ciego a
`fd9ce10`: no soporta lecturas privadas y los archivos locales ya no existen;
mantener el acceso privado/cerrado mientras se corrige hacia delante.

**Publicado en `https://cherry.akorda.es`** (desde el 2026-10-14; antes solo LAN). Cadena: Cloudflare (CNAME proxificado a `home.akorda.es`) → Caddy (bloque `cherry.akorda.es { reverse_proxy 192.168.0.126:80 }`) → Traefik → contenedor. En el UCG-Fiber, la regla `DMZ-Caddy to cherry-backend 80` (192.168.30.21 → 192.168.0.126 TCP 80; la de vuelta la deriva UniFi). `http://192.168.0.126` sigue respondiendo desde la LAN. Cambio respecto al plan original (D-2026-10-13b en `docs/decisions.md`): **el panel es el Dokploy de nipogi** (`nipogi-dokploy`, 192.168.0.121, v0.30.8) y cherry-backend es un *servidor remoto* suyo. En la VM solo corren Docker, Swarm de un nodo y Traefik; sin panel ni su PostgreSQL.

| Pieza | Estado |
|---|---|
| cherry-db | Rol `cherry`, `cherry_prod` (postgis, pg_stat_statements, pgcrypto, uuid-ossp), `conf.d/10-cherry.conf` (listen LAN, 4 GB shared_buffers), `pg_hba` solo `.126`. nftables: 22 desde LAN/VPN, 5432 solo desde `.126` |
| cherry-backend | Docker 28.5 + Swarm + Traefik 3.6 (Setup Server de Dokploy). Root por SSH solo desde 192.168.0.121 con su clave (`sshd_config.d/05-dokploy.conf`, `from=` en `authorized_keys`). `daemon.json` con rotación de logs, `cron.weekly/docker-image-prune`. Snapshot Proxmox `antes-dokploy`. nftables (tabla `inet cherry_fw`, no toca las de Docker): 22 desde LAN/VPN; 80 desde Caddy **y la LAN** (quitar la LAN al publicar); 443 y puertos de Swarm cerrados |
| Dokploy | Proyecto `cherry` → entorno `production` → app `backend` (`cherry-backend-mkeaem`): imagen pública `ghcr.io/akorda-software/cherry-backend:<sha>`, 1 réplica, `stop-first`, rollback, healthcheck `/healthz`, bind `/var/lib/cherry/uploads`, dominios `cherry.akorda.es` y `192.168.0.126`, ambos sin HTTPS en Traefik (TLS en Cloudflare/Caddy) |
| Env | `PHX_HOST=cherry.akorda.es`, `PHX_URL_SCHEME=https`, `PUBLIC_BASE_URL=https://cherry.akorda.es`, `FORCE_SSL=false` (ver pendientes), `STORAGE_ADAPTER=r2`, `ERASURE_JOURNAL_ENABLED=true`, `BACKOFFICE_ENABLED=false`, `AGE_VERIFICATION_REQUIRED=true`. OAuth preservado. Paquete vigente de recuperación en `~/.config/cherry-recovery/production.env` (Olares, 0600), junto a identidad age y credenciales limitadas |

Despliegues (cómo se hace hoy, mientras el job `deploy` del CI sigue pausado): el CI publica la imagen `ghcr.io/akorda-software/cherry-backend:<sha>` en cada push a `main`; después, con la API de Dokploy de nipogi, `application.saveDockerProvider` con la imagen nueva y `application.deploy`. Comprobar con `curl http://192.168.0.126/healthz` (devuelve el `version` desplegado).

| Fecha | Imagen | Qué |
|---|---|---|
| 2026-10-13 | `d6f9bc9` | Primer despliegue (LAN) |
| 2026-10-14 | `cd3226e` | NFC con los CSCA de 129 países (638 certificados), tarjetas sin CAN, edad antes que caducidad |
| 2026-10-14 | `cd3226e` | Mismo código: dominio público `cherry.akorda.es` y login con Google |
| 2026-10-14 | `cd3226e` | Mismo código: client ID web del proyecto Cherry y verificación de edad obligatoria |
| 2026-10-14 | `2e92a5e` | Volver a registrarse tras borrar la propia cuenta (`users.deletion_reason`); purgada a mano la única cuenta, ya borrada |
| 2026-10-16 | `fd9ce10` | Cuatro pasadas de rendimiento y robustez del backend/móvil; backend desplegado y verificado por versión, health/readiness y Swarm |
| 2026-10-17 | `c008473` | Fotos privadas R2 UE, bajas externas antirrestauración, borrado físico y copias diarias cifradas de siete días (sin fotos); backoffice apagado |

Publicación del 2026-10-16: commit `fd9ce10d6fd064b906663f6c2a21b9749026938a`, [CI 38871351664](https://github.com/akorda-software/cherry/actions/runs/38871351664) en verde (tests backend/móvil y build/push de imagen). Deploy manual por API de NiPoGi sobre la app existente `cherry-backend-mkeaem`, sin activar el job pausado del workflow. Sin migraciones nuevas ni cambios de contratos, secretos, red o infraestructura; se conservan 1 réplica, `stop-first`/rollback y el bind de fotos. Imagen previa para rollback: `ghcr.io/akorda-software/cherry-backend:2e92a5e9668f972f4a9af66d2756d2c3a692c787`. No se compilaron ni publicaron APK/IPA; los OAuth de Apple/Google para iOS quedan para el siguiente trabajo.

Verificado: despliegue Dokploy `XQca1lsdNEN2f9CgWQUUE` en `done`, actualización Swarm `completed` (08:09 UTC), imagen esperada y volumen `/var/lib/cherry/uploads` conservado. Los endpoints públicos `/healthz` y `/readyz` y el healthcheck de origen devuelven 200 con el SHA exacto, estables durante al menos 35 segundos; `/api/config` público también devuelve 200. Sondeo público con `curl`: `urllib` desde Olares obtenía 403 del borde, sin modificar políticas para comprobarlo. No se realizaron pruebas de carga ni cambios en OAuth/tiendas.

Pendiente:
- `FORCE_SSL=false`: Traefik aún no confía en el `X-Forwarded-Proto` de Caddy (falta `forwardedHeaders.trustedIPs: [192.168.30.21/32]` en el entrypoint `web` de `/etc/dokploy/traefik/traefik.yml` y reiniciar Traefik); con `FORCE_SSL` activo antes, bucle de redirecciones. Desde fuera ya solo se entra por HTTPS (Caddy redirige); falta HSTS.
- Quitar la LAN de `web_clients` en cherry-backend (ahora 80 abierto a 192.168.0.0/24) y el dominio `192.168.0.126` de Dokploy cuando no haga falta.
- Guardar además una copia offline de la identidad age y mantener actualizado el
  paquete privado de recuperación. El circuito de backups/restauración está
  activado/verificado; no incluye fotos ni certifica recuperación del host completo.
- Swarm se anuncia con la IP pública (79.117.30.255) porque así la detecta el instalador. Da igual con un nodo y sus puertos están cerrados.
- El panel de nipogi es accesible en `https://dokploynipogi.akorda.es` (el plan pedía solo VPN).
- CI `deploy` sigue pausado.

## Antes de empezar

Esperar al ventilador dedicado del PM1735 (ya pedido), instalarlo y comprobar temperaturas en reposo y con carga gradual. El despliegue y las pruebas sostenidas quedan para después de esta comprobación. La documentación fija la configuración objetivo; todavía hay pasos de CI/Dokploy pendientes.

## Topología definitiva

```
Internet → Cloudflare (proxied, Full strict)
        → UCG-Fiber (80/443 solo desde rangos IP de Cloudflare)
        → Caddy (DMZ 192.168.30.21)
        → Traefik (192.168.0.126:80, Swarm)
        → contenedor cherry (:4000, nunca publicado directo)

GitHub Actions → tests → imagen ghcr.io/<repo>-backend:<sha> → API Dokploy (solo VPN)
cherry-backend → PostgreSQL 192.168.0.142:5432 · fotos → volumen local (UPLOADS_DIR) o R2 (UE)
```

| VM | IP | Contenido |
|---|---|---|
| caddy (VM 100) | 192.168.30.21 | Debian 13 + Caddy (systemd) |
| cherry-backend (VM 101) | 192.168.0.126 | Debian 13 + Docker + Swarm 1 nodo + Traefik + cherry (servidor remoto del Dokploy de nipogi) |
| cherry-db (VM 102) | 192.168.0.142 | Debian 13 + PostgreSQL 17 + PostGIS, PGDATA en PM1735 (raw block scsi1, ext4 noatime) |

## 1. Base de datos (cherry-db)

Ya instalado: PG 17.11 + PostGIS 3.6.4 (PGDG), PGDATA en PM1735.

```bash
sudo -u postgres createuser cherry --pwprompt        # contraseña: openssl rand -hex 32 → Bitwarden
sudo -u postgres createdb cherry_prod --owner=cherry
sudo -u postgres psql cherry_prod -c 'CREATE EXTENSION postgis; CREATE EXTENSION pg_stat_statements;'
sudo -u postgres psql -c 'REVOKE ALL ON DATABASE cherry_prod FROM PUBLIC;'
```

`postgresql.conf`:

- `listen_addresses = 'localhost,192.168.0.142'`
- `shared_preload_libraries = 'pg_stat_statements'` (reinicia; imprescindible para k6)
- Punto de partida: `shared_buffers = 4GB`, `effective_cache_size = 12GB`, `max_connections = 100`. `work_mem` al default hasta ver consultas reales.
- Política aprobada 2026-10-17: pg_dump completo diario cifrado con age a R2 privado UE,
  siete días, sin fotos ni WAL/incrementales ni históricos adicionales. [Circuito y recuperación](../backup/README.md).

`pg_hba.conf`: `host cherry_prod cherry 192.168.0.126/32 scram-sha-256`. Firewall VM: 5432 solo desde `.126`; SSH solo desde VPN.

**LUKS en PGDATA: decisión pendiente** (recomendado mientras la DB está vacía; GDPR art. 9). Coste: desbloqueo manual por SSH tras reboot.

## 2. cherry-backend como servidor remoto de Dokploy (nipogi)

1. Clave SSH propia en Dokploy (Settings → SSH Keys, `cherry-backend`); su pública en `/root/.ssh/authorized_keys` con `from="192.168.0.121"`, y `sshd_config.d/05-dokploy.conf` con `PermitRootLogin prohibit-password` + `AllowUsers root@192.168.0.121` (antes de `10-akorda-hardening`).
2. Remote Servers → crear (`root@192.168.0.126`, tipo deploy) → **Setup Server** (Docker, Swarm, red `dokploy-network`, Traefik).
3. Snapshot de la VM antes del Setup Server y antes de cada actualización.

Plan original, ya descartado: instalar Dokploy completo en la VM (`curl -sSL https://dokploy.com/install.sh | bash`).

- Panel (`:3000`) **solo por VPN** + 2FA TOTP. Nunca proxyficado, `/api/*` tampoco.
- Registry en Settings → Registry: bot de GitHub con PAT `read:packages` (rotación anual).
- Sistema de archivos: `daemon.json` con `log-driver json-file, max-size 50m, max-file 3`; cron semanal `docker image prune -a --filter until=168h`.
- Documentar en este runbook las versiones instaladas de Dokploy y Traefik (ciclos de actualización separados). **Snapshot de VM antes de cada actualización.**
- `/var/lib/docker` crece con imágenes: vigilar disco de 40GB.

## 3. Aplicación en Dokploy

- Aplicación tipo Docker, imagen `ghcr.io/<repo>-backend:<sha>` (nunca `latest`).
- Env del servicio (variables obligatorias en prod; el release no arranca sin ellas):
  `SECRET_KEY_BASE`, `AUTH_ACCESS_TOKEN_SALT`, `AUTH_REFRESH_TOKEN_SALT`, `MESSAGE_ENCRYPTION_KEY`, `DATABASE_URL` (`ecto://cherry:…@192.168.0.142/cherry_prod`), `PHX_HOST`, `STORAGE_ADAPTER` (+ `UPLOADS_DIR` si es `local`), y `DATABASE_SSL=false`, `POOL_SIZE=20`, `PUBLIC_BASE_URL=https://<dominio>`. Secretos generados con `openssl rand -base64 48` y guardados en Bitwarden. Plantilla: [`env.example`](env.example).
- **Swarm (Advanced → Swarm)**: health check `curl -fsS localhost:4000/healthz`; UpdateConfig `order: stop-first`, `Parallelism 1`, `FailureAction rollback`, `Monitor 30s`; RollbackConfig también `order: stop-first` y `Parallelism 1`; `RestartPolicy on-failure`. **1 réplica**, sin distribución Erlang. Se acepta downtime de segundos o minutos y reconexión de los clientes; no se solapan versiones atendiendo chats.
- Comando por defecto de la imagen: `sh -c "/app/bin/migrate && exec /app/bin/server"` (migraciones + catálogo de etiquetas idempotente al arrancar, lock activo; `bin/seed` solo sincroniza el catálogo). No hace falta override en Dokploy; si había uno con solo `/app/bin/server`, quitarlo. Healthcheck en `${PORT:-4000}` con 60 s de arranque.
- Dominio en Dokploy con HTTPS **desactivado** (TLS termina en Cloudflare/Caddy; Traefik escucha HTTP).

### 3.1 Almacenamiento de fotos (D-2026-09-29)

`STORAGE_ADAPTER` es obligatorio en prod (el release no arranca sin él). El contrato del móvil es el mismo con ambos.

**`local` (sin S3, recomendado para las primeras pruebas):**

- La subida es un `PUT /api/uploads/<token>` firmado que escribe en `UPLOADS_DIR/pending/` (no público); al completarla la foto pasa a `UPLOADS_DIR/photos/<clave aleatoria>.<ext>` (sin id de perfil) y Phoenix la sirve en `https://<dominio>/uploads/...` con `Cache-Control: public, max-age=86400` (Cloudflare la cachea por extensión). Las fotos antiguas en `profiles/` se siguen sirviendo. No hace falta abrir nada más que el propio backend.
- `UPLOADS_DIR` debe ser un **volumen persistente** (no el sistema de ficheros del contenedor: se perdería en cada despliegue). En Dokploy: *Advanced → Volumes* → bind mount del host `/var/lib/cherry/uploads` en el contenedor en la misma ruta. El contenedor corre como `nobody`:
  ```bash
  sudo mkdir -p /var/lib/cherry/uploads && sudo chown 65534:65534 /var/lib/cherry/uploads
  ```
- Definir `PUBLIC_BASE_URL=https://<dominio>` para que las URLs absolutas no dependan de las cabeceras `Host` que lleguen tras Caddy/Traefik.
- Tamaño: máx. 2 MB por foto (`UPLOAD_MAX_BYTES`) × 4 fotos por perfil; vigilar el disco de 40 GB de la VM o montar un disco/volumen dedicado. Ni Caddy ni Traefik limitan el cuerpo por defecto; Cloudflare (plan gratuito) admite hasta 100 MB.
- **No se respalda `UPLOADS_DIR`**. Borrar una foto o la cuenta borra el fichero;
  un barrido cada 10 min elimina subidas abandonadas. Este adaptador local conserva
  una ruta pública; para fotos privadas de producción usar R2 privado. Sus cachés
  antiguas requieren purga al migrar, no basta cambiar el adaptador.

**`r2` privado (producción):** `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET_NAME` y `R2_ACCOUNT_ID`, o `S3_ENDPOINT` + `S3_REGION` (UE:
`https://ACCOUNT.eu.r2.cloudflarestorage.com`, región `auto`). Desactivar r2.dev
y dominios públicos. `R2_PUBLIC_URL_BASE` solo reconoce referencias anteriores;
ya no es obligatorio ni crea acceso público. La BD guarda una referencia sin
firma; las respuestas autorizadas firman GET de 300 segundos, `private, no-store`.
`POST /api/photos/read-url` renueva comprobando visibilidad/bloqueos/edad/estado.
Las URLs siguen siendo bearer temporales y no revocan copias ya descargadas.

El móvil sube el archivo directo a R2; el backend verifica HEAD + 32 bytes y
publica por copia interna. CORS del origen web oficial: PUT/GET/HEAD con
Content-Type e If-None-Match. Token limitado al bucket con lectura/escritura/
borrado; pending/ caduca a un día como defensa adicional. Con `r2`, Phoenix
**no sirve `/uploads`**, aunque quede el antiguo bind en el host. Migrar y
verificar objetos antes del corte; conservar claves para snapshots antiguos,
reescribir referencias y purgar cachés/rutas locales. Nunca activar el adaptador
antes de trasladar las fotos. [Recuperación sin backup de fotos](../backup/README.md).

## 4. Publicación: cadena de confianza de IP real

1. **UCG-Fiber**: 80/443 hacia Caddy solo desde los rangos IP publicados de Cloudflare.
2. **Caddy**:
   ```
   api.cherry.example {
       reverse_proxy 192.168.0.126:80
   }
   ```
   Con `trusted_proxies` estricto (solo rangos de Cloudflare) y preferencia por `CF-Connecting-IP`.
3. **Traefik** (traefik.yml editable desde Dokploy): en el entrypoint web, `forwardedHeaders.trustedIPs: ["192.168.30.21/32"]`. Sin redirecciones a HTTPS.
4. **Firewall cherry-backend**: 80 solo desde `192.168.30.21`; 3000 solo VPN; SSH solo VPN.
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
- **Índices sobre `swipe_actions` (sin `CONCURRENTLY`, decisión consciente):** `20260929113715_discovery_ranking_v2` (`swipe_actions_likes_received_index`) y `20260929154521_add_dislikes_received_index` (`swipe_actions_dislikes_received_index`) crean índices normales, que bloquean escrituras en `swipe_actions` mientras se construyen. Con el lock de migraciones por tabla (el de Ecto por defecto), `CREATE INDEX CONCURRENTLY` espera a la transacción que sostiene el lock y se queda colgado, y desactivar el lock está prohibido arriba; además el primero va mezclado con otro DDL en la misma migración. En el primer despliegue la tabla está vacía o es pequeña y, con `stop-first`, nadie escribe durante la migración, así que el coste es nulo. **Si algún día hace falta un índice sobre una tabla grande ya en producción:** cambiar el repo a `migration_lock: :pg_advisory_lock` (el lock sigue activo, pero sin transacción abierta) y crear el índice en su propia migración con `@disable_ddl_transaction true` y `concurrently: true`; si se interrumpe, borrar el índice `INVALID` y reintentar.
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

El plan antiguo de pgBackRest/SATA/diez puntos queda **sustituido** por el
[runbook de backups y recuperación](../backup/README.md): copia completa diaria
independiente, age, R2 privado UE, siete días y limpieza explícita verificada;
sin copias de imágenes. `PGDATA backup=0`: vzdump no protege PostgreSQL.

El registro externo de bajas debe estar activo antes de conservar copias:
`ERASURE_JOURNAL_*`, bucket distinto sin TTL ciego. Restaurar aislado, reaplicar
todos los registros, invalidar sesiones, conservar fotos válidas y limpiar solo
objetos huérfanos después de cerrar las firmas. No reabrir con registro inaccesible.

No añadir copias de VM/Dokploy con datos de Cherry al margen de ese circuito:
ampliarían la conservación y el alcance de la reconciliación. El backup de
infraestructura ajena no forma parte de este encargo. Pendientes separados:
LUKS/UPS, observación de disco/temperatura y recuperación física del host.

No se configura ahora alta disponibilidad, réplica externa ni VPS de reserva. Ante una caída del MS-A2 se acepta indisponibilidad hasta su recuperación, sin plazo garantizado. La restauración de backups recupera datos; no sustituye al servidor averiado.

## 9. Alternativa local a Dokploy y evolución futura

`deploy-backend.sh` + `cherry-backend.service` quedan como referencia para operar el release directamente en el servidor propio si se decide abandonar Dokploy. No ofrecen failover ante una avería del hardware.

Si la aplicación consigue usuarios y justifica el coste, se podrá estudiar una recuperación temporal en VPS u otro proveedor. No se requiere contratar ese servicio ni preparar un simulacro de evacuación externo para empezar las pruebas actuales.
