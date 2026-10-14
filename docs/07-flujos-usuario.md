# Flujos de usuario

Pantallas y recorridos **implementados hoy** en la app móvil (`apps/mobile/app` y `apps/mobile/src/features`). Los textos entre comillas son los de la interfaz. Lo pendiente está en `10-plan-fases.md` y `11-deuda-tecnica-pendiente.md`; el sistema visual, en `08-identidad-visual.md`.

## Mapa de rutas

```
app/
├── _layout.tsx                 # raíz: fuentes + splash, tema, config (/api/config), sesión, bootstrap, avisos
├── index.tsx                   # decide: login | onboarding | Descubrir (espera al bootstrap)
├── +not-found.tsx              # «Esta página se ha perdido» → «Volver al inicio»
├── (public)/login              # bienvenida y login
├── (onboarding)/               # guard: sin sesión → login; perfil ya hecho → Descubrir
│   ├── index                   # calcula el paso donde reanudar y apila los anteriores
│   └── name → birthday → gender → interested → intent → photos
│       → tags → bio → location → done
├── (app)/                      # guard: sesión + bootstrap; onboardingRequired → onboarding
│   ├── (tabs)/discover         # «Descubrir»
│   ├── (tabs)/likes            # «Likes»
│   ├── (tabs)/chats            # «Chats»
│   ├── (tabs)/me               # «Yo»
│   ├── profile/[id]            # perfil completo de otra persona
│   ├── chat/[id]               # conversación (id = conversationId)
│   ├── filters                 # modal «Filtros»
│   ├── edit/{photos,tags,bio,basics}
│   ├── settings                # «Ajustes»
│   └── about                   # «Acerca de Cherry»
└── (dev)/{kitchen-sink,art}    # escaparates del sistema de diseño; fuera de __DEV__ redirigen a /
```

La zona privada monta una sola vez `AppOverlays`: el sondeo de contadores de las pestañas y la celebración de match.

## Arranque y routing

1. La app resuelve la URL de la API desde la configuración de Expo (`EXPO_PUBLIC_API_BASE_URL_ANDROID/IOS/WEB`; por defecto `http://10.0.2.2:4000` en Android, `http://localhost:4000` en iOS y el mismo origen en web).
2. `GET /api/config` → flags (si falla, flags vacíos).
3. Con sesión guardada, `GET /api/bootstrap`.
4. `app/index.tsx` decide: sin sesión → login; `onboardingRequired` → onboarding; si no → Descubrir. Si el bootstrap falla con sesión activa: «No hemos podido abrir tu libreta…» con reintento.

Servicios de sesión según el entorno: build nativo → Google y Apple nativos; `EXPO_PUBLIC_MOCK_AUTH=true` → sesión falsa con perfil completo (solo para trabajar la interfaz); en Expo Go no hay servicios de login (el login nativo necesita un build de desarrollo).

## Bienvenida y login

- Todo sobre el mismo amarillo de marca, sin hoja ni tarjeta: una luz suave que respira detrás de Mochi enamorada (el logo), la palabra «cherry», el titular «Conoce gente cerca de ti.» y, abajo, «Entra o crea tu cuenta» con los botones incrustados en el fondo. Por detrás suben muy despacio corazones y cerecitas tenues; las piezas entran escalonadas (logo → nombre → titular → botones) cuando se funde el splash. Con «reducir movimiento», todo quieto. Esta pantalla no es neobrutalista: sin contornos de tinta ni sombras duras.
- **«Continuar con Google»** (la «G» de cuatro colores sobre blanco) y **«Continuar con Apple»** (negro): Apple funciona en iOS; en Android y en web se ve hundido en el amarillo (un velo tenue, sin sombra), deshabilitado y con «Próximamente».
- Atajos de **«Pruebas»** (solo con `__DEV__` o `EXPO_PUBLIC_TEST_LOGIN=true`), discretos bajo los botones: «Nuevo» (email desechable, onboarding desde cero), «Lucía» (`demo@cherry.dev`) y «Hugo» (`demo2@cherry.dev`), de `demo_seeds.exs`. Usan `POST /api/auth/dev/test-login`; si el servidor lo tiene desactivado: «El acceso de pruebas está desactivado en este servidor.».
- La credencial del proveedor viaja a `POST /api/auth/:provider/callback`; Phoenix emite la sesión, que se guarda en el almacenamiento seguro. Después se vuelve a `/` y el bootstrap decide.
- Errores en una tarjeta con texto amable; cancelar la hoja del proveedor no muestra nada. Una cuenta borrada por otro motivo que no sea la propia persona ve «Esta cuenta se borró y ya no se puede usar para entrar.»; quien borró la suya y vuelve entra con una cuenta nueva.

## Onboarding (11 pasos)

Marco común: barra «Paso N de 11», atrás en todos los pasos salvo el primero y el último, y una acción fija abajo. Cada paso guarda en el backend al continuar.

| # | Paso | Qué pide | Reglas en la UI | Llamada |
|---|---|---|---|---|
| 1 | Nombre | «¿Cómo te llamas?» (precarga el nombre de la cuenta; «¿No es tu cuenta? Salir» cierra sesión) | 1–50 caracteres | `PUT /api/me/profile` |
| 2 | Cumpleaños | «¿Cuándo naciste?» con día/mes/año y pegatina «Tienes N años» | Fecha real, 18+ | `PUT /api/me/profile` |
| 3 | Género | «¿Cómo te identificas?»: Hombre / Mujer / No binario | Un toque elige y avanza | `PUT /api/me/profile` |
| 4 | A quién | «¿A quién quieres conocer?»: Mujeres / Hombres / Personas no binarias | Al menos una | `PUT /api/me/discovery-preferences` (la primera vez crea edad según la tuya, 50 km, ampliar distancia y modo swipe; ante un 422 reintenta con esos valores) |
| 5 | Intención | «¿Qué buscas?»: Relación / Algo casual / Conocer gente / A ver qué pasa (puedes elegir varias) | Tocar marca o desmarca; «Continuar» con al menos una | `PUT /api/me/profile` (`looking_for`) |
| 6 | Fotos | «Tus mejores fotos» desde la galería o la cámara; se suben al momento | 2–4 fotos | upload-intent → `PUT` → complete; borrar y reordenar |
| 7 | Etiquetas | «Tus etiquetas»: rejilla de fichas con + (me gusta) y − (bloquear) en la misma página | 3–8 con +; hasta 5 con − (opcional); nunca las dos a la vez | `GET /api/tags`, `PUT /api/me/tags`, `PUT /api/me/blocked-tags` |
| 8 | Descripción | «Tu descripción»: campo grande con contador; ideas opcionales plegadas en «¿Sin ideas?» | 20–240 caracteres | `PUT /api/me/profile` |
| 9 | Ubicación | «¿Por dónde andas?» («Redondeamos tu ubicación a 500 m.») | Obligatoria, no se puede saltar | `POST /api/me/location` |
| 10 | Listo | Confirmación | — | `POST /api/me/profile/complete` |

**Ubicación.** «Compartir mi ubicación» pide el permiso de primer plano. Si se deniega: «Sin tu zona no podemos enseñarte gente cerca. ¿Lo intentamos otra vez?». Si está bloqueado en el sistema: «Abrir Ajustes» y, al volver con el permiso concedido, reintenta sola. Si ya había una ubicación guardada, se puede continuar o «Actualizar mi ubicación».

**Listo.** Relee el perfil; si falta algo, avisa («Nos falta un detallito…») y vuelve al paso que falta. Si no, confirma con `POST /api/me/profile/complete` (un `profile_incomplete` se traduce también al paso que falta). Éxito: Mochi celebrando, «¡Tu perfil está listo!» y «¡A descubrir!». El atrás de Android se bloquea mientras confirma y una vez completado; en iOS el gesto está desactivado en este paso.

**Reanudar.** Al volver a entrar, `(onboarding)/index` lee el perfil y va al primer paso obligatorio sin resolver, en el orden del flujo (para las etiquetas basta 1 positiva, como en el backend). Si no puede leer el perfil, usa el `nextOnboardingStep` del bootstrap.

## Descubrir

Cabecera con el logo, el conmutador **«Swipe» | «Feed»** y el acceso a Filtros. El modo se guarda en `discoveryMode` (`PUT /api/me/discovery-preferences`); el feed es el mismo en los dos modos. Ambos comparten una sola cola: `GET /api/discovery/feed` en páginas de 20, con precarga de la siguiente y de las imágenes. Like y «no» son optimistas (`POST /api/discovery/actions`) y, si falla la red, la tarjeta vuelve con un aviso.

- **Swipe.** Tarjeta polaroid con cinta washi: foto, pegatina con nombre y edad, hasta 3 insignias («Nuevo», «Te ha dado like», «N en común», «Un poco más lejos»), etiquetas en común, intención y distancia. Arrastrar a los lados decide; hacia arriba o tocar bajo la foto abre el perfil; tocar los lados de la foto cambia de foto. Botones ✕ «Paso», ↺ «Deshacer el último no» y ♥ «Me gusta».
- **Feed.** Lista vertical de publicaciones con carrusel de fotos, resumen del perfil, ✕, «Ver perfil» y ♥. Al decidir cae un sello («¡Me gusta!» o «Paso») y la publicación se pliega.
- **Deshacer (solo en swipe).** Recupera el último «no» si tiene menos de 10 minutos (`POST /api/discovery/undo`). Si no hay nada: «Nada que deshacer por aquí…». Si esa persona ya no es visible: «Deshecho, pero esa persona ya no está disponible.». Tras cambiar los filtros no se puede deshacer hasta la siguiente decisión.
- **Match.** Celebración global (desde swipe, feed, perfil o Likes): dos polaroids que se juntan, sello «¡Match!», «A {nombre} también le gustas.». **«Decir hola»** abre el chat; **«Seguir mirando»** cierra. Varios matches seguidos se muestran en cola.
- **Estados.** Cargando: esqueletos. Sin más perfiles: «Ya has visto a todo el mundo por aquí 🌸» con «Ampliar filtros» y «Volver a intentarlo». En pausa: «Tu perfil está en pausa» con «Reanudar mi perfil». Perfil incompleto (403): vuelve al onboarding. Error: «No hemos podido traer perfiles» con reintento. No hay estado específico de «sin conexión».

### Filtros

Modal «Filtros» («Gratis, como todo aquí. En otras apps esto se paga.»): rango de edad, distancia (10 / 25 / 50 / 100 km o «Sin límite»), a quién quieres conocer (nunca vacío), «Enseñarme gente algo más lejos si se acaban» (`expandDistance`) y «Solo personas con etiquetas en común» (`compatibleOnly`). «Guardar filtros» guarda con `PUT /api/me/discovery-preferences` y recarga la cola («Filtros guardados. Buscando gente nueva…»).

### Perfil completo

`profile/[id]` enseña al instante lo que ya se tenía y lo refresca con `GET /api/profiles/:id` (si ya no es visible: «Este perfil ya no está disponible»). Abajo: «Enviar mensaje» si ya hay conversación; «Le has dado like…» si ya se lo diste; si no, ✕ y ♥, con el aviso «A {nombre} le gustas: si le das like, es match» cuando corresponde. El ⋯ de la cabecera abre la hoja de seguridad.

### Bloquear y reportar

Desde el ⋯ del perfil completo y desde el menú del chat (no desde la tarjeta de swipe ni el feed). «Reportar a {nombre}» con motivo (Perfil falso, Fotos inapropiadas, Acoso o amenazas, Spam o estafa, Parece menor de edad, Bio ofensiva, Otro motivo) y detalles opcionales → `POST /api/users/:id/report`; después ofrece bloquear también. «Bloquear a {nombre}» → «Sí, bloquear» (`POST /api/users/:id/block`): «Has bloqueado a {nombre}. No volveréis a veros.».

## Likes

«Les gustas» — «Aquí no escondemos nada…». Rejilla de polaroids con quienes te han dado like y aún no has respondido (`GET /api/likes/received`, paginado): foto, nombre, «N en común» y el sello «¡Te ha dado like!». Tocar abre el perfil.

- ♥ → match al instante (misma celebración).
- ✕ → nota «Has pasado de X · Deshacer» durante 5 segundos (deshacer con `POST /api/discovery/undo`).
- Refresco al tirar hacia abajo y al volver a la pestaña. Vacío: «Todavía no hay likes, pero llegarán» con «Retocar mi perfil».
- Con el perfil en pausa la lista se ve, pero responder devuelve la tarjeta a su sitio con el aviso «Tu perfil está en pausa. Reanúdalo en Yo para responder a los likes.».

## Chats

**Lista** (`GET /api/matches`): fila «Nuevos matches» (matches sin mensajes, con «quedan N días» cuando faltan 7 o menos para que caduquen) y sección «Mensajes» por actividad, con vista previa («Tú: …»), hora y contador de no leídos. Sin matches: «Aún no tienes matches» con «Ir a Descubrir».

**Conversación** (`chat/[id]`):

- Historial por REST (`GET /api/conversations/:id/messages`, hacia atrás) con separadores por día.
- En vivo por el canal Phoenix `chat:{conversationId}` (`new_message`, `typing`). Reconexión con espera creciente (hasta 8 s), refresco del token y recuperación por REST de lo perdido; «Reconectando…» si tarda más de 3 s. Al pasar a segundo plano se suelta el socket.
- Envío optimista por el canal (o por REST si no está unido), con reintento automático y luego manual. «Escribiendo…» transitorio.
- Se marca como leída (`POST /api/conversations/:id/read`) al abrir y al recibir mensajes con la pantalla visible.
- Conversación vacía: rompehielos basados en las etiquetas en común. Composer «Escribe algo bonito…»; el borrador se guarda por conversación mientras la app está abierta.
- Menú ⋯: «Ver perfil», «Deshacer match» (confirmación; `POST /api/matches/:id/unmatch`) y «Reportar o bloquear».
- Conversación cerrada (unmatch, caducada, bloqueo, cuenta borrada): «Esta conversación ya no está disponible.» con el composer sustituido por un candado.

## Yo

- «Así te ven»: vista previa de tu propia tarjeta y nota de fuerza del perfil con accesos a lo que falta.
- Si estás en pausa: «Estás en pausa. Nadie nuevo te ve, pero tus chats siguen aquí.» con «Reanudar».
- **Tu perfil:** «Fotos» (`edit/photos`: misma rejilla que el onboarding, se guarda al momento, nunca menos de 2), «Mis etiquetas» (`edit/tags`: «Así soy yo» y «No va conmigo», mínimo 3 positivas, máximos 8 y 5), «Sobre mí» (`edit/bio`) y «Lo básico» (`edit/basics`: nombre, género e intención; la fecha de nacimiento se ve pero no se edita). Las pantallas de edición avisan antes de salir sin guardar.
- «Filtros de búsqueda» abre el modal de Filtros.
- **Visibilidad:** «Pausar mi perfil» (`POST /api/me/pause` / `unpause`).

La ubicación se refresca sola: con el perfil completo, al abrir la app y al volver a primer plano, si el permiso ya está concedido (nunca se pide ahí) se reenvía la posición a `POST /api/me/location`, como mucho una vez cada 30 min y sin avisos ni errores visibles; tras cerrar sesión no se envía nada. También se puede actualizar a mano desde Ajustes.

## Ajustes y Acerca de

- **Cuenta:** tu correo y «Cerrar sesión» (`DELETE /api/session`; la sesión local se borra aunque falle la llamada).
- **Visibilidad:** «Pausar mi perfil».
- **Privacidad y seguridad:** «Actualizar mi ubicación» (pide el permiso si hace falta; si está bloqueado, la fila pasa a «Activar la ubicación en Ajustes» y reintenta sola al volver; toast «Ubicación actualizada» y, si Descubrir ya tenía perfiles cargados, se recarga con la nueva zona) y filas informativas sobre la ubicación aproximada, el bloqueo y los reportes.
- **Acerca de Cherry:** por qué es gratis, qué no hace y qué sí, código abierto y la versión. El botón «Ver el código» solo aparece si la app se compiló con `EXPO_PUBLIC_SOURCE_URL`.
- **Borrar cuenta:** hoja «¿Borrar tu cuenta?» con las consecuencias y la sugerencia de pausar; hay que mantener pulsado el botón. `DELETE /api/me/account`, cierre de sesión y vuelta a la bienvenida («Nos da pena verte ir, pero lo entendemos 💜»).
- No hay ajustes de notificaciones, tema ni idioma.

## Contadores de las pestañas

`GET /api/me/summary` al entrar, al volver a primer plano y cada 45 s con la app activa. Likes = likes pendientes; Chats = conversaciones con mensajes sin leer + matches nuevos sin abrir. Las acciones locales los ajustan al momento y se ponen a cero al cerrar sesión.
