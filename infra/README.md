# Servicios de desarrollo

`docker-compose.yml` levanta los servicios de desarrollo local y `load/` contiene las pruebas de carga.

## Services

- `postgres` — PostgreSQL 18 con PostGIS 3.6 (`postgis/postgis:18-3.6-alpine`), en el puerto **5510** del host (solo `127.0.0.1`).
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

Con el backend en el host, apunta a esta base de datos con `DATABASE_URL=ecto://postgres:postgres@localhost:5510/cherry_dev` (ya es el valor de `apps/backend/.env.example`).

## PostGIS

La imagen trae PostGIS y **las migraciones crean las extensiones** (`postgis`, `uuid-ossp`, `pgcrypto`): basta con `mix setup` (o `mix ecto.migrate`). En esta base de datos de desarrollo el usuario `postgres` es superusuario, así que no hace falta nada más.

### Venir de PostgreSQL 17

La 18 usa un volumen nuevo (`postgres18-data`): el antiguo `postgres-data` no se toca ni se lee.
Para conservar tus datos de desarrollo, vuélcalos antes con la 17 y cárgalos en la 18:

```bash
# Con el contenedor de la 17 aún en marcha
docker exec <contenedor-postgres-17> pg_dumpall -U postgres > /tmp/dev-pg17.sql
docker stop <contenedor-postgres-17>
docker compose -f infra/docker-compose.yml up postgres -d
docker compose -f infra/docker-compose.yml exec -T postgres psql -U postgres -X -q < /tmp/dev-pg17.sql
```

Si no necesitas los datos, basta con `mix setup` sobre la base nueva. Cuando ya no te haga falta,
borra el volumen antiguo con `docker volume rm <proyecto>_postgres-data`.

## Ports

- `5510` en el host (solo `127.0.0.1`) → `5432` en el contenedor — Postgres de desarrollo.
- `4000` en el host → `4000` en el contenedor — backend (solo con el perfil `backend`).

## Producción

Para montar una instancia propia, ver la guía genérica [`docs/12-self-hosting.md`](../docs/12-self-hosting.md).
