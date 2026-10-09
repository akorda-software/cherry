# Mayoría de edad

**Estado:** prototipo en la rama `feat/dni-nfc` (ver [Estado del prototipo](#estado-del-prototipo)). Autenticación pasiva en el servidor, modelo de datos, API y módulo NFC construidos; falta probarlo con un DNI real ([guía](./02-nfc-pruebas-manana.md)). La verificación todavía no es obligatoria: el registro sigue pidiendo solo la fecha de nacimiento y exige 18+.

## Por qué

- **Pedir solo la fecha de nacimiento ya no es una verificación válida.** Las directrices de la Comisión sobre protección de menores (art. 28 de la DSA, julio de 2025) dicen que declarar la edad no basta y ponen las webs de citas para adultos como ejemplo de servicio que necesita comprobarla. La Comisión ya ha usado ese criterio contra Meta.
- **Matiz legal:** el art. 19 de la DSA exime a micro y pequeñas empresas de la sección donde está el art. 28, así que hoy probablemente no obliga a Snack de forma estricta. Pero:
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

**Qué documentos:** DNI 3.0 y 4.0 (desde 2015), NIE con chip y pasaportes electrónicos. Todos siguen el estándar ICAO 9303 (eMRTD).

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
- Obtener y mantener al día los **certificados CSCA** españoles (y de otros países si se aceptan pasaportes extranjeros).
- **Dato biométrico y documento de identidad** → exige EIPD y consentimiento explícito (ver `06`).

## 2. Proveedor externo (respaldo)

Para quien no tenga móvil con NFC, tenga un documento sin chip o falle la lectura. Selfie con prueba de vida y estimación de edad; si la edad estimada queda cerca del límite, documento. Candidatos y precios en `08`. Con el NFC como vía principal, el proveedor solo lo usa una minoría, así que el coste es asumible (sobre todo dentro de las 500 gratis al mes de Didit).

## 3. App europea de verificación de edad

La Comisión presentó en abril de 2026 una app gratuita y de código abierto que confirma «mayor de edad: sí/no» sin revelar ningún otro dato. España está entre los países piloto (con la Cartera Digital Beta) y la Comisión pide que esté disponible en todos los países a finales de 2026 o en enero de 2027. Es gratis también para las plataformas.

Limitación: solo da sí/no, **no evita cuentas duplicadas** ni comprueba que la cara del perfil sea la de quien verifica. Por eso sería una opción adicional, no la principal. Además, un análisis de seguridad de marzo de 2026 encontró un fallo de arquitectura en su emisor.

## Señales de las tiendas

- **Google Play:** «Restrict Declared Minors» activado (obligatorio, `01`).
- **Apple:** la Declared Age Range API se puede leer como señal adicional; en España no es obligatoria.

## Plan

1. [~] Prototipo NFC: leer DG1/DG2/SOD de un DNI real en Android y iPhone desde un módulo Expo. *Módulo escrito (`apps/mobile/modules/document-nfc`); Android compila; iOS sin compilar; sin probar con un DNI real.*
2. [x] Autenticación pasiva en el backend con los certificados CSCA españoles. *Probada con PKI sintética y fixtures de OpenSSL; falta un SOD español real.*
3. [ ] Comparación de caras selfie ↔ DG2 con modelo de código abierto en el servidor. *Investigación hecha (abajo); sin construir.*
4. [x] Modelo de datos: estado de verificación del perfil + huella del documento; borrado inmediato del resto.
5. [~] Pantallas de verificación en el onboarding (antes de que el perfil sea visible). *Hay una pantalla de prueba en la ruta de desarrollo; no está en el onboarding.*
6. [ ] Integración del proveedor de respaldo.
7. [ ] Integración de la app europea cuando esté disponible en España.

## Estado del prototipo

*Actualizado el 2026-10-09, rama `feat/dni-nfc`. Pruebas con documento real: [`02-nfc-pruebas-manana.md`](./02-nfc-pruebas-manana.md).*

### Qué hay

**Backend (`apps/backend`)**

- `Snack.Identity.Document.PassiveAuth`: autenticación pasiva completa (ICAO 9303-11).
  - SOD (CMS SignedData + LDSSecurityObject): firma del SignerInfo con atributos firmados, comprobando `contentType` y `messageDigest`.
  - Certificado del firmante dentro del SOD, validado contra un CSCA de confianza: nombre, AKI/SKI, firma, validez de ambos, uso de clave, que no sea CA y que no tenga extensiones críticas desconocidas.
  - Hashes de DG1 y DG2.
  - MRZ TD1 (DNI, TIE) y TD3 (pasaporte) con todos los dígitos de control.
  - Algoritmos: RSA PKCS#1 v1.5, RSASSA-PSS, ECDSA (DER y *plain* de BSI) con curvas NIST y brainpool, también con parámetros explícitos; SHA-1/224/256/384/512.
- **Lector DER y X.509 propios** (`Der`, `Certificate`). OTP 28 (`:public_key`) no decodifica certificados EC con parámetros explícitos, que es lo que recomienda ICAO (OpenSSL 3 tampoco los valida por defecto). Firmas con `:crypto`.
  - Comprobado contra los **385 CSCA autofirmados reales** de la master list alemana: 279 RSA (también PSS) y 106 EC, la mayoría con parámetros explícitos. Todas las firmas verifican.
- **Almacén de CSCA** (`TrustStore`): `priv/csca`, PEM/DER, `CSCA_PATHS`.
  - Incluye los CSCA españoles 2, 3 y 4 (RSA-4096), con las huellas comprobadas contra la web de la Policía.
  - `mix snack.csca` los lista y los extrae de una master list.
  - Procedencia y actualización: `apps/backend/priv/csca/README.md`.
- **Huella** (`Fingerprint`): HMAC-SHA256 con `DOCUMENT_FINGERPRINT_KEY`.
- **Datos**:
  - `age_verifications`: estado, método `nfc_dni | nfc_passport | provider | eu_wallet`, fecha y huella, con índice único (un documento, una cuenta).
  - `age_verification_attempts`: solo fechas, para el límite de intentos.
- **API**: `GET /api/me/verification` y `POST /api/me/verification/nfc`.
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
  - Muestra los estados de lectura, envío, éxito y error con su acción.

### Decisiones tomadas esta noche (revisables)

1. **Parser DER/X.509 propio en vez de `:public_key`.** OTP 28 falla con los certificados EC de parámetros explícitos, que son habituales en eMRTD (172 de 609 en la master list alemana). El parser es pequeño, no depende de módulos ASN.1 internos de OTP y está probado contra certificados reales.
2. **La huella sigue a la persona en DNI y TIE.**
   - En tarjetas españolas se calcula con el número de DNI/NIE de los datos opcionales de la MRZ (`v1|ESP|ID|<número>`), que no cambia al renovar.
   - En pasaportes y documentos extranjeros se calcula con el número del documento.
   - **No se usa el «número personal» del pasaporte**: en pasaportes de menores sin DNI puede llevar el DNI de un progenitor (sin verificar del todo; ver fuentes del informe), y eso bloquearía a una persona por otra.
   - Consecuencia: un DNI y un pasaporte de la misma persona dan huellas distintas, así que podría haber dos cuentas.
3. **Validez de los certificados a fecha de hoy**, tanto del firmante como del CSCA. Un DNI cuyo certificado de firmante haya caducado se rechaza (`certificate_expired`). Es lo prudente; ver «DNI permanente» abajo.
4. **Edad con la fecha UTC.** Es más estricta que la hora de Madrid: el día del cumpleaños se acepta desde la 01:00 o las 02:00 de España (según el horario). Las fechas con día o mes desconocidos (`<<`) se toman como la más tardía posible. Si nace un 29 de febrero, cumple el 1 de marzo en años no bisiestos.
5. **Ya verificado con otro documento → 409 `already_verified`**; el mismo documento → idempotente. Una verificación `revoked` no se sustituye sola.
6. **Intentos: solo se guarda la fecha** (ni el resultado ni nada del documento), y se purgan a las 24 h. Así no queda en la BD qué cuentas intentaron verificarse siendo menores.
7. **El certificado del firmante debe venir dentro del SOD.** ICAO lo exige y no se mantiene un almacén aparte de certificados de firmante.
8. **Endpoint activo si hay clave.** Sin `DOCUMENT_FINGERPRINT_KEY`, responde 503. En dev se usa una clave de relleno; en prod no hay valor por defecto y la clave tiene que tener al menos 32 caracteres.
9. **Android no toca el proveedor criptográfico global** (sin `Security.insertProviderAt`): JMRTD 0.8.9 usa su propia instancia de BouncyCastle. Si en el móvil falla con `NoSuchAlgorithmException`, este es el primer sitio que hay que mirar.

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
- **Pasaportes extranjeros:** solo se aceptan documentos cuyo CSCA esté en `priv/csca` (hoy, España). Para aceptar otros países habría que importar sus CSCA (master list del BSI) y revisar la MRZ de cada uno.
- **Cobertura del backend:** `mix test --cover` ya estaba por debajo del umbral del 90 % antes de esta rama (86,9 % en `feat/kawaii-overhaul`). No es una regresión; se deja anotado.

## Fuentes

- [CNMC – Art. 28 de la DSA](https://www.cnmc.es/sites/default/files/editor_contenidos/DSA/20260324_DSA%20guidelines%20art28.pdf) · [Directrices del art. 28](https://digitalpoland.org/en/blog/2025/07/european-commission-publishes-dsa-article-28-guidelines-on-protection-of-minors)
- [Ley de menores en el Congreso (septiembre de 2026)](https://diariodeavisos.elespanol.com/2026/09/ley-menores-16-redes-sociales-espana/) · [Proyecto de ley (BOCG)](https://www.congreso.es/public_oficiales/L15/CONG/BOCG/A/BOCG-15-A-52-1.PDF)
- [Comisión Europea – app de verificación de edad](https://commission.europa.eu/news-and-media/news/european-age-verification-app-keep-children-safe-online-2026-04-15_en) · [FAQ de la solución europea](https://digital-strategy.ec.europa.eu/en/faqs/eu-age-verification-solution) · [Cartera Digital Beta (elDiario.es)](https://www.eldiario.es/tecnologia/cartera-digital-beta-app-gobierno-bloquear-acceso-menores-16-anos-redes-sociales_1_12976242.html)
- [Ofcom y apps de citas](https://www.globaldatinginsights.com/featured/ofcom-mandates-stricter-age-verification-for-dating-apps/) · [Tinder Face Check](https://www.biometricupdate.com/202510/match-group-making-face-liveness-mandatory-for-us-tinder-users)
- [YOiD – lectura NFC del DNI](https://yoid.es/es/servicios/lectura-dni-nfc) · [NFCPassportReader](https://github.com/AndyQ/NFCPassportReader) · [MRTDReader](https://github.com/arsenstorm/MRTDReader)
