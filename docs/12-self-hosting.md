# Monta tu instancia

Guía genérica para montar una instancia propia de Cherry: backend Phoenix + PostgreSQL/PostGIS detrás de un proxy TLS, fotos en disco o en un bucket S3, y la app móvil compilada contra tu servidor. No depende de ningún proveedor concreto.

> Cherry se distribuye con licencia **AGPL-3.0** (`LICENSE`). Si modificas el código y ofreces la app a otras personas, tienes que ofrecerles también el código de tu versión. La pantalla «Acerca de» de la app enseña un enlace «Ver el código» si compilas con `EXPO_PUBLIC_SOURCE_URL` (ver §8).

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

1. Crea una base de datos y un usuario para Cherry (p. ej. `cherry_prod`).
2. PostGIS no es una extensión «de confianza» de PostgreSQL: si el usuario de la app no es superusuario, crea antes las extensiones con uno que lo sea:

   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```

3. `DATABASE_URL=ecto://USUARIO:CLAVE@HOST:5432/cherry_prod`.
4. **`DATABASE_SSL`**: en producción vale `true` por defecto (el backend exige TLS hacia PostgreSQL). Si la base de datos está en la misma máquina o red privada sin TLS, pon `DATABASE_SSL=false`.
5. Opcionales: `POOL_SIZE` (10 por defecto) y `ECTO_IPV6=true` si llegas a PostgreSQL por IPv6.

## 3. Construir el backend

### Imagen Docker

```bash
docker build -t cherry-backend:$(git rev-parse --short HEAD) \
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

Genera `_build/prod/rel/cherry` y el tarball `_build/prod/cherry-<versión>.tar.gz`. Se ejecuta con `bin/migrate` y después `bin/server` (el mismo orden que la imagen). Necesitas el mismo SO/arquitectura en la máquina de build y en la de destino.

### Tareas de base de datos

| Comando | Qué hace |
|---|---|
| `bin/migrate` | Aplica las migraciones pendientes y sincroniza el catálogo cerrado de etiquetas (idempotente). Nunca carga datos de demo |
| `bin/seed` | Solo sincroniza el catálogo de etiquetas (idempotente) |
| `bin/server` | Arranca el servidor (`PHX_SERVER=true`) |

Los datos de demo (`priv/repo/demo_seeds.exs`) solo existen en desarrollo y se niegan a ejecutarse fuera de `MIX_ENV=dev`.

## 4. Variables de entorno del backend

La fuente de verdad es `apps/backend/config/runtime.exs`; la plantilla comentada, `apps/backend/.env.example` (en desarrollo, el backend carga `apps/backend/.env`). Las variables de compilación de la app están en §8.

Todo lo que depende de la infraestructura o del país se configura aquí; los valores por defecto reproducen la instancia española. Un valor vacío cuenta como no definido. Un valor mal formado (un país que no es ISO, una URL que no es `http(s)`, una edad fuera de rango…) **impide arrancar** con un mensaje que nombra la variable.

### Obligatorias en producción

El release **no arranca** si falta alguna o si un secreto es débil (más corto que el mínimo o un valor de relleno como `changeme`). El error lista todos los problemas de una vez.

| Variable | Por defecto | Qué es |
|---|---|---|
| `DATABASE_URL` | — | Conexión a PostgreSQL (§2) |
| `SECRET_KEY_BASE` | — | Secreto de Phoenix, ≥ 64 caracteres |
| `AUTH_ACCESS_TOKEN_SALT` | — | Sal de los access tokens, ≥ 32 caracteres |
| `AUTH_REFRESH_TOKEN_SALT` | — | Sal de los refresh tokens, ≥ 32 caracteres |
| `MESSAGE_ENCRYPTION_KEY` | — | Clave de cifrado en reposo de los mensajes del chat, ≥ 32 caracteres. **Si la pierdes, los mensajes guardados no se pueden leer**: guárdala con tus backups, fuera de la base de datos |
| `PHX_HOST` | — | Nombre público de la API (p. ej. `api.tu-dominio.example`), sin esquema |
| `STORAGE_ADAPTER` | — (`local` en dev) | `local` o `r2` (`s3` es alias de `r2`) |
| `UPLOADS_DIR` | `priv/uploads` en dev | Solo con `local`: directorio de fotos en un volumen persistente |
| `PUBLIC_BASE_URL` | host de cada petición (solo dev) | Solo con `local`: origen público de la API (`https://api.tu-dominio.example`). Las URLs de fotos y de subida se construyen con él, nunca con la cabecera `Host` |

Genera cada secreto con `mix phx.gen.secret` o `openssl rand -base64 48`. No reutilices el mismo valor en varias variables.

Para entrar hace falta además al menos un proveedor de login (§6):

| Variable | Por defecto | Qué es |
|---|---|---|
| `GOOGLE_WEB_CLIENT_ID` | vacío | Client ID de OAuth de tipo «Aplicación web». Es la audiencia de los tokens que emite Google Sign-In en Android |
| `GOOGLE_IOS_CLIENT_ID` | vacío | Client ID de OAuth de tipo iOS |
| `APPLE_AUDIENCES` | `EXPO_IOS_BUNDLE_IDENTIFIER` o `app.cherry.mobile` | Bundle IDs aceptados para Sign in with Apple, separados por comas |

Un proveedor sin audiencias rechaza todos sus logins; el backend lo avisa en el log al arrancar (error si no hay ninguno configurado).

### Instancia y país

Quién gestiona la instancia y para qué país es. La app lo lee al arrancar de `GET /api/config` (público), así que **la misma compilación de la app sirve para cualquier instancia**: no hay que recompilar para cambiarlos. Se enseñan en «Acerca de». La política de nombre (`TRADEMARKS.md`, condición 5) pide decir en la app quién gestiona la instancia y cómo contactar: define al menos `INSTANCE_OPERATOR` e `INSTANCE_CONTACT_EMAIL`.

| Variable | Por defecto | Qué es |
|---|---|---|
| `INSTANCE_NAME` | `Cherry` | Nombre visible de la instancia (p. ej. `Cherry España`, `Cherry France`). Es el título de «Acerca de». El nombre de la app en el teléfono es `EXPO_APP_NAME` (§8) |
| `INSTANCE_COUNTRY` | `ES` | País al que sirve, código ISO 3166-1 alfa-2. Hoy es informativo (lo devuelve `/api/config`); no filtra usuarios ni documentos |
| `INSTANCE_LOCALE` | `es-ES` | Idioma por defecto (etiqueta BCP 47: `fr-FR`, `pt-PT`, `eu`). Se usa para el idioma del flujo de Didit. La app solo está en español (ver «Montar Cherry en otro país») |
| `INSTANCE_OPERATOR` | vacío | Persona o entidad que gestiona la instancia (responsable del tratamiento). Sin ella, «Acerca de» no dice quién la gestiona |
| `INSTANCE_CONTACT_EMAIL` | vacío | Correo de contacto y soporte. «Acerca de» ofrece escribir a él |
| `INSTANCE_PRIVACY_URL` | vacío | URL `http(s)` de la política de privacidad |
| `INSTANCE_TERMS_URL` | vacío | URL `http(s)` de las condiciones de uso |
| `INSTANCE_SOURCE_URL` | vacío | Código fuente de la versión del servidor que corre (AGPL-3.0). El enlace «Ver el código» de la app usa `EXPO_PUBLIC_SOURCE_URL` si se compiló con ella y, si no, esta |

Gestor, contacto y URLs legales no tienen valor por defecto a propósito: una instancia nueva no debe heredar los datos de otra.

`GET /api/config` devuelve:

```json
{
  "features": { "age_verification_required": { "enabled": false } },
  "instance": {
    "name": "Cherry", "country": "ES", "locale": "es-ES",
    "operator": null, "contactEmail": null, "privacyUrl": null, "termsUrl": null, "sourceUrl": null
  },
  "ageVerification": { "minimumAge": 18 }
}
```

### Verificación de edad

Detalle del funcionamiento en `docs/compliance/02-mayoria-de-edad.md`.

| Variable | Por defecto | Qué es |
|---|---|---|
| `DOCUMENT_FINGERPRINT_KEY` | vacío (relleno en dev) | Clave HMAC (≥ 32 caracteres) de la huella del documento («una persona, una cuenta»). Sin ella, `POST /api/me/verification/nfc` y `…/provider` responden 503. **No se puede cambiar después**: las huellas guardadas dejarían de casar. Guárdala con tus backups, fuera de la base de datos |
| `AGE_VERIFICATION_REQUIRED` | `false` | `true` exige verificarse para usar la parte social (necesita `DOCUMENT_FINGERPRINT_KEY`) |
| `AGE_VERIFICATION_MINIMUM_AGE` | `18` | Edad mínima (18–99). Se aplica al documento (NFC y Didit) y a la fecha de nacimiento del perfil (`POST /api/me/profile/complete`). La app la lee de `/api/config` en el paso de la fecha de nacimiento |
| `AGE_VERIFICATION_DOCUMENTS` | `id_card,passport` | Documentos aceptados, separados por comas: `id_card` (tarjetas de identidad y permisos de residencia: DNI, TIE…) y `passport`. Un documento auténtico de un menor se trata como tal aunque su tipo no se acepte |
| `CSCA_PATHS` | — | Ficheros o carpetas (separados por comas) con certificados CSCA de confianza para la autenticación pasiva por NFC. Sustituyen a la carpeta incluida en el código |
| `CSCA_COUNTRIES` | — (toda `priv/csca`) | Carpetas de país de `apps/backend/priv/csca` en las que confiar (`es` = España). Se suman a `CSCA_PATHS`. Sin `CSCA_PATHS` ni `CSCA_COUNTRIES` se confía en toda `priv/csca`, que hoy solo trae los CSCA españoles (`priv/csca/README.md`) |
| `DIDIT_API_KEY` / `DIDIT_WORKFLOW_ID` | vacío | Verificación con selfie + documento (Didit). Sin ellas (o sin `DOCUMENT_FINGERPRINT_KEY`), `POST /api/me/verification/provider` responde 503 y la app no ofrece el método. En producción solo se aceptan decisiones del entorno *live* de Didit. Los países y documentos que admite Didit se eligen además en su consola, en el workflow |
| `DIDIT_WEBHOOK_SECRET` | vacío | Aún no se usa |

Sin CSCA del país del documento, la autenticación pasiva NFC lo rechaza (`untrusted_certificate`): la lista de CSCA es, en la práctica, la lista de países cuyos documentos se aceptan por NFC.

### Infraestructura

| Variable | Por defecto | Qué es |
|---|---|---|
| `PORT` | `4000` | Puerto HTTP de Phoenix (1–65535; el healthcheck de la imagen lo usa) |
| `FORCE_SSL` | `true` | Redirige a HTTPS y manda HSTS (con `X-Forwarded-Proto` del proxy). `false` solo para probar la API por HTTP en una red privada |
| `PHX_URL_SCHEME` | `https` | Esquema de la URL pública de la API (`http` o `https`) |
| `PHX_URL_PORT` | `443` con https, `80` con http | Puerto de la URL pública de la API |
| `PHX_SERVER` | — | `true` arranca el servidor HTTP en un release (`bin/server` ya la pone) |
| `DATABASE_SSL` | `true` en prod | TLS hacia PostgreSQL; `false` en red privada sin TLS (§2) |
| `ECTO_IPV6` | `false` | `true` si llegas a PostgreSQL por IPv6 |
| `POOL_SIZE` | `10` | Conexiones de la API y workers por nodo; dimensionar contra el presupuesto total de PostgreSQL |
| `DB_JIT` | `false` | JIT en las conexiones de Cherry; desactivado para evitar compilación costosa en consultas cortas |
| `DB_QUEUE_TARGET_MS` / `DB_QUEUE_INTERVAL_MS` | `50` / `1000` | Objetivo de espera y ventana del pool antes de rechazar sobrecarga |
| `DB_QUERY_TIMEOUT_MS` | `15000` | Timeout por operación del repositorio |
| `DNS_CLUSTER_QUERY` | vacío | Consulta DNS para formar un clúster de Erlang (aún no soportado: una réplica, §9) |
| `CORS_ALLOWED_ORIGINS` | ninguno (cualquiera en dev) | Solo si sirves un cliente web: orígenes separados por comas (o `*`). La app nativa no lo necesita |
| `UPLOAD_MAX_BYTES` | `2000000` | Tamaño máximo por foto |
| `UPLOAD_URL_TTL_SECONDS` | `600` | Validez de una URL de subida |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL_BASE` | vacío | Bucket de fotos con `STORAGE_ADAPTER=r2` (§5) |
| `S3_ENDPOINT` / `S3_REGION` | vacío / `us-east-1` con `S3_ENDPOINT` | Otro S3 compatible (MinIO, Garage…) en lugar de R2 (§5) |
| `R2_MAX_UPLOAD_BYTES` / `R2_UPLOAD_URL_TTL_SECONDS` | los de `UPLOAD_*` | Límites propios del adaptador `r2` |
| `EXPO_PUSH_ACCESS_TOKEN` | vacío | Token de la Expo Push API. El backend acepta dispositivos en `/api/me/push-token`; el móvil aún no registra tokens (ver `11-deuda-tecnica-pendiente.md`) |
| `EXPO_PUSH_BASE_URL` / `EXPO_PUSH_RECEIVE_TIMEOUT_MS` | `https://exp.host` / `5000` | Proveedor de push y timeout de respuesta (1–15000 ms); para carga, usar el simulador de `infra/load` |
| `PUSH_CONCURRENCY` | `4` | Workers Oban de push por nodo (1–32), con jobs persistentes y reintentos |

### Opcionales

| Variable | Por defecto | Qué es |
|---|---|---|
| `METRICS_TOKEN` | vacío | Habilita `GET /metrics` con `Authorization: Bearer <token>` para Prometheus |
| `APP_VERSION` | `dev` | Versión que devuelve `/healthz` (la imagen la hornea en el build) |
| `GOOGLE_JWKS_CACHE_TTL_MS` / `APPLE_JWKS_CACHE_TTL_MS` | `600000` | Caché de las claves públicas de los proveedores |
| `DEMO_CENTER` | `40.4168,-3.7038` (Madrid) | Solo desarrollo: centro `lat,lng` del escenario de `priv/repo/demo_seeds.exs` (las bios siguen hablando de Madrid) |

### Lo que no es configurable

Queda en el código (detalle y motivo en `11-deuda-tecnica-pendiente.md`): los textos de la app (solo en español), la regla de huella del DNI/NIE español (va por Estado emisor, así que no afecta a otros países), los límites antiabuso (subidas por hora, intentos de verificación: 5/hora y 10/día), las distancias del filtro (en km), la caducidad de los matches (30 días) y el rango de edades del filtro (18–100).

## 5. Fotos

El contrato con la app es el mismo con cualquier adaptador (detalle en `06-contratos-mobile-backend.md`, sección Fotos).

### `STORAGE_ADAPTER=local` (sin servicios extra)

- Las fotos se suben con un `PUT` firmado a `/api/uploads/<token>` y se sirven en `/uploads/photos/<clave>` desde `UPLOADS_DIR`. Solo se publican al completar la subida; las abandonadas y las borradas se eliminan del disco (barrido cada 10 min).
- `UPLOADS_DIR` tiene que estar en un **volumen persistente** (no en el sistema de ficheros del contenedor) e incluirse en los backups junto con PostgreSQL.
- El contenedor corre como `nobody`: el directorio debe ser escribible por el uid 65534. Con un bind mount:

  ```bash
  sudo mkdir -p /var/lib/cherry/uploads
  sudo chown 65534:65534 /var/lib/cherry/uploads
  # docker run … -v /var/lib/cherry/uploads:/var/lib/cherry/uploads -e UPLOADS_DIR=/var/lib/cherry/uploads
  ```

- Espacio: como mucho 4 fotos de 2 MB por perfil.

### `STORAGE_ADAPTER=r2` (Cloudflare R2 o cualquier S3)

- Variables: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL_BASE` (URL pública del bucket) y `R2_ACCOUNT_ID` para R2, o `S3_ENDPOINT` (+ `S3_REGION`, `us-east-1` por defecto) para MinIO, Garage u otro S3 con direccionamiento path-style.
- Las credenciales necesitan leer, escribir **y borrar** objetos (al completar se copia `pending/<clave>` a `<clave>` y se borra el original).
- El CORS del bucket debe permitir `PUT` con las cabeceras `Content-Type` e `If-None-Match`.
- Si el bucket es público, añade una regla de ciclo de vida que borre el prefijo `pending/` a 1 día.

Cambiar de adaptador no migra fotos.

## 6. Login con Google y Apple

Cherry solo admite Google y Apple. La app obtiene un token de identidad del proveedor y el backend lo valida contra las audiencias configuradas; después Phoenix emite su propia sesión.

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
2. Pon ese bundle ID en `APPLE_AUDIENCES` (backend). Si no lo defines, el backend usa `EXPO_IOS_BUNDLE_IDENTIFIER` o `app.cherry.mobile`.

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
    reverse_proxy cherry-backend:4000
}
```

Comprobaciones: `GET /healthz` (vivo, sin BD, devuelve la versión) y `GET /readyz` (hace ping a la BD). `GET /openapi.yaml` sirve el contrato REST.

Las métricas incluyen latencia HTTP/chat, consultas y espera del pool, memoria/procesos BEAM y entrega/espera/fallos de push. Las latencias se exportan en **microsegundos**. `/metrics` devuelve 404 sin `METRICS_TOKEN` y 401 sin su Bearer. El procedimiento de carga sostenida está en [infra/load/README.md](../infra/load/README.md); usa una base independiente terminada en `_load`, sesiones sintéticas reales y un simulador de Expo.

## 8. Compilar la app contra tu instancia

La app lee estas variables **en tiempo de compilación** desde `apps/mobile/.env` (plantilla: `apps/mobile/.env.example`). Lo que depende de la instancia y no de la tienda (nombre de la instancia, gestor, contacto, textos legales, edad mínima) **no** va aquí: la app lo pide a `GET /api/config` al arrancar (§4, «Instancia y país»).

| Variable | Por defecto | Qué es |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL_ANDROID` | `http://10.0.2.2:4000` | URL de la API en Android (el valor por defecto es el host visto desde el emulador). Con `http://` el build permite tráfico en claro; con `https://` no |
| `EXPO_PUBLIC_API_BASE_URL_IOS` | `http://localhost:4000` | URL de la API en iOS |
| `EXPO_PUBLIC_API_BASE_URL_WEB` | vacío (mismo origen) | URL de la API en web |
| `EXPO_APP_NAME` | `Cherry` | Nombre de la app en el teléfono y en las tiendas, y en los textos de permisos del sistema (fotos, cámara, ubicación, NFC) |
| `EXPO_APP_SLUG` | `cherry` | Slug del proyecto de Expo/EAS |
| `EXPO_APP_SCHEME` | `cherry` | Esquema de deep links (`cherry://`); también es la vuelta del flujo de Didit |
| `EXPO_ANDROID_PACKAGE` | `app.cherry.mobile` | Paquete de Android |
| `EXPO_IOS_BUNDLE_IDENTIFIER` | `app.cherry.mobile` | Bundle ID de iOS (y audiencia de Apple en el backend si no defines `APPLE_AUDIENCES`) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | vacío | Client ID web de Google (§6) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | vacío | Client ID iOS de Google (§6) |
| `GOOGLE_IOS_URL_SCHEME` | vacío | «iOS URL scheme» de Google (client ID invertido). Sin él no se añade el plugin de Google Sign-In en iOS |
| `EXPO_PUBLIC_SOURCE_URL` | vacío | Enlace «Ver el código» de «Acerca de» (tu fork; ver la nota de AGPL arriba). Sin ella se usa `INSTANCE_SOURCE_URL` del servidor |
| `EXPO_PUBLIC_MOCK_AUTH` | `false` | Solo desarrollo: login y bootstrap simulados, sin backend |
| `EXPO_PUBLIC_TEST_LOGIN` | — | Builds internas: enseña los accesos de prueba del login fuera de desarrollo. El backend solo los acepta si corre con `MIX_ENV=dev` |

Ejemplo:

```bash
EXPO_PUBLIC_API_BASE_URL_ANDROID=https://api.tu-dominio.example
EXPO_PUBLIC_API_BASE_URL_IOS=https://api.tu-dominio.example
EXPO_PUBLIC_API_BASE_URL_WEB=https://api.tu-dominio.example

EXPO_APP_NAME=Cherry
EXPO_ANDROID_PACKAGE=tu.dominio.cherry
EXPO_IOS_BUNDLE_IDENTIFIER=tu.dominio.cherry

EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=…
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=…
GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.…

EXPO_PUBLIC_SOURCE_URL=https://…
```

- Si vas a publicar en las tiendas, usa tu propio paquete y bundle ID: los de ejemplo (`app.cherry.mobile`) no son tuyos.
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
- **Certificados CSCA**: revisa cada pocos meses si hay CSCA nuevos de los países en los que confías (España publicará previsiblemente un CSCA 5 hacia 2027). Procedimiento en `apps/backend/priv/csca/README.md`.
- **Actualizar**: construye la imagen nueva y reemplaza el contenedor; las migraciones se aplican al arrancar. Las migraciones del proyecto siguen expand/contract y no deben revertirse en producción (despliega la versión anterior en su lugar). Algunas crean índices sin `CONCURRENTLY` sobre `swipe_actions`, que bloquean escrituras en esa tabla mientras se construyen (ver `11-deuda-tecnica-pendiente.md`).
- **Una sola réplica** mientras no se configure un clúster de Erlang: el PubSub del chat no cruza nodos.
- **Moderación**: los reportes se guardan en la tabla `reports`, pero todavía no hay panel de administración (ver `11-deuda-tecnica-pendiente.md`).

## 10. Montar Cherry en otro país

El código no asume España salvo donde se indica. Para montar, por ejemplo, «Cherry France»:

1. **Identidad de la instancia.** Define `INSTANCE_NAME`, `INSTANCE_COUNTRY` (`FR`), `INSTANCE_LOCALE` (`fr-FR`), `INSTANCE_OPERATOR`, `INSTANCE_CONTACT_EMAIL` e `INSTANCE_SOURCE_URL` (§4). Respeta la política de nombre de `TRADEMARKS.md` (no uses el nombre de otro país y di que tu instancia es independiente) y añádete a su lista de instancias.
2. **Textos legales.** Redacta la política de privacidad y las condiciones de uso según la ley de tu país (protección de datos, servicios digitales, edad mínima, autoridad de control) y publícalas en `INSTANCE_PRIVACY_URL` e `INSTANCE_TERMS_URL`. Los textos de `docs/compliance/` están pensados para España (RGPD + LOPDGDD, AEPD): úsalos como guía, no como texto legal.
3. **Edad mínima.** `AGE_VERIFICATION_MINIMUM_AGE` si en tu país la mayoría de edad (o la exigida a una app de citas) es mayor de 18.
4. **Documentos de identidad.**
   - NFC: añade los CSCA de tu país en una carpeta `apps/backend/priv/csca/<código de país>/` (o en un volumen, con `CSCA_PATHS`) con sus huellas comprobadas contra la fuente oficial, como hace `priv/csca/README.md` para España (la master list del BSI incluye muchos países: `mix cherry.csca GermanMasterList.ml --country FR --export /tmp/fr`). Elige en qué países confías con `CSCA_COUNTRIES` (p. ej. `fr`, o `fr,es` si también aceptas documentos españoles). Si un país no está en la lista, sus documentos no pasan la lectura NFC.
   - `AGE_VERIFICATION_DOCUMENTS` limita los tipos (`id_card`, `passport`).
   - La huella «una persona, una cuenta» usa el número del documento salvo en las tarjetas españolas (DNI/TIE), donde usa el DNI/NIE porque sobrevive a las renovaciones. Si las tarjetas de tu país cambian de número al renovarse y llevan un número personal estable, habría que añadir su regla en `Cherry.Identity.Document.Mrz` y `Fingerprint` (es una regla por Estado emisor, como la española). Las huellas no se pueden recalcular: decide esto antes de abrir.
   - Didit: crea tu propio workflow y elige en su consola los países y documentos que aceptas.
5. **Claves de proveedores.** Las tuyas, nunca las de otra instancia: Google y Apple (§6), Didit, Expo Push y el almacenamiento de fotos. Genera tus propios secretos (§4); `DOCUMENT_FINGERPRINT_KEY` y `MESSAGE_ENCRYPTION_KEY` no se pueden cambiar después.
6. **Distribución en las tiendas.** Publica con tu cuenta de desarrollador, tu paquete y bundle ID (§8) y limita la distribución a tu país en Google Play Console y App Store Connect. Las fichas, la clasificación de edad y los requisitos de cada tienda están resumidos en `docs/compliance/01-tiendas.md` (para España).
7. **Idioma.** La app solo está en español (textos en el código, sin i18n), y algunos textos de la verificación nombran documentos españoles (DNI, TIE). Traducirla está pendiente (`11-deuda-tecnica-pendiente.md`); hasta entonces, una instancia en otro idioma tiene que mantener su traducción en su fork.
8. **Unidades y formato.** Distancias en kilómetros y fechas con formato español (24 h); no hay moneda porque no hay pagos.
