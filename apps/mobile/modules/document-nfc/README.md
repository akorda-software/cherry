# document-nfc

Módulo Expo local (Expo Modules API) que lee por NFC el chip de documentos de identidad
ICAO 9303: DNI 3.0/4.0, documentos de identidad y pasaportes. Devuelve **DG1 y EF.SOD sin interpretar**,
en base64, para enviarlos a `POST /api/me/verification/nfc`. La autenticación pasiva se hace en el
servidor: el móvil no decide nada (una app manipulada podría mentir). La foto del chip (DG2) no
se lee: para la edad bastan la MRZ y la firma del Estado.

Diseño y estado: `docs/compliance/02-mayoria-de-edad.md`. Pruebas con documento real:
`docs/compliance/02-nfc-pruebas-manana.md`.

## API (`index.ts`)

```ts
getNfcStatus(): Promise<"unavailable" | "disabled" | "enabled">
readDocument({ can: "123456" }): Promise<{ dg1, sod }>                  // DNI y tarjetas con CAN
readDocument({ mrz: { documentNumber, dateOfBirth, dateOfExpiry } })   // pasaportes y tarjetas sin CAN (AAMMDD)
cancelRead(); openNfcSettings(); addReadProgressListener(fn)
```

Errores: `DocumentNfcError` con `code` en `NFC_UNAVAILABLE`, `NFC_DISABLED`, `ACCESS_DENIED` (CAN o
MRZ incorrectos), `TAG_LOST` (conexión con el chip perdida; en Android se reintenta sola hasta 3 veces antes), `UNSUPPORTED_DOCUMENT`,
`CANCELLED`, `TIMEOUT`, `BUSY`, `INVALID_KEY`, `UNKNOWN`. Sin el módulo nativo (web, Expo Go, dev
client compilado antes de añadirlo) `getNfcStatus` da `unavailable` y `readDocument` rechaza con
`NFC_UNAVAILABLE`.

El CAN y la MRZ solo viven en memoria durante la lectura; no se guardan ni se envían.

## Android (`android/`)

- [JMRTD](https://jmrtd.org) 0.8.9 (LGPL-2.1-or-later) + SCUBA `scuba-sc-android` 0.0.27
  (LGPL-2.1-or-later). Arrastran BouncyCastle 1.86 (licencia MIT de Bouncy Castle) y
  `cert-cvc` (LGPL-2.1). Todas compatibles con AGPL-3.0; al ser LGPL y enlazarse como
  bibliotecas independientes (AAR/JAR) se pueden sustituir.
- Modo lector de NFC (`enableReaderMode`) mientras la app está en primer plano; la lectura va en un
  hilo propio. PACE con CAN (sin alternativa BAC: un CAN no sirve para BAC); con MRZ, PACE si el
  chip lo anuncia en EF.CardAccess y si no BAC. Si el chip anuncia varias variantes de PACE (mapeo o
  curva), se prueban todas antes de dar el CAN por incorrecto o pasar a BAC.
- No se toca el proveedor criptográfico global: JMRTD 0.8.9 usa su propia instancia de BouncyCastle.
- Permiso `NFC` y `android.hardware.nfc` opcional en el `AndroidManifest.xml` del módulo.
  Exclusiones de `META-INF` duplicados de BouncyCastle: config plugin.
- Secuencia basada en `tananaev/passport-reader` (Apache-2.0) y `@2060.io/react-native-eid-reader` (MIT).

**Estado:** compila y enlaza en un APK debug (`assembleDebug`, arm64). Sin probar con un documento.

## iOS (`ios/`)

- [NFCPassportReader](https://github.com/AndyQ/NFCPassportReader) 2.3.3 de Andy Qua (MIT),
  incorporado en `ios/NFCPassportReader/` con parches para PACE con CAN (ver `PATCHES.md`).
- `OpenSSL-Universal` 3.6.2000 (Apache-2.0) vía CocoaPods.
- Config plugin: `NFCReaderUsageDescription`, identificador ISO 7816 `A0000002471001` (aplicación
  eMRTD) en `com.apple.developer.nfc.readersession.iso7816.select-identifiers`, y el entitlement
  `com.apple.developer.nfc.readersession.formats = [TAG]`. El App ID necesita la capability
  **NFC Tag Reading** activada en el portal de Apple Developer.

**Estado:** sin compilar (no había macOS); la sintaxis Swift se ha validado con `swiftc -parse`.
Sin probar con un documento.

## Config plugin

`plugin/with-document-nfc.cjs`, enganchado en `app.config.ts`. Los cambios nativos requieren
`expo prebuild` y recompilar el dev client.
