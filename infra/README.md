# Infrastructure

Documentación y servicios de infraestructura del monorepo.

- [Arquitectura del servidor propio](arquitectura.md): VMs, red, recursos y acuerdos de disponibilidad/backups.
- [Runbook de despliegue](deploy/README.md): pasos pendientes para Dokploy, PostgreSQL, CI y primeras pruebas (específico de ese servidor).
- [Monta tu instancia](../docs/12-self-hosting.md): guía genérica de self-hosting.
- `docker-compose.yml`: servicios de desarrollo local descritos debajo.

**Estado inicial acordado (2026-09-05):** una réplica y despliegues `stop-first` con interrupciones aceptadas; backups previstos en SATA local de ~1 TB y R2; sin servidor de reserva. Ventilador del PM1735 pedido: instalarlo y comprobar temperatura antes del despliegue y las pruebas sostenidas. R2 y backups se configurarán más adelante.

## Services

- `postgres` — PostgreSQL 17 con PostGIS 3.5 (`postgis/postgis:17-3.5-alpine`), en el puerto **5510** del host.
- `backend` — contenedor de desarrollo Elixir/Phoenix (perfil `backend`), con el puerto 4000 publicado.
- `mobile` — contenedor de desarrollo Node/Expo (perfil `mobile`).

## Quick start

```bash
# Solo la base de datos (lo más habitual)
docker compose -f infra/docker-compose.yml up postgres -d

# Contenedor del backend; después: docker compose -f infra/docker-compose.yml exec backend sh -lc "mix setup && mix phx.server"
docker compose -f infra/docker-compose.yml --profile backend up -d

# Contenedor móvil
docker compose -f infra/docker-compose.yml --profile mobile up -d
```

Con el backend en el host, apunta a esta base de datos con `DATABASE_URL=ecto://postgres:postgres@localhost:5510/snack_dev` (ya es el valor de `apps/backend/.env.example`).

## PostGIS

La imagen trae PostGIS y **las migraciones crean las extensiones** (`postgis`, `uuid-ossp`, `pgcrypto`): basta con `mix setup` (o `mix ecto.migrate`). En esta base de datos de desarrollo el usuario `postgres` es superusuario, así que no hace falta nada más.

> Si tenías un volumen `postgres-data` de una imagen de Postgres sin PostGIS, bórralo para que se inicialice limpio:
> ```bash
> docker compose -f infra/docker-compose.yml down -v
> docker compose -f infra/docker-compose.yml up postgres -d
> ```

## Ports

- `5510` en el host → `5432` en el contenedor — Postgres de desarrollo.
- `4000` en el host → `4000` en el contenedor — backend (solo con el perfil `backend`).

## Producción

Para montar una instancia propia, ver la guía genérica [`docs/12-self-hosting.md`](../docs/12-self-hosting.md). El runbook de `deploy/` es el del servidor propio del proyecto.
