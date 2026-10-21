# Decisiones

Registro de decisiones **significativas** de producto y tecnología (no de implementaciones concretas). Cada entrada: fecha, contexto, decisión y motivación. Las decisiones que cambien contratos o rumbo se reflejan también en `docs/`.

Convención: una decisión por entrada, orden cronológico inverso. Solo se anota lo que cambia el rumbo o fija un rumbo importante. Cuando una decisión sustituye a otra, se indica explícitamente; el histórico completo vive aquí, no en `docs/` (que describe solo lo implementado hoy). Si este archivo crece demasiado, evoluciona a carpeta `docs/decisions/` con un archivo por decisión.

---

## D-2026-10-21b — PostgreSQL 18

- **Decisión:** la base de datos pasa de PostgreSQL 17 a **18** (con PostGIS 3.6) en la instancia oficial, en CI y en el compose de desarrollo, con las sumas de verificación de datos activadas. Se hace ahora, antes del lanzamiento, mientras la base es pequeña y la parada dura segundos.
- **Motivación:** E/S asíncrona, conserva las estadísticas del planificador al actualizar de versión y mejoras de índices; la 17 tenía soporte hasta 2029, así que no era urgente, pero después costaría más. La 19 se deja para cuando lleve una o dos versiones de corrección y PostGIS la soporte del todo.

---

## D-2026-10-21 — NFC sin foto, sin permisos de residencia y Didit con máximo mensual

- **NFC sin foto:** la lectura NFC solo coge DG1 (MRZ) y el SOD; la foto del chip (DG2) no se lee ni se envía, y el servidor ignora la que manden apps antiguas. Para la edad basta la fecha firmada por el Estado. Se aplaza la comparación selfie ↔ DG2 prevista en D-2026-10-09: con un selfie y una prueba de vida, el alta deja de ser casi instantánea, y la comparación con la foto del chip es poco fiable y delicada (licencias de los modelos, datos biométricos del art. 9). Se acepta que el NFC prueba un documento auténtico de un adulto, no que quien usa el móvil sea su titular; lo limita «un documento, una cuenta». Se podrá retomar si el volumen de usuarios hace asumible más fricción.
- **Documentos:** se aceptan DNI y documentos de identidad de otros países y pasaportes. Los permisos de residencia (TIE y similares) se rechazan por los dos métodos; quien tenga TIE usa su pasaporte. `AGE_VERIFICATION_DOCUMENTS` admite `residence_permit` para instancias que los quieran.
- **Máximo mensual de Didit:** cada sesión cuesta dinero (unos 0,10–0,30 €). Hasta cerrar condiciones con Didit, la instancia oficial permite 400 sesiones nuevas al mes (`DIDIT_MONTHLY_LIMIT`, mes natural en UTC). Al llegar, solo queda el NFC hasta el mes siguiente; las sesiones ya empezadas se resuelven igual.
- **Sustituye:** en parte a D-2026-10-09 (comparación con selfie en la vía NFC). [Detalle](./compliance/02-mayoria-de-edad.md).

## D-2026-10-17b — Fotos privadas y copias mínimas de recuperación

- **Decisión expresa:** R2 privado con GET firmado de cinco minutos tras autorización,
  manteniendo la subida/descarga directa; no cambiar a almacenamiento propio.
  No garantiza impedir compartir una firma vigente ni capturas/descargas.
- **Copias:** una completa independiente de PostgreSQL al día, age antes de subir,
  R2 privado UE separado y siete días; sin fotos, WAL/incrementales ni históricos
  mensuales/anuales.
- **Recuperación:** registro externo mínimo de bajas e instrucciones técnicas,
  previo a confirmar, sin correo/DNI/huella/relato; sobrevive al rollback y se
  conserva hasta confirmar su aplicación y desaparición de copias capaces de
  recuperar los datos. No es anónimo. Reaplicar todo antes de reabrir.
- **Fotos al restaurar:** conservar las asociaciones válidas con objetos existentes;
  retirar referencias ausentes/fotos retiradas y objetos sin asociación activa.
  No resetear galerías ni respaldar imágenes. Quien pierda una asociación la sube
  otra vez. Reserva legal y validación jurídica quedan para el siguiente bloque.
- **Aplicado:** producción `c008473`, 2026-10-17.

## D-2026-10-17 — Medida ajena mínima y revisión tras borrar al denunciante

- **Contexto:** borrar íntegramente una denuncia podía dejar suspendida a otra cuenta sin expediente desde el que recurrir. El titular aprueba separar datos de la persona borrada y derechos de esa otra cuenta.
- **Decisión:** eliminar expediente original, vínculos, relatos, avisos y auditoría de la denuncia; conservar únicamente una ficha nueva de la suspensión vigente y su revisión, vinculada solo a la otra cuenta. Textos fijos sin datos/evidencia del denunciante. El recurso pendiente mantiene su estado y asignación; uno resuelto mantiene solo resultado/fecha/decisor. No se modifica automáticamente la sanción y se exige otra persona para revisar.
- **Límites:** no retiene correo, huella ni lista negra de quien se borra. La ficha desaparece al borrar la cuenta a la que pertenece. Es una separación técnica de datos de otra persona, no una reserva legal ni una decisión de plazos de backups; ambos quedan para después. [Detalle](./15-borrado-y-web-publica.md).

## D-2026-10-16 — Baja con borrado físico y sin identidad residual

- **Contexto:** el propietario descarta conservar correo o huella documental de quienes piden la baja y acepta el coste de repetir alta/verificación.
- **Decisión:** borrar físicamente cuenta y datos vinculados al solicitarlo, sin esperar al reingreso. El mismo acceso/DNI puede volver desde cero, incluso si la cuenta estaba suspendida; no se conserva un veto de identidad. Conversaciones compartidas y expedientes vinculados también se eliminan. Referencias externas mínimas duran solo lo necesario para ejecutar/reintentar su limpieza.
- **Límites:** sustituye la baja lógica y su protección de reingreso durante suspensión, aceptando ese riesgo de evasión. No autoriza purgas masivas de registros históricos ni declara cerradas reservas legales, backups o condiciones de proveedores. Implementado solo localmente. [Detalle](./15-borrado-y-web-publica.md).

## D-2026-10-14 — NFC con los documentos de todos los países con lista de CSCA pública

- **Contexto:** la instancia oficial es solo para España, pero en España vive y viaja mucha gente sin DNI español. Con Didit (selfie + documento) ya pueden verificarse con cualquier pasaporte o documento de identidad; por NFC solo valían los documentos españoles, porque `priv/csca` solo traía los CSCA de España.
- **Decisión:** `priv/csca` lleva **todos los CSCA de las listas maestras públicas** del BSI (Alemania) y de la NPKD (Países Bajos): 638 certificados de 129 emisores. Cada lista se importa solo si su firma cuadra con el CSCA del Estado que la publica, comprobado antes con la huella de su web oficial (`mix cherry.csca … --signed-by … --export-countries priv/csca`). La app enseña la lista de países en una hoja con buscador (la «i» del método NFC), que pide al servidor `GET /api/me/verification/nfc/countries`. La MRZ acepta también TD2; los visados se rechazan.
- **Motivación:** confiar en un CSCA solo significa aceptar lo que ese Estado firma; no se consulta nada fuera ni sale ningún dato. El riesgo (que a un Estado le roben la clave o que emita documentos con datos falsos) es menor que el de la alternativa, el selfie, que se basa en fotos. La ICAO PKD no se usa: su licencia no permite redistribuirla.
- **Mantenimiento:** las listas se renuevan cada 1–3 meses; hay que volver a importarlas (procedimiento en `apps/backend/priv/csca/README.md`). Sin actualizar, los documentos nuevos se rechazan, pero nunca se acepta uno falso por eso.
- **Ampliación (2026-10-21):** se suman las listas maestras de Italia (Ministero dell'Interno) y Suecia (Polisen) y la edición nueva de la NPKD, con la misma comprobación de firma: 697 certificados de 136 emisores. Entran Gambia, Kirguistán, Corea del Norte, Pakistán, Sierra Leona, Senegal y la Orden de Malta, avalados solo por esas listas, y se retiran a mano dos certificados indios que no son CSCA de producción. La lista suiza no se usa: sus condiciones exigen permiso escrito para reproducirla. Los países que solo están en la ICAO PKD (Armenia, Camboya, Mali, Paraguay…) siguen fuera.

---

## D-2026-10-13 — Licencias abiertas para todo, permiso para las tiendas, DCO y nombre compartido

- **Contexto:** Cherry se va a publicar como proyecto abierto para que cualquiera monte su instancia en su país (Cherry España es la de Akorda Software). Las condiciones de las tiendas de apps (sobre todo la App Store) añaden restricciones que la AGPL no permite añadir: sin un permiso explícito, en cuanto hubiera código de otras personas nadie podría publicar la app en la tienda. La AGPL tampoco cubre el nombre ni la imagen.
- **Decisión:** Se mantiene la **AGPL-3.0 únicamente**, con un **permiso adicional (sección 7) para distribuir en tiendas de apps** (`LICENSE-EXCEPTION.md`). Las contribuciones se aceptan con el **DCO** (`git commit -s`), sin CLA: nadie cede derechos y todos son dueños de su código. Dibujos (logo, mascota, ilustraciones) con doble licencia, también **CC BY-SA 4.0**; documentación en CC BY-SA 4.0. Titular: **Akorda Software** y las personas que contribuyen (pasará a la cooperativa cuando se constituya). El nombre «Cherry» **no se registra**: lo puede usar cualquier instancia que cumpla unas condiciones mínimas (`TRADEMARKS.md`).
- **Motivación:** El permiso para las tiendas vale igual para todas las instancias, no solo para la oficial. El DCO es lo más ligero y respeta que el código sea de quien lo hace; a cambio, cambiar de licencia requeriría el permiso de todos, algo que no se prevé. Las condiciones del nombre protegen que «Cherry» signifique lo mismo en todos los países.
- **Sustituye:** amplía D-2026-09-29 (licencia AGPL-3.0).
- **Referencias:** `LICENSE`, `LICENSE-EXCEPTION.md`, `COPYRIGHT.md`, `TRADEMARKS.md`, `CONTRIBUTING.md`, `DCO`.

---

## D-2026-10-09 — Verificación de edad obligatoria: DNI por NFC primero

- **Contexto:** Pedir solo la fecha de nacimiento ya no se considera verificación válida (directrices del art. 28 de la DSA) y la ley española de menores en entornos digitales apunta a exigir la edad real. Verificar a todos con un proveedor externo costaría ~20.000–25.000 $ por cada 100.000 usuarios, inasumible sin monetización.
- **Decisión:** Nadie usa la app sin verificarse. Vía principal: lectura NFC del DNI, NIE o pasaporte, con autenticación pasiva en el servidor y comparación con un selfie. Respaldo: proveedor externo para quien no pueda leer el chip. Más adelante, la app europea de verificación de edad como opción adicional. Solo se guarda «mayor de edad: sí» y una huella del número de documento (una persona, una cuenta).
- **Motivación:** Coste por usuario casi nulo, fecha de nacimiento firmada por el Estado y freno fuerte a bots y a cuentas duplicadas. La fricción se asume como rasgo de marca.
- **Referencias:** `docs/compliance/02-mayoria-de-edad.md`, `docs/compliance/08-financiacion-y-proveedores.md`.

---

## D-2026-10-09 — Instancia oficial solo en España

- **Contexto:** Publicar en App Store y Google Play implica cumplir la ley de cada país donde se distribuye (Ofcom en Reino Unido, leyes de app stores en EE. UU., bloqueos 18+ de Apple en Australia, Brasil y Singapur…).
- **Decisión:** La instancia oficial se distribuye solo en el storefront español de ambas tiendas y su cumplimiento se diseña solo para España (RGPD/LOPDGDD, LSSI, DSA, ley española de menores). Quien monte su instancia en otro país la adapta a su ley.
- **Motivación:** Reduce el cumplimiento a un único marco legal asumible por un proyecto sin ingresos.
- **Referencias:** `PRODUCT.md`, `docs/compliance/`.

---

## D-2026-09-30 — «¿Qué buscas?» con varias respuestas

- **Contexto:** Mucha gente no busca una sola cosa («relación o conocer gente»). Con un único valor tenían que elegir y quedaban fuera de parte de la gente con la que sí encajan.
- **Decisión:** `profiles.looking_for text[]` (antes `what_i_am_looking_for`), 1–4 intenciones sin repetir, en orden canónico. Dos personas encajan si algún par (mía, suya) encaja con la regla de siempre (cada intención ve la suya y «a ver qué pasa»; relación y casual nunca se cruzan); sigue siendo simétrico. Compartir alguna intención da el bonus de «misma intención». La API expone `lookingFor` y acepta aún la cadena única antigua; `whatIAmLookingFor` queda como campo obsoleto de solo lectura.
- **Sustituye:** «`what_i_am_looking_for` único valor requerido» (decisiones heredadas 2026-04-28).
- **Referencias:** `docs/06-contratos-mobile-backend.md`, migración `20260930090000_profiles_looking_for_array.exs`.

---

## D-2026-09-29 — Licencia AGPL-3.0

- **Contexto:** Cherry es open source, gratuita y self-hosteable (`PRODUCT.md`). Con una licencia permisiva (MIT, Apache) cualquiera podría coger el código, modificarlo, montar una instancia cerrada y cobrar por lo que aquí es gratis (likes, filtros, deshacer), sin devolver nada. Al ser un servicio en red, ni siquiera la GPL obligaría a publicar esos cambios, porque la app no se «distribuye» al usar el servidor.
- **Decisión:** Licencia **GNU AGPL-3.0** (texto en `LICENSE`; `"license": "AGPL-3.0-only"` en el `package.json` raíz). Quien modifique Cherry y lo ofrezca a otras personas, también a través de la red, tiene que ofrecerles el código de su versión. La app lo facilita con el enlace «Ver el código» de Acerca de (`EXPO_PUBLIC_SOURCE_URL`).
- **Motivación:** Nadie puede cerrar una instancia modificada y cobrar por ella a espaldas de sus usuarios; las mejoras de cualquier instancia vuelven a estar disponibles para todos. Encaja con la filosofía anti-predatoria y con que cualquiera pueda auditar el servicio que usa.
- **Consecuencias:** Montar una instancia propia sigue siendo libre (`docs/12-self-hosting.md`); lo que no se puede es ocultar el código modificado. Las dependencias y fuentes incluidas conservan sus licencias (las fuentes, SIL OFL 1.1).
- **Referencias:** `LICENSE`, `README.md`, `docs/12-self-hosting.md`.

---

## D-2026-09-29 — Dirección visual «Libreta kawaii»

- **Contexto:** La app llevaba un tema «neobrutal» provisional (D-2026-06-18) y una paleta dating planificada sin decidir. `PRODUCT.md` fija como compromiso de marca del propietario un **neobrutalismo kawaii a tope** con pasteles muy vivos, animaciones cuidadas y una app que «te abraza».
- **Decisión:** Dirección **«Libreta kawaii»**, elegida por el propietario frente a otra propuesta kawaii («Hoja de pegatinas») y frente al estándar del sector (foto a sangre, degradado oscuro e interfaz blanca genérica):
  1. Neobrutalismo kawaii pastel: tinta ciruela sobre papel de puntos, contornos de tinta y sombras duras sin desenfoque, siete pasteles (fresa, menta, lavanda, limonada, cielo, melocotón, tomate) con variantes `fill`/`soft`/`deep`.
  2. Cada perfil es una página de libreta: fotos con washi tape, etiquetas como pegatinas troqueladas y un sello «¡ME GUSTA!».
  3. Tipografía: **Mochiy Pop One** (titulares), **M PLUS Rounded 1c** (interfaz) y **Yomogi** (anotaciones a mano), subseteadas a latín para no empaquetar glifos CJK.
  4. Mascota **Mochi**, con varias caras para estados vacíos, errores y celebraciones.
  5. Iconos propios (un único set SVG) y movimiento de sistema (pulsar, pegar, aparecer) con soporte de «reducir movimiento».
- **Motivación:** Diferencia a Cherry del arquetipo del sector y encarna su tono cálido y anti-predatorio. La arquitectura de tokens (D-2026-04-13) permite aplicarla sin tocar la lógica de producto.
- **Consecuencias:** Solo hay tema claro (`userInterfaceStyle: "light"`); el modo oscuro queda como deuda. Reglas y componentes en `docs/08-identidad-visual.md`.
- **Sustituye:** D-2026-06-18 (dirección «neobrutal» provisional con azul `#3A41E0`).
- **Referencias:** `docs/08-identidad-visual.md`, `apps/mobile/src/shared/ui/`, `apps/mobile/assets/fonts/README.md`.

---

## D-2026-09-29 — Visibilidad social coherente con el feed y medios efímeros

- **Contexto:** La revisión de seguridad del overhaul encontró que el perfil público y el destino de un swipe saltaban los filtros duros del feed (etiquetas bloqueadas, intención, género/edad), que un like histórico mantenía visible a una ex pareja (y su distancia en vivo), que cualquiera sin perfil activo podía hacer swipe, que la card exponía la puntuación (actividad, likes pendientes), que la ubicación aceptaba cualquier geometría y que las fotos subidas o borradas quedaban públicas para siempre.
- **Decisión:**
  1. **Una sola regla de visibilidad** para feed, likes, perfil público y swipe: si no hay match vivo, el otro perfil tiene que ser descubrible y pasar los filtros duros en ambas direcciones; las preferencias de la otra persona hacia mí se relajan solo si tiene un like pendiente hacia mí (su like es su consentimiento). Con match vivo el perfil sigue visible para el chat. Un like antiguo no da visibilidad. Los fallos responden 404 indistinguible.
  2. **Viewer activo** (completo, descubrible, sin pausar) para hacer swipe, deshacer y ver perfiles ajenos, salvo el perfil de un match vivo.
  3. **La puntuación no sale del servidor.**
  4. **Ubicación:** solo lat/lng desde el cliente, siempre en rejilla de 500 m, como mucho una actualización por minuto; la BD solo guarda puntos.
  5. **Fotos efímeras:** claves aleatorias sin id de perfil, subida a zona de espera no pública y publicación al completar; límites de intents; borrado físico al borrar foto o cuenta y barrido periódico de subidas abandonadas; caché de un día en lugar de «immutable».
  6. Deshacer un «no» no depende de que la otra persona siga visible: se deshace y la respuesta lleva `profile: null`.
- **Motivación:** `PRODUCT.md` (anti-predatoria, las etiquetas mandan, bloqueos siempre). Evita acoso tras un unmatch, triangulación por distancia y hosting gratuito en nuestro almacenamiento.
- **Referencias:** `docs/05-backend-api.md`, `docs/06-contratos-mobile-backend.md`, `Cherry.Dating.Social`, `Cherry.Dating.PhotoStorage`.

---

## D-2026-09-29 — Ranking de discovery v2

- **Contexto:** El ranking v1 tenía estos huecos:
  - Filtraba la intención por igualdad exacta.
  - Solo excluía por etiquetas bloqueadas en una dirección e ignoraba `compatible_only`.
  - Contaba etiquetas compartidas sin distinguir su rareza y usaba `updated_at` como proxy de actividad.
  - No tenía expansión de distancia, y `PUT /api/me/discovery-preferences` aceptaba cualquier distancia.

  `PRODUCT.md` fija que las etiquetas mandan, que los bloqueos se respetan siempre y que la app es anti-predatoria. Con los likes recibidos visibles y gratis, un perfil que se muestra a alguien que no lo habría visto recibe likes que saltan sus preferencias.
- **Decisión:**
  1. **Intención como matriz simétrica** (confirmada por el propietario el 2026-09-29). Cada intención es compatible consigo misma y con `go_with_the_flow`, y `go_with_the_flow` con todas. `relationship` y `casual` nunca se cruzan. Misma intención +10; vía `go_with_the_flow` +4.
  2. **Visibilidad simétrica.** Las etiquetas bloqueadas cuentan en ambas direcciones, como fija `PRODUCT.md`: no se ve a quien tiene una etiqueta que bloqueo ni a quien bloquea una de las mías. Por el mismo principio (si A no puede ver a B, B no ve a A), `compatible_only` de cualquiera de los dos exige al menos una etiqueta compartida. Aplicar `compatible_only` de forma simétrica es una interpretación de implementación y queda pendiente de validar con el propietario.
     **Quien ya dio dislike al viewer tampoco aparece en su feed** (decisión del orquestador del 2026-09-29). La pestaña de likes solo lista likes sin responder, así que un like a quien ya te descartó no lo vería nadie. Es simétrico: quien descartó tampoco vuelve a ver a quien descartó. Deshacer el dislike (`POST /api/discovery/undo` borra el swipe) levanta la exclusión. El índice parcial `swipe_actions_dislikes_received_index` (`(target_profile_id, actor_profile_id) WHERE action_type = 'dislike'`, migración `20260929154521`) permite leer los dislikes recibidos con un index-only scan.
  3. **Puntuación 0–97 en PostgreSQL, en una sola sentencia.** Orden `tier ASC, score DESC, id ASC` con cursor firmado:
     - Afinidad de etiquetas 0–45: Ochiai/coseno ponderado por IDF, `Σw(compartidas) / √(Σw(mías) · Σw(suyas))`, con `w = ln(1 + N / (1 + n_tag))`.
     - Intención +10/+4 y reciprocidad +12 (`liked_viewer`).
     - Recién llegado hasta +8, que decrece en 7 días desde `profiles.completed_at` (la primera vez que se completa).
     - Actividad real +8/+5/+2 (<24 h/<72 h/<7 d) sobre `profiles.last_active_at`. Lo escribe el plug `TrackActivity` como mucho cada 15 min, con un único UPDATE por PK.
     - Distancia 0–10 dentro del radio del tramo y exploración determinista 0–4.
     - Reparto justo de atención: −min(6, likes recibidos en 7 días sin contestar / 5).
  4. **Expansión de distancia.** `discovery_preferences.expand_distance`, activa por defecto. Con distancia acotada, añade un tramo 2 hasta min(2 × radio, radio + 100 km), siempre detrás de todo el tramo 1; el cursor incluye el tramo. Sin límite (999999) no hay tramos. Nunca se relajan otros filtros.
  5. **Pesos IDF en caché versionada** (`discovery_tag_weights`). Un GenServer (`Discovery.TagWeights`) escribe una generación nueva cada 15 min y purga las de más de 2 h. El cursor fija la generación y el instante de referencia, así que ni el paso del tiempo ni un recálculo reordenan un feed en curso.
  6. **Validación de preferencias en cada guardado:** distancia ∈ {10, 25, 50, 100, 999999}, edades 18–100 y `age_min ≤ age_max`. La migración normaliza los valores antiguos.
- **Rechazadas:**
  - Calcular el IDF en cada petición: O(perfiles) por feed para un dato global que cambia despacio.
  - Vista materializada: su refresco bloquea y no deja fijar una versión por cursor.
  - Rellenar el feed relajando filtros duros.
  - Distancia recíproca: se mantiene el radio del viewer, como en v1.
- **Motivación:**
  - La compatibilidad declarada pesa más que la proximidad (45 frente a 10 puntos).
  - La reciprocidad y la actividad real llevan a matches que ocurren.
  - El reparto de atención evita concentrar likes en unos pocos perfiles saturados, sin castigar a nadie más de 6 puntos.
- **Rendimiento:** medido con `priv/repo/bench/discovery_bench.exs` (BD aparte `cherry_bench`, 5.000 perfiles sintéticos con unos 490.000 swipes, página de 20). Resultados p50:
  - Sentencia en PostgreSQL: 6–22 ms.
  - `feed/2` de extremo a extremo: 10–23 ms; la página 2 cuesta lo mismo que la 1. El peor caso es distancia sin límite y todos los géneros, con 1.149 candidatos.
  - El viewer con más swipes recibidos (1.385) se sirve en 10 ms.
  - Con 3.000 perfiles: 9–16 ms; con 10.000: 17–42 ms.
  - El coste es lineal en candidatos (unos 20–25 µs cada uno).
  - Medido ya con la exclusión por dislike, que no empeora el benchmark: el índice parcial evita leer del heap el resto de swipes recibidos.
- **Consecuencias:**
  - Con decenas de miles de candidatos dentro de un mismo radio hará falta precalcular (cola de candidatos por usuario o estadísticas de atención por perfil).
  - Los cursores v1 dejan de valer (422 `invalid_cursor`: el cliente reinicia el feed).
  - `discovery_mode` queda como preferencia de presentación del cliente; el feed es el mismo en swipe y feed (cierra la deuda #13).
  - El selector de distancia del móvil debe ser cerrado.
- **Sustituye:**
  - El filtro exacto de intención y la fórmula de scoring de D-2026-09-05, del que se mantiene el patrón SQL + cursor opaco.
  - El «boost reducido con datos de interacción» de las decisiones heredadas, que pasa a ser un decaimiento en 7 días.
- **Referencias:** `apps/backend/lib/cherry/dating/discovery.ex`, `apps/backend/lib/cherry/dating/discovery/tag_weights.ex`, `docs/01-requisitos-producto.md` (reglas), `docs/06-contratos-mobile-backend.md` (`expandDistance` y semántica del feed).

---

## D-2026-09-29 — Almacenamiento local de fotos para self-hosting

- **Contexto:** Las fotos solo podían subirse a Cloudflare R2 (host `*.r2.cloudflarestorage.com` fijo). Sin R2 configurado, `upload-intent` respondía 503: no se podía completar el onboarding en desarrollo ni montar una instancia propia sin contratar un bucket, lo que choca con «open source y self-hosteable» (`PRODUCT.md`).
- **Decisión:**
  1. Behaviour `Cherry.Storage` (`upload_config/1`, `presign_put/3`, `verify_upload/1`, `public_url/1`) con dos adaptadores elegidos por `STORAGE_ADAPTER`: `local` (`Cherry.Storage.Local`) y `r2` (`Cherry.Storage.R2`, alias `s3`). Por defecto `local` en dev; en prod es obligatorio declararlo.
  2. **Local:** el contrato del móvil no cambia (intent → `PUT uploadUrl` con los headers → `complete`). `uploadUrl` = `<base>/api/uploads/<token>`, con un `Phoenix.Token` que firma storage key, MIME, tamaño máximo y caducidad (el TTL del intent). La ruta es pública y el token es la autorización, como una URL prefirmada. El backend lee el cuerpo crudo por fragmentos con límite, valida MIME y cabecera JPEG/PNG/WebP y publica de forma atómica en `UPLOADS_DIR/<storage_key>` (temporal + enlace duro): nunca sobrescribe (412), igual que `If-None-Match: *`. Las fotos se sirven con `Plug.Static` en `/uploads` (caché inmutable, sin listados). `verify_upload` mantiene la semántica y los errores de R2.
  3. En BD, las fotos locales guardan la ruta relativa (`/uploads/...`) y la API siempre devuelve URLs absolutas: base `PUBLIC_BASE_URL` o, si no está definida, el host de la petición (la misma BD sirve a `localhost`, a la IP de la LAN o a un túnel en dev).
  4. **R2/S3:** el adaptador R2 admite `S3_ENDPOINT` + `S3_REGION` para MinIO, Garage u otro S3 (path-style), sin cambiar el comportamiento con R2.
- **Consecuencias:** en local las fotos pasan a formar parte del estado del servidor: `UPLOADS_DIR` debe estar en un volumen persistente e incluirse en los backups. Phoenix sirve los binarios (suficiente para el volumen esperado; se puede poner una CDN o proxy con caché delante gracias a las cabeceras inmutables). Cambiar de adaptador no migra fotos: las ya guardadas siguen sirviéndose desde `/uploads` mientras exista el directorio. Sin moderación ni decodificación completa de imagen (igual que con R2). Borrar una foto solo la desactiva; la purga física sigue pendiente.
- **Actualización (D-2026-09-29, visibilidad social y medios efímeros):** las subidas van a una zona de espera `pending/` y se publican al completar; borrar una foto o la cuenta borra el objeto físicamente; la caché pasa de «inmutable» a un día.
- **Rechazadas:** exigir MinIO/Garage para self-hosting (otro servicio que operar para instancias pequeñas); subida multipart a Phoenix (cambiaría el contrato del móvil); URLs absolutas en BD (rompe al cambiar de host o de dominio).
- **Referencias:** `docs/06-contratos-mobile-backend.md` (Fotos), `docs/05-backend-api.md`, `lib/cherry/storage.ex`.

---

## D-2026-09-29 — Likes recibidos visibles y gratuitos

- **Contexto:** En las apps comerciales ver quién te ha dado like es la función de pago estrella. Cherry es 100 % gratuita y anti-predatoria (`PRODUCT.md`).
- **Decisión:** Pestaña «Likes» gratuita. `GET /api/likes/received` lista (like más reciente primero, cursor opaco firmado) a quienes te han dado like y aún no has respondido, con la misma card que el feed; darles like crea el match al instante (`POST /api/discovery/actions`) y un «no» los retira. Se excluyen bloqueos (ambas direcciones), cuentas o perfiles borrados, perfiles pausados, etiquetas bloqueadas (ambas direcciones) y perfiles fuera del género, edad o intención compatible del receptor. Las cards del feed marcan `likedYou`, y `GET /api/me/summary` da los contadores de las pestañas.
- **Motivación:** Gratis sin asteriscos. Los filtros garantizan que un like «forzado» por API nunca salte las preferencias ni los bloqueos de quien lo recibe.
- **Referencias:** `docs/05-backend-api.md`, `docs/06-contratos-mobile-backend.md`, `packages/contracts/CHANGELOG-v2.md`.

---

## D-2026-09-29 — Caducidad de match a 30 días

- **Contexto:** 7 días para escribir generaba una urgencia artificial, contraria al tono de la app («nunca presiona»).
- **Decisión:** Un match sin mensajes caduca a los **30 días** (`config :cherry, :match_expiry_days, 30`); el primer mensaje elimina la caducidad. Se aplica al crear el match, de forma perezosa en todas las lecturas (matches, conversaciones, historial, badges, perfil público) y en la mensajería. `Cherry.Dating.MatchExpirySweeper` marca `status = "expired"` cada hora para que el estado persistido sea veraz. La migración `20260929120000` alarga a 30 días los matches pendientes creados con la regla anterior.
- **Motivación:** Sin escasez ni culpa; 30 días dejan margen real sin acumular matches muertos.
- **Sustituye:** la caducidad de 7 días de las decisiones heredadas (2026-04-28).

---

## D-2026-09-29 — Deshacer el último «no» gratis

- **Contexto:** En Tinder deshacer es de pago; un swipe accidental a la izquierda frustra.
- **Decisión:** `POST /api/discovery/undo` deshace el swipe más reciente solo si fue un `dislike` de hace menos de 10 minutos y el perfil sigue visible, y devuelve su card para reinsertarla. Se pueden encadenar mientras cada último swipe cumpla la regla. Los likes no se deshacen (pueden haber creado un match y notificado a la otra persona).
- **Actualización (D-2026-09-29, visibilidad social):** el «no» se deshace aunque la persona ya no sea visible; entonces la respuesta lleva `profile: null` y no se reinserta nada.
- **Motivación:** Comodidad del usuario sin coste; la ventana corta evita convertirlo en un historial de rechazos.
- **Sustituye:** «sin undo» de las decisiones heredadas (2026-04-28).

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

## D-2026-06-18 — Dirección visual «neobrutal» para la app móvil (sustituida por D-2026-09-29, «Libreta kawaii»)

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
- **Decisión:** Contexto `Cherry.Dating` con PostgreSQL + PostGIS (`geography(Point,4326)` con índice GiST) para ubicaciones y cálculo de distancias. Chat en tiempo real vía Phoenix Channel (`chat:{conversationId}`) autenticado con el access token JWT validando expiración; REST sigue siendo la fuente de historia.
- **Motivación:** PostGIS da consultas de proximidad indexadas sin infraestructura adicional; el socket de Phoenix reutiliza el mismo token y reglas de sesión que REST.
- **Referencias:** `docs/02-arquitectura.md`, `docs/04-modelo-datos.md`.

---

## D-2026-04-17 — Servicios de auth mock para desarrollo

- **Contexto:** Probar el flujo de sesión en Expo sin configurar Google/Apple nativos ralentiza el desarrollo.
- **Decisión:** Infraestructura de auth con doble implementación: servicios nativos reales y servicios mock seleccionables por entorno, más un endpoint dev `POST /api/auth/dev/test-login` en el backend.
- **Motivación:** Permite desarrollar y testear bootstrap/routing/onboarding end-to-end sin credenciales de provider ni builds nativos.

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
- `what_i_am_looking_for` único valor requerido (relationship/casual/meet_people/go_with_the_flow) (sustituido: D-2026-09-30, varias intenciones).
- Match solo por like mutuo; sin undo (sustituido: D-2026-09-29, deshacer el último «no»); match expira a los 7 días sin primer mensaje (sustituido: D-2026-09-29, 30 días); chat solo texto.
- Likes ilimitados (sin caps de monetización) con protección anti-abuso técnica.
- Compatibilidad pesa más que distancia; la distancia se expande gradualmente si hay poca oferta; jamás se ignoran blocked tags ni compatibilidad de género.
- Boost temporal controlado para usuarios nuevos.

## D-2026-09-05 — Correcciones de acceso, discovery y fotos

- El borrado de cuenta sigue siendo lógico: `users.deleted_at`, perfil oculto, sesiones/refresh/push revocados y sockets desconectados. Un bloqueo impide mensajear en ambas direcciones, incluidas conexiones abiertas.
- Discovery puntúa en PostgreSQL y pagina por `(score DESC, id ASC)`. Cursor firmado y ligado al usuario (1 h); exploración determinista por pareja. Se mantiene el DTO `nextCursor: string | null` y los filtros se vuelven a evaluar por petición.
- Fotos: firma de `Content-Type` e `If-None-Match: *`, verificación autenticada de existencia/tamaño/MIME/cabecera y lectura condicionada por ETag. Se retira la creación directa de metadatos por REST. La migración de fotos caduca intents antiguos pendientes para exigir URLs que no permitan sobrescritura.
- El despliegue requiere ambas migraciones `20260905170000` y `20260905170100`. La primera desactiva también cuentas cuyos perfiles ya estaban borrados; la segunda obliga a repetir las subidas pendientes antiguas. No se purgan datos ni se reactiva ninguna credencial al revertir las migraciones.

---
