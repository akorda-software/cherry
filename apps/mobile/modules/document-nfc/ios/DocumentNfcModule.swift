import CoreNFC
import ExpoModulesCore

struct ReadKey: Record {
  @Field var can: String?
  @Field var documentNumber: String?
  @Field var dateOfBirth: String?
  @Field var dateOfExpiry: String?
}

struct ReadOptions: Record {
  // iOS ends NFC sessions on its own after ~60 s; kept for API parity with Android.
  @Field var timeoutMs: Double = 90_000
  @Field var prompt: String?
  @Field var reading: String?
  @Field var success: String?
}

final class DocumentNfcException: GenericException<(code: String, message: String)> {
  override var code: String { param.code }
  override var reason: String { param.message }
}

/// Expo module: reads DG1 and EF.SOD (never DG2, the photo) with the vendored NFCPassportReader
/// (AndyQ, MIT; CAN support patched in, see NFCPassportReader/PATCHES.md).
/// No verification here: passive authentication happens on the server.
public final class DocumentNfcModule: Module {
  private var task: Task<Void, Never>?

  public func definition() -> ModuleDefinition {
    Name("DocumentNfc")

    Events("onProgress")

    AsyncFunction("getStatus") { () -> String in
      NFCTagReaderSession.readingAvailable ? "enabled" : "unavailable"
    }

    AsyncFunction("read") { (key: ReadKey, options: ReadOptions, promise: Promise) in
      guard NFCTagReaderSession.readingAvailable else {
        promise.reject(DocumentNfcException((code: "NFC_UNAVAILABLE", message: "This device cannot read NFC tags")))
        return
      }
      guard self.task == nil else {
        promise.reject(DocumentNfcException((code: "BUSY", message: "A read is already in progress")))
        return
      }

      let messages = Messages(
        prompt: options.prompt ?? "Acerca la parte de arriba del iPhone a tu documento.",
        reading: options.reading ?? "Leyendo el chip… No lo muevas.",
        success: options.success ?? "Listo."
      )

      self.task = Task { [weak self] in
        defer { self?.task = nil }
        do {
          let document = try await self?.read(key: key, messages: messages)
          guard let document else { return }
          promise.resolve([
            "dg1": Data(document.dg1).base64EncodedString(),
            "sod": Data(document.sod).base64EncodedString()
          ])
        } catch let error as DocumentNfcException {
          promise.reject(error)
        } catch {
          promise.reject(Self.map(error))
        }
      }
    }

    AsyncFunction("cancel") {
      self.task?.cancel()
    }

    AsyncFunction("openSettings") {
      // NFC cannot be turned off on iPhone: nothing to open.
    }
  }

  private struct Messages {
    let prompt: String
    let reading: String
    let success: String
  }

  private struct RawDocument {
    let dg1: [UInt8]
    let sod: [UInt8]
  }

  private func read(key: ReadKey, messages: Messages) async throws -> RawDocument {
    let reader = PassportReader()
    // Never DG2 (the photo): the age only needs the MRZ and the signature.
    let tags: [DataGroupId] = [.COM, .DG1, .SOD]

    let display: (NFCViewDisplayMessage) -> String? = { [weak self] message in
      switch message {
      case .requestPresentPassport:
        self?.emit("waiting")
        return messages.prompt
      case .authenticatingWithPassport:
        self?.emit("authenticating")
        return messages.reading
      case .readingDataGroupProgress(let group, _):
        switch group {
        case .DG1: self?.emit("reading_dg1")
        case .SOD: self?.emit("reading_sod")
        default: break
        }
        return messages.reading
      case .successfulRead:
        self?.emit("done")
        return messages.success
      default:
        return nil
      }
    }

    let passport: NFCPassportModel = try await withTaskCancellationHandler {
      if let can = key.can {
        return try await reader.readPassport(can: can, tags: tags, customDisplayMessage: display)
      }
      guard let number = key.documentNumber, let birth = key.dateOfBirth, let expiry = key.dateOfExpiry else {
        throw DocumentNfcException((code: "INVALID_KEY", message: "A CAN or the MRZ data is required"))
      }
      // Only the data groups we need; no chip authentication (the server does passive authentication).
      return try await reader.readPassport(
        mrzKey: Self.mrzKey(number: number, birth: birth, expiry: expiry),
        tags: tags,
        skipSecureElements: true,
        skipCA: true,
        customDisplayMessage: display
      )
    } onCancel: {
      reader.cancel()
    }

    guard
      let dg1 = passport.getDataGroup(.DG1)?.data,
      let sod = passport.getDataGroup(.SOD)?.data
    else {
      throw DocumentNfcException((code: "UNSUPPORTED_DOCUMENT", message: "DG1 or EF.SOD could not be read"))
    }
    return RawDocument(dg1: dg1, sod: sod)
  }

  /// BAC/PACE MRZ information: number (padded to 9) + check, birth + check, expiry + check.
  static func mrzKey(number: String, birth: String, expiry: String) -> String {
    let padded = number.count < 9 ? number.padding(toLength: 9, withPad: "<", startingAt: 0) : number
    return padded + checkDigit(padded) + birth + checkDigit(birth) + expiry + checkDigit(expiry)
  }

  static func checkDigit(_ value: String) -> String {
    let weights = [7, 3, 1]
    var sum = 0
    for (index, char) in value.uppercased().unicodeScalars.enumerated() {
      let v: Int
      switch char {
      case "0"..."9": v = Int(char.value) - 48
      case "A"..."Z": v = Int(char.value) - 55
      default: v = 0
      }
      sum += v * weights[index % 3]
    }
    return String(sum % 10)
  }

  private static func map(_ error: Error) -> DocumentNfcException {
    if error is CancellationError {
      return DocumentNfcException((code: "CANCELLED", message: "Read cancelled"))
    }
    guard let error = error as? NFCPassportReaderError else {
      return DocumentNfcException((code: "UNKNOWN", message: String(describing: type(of: error))))
    }
    let code: String
    switch error {
    case .UserCanceled: code = "CANCELLED"
    case .TimeOutError: code = "TIMEOUT"
    case .ConnectionError, .NoConnectedTag: code = "TAG_LOST"
    case .InvalidMRZKey, .PACEError: code = "ACCESS_DENIED"
    case .NFCNotSupported: code = "NFC_UNAVAILABLE"
    case .TagNotValid, .MoreThanOneTagFound, .NotYetSupported, .UnsupportedMappingType, .UnsupportedCipherAlgorithm:
      code = "UNSUPPORTED_DOCUMENT"
    case .ResponseError(let message, _, _) where message.contains("Security status not satisfied"):
      code = "ACCESS_DENIED"
    default: code = "UNKNOWN"
    }
    return DocumentNfcException((code: code, message: error.value))
  }

  private func emit(_ step: String) {
    sendEvent("onProgress", ["step": step])
  }
}
