package app.cherry.documentnfc

import android.nfc.TagLostException
import android.nfc.tech.IsoDep
import net.sf.scuba.smartcards.CardServiceException
import net.sf.scuba.smartcards.IsoDepCardService
import org.jmrtd.AccessKeySpec
import org.jmrtd.BACKey
import org.jmrtd.CardServiceProtocolException
import org.jmrtd.PACEKeySpec
import org.jmrtd.PassportService
import org.jmrtd.lds.CardAccessFile
import org.jmrtd.lds.PACEInfo
import java.io.IOException

/** Key to open the chip: the CAN (ID cards) or the MRZ data (passports). */
sealed class AccessKey {
  data class Can(val can: String) : AccessKey()
  data class Mrz(val documentNumber: String, val dateOfBirth: String, val dateOfExpiry: String) : AccessKey()
}

class ReadException(val code: String, message: String, cause: Throwable? = null) : Exception(message, cause)

data class RawDocument(val dg1: ByteArray, val dg2: ByteArray, val sod: ByteArray)

/**
 * Reads DG1, DG2 and EF.SOD with JMRTD (ICAO 9303-11):
 * PACE with the CAN, or PACE/BAC with the MRZ for passports. No parsing and no
 * verification here: passive authentication happens on the server.
 *
 * Sequence based on tananaev/passport-reader (Apache-2.0) and
 * @2060.io/react-native-eid-reader (MIT), adapted to JMRTD 0.8.9.
 */
class DocumentReader(private val onStep: (String) -> Unit) {

  fun read(isoDep: IsoDep, key: AccessKey): RawDocument {
    // A healthy chip answers each command in well under a second (PACE peaks at ~0.6 s on a
    // DNI 4.0); a silent chip has usually lost power, so give up early and retry.
    isoDep.timeout = 5_000
    val cardService = IsoDepCardService(isoDep)

    try {
      onStep("connecting")
      cardService.open()

      val service = PassportService(
        cardService,
        PassportService.NORMAL_MAX_TRANCEIVE_LENGTH,
        PassportService.DEFAULT_MAX_BLOCKSIZE,
        false,
        false
      )
      service.open()

      onStep("authenticating")
      val accessKey: AccessKeySpec = when (key) {
        is AccessKey.Can -> PACEKeySpec.createCANKey(key.can)
        is AccessKey.Mrz -> BACKey(key.documentNumber, key.dateOfBirth, key.dateOfExpiry)
      }

      val paceInfo = readPaceInfo(service, cardService)
      var paceSucceeded = false

      if (paceInfo != null) {
        try {
          service.doPACE(
            accessKey,
            paceInfo.objectIdentifier,
            PACEInfo.toParameterSpec(paceInfo.parameterId),
            null
          )
          paceSucceeded = true
        } catch (e: Exception) {
          if (cardService.isConnectionLost(e)) throw lost(e)
          // A CAN only works with PACE: a failure here means a wrong CAN.
          if (key is AccessKey.Can) throw ReadException("ACCESS_DENIED", "PACE failed", e)
        }
      } else if (key is AccessKey.Can) {
        throw ReadException("UNSUPPORTED_DOCUMENT", "The chip does not offer PACE")
      }

      service.sendSelectApplet(paceSucceeded)

      if (!paceSucceeded) {
        try {
          service.doBAC(accessKey)
        } catch (e: Exception) {
          if (cardService.isConnectionLost(e)) throw lost(e)
          throw ReadException("ACCESS_DENIED", "BAC failed", e)
        }
      }

      onStep("reading_dg1")
      val dg1 = readFile(service, cardService, PassportService.EF_DG1)
      onStep("reading_dg2")
      val dg2 = readFile(service, cardService, PassportService.EF_DG2)
      onStep("reading_sod")
      val sod = readFile(service, cardService, PassportService.EF_SOD)
      onStep("done")

      return RawDocument(dg1, dg2, sod)
    } catch (e: ReadException) {
      throw e
    } catch (e: Exception) {
      if (cardService.isConnectionLost(e) || isTagLost(e)) throw lost(e)
      throw ReadException("UNKNOWN", e.javaClass.simpleName, e)
    } finally {
      try {
        cardService.close()
      } catch (_: Exception) {
      }
    }
  }

  // EF.CardAccess is readable without authentication and advertises PACE.
  // Passports without it only support BAC.
  private fun readPaceInfo(service: PassportService, cardService: IsoDepCardService): PACEInfo? {
    return try {
      val stream = service.getInputStream(PassportService.EF_CARD_ACCESS, PassportService.DEFAULT_MAX_BLOCKSIZE)
      CardAccessFile(stream).securityInfos.filterIsInstance<PACEInfo>().firstOrNull()
    } catch (e: Exception) {
      if (cardService.isConnectionLost(e)) throw lost(e)
      null
    }
  }

  private fun readFile(service: PassportService, cardService: IsoDepCardService, fid: Short): ByteArray {
    try {
      return service.getInputStream(fid, PassportService.DEFAULT_MAX_BLOCKSIZE).use { it.readBytes() }
    } catch (e: Exception) {
      if (cardService.isConnectionLost(e) || isTagLost(e)) throw lost(e)
      if (e is CardServiceException && e !is CardServiceProtocolException && e.sw == SW_SECURITY_STATUS_NOT_SATISFIED) {
        throw ReadException("ACCESS_DENIED", "Access to the file was denied", e)
      }
      throw e
    }
  }

  private fun isTagLost(e: Throwable?): Boolean {
    var current = e
    while (current != null) {
      if (current is TagLostException) return true
      if (current is IOException && current.message?.contains("Tag was lost", ignoreCase = true) == true) return true
      current = if (current.cause === current) null else current.cause
    }
    return false
  }

  private fun lost(e: Throwable) = ReadException("TAG_LOST", "The document was moved away", e)

  companion object {
    private const val SW_SECURITY_STATUS_NOT_SATISFIED = 0x6982
  }
}
