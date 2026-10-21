# Monta tu instancia

Guía genérica para montar una instancia propia de Cherry: backend Phoenix + PostgreSQL/PostGIS detrás de un proxy TLS, fotos en disco o en un bucket S3, y la app móvil compilada contra tu servidor. No depende de ningún proveedor concreto.

> Cherry se distribuye con licencia **AGPL-3.0** (`LICENSE`). Si modificas el código y ofreces la app a otras personas, tienes que ofrecerles también el código de tu versión. La pantalla «Acerca de» de la app enseña un enlace «Ver el código» si compilas con `EXPO_PUBLIC_SOURCE_URL` (ver §8).

## 1. Qué necesitas

| Pieza | Versión probada | Notas |
|---|---|---|
| PostgreSQL + PostGIS | PostgreSQL 18 + PostGIS 3.6 (funciona desde la 17) | Las migraciones crean las extensiones `postgis`, `uuid-ossp` y `pgcrypto` |
| Backend | Imagen Docker de `apps/backend/Dockerfile` o release de Elixir (Elixir 1.18, OTP 28) | Escucha HTTP en `PORT` (4000 por defecto) |
| Proxy TLS | Cualquiera (Caddy, nginx, Traefik…) | Termina HTTPS y reenvía a Phoenix, con WebSocket |
| Almacenamiento de fotos | Disco local (volumen persistente) o bucket S3 compatible | `STORAGE_ADAPTER=local` o `r2` |
| Cuentas de desarrollador | Google Cloud (Google Sign-In) y Apple Developer (Sign in with Apple) | Apple nativo iOS; Android requiere además Services ID y clave de servidor (§6) |
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

### Backoffice privado

`BACKOFFICE_ENABLED=false` por defecto. El equipo se provisiona expresamente desde consola con roles independientes del login móvil. El panel exige HTTPS; si termina TLS en proxy, `BACKOFFICE_TRUSTED_PROXY_IPS` lista únicamente las IP exactas de peers directos controlados que sobrescriben `X-Forwarded-Proto`, nunca rangos genéricos ni IP de usuarios. Sin reconocimiento de HTTPS, responde 426 incluso aunque la app principal permita HTTP. No actives el panel sin verificar el trayecto real y probar permisos/CSRF. [Alta, códigos de acceso y límites](./14-backoffice.md).

Para separarlo de la web/API, configura `BACKOFFICE_HOST=admin.tu-dominio.example`
(hostname exacto, sin esquema/puerto/ruta y distinto de `PHX_HOST`) y publica ambos
hosts hacia la misma aplicación. La raíz del host administrativo redirige a
`/backoffice`; sus rutas de producto/API/WebSocket no están disponibles. El panel
devuelve 404 en cualquier otro host, sin redirigir contraseñas ni códigos. Cookies
de equipo limitadas al host y ruta, sin `Domain` compartido. No se confía en
`X-Forwarded-Host`. Sin `BACKOFFICE_HOST` se conserva el enrutado anterior para
instancias autoalojadas.

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
| `AGE_VERIFICATION_DOCUMENTS` | `id_card,passport` | Documentos aceptados, separados por comas: `id_card` (DNI y otras tarjetas de identidad), `passport` y `residence_permit` (TIE y otros permisos de residencia; un código MRZ acabado en `R` o una tarjeta española con NIE). Un documento auténtico de un menor se trata como tal aunque su tipo no se acepte |
| `CSCA_PATHS` | — | Ficheros o carpetas (separados por comas) con certificados CSCA de confianza para la autenticación pasiva por NFC. Sustituyen a la carpeta incluida en el código |
| `CSCA_COUNTRIES` | — (toda `priv/csca`) | Carpetas de país de `apps/backend/priv/csca` en las que confiar (`es` = España). Se suman a `CSCA_PATHS`. Sin `CSCA_PATHS` ni `CSCA_COUNTRIES` se confía en toda `priv/csca`, que trae los CSCA de las listas maestras públicas de Alemania, Países Bajos, Italia y Suecia (unos 136 emisores; `priv/csca/README.md`) |
| `DIDIT_API_KEY` / `DIDIT_WORKFLOW_ID` | vacío | Verificación con selfie + documento (Didit). Sin ellas (o sin `DOCUMENT_FINGERPRINT_KEY`), `POST /api/me/verification/provider` responde 503 y la app no ofrece el método. En producción solo se aceptan decisiones del entorno *live* de Didit. Los países y documentos que admite Didit se eligen además en su consola, en el workflow |
| `DIDIT_MONTHLY_LIMIT` | vacío (sin límite) | Máximo de sesiones de Didit por mes natural (UTC); cada una cuesta dinero. Al llegar, la app marca el selfie como «No disponible este mes» y `POST /api/me/verification/provider` responde 503 `provider_limit_reached`; las sesiones ya empezadas se siguen resolviendo. Solo se guarda la cuenta por mes, sin usuarios. El log dice «session N of L this month» en cada sesión nueva |
| `DIDIT_WEBHOOK_SECRET` | vacío | Secreto del destino de webhook de Didit. Crea el destino en su consola (*API & Webhooks*) o con `POST /v3/webhook/destinations/`: URL `https://<tu dominio>/api/webhooks/didit`, versión `v3`, evento `status.updated`; el secreto solo se muestra al crearlo. Sin él, las sesiones que la app no vuelve a consultar (cerrada a medias, caducada, revisión manual) no se resuelven ni se borran en Didit |

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
| `EXPO_PUSH_BATCH_SIZE` | `100` | Dispositivos por petición a Expo (1–100); lotes menores aumentan las peticiones por trabajo |
| `EXPO_PUSH_POOL_TIMEOUT_MS` / `EXPO_PUSH_CONNECT_TIMEOUT_MS` | `5000` / `5000` | Espera del pool y conexión HTTP de push (1–15000 ms cada una); validadas al arrancar por `PushConfig` |
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
- El barrido conserva un máximo predeterminado de 200 fotos y 200 intents por tick. En configuración Elixir: `config :cherry, :photo_storage_sweeper, batch_size: 200` (rango 1–1000); `interval_ms` positivo y `initial_delay_ms` no negativo, por defecto 600000/60000 ms. No son variables de entorno. Los fallos quedan pendientes para otro tick; un backlog puede tardar varios ciclos.
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

Cherry solo admite Google y Apple. Con Google y Apple nativo, la app obtiene un token de identidad del proveedor y el backend lo valida contra las audiencias configuradas; después Phoenix emite su propia sesión. Apple Android utiliza un código efímero ligado al móvil tras un intercambio servidor–Apple, no un token en el deep link.

### Google

En Google Cloud Console, dentro de un mismo proyecto:

1. Configura la pantalla de consentimiento de OAuth.
2. Crea tres clientes de OAuth:
   - **Aplicación web**: su client ID va en `GOOGLE_WEB_CLIENT_ID` (backend) y en `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (app). En Android el token que recibe el backend lleva esta audiencia.
   - **Android**: con el nombre de paquete (`EXPO_ANDROID_PACKAGE`) y la huella SHA-1 del certificado con el que firmas la app (la de depuración y la de publicación son distintas; si publicas en Google Play, la de la clave de firma de Play). No se copia a ninguna variable, pero sin él el login falla en Android.
   - **iOS**: con el bundle ID (`EXPO_IOS_BUNDLE_IDENTIFIER`). Su client ID va en `GOOGLE_IOS_CLIENT_ID` (backend) y `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (app), y su «iOS URL scheme» (el client ID invertido, `com.googleusercontent.apps.…`) en `GOOGLE_IOS_URL_SCHEME` (app).

### Apple nativo (iOS)

En Apple Developer:

1. Activa la capacidad **Sign in with Apple** en el App ID de tu bundle ID, como **Primary App ID** si vas a asociarle el Services ID de Android.
2. Pon ese bundle ID en `APPLE_AUDIENCES` (backend). Si no lo defines, el backend usa `EXPO_IOS_BUNDLE_IDENTIFIER` o `app.cherry.mobile`.
3. La configuración Expo declara `ios.usesAppleSignIn` y el plugin `expo-apple-authentication`; la firma/provisioning debe incluir esa capacidad. No basta con crear la ficha de App Store Connect.

### Apple mediante navegador (Android, activación controlada)

Implementado tras flags **apagados por defecto**. Las pruebas automatizadas usan
Apple simulado: no acreditan un login real, firma ni aprobación de tienda. No
activar para el público antes de completar las pruebas y los pendientes de abajo.

En Apple Developer → Certificates, Identifiers & Profiles:

1. Conserva el Bundle ID de iOS (`app.cherry.mobile` en la app oficial). Crea un
   **Services ID** distinto, por ejemplo `app.cherry.browser`, habilita **Sign in
   with Apple** y asócialo al **mismo Primary App ID** de iOS. No basta con que los
   correos coincidan: la app identifica la cuenta por el `sub` firmado de Apple.
2. En su configuración web registra el dominio público de la API y la Return URL
   exacta `https://TU_HOST/api/auth/apple/browser/callback`. Para Cherry España:
   **`https://cherry.org.es/api/auth/apple/browser/callback`**, dominio
   **`cherry.org.es`**, nunca el host del panel (`BACKOFFICE_HOST`). No registres una URL ficticia,
   una IP, localhost ni el esquema de la app como retorno de Apple.
3. Crea una **Key** con **Sign in with Apple**, asociada a ese Primary App ID.
   Conserva el **Team ID**, **Key ID** y el archivo privado **`.p8`**. Apple permite
   descargarlo una vez: custódialo también offline de forma segura. No subirlo al
   repositorio, app, chat ni logs; base64 es codificación, **no cifrado**.

Variables **solo del backend** (almacén privado de producción o `.env` ignorado
local; archivos privados `0600` y directorio `0700`):

| Variable | Contenido |
|---|---|
| `APPLE_BROWSER_ENABLED` | `false` hasta la activación controlada; `true` exige toda la configuración válida al arrancar |
| `APPLE_BROWSER_CLIENT_ID` | Services ID; **no** añadirlo a `APPLE_AUDIENCES` |
| `APPLE_BROWSER_REDIRECT_URI` | Return URL HTTPS exacta en `PHX_HOST`, ruta anterior, sin query/fragmento |
| `APPLE_BROWSER_APP_REDIRECT_URIS` | Lista de retornos de app exactos, p. ej. `cherry://auth/apple`; `cherry-dev://auth/apple` solo si autorizas también esa build interna |
| `APPLE_TEAM_ID` / `APPLE_KEY_ID` | Identificadores Apple de 10 caracteres |
| `APPLE_PRIVATE_KEY_BASE64` | PEM completo del `.p8` P-256 en base64, una línea; **secreto exclusivamente del servidor** |

En la build móvil: `EXPO_PUBLIC_APPLE_BROWSER_ENABLED=true` y el esquema
`EXPO_APP_SCHEME` correspondiente a la lista anterior. No necesita Services ID,
Team ID, Key ID ni clave en el cliente. No cambia Google; Apple nativo iOS envía
también su código de autorización para el canje y la revocación en servidor;
web sigue sin ofrecer Apple. Requiere build nativa propia, no Expo Go. Un cambio
del título de tienda a OpenCherry no exige cambiar Bundle ID, paquete ni OAuth.
El nombre bajo el icono sigue siendo **Cherry**, o **Cherry Dev** en desarrollo;
el título comercial de la ficha de tienda se gestiona de forma independiente.

**APKs internas de Cherry España:** `scripts/build-android-internal.sh` genera
por defecto Cherry Dev contra `https://cherry.org.es`, con Apple navegador activo.
Para actualizar también la Cherry normal ya instalada, sin cambiar su identidad:

```bash
EXPO_ANDROID_PACKAGE=app.cherry.mobile EXPO_APP_SCHEME=cherry \
  EXPO_APP_SLUG=cherry EXPO_IOS_BUNDLE_IDENTIFIER=app.cherry.mobile \
  bash scripts/build-android-internal.sh
```

Ambas apuntan a la misma instancia de producción; tener dos iconos no crea una
instancia de desarrollo. Estos overrides no sobrescriben `.env`. El script
regenera solo la caché de autolinking si cambia el paquete, y el plugin aísla
`cherry` de `cherry-dev` para no capturar el retorno de la otra app. Antes de
instalar con `adb install -r`, comprobar paquete y firma compatibles; no
desinstalar para esquivar un conflicto de firma. Son builds con firma interna,
no artefactos firmados/autorizados para publicar en tiendas.

**Protocolo y límites:**

- El móvil crea un verificador aleatorio y envía solo su desafío S256, un nonce y
  un estado local a `POST /api/auth/apple/browser`.
- El navegador de sistema abre exclusivamente Apple (`response_type=code`,
  `scope=email`, `response_mode=form_post`). Apple hace POST al callback HTTPS;
  el backend consume su estado una vez, canjea el código con un client secret
  ES256 de cinco minutos y verifica firma, emisor, audiencia y nonce del ID token.
- No se usan cookies de sesión ni CSRF de navegador en ese callback: el estado
  OAuth es obligatorio. Solo se redirige al retorno previamente permitido. La
  URL contiene un código opaco de un uso de **60 s**, nunca tokens Apple/Cherry.
- El móvil comprueba retorno y estado y envía `providerToken=apple-browser:…` y
  `nonce=<verificador>` al callback Apple habitual. Solo ese verificador permite
  consumir el código y crear sesión; interceptar el deep link no basta.
- No se fusionan cuentas por email. Si otro proveedor ya ocupa el correo,
  responde `409 identity_conflict`: entrar con el método original.
- Estado inicial válido **5 min**, máximo **512 entradas** y **30 inicios/minuto
  por peer directo**; con un balanceador compartido, ese límite se comparte.
  Estado y handoff solo en memoria; reiniciar
  exige repetir el login. Mantener **una réplica**; varias necesitan un almacén
  compartido o una afinidad que abarque app y navegador, no solo cookies.
- Se exige HTTPS incluso con `FORCE_SSL=false`. Tras proxy se reutiliza la lista
  exacta `BACKOFFICE_TRUSTED_PROXY_IPS`; solo peers controlados que sobrescriban
  `X-Forwarded-Proto`. No ampliar rangos ni confiar en cabeceras del cliente.
  Excluir estas rutas de caché, redirecciones y registros de cuerpo/query/Location
  en todos los proxies; las respuestas son `private, no-store` y `no-referrer`.

**Antes de darlo por operativo:** desplegar expresamente el backend configurado,
probar en Android primer acceso y repetición, cancelación, email real/oculto,
sesión después de reiniciar app y acceso iOS a la misma cuenta agrupada. Probar
también caducidad/reintento y que no se duplican identidades. El callback no existe
en una instancia hasta desplegar y activar este bloque. En Cherry España se ha
desplegado/activado expresamente el 18-10-2026 para pruebas internas con APK
Cherry Dev, no como lanzamiento público; las pruebas reales siguen pendientes.

**Revocación al borrar:** el servidor canjea el código tanto del navegador como
de iOS (cuando `APPLE_BROWSER_ENABLED=true`, el código nativo es obligatorio).
Descarta el access token y guarda únicamente el refresh token cifrado con la
clave vigente `MESSAGE_ENCRYPTION_KEY`, fuera de `provider_data` y separado por
client ID. No regenerar esa clave al desplegar. Al borrar traslada la instrucción
cifrada a la outbox y al registro externo, sin cuenta, correo ni subject Apple.
Apple confirma con HTTP 200 en `/auth/revoke`; una caída deja la cuenta borrada
y solo la instrucción pendiente de reintento. Tras confirmar se retiran la tarea
y su objeto externo. Los backups cifrados previos caducan con los siete días
habituales; la restauración debe seguir reaplicando las bajas antes de abrir.
Identidades antiguas sin credencial requieren volver a entrar para obtenerla.
Las pruebas simuladas no acreditan todavía revocación real con Apple ni cierran
los demás bloqueos legales y de seguridad/moderación del servicio.

Referencias: [Apple en otras plataformas](https://developer.apple.com/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms)
y [Expo WebBrowser SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/webbrowser/).

### Vincular Google y Apple a una cuenta

En **Ajustes → Métodos de acceso** se listan los métodos vinculados. Para añadir
uno, la app pide confirmar el proveedor ya asociado y después el nuevo. Ambas
pruebas firmadas deben haberse emitido en los últimos cinco minutos y se validan
en el servidor, con sesión activa. Las pruebas no se guardan en el estado móvil,
logs ni URLs. No cambia el ID de cuenta, correo de contacto, perfil o conversaciones;
funciona también con el correo oculto de Apple. No se mueve una identidad que ya
pertenezca a otra cuenta ni se sustituye otra del mismo proveedor.

Un conflicto de correo en el login muestra solo el aviso de error indicando
entrar con el otro método y vincular desde Ajustes → Métodos de acceso. No añade
botones duplicados ni cambia la navegación normal tras entrar; tampoco vincula
nada automáticamente ni conserva la prueba fallida.
Los retornos Apple con la app abierta los consume solo el adaptador de navegador,
sin desmontar la pantalla autenticada; un arranque frío obliga a reintentar.

Para quitar un método hay que confirmar con el que se conservará. Nunca se retira
el último. Se cierran las demás sesiones y se vuelve a comprobar la asociación
antes de emitir sesiones nuevas; se desconectan también los sockets abiertos
(la sesión conservada puede reconectar). Esto cubre incluso si un login se verificó
antes de retirarla.
Apple requiere credencial de revocación y confirmación previa de Apple; una caída
no se presenta como retirada terminada ni deja un token antiguo en una cola que
pueda revocar una vinculación nueva. Identidades Apple anteriores sin credencial
deben volver a entrar con Apple antes de retirarse.

El registro externo conserva una intención `identity` con el UUID de la asociación,
sin correo/subject. Si hay rollback o falla la respuesta, el barrido puede completar
esa retirada; actualizar la lista antes de reintentar. El registro protege también
restauraciones; una vinculación posterior tiene otro UUID y no se elimina por la
baja antigua. Un snapshot que solo contiene el método retirado se queda cerrado
hasta resolver el acceso, nunca se reabre ignorando la baja. Actualizar el script
de backups para reconocer `identity` antes de activar esta versión. Los endpoints
`/api/me/auth-methods` y sus mutaciones requieren HTTPS y respuestas no-store;
las pruebas inválidas responden 422, no disparan refresco/repetición del bearer.

### Dónde se configura cada cosa

| Dato | Backend (`apps/backend`) | App (`apps/mobile/.env`) |
|---|---|---|
| Client ID web de Google | `GOOGLE_WEB_CLIENT_ID` | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` |
| Client ID iOS de Google | `GOOGLE_IOS_CLIENT_ID` | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` + `GOOGLE_IOS_URL_SCHEME` |
| Bundle ID de iOS | `APPLE_AUDIENCES` | `EXPO_IOS_BUNDLE_IDENTIFIER` |
| Paquete de Android | — (va en el cliente OAuth Android) | `EXPO_ANDROID_PACKAGE` |
| Apple navegador Android | `APPLE_BROWSER_*`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY_BASE64` | `EXPO_PUBLIC_APPLE_BROWSER_ENABLED` + `EXPO_APP_SCHEME` |

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
| `EXPO_APP_NAME` | `Cherry` | Nombre bajo el icono y en los permisos del sistema; desarrollo usa `Cherry Dev`. El título de tienda `OpenCherry` es independiente; la instancia propia sigue siendo Cherry España |
| `EXPO_APP_SLUG` | `cherry` | Slug del proyecto de Expo/EAS |
| `EXPO_APP_SCHEME` | `cherry` | Esquema de deep links (`cherry://`); también es la vuelta del flujo de Didit |
| `EXPO_ANDROID_PACKAGE` | `app.cherry.mobile` | Paquete de Android |
| `EXPO_IOS_BUNDLE_IDENTIFIER` | `app.cherry.mobile` | Bundle ID de iOS (y audiencia de Apple en el backend si no defines `APPLE_AUDIENCES`) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | vacío | Client ID web de Google (§6) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | vacío | Client ID iOS de Google (§6) |
| `GOOGLE_IOS_URL_SCHEME` | vacío | «iOS URL scheme» de Google (client ID invertido). Sin él no se añade el plugin de Google Sign-In en iOS |
| `EXPO_PUBLIC_APPLE_BROWSER_ENABLED` | `false` | Ofrece Apple en Android mediante el backend configurado (§6); iOS conserva Apple nativo y web sigue deshabilitado |
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
- **Certificados CSCA**: cada pocos meses, vuelve a importar las listas maestras de Alemania, Países Bajos, Italia y Suecia para tener los CSCA nuevos (España publicará previsiblemente un CSCA 5 hacia 2027). Procedimiento en `apps/backend/priv/csca/README.md`.
- **Actualizar**: construye la imagen nueva y reemplaza el contenedor; las migraciones se aplican al arrancar. Las migraciones del proyecto siguen expand/contract y no deben revertirse en producción (despliega la versión anterior en su lugar). Algunas crean índices sin `CONCURRENTLY` sobre `swipe_actions`, que bloquean escrituras en esa tabla mientras se construyen (ver `11-deuda-tecnica-pendiente.md`).
- **Una sola réplica** mientras no se configure un clúster de Erlang: el PubSub del chat no cruza nodos.
- **Moderación**: los reportes se guardan en la tabla `reports`, pero todavía no hay panel de administración (ver `11-deuda-tecnica-pendiente.md`).

## 10. Montar Cherry en otro país

El código no asume España salvo donde se indica. Para montar, por ejemplo, «Cherry France»:

1. **Identidad de la instancia.** Define `INSTANCE_NAME`, `INSTANCE_COUNTRY` (`FR`), `INSTANCE_LOCALE` (`fr-FR`), `INSTANCE_OPERATOR`, `INSTANCE_CONTACT_EMAIL` e `INSTANCE_SOURCE_URL` (§4). Respeta la política de nombre de `TRADEMARKS.md` (no uses el nombre de otro país y di que tu instancia es independiente) y añádete a su lista de instancias.
2. **Textos legales.** Redacta la política de privacidad y las condiciones de uso según la ley de tu país (protección de datos, servicios digitales, edad mínima, autoridad de control) y publícalas en `INSTANCE_PRIVACY_URL` e `INSTANCE_TERMS_URL`. Los textos de `docs/compliance/` están pensados para España (RGPD + LOPDGDD, AEPD): úsalos como guía, no como texto legal.
3. **Edad mínima.** `AGE_VERIFICATION_MINIMUM_AGE` si en tu país la mayoría de edad (o la exigida a una app de citas) es mayor de 18.
4. **Documentos de identidad.**
   - NFC: `priv/csca` ya trae los CSCA de unos 136 emisores, cada uno en `apps/backend/priv/csca/<código de país>/`. Por defecto se acepta todo; si prefieres limitarlo, elige los países con `CSCA_COUNTRIES` (p. ej. `fr`, o `fr,es`). Si a tu país le falta un CSCA, añádelo en su carpeta (o en un volumen, con `CSCA_PATHS`) con la huella comprobada contra la fuente oficial. Si un país no está en la lista, sus documentos no pasan la lectura NFC. La app enseña la lista de países que acepta tu servidor.
   - `AGE_VERIFICATION_DOCUMENTS` limita los tipos (`id_card`, `passport`, `residence_permit`).
   - La huella «una persona, una cuenta» usa el número del documento salvo en las tarjetas españolas (DNI/TIE), donde usa el DNI/NIE porque sobrevive a las renovaciones. Si las tarjetas de tu país cambian de número al renovarse y llevan un número personal estable, habría que añadir su regla en `Cherry.Identity.Document.Mrz` y `Fingerprint` (es una regla por Estado emisor, como la española). Las huellas no se pueden recalcular: decide esto antes de abrir.
   - Didit: crea tu propio workflow y elige en su consola los países y documentos que aceptas. Pon `DIDIT_MONTHLY_LIMIT` a lo que puedas pagar al mes. Revisa también la retención de datos, el uso para entrenar modelos y si las sesiones dudosas van a revisión manual: tu texto de privacidad debe decir lo que hayas elegido.
5. **Claves de proveedores.** Las tuyas, nunca las de otra instancia: Google y Apple (§6), Didit, Expo Push y el almacenamiento de fotos. Genera tus propios secretos (§4); `DOCUMENT_FINGERPRINT_KEY` y `MESSAGE_ENCRYPTION_KEY` no se pueden cambiar después.
6. **Distribución en las tiendas.** Publica con tu cuenta de desarrollador, tu paquete y bundle ID (§8) y limita la distribución a tu país en Google Play Console y App Store Connect. Las fichas, la clasificación de edad y los requisitos de cada tienda están resumidos en `docs/compliance/01-tiendas.md` (para España).
7. **Idioma.** La app solo está en español (textos en el código, sin i18n), y algunos textos de la verificación nombran documentos españoles (DNI, TIE). Traducirla está pendiente (`11-deuda-tecnica-pendiente.md`); hasta entonces, una instancia en otro idioma tiene que mantener su traducción en su fork.
8. **Unidades y formato.** Distancias en kilómetros y fechas con formato español (24 h); no hay moneda porque no hay pagos.
