# Snack

**Snack es una app de citas open source, 100 % gratuita y self-hosteable.** Existe para demostrar que una app de citas puede servir a las personas en lugar de explotarlas: sin muros de pago, sin escasez simulada, sin anuncios y sin trucos para retenerte. Lo que otras apps cobran (ver quién te ha dado like, filtros, deshacer) aquí es gratis y para siempre.

- **Las etiquetas mandan.** Cada persona elige etiquetas que la definen y etiquetas que no van con ella. Nunca verás a nadie con una etiqueta que bloqueas (ni te verá a ti), y la compatibilidad pesa más que la proximidad.
- **Anti-predatoria.** La app busca que estés a gusto y consigas lo que buscas, no que pases más tiempo en ella. Tono cálido, sin presión ni culpa.
- **Tuya.** Código auditable bajo AGPL-3.0; cualquiera puede [montar su propia instancia](./docs/12-self-hosting.md).

## Qué incluye hoy

- **Login** solo con Google y Apple; sesiones propias de Phoenix con refresh rotatorio.
- **Onboarding en 11 pasos**: nombre, cumpleaños (18+), género, a quién quieres conocer, qué buscas, 2–4 fotos, etiquetas (catálogo cerrado de 52 con emoji), etiquetas bloqueadas, bio, ubicación aproximada y listo.
- **Descubrir** en modo **swipe** o **feed** vertical, con un ranking que prioriza etiquetas en común (ponderadas por rareza), intención compatible, reciprocidad y actividad real. Filtros duros en ambas direcciones: etiquetas bloqueadas, género, edad e intención. Filtros de edad, distancia y «solo con etiquetas en común», y ampliación de distancia si se acaba la gente.
- **Deshacer** tu último «no» (10 minutos), gratis.
- **Likes** gratis y visibles: ves quién te ha dado like; si le das like, es match al instante.
- **Chats** en tiempo real (REST + WebSocket) tras un match, con estado de lectura. Un match sin mensajes caduca a los 30 días.
- **Seguridad**: bloquear, reportar, deshacer match, pausar el perfil y borrar la cuenta.
- **Privacidad**: la ubicación se redondea a una rejilla de 500 m y nunca se expone; los mensajes se cifran en reposo; la puntuación del ranking no sale del servidor.
- **Fotos** en el disco del propio servidor o en cualquier almacenamiento S3 compatible.
- Sistema de diseño **«Libreta kawaii»**: neobrutalismo kawaii pastel, con Mochi como mascota.

Lo pendiente (notificaciones push, pruebas en dispositivo real, panel de moderación, modo oscuro…) está en [`docs/10-plan-fases.md`](./docs/10-plan-fases.md) y [`docs/11-deuda-tecnica-pendiente.md`](./docs/11-deuda-tecnica-pendiente.md).

## Estructura del monorepo

```
snack/
├── apps/
│   ├── mobile/            # App Expo (SDK 54, Expo Router)
│   └── backend/           # Phoenix + PostgreSQL/PostGIS: API REST, chat WebSocket, fotos
├── packages/
│   ├── contracts/         # DTOs compartidos backend ↔ móvil
│   └── mobile-shared/     # Clientes API, storage seguro y helpers móviles
├── docs/                  # Documentación canónica (empieza por docs/README.md)
└── scripts/               # Entradas de test (test-mobile.sh / test-backend.sh)
```

## Arranque rápido (desarrollo)

Requisitos: Node 24 y pnpm 10, Elixir 1.18 con OTP 28, Docker (versiones exactas en `.tool-versions`).

```bash
pnpm install

# 1. PostgreSQL 17 + PostGIS en localhost:5510
docker compose -f infra/docker-compose.yml up postgres -d

# 2. Backend: variables, BD (migraciones + catálogo de etiquetas) y datos de demo
cd apps/backend
cp .env.example .env
mix setup
mix run priv/repo/demo_seeds.exs     # opcional: ~55 perfiles de demo alrededor de Madrid
mix phx.server                       # http://localhost:4000
cd ../..

# 3. App
cp apps/mobile/.env.example apps/mobile/.env
pnpm --dir apps/mobile start         # pulsa «w» para abrirla en el navegador
```

En desarrollo, la bienvenida muestra la caja «Solo en desarrollo»:

- **«Entrar como Lucía (demo)»** (`demo@snack.dev`): feed con gente, likes recibidos sin responder, matches y conversaciones (requiere `demo_seeds.exs`).
- **«Entrar como usuario nuevo»**: cuenta limpia para recorrer el onboarding.

Otras cuentas demo (`demo2@snack.dev`, Hugo, o cualquier `<nombre>@demo.snack.dev`) se usan con `POST /api/auth/dev/test-login` y `{"email": "…"}`. Detalle en [`docs/09-estrategia-pruebas.md`](./docs/09-estrategia-pruebas.md).

El login con Google y Apple necesita un build nativo y client IDs propios: ver [`apps/mobile/README.md`](./apps/mobile/README.md) (Android, iOS, dispositivo físico) y [`docs/12-self-hosting.md`](./docs/12-self-hosting.md) §6.

## Tests

```bash
pnpm test:mobile       # typecheck + mobile-shared + mobile + contracts
pnpm test:contracts    # solo contracts

# Backend contra el PostGIS del compose (sin variables usa localhost:5432)
cd apps/backend && TEST_DATABASE_URL=ecto://postgres:postgres@localhost:5510/snack_test mix test
```

Última ejecución (2026-09-29), todo en verde: **384** tests de backend, **678** de móvil, **43** de mobile-shared y **23** de contracts, con el typecheck limpio. Estrategia y huecos en [`docs/09-estrategia-pruebas.md`](./docs/09-estrategia-pruebas.md).

## Monta tu instancia

[`docs/12-self-hosting.md`](./docs/12-self-hosting.md): imagen Docker o release, variables obligatorias, base de datos, fotos, proxy TLS, clientes OAuth de Google y Apple y cómo compilar la app contra tu servidor.

## Documentación

Todo vive en [`docs/`](./docs); empieza por [`docs/README.md`](./docs/README.md). El brief de producto y los compromisos de marca están en [`PRODUCT.md`](./PRODUCT.md); las decisiones, en [`docs/decisions.md`](./docs/decisions.md); el avance, en [`docs/progress.md`](./docs/progress.md).

## Licencia

[GNU Affero General Public License v3.0](./LICENSE) (AGPL-3.0). Puedes usar, estudiar, modificar y redistribuir Snack, también para montar tu propia instancia. Si ofreces una versión modificada a otras personas, también a través de la red, tienes que ofrecerles su código fuente. Motivo: nadie puede cerrar una instancia modificada y cobrar por lo que aquí es gratis (D-2026-09-29 en `docs/decisions.md`).
