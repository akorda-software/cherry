# Arquitectura

## Visión general

Monorepo pnpm workspaces + Turbo con una app Phoenix y una app Expo. Los contratos cross-runtime viven solo en `packages/contracts`.

```
┌──────────────┐  REST /api/*   ┌──────────────────┐
│  apps/mobile │◄──────────────►│   apps/backend    │
│  (Expo)      │  WS /socket    │   (Phoenix)       │
└──────┬───────┘                └────────┬─────────┘
       │                                 │
       │  PUT binarios (firmado)         ▼
       └──────────────────────► Cloudflare R2
                                PostgreSQL + PostGIS
```

## Backend (apps/backend)

Phoenix single app (sin umbrella) con contextos por dominio:

| Contexto | Responsabilidad |
|---|---|
| `Snack.Accounts` | Usuarios canónicos |
| `Snack.Identity` | Validación de credenciales Google/Apple y linking de providers |
| `Snack.Sessions` | Emisión, rotación, revocación de sesiones y refresh tokens |
| `Snack.Dating` | Dominio dating completo: perfiles, discovery, matching, chat, safety |
| `Snack.Billing` | Add-on opcional Stripe (aislado, flaggeado) |
| `Snack.Features` | Feature flags leídas de config por entorno |
| `Snack.Notifications` / `Snack.Storage` | Envío de push vía Expo Push API y cliente R2 con URLs firmadas |

Capa web: `SnackWeb` con controllers API versionados en `/api`, plugs de autenticación (`Authenticate` valida JWT y expiración), plug `RequireFeature` para módulos opcionales y `UserSocket` para WebSocket.

Puntos clave:

- **Sesiones propiedad de Phoenix:** access token JWT corto (`sub` + `session_id`) + refresh token opaco rotatorio; solo hashes salted en DB con linaje familiar; reuso ⇒ revoca la familia.
- **PostGIS** para ubicaciones (`geography(Point,4326)` con índice GiST) y distancias.
- **R2 directo:** el backend firma URLs de subida (AWS SigV4 presigned PUT) vía `Snack.Storage.R2`; nunca proxéa binarios.
- **OpenAPI** servido en `/openapi.yaml`.
- **Chat en vivo:** Phoenix Channel `chat:{conversationId}` autenticado con el mismo access token que REST.

## Móvil (apps/mobile)

Expo + Expo Router, organizado feature-first:

```
app/                      # Rutas (route groups por estado de producto)
│   (public)/login        # Auth
│   (onboarding)/         # index resuelve nextOnboardingStep → pasos
│   (app)/(tabs)/         # Shell principal: home (discover), profile
│   (app)/settings | subscriptions
src/
├── features/<dominio>/   # presentation / application / domain / infrastructure
│   auth, app-bootstrap, onboarding, discovery, tags, subscriptions…
└── shared/
    ├── api/              # Cliente HTTP autenticado (refresh-on-401)
    ├── config/           # Runtime config + flags desde bootstrap
    ├── ui/               # tokens → themes → providers → primitives → composites
    ├── storage/          # SecureStore
    └── device/, authz/
```

Flujo de arranque: resolver URL de API → `GET /api/config` (flags) → `GET /api/bootstrap` (usuario + estado de perfil) → routing por estado: signed-out → `(public)`; `onboardingRequired` → `(onboarding)`; perfil completo → `(app)`.

Reglas estructurales:

- Los módulos opcionales (subscriptions) se registran vía registry (`optional-modules.ts`): con flag off desaparece la entrada de navegación y la pantalla se autogatea (la ruta Stack sigue registrada pero inaccesible en la práctica).
- `shared/ui` no contiene lógica de producto; el scaffolding del shell (`shared/ui/app-shell/routes.ts`) define labels de tabs y consume el registry de módulos opcionales.
- Tokens de sesión solo en secure storage (Keychain/Keystore).

## Paquetes

| Paquete | Contenido |
|---|---|
| `packages/contracts` | DTOs compartidos backend ↔ móvil (auth, session, bootstrap, profile, discovery, billing). Cualquier desacuerdo de payload se arregla aquí primero. |
| `packages/mobile-shared` | Clientes API reutilizables (auth, profile, discovery, billing, runtime-config), readers de flags, secure storage. |

## Entorno e infraestructura

- `infra/docker-compose.yml`: Postgres 17 + PostGIS expuesto en **localhost:5510** (estandarizado; ver D-2026-07-29 en `progress.md`). Perfiles `mobile` y `backend` con imágenes node/elixir para trabajo contenerizado.
- Tests del backend esperan Postgres+PostGIS en `localhost:5432` (ver `09-estrategia-pruebas.md`).
- Puertos dev estandarizados (pg=5510); variables por `.env.example` en cada app.

## Decisiones de arquitectura relevantes

Ver `decisions.md`: monorepo y ownership de sesiones (D-2026-04-12), navegación canónica y token layering (D-2026-04-13), Stripe como add-on flaggeado (D-2026-04-13), PostGIS + WebSocket chat (D-2026-04-28), contratos v1 (D-2026-05-06).
