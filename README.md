# Snack

App de dating móvil construida sobre un starter reusable (Expo + Phoenix). Monorepo con app móvil Expo, backend Phoenix y paquetes compartidos.

> El starter (auth, sesiones, UI, flags) es la base reutilizable; el producto dating se construye encima sin mezclarse en la base.

## Estado del proyecto

Consultar [`docs/progress.md`](./docs/progress.md) (avance) y [`docs/decisions.md`](./docs/decisions.md) (decisiones relevantes).

Resumen: backend dating completo y conforme a los contratos v1; app móvil con auth, bootstrap routing, onboarding parcial y discovery feed. Pendiente en móvil: location, fotos, matches, chat y safety.

## Documentación

Toda la documentación vive en [`docs/`](./docs). Empezar por [`docs/README.md`](./docs/README.md).

- `docs/00–01` — visión, alcance y requisitos de producto
- `docs/02–06` — arquitectura, dominio, datos y contratos
- `docs/07–08` — flujos de usuario e identidad visual
- `docs/09–11` — pruebas, plan de fases y deuda técnica
- `docs/decisions.md` — decisiones significativas con fecha y contexto
- `docs/progress.md` — avance del proyecto

## Estructura del monorepo

```
snack/
├── apps/
│   ├── mobile/            # App Expo (Expo Router): starter + features de dating
│   └── backend/           # Phoenix: auth, sesiones, config, dating
├── packages/
│   ├── contracts/         # DTOs compartidos backend ↔ móvil
│   └── mobile-shared/     # Clientes API, storage seguro y helpers móviles reutilizables
├── docs/                  # Documentación canónica del proyecto
├── infra/                 # arquitectura home server (arquitectura.md), deploy (deploy/) y compose dev
└── scripts/               # Entradas de test (test-mobile.sh / test-backend.sh)
```

## Inicio rápido

```bash
pnpm install

# Backend (requiere Postgres+PostGIS; ver docs/09 para el entorno)
cd apps/backend && mix setup && mix phx.server

# Móvil
cd apps/mobile && pnpm start
```

Variables de entorno: usar `apps/*/. env.example` como plantilla.

## Tests

```bash
pnpm test              # todo (móvil + backend)
pnpm test:mobile       # typecheck + mobile-shared + mobile + contracts
pnpm test:backend      # mix test (requiere Postgres+PostGIS en localhost:5432)
pnpm test:contracts    # solo contracts
```

## Estado de verificación

Cifras a agosto de 2026; las vivas están en [`docs/progress.md`](./docs/progress.md).

- Backend: **215 tests** verdes (`mix test`, Postgres 17 + PostGIS).
- Móvil: **131 tests** verdes (vitest) + typecheck limpio.
- Contracts: **18 tests** verdes.
