# Infrastructure

Documentación y servicios de infraestructura del monorepo.

- [Arquitectura del servidor propio](arquitectura.md): VMs, red, recursos y acuerdos de disponibilidad/backups.
- [Runbook de despliegue](deploy/README.md): pasos pendientes para Dokploy, PostgreSQL, CI y primeras pruebas.
- `docker-compose.yml`: servicios de desarrollo local descritos debajo.

**Estado inicial acordado (2026-09-05):** una réplica y despliegues `stop-first` con interrupciones aceptadas; backups previstos en SATA local de ~1 TB y R2; sin servidor de reserva. Ventilador del PM1735 pedido: instalarlo y comprobar temperatura antes del despliegue y las pruebas sostenidas. R2 y backups se configurarán más adelante.

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
