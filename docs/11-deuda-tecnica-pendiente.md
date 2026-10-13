# Deuda técnica pendiente

Huecos conocidos entre producto, contratos, documentación y código a 2026-09-29, tras el rediseño «Libreta kawaii» y su revisión. Ordenados por impacto dentro de cada bloque. Lo ya resuelto no se lista aquí: está en `progress.md`, `decisions.md` y el historial de git.

## Móvil

1. **Sin notificaciones push.** La app no registra token (`POST /api/me/push-token` no se usa; no depende de `expo-notifications`) ni gestiona la recepción o la apertura de una notificación. El backend ya envía los avisos de match y mensaje nuevos (`Cherry.Notifications`), así que hoy no llega ninguno.
2. **Verificada solo en Expo Web.** Hápticos, cámara y galería, teclado en Android, permiso de ubicación nativo, login nativo con Google/Apple y el socket del chat en redes móviles no se han probado en un dispositivo real. Falta una pasada en Android e iOS antes de cualquier prueba con personas.
3. **Sin modo oscuro.** `userInterfaceStyle: "light"` y un único tema (`light-theme.ts`); no se usa `useColorScheme`. La arquitectura de tokens admite un segundo tema con el mismo contrato (`createTheme`).
4. **Sin estado «sin conexión».** Descubrir y el resto de pantallas tratan un fallo de red como error genérico con reintento; no hay detección de conectividad.
5. **Expo Go no sirve para entrar.** En Expo Go no se crean servicios de login y la app se queda en la pantalla de carga (deducido del código). Hace falta un build de desarrollo, Expo Web con el login de desarrollo o `EXPO_PUBLIC_MOCK_AUTH=true`.
6. **«Continuar con Apple» también se muestra en web**, donde Sign in with Apple nativo no está disponible (la condición es `Platform.OS !== "android"`).
7. **Sin tests de renderizado de las pantallas de producto** (onboarding, Descubrir, Likes, Chats, Yo): se prueban dominio, stores y componentes del sistema de diseño.
8. El enlace «Ver el código» de «Acerca de» solo aparece si se compila con `EXPO_PUBLIC_SOURCE_URL` o el servidor define `INSTANCE_SOURCE_URL`.
9. El selector de edad de Filtros llega a 99; el backend admite hasta 100.
10. **Lectura NFC del DNI sin probar en hardware** (`modules/document-nfc`, rama `feat/dni-nfc`). Android compila; iOS no se ha compilado nunca. Pendientes y guía: `compliance/02-mayoria-de-edad.md` («Estado del prototipo») y `compliance/02-nfc-pruebas-manana.md`.

## Backend

1. **Admin sin rutas ni vistas.** Los reportes se guardan (`reports`) y existen `list_reports/2`, `update_report/2` y `disable_profile/1`, pero no hay forma de revisarlos salvo consultando la base de datos. Con usuarios reales, la moderación no escala.
2. **Borrar la cuenta no purga los datos.** Solo se borran físicamente las fotos. Cuenta, identidad del proveedor, email, perfil (nombre, fecha de nacimiento, bio, última ubicación aproximada), swipes, matches, mensajes (cifrados) y reportes se conservan sin plazo. Falta una política de retención y un borrado real (o anonimización) tras un periodo de gracia. Consecuencia actual: la misma cuenta de Google/Apple no puede volver a registrarse.
3. **Anti-abuso activo pendiente.** No hay rate limiting de swipes, de login (`/api/auth/:provider/callback`) ni de refresh, ni límites a la creación de cuentas, ni flags de usuarios sospechosos. Las únicas protecciones son las de subida de fotos, ubicación y reportes. Tampoco hay plug `RemoteIp`: detrás de un proxy, la IP que ve Phoenix es la del proxy.
4. **Métricas sin capturar.** Existe `analytics_events` y `Cherry.Dating.track_event/1`, pero nada lo llama: no se registra ningún evento de producto.
5. **Índices sin `CONCURRENTLY` sobre `swipe_actions`.** `20260929113715_discovery_ranking_v2` (`swipe_actions_likes_received_index`) y `20260929154521_add_dislikes_received_index` crean índices normales, que bloquean escrituras en `swipe_actions` mientras se construyen. Inocuo en el primer despliegue (tabla vacía y `stop-first`); con una tabla grande ya en producción habría que usar `migration_lock: :pg_advisory_lock` y una migración propia con `@disable_ddl_transaction true` (detalle en `04-modelo-datos.md`, «Reglas de migraciones»).
6. **`decimal` 2.4.1.** El arreglo del aviso conocido está en 3.x y `ecto 3.13` exige `~> 2.0`: actualizar cuando Ecto lo admita. El resto de dependencias se actualizó el 2026-09-29.
7. **Coste del feed lineal en candidatos** (unos 20–25 µs cada uno; 10–42 ms p50 con 3.000–10.000 perfiles). Con decenas de miles de candidatos en un mismo radio habrá que precalcular (cola de candidatos o estadísticas de atención por perfil).
8. **`compatible_only` simétrico, pendiente de validar con el propietario.** Hoy, si cualquiera de los dos lo activa, se exige una etiqueta en común en ambos sentidos (D-2026-09-29, ranking v2).
9. **Una sola réplica.** Sin clúster de Erlang (libcluster) el PubSub del chat no cruza nodos: no se puede escalar horizontalmente el backend.
10. **Fotos sin moderación.** Se verifican existencia, tamaño, MIME y cabecera binaria; no hay decodificación completa ni moderación de contenido.
11. **Verificación de edad sin hacer obligatoria del todo.** `AGE_VERIFICATION_REQUIRED` bloquea la API REST social, pero no excluye de los feeds a los perfiles sin verificar ni se comprueba en el WebSocket del chat; tampoco se consulta la CRL de la Policía. Detalle en `compliance/02-mayoria-de-edad.md`.

## Instancias en otros países

Lo que depende de la infraestructura y de la instancia ya se configura con variables de entorno (`12-self-hosting.md` §4, §8 y §10). Queda en el código:

1. **App solo en español, sin i18n.** Todos los textos están escritos en los componentes (no hay catálogo de traducciones ni `expo-localization`), con formato de fecha español (`chat/domain/time-format.ts`, 24 h) y comparaciones con `"es"` (`localeCompare`, `Intl.Segmenter`). `INSTANCE_LOCALE` solo cambia el idioma del flujo de Didit. Traducir exige extraer los textos primero.
2. **Textos del backend en español.** Notificaciones push (`Cherry.Notifications`), etiquetas de distancia del feed («Cerca de ti», «A unos 15 km», `CherryWeb.ProfileCardJSON`) y los nombres del catálogo de etiquetas (`Cherry.Dating.TagCatalog`). Van con la traducción de la app.
3. **Verificación con textos españoles.** La app habla de DNI, TIE y CAN («Con tu DNI y el NFC del móvil», dibujos del DNI) y los textos de permisos de NFC nombran el DNI. Los mensajes de documento no admitido siguen ofreciendo DNI, TIE y pasaporte aunque `AGE_VERIFICATION_DOCUMENTS` excluya alguno, y la app no oculta la opción «Tengo pasaporte». En otro país hay que adaptarlos con la traducción.
4. **La edad mínima solo llega a parte de la app.** `AGE_VERIFICATION_MINIMUM_AGE` la aplica el backend (documento y perfil) y la app la usa en el paso de la fecha de nacimiento, pero varios textos dicen «18 años» (verificación, motivos de reporte) y los selectores de edad de preferencias y filtros empiezan en 18 (el backend también acepta 18 como mínimo del filtro). Con un mínimo mayor el resultado es correcto (nadie por debajo puede completar el perfil), pero esos textos y rangos no lo reflejan.
5. **Huella de documento con regla solo española.** El número estable (DNI/NIE) solo se usa para tarjetas emitidas por España (`Mrz.personal_number/3`, `Fingerprint`). Las tarjetas de otros países usan el número de la tarjeta, que en muchos cambia al renovarse: con una tarjeta nueva, la misma persona podría abrir otra cuenta. Añadir la regla de cada país es código (no configuración) y no se puede cambiar después de abrir.
6. **`INSTANCE_COUNTRY` es informativo.** No restringe registros por país (la ubicación no se comprueba contra él) ni qué Estados emisores se aceptan; eso último lo deciden los CSCA de confianza (NFC) y el workflow de Didit.
7. **Sin zona horaria de instancia.** El backend calcula edades y fechas en UTC y la app formatea con la zona del dispositivo; una variable de zona horaria no tendría a quién aplicarse. Efecto conocido: cerca de la medianoche del cumpleaños, la edad puede ir unas horas por detrás de la hora local (el mismo criterio en app y backend).
8. **Unidades y límites fijos.** Distancias en km (`DiscoveryPreference`: 10, 25, 50, 100 o sin límite), caducidad de matches (30 días, `:match_expiry_days` en `config.exs`), límites de subida de fotos (4 vivas, 20 por hora) e intentos de verificación (5/hora, 10/día, `:attempt_limits`). No se han expuesto como variables porque no dependen del país; se cambian en `config.exs` o en el módulo.
9. **Legal y tiendas, fuera del código.** Los textos legales no viven en el repositorio (solo sus URLs, `INSTANCE_PRIVACY_URL` e `INSTANCE_TERMS_URL`); la app aún no los enlaza durante el registro, solo en «Acerca de». El país de distribución se elige en cada tienda. La pantalla web de Phoenix (`/`) sigue siendo la de ejemplo de Phoenix.
10. **Datos de demo en Madrid.** `DEMO_CENTER` traslada las coordenadas, pero bios y conversaciones hablan de Madrid.

## Documentación e infraestructura

1. **Sin `eas.json`** ni pipeline de build móvil: la compilación de la app para las tiendas es manual (`12-self-hosting.md` §8).
2. `docs/starter-guide.md` sigue en inglés y describe el starter genérico, no el producto.
