# Decisiones

Registro de decisiones **significativas** de producto y tecnología (no de implementaciones concretas). Cada entrada: fecha, contexto, decisión y motivación. Las decisiones que cambien contratos o rumbo se reflejan también en `docs/`.

Convención: una decisión por entrada, orden cronológico inverso. Solo se anota lo que cambia el rumbo o fija un rumbo importante. Cuando una decisión sustituye a otra, se indica explícitamente; el histórico completo vive aquí, no en `docs/` (que describe solo lo implementado hoy). Si este archivo crece demasiado, evoluciona a carpeta `docs/decisions/` con un archivo por decisión.

---

## D-2026-09-04 — Despliegue del backend: imagen inmutable, migraciones al arrancar y una réplica

- **Decisión:** el backend se publica como imagen Docker inmutable por commit (`ghcr.io/<repo>-backend:<sha>`, con `APP_VERSION` horneada), construida en CI; el servidor solo la descarga. `/healthz` (liveness, devuelve `version`) y `/readyz` (ping a la BD) permiten comprobar que corre exactamente la versión esperada. Las migraciones corren al arrancar, con el lock siempre activo y expand/contract; nunca `ecto.rollback` en producción (se redespliega N−1). Una réplica sin distribución Erlang hasta que haga falta escalar: sin clustering, el PubSub del chat no cruza nodos.
- **Motivación:** despliegues reproducibles y verificables, y vuelta atrás cambiando solo la imagen. Las [reglas de migraciones](./04-modelo-datos.md#reglas-de-migraciones) concretan cómo mantener la compatibilidad.

---

## D-2026-08-21 — Mensajes persistentes con cifrado en reposo (sin relay puro ni E2EE)

- **Contexto:** La app será open source y sin monetización, así que se evaluó convertir el backend en relay puro de mensajería (sin persistir mensajes; historial solo local en cada dispositivo) como bandera de privacidad. El análisis descartó esa vía: un relay puro pierde mensajes para receptores offline salvo que se implementen colas transitorias con ACKs y purga, además de una store local cifrada en móvil con toda la sincronización asociada; degrada la moderación/safety (reportes sin evidencia del servidor) y rompe el historial al cambiar de dispositivo. E2EE real (protocolo tipo Signal) resuelve lo segundo pero añade gestión de claves multi-dispositivo y backups cifrados: complejidad desproporcionada para v1.
- **Decisión:** Mantener el modelo actual — Postgres como fuente de historia (REST paginado + canal WS como transporte en vivo), con matches/conversaciones/mensajes persistidos — y añadir **cifrado en reposo** de los cuerpos de mensaje: los `body` se cifran a nivel de aplicación con una clave gestionada fuera de la base de datos (secreto de entorno/KMS); nada de contenido de mensajes en claro en disco ni backups. Las alternativas quedan registradas como rechazadas para v1: relay puro (pérdida de entrega asíncrona y complejidad de colas/ACKs) y E2EE (evolución futura posible, no compromiso). La narrativa de privacidad del proyecto se apoya en política verificable — código auditable, retención declarada, sin venta de datos, sin ads — no en «no guardamos nada».
- **Motivación:** Mejor producto para el usuario (el historial sobrevive a cambios de dispositivo), safety/moderación intactas y coste mínimo sobre un modelo ya implementado y testeado; el cifrado en reposo neutraliza el escenario de fuga o robo de la base de datos sin tocar contratos ni app.
- **Referencias:** `docs/04-modelo-datos.md` (tabla `messages`), `docs/05-backend-api.md` (chat REST+WS).

---

## D-2026-06-18 — Dirección visual «neobrutal» para la app móvil (en curso)

- **Contexto:** El plan visual de dating (plan de pantallas original, recuperable del historial de git) definía una paleta cálida (Cream/Coral/Mint/Lavender) sobre tokens semánticos. El trabajo en curso de onboarding/discovery aplicó en su lugar un tema «neobrutal» con azul `#3A41E0` como primario (`light-theme.ts`, `tokens/primitives/*`, sin commitear).
- **Decisión:** Avanzar con la dirección neobrutal como tema activo del starter mientras no se retome la paleta dating. La arquitectura de tokens (primitivos → semánticos → temas) no cambia: retematizar sigue siendo editar `themes/` + `tokens/primitives/`.
- **Motivación:** El sistema de temas intercambiables permite cambiar de dirección visual sin tocar componentes. Pendiente de decidir si la paleta dating (Coral) sustituye al neobrutal antes de lanzar las pantallas de producto.
- **Estado:** En curso, sin commitear.

---

## D-2026-05-06 — Contratos mobile-backend v1 para dating

- **Contexto:** Tras el primer pase de backend dating quedaban ambigüedades que bloqueaban el móvil: ciclo de vida del perfil durante onboarding, formato de ubicación, etiquetas de distancia, subida de fotos y semántica de ocultación.
- **Decisión:** Contratos aceptados para v1:
  1. **Draft profiles:** el primer write de onboarding crea un perfil borrador con campos nullable; la validación completa solo ocurre en `POST /api/me/profile/complete`, que devuelve errores estructurados `{error, missing, nextOnboardingStep}`.
  2. **Ubicación:** payload JSON `latitude/longitude/accuracyMeters/recordedAt`; el backend normaliza a una **rejilla de privacidad de 500 m** antes de guardar en PostGIS; ninguna API devuelve coordenadas crudas.
  3. **Distancia:** el backend genera `distanceLabel` y `distanceKmApprox`; el móvil nunca calcula distancia por su cuenta.
  4. **Fotos:** subida directa a R2 con `POST /api/me/photos/upload-intent` (URL firmada SigV4) + `POST /api/me/photos/complete`; Phoenix solo guarda metadatos.
  5. **Ocultar = dislike:** no existe estado separado «hide user» ni endpoint propio.
  6. **Push:** contrato diseñado (`POST /api/me/push-token`) pero implementación después del flujo core.
  7. **Bootstrap:** `GET /api/bootstrap` devuelve `user` + `profile{exists, isComplete, isDiscoverable, isPaused, onboardingRequired, nextOnboardingStep}` y es la fuente de routing del móvil.
- **Motivación:** Fijar los contratos antes de construir pantallas evita rehacer UI. El backend es la fuente de verdad del estado de producto; el móvil solo mantiene estado local transitorio.
- **Referencias:** `docs/06-contratos-mobile-backend.md`; material original en el historial de git.

---

## D-2026-04-28 — Dominio dating en backend con PostGIS y chat WebSocket

- **Contexto:** El discovery necesita filtrado geográfico eficiente y el chat requiere entrega en vivo sobre las sesiones ya resueltas.
- **Decisión:** Contexto `Snack.Dating` con PostgreSQL + PostGIS (`geography(Point,4326)` con índice GiST) para ubicaciones y cálculo de distancias. Chat en tiempo real vía Phoenix Channel (`chat:{conversationId}`) autenticado con el access token JWT validando expiración; REST sigue siendo la fuente de historia.
- **Motivación:** PostGIS da consultas de proximidad indexadas sin infraestructura adicional; el socket de Phoenix reutiliza el mismo token y reglas de sesión que REST.
- **Referencias:** `docs/02-arquitectura.md`, `docs/04-modelo-datos.md`.

---

## D-2026-04-17 — Servicios de auth mock para desarrollo

- **Contexto:** Probar el flujo de sesión en Expo sin configurar Google/Apple nativos ralentiza el desarrollo.
- **Decisión:** Infraestructura de auth con doble implementación: servicios nativos reales y servicios mock seleccionables por entorno, más un endpoint dev `POST /api/auth/dev/test-login` en el backend.
- **Motivación:** Permite desarrollar y testear bootstrap/routing/onboarding end-to-end sin credenciales de provider ni builds nativos.

---

## D-2026-04-13 — Suscripciones Stripe como add-on flaggeado

- **Contexto:** El starter debía incluir monetización opcional sin contaminar la base reutilizable.
- **Decisión:** Módulo `subscriptions` aislado en backend (`Snack.Billing`) y móvil (`features/subscriptions`), activable por feature flag:
  - Cliente Stripe mediante behaviour `StripeClient` (prod = Req, tests = mock), sin SDK.
  - Flags leídos de config por entorno (`config :snack, :features`) y expuestos al móvil en la respuesta de bootstrap/config — única fuente de verdad, nada hardcodeado en cliente.
  - Flag off ⇒ rutas billing 404, cero llamadas a Stripe, entrada de navegación no registrada.
  - UX de pago con Stripe Payment Sheet nativo; planes almacenados localmente y sincronizados desde Stripe por webhooks.
  - Webhooks con verificación HMAC e idempotencia por unique constraint en `stripe_event_id`.
  - `Billing.Customer` con FK a usuario dentro del contexto (no columnas Stripe en `Accounts.User`).
- **Motivación:** Un add-on desactivable limpiamente mantiene el starter reusable para apps sin pagos; el behaviour evita mocks HTTP frágiles; la idempotencia en DB sobrevive reinicios.
- **Nota:** Desviación aceptada registrada: con flag off el webhook responde 404 (el plug de feature corta antes), donde el spec original decía «200 sin procesar».

---

## D-2026-04-13 — Design system con capas de tokens

- **Contexto:** El starter debía ser rebrandeable por app sin reescribir componentes.
- **Decisión:** Tokens primitivos (valores crudos) separados de roles semánticos (surface/primary/text...); los componentes consumen solo semánticos a través de `ThemeProvider`/`useTheme()`; temas intercambiables por contrato. `shared/ui` prohíbe lógica de producto, routing y workflows.
- **Motivación:** Cambiar de marca = editar tokens/tema, no componentes. Evita leakage de producto en la capa reutilizable.
- **Referencias:** `docs/08-identidad-visual.md`.

---

## D-2026-04-13 — Navegación canónica: tabs dueños de rutas, logout como acción

- **Contexto:** Drawer + Tabs anidados pueden duplicar pantallas y deep links.
- **Decisión:** Los Tabs son los únicos dueños canónicos de sus rutas (`home`, `user`); el Drawer solo linkea, nunca registra duplicados. Headers propiedad del layout del Drawer. Logout no es ruta: es acción de presentación que limpia sesión y hace `router.replace` al login. Rutas de módulos opcionales se registran dinámicamente vía registry (`optional-modules.ts`).
- **Motivación:** Una sola pantalla = un solo estado, test y deep link. El registro dinámico permite compilar apps sin el módulo opcional.

---

## D-2026-04-12 — Fundación: monorepo y sesiones propiedad de Phoenix

- **Contexto:** Arranque del proyecto como starter reusable multi-app.
- **Decisión:**
  1. Monorepo pnpm workspaces + Turbo con `apps/mobile`, `apps/backend`, `packages/contracts`, `packages/mobile-shared`; contratos cross-runtime solo en `packages/contracts`. Phoenix single app (no umbrella) con contextos `Accounts` / `Identity` / `Sessions`.
  2. **Phoenix posee la sesión de app**, no Google/Apple: access token corto (JWT con `sub` + `session_id`) + refresh token opaco rotatorio; solo hashes salted en DB con linaje (familia + parent); la rotación es transaccional y la **reutilización de un refresh revoca toda la familia**. Refresh tokens solo en Keychain/Keystore.
  3. Versiones pinned con `.tool-versions` + `.nvmrc`.
- **Motivación:** Control total de emisión/revocación/vinculación de identidades; detección de robo de tokens; menor coste de coordinación que repos separados.
- **Referencias:** `docs/02-arquitectura.md`, `docs/03-modelo-dominio.md`.

---

## Decisiones heredadas de producto dating (2026-04-28)

Fijadas en el foundation de producto dating (2026-04-28, recuperable del historial de git) y vigentes; se listan porque condicionan contratos:

- Auth solo Google/Apple; sin email/password en v1.
- Bio obligatoria 20–240 caracteres; 2–4 fotos activas; máx. 8 tags positivos y 5 bloqueados de catálogo cerrado (~47 tags seedeados).
- `gender` e `interested_in` son conceptos separados; `interested_in` multi-selección.
- `what_i_am_looking_for` único valor requerido (relationship/casual/meet_people/go_with_the_flow).
- Match solo por like mutuo; sin undo; match expira a los 7 días sin primer mensaje; chat solo texto.
- Likes ilimitados (sin caps de monetización) con protección anti-abuso técnica.
- Compatibilidad pesa más que distancia; la distancia se expande gradualmente si hay poca oferta; jamás se ignoran blocked tags ni compatibilidad de género.
- Boost temporal controlado para usuarios nuevos.

## D-2026-09-05 — Correcciones de acceso, discovery y fotos

- El borrado de cuenta sigue siendo lógico: `users.deleted_at`, perfil oculto, sesiones/refresh/push revocados y sockets desconectados. Un bloqueo impide mensajear en ambas direcciones, incluidas conexiones abiertas.
- Discovery puntúa en PostgreSQL y pagina por `(score DESC, id ASC)`. Cursor firmado y ligado al usuario (1 h); exploración determinista por pareja. Se mantiene el DTO `nextCursor: string | null` y los filtros se vuelven a evaluar por petición.
- Fotos: firma de `Content-Type` e `If-None-Match: *`, verificación autenticada de existencia/tamaño/MIME/cabecera y lectura condicionada por ETag. Se retira la creación directa de metadatos por REST. La migración de fotos caduca intents antiguos pendientes para exigir URLs que no permitan sobrescritura.
- El despliegue requiere ambas migraciones `20260905170000` y `20260905170100`. La primera desactiva también cuentas cuyos perfiles ya estaban borrados; la segunda obliga a repetir las subidas pendientes antiguas. No se purgan datos ni se reactiva ninguna credencial al revertir las migraciones.
