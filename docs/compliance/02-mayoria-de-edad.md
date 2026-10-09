# Mayoría de edad

**Estado:** enfoque decidido (D-2026-10-09); sin construir. Hoy solo se pide la fecha de nacimiento y se exige 18+.

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

1. [ ] Prototipo NFC: leer DG1/DG2/SOD de un DNI real en Android y iPhone desde un módulo Expo.
2. [ ] Autenticación pasiva en el backend con los certificados CSCA españoles.
3. [ ] Comparación de caras selfie ↔ DG2 con modelo de código abierto en el servidor.
4. [ ] Modelo de datos: estado de verificación del perfil + huella del documento; borrado inmediato del resto.
5. [ ] Pantallas de verificación en el onboarding (antes de que el perfil sea visible).
6. [ ] Integración del proveedor de respaldo.
7. [ ] Integración de la app europea cuando esté disponible en España.

## Fuentes

- [CNMC – Art. 28 de la DSA](https://www.cnmc.es/sites/default/files/editor_contenidos/DSA/20260324_DSA%20guidelines%20art28.pdf) · [Directrices del art. 28](https://digitalpoland.org/en/blog/2025/07/european-commission-publishes-dsa-article-28-guidelines-on-protection-of-minors)
- [Ley de menores en el Congreso (septiembre de 2026)](https://diariodeavisos.elespanol.com/2026/09/ley-menores-16-redes-sociales-espana/) · [Proyecto de ley (BOCG)](https://www.congreso.es/public_oficiales/L15/CONG/BOCG/A/BOCG-15-A-52-1.PDF)
- [Comisión Europea – app de verificación de edad](https://commission.europa.eu/news-and-media/news/european-age-verification-app-keep-children-safe-online-2026-04-15_en) · [FAQ de la solución europea](https://digital-strategy.ec.europa.eu/en/faqs/eu-age-verification-solution) · [Cartera Digital Beta (elDiario.es)](https://www.eldiario.es/tecnologia/cartera-digital-beta-app-gobierno-bloquear-acceso-menores-16-anos-redes-sociales_1_12976242.html)
- [Ofcom y apps de citas](https://www.globaldatinginsights.com/featured/ofcom-mandates-stricter-age-verification-for-dating-apps/) · [Tinder Face Check](https://www.biometricupdate.com/202510/match-group-making-face-liveness-mandatory-for-us-tinder-users)
- [YOiD – lectura NFC del DNI](https://yoid.es/es/servicios/lectura-dni-nfc) · [NFCPassportReader](https://github.com/AndyQ/NFCPassportReader) · [MRTDReader](https://github.com/arsenstorm/MRTDReader)
