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
       └────────► R2/S3 o /api/uploads (disco local)
                                PostgreSQL + PostGIS
```

## Backend (apps/backend)

Phoenix single app (sin umbrella) con contextos por dominio:

| Contexto | Responsabilidad |
|---|---|
| `Snack.Accounts` | Usuarios canónicos |
| `Snack.Identity` | Validación de credenciales Google/Apple y linking de providers; verificación de edad (`AgeVerifications`) con autenticación pasiva de documentos eMRTD (`Identity.Document.*`, CSCA en `priv/csca`) |
| `Snack.Sessions` | Emisión, rotación, revocación de sesiones y refresh tokens |
| `Snack.Dating` | Dominio dating completo: perfiles, discovery, matching, chat, safety |
| `Snack.Features` | Feature flags leídas de config por entorno |
| `Snack.Notifications` / `Snack.Storage` | Envío de push vía Expo Push API y almacenamiento de fotos (adaptadores local y R2/S3) |
| `Snack.Crypto` | Cifrado en reposo de los mensajes (AES-256-GCM) |

Capa web: `SnackWeb` con controllers API en `/api`, plugs de autenticación (`Authenticate` valida JWT, expiración y familia de sesión), `TrackActivity` (última actividad del perfil), `Cors` (solo clientes web), `RequireFeature` para módulos opcionales (hoy sin uso en el router) y `UserSocket` para WebSocket.

Procesos en segundo plano: `Discovery.TagWeights` (pesos IDF cada 15 min), `MatchExpirySweeper` (caducidad de matches cada hora) y `PhotoStorageSweeper` (borrado de fotos y subidas abandonadas cada 10 min).

Puntos clave:

- **Sesiones propiedad de Phoenix:** access token JWT corto (`sub` + `session_id`) + refresh token opaco rotatorio; solo hashes salted en DB con linaje familiar; reuso ⇒ revoca la familia.
- **PostGIS** para ubicaciones (`geography(Point,4326)` con índice GiST) y distancias.
- **Fotos (`Snack.Storage`, D-2026-09-29):** con R2/S3 el backend firma URLs de subida (AWS SigV4 presigned PUT) y nunca proxea binarios; con almacenamiento local (`STORAGE_ADAPTER=local`, por defecto en dev y para self-hosting sin S3) recibe el PUT firmado en `/api/uploads/:token` y sirve `/uploads` con `Plug.Static`. El contrato del móvil es el mismo.
- **OpenAPI** servido en `/openapi.yaml`.
- **Chat en vivo:** Phoenix Channel `chat:{conversationId}` autenticado con el mismo access token que REST.

## Móvil (apps/mobile)

Expo SDK 54 (React Native 0.81, nueva arquitectura) + Expo Router, organizado feature-first. Estado con zustand; animaciones con reanimated 4 y gesture-handler; chat con el cliente `phoenix`.

```
app/                        # Rutas (grupos por estado de producto; mapa completo en 07-flujos-usuario.md)
│   (public)/login          # Bienvenida y login
│   (onboarding)/           # 11 pasos; index reanuda en el primer paso pendiente
│   (app)/(tabs)/           # Descubrir · Likes · Chats · Yo
│   (app)/…                 # profile/[id], chat/[id], filters, edit/*, settings, about
│   (dev)/                  # kitchen-sink, art y verify-document (solo __DEV__)
src/
├── features/<dominio>/     # presentation / application / domain / infrastructure
│   auth, app-bootstrap, app-overlays, onboarding, discovery, likes, match, matches,
│   chat, profile-card, photos, location, tags, safety, me, settings, activity, verification
└── shared/
    ├── api/                # Cliente HTTP JSON autenticado (refresh-on-401)
    ├── config/             # Runtime config + flags desde /api/config
    ├── ui/                 # tokens → themes → providers → primitives → composites (+ art, motion, app-shell)
    ├── storage/            # SecureStore
    ├── router/, device/, authz/
```

Flujo de arranque: resolver URL de API → `GET /api/config` (flags) → `GET /api/bootstrap` (usuario + estado de perfil) → routing por estado: signed-out → `(public)`; `onboardingRequired` → `(onboarding)`; perfil completo → `(app)`.

Reglas estructurales:

- Los módulos opcionales se registran vía registry (`src/features/optional-modules.ts`): con flag off desaparece la entrada de navegación y la pantalla se autogatea. Hoy el registro está vacío.
- `shared/ui` no contiene lógica de producto; `shared/ui/app-shell/routes.ts` define las pestañas y las rutas canónicas.
- Tokens de sesión solo en secure storage (Keychain/Keystore).
- Sistema de diseño «Libreta kawaii»: `08-identidad-visual.md`.
- Módulos nativos propios en `apps/mobile/modules/` (Expo Modules API, autolinking local): `document-nfc` lee DG1/DG2/SOD del chip de DNI y pasaportes (JMRTD en Android, NFCPassportReader incorporado en iOS); ver su `README.md`.

## Paquetes

| Paquete | Contenido |
|---|---|
| `packages/contracts` | DTOs compartidos backend ↔ móvil (auth, session, config, bootstrap, perfil, fotos, etiquetas, discovery y social: likes, perfil público, resumen, matches, chat, seguridad). Cualquier desacuerdo de payload se arregla aquí primero. |
| `packages/mobile-shared` | Clientes API reutilizables (auth, sesión, runtime-config, perfil y fotos, discovery, likes, perfil público, resumen, matches, chat REST, seguridad y ajustes), readers de flags, secure storage. |

## Entorno e infraestructura

- `infra/docker-compose.yml`: Postgres 17 + PostGIS expuesto en **localhost:5510** (estandarizado; ver D-2026-07-29 en `progress.md`). Perfiles `mobile` y `backend` con imágenes node/elixir para trabajo contenerizado.
- Tests del backend: por defecto `localhost:5432`; con el compose, `TEST_DATABASE_URL=ecto://postgres:postgres@localhost:5510/snack_test` (ver `09-estrategia-pruebas.md`).
- Puertos dev estandarizados (pg=5510, backend 4000); variables por `.env.example` en cada app.
- Producción e instancias propias: `12-self-hosting.md`.

## Decisiones de arquitectura relevantes

Ver `decisions.md`: monorepo y ownership de sesiones (D-2026-04-12), navegación canónica y token layering (D-2026-04-13), PostGIS + WebSocket chat (D-2026-04-28), contratos v1 (D-2026-05-06).
