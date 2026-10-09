# Monta tu instancia

Guía genérica para montar una instancia propia de Snack: backend Phoenix + PostgreSQL/PostGIS detrás de un proxy TLS, fotos en disco o en un bucket S3, y la app móvil compilada contra tu servidor. No depende de ningún proveedor concreto.

Como ejemplo real (servidor propio con Proxmox, Dokploy y Cloudflare) está el runbook del proyecto en [`infra/deploy/README.md`](../infra/deploy/README.md). Es específico de esa máquina: úsalo como referencia, no como receta.

> Snack se distribuye con licencia **AGPL-3.0** (`LICENSE`). Si modificas el código y ofreces la app a otras personas, tienes que ofrecerles también el código de tu versión. La pantalla «Acerca de» de la app enseña un enlace «Ver el código» si compilas con `EXPO_PUBLIC_SOURCE_URL` (ver §8).

## 1. Qué necesitas

| Pieza | Versión probada | Notas |
|---|---|---|
| PostgreSQL + PostGIS | PostgreSQL 17 + PostGIS 3.5 | Las migraciones crean las extensiones `postgis`, `uuid-ossp` y `pgcrypto` |
| Backend | Imagen Docker de `apps/backend/Dockerfile` o release de Elixir (Elixir 1.18, OTP 28) | Escucha HTTP en `PORT` (4000 por defecto) |
| Proxy TLS | Cualquiera (Caddy, nginx, Traefik…) | Termina HTTPS y reenvía a Phoenix, con WebSocket |
| Almacenamiento de fotos | Disco local (volumen persistente) o bucket S3 compatible | `STORAGE_ADAPTER=local` o `r2` |
| Cuentas de desarrollador | Google Cloud (Google Sign-In) y Apple Developer (Sign in with Apple, iOS) | Solo hay login con Google y Apple |
| Toolchain móvil | Node 24, pnpm 10, Expo SDK 54 | Android Studio / Xcode, o EAS Build |

No hay imagen publicada para terceros: constrúyela tú desde el repositorio.

## 2. Base de datos

1. Crea una base de datos y un usuario para Snack (p. ej. `snack_prod`).
2. PostGIS no es una extensión «de confianza» de PostgreSQL: si el usuario de la app no es superusuario, crea antes las extensiones con uno que lo sea:

   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```

3. `DATABASE_URL=ecto://USUARIO:CLAVE@HOST:5432/snack_prod`.
4. **`DATABASE_SSL`**: en producción vale `true` por defecto (el backend exige TLS hacia PostgreSQL). Si la base de datos está en la misma máquina o red privada sin TLS, pon `DATABASE_SSL=false`.
5. Opcionales: `POOL_SIZE` (10 por defecto) y `ECTO_IPV6=true` si llegas a PostgreSQL por IPv6.

## 3. Construir el backend

### Imagen Docker

```bash
docker build -t snack-backend:$(git rev-parse --short HEAD) \
  --build-arg APP_VERSION=$(git rev-parse --short HEAD) \
  apps/backend
```

La imagen:

- Corre como `nobody` (uid 65534) y expone el puerto 4000.
- Por defecto ejecuta `bin/migrate && exec bin/server`: aplica las migraciones (con el lock de migraciones de Ecto, así que varias réplicas pueden arrancar a la vez) y sincroniza el catálogo de 52 etiquetas antes de servir.
- Trae un `HEALTHCHECK` contra `http://localhost:${PORT:-4000}/healthz`.
- `APP_VERSION` es opcional; `/healthz` la devuelve (útil para comprobar qué versión corre).

### Release sin Docker

```bash
cd apps/backend
MIX_ENV=prod mix deps.get --only prod
MIX_ENV=prod mix release
```

Genera `_build/prod/rel/snack` y el tarball `_build/prod/snack-<versión>.tar.gz`. Se ejecuta con `bin/migrate` y después `bin/server` (el mismo orden que la imagen). Necesitas el mismo SO/arquitectura en la máquina de build y en la de destino.

### Tareas de base de datos

| Comando | Qué hace |
|---|---|
| `bin/migrate` | Aplica las migraciones pendientes y sincroniza el catálogo cerrado de etiquetas (idempotente). Nunca carga datos de demo |
| `bin/seed` | Solo sincroniza el catálogo de etiquetas (idempotente) |
| `bin/server` | Arranca el servidor (`PHX_SERVER=true`) |

Los datos de demo (`priv/repo/demo_seeds.exs`) solo existen en desarrollo y se niegan a ejecutarse fuera de `MIX_ENV=dev`.

## 4. Variables de entorno

La fuente de verdad es `apps/backend/config/runtime.exs`; la plantilla comentada, `apps/backend/.env.example`.

### Obligatorias en producción

El release **no arranca** si falta alguna o si un secreto es débil (más corto que el mínimo o un valor de relleno como `changeme`). El error lista todos los problemas de una vez.

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL (§2) |
| `SECRET_KEY_BASE` | Secreto de Phoenix, ≥ 64 caracteres |
| `AUTH_ACCESS_TOKEN_SALT` | Sal de los access tokens, ≥ 32 caracteres |
| `AUTH_REFRESH_TOKEN_SALT` | Sal de los refresh tokens, ≥ 32 caracteres |
| `MESSAGE_ENCRYPTION_KEY` | Clave de cifrado en reposo de los mensajes del chat, ≥ 32 caracteres. **Si la pierdes, los mensajes guardados no se pueden leer**: guárdala con tus backups, fuera de la base de datos |
| `PHX_HOST` | Nombre público de la API (p. ej. `api.tu-dominio.example`), sin esquema |
| `STORAGE_ADAPTER` | `local` o `r2` (`s3` es alias de `r2`) |
| `UPLOADS_DIR` | Solo con `local`: directorio de fotos en un volumen persistente |
| `PUBLIC_BASE_URL` | Solo con `local`: origen público de la API (`https://api.tu-dominio.example`). Las URLs de fotos y de subida se construyen con él, nunca con la cabecera `Host` |

Genera cada secreto con `mix phx.gen.secret` o `openssl rand -base64 48`. No reutilices el mismo valor en varias variables.

### Login (sin ellas nadie puede entrar)

| Variable | Qué es |
|---|---|
| `GOOGLE_WEB_CLIENT_ID` | Client ID de OAuth de tipo «Aplicación web» (§6). Es la audiencia de los tokens que emite Google Sign-In en Android |
| `GOOGLE_IOS_CLIENT_ID` | Client ID de OAuth de tipo iOS (§6) |
| `APPLE_AUDIENCES` | Bundle IDs aceptados para Sign in with Apple, separados por comas. Por defecto `EXPO_IOS_BUNDLE_IDENTIFIER` o `app.snack.mobile` |

Un proveedor sin audiencias rechaza todos sus logins; el backend lo avisa en el log al arrancar (error si no hay ninguno configurado).

### Opcionales

| Variable | Por defecto | Qué es |
|---|---|---|
| `PORT` | `4000` | Puerto HTTP de Phoenix |
| `CORS_ALLOWED_ORIGINS` | ninguno | Solo si sirves un cliente web: orígenes separados por comas (o `*`). La app nativa no lo necesita |
| `UPLOAD_MAX_BYTES` | `2000000` | Tamaño máximo por foto |
| `UPLOAD_URL_TTL_SECONDS` | `600` | Validez de una URL de subida |
| `GOOGLE_JWKS_CACHE_TTL_MS` / `APPLE_JWKS_CACHE_TTL_MS` | `600000` | Caché de las claves públicas de los proveedores |
| `POOL_SIZE` | `10` | Conexiones de la API y workers por nodo; dimensionar contra el presupuesto total de PostgreSQL |
| `DB_JIT` | `false` | JIT en las conexiones de Snack; desactivado para evitar compilación costosa en consultas cortas |
| `DB_QUEUE_TARGET_MS` / `DB_QUEUE_INTERVAL_MS` | `50` / `1000` | Objetivo de espera y ventana del pool antes de rechazar sobrecarga |
| `DB_QUERY_TIMEOUT_MS` | `15000` | Timeout por operación del repositorio |
| `METRICS_TOKEN` | vacío | Habilita `GET /metrics` con `Authorization: Bearer <token>` para Prometheus |
| `PUSH_CONCURRENCY` | `4` | Workers Oban de push por nodo (1–32), con jobs persistentes y reintentos |
| `EXPO_PUSH_ACCESS_TOKEN` | vacío | Token de la Expo Push API. El backend acepta dispositivos en `/api/me/push-token`; el móvil aún no registra tokens (ver `11-deuda-tecnica-pendiente.md`) |
| `EXPO_PUSH_BASE_URL` / `EXPO_PUSH_RECEIVE_TIMEOUT_MS` | `https://exp.host` / `5000` | Proveedor de push y timeout de respuesta (1–15000 ms); para carga, usar el simulador de `infra/load` |
| `APP_VERSION` | `dev` | Versión que devuelve `/healthz` (la imagen la hornea en el build) |
| `DOCUMENT_FINGERPRINT_KEY` | vacío | Clave HMAC (≥ 32 caracteres) de la huella del documento en la verificación de edad («una persona, una cuenta»). Sin ella, `POST /api/me/verification/nfc` responde 503. **No se puede cambiar después**: las huellas guardadas dejarían de casar. Guárdala con tus backups, fuera de la base de datos |
| `AGE_VERIFICATION_REQUIRED` | `false` | `true` exige verificarse para usar la parte social (necesita `DOCUMENT_FINGERPRINT_KEY`). Ver `docs/compliance/02-mayoria-de-edad.md` |
| `CSCA_PATHS` | `priv/csca` del release | Ficheros o carpetas (separados por comas) con los certificados CSCA de confianza para la autenticación pasiva. Por defecto, los CSCA españoles incluidos en el código (`apps/backend/priv/csca/README.md`) |

## 5. Fotos

El contrato con la app es el mismo con cualquier adaptador (detalle en `06-contratos-mobile-backend.md`, sección Fotos).

### `STORAGE_ADAPTER=local` (sin servicios extra)

- Las fotos se suben con un `PUT` firmado a `/api/uploads/<token>` y se sirven en `/uploads/photos/<clave>` desde `UPLOADS_DIR`. Solo se publican al completar la subida; las abandonadas y las borradas se eliminan del disco (barrido cada 10 min).
- `UPLOADS_DIR` tiene que estar en un **volumen persistente** (no en el sistema de ficheros del contenedor) e incluirse en los backups junto con PostgreSQL.
- El contenedor corre como `nobody`: el directorio debe ser escribible por el uid 65534. Con un bind mount:

  ```bash
  sudo mkdir -p /var/lib/snack/uploads
  sudo chown 65534:65534 /var/lib/snack/uploads
  # docker run … -v /var/lib/snack/uploads:/var/lib/snack/uploads -e UPLOADS_DIR=/var/lib/snack/uploads
  ```

- Espacio: como mucho 4 fotos de 2 MB por perfil.

### `STORAGE_ADAPTER=r2` (Cloudflare R2 o cualquier S3)

- Variables: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL_BASE` (URL pública del bucket) y `R2_ACCOUNT_ID` para R2, o `S3_ENDPOINT` (+ `S3_REGION`, `us-east-1` por defecto) para MinIO, Garage u otro S3 con direccionamiento path-style.
- Las credenciales necesitan leer, escribir **y borrar** objetos (al completar se copia `pending/<clave>` a `<clave>` y se borra el original).
- El CORS del bucket debe permitir `PUT` con las cabeceras `Content-Type` e `If-None-Match`.
- Si el bucket es público, añade una regla de ciclo de vida que borre el prefijo `pending/` a 1 día.

Cambiar de adaptador no migra fotos.

## 6. Login con Google y Apple

Snack solo admite Google y Apple. La app obtiene un token de identidad del proveedor y el backend lo valida contra las audiencias configuradas; después Phoenix emite su propia sesión.

### Google

En Google Cloud Console, dentro de un mismo proyecto:

1. Configura la pantalla de consentimiento de OAuth.
2. Crea tres clientes de OAuth:
   - **Aplicación web**: su client ID va en `GOOGLE_WEB_CLIENT_ID` (backend) y en `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (app). En Android el token que recibe el backend lleva esta audiencia.
   - **Android**: con el nombre de paquete (`EXPO_ANDROID_PACKAGE`) y la huella SHA-1 del certificado con el que firmas la app (la de depuración y la de publicación son distintas; si publicas en Google Play, la de la clave de firma de Play). No se copia a ninguna variable, pero sin él el login falla en Android.
   - **iOS**: con el bundle ID (`EXPO_IOS_BUNDLE_IDENTIFIER`). Su client ID va en `GOOGLE_IOS_CLIENT_ID` (backend) y `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (app), y su «iOS URL scheme» (el client ID invertido, `com.googleusercontent.apps.…`) en `GOOGLE_IOS_URL_SCHEME` (app).

### Apple

En Apple Developer:

1. Activa la capacidad **Sign in with Apple** en el App ID de tu bundle ID.
2. Pon ese bundle ID en `APPLE_AUDIENCES` (backend). Si no lo defines, el backend usa `EXPO_IOS_BUNDLE_IDENTIFIER` o `app.snack.mobile`.

Sign in with Apple se ofrece en iOS.

### Dónde se configura cada cosa

| Dato | Backend (`apps/backend`) | App (`apps/mobile/.env`) |
|---|---|---|
| Client ID web de Google | `GOOGLE_WEB_CLIENT_ID` | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` |
| Client ID iOS de Google | `GOOGLE_IOS_CLIENT_ID` | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` + `GOOGLE_IOS_URL_SCHEME` |
| Bundle ID de iOS | `APPLE_AUDIENCES` | `EXPO_IOS_BUNDLE_IDENTIFIER` |
| Paquete de Android | — (va en el cliente OAuth Android) | `EXPO_ANDROID_PACKAGE` |

## 7. Proxy TLS

En producción Phoenix fuerza HTTPS (redirige y envía HSTS) y confía en la cabecera `X-Forwarded-Proto` para saber que la petición llegó cifrada. El proxy tiene que:

- Terminar TLS para `PHX_HOST` y reenviar a `http://<backend>:4000`.
- Enviar `X-Forwarded-Proto: https` (Caddy y Traefik lo hacen por defecto; en nginx, `proxy_set_header X-Forwarded-Proto $scheme;`). Sin ella, Phoenix responde con redirecciones infinitas a HTTPS.
- Dejar pasar **WebSocket** en `/socket` (el chat en vivo usa `wss://PHX_HOST/socket/websocket`). En nginx: `proxy_http_version 1.1` y las cabeceras `Upgrade`/`Connection`.
- Admitir cuerpos de al menos 2 MB en `PUT /api/uploads/…` (nginx limita a 1 MB por defecto: `client_max_body_size 3m;`).
- No publicar el puerto 4000 del contenedor fuera de la red interna.

Ejemplo mínimo con Caddy:

```
api.tu-dominio.example {
    reverse_proxy snack-backend:4000
}
```

Comprobaciones: `GET /healthz` (vivo, sin BD, devuelve la versión) y `GET /readyz` (hace ping a la BD). `GET /openapi.yaml` sirve el contrato REST.

Las métricas incluyen latencia HTTP/chat, consultas y espera del pool, memoria/procesos BEAM y entrega/espera/fallos de push. Las latencias se exportan en **microsegundos**. `/metrics` devuelve 404 sin `METRICS_TOKEN` y 401 sin su Bearer. El procedimiento de carga sostenida está en [infra/load/README.md](../infra/load/README.md); usa una base independiente terminada en `_load`, sesiones sintéticas reales y un simulador de Expo.

## 8. Compilar la app contra tu instancia

La app lee la URL de la API **en tiempo de compilación** desde `apps/mobile/.env` (plantilla: `apps/mobile/.env.example`):

```bash
EXPO_PUBLIC_API_BASE_URL_ANDROID=https://api.tu-dominio.example
EXPO_PUBLIC_API_BASE_URL_IOS=https://api.tu-dominio.example
EXPO_PUBLIC_API_BASE_URL_WEB=https://api.tu-dominio.example

EXPO_APP_NAME=Snack
EXPO_ANDROID_PACKAGE=tu.dominio.snack
EXPO_IOS_BUNDLE_IDENTIFIER=tu.dominio.snack

EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=…
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=…
GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.…

# Enlace «Ver el código» de Acerca de (tu fork; ver la nota de AGPL arriba)
EXPO_PUBLIC_SOURCE_URL=https://…
```

- Si vas a publicar en las tiendas, usa tu propio paquete y bundle ID: los de ejemplo (`app.snack.mobile`) no son tuyos.
- La URL de la API no se puede cambiar después sin recompilar.
- El login con Google y Apple necesita un build nativo (no funciona en Expo Go).

### Build local

```bash
pnpm install
cd apps/mobile
npx expo prebuild --clean     # regenera android/ e ios/ desde app.config.ts
npx expo run:android --variant release
npx expo run:ios --configuration Release   # en macOS con Xcode
```

Usa siempre `--clean` al cambiar identificadores, permisos o plugins: el directorio `android/` que hay en el repositorio es un prebuild antiguo (ver `11-deuda-tecnica-pendiente.md`).

### EAS Build

El repositorio no trae `eas.json`. Con una cuenta de Expo: `npx eas-cli build:configure` lo genera, define las mismas variables de arriba en los perfiles de build (o como variables de entorno de EAS) y lanza `npx eas-cli build --platform android|ios`. EAS gestiona las credenciales de firma; recuerda registrar la SHA-1 de esa firma en el cliente OAuth Android de Google.

## 9. Operación

- **Backups**: PostgreSQL y, con `local`, `UPLOADS_DIR`. Guarda `MESSAGE_ENCRYPTION_KEY`, `DOCUMENT_FINGERPRINT_KEY` y el resto de secretos aparte.
- **Certificados CSCA**: revisa cada pocos meses si hay CSCA nuevos (España publicará previsiblemente un CSCA 5 hacia 2027). Procedimiento en `apps/backend/priv/csca/README.md`.
- **Actualizar**: construye la imagen nueva y reemplaza el contenedor; las migraciones se aplican al arrancar. Las migraciones del proyecto siguen expand/contract y no deben revertirse en producción (despliega la versión anterior en su lugar). Algunas crean índices sin `CONCURRENTLY` sobre `swipe_actions`, que bloquean escrituras en esa tabla mientras se construyen (ver `11-deuda-tecnica-pendiente.md`).
- **Una sola réplica** mientras no se configure un clúster de Erlang: el PubSub del chat no cruza nodos.
- **Moderación**: los reportes se guardan en la tabla `reports`, pero todavía no hay panel de administración (ver `11-deuda-tecnica-pendiente.md`).
