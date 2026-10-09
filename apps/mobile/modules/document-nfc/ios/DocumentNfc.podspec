Pod::Spec.new do |s|
  s.name           = 'DocumentNfc'
  s.version        = '0.1.0'
  s.summary        = 'NFC reading of ICAO 9303 identity documents (DNI, TIE, passports) for Snack'
  s.description    = 'Reads DG1, DG2 and EF.SOD with PACE (CAN) or BAC/PACE (MRZ). Passive authentication happens on the server.'
  s.license        = { :type => 'AGPL-3.0-only' }
  s.author         = 'Snack'
  s.homepage       = 'https://github.com/akorda-software/snack'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # NFCPassportReader (vendored in NFCPassportReader/, MIT) uses OpenSSL for PACE and secure
  # messaging. OpenSSL-Universal: Apache-2.0, prebuilt OpenSSL.xcframework (module `OpenSSL`).
  s.dependency 'OpenSSL-Universal', '3.6.2000'
  s.weak_frameworks = 'CoreNFC', 'CryptoKit', 'CryptoTokenKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
