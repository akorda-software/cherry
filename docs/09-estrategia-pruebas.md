# Estrategia de pruebas

## Suites

Cifras de la última ejecución (2026-09-29), todas en verde:

| Suite | Comando | Tests |
|---|---|---|
| Backend (ExUnit) | `pnpm test:backend` → `mix test` en `apps/backend` | 384 |
| Móvil (vitest + jsdom) | `pnpm --filter @snack/mobile test` | 678 (95 ficheros) |
| Mobile-shared (vitest) | `pnpm --filter @snack/mobile-shared test` | 43 |
| Contracts (vitest) | `pnpm test:contracts` | 23 |

`pnpm test:mobile` ejecuta: typecheck de mobile y mobile-shared → tests mobile-shared → tests mobile → tests contracts. `pnpm test` = móvil + backend.

## Entorno del backend

Sin variables, los tests usan **PostgreSQL 17 + PostGIS** en `localhost:5432` (usuario/pass `postgres`, DB `snack_test`; ver `config/test.exs`). Con el PostGIS del compose de `infra/` (puerto 5510):

```bash
cd apps/backend
TEST_DATABASE_URL=ecto://postgres:postgres@localhost:5510/snack_test mix test
```

`DATABASE_URL` solo se usa en tests si el nombre de la BD contiene `_test` (p. ej. `snack_test_fix` para una copia aislada); si apunta a otra (p. ej. `snack_dev` exportado en la shell), `mix test` se niega a arrancar en vez de machacarla. `mix test` crea y migra la DB automáticamente. Para correr la suite en paralelo con un servidor de desarrollo, usa otra BD y otro directorio de build: `TEST_DATABASE_URL=…/snack_test_x MIX_BUILD_ROOT=_build_x mix test`.

En CI (`.github/workflows/ci.yml`) el backend se prueba contra un servicio `postgis/postgis:17-3.5` en el puerto 5432.

Cobertura: umbral 90 % configurado en `mix.exs` (`mix test --cover`).

## Qué se prueba

### Backend
- Dominio dating (`dating_test.exs`, `discovery_test.exs`): perfiles draft, completitud, ranking v2 con sus filtros duros y puntuación, swipes, matches, conversaciones, caducidad.
- Concurrencia real: dos likes simultáneos crean exactamente un match (`swipe_concurrency_test.exs`).
- Controllers API: auth y login de desarrollo, sesión, config, bootstrap/safety/settings, perfil, fotos y etiquetas, subidas locales, discovery (paginación, ranking, deshacer), API social y visibilidad, matches y chat, push-token, etiquetas.
- Canal de chat: reglas de join, envío, lectura y broadcasts.
- Auth: validación/expiración de tokens REST y WS, rotación y revocación por reuso; proveedores Google/Apple.
- Almacenamiento (local y R2 con respuestas simuladas), cifrado de mensajes, configuración de runtime y `Snack.Release.seed/0`.

### Móvil
- Routing: navegación raíz, zona privada, cierre de sesión y runtime config (`test/router/*`).
- Features (`src/features/**/*.test.ts`): sesión (refresh/retry), proveedores y callbacks de auth, onboarding (pasos, reanudación, preferencias, fecha de nacimiento), cola de discovery (optimismo, rollback, deshacer), likes, matches, chat (sesión de socket, mensajes), fotos, ubicación, seguridad, ajustes y pestaña Yo.
- UI (`test/ui/*`): contrato de tokens/tema y componentes (botones, pegatinas, conmutador, campos, hojas, avisos, barra de pestañas).

### Contracts
- Forma de los DTOs compartidos (session, auth, config, discovery y social).

## Mocks nativos

`apps/mobile/test/mocks/` simula los módulos nativos usados para jsdom (22 mocks): expo-apple-authentication, expo-application, expo-constants, expo-crypto, expo-device, expo-font, expo-haptics, expo-image, expo-linear-gradient, expo-router (+drawer), expo-secure-store, expo-splash-screen, expo-status-bar, expo-system-ui, flash-list, google-signin, react-native, react-native-gesture-handler, react-native-reanimated, react-native-safe-area-context y react-native-svg. Setup central en `test/setup.ts`.

## Verificación manual

La app solo se ha verificado a mano en **Expo Web** (con capturas en `.impeccable/review/`, fuera de git). Los hápticos, la cámara, el teclado de Android, el login nativo con Google/Apple y el permiso de ubicación nativo no se han probado en un dispositivo real (ver `11-deuda-tecnica-pendiente.md`).

## Datos de demo (solo dev)

`mix run priv/repo/demo_seeds.exs` (con el PostGIS del compose: `DATABASE_URL=ecto://postgres:postgres@localhost:5510/snack_dev`; se niega a correr fuera de `MIX_ENV=dev` o contra una BD cuyo nombre no termine en `_dev`) crea un escenario realista para probar y capturar todas las pantallas: 53 perfiles sintéticos completos alrededor de Madrid (1–40 km, 20–45 años, hombres, mujeres y personas no binarias, intenciones y etiquetas variadas, 2–4 fotos) más dos cuentas principales:

| Cuenta | Para qué |
|---|---|
| `demo@snack.dev` (Lucía, 29, relación) | Feed con candidatos, 8 likes recibidos sin responder, 5 matches (2 sin mensajes, 3 conversaciones; dos con mensajes sin leer) y swipes hechos |
| `demo2@snack.dev` (Hugo, 33, «a ver qué pasa») | Perfil limpio sin interacciones: probar un match en directo entre dos sesiones (Lucía y Hugo se ven en el feed) |

Se entra con `POST /api/auth/dev/test-login` y `{"email": "demo@snack.dev"}`; cualquier persona sintética también (`<nombre>@demo.snack.dev`). El script se niega a ejecutarse fuera de `MIX_ENV=dev`, es idempotente (re-ejecutarlo restaura el escenario: fotos, etiquetas e interacciones de las cuentas demo) y crea los mensajes con `Snack.Dating.send_message/1`, así que quedan cifrados en reposo. Las fotos son URLs externas (retratos de i.pravatar.cc elegidos por género aparente y fotos de ambiente de picsum.photos); hace falta conexión para verlas.

## Huecos conocidos

- Sin tests de renderizado de las pantallas de producto (onboarding, Descubrir, Likes, Chats, Yo): se prueban su dominio y sus stores, no las pantallas.
- Sin pruebas E2E ni en dispositivo real.

Detalle en `11-deuda-tecnica-pendiente.md`.
