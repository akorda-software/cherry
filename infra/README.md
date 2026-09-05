# Infrastructure

Documentación y servicios de infraestructura del monorepo.

- `docker-compose.yml`: servicios de desarrollo local descritos debajo.

## Services

- `postgres` — PostgreSQL 17 with **PostGIS 3.5** extension enabled.
- `backend` — Elixir/Phoenix development container.
- `mobile` — Node/Expo development container.

## Quick start

```bash
# Start only the database (most common)
docker compose up postgres -d

# Start the backend container
docker compose --profile backend up -d

# Start the mobile container
docker compose --profile mobile up -d
```

## PostGIS

The Postgres image includes PostGIS out of the box. After the container is running, enable the extension in your database:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

> **Note:** If you had a previous `postgres-data` volume from the plain Postgres image, you may need to remove it first so PostGIS initializes cleanly:
> ```bash
> docker compose down -v
> docker compose up postgres -d
> ```

## Ports

- `5510` en el host → `5432` en el contenedor — Postgres de desarrollo (configuración de `docker-compose.yml`).
