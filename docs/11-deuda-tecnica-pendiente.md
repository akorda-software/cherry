# Deuda técnica pendiente

Huecos conocidos entre producto, contratos, documentación y código a 2026-09-29, tras el rediseño «Libreta kawaii» y su revisión. Ordenados por impacto dentro de cada bloque. Lo ya resuelto no se lista aquí: está en `progress.md`, `decisions.md` y el historial de git.

## Móvil

1. **Sin notificaciones push.** La app no registra token (`POST /api/me/push-token` no se usa; no depende de `expo-notifications`) ni gestiona la recepción o la apertura de una notificación. El backend ya envía los avisos de match y mensaje nuevos (`Snack.Notifications`), así que hoy no llega ninguno.
2. **Verificada solo en Expo Web.** Hápticos, cámara y galería, teclado en Android, permiso de ubicación nativo, login nativo con Google/Apple y el socket del chat en redes móviles no se han probado en un dispositivo real. Falta una pasada en Android e iOS antes de cualquier prueba con personas.
3. **Ubicación congelada tras el onboarding.** Solo se envía en el paso de ubicación: no se refresca al abrir la app (como pide `01-requisitos-producto.md`) y no hay forma de cambiarla desde Yo o Ajustes. Quien se muda sigue viendo gente de su zona antigua.
4. **Sin modo oscuro.** `userInterfaceStyle: "light"` y un único tema (`light-theme.ts`); no se usa `useColorScheme`. La arquitectura de tokens admite un segundo tema con el mismo contrato (`createTheme`).
5. **Sin estado «sin conexión».** Descubrir y el resto de pantallas tratan un fallo de red como error genérico con reintento; no hay detección de conectividad.
6. **Expo Go no sirve para entrar.** En Expo Go no se crean servicios de login y la app se queda en la pantalla de carga (deducido del código). Hace falta un build de desarrollo, Expo Web con el login de desarrollo o `EXPO_PUBLIC_MOCK_AUTH=true`.
7. **«Continuar con Apple» también se muestra en web**, donde Sign in with Apple nativo no está disponible (la condición es `Platform.OS !== "android"`).
8. **Sin tests de renderizado de las pantallas de producto** (onboarding, Descubrir, Likes, Chats, Yo): se prueban dominio, stores y componentes del sistema de diseño.
9. **Acerca de no menciona la licencia del software (AGPL-3.0)**, solo la de las fuentes; el enlace «Ver el código» depende de compilar con `EXPO_PUBLIC_SOURCE_URL`.
10. El selector de edad de Filtros llega a 99; el backend admite hasta 100.

## Backend

1. **Admin sin rutas ni vistas.** Los reportes se guardan (`reports`) y existen `list_reports/2`, `update_report/2` y `disable_profile/1`, pero no hay forma de revisarlos salvo consultando la base de datos. Con usuarios reales, la moderación no escala.
2. **Borrar la cuenta no purga los datos.** Solo se borran físicamente las fotos. Cuenta, identidad del proveedor, email, perfil (nombre, fecha de nacimiento, bio, última ubicación aproximada), swipes, matches, mensajes (cifrados) y reportes se conservan sin plazo. Falta una política de retención y un borrado real (o anonimización) tras un periodo de gracia. Consecuencia actual: la misma cuenta de Google/Apple no puede volver a registrarse.
3. **Anti-abuso activo pendiente.** No hay rate limiting de swipes, de login (`/api/auth/:provider/callback`) ni de refresh, ni límites a la creación de cuentas, ni flags de usuarios sospechosos. Las únicas protecciones son las de subida de fotos, ubicación y reportes. Tampoco hay plug `RemoteIp`: detrás de un proxy, la IP que ve Phoenix es la del proxy.
4. **Métricas sin capturar.** Existe `analytics_events` y `Snack.Dating.track_event/1`, pero nada lo llama: no se registra ningún evento de producto.
5. **Índices sin `CONCURRENTLY` sobre `swipe_actions`.** `20260929113715_discovery_ranking_v2` (`swipe_actions_likes_received_index`) y `20260929154521_add_dislikes_received_index` crean índices normales, que bloquean escrituras en `swipe_actions` mientras se construyen. Inocuo en el primer despliegue (tabla vacía y `stop-first`); con una tabla grande ya en producción habría que usar `migration_lock: :pg_advisory_lock` y una migración propia con `@disable_ddl_transaction true` (detalle en `infra/deploy/README.md` §6).
6. **`decimal` 2.4.1.** El arreglo del aviso conocido está en 3.x y `ecto 3.13` exige `~> 2.0`: actualizar cuando Ecto lo admita. El resto de dependencias se actualizó el 2026-09-29.
7. **Coste del feed lineal en candidatos** (unos 20–25 µs cada uno; 10–42 ms p50 con 3.000–10.000 perfiles). Con decenas de miles de candidatos en un mismo radio habrá que precalcular (cola de candidatos o estadísticas de atención por perfil).
8. **`compatible_only` simétrico, pendiente de validar con el propietario.** Hoy, si cualquiera de los dos lo activa, se exige una etiqueta en común en ambos sentidos (D-2026-09-29, ranking v2).
9. **Una sola réplica.** Sin clúster de Erlang (libcluster) el PubSub del chat no cruza nodos: no se puede escalar horizontalmente el backend.
10. **Fotos sin moderación.** Se verifican existencia, tamaño, MIME y cabecera binaria; no hay decodificación completa ni moderación de contenido.

## Documentación e infraestructura

1. **Sin `eas.json`** ni pipeline de build móvil: la compilación de la app para las tiendas es manual (`12-self-hosting.md` §8).
2. `docs/starter-guide.md` sigue en inglés y describe el starter genérico, no el producto.
