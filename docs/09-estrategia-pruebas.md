# Estrategia de pruebas

## Suites

Cifras de la última ejecución (2026-10-17), todas en verde:

| Suite | Comando | Tests |
|---|---|---|
| Backend (ExUnit) | `pnpm test:backend` → `mix test` en `apps/backend` | 737 |
| Móvil (vitest + jsdom) | `pnpm --filter @cherry/mobile test` | 975 (128 ficheros) |
| Mobile-shared (vitest) | `pnpm --filter @cherry/mobile-shared test` | 53 |
| Contracts (vitest) | `pnpm test:contracts` | 29 |

`pnpm test:mobile` ejecuta: typecheck de mobile y mobile-shared → tests mobile-shared → tests mobile → tests contracts. `pnpm test` = móvil + backend.

Cierre de la cuarta pasada: backend comprobado además con **Elixir 1.18.4 / OTP 28** (toolchain de CI); `mix format --check-formatted` global pasa con esa versión, incluido `mrz.ex` sin modificar. Bundles de producción Hermes Android/iOS exportados correctamente, sin instalar ni probar hardware. Los avisos conocidos de mocks DOM/`act` no hacen fallar la suite móvil.

Lote de backoffice del 2026-10-16: suites integradas, typechecks, `mix compile --warnings-as-errors`, formato global y referencias locales OpenAPI comprobados. **En este lote no se compilaron/exportaron APK, IPA ni bundles móviles**, no se desplegó ni se activaron proveedores. No hay verificación visual/nativa nueva. Los avisos DOM/`act` ya conocidos no fallan la suite.

Revisión posterior del mismo lote: responsabilidades de casework divididas, regresión HTTPS con `FORCE_SSL` activo, logs SQL sensibles en debug, reclamaciones reabiertas, validación de directorio de códigos, altas inválidas sin efectos parciales, lecturas idempotentes y envío de chat concurrente con suspensión. Detalle móvil actualizado por ID y reintento seguro. La suite integrada detectó contaminación del catálogo por un fixture real de concurrencia; se cambió a perfiles mínimos y se limpiaron únicamente sus tres etiquetas propias. Ejecución final: 702/974/53/29 sin fallos; no se han descartado errores de suite como si fueran éxito.

Segundo lote: **725 backend / 974 móvil / 53 mobile-shared / 29 contracts**, typechecks, compilación backend con warnings como errores y formato/diff correctos. Incluye permisos de superusuario, invitaciones/contraseñas, revocación/bloqueo, último superusuario con cambios simultáneos, grafo de borrado, reintentos externos, rollback, reutilización de identidad, decisiones de verificación tardías y borrado concurrente con mensajes. Landing revisada visualmente en Chromium con HTML renderizado localmente a 1440 y 390 px; sin arrancar un servidor ni asignar puertos. No valida todavía navegación completa, backoffice visual ni dispositivos nativos.

**Bloqueo de medidas ajenas resuelto el 2026-10-17:** el titular aprobó la ficha mínima independiente. Se prueba borrado completo del expediente/textos/identidad del denunciante, conservación de la medida y su revisión, aislamiento API/permisos, revisión por otro miembro del equipo y restauración humana. Recursos pendientes mantienen asignación/fecha y los resueltos no se reinician; rollback, descendientes indirectos y borrado posterior de la cuenta afectada no dejan fichas residuales.

Cuatro pruebas con conexiones PostgreSQL reales cubren suspensión→borrado, borrado→decisión en espera, recurso en trámite→borrado y borrado de las dos cuentas a la vez. El móvil muestra `measure` y permite pedir revisión sin componentes ni builds nuevos. Ejecución integrada: **737/975/53/29**, typechecks correctos. Los plazos de backups y el análisis jurídico quedan expresamente fuera de este bloque. [Detalle](./15-borrado-y-web-publica.md).

## Entorno del backend

Sin variables, los tests usan **PostgreSQL 17 + PostGIS** en `localhost:5432` (usuario/pass `postgres`, DB `cherry_test`; ver `config/test.exs`). Con el PostGIS del compose de `infra/` (puerto 5510):

```bash
cd apps/backend
TEST_DATABASE_URL=ecto://postgres:postgres@localhost:5510/cherry_test mix test
```

`DATABASE_URL` solo se usa en tests si el nombre de la BD contiene `_test` (p. ej. `cherry_test_fix` para una copia aislada); si apunta a otra (p. ej. `cherry_dev` exportado en la shell), `mix test` se niega a arrancar en vez de machacarla. `mix test` crea y migra la DB automáticamente. Para correr la suite en paralelo con un servidor de desarrollo, usa otra BD y otro directorio de build: `TEST_DATABASE_URL=…/cherry_test_x MIX_BUILD_ROOT=_build_x mix test`.

En CI (`.github/workflows/ci.yml`) el backend se prueba contra un servicio `postgis/postgis:17-3.5` en el puerto 5432.

Cobertura: umbral 90 % configurado en `mix.exs` (`mix test --cover`).

## Qué se prueba

### Backend
- Backoffice/casework: roles separados y permisos actuales, códigos de un uso y sesiones caducadas/revocadas, archivos de códigos 0600/exclusivos, CSRF, HTTPS y rechazo de cabeceras de proxy no confiables, XSS, conservación de borrador inválido y límites de solicitudes. Decisión/comunicaciones atómicas, autor del reporte no expuesto, suspensión/recurso/restauración y reapertura sin reescribir historia. Prueba con **conexiones PostgreSQL concurrentes reales** para consumo único, asignación y resolución única (`casework_concurrency_test.exs`), con limpieza acotada de sus fixtures.
- Dominio dating (`dating_test.exs`, `discovery_test.exs`): perfiles draft, completitud, ranking v2 con sus filtros duros y puntuación, swipes, matches, conversaciones, caducidad.
- Concurrencia real: dos likes simultáneos crean exactamente un match (`swipe_concurrency_test.exs`).
- Eficiencia social/chat: número de consultas por lote/likes, preferencias precargadas obsoletas, keyset con empates al microsegundo y límites inválidos, caducidad por lotes y filas bloqueadas. Benchmark reproducible: [`apps/backend/bench/README.md`](../apps/backend/bench/README.md).
- Eficiencia de Discovery: comparación de filas completas con el SQL anterior para radios/expansión/paginación y exclusión inmediata de swipes. El benchmark seguro `bench/discovery_swipe_probe.exs` usa tablas temporales en una BD local de test verificada, sin truncar tablas persistentes.
- Hotpaths: resumen agregado en un statement, autorización booleana sin hidratar conversación/match y tokens push con proyección mínima e invalidación masiva acotada. Regresiones de reglas/consultas y configuración de lotes/timeouts; `bench/activity_chat_probe.exs` revierte fixtures sintéticos y no acredita una ganancia de latencia estable.
- Fotos: barridos con tamaño validado, marcado batch solo de borrados exitosos y ausencia de UPDATE vacío; reintento de fallos, objetos activos/recientes excluidos e intents completados sin borrar su objeto definitivo. Perfil propio/completitud no hidratan el historial de fotos inactivas.
- Controllers API: auth y login de desarrollo, sesión, config, bootstrap/safety/settings, perfil, fotos y etiquetas, subidas locales, discovery (paginación, ranking, deshacer), API social y visibilidad, matches y chat, push-token, etiquetas.
- Canal de chat: reglas de join, envío, lectura y broadcasts.
- Auth: validación/expiración de tokens REST y WS, rotación y revocación por reuso; proveedores Google/Apple.
- Almacenamiento (local y R2 con respuestas simuladas), cifrado de mensajes, configuración de runtime y `Cherry.Release.seed/0`.
- Verificación de edad: autenticación pasiva con una PKI sintética generada en los tests (`test/support/document_pki.ex`: CSCA → firmante → SOD, DG1/DG2 falsos) y con SOD firmados por `openssl cms` (`test/fixtures/document/`, regenerables con `generate.sh`): RSA PKCS#1 v1.5, RSASSA-PSS, ECDSA con curva nombrada y brainpool con parámetros explícitos, firma inválida, DG manipulado, cadena rota, certificados caducados, extensiones críticas, MRZ TD1/TD3 con dígitos de control (especímenes de ICAO 9303), menores, huella, límite de intentos, API y que los DG no salen en los logs. Los CSCA españoles de `priv/csca` se parsean y autoverifican. Nunca datos de documentos reales.

### Móvil
- Buzón: carga distinta de vacío, error/reintento, solicitud de privacidad conservada tras un fallo, respuesta/recurso humano y aislamiento de borradores/respuestas tardías al cambiar de cuenta; acceso desde el shell antes de completar onboarding.
- Routing: navegación raíz, zona privada, cierre de sesión y runtime config (`test/router/*`).
- Features (`src/features/**/*.test.ts`): sesión (refresh/retry), proveedores y callbacks de auth, onboarding (pasos, reanudación, preferencias, fecha de nacimiento), cola de discovery (optimismo, rollback, deshacer), likes, matches, chat (sesión de socket, mensajes), fotos, ubicación, seguridad, ajustes y pestaña Yo.
- UI (`test/ui/*`): contrato de tokens/tema y componentes (botones, pegatinas, conmutador, campos, hojas, avisos, barra de pestañas).
- Onboarding: la pantalla de bio prueba texto actualizado, CTA estable, doble toque, error/reintento y guardado sin cambios. La caché del perfil/catálogo prueba deduplicación y respuestas obsoletas tras reset o guardado. `TextField` comprueba que escribir no vuelve a renderizar la decoración de foco. Microbenchmark y verificación nativa: [rendimiento](./13-rendimiento.md).
- Sesión: respuestas exitosas tardías se rechazan al cambiar de cuenta o cerrar/reabrir sesión, también por la vía de refresco de token. La regresión integrada comprueba que un guardado de A no invalida la carga pendiente del perfil de B.
- Listas/cargas: paginación de likes frente a refresh, exclusiones locales mientras se lee un snapshot antiguo, deduplicación tras reset y deshacer tras cambio de sesión. Precarga de imágenes compartida con TTL/LRU acotado, reintentos y fallos tardíos; ordenación de chats equivalente con un parseo por fecha. Benchmark de JS: `node scripts/benchmark-matches.mjs`.
- Discovery prueba además que un undo confirmado tras recargar reconcilia decisiones sin contaminar la página nueva y que una precarga fallida no queda suprimida durante toda la sesión; la integración con el prefetcher compartido evita repetir llamadas nativas por solapamientos.
- Chats virtualizados: estados de carga/error/vacío/contenido, paginación manual/scroll sin cascada al montar, 2.400 matches con ventana simulada, reciclaje de labels/callbacks y remonte exclusivo del avatar al cambiar de persona; reloj detenido al perder foco o entrar en background.
- Red/realtime: timeouts con cuerpo colgado, delays inválidos, errores síncronos y limpieza de señales; timeout/cancelación de la subida alternativa y ausencia de progreso tardío. Avisos de leído con backoff/jitter, deduplicación, pendientes, errores terminales, ocultación/dispose y fallo antiguo tras una lectura confirmada por envío. Actividad no consulta en background y se recupera de un adaptador que lanza síncronamente.
- Editor del chat: escribir no vuelve a ejecutar la pantalla/sesión; borradores por conversación sin entradas vacías, sin evicción de texto pendiente y limpios tras logout/cambio de cuenta; envío rechazado/aceptado e ideas. Resumen tardío de reconexión rechazado tras cambiar de cuenta o desmontar, sin perder actualizaciones válidas.
- Dominio del chat: comparación diferencial con el algoritmo previo (1.000 pares de merge × ambos desempates y 500 timelines), coste de parseo/día/sort y pruebas con `TZ=Europe/Madrid` y `TZ=America/New_York`. Benchmark reproducible: `node scripts/benchmark-chat.mjs`, sin equivalencia con FPS nativos.

- Verificación (`src/features/verification`, `modules/document-nfc`): API JS del módulo NFC con el nativo simulado, máquina de estados del flujo y la pantalla de prueba con backend falso. La lectura real por NFC no se puede probar sin documento y móvil (`docs/compliance/02-nfc-pruebas-manana.md`).

### Contracts
- Forma de los DTOs compartidos (session, auth, config, discovery y social).

## Mocks nativos

`apps/mobile/test/mocks/` simula los módulos nativos usados para jsdom (23 mocks): expo (sin módulos nativos: `requireOptionalNativeModule` devuelve `null`, como en web), expo-apple-authentication, expo-application, expo-constants, expo-crypto, expo-device, expo-font, expo-haptics, expo-image, expo-linear-gradient, expo-router (+drawer), expo-secure-store, expo-splash-screen, expo-status-bar, expo-system-ui, flash-list, google-signin, react-native, react-native-gesture-handler, react-native-reanimated, react-native-safe-area-context y react-native-svg. Setup central en `test/setup.ts`.

## Verificación manual

La app solo se ha verificado a mano en **Expo Web** (con capturas en `.impeccable/review/`, fuera de git). Los hápticos, la cámara, el teclado de Android, el login nativo con Google/Apple y el permiso de ubicación nativo no se han probado en un dispositivo real (ver `11-deuda-tecnica-pendiente.md`).

## Datos de demo (solo dev)

`mix run priv/repo/demo_seeds.exs` (con el PostGIS del compose: `DATABASE_URL=ecto://postgres:postgres@localhost:5510/cherry_dev`; se niega a correr fuera de `MIX_ENV=dev` o contra una BD cuyo nombre no termine en `_dev`) crea un escenario realista para probar y capturar todas las pantallas: 53 perfiles sintéticos completos alrededor de Madrid (1–40 km, 20–45 años, hombres, mujeres y personas no binarias, intenciones y etiquetas variadas, 2–4 fotos) más dos cuentas principales:

| Cuenta | Para qué |
|---|---|
| `demo@cherry.dev` (Lucía, 29, relación) | Feed con candidatos, 8 likes recibidos sin responder, 5 matches (2 sin mensajes, 3 conversaciones; dos con mensajes sin leer) y swipes hechos |
| `demo2@cherry.dev` (Hugo, 33, «a ver qué pasa») | Perfil limpio sin interacciones: probar un match en directo entre dos sesiones (Lucía y Hugo se ven en el feed) |

Se entra con `POST /api/auth/dev/test-login` y `{"email": "demo@cherry.dev"}`; cualquier persona sintética también (`<nombre>@demo.cherry.dev`). El script se niega a ejecutarse fuera de `MIX_ENV=dev`, es idempotente (re-ejecutarlo restaura el escenario: fotos, etiquetas e interacciones de las cuentas demo) y crea los mensajes con `Cherry.Dating.send_message/1`, así que quedan cifrados en reposo. Las fotos son URLs externas (retratos de i.pravatar.cc elegidos por género aparente y fotos de ambiente de picsum.photos); hace falta conexión para verlas.

## Huecos conocidos

- Cobertura de renderizado parcial de las pantallas de producto; no sustituye pruebas E2E ni la verificación nativa del onboarding, Descubrir, Likes, Chats y Yo.
- Sin pruebas E2E ni en dispositivo real.

Detalle en `11-deuda-tecnica-pendiente.md`.
