# NFCPassportReader incorporado

Copia de [AndyQ/NFCPassportReader](https://github.com/AndyQ/NFCPassportReader) **2.3.3**
(`Sources/NFCPassportReader`, commit `6e37f1a`), licencia MIT (`LICENSE`, © 2019 Andy Qua).
Sin `Resources/PrivacyInfo.xcprivacy` (vacío: no declara datos ni APIs).

## Por qué se incorpora y no se usa como dependencia

- La versión publicada no admite **PACE con CAN**, que es lo que necesita el DNI (`PACEHandler`
  tenía `CAN_PACE_KEY_REFERENCE … // Not currently supported`). El PR #249 upstream lo añade pero
  no está fusionado. El fork MRTDReader lo intenta pero deriva mal la clave (SHA-1 del CAN).
- Las versiones 2.3.2 y 2.3.3 no están en CocoaPods trunk (dependen de `OpenSSL-Universal`
  3.6.0001, que no existe allí) y trunk deja de aceptar podspecs en diciembre de 2026.

## Parches de Cherry (todos marcados con `Cherry patch` en el código)

1. `PACEHandler.swift`: tipo de contraseña `PACEPasswordType` (`.mrz` / `.can`). Con CAN, referencia
   de clave 0x02 y semilla = el propio CAN (ICAO 9303-11: f(CAN) = CAN; f(MRZ) = SHA-1(MRZ)).
   Se quitan dos líneas de log que escribían la clave de acceso y la clave PACE derivada.
2. `PassportReader.swift`:
   - `readPassport(can:…)` (solo PACE, sin autenticación de chip). `readPassport(mrzKey:…)` igual que antes.
   - Con CAN, si PACE falla se lanza el error (no hay BAC posible con un CAN).
   - Las re-autenticaciones internas (`doBACAuthentication`) repiten PACE con CAN, volviendo al
     fichero maestro (lectura de EF.CardAccess) y seleccionando de nuevo la aplicación eMRTD.
   - `cancel()`: invalida la sesión NFC; el delegado devuelve `UserCanceled`.
3. `TagReader.swift`: la comprobación de la palabra de estado usaba `&&` y dejaba pasar `63 00`
   (clave incorrecta) como éxito; ahora cualquier respuesta distinta de `90 00` es error
   (equivale al PR #272 upstream).

**Sin probar en hardware.** No se ha compilado (no hay macOS en el entorno donde se escribió).

## Diff completo frente a upstream

```diff
diff -ru -x LICENSE -x Resources -x PATCHES.md upstream/PACEHandler.swift ./PACEHandler.swift
--- upstream/PACEHandler.swift	2026-10-09 22:51:02.347170064 +0000
+++ cherry/PACEHandler.swift	2026-10-09 23:17:31.042966378 +0000
@@ -35,6 +35,12 @@
     }
 }
 
+/// Cherry patch: PACE password type (MRZ or CAN). See PATCHES.md.
+public enum PACEPasswordType {
+    case mrz
+    case can
+}
+
 @available(iOS 15, *)
 public class PACEHandler {
     
@@ -72,7 +78,7 @@
         isPACESupported = true
     }
     
-    public func doPACE( mrzKey : String ) async throws {
+    public func doPACE( mrzKey : String, passwordType: PACEPasswordType = .mrz ) async throws {
         guard isPACESupported else {
             throw NFCPassportReaderError.NotYetSupported( "PACE not supported" )
         }
@@ -88,8 +94,9 @@
         digestAlg = try paceInfo.getDigestAlgorithm()  // Either SHA-1 or SHA-256.
         keyLength = try paceInfo.getKeyLength()  // Get key length  the enc cipher. Either 128, 192, or 256.
 
-        paceKeyType = PACEHandler.MRZ_PACE_KEY_REFERENCE
-        paceKey = try createPaceKey( from: mrzKey )
+        // Cherry patch: CAN uses key reference 0x02 and the CAN itself as the key seed.
+        paceKeyType = passwordType == .can ? PACEHandler.CAN_PACE_KEY_REFERENCE : PACEHandler.MRZ_PACE_KEY_REFERENCE
+        paceKey = try createPaceKey( from: mrzKey, passwordType: passwordType )
         
         // Temporary logging
         Logger.pace.debug("doPace - inpit parameters" )
@@ -100,8 +107,6 @@
         Logger.pace.debug("cipherAlg - \(self.cipherAlg)" )
         Logger.pace.debug("digestAlg - \(self.digestAlg)" )
         Logger.pace.debug("keyLength - \(self.keyLength)" )
-        Logger.pace.debug("keyLength - \(mrzKey)" )
-        Logger.pace.debug("paceKey - \(binToHexRep(self.paceKey, asArray:true))" )
 
         // First start the initial auth call
         _ = try await tagReader.sendMSESetATMutualAuth(oid: paceOID, keyType: paceKeyType)
@@ -599,9 +604,10 @@
     /// Computes a key seed based on an MRZ key
     /// - Parameter the mrz key
     /// - Returns a encoded key based on the mrz key that can be used for PACE
-    func createPaceKey( from mrzKey: String ) throws -> [UInt8] {
+    func createPaceKey( from mrzKey: String, passwordType: PACEPasswordType = .mrz ) throws -> [UInt8] {
         let buf: [UInt8] = Array(mrzKey.utf8)
-        let hash = calcSHA1Hash(buf)
+        // Cherry patch: K_pi = KDF_pi(f(pi)); f(MRZ) = SHA-1(MRZ information), f(CAN) = CAN (ISO 8859-1).
+        let hash = passwordType == .can ? buf : calcSHA1Hash(buf)
         
         let smskg = SecureMessagingSessionKeyGenerator()
         let key = try smskg.deriveKey(keySeed: hash, cipherAlgName: cipherAlg, keyLength: keyLength, nonce: nil, mode: .PACE_MODE, paceKeyReference: paceKeyType)
diff -ru -x LICENSE -x Resources -x PATCHES.md upstream/PassportReader.swift ./PassportReader.swift
--- upstream/PassportReader.swift	2026-10-09 22:51:02.347170064 +0000
+++ cherry/PassportReader.swift	2026-10-09 23:18:30.691474871 +0000
@@ -61,6 +61,7 @@
     private var caHandler : ChipAuthenticationHandler?
     private var paceHandler : PACEHandler?
     private var mrzKey : String = ""
+    private var passwordType : PACEPasswordType = .mrz
     private var aaChallenge: [UInt8]?
     private var dataAmountToReadOverride : Int? = nil
     
@@ -92,9 +93,19 @@
     }
     
     public func readPassport( mrzKey : String, tags : [DataGroupId] = [], aaChallenge: [UInt8]? = nil, skipSecureElements : Bool = true, skipCA : Bool = false, skipPACE : Bool = false, useExtendedMode : Bool = false, customDisplayMessage : ((NFCViewDisplayMessage) -> String?)? = nil) async throws -> NFCPassportModel {
-        
+        return try await readPassport(accessKey: mrzKey, passwordType: .mrz, tags: tags, aaChallenge: aaChallenge, skipSecureElements: skipSecureElements, skipCA: skipCA, skipPACE: skipPACE, useExtendedMode: useExtendedMode, customDisplayMessage: customDisplayMessage)
+    }
+
+    /// Cherry patch: read with the CAN (PACE only) or the MRZ key (PACE, then BAC).
+    public func readPassport( can : String, tags : [DataGroupId] = [], skipSecureElements : Bool = true, useExtendedMode : Bool = false, customDisplayMessage : ((NFCViewDisplayMessage) -> String?)? = nil) async throws -> NFCPassportModel {
+        return try await readPassport(accessKey: can, passwordType: .can, tags: tags, aaChallenge: nil, skipSecureElements: skipSecureElements, skipCA: true, skipPACE: false, useExtendedMode: useExtendedMode, customDisplayMessage: customDisplayMessage)
+    }
+
+    private func readPassport( accessKey : String, passwordType : PACEPasswordType, tags : [DataGroupId], aaChallenge: [UInt8]?, skipSecureElements : Bool, skipCA : Bool, skipPACE : Bool, useExtendedMode : Bool, customDisplayMessage : ((NFCViewDisplayMessage) -> String?)?) async throws -> NFCPassportModel {
+
         self.passport = NFCPassportModel()
-        self.mrzKey = mrzKey
+        self.mrzKey = accessKey
+        self.passwordType = passwordType
         self.aaChallenge = aaChallenge
         self.skipCA = skipCA
         self.skipPACE = skipPACE
@@ -274,7 +285,7 @@
                 Logger.passportReader.info( "Starting Password Authenticated Connection Establishment (PACE)" )
                  
                 let paceHandler = try PACEHandler( cardAccess: cardAccess, tagReader: tagReader )
-                try await paceHandler.doPACE(mrzKey: mrzKey )
+                try await paceHandler.doPACE(mrzKey: mrzKey, passwordType: passwordType )
                 passport.PACEStatus = .success
                 Logger.passportReader.debug( "PACE Succeeded" )
 
@@ -283,6 +294,11 @@
                 trackingDelegate?.paceFailed()
 
                 passport.PACEStatus = .failed
+                // Cherry patch: a CAN only works with PACE; BAC cannot be derived from it.
+                if passwordType == .can {
+                    Logger.passportReader.error( "PACE with CAN failed" )
+                    throw error
+                }
                 Logger.passportReader.error( "PACE Failed - falling back to BAC" )
             }
             
@@ -335,6 +351,21 @@
     func doBACAuthentication(tagReader : TagReader) async throws {
         self.currentlyReadingDataGroup = nil
 
+        // Cherry patch: with a CAN there is no BAC; re-establish PACE instead.
+        if passwordType == .can {
+            guard let cardAccess = passport.cardAccess else {
+                throw NFCPassportReaderError.NotYetSupported( "PACE not supported" )
+            }
+            Logger.passportReader.info( "Re-establishing PACE (CAN)" )
+            tagReader.secureMessaging = nil
+            // PACE runs from the master file: reading EF.CardAccess selects it again.
+            _ = try await tagReader.readCardAccess()
+            let paceHandler = try PACEHandler( cardAccess: cardAccess, tagReader: tagReader )
+            try await paceHandler.doPACE(mrzKey: mrzKey, passwordType: .can )
+            _ = try await tagReader.selectPassportApplication()
+            return
+        }
+
         Logger.passportReader.info( "Starting Basic Access Control (BAC)" )
         
         self.passport.BACStatus = .failed
@@ -465,6 +496,11 @@
         throw nfcPassportReaderError
     }
 
+    /// Cherry patch: cancel a read in progress. The session delegate then reports `UserCanceled`.
+    public func cancel() {
+        self.readerSession?.invalidate()
+    }
+
     func invalidateSession(errorMessage: NFCViewDisplayMessage, error: NFCPassportReaderError) {
         // Mark the next 'invalid session' error as not reportable (we're about to cause it by invalidating the
         // session). The real error is reported back with the call to the completed handler
diff -ru -x LICENSE -x Resources -x PATCHES.md upstream/TagReader.swift ./TagReader.swift
--- upstream/TagReader.swift	2026-10-09 22:51:02.347898705 +0000
+++ cherry/TagReader.swift	2026-10-09 23:17:31.043378905 +0000
@@ -285,7 +285,8 @@
             
         }
         
-        if rep.sw1 != 0x90 && rep.sw2 != 0x00 {
+        // Cherry patch (upstream PR #272): `&&` let e.g. 63 00 (wrong key) pass as success.
+        if rep.sw1 != 0x90 || rep.sw2 != 0x00 {
             Logger.tagReader.error( "Error reading tag: sw1 - 0x\(binToHexRep(sw1)), sw2 - 0x\(binToHexRep(sw2))" )
             let tagError: NFCPassportReaderError
             if (rep.sw1 == 0x63 && rep.sw2 == 0x00) {
```
