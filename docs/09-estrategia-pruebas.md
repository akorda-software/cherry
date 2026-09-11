# Estrategia de pruebas

## Suites

| Suite | Comando | Estado |
|---|---|---|
| Backend (ExUnit) | `pnpm test:backend` → `mix test` en `apps/backend` | 215 tests verdes |
| Móvil (vitest + jsdom) | `pnpm --filter @snack/mobile test` | 131 tests verdes |
| Mobile-shared (vitest) | `pnpm --filter @snack/mobile-shared test` | incluido en `test:mobile` |
| Contracts (vitest) | `pnpm test:contracts` | 18 tests verdes |

`pnpm test:mobile` ejecuta: typecheck de mobile y mobile-shared → tests mobile-shared → tests mobile → tests contracts. `pnpm test` = móvil + backend.

## Entorno del backend

Los tests requieren **PostgreSQL 17 + PostGIS** en `localhost:5432` (usuario/pass `postgres`, DB `snack_test`; ver `config/test.exs`). El compose de `infra/` expone dev en el puerto 5510; para tests, levantar una instancia PostGIS en 5432 o ajustar config. `mix test` crea y migra la DB automáticamente.

Cobertura: umbral 90% configurado en `mix.exs`.

## Qué se prueba

### Backend
- Dominio dating completo (`dating_test.exs`): perfiles draft, completitud, discovery con filtros/scoring, swipes, matches, conversaciones.
- Controllers API: profile, discovery, chat REST, push-token, tags.
- Canal de chat: join rules, envío, broadcasts.
- Auth: validación/expiración de tokens REST y WS, rotación y revocación por reuso.

### Móvil
- Routing: root navigation, private shell, onboarding resolver, runtime config.
- Features: session manager (refresh/retry), auth providers y callbacks, discovery feed hook (optimismo + rollback), tag selection.
- UI: contrato de tokens/tema, componentes.

### Contracts
- Serialización/forma de los DTOs compartidos (session, auth, discovery).

## Mocks nativos

`apps/mobile/test/mocks/` simula los módulos nativos usados (15 mocks) para jsdom: expo-secure-store, google-signin, expo-apple-authentication, datetimepicker, expo-image, flash-list, react-native, react-native-svg, expo-router (+drawer), expo-application, expo-device, expo-constants, expo-crypto, react-native-safe-area-context. Setup central en `test/setup.ts`.

## Huecos conocidos

Sin tests de controller dedicados para bootstrap/safety/settings/match; sin tests de las pantallas de onboarding ni del resolver `stepToRoute`. Detalle en `11-deuda-tecnica-pendiente.md`.
