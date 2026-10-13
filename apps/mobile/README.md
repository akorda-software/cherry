# App móvil de Cherry

App Expo (SDK 54, React Native 0.81, nueva arquitectura) con Expo Router. Es la app de citas de Cherry: onboarding en 11 pasos, Descubrir en modo swipe o feed, Likes, Chats en tiempo real, Yo y Ajustes, con el sistema de diseño «Libreta kawaii». Flujos y pantallas: [`docs/07-flujos-usuario.md`](../../docs/07-flujos-usuario.md).

## Configuración (`.env`)

Copia la plantilla y ajústala:

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

La configuración se lee **al compilar** o al arrancar el servidor de Expo (`app.config.ts`); después de cambiarla, reinicia `expo start` (mejor con `--clear`) o recompila.

### Apuntar a una instancia

| Variable | Uso | Por defecto |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL_ANDROID` | API en Android | `http://10.0.2.2:4000` (el host visto desde el emulador) |
| `EXPO_PUBLIC_API_BASE_URL_IOS` | API en iOS | `http://localhost:4000` (simulador) |
| `EXPO_PUBLIC_API_BASE_URL_WEB` | API en web | mismo origen que la página |

- Backend en tu máquina: los valores de la plantilla. En un **dispositivo físico** usa la IP de tu ordenador en la LAN (`http://192.168.x.y:4000`): en dev el backend escucha en todas las interfaces y las URLs de las fotos siguen al host con el que llamas.
- Instancia propia en producción: `https://api.tu-dominio.example` en las tres (ver [`docs/12-self-hosting.md`](../../docs/12-self-hosting.md) §8). El chat usa el mismo origen por WebSocket (`/socket/websocket`).

### Login con Google y Apple

Solo hay login con Google y Apple, y ambos necesitan un **build nativo** (no funcionan en Expo Go).

| Variable | Qué poner |
|---|---|
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Client ID OAuth de tipo «Aplicación web» (el mismo que `GOOGLE_WEB_CLIENT_ID` en el backend) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Client ID OAuth de tipo iOS (el mismo que `GOOGLE_IOS_CLIENT_ID` en el backend) |
| `GOOGLE_IOS_URL_SCHEME` | «iOS URL scheme» de ese cliente (`com.googleusercontent.apps.…`); activa el plugin de Google Sign-In en iOS |
| `EXPO_ANDROID_PACKAGE` / `EXPO_IOS_BUNDLE_IDENTIFIER` | Identificadores de tu app. Deben coincidir con el cliente OAuth Android de Google (paquete + SHA-1 de la firma) y con `APPLE_AUDIENCES` del backend |

Cómo crear los clientes en Google Cloud y activar Sign in with Apple: [`docs/12-self-hosting.md`](../../docs/12-self-hosting.md) §6.

### Otras

- `EXPO_APP_NAME`, `EXPO_APP_SLUG`, `EXPO_APP_SCHEME`: identidad de la app.
- `EXPO_PUBLIC_SOURCE_URL`: enlace «Ver el código» de Acerca de. Sin definir, no se muestra. Si publicas una versión modificada, la AGPL-3.0 te obliga a ofrecer su código: apunta aquí a tu repositorio.
- `EXPO_PUBLIC_MOCK_AUTH=true`: sesión falsa con perfil completo y sin backend de login, para trabajar solo la interfaz.

## Ejecutar

Desde la raíz, con el backend corriendo (ver el [README raíz](../../README.md)):

```bash
pnpm install
pnpm --dir apps/mobile start        # servidor de Expo
```

- **Web** (pulsa `w`, o `pnpm --dir apps/mobile exec expo start --web`): la forma más rápida de desarrollar. En dev el backend acepta CORS de cualquier origen. Los hápticos no existen en web.
- **Android**: `pnpm --dir apps/mobile android` (`expo run:android`) con un emulador o un dispositivo. El directorio `android/` versionado es un prebuild antiguo: regenéralo antes con `pnpm --dir apps/mobile exec expo prebuild --clean` (ver [`docs/11`](../../docs/11-deuda-tecnica-pendiente.md)).
- **iOS** (macOS con Xcode): `pnpm --dir apps/mobile ios` (`expo run:ios`).
- Build de desarrollo ya instalado: `pnpm --dir apps/mobile start:dev-client`.

### Cuentas demo en desarrollo

Con `__DEV__`, la bienvenida muestra la caja «Solo en desarrollo», que usa `POST /api/auth/dev/test-login` del backend (solo activo en dev):

- **«Entrar como usuario nuevo»**: cuenta desechable que empieza el onboarding desde cero.
- **«Entrar como Lucía (demo)»**: `demo@cherry.dev`, con feed, likes recibidos, matches y conversaciones. Requiere haber cargado los datos de demo en el backend (`mix run priv/repo/demo_seeds.exs`).

El resto de cuentas demo (`demo2@cherry.dev`, Hugo, y las personas sintéticas `<nombre>@demo.cherry.dev`) no tienen botón: se entra con ese endpoint desde fuera de la app. Detalle en [`docs/09-estrategia-pruebas.md`](../../docs/09-estrategia-pruebas.md).

## Estructura

```
app/                          # Rutas de Expo Router (mapa completo en docs/07)
│   (public)/ (onboarding)/ (app)/(tabs)/ (app)/… (dev)/
src/
├── features/<dominio>/       # presentation / application / domain / infrastructure
│   auth            login nativo, sesión segura, refresh y login de desarrollo
│   app-bootstrap   GET /api/bootstrap y routing por estado del perfil
│   onboarding      los 11 pasos y la reanudación
│   discovery       cola compartida, modos swipe y feed, filtros, perfil completo
│   likes, match    likes recibidos y celebración de match
│   matches, chat   lista de chats y conversación (REST + canal Phoenix)
│   profile-card    resumen de perfil reutilizado en tarjetas
│   photos, location, tags   subida de fotos, ubicación y selección de etiquetas
│   safety          hoja de bloquear y reportar
│   me, settings    pestaña Yo, edición, Ajustes y Acerca de
│   activity, app-overlays   contadores de pestañas y capas globales
└── shared/
    ├── api/ config/ storage/ device/ router/ authz/
    └── ui/                   # sistema de diseño (sin lógica de producto)
```

Las reglas de producto viven en el backend; la app guarda solo estado de interfaz. Los clientes API y DTOs compartidos están en `packages/mobile-shared` y `packages/contracts`.

## Sistema de diseño

«Libreta kawaii»: neobrutalismo kawaii pastel con tinta sobre papel, Mochiy Pop One + M PLUS Rounded 1c + Yomogi y la mascota Mochi. Tokens, componentes, movimiento y reglas en [`docs/08-identidad-visual.md`](../../docs/08-identidad-visual.md); API de componentes en `src/shared/ui/DS_READY.md` y arte en `src/shared/ui/art/README.md`. En dev, `/kitchen-sink` y `/art` muestran los componentes y la ilustración.

## Tests

```bash
pnpm --dir apps/mobile test        # vitest + jsdom
pnpm --dir apps/mobile typecheck
pnpm test:mobile                   # desde la raíz: typecheck + mobile-shared + mobile + contracts
```
