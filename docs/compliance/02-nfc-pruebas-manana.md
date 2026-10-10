# Pruebas con un DNI real (Android e iPhone)

Guía para probar con tu DNI físico lo construido en la rama `feat/dni-nfc` (estado en
[`02-mayoria-de-edad.md`](./02-mayoria-de-edad.md#estado-del-prototipo)).

**Qué está probado y qué no:**

- La autenticación pasiva del servidor está probada con una PKI sintética, con SOD firmados por OpenSSL
  y contra los 385 CSCA reales de la master list alemana. Los CSCA españoles ya vienen en el código.
  **Nunca se ha verificado un SOD español real.**
- El módulo Android compila y enlaza en un APK debug. **Nunca ha leído un chip.**
- El módulo iOS **no se ha compilado nunca** (no había macOS); solo se ha validado la sintaxis Swift.

Con tu DNI no se guarda nada salvo «mayor de edad: sí», el método, la fecha y la huella cifrada. El CAN
no sale del móvil. Nada de esto se registra en logs.

## 0. Backend de desarrollo (una vez)

```bash
git checkout feat/dni-nfc
cd apps/backend
mix deps.get
mix ecto.migrate            # crea age_verifications y age_verification_attempts en cherry_dev
mix cherry.csca              # debe listar CSCA SPAIN 2, 3 y 4 (anchor: true)
mix phx.server              # puerto 4000
```

- En dev no hace falta `DOCUMENT_FINGERPRINT_KEY` (se usa un valor de relleno).
- Deja visible la salida del servidor. Con cada intento aparece una línea:
  - `age verification: verified (CSCA 1c2c6ff09f78a3bc)`: es el éxito. El prefijo de la huella dice
    qué CSCA ha firmado: `1c2c6ff0…` es CSCA 4, `bf105c14…` CSCA 3 y `90eb8108…` CSCA 2.
  - `age verification: rejected (<motivo>)`: el documento se ha rechazado. Si el motivo es de
    autenticación pasiva, la siguiente línea es `age verification diagnostics (…)`, con los datos
    públicos del certificado del firmante. Cópiala.

**Comprobar lo guardado** en la BD de dev:

```sql
SELECT user_id, status, method, verified_at, encode(document_fingerprint, 'hex') FROM age_verifications;
```

**Repetir pruebas:**

- Hay un límite de 5 intentos por hora y 10 al día por cuenta. Para reiniciarlo, en `cherry_dev`:
  `DELETE FROM age_verification_attempts;`.
- Para volver a verificar con otra cuenta el mismo DNI: `DELETE FROM age_verifications;`.

## 1. Android

**Requisitos:** un móvil con NFC (Ajustes → Conexiones → NFC activado) y tu DNI 3.0 o 4.0, es decir,
expedido desde 2015, con el símbolo de chip sin contactos. El DNIe anterior (2006–2015) no tiene NFC.

1. **Instala el dev client nuevo.** El módulo es nativo: el APK anterior no lo lleva.
   - Ya hay un APK debug compilado esta noche desde esta rama:
     `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` (arm64).
   - Para recompilarlo:
     ```bash
     cd apps/mobile && npx expo prebuild -p android
     cd android && ./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
     ```
     Con `JAVA_HOME` en el JDK 21 y `ANDROID_HOME=~/.local/share/android-sdk`.
   - Para instalarlo, con el túnel USB de siempre: `adb install -r app-debug.apk`, o el
     `mobile-dev.sh install` de la skill.
2. **Metro.** `systemctl --user restart metro@cherry` (puerto 8086), para que sirva la rama nueva. Abre
   la app con:
   `adb shell am start -a android.intent.action.VIEW -d "exp+cherry://expo-development-client/?url=http%3A%2F%2F192.168.0.139%3A8086"`.
3. **Entra.** Usa «Entrar como usuario nuevo» (caja «Solo en desarrollo»). La verificación necesita una
   sesión real contra el backend.
4. **Abre la pantalla.** Yo → Ajustes → **Pruebas → Comprobar mi edad**. También con
   `adb shell am start -a android.intent.action.VIEW -d "cherry://verify-document"`.
5. **Haz la prueba.**
   - Pulsa **Empezar**.
   - Escribe el **CAN**: las 6 cifras de la cara de la foto, abajo a la derecha.
   - Pulsa **Leer el DNI**.
   - Apoya el DNI plano en la parte de atrás del móvil, hacia el centro (en muchos Samsung, más
     arriba), **y no lo muevas**. Tarda unos 5–15 s; la foto (DG2) es lo más lento.
6. **Resultado esperado.**
   - En el móvil: «Hecho: eres mayor de edad».
   - En el servidor: `age verification: verified (CSCA …)`.
   - En la BD: una fila con `method = nfc_dni`.
7. **Pruebas extra** (todas útiles):
   - **Repetir con la misma cuenta y el mismo DNI.** Debe dar éxito otra vez (es idempotente).
   - **Otra cuenta con el mismo DNI.** Sal y usa «Entrar como usuario nuevo». Debe aparecer «Este
     documento ya está en otra cuenta».
   - **CAN equivocado** (cambia una cifra). Debe aparecer «El CAN no coincide».
   - **Retirar el DNI a mitad de lectura.** Debe aparecer «Se ha movido el documento».
   - **NFC apagado.** Debe aparecer «Activa el NFC», con el botón a los ajustes.
   - **Pasaporte electrónico**, si tienes. Usa «Tengo pasaporte», con el número y las fechas de la
     página de la foto.

**Logs del móvil:** `adb logcat ReactNativeJS:V AndroidRuntime:E *:S`. Los nativos los ves con
`adb logcat | grep -i -E "documentnfc|jmrtd|nfc"`.

## 2. iPhone

**Requisitos:**
- iPhone 7 o posterior con iOS 15.1 o superior, y un Mac con Xcode.
- El App ID `app.cherry.mobile` (o el que uses en `EXPO_IOS_BUNDLE_IDENTIFIER`) con la capability
  **NFC Tag Reading** activada en developer.apple.com, y un perfil de aprovisionamiento que la incluya.
  Probablemente hace falta la cuenta de pago del Apple Developer Program [sin comprobar].

1. **Compila el dev client.**
   ```bash
   git checkout feat/dni-nfc && pnpm install
   cd apps/mobile && npx expo prebuild -p ios
   npx expo run:ios --device     # con el iPhone conectado
   ```
   `prebuild` añade:
   - el texto `NFCReaderUsageDescription`;
   - el identificador `A0000002471001`;
   - el entitlement `com.apple.developer.nfc.readersession.formats = [TAG]`.

   El pod `OpenSSL-Universal` (3.6.2000) se descarga en `pod install`.
2. **Errores de compilación probables.** Es la primera vez que se compila, así que es lo más probable
   que falle:
   - **Swift en `ios/DocumentNfcModule.swift`.** Errores de tipos con `GenericException`, `Promise`
     o `withTaskCancellationHandler`.
   - **`import OpenSSL` no encontrado.** Revisa que `pod install` ha traído `OpenSSL-Universal` y que el
     target del pod `DocumentNfc` lo enlaza.
   - **Símbolos duplicados.** Puede ocurrir si alguna otra dependencia trae su propio OpenSSL.

   Copia el error completo: los parches de la librería incorporada están en
   `modules/document-nfc/ios/NFCPassportReader/PATCHES.md`.
3. Entra igual que en Android y abre **Yo → Ajustes → Pruebas → Comprobar mi edad**.
4. Tras **Leer el DNI**, iOS muestra su hoja «Acerca la parte de arriba del iPhone…». Pon el DNI en la
   parte de arriba de la espalda del iPhone, junto a las cámaras, y no lo muevas.
5. El resultado esperado y las pruebas extra son los mismos que en Android, salvo «NFC apagado» (en
   iPhone no se puede apagar).

**Error al abrir la hoja NFC con «Missing required entitlement»:** el perfil de aprovisionamiento no
incluye NFC Tag Reading.

## 3. Fallos probables y cómo reconocerlos

En desarrollo, la pantalla de error muestra «Detalle técnico: …» con el código exacto. Anótalo.

| Lo que ves | Detalle técnico | Causa probable | Qué hacer |
|---|---|---|---|
| «Este móvil no puede leer el chip» con NFC | `NFC_UNAVAILABLE` | El dev client instalado no lleva el módulo | Reinstala el APK o recompila iOS |
| «El CAN no coincide» con el CAN bien escrito | `ACCESS_DENIED` | PACE falla: parámetros del chip o, en iOS, el parche de CAN | Logs nativos. Prueba otra vez: a veces el primer PACE falla por mover el DNI |
| «Se ha movido el documento» una y otra vez | `TAG_LOST` | Posición de la antena, funda gruesa o se mueve | Sin funda, prueba otras zonas; quieto 15 s |
| «No podemos leer este documento» | `UNSUPPORTED_DOCUMENT` | DNI sin PACE en EF.CardAccess, DNIe antiguo u otra tarjeta | Comprueba que el DNI es de 2015 o posterior |
| «No ha llegado ningún documento» | `TIMEOUT` | No se detectó el chip en 90 s (en iOS, ~60 s del sistema) | Busca la antena moviendo el DNI despacio |
| «No hemos podido comprobar el documento» | `untrusted_certificate` | El emisor del firmante no casa con los CSCA (otro DN, CSCA nuevo) | Mira `issuer` y `authority_key_id` en el diagnóstico del servidor y compáralos con los de `mix cherry.csca` |
| Ídem | `certificate_expired` | El certificado del firmante o el CSCA está caducado hoy (p. ej. un DNI caducado) | Mira `not_after` en el diagnóstico. Ver «DNI permanente» en problemas abiertos |
| Ídem | `invalid_signature` | Algoritmo de firma no previsto (parámetros PSS, ECDSA…) | El diagnóstico trae `signature_algorithm` (OID) |
| Ídem | `data_group_mismatch` | El móvil no envió los bytes exactos del chip | ¿Pasa en las dos plataformas o solo en una? Anótalo |
| Ídem | `malformed_sod` / `missing_document_signer` | Variante de codificación del SOD o firmante sin certificado dentro | El diagnóstico dice qué parte se lee |
| Ídem | `malformed_dg1` / `invalid_check_digit` | Variante de la MRZ | Revisa el formato de la MRZ (sin compartir los datos) |
| «El documento está caducado» | `document_expired` | La fecha de caducidad de la MRZ ya ha pasado (o un DNI permanente codificado de forma inesperada) | Si el documento está en vigor, anota el caso |
| «Cherry es para mayores de edad» siendo mayor | `underage` | Fecha mal interpretada (siglo) | Muy improbable. Anótalo |
| «Demasiados intentos» | `too_many_attempts` | Más de 5 intentos en una hora | `DELETE FROM age_verification_attempts;` |
| «Algo se ha torcido» | `network` / `HTTP 401` | El móvil no llega al backend o la sesión caducó | Revisa `EXPO_PUBLIC_API_BASE_URL_*` y vuelve a entrar |
| «La comprobación no está disponible» | `age_verification_unavailable` | Backend sin `DOCUMENT_FINGERPRINT_KEY` (solo pasa fuera de dev) | Define la variable |

## 4. Qué apuntar para seguir

- Móvil, versión del sistema y versión del DNI (3.0 o 4.0, año de expedición). No hace falta ningún
  dato del DNI.
- Para cada prueba: lo que salió en pantalla y el «Detalle técnico».
- Del servidor: la línea `age verification: …` y, si sale, la de `diagnostics`. Son datos públicos
  del certificado del firmante.
- En iOS, si no compila: el primer error completo de Xcode.
