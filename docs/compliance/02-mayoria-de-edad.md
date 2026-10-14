# Mayoría de edad

**Estado:** prototipo en la rama `feat/dni-nfc` (ver [Estado del prototipo](#estado-del-prototipo)). Autenticación pasiva en el servidor, modelo de datos, API, módulo NFC y flujo de la app construidos. Probado el 2026-10-13 con un DNI real en Android: lectura, firma del Estado, mayoría de edad y bloqueo de un segundo uso del mismo DNI funcionan. iPhone sin probar. La obligatoriedad (`AGE_VERIFICATION_REQUIRED`) sigue desactivada por defecto ([perfil pendiente de verificar](#perfil-pendiente-de-verificar)).

## Por qué

- **Pedir solo la fecha de nacimiento ya no es una verificación válida.** Las directrices de la Comisión sobre protección de menores (art. 28 de la DSA, julio de 2025) dicen que declarar la edad no basta y ponen las webs de citas para adultos como ejemplo de servicio que necesita comprobarla. La Comisión ya ha usado ese criterio contra Meta.
- **Matiz legal:** el art. 19 de la DSA exime a micro y pequeñas empresas de la sección donde está el art. 28, así que hoy probablemente no obliga a Cherry de forma estricta. Pero:
  - la **ley española de protección de menores en entornos digitales** se está tramitando en el Congreso (a septiembre de 2026) y exige verificar la edad real;
  - la CNMC y la AEPD publicaron en marzo de 2026 una guía sobre el art. 28 que favorece soluciones que no permitan rastrear al usuario;
  - **un menor en una app de citas es el peor riesgo del proyecto**, legal y reputacional.
- **Google Play** obliga a activar «Restrict Declared Minors» (ver `01`).

## Qué hacen otras apps

- **Tinder y Hinge:** estimación de edad facial con Yoti (Reino Unido) y Face Check obligatorio (selfie en vídeo con prueba de vida, de FaceTec) en EE. UU., Reino Unido y otros mercados.
- **Grindr:** en Reino Unido, selfie en vídeo comparado con un documento oficial.
- **Bumble:** selfie con pose aleatoria y verificación opcional con DNI vía Veriff.

## Decisión

**La verificación es obligatoria para entrar.** Si no se verifica, no se usa la app. Orden:

1. **Lectura NFC del DNI, NIE o pasaporte** (vía principal, coste 0).
2. **Proveedor externo** como respaldo para quien no pueda leer el chip.
3. **App europea de verificación de edad / Cartera Digital Beta** cuando esté disponible, como opción adicional.

La fricción se asume como rasgo de marca: un sitio donde todo el mundo está verificado y no se guarda el documento. El mensaje de marca va en la ficha de las tiendas y en la web; dentro de la app, la pantalla solo explica qué se lee, qué se guarda y qué se borra.

## 1. Lectura NFC del documento

**Qué documentos:** DNI 3.0 y 4.0 (desde 2015), NIE con chip y pasaportes electrónicos; también los pasaportes y documentos de identidad con chip de los unos 129 emisores de las listas maestras públicas (D-2026-10-14). Todos siguen el estándar ICAO 9303 (eMRTD). La app enseña la lista de países con la «i» del método NFC (`GET /api/me/verification/nfc/countries`).

**Cómo funciona:**

1. El usuario introduce el **CAN** (6 dígitos impresos en la tarjeta) o, en el pasaporte, los datos de la zona legible (MRZ). No hace falta el PIN.
2. La app abre un canal seguro con el chip (**PACE**) y lee:
   - **DG1:** datos de la MRZ, entre ellos la fecha de nacimiento;
   - **SOD:** la firma del Estado sobre los datos;
   - **DG2:** la foto del documento (para compararla con el selfie).
3. **Autenticación pasiva en el servidor:** el backend comprueba que el SOD está firmado por un certificado de firma de documentos que, a su vez, cuelga de los certificados raíz españoles (CSCA), y que los hashes de DG1 y DG2 coinciden. Así sabemos que la fecha de nacimiento no se ha alterado. **Debe hacerse en el servidor**, no en el móvil, porque una app manipulada podría mentir.
4. **Selfie y comparación** con la foto del chip, con un modelo de código abierto en nuestro servidor, para que no se use el documento de otra persona (un menor con el DNI de su hermano).
5. **Una persona, una cuenta:** se guarda una huella con clave secreta (HMAC) del número de documento para impedir cuentas duplicadas y el regreso tras un baneo (ver `04`).
6. **Se guarda solo:** «mayor de edad: sí», fecha de verificación, método y la huella del documento. **Se borran al momento:** DG1, DG2, el selfie y el CAN.

**Librerías candidatas:**

- iOS: [AndyQ/NFCPassportReader](https://github.com/AndyQ/NFCPassportReader) (Swift; PACE, autenticación pasiva, activa y de chip) o su fork [MRTDReader](https://github.com/arsenstorm/MRTDReader).
- Android: **JMRTD** (Java; PACE con CAN).
- Habría que envolverlas en un **módulo nativo de Expo** (la app ya usa dev client).

**Riesgos y puntos abiertos:**

- **Validar** que PACE con CAN funciona con el DNI 3.0/4.0 en ambas plataformas (riesgo técnico principal → prototipo primero).
- iOS exige declarar los identificadores de aplicación del chip (ISO 7816) en `Info.plist`.
- **Clonado del chip:** la autenticación pasiva prueba que los datos no se han alterado, no que el chip sea el original. La autenticación activa o de chip lo cubre, pero su resultado se comprueba en el móvil. Para verificar la edad el riesgo es bajo: un menor no gana nada clonando un chip si puede pedir prestado el documento, y eso lo cubre la comparación con el selfie.
- **Prueba de vida casera más débil** que la de un proveedor certificado: se refuerza haciendo el selfie solo después de pasar App Attest / Play Integrity (ver `04`). Un deepfake inyectado bien hecho podría colarse.
- Obtener y mantener al día los **certificados CSCA**: los españoles y los de las listas maestras del BSI y de los Países Bajos (`apps/backend/priv/csca/README.md`).
- **Dato biométrico y documento de identidad** → exige EIPD y consentimiento explícito (ver `06`).

## 2. Proveedor externo (respaldo)

Para quien no tenga móvil con NFC, tenga un documento sin chip o falle la lectura. Selfie con prueba de vida y estimación de edad; si la edad estimada queda cerca del límite, documento. Candidatos y precios en `08`. Con el NFC como vía principal, el proveedor solo lo usa una minoría, así que el coste es asumible (sobre todo dentro de las 500 gratis al mes de Didit).

### Selfie + documento con Didit (backend hecho, 2026-10-13)

- **Flujo:** la app pide `POST /api/me/verification/provider` (cuenta como intento, mismos límites que el NFC), abre en el navegador la URL de Didit (selfie y foto del DNI, TIE/permiso de residencia o pasaporte) y, al volver, pregunta `POST /api/me/verification/provider/check` con el `sessionId`. El servidor lee la decisión de Didit (API v3) y solo acepta sesiones creadas para ese usuario (`vendor_data`).
- **Qué se comprueba:** decisión aprobada, tipo de documento (no carné de conducir), mayor de 18 por la fecha de nacimiento, documento en vigor. Un menor (también en una sesión rechazada) borra la cuenta entera, como con el NFC.
- **Qué se guarda:** lo mismo que con el NFC (estado, método `provider`, fecha y huella). La huella es **la misma que calcula el NFC** para ese documento (DNI/NIE en DNI y TIE; número en pasaportes y documentos extranjeros), así que un DNI es una cuenta aunque se use otro método.
- **En Didit no queda nada:** tras una decisión final (aprobada, rechazada, caducada o abandonada) el servidor borra la sesión (`privacy_erasure`: fotos, selfie y datos leídos). Si el borrado falla, la verificación vale igual y queda un aviso en el log solo con el código HTTP.
- **Logs:** solo el resultado y códigos HTTP; ni usuario, ni sesión, ni datos del documento.
- **Configuración:** `DIDIT_API_KEY` y `DIDIT_WORKFLOW_ID`; sin ellas el endpoint responde 503 y `providerAvailable` (en el bootstrap y en `GET /api/me/verification`) es `false`. Las decisiones del entorno *sandbox* de Didit solo se aceptan en dev y test.
- **Pendiente para producción:** el webhook de Didit (`DIDIT_WEBHOOK_SECRET`) para las sesiones que quedan «In Review» (revisión manual): hoy solo se consulta cuando la app pregunta, así que si el usuario no vuelve a preguntar, la decisión no se recoge ni se borra la sesión. Revisar también el DPA con Didit y la EIPD (`06`).

## 3. App europea de verificación de edad

La Comisión presentó en abril de 2026 una app gratuita y de código abierto que confirma «mayor de edad: sí/no» sin revelar ningún otro dato. España está entre los países piloto (con la Cartera Digital Beta) y la Comisión pide que esté disponible en todos los países a finales de 2026 o en enero de 2027. Es gratis también para las plataformas.

Limitación: solo da sí/no, **no evita cuentas duplicadas** ni comprueba que la cara del perfil sea la de quien verifica. Por eso sería una opción adicional, no la principal. Además, un análisis de seguridad de marzo de 2026 encontró un fallo de arquitectura en su emisor.

## Señales de las tiendas

- **Google Play:** «Restrict Declared Minors» activado (obligatorio, `01`).
- **Apple:** la Declared Age Range API se puede leer como señal adicional; en España no es obligatoria.

## Plan

1. [~] Prototipo NFC: leer DG1/DG2/SOD de un DNI real en Android y iPhone desde un módulo Expo. *Módulo escrito (`apps/mobile/modules/document-nfc`); Android compila; iOS sin compilar; sin probar con un DNI real.*
2. [x] Autenticación pasiva en el backend con los certificados CSCA españoles. *Probada con PKI sintética y fixtures de OpenSSL; falta un SOD español real.*
3. [ ] Comparación de caras selfie ↔ DG2 con modelo de código abierto en el servidor. *Investigación hecha ([resumen](#investigación-selfie--dg2-y-prueba-de-vida-sin-construir)); sin construir.*
4. [x] Modelo de datos: estado de verificación del perfil + huella del documento; borrado inmediato del resto.
5. [x] Pantallas de verificación tras el onboarding (antes de que el perfil sea visible). *Decisión del 2026-10-13: el onboarding no cambia; al terminarlo, el perfil queda «pendiente de verificar» (ver [abajo](#perfil-pendiente-de-verificar)).*
6. [~] Integración del proveedor de respaldo. *Backend con Didit hecho (selfie + documento, por consulta); falta el webhook para producción.*
7. [ ] Integración de la app europea cuando esté disponible en España.

## Perfil pendiente de verificar

*Decidido el 2026-10-13.* Con `AGE_VERIFICATION_REQUIRED=true`:

- **El onboarding no cambia.** Al terminarlo entras en la app, pero el perfil queda **pendiente de verificar**, un estado distinto de «pausado por mí».
- **Sin verificar puedes editar y gestionar tu perfil, pero no ves a nadie ni nadie te ve:** el perfil no es descubrible y Descubrir, Likes y Chats muestran «Comprueba tu edad para empezar». El servidor ya bloqueaba la API social (403 `age_verification_required`); ahora `GET /api/bootstrap` devuelve `ageVerification: {required, status}` para que la app lo sepa.
- **Al verificarte, el perfil se activa solo,** salvo que lo hubieras pausado tú.
- **Si el documento es de un menor, se borra la cuenta entera** (fotos, perfil, sesiones y usuario) y la app cierra la sesión. Se avisa antes de empezar.
- **Flujo en la app (`/verify`):**
  - **Por qué se pide:** la ley, frenar bots y perfiles falsos, una persona una cuenta, y que el documento no se guarda.
  - **Elegir método:** DNI por NFC (recomendado), selfie con proveedor externo (próximamente) y cartera digital europea (próximamente).
  - **DNI:** qué necesitas, el CAN, cómo colocarlo (animación y pasos) y la lectura, con barra de progreso.
- **Lectura más robusta en Android:** si el chip deja de responder (documento algo desplazado de la antena: le llega energía para lo sencillo, no para el cálculo de PACE), el lector espera 5 s en vez de 10 y vuelve a empezar solo hasta 3 veces sin salir de la pantalla. Visto en la primera prueba con un DNI real: 3 de 5 lecturas fallaban justo en ese paso.
- **Pendiente:**
  - borrar las cuentas que nunca se verifican pasado un plazo;
  - recalcular la visibilidad de los perfiles existentes al activar el flag (hoy solo se recalcula al editar, despausar o verificarse);
  - integrar los proveedores de respaldo.

## Estado del prototipo

*Actualizado el 2026-10-09, rama `feat/dni-nfc`. Pruebas con documento real: [`02-nfc-pruebas-manana.md`](./02-nfc-pruebas-manana.md).*

### Qué hay

**Backend (`apps/backend`)**

- `Cherry.Identity.Document.PassiveAuth`: autenticación pasiva completa (ICAO 9303-11).
  - SOD (CMS SignedData + LDSSecurityObject): firma del SignerInfo con atributos firmados, comprobando `contentType` y `messageDigest`.
  - Certificado del firmante dentro del SOD, validado contra un CSCA de confianza: nombre, AKI/SKI, firma, validez de ambos, uso de clave, que no sea CA y que no tenga extensiones críticas desconocidas.
  - Hashes de DG1 y DG2.
  - MRZ TD1 (DNI, TIE), TD2 (algunos documentos de identidad extranjeros) y TD3 (pasaporte) con todos los dígitos de control. Los visados (código `V`) se rechazan.
  - Algoritmos: RSA PKCS#1 v1.5, RSASSA-PSS, ECDSA (DER y *plain* de BSI) con curvas NIST y brainpool, también con parámetros explícitos; SHA-1/224/256/384/512.
- **Lector DER y X.509 propios** (`Der`, `Certificate`). OTP 28 (`:public_key`) no decodifica certificados EC con parámetros explícitos, que es lo que recomienda ICAO (OpenSSL 3 tampoco los valida por defecto). Firmas con `:crypto`.
  - Comprobado contra los **385 CSCA autofirmados reales** de la master list alemana: 279 RSA (también PSS) y 106 EC, la mayoría con parámetros explícitos. Todas las firmas verifican.
- **Almacén de CSCA** (`TrustStore`): `priv/csca`, PEM/DER, `CSCA_PATHS`.
  - Incluye los CSCA españoles 2, 3 y 4 (RSA-4096), con las huellas comprobadas contra la web de la Policía, y los de las listas maestras del BSI y de los Países Bajos (638 certificados de 129 emisores, 2026-10-14), importados solo tras comprobar la firma de cada lista.
  - `mix cherry.csca` los lista y los extrae de una master list.
  - Procedencia y actualización: `apps/backend/priv/csca/README.md`.
- **Huella** (`Fingerprint`): HMAC-SHA256 con `DOCUMENT_FINGERPRINT_KEY`.
- **Datos**:
  - `age_verifications`: estado, método `nfc_dni | nfc_passport | provider | eu_wallet`, fecha y huella, con índice único (un documento, una cuenta).
  - `age_verification_attempts`: solo fechas, para el límite de intentos.
- **API**: `GET /api/me/verification`, `POST /api/me/verification/nfc` y, con Didit, `POST /api/me/verification/provider` y `POST /api/me/verification/provider/check` (ver [Selfie + documento con Didit](#selfie--documento-con-didit-backend-hecho-2026-10-13)).
  - Límite de 5 intentos por hora y 10 al día.
  - Errores tipados: `document_not_verified` + `reason`, `underage`, `document_already_used`, `too_many_attempts`…
  - Documentado en OpenAPI, `docs/06` y `packages/contracts/src/verification.ts`.
- **Privacidad**:
  - `dg1`, `dg2`, `sod`, `can` y `mrz` están en `:filter_parameters` (hay un test que comprueba `[FILTERED]` en los logs de Phoenix).
  - Un fallo interno se registra sin argumentos ni mensaje.
  - El log de resultado no lleva el usuario, así que no dice quién es menor.
  - En dev hay diagnóstico de rechazos con datos públicos del certificado del firmante.
- **`AGE_VERIFICATION_REQUIRED`** (desactivado por defecto). Con `true`:
  - discovery, perfiles públicos, likes, matches y conversaciones responden 403 `age_verification_required` hasta verificarse;
  - siguen abiertos el perfil propio, el bootstrap, la propia verificación, bloquear y reportar;
  - el flag se publica en `/api/config`.
- **Tests**: 110 nuevos en el backend (545 en total) y 31 en móvil, más 5 en contratos y mobile-shared. Usan una PKI sintética generada en los tests y SOD firmados por `openssl cms`.
  - Cubren: caso válido, firma inválida, DG manipulado, cadena rota, certificado caducado o aún no válido, extensiones críticas, menores, cumpleaños el día justo y 29 de febrero, MRZ con dígitos de control erróneos (especímenes de ICAO 9303), huella, documento ya usado, límite de intentos, logs y la API.

**Móvil (`apps/mobile`)**

- **Módulo `modules/document-nfc`** (Expo Modules API). `readDocument({ can } | { mrz })` devuelve `{ dg1, dg2, sod }` en base64, con errores tipados.
  - **Android:** JMRTD 0.8.9 + SCUBA (LGPL-2.1+), modo lector NFC, PACE con CAN y PACE/BAC con MRZ. **Compila y enlaza** en un APK debug arm64.
  - **iOS:** NFCPassportReader 2.3.3 (MIT) incorporado con parches: PACE con CAN, sin BAC con CAN, sin logs de la clave y la corrección de la palabra de estado (`PATCHES.md`). OpenSSL-Universal 3.6.2000 (Apache-2.0). **Sin compilar**: solo se ha validado la sintaxis.
  - Config plugin:
    - `NFCReaderUsageDescription`;
    - AID `A0000002471001`;
    - entitlement NFC `TAG`;
    - permiso NFC y `android.hardware.nfc` opcional;
    - exclusiones de `META-INF` de BouncyCastle.
- **Pantalla de prueba** `(dev)/verify-document`, también desde Ajustes → Pruebas, solo en `__DEV__`.
  - Explica qué se lee, qué se guarda y qué se borra.
  - Pide el CAN con un dibujo de dónde está, o los datos del pasaporte.
  - **Tarjetas sin CAN** (algunos documentos de identidad extranjeros): «Mi documento no tiene CAN» abre el chip con los datos de la MRZ (número del documento y fechas de nacimiento y caducidad). Si el CAN falla o el chip no lo admite, el error ofrece «Probar con los datos del documento».
  - En Android, si el chip anuncia varias variantes de PACE, se prueban todas antes de dar la clave por incorrecta o pasar a BAC.
  - Muestra los estados de lectura, envío, éxito y error con su acción.

### Decisiones tomadas esta noche (revisables)

1. **Parser DER/X.509 propio en vez de `:public_key`.** OTP 28 falla con los certificados EC de parámetros explícitos, que son habituales en eMRTD (172 de 609 en la master list alemana). El parser es pequeño, no depende de módulos ASN.1 internos de OTP y está probado contra certificados reales.
2. **La huella sigue a la persona en DNI y TIE.**
   - En tarjetas españolas se calcula con el número de DNI/NIE de los datos opcionales de la MRZ (`v1|ESP|ID|<número>`), que no cambia al renovar.
   - En pasaportes y documentos extranjeros se calcula con el número del documento. Todas las tarjetas (TD1 y TD2, con código `I`, `A` o `C`) usan la letra `I`, igual que Didit, para que una tarjeta dé la misma huella por los dos métodos.
   - **No se usa el «número personal» del pasaporte**: en pasaportes de menores sin DNI puede llevar el DNI de un progenitor (sin verificar del todo; ver fuentes del informe), y eso bloquearía a una persona por otra.
   - Consecuencia: un DNI y un pasaporte de la misma persona dan huellas distintas, así que podría haber dos cuentas.
3. **Validez a fecha de hoy.**
   - Del certificado del firmante y del CSCA: si alguno ha caducado, `certificate_expired`.
   - Del propio documento según la MRZ: si ha caducado, `document_expired`. Si no, cada pasaporte antiguo sería una huella nueva y, por tanto, una cuenta más. Se acepta un documento sin fecha de caducidad legible.
   - Es lo prudente; ver «DNI permanente» abajo.
   - **La edad se mira antes que la caducidad** (2026-10-14). Si las firmas son correctas, un certificado caducado no impide leer la fecha de nacimiento: un documento caducado de un menor da `underage` (y se borra la cuenta), no `document_expired` ni `certificate_expired`. Igual que con Didit.
4. **Edad con la fecha UTC.** Con día o mes desconocidos, el siglo se elige con la fecha más temprana posible y la edad con la más tardía (nunca hace a nadie mayor). Una edad de 120 años o más se trata como MRZ malformada. La fecha UTC es más estricta que la hora de Madrid: el día del cumpleaños se acepta desde la 01:00 o las 02:00 de España (según el horario). Las fechas con día o mes desconocidos (`<<`) se toman como la más tardía posible. Si nace un 29 de febrero, cumple el 1 de marzo en años no bisiestos.
5. **Ya verificado con otro documento → 409 `already_verified`**; el mismo documento → idempotente. Una verificación `revoked` no se sustituye sola.
6. **Intentos: solo se guarda la fecha** (ni el resultado ni nada del documento), y se purgan a las 24 h. Así no queda en la BD qué cuentas intentaron verificarse siendo menores.
7. **El certificado del firmante debe venir dentro del SOD.** ICAO lo exige y no se mantiene un almacén aparte de certificados de firmante.
8. **Endpoint activo si hay clave.** Sin `DOCUMENT_FINGERPRINT_KEY`, responde 503. En dev se usa una clave de relleno; en prod no hay valor por defecto y la clave tiene que tener al menos 32 caracteres.
9. **Android no toca el proveedor criptográfico global** (sin `Security.insertProviderAt`): JMRTD 0.8.9 usa su propia instancia de BouncyCastle. Si en el móvil falla con `NoSuchAlgorithmException`, este es el primer sitio que hay que mirar.

### Revisión de seguridad (2026-10-09)

Una revisión adversarial independiente no encontró forma de falsificar ni alterar datos firmados: un menor no puede cambiar su fecha de nacimiento.

**Corregido esta noche:**
- el error de siglo con día o mes desconocidos;
- los documentos caducados;
- la comprobación de la cadena antes de usar la clave del firmante;
- los límites de firmantes, certificados y OID;
- los nombres de certificado que no son UTF-8 (antes, un CSCA así tumbaba la verificación con un 500);
- la copia cruda del cuerpo de la petición en la conexión.

**Sigue abierto (decisiones tuyas):**
- **Suplantación con el documento de otro.** Un menor puede usar el DNI de su madre o de un hermano mayor, porque el CAN está impreso en la tarjeta. Quien lo haga primero «ocupa» la huella y el titular real recibe luego `document_already_used`. Además, ese 409 frente al 200 revela si esa persona ya tiene cuenta en una app de citas.
  - **No hay que activar `AGE_VERIFICATION_REQUIRED` ni presentar el NFC como suficiente** hasta tener la comparación selfie ↔ DG2.
  - Habría que añadir una vía de reclamación para el titular y valorar una respuesta menos reveladora.
- **Un DNI y un pasaporte en vigor de la misma persona** dan dos huellas, así que caben dos cuentas. Alternativas:
  - guardar varias huellas por verificación;
  - derivar la del DNI desde el pasaporte cuando el titular ya tenía 14 años al expedirlo.
- **Intento con resultado `underage`:** se borra la cuenta entera (decisión del 2026-10-13) y no se guarda nada del documento. Quien lo intente con el DNI de su madre justo después tiene que volver a registrarse desde cero; frenarlo del todo exige la comparación con el selfie.
- **Límite de cuerpo:** el JSON se parsea con el límite general de Phoenix (8 MB) antes de los límites del controlador. El límite de 5 intentos por hora acota el abuso; un límite por ruta sería mejor.
- **SHA-1 y SOD sin atributos firmados** se aceptan por compatibilidad con documentos antiguos. No es explotable, pero se pueden restringir a SHA-2 si los DNI españoles reales lo usan siempre.

### Problemas abiertos

- **Sin probar con hardware**: la lectura real en Android y en iPhone, la compilación de iOS y un SOD español real (algoritmos y DN reales del firmante).
- **DNI permanente (mayores de 70):** la fecha de caducidad de la MRZ y la validez del certificado del firmante se desconocen [sin verificar]. Si el certificado del firmante caduca antes que el documento, se rechazaría. Hay que probarlo con un DNI permanente.
- **Clonado y reutilización:** la autenticación pasiva prueba que los datos son del Estado, no que el chip sea el original ni que lo tenga quien usa el móvil.
  - Un volcado de DG1/DG2/SOD del DNI de otra persona (por ejemplo, de un hermano mayor) pasaría.
  - La huella impide reutilizarlo en una segunda cuenta, pero no en la primera.
  - Lo cubre la fase de selfie ↔ DG2. Autenticación activa o de chip como refuerzo opcional (se verifica en el móvil).
- **CRL:** no se consulta la lista de revocación de la Policía (`ESP.crl`). Revocar un certificado de firmante es raro, pero existe.
- **Huella y borrado de cuenta:**
  - Con el borrado de cuenta actual (lógico), la fila de verificación se conserva, así que la persona no podría verificarse de nuevo en una cuenta nueva.
  - Con un borrado físico, `ON DELETE CASCADE` la elimina.
  - Hay que decidir el plazo de conservación de la huella tras un borrado o un baneo (base legal: interés legítimo anti-fraude) y recogerlo en la EIPD (`06`).
- **Clave de huella:** no se puede rotar sin volver a leer los documentos. Hay que guardarla con los backups.
- **Obligatoriedad:** el flag bloquea la API REST social, pero falta:
  - excluir de los feeds a los perfiles no verificados;
  - comprobarlo en el WebSocket del chat;
  - el paso de verificación en el onboarding.
- **Documentos extranjeros por NFC:** se aceptan los de los países de `priv/csca` (unos 129). Sin probar con documentos reales de otros países. La huella usa el número del documento, así que cambia al renovarlo (como con los pasaportes).
- **Cobertura del backend:** `mix test --cover` ya estaba por debajo del umbral del 90 % antes de esta rama (86,9 % en `feat/kawaii-overhaul`). No es una regresión; se deja anotado.

## Investigación: selfie ↔ DG2 y prueba de vida (sin construir)

*2026-10-09. Informe completo de la investigación nocturna, resumido. Las licencias de los pesos son el punto crítico.*

**Conclusión:** no existe un modelo abierto de reconocimiento facial que tenga a la vez pesos con licencia permisiva explícita, datos de entrenamiento limpios para uso comercial y precisión de primera línea. Los precisos (InsightFace `buffalo_l`/`antelopev2`, AdaFace, EdgeFace, GhostFaceNets…) están entrenados con MS1M, WebFace, Glint360K o VGGFace2, que son «solo investigación». Los pesos de InsightFace son explícitamente no comerciales; venden una licencia comercial, sin precio público.

**Propuesta, con poca integración y licencias permisivas declaradas:**
- **Detección:** YuNet (OpenCV Zoo, MIT).
- **Reconocimiento:** SFace (OpenCV Zoo, Apache-2.0, unos 5–18 ms por cara en CPU). **Sus datos de entrenamiento no están documentados** (issues #124, #313 y #318 sin respuesta).
- **Prueba de vida pasiva:** MiniFASNet de Silent-Face (Apache-2.0, datos tampoco declarados), sobre 2–3 fotogramas.
- Todo dentro del propio Phoenix con [`evision`](https://github.com/cocoa-xu/evision) (Apache-2.0): trae `FaceDetectorYN`, `FaceRecognizerSF` y DNN para ONNX, y debería decodificar el JPEG 2000 del DG2 con OpenJPEG (falta confirmarlo en el binario precompilado).
- Coste: menos de 100 ms por verificación con un hilo; despreciable para unos miles al día.
- **Los pesos no van en el repo:** script de descarga con sha256 y un fichero de procedencia y licencias. El reconocedor debe ser intercambiable, para pasar a `buffalo_l` con licencia si SFace no da la talla.

**Precisión:** las cifras de LFW no sirven. Comparar la foto de un documento (unos 240×320 px, JPEG 2000 comprimido, hasta 10 años de diferencia) con un selfie es mucho más difícil: un reconocedor genérico bajó al 59 % de aciertos a FAR 0,1 % en DocFace+. Hay que calibrar con datos propios antes de producción:
- unas 55–60 personas voluntarias con consentimiento;
- medir el FNMR a un FMR fijo;
- tres franjas: aceptar, revisión humana y rechazar.

**Amenazas:** la prueba de vida pasiva detecta papel y pantallas, pero no las imágenes inyectadas (cámara virtual, emulador, APK modificada). Contra eso:
- Play Integrity (`MEETS_DEVICE_INTEGRITY`) y App Attest, con el hash del selfie y un nonce del servidor dentro del veredicto;
- nonce de un solo uso;
- límite de intentos.

**Legal:** la AEPD considera que la verificación 1:1 también trata datos del art. 9 RGPD. Eso exige:
- consentimiento explícito, con una alternativa sin biometría;
- EIPD previa;
- procesar en memoria sin guardar plantillas;
- revisión humana de los rechazos.

**Validar primero:**
1. Que evision decodifica el JPEG 2000 de un DG2 real.
2. La procedencia de SFace por escrito, y una revisión legal.
3. Un conjunto de calibración con consentimiento.
4. Ataques propios contra MiniFASNet.
5. Que la atestación queda ligada al selfie.
6. La EIPD.

## Fuentes

- [CNMC – Art. 28 de la DSA](https://www.cnmc.es/sites/default/files/editor_contenidos/DSA/20260324_DSA%20guidelines%20art28.pdf) · [Directrices del art. 28](https://digitalpoland.org/en/blog/2025/07/european-commission-publishes-dsa-article-28-guidelines-on-protection-of-minors)
- [Ley de menores en el Congreso (septiembre de 2026)](https://diariodeavisos.elespanol.com/2026/09/ley-menores-16-redes-sociales-espana/) · [Proyecto de ley (BOCG)](https://www.congreso.es/public_oficiales/L15/CONG/BOCG/A/BOCG-15-A-52-1.PDF)
- [Comisión Europea – app de verificación de edad](https://commission.europa.eu/news-and-media/news/european-age-verification-app-keep-children-safe-online-2026-04-15_en) · [FAQ de la solución europea](https://digital-strategy.ec.europa.eu/en/faqs/eu-age-verification-solution) · [Cartera Digital Beta (elDiario.es)](https://www.eldiario.es/tecnologia/cartera-digital-beta-app-gobierno-bloquear-acceso-menores-16-anos-redes-sociales_1_12976242.html)
- [Ofcom y apps de citas](https://www.globaldatinginsights.com/featured/ofcom-mandates-stricter-age-verification-for-dating-apps/) · [Tinder Face Check](https://www.biometricupdate.com/202510/match-group-making-face-liveness-mandatory-for-us-tinder-users)
- [YOiD – lectura NFC del DNI](https://yoid.es/es/servicios/lectura-dni-nfc) · [NFCPassportReader](https://github.com/AndyQ/NFCPassportReader) · [MRTDReader](https://github.com/arsenstorm/MRTDReader)
