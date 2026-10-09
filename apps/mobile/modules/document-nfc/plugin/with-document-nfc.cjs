// Config plugin of the local module `document-nfc` (CommonJS: loaded by app.config.ts at prebuild).
//
// iOS:
//   - Info.plist NFCReaderUsageDescription (the text of the permission).
//   - Info.plist com.apple.developer.nfc.readersession.iso7816.select-identifiers with the eMRTD
//     application (A0000002471001). Without it iOS refuses to talk to the chip.
//   - Entitlement com.apple.developer.nfc.readersession.formats = [TAG] (NFC Tag Reading
//     capability; the App ID needs it enabled in the Apple Developer portal).
// Android:
//   - NFC permission and optional hardware feature come from the module's AndroidManifest.
//   - BouncyCastle jars (bcprov/bcutil/bcpkix) repeat some META-INF files: excluded at app level.
const { withEntitlementsPlist, withGradleProperties, withInfoPlist } = require("expo/config-plugins");

const EMRTD_AID = "A0000002471001";
const SELECT_IDENTIFIERS = "com.apple.developer.nfc.readersession.iso7816.select-identifiers";
const NFC_FORMATS = "com.apple.developer.nfc.readersession.formats";
const PACKAGING_EXCLUDES = [
  "META-INF/versions/9/OSGI-INF/MANIFEST.MF",
  "META-INF/versions/9/module-info.class",
  "META-INF/LICENSE.md",
  "META-INF/NOTICE.md"
];

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

const withDocumentNfc = (config, { nfcUsageDescription } = {}) => {
  config = withInfoPlist(config, (mod) => {
    mod.modResults.NFCReaderUsageDescription =
      nfcUsageDescription ?? mod.modResults.NFCReaderUsageDescription ?? "Read your identity document.";
    mod.modResults[SELECT_IDENTIFIERS] = unique([...(mod.modResults[SELECT_IDENTIFIERS] ?? []), EMRTD_AID]);
    return mod;
  });

  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults[NFC_FORMATS] = unique([...(mod.modResults[NFC_FORMATS] ?? []), "TAG"]);
    return mod;
  });

  config = withGradleProperties(config, (mod) => {
    const key = "android.packagingOptions.excludes";
    const existing = mod.modResults.find((item) => item.type === "property" && item.key === key);
    const values = unique([...(existing ? existing.value.split(",") : []), ...PACKAGING_EXCLUDES]).join(",");

    if (existing) {
      existing.value = values;
    } else {
      mod.modResults.push({ type: "property", key, value: values });
    }
    return mod;
  });

  return config;
};

module.exports = withDocumentNfc;
module.exports.EMRTD_AID = EMRTD_AID;
