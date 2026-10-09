package app.snack.documentnfc

import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicReference

class ReadKey : Record {
  @Field val can: String? = null
  @Field val documentNumber: String? = null
  @Field val dateOfBirth: String? = null
  @Field val dateOfExpiry: String? = null
}

class ReadOptions : Record {
  @Field val timeoutMs: Double = 90_000.0
}

class DocumentNfcException(code: String, message: String) : CodedException(code, message, null)

/**
 * Expo module: NFC reader mode while the app is in the foreground; the first
 * IsoDep tag is read on a background thread. One read at a time.
 */
class DocumentNfcModule : Module() {
  private val executor = Executors.newSingleThreadExecutor()
  private val mainHandler = Handler(Looper.getMainLooper())
  private val pending = AtomicReference<PendingRead?>(null)

  private class PendingRead(val key: AccessKey, val promise: Promise, val timeout: Runnable)

  override fun definition() = ModuleDefinition {
    Name("DocumentNfc")

    Events("onProgress")

    AsyncFunction("getStatus") {
      val adapter = adapter()
      when {
        adapter == null -> "unavailable"
        !adapter.isEnabled -> "disabled"
        else -> "enabled"
      }
    }

    AsyncFunction("read") { key: ReadKey, options: ReadOptions, promise: Promise ->
      val accessKey = when {
        key.can != null -> AccessKey.Can(key.can)
        key.documentNumber != null && key.dateOfBirth != null && key.dateOfExpiry != null ->
          AccessKey.Mrz(key.documentNumber, key.dateOfBirth, key.dateOfExpiry)
        else -> {
          promise.reject(DocumentNfcException("INVALID_KEY", "A CAN or the MRZ data is required"))
          return@AsyncFunction
        }
      }
      start(accessKey, options.timeoutMs.toLong(), promise)
    }

    AsyncFunction("cancel") {
      finish(null) { it.reject(DocumentNfcException("CANCELLED", "Read cancelled")) }
    }

    AsyncFunction("openSettings") {
      appContext.currentActivity?.startActivity(Intent(Settings.ACTION_NFC_SETTINGS))
      Unit
    }

    OnActivityEntersBackground {
      finish(null) { it.reject(DocumentNfcException("CANCELLED", "The app went to the background")) }
    }

    OnDestroy {
      finish(null) { it.reject(DocumentNfcException("CANCELLED", "Module destroyed")) }
      executor.shutdownNow()
    }
  }

  private fun adapter(): NfcAdapter? {
    val context = appContext.reactContext ?: return null
    return NfcAdapter.getDefaultAdapter(context)
  }

  private fun start(key: AccessKey, timeoutMs: Long, promise: Promise) {
    val adapter = adapter()
    val activity = appContext.currentActivity

    when {
      adapter == null -> return promise.reject(DocumentNfcException("NFC_UNAVAILABLE", "This device has no NFC"))
      !adapter.isEnabled -> return promise.reject(DocumentNfcException("NFC_DISABLED", "NFC is turned off"))
      activity == null -> return promise.reject(DocumentNfcException("UNKNOWN", "No foreground activity"))
    }

    val timeout = Runnable {
      finish(null) { it.reject(DocumentNfcException("TIMEOUT", "No document was read in time")) }
    }
    val read = PendingRead(key, promise, timeout)

    if (!pending.compareAndSet(null, read)) {
      return promise.reject(DocumentNfcException("BUSY", "A read is already in progress"))
    }

    mainHandler.postDelayed(timeout, timeoutMs)
    emit("waiting")

    activity!!.runOnUiThread {
      try {
        adapter!!.enableReaderMode(
          activity,
          { tag -> onTag(read, tag) },
          NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK or
            NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS,
          Bundle().apply { putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 1_000) }
        )
      } catch (e: Exception) {
        finish(read) { it.reject(DocumentNfcException("UNKNOWN", "Could not start NFC reader mode")) }
      }
    }
  }

  // Binder thread: hand the work to our executor so the NFC stack is not blocked.
  private fun onTag(read: PendingRead, tag: Tag) {
    if (pending.get() !== read) return

    val isoDep = IsoDep.get(tag)
    if (isoDep == null) {
      finish(read) { it.reject(DocumentNfcException("UNSUPPORTED_DOCUMENT", "Not an ISO 14443-4 document")) }
      return
    }

    executor.execute {
      try {
        val document = DocumentReader { step -> emit(step) }.read(isoDep, read.key)
        finish(read) {
          it.resolve(
            mapOf(
              "dg1" to Base64.encodeToString(document.dg1, Base64.NO_WRAP),
              "dg2" to Base64.encodeToString(document.dg2, Base64.NO_WRAP),
              "sod" to Base64.encodeToString(document.sod, Base64.NO_WRAP)
            )
          )
        }
      } catch (e: ReadException) {
        finish(read) { it.reject(DocumentNfcException(e.code, e.message ?: e.code)) }
      } catch (e: Exception) {
        finish(read) { it.reject(DocumentNfcException("UNKNOWN", e.javaClass.simpleName)) }
      }
    }
  }

  /** Settles the pending read once and stops reader mode. `null` = whatever is pending. */
  private fun finish(expected: PendingRead?, settle: (Promise) -> Unit) {
    val read = if (expected == null) pending.getAndSet(null) else if (pending.compareAndSet(expected, null)) expected else null
    read ?: return

    mainHandler.removeCallbacks(read.timeout)
    val activity = appContext.currentActivity
    activity?.runOnUiThread {
      try {
        adapter()?.disableReaderMode(activity)
      } catch (_: Exception) {
      }
    }
    settle(read.promise)
  }

  private fun emit(step: String) {
    try {
      sendEvent("onProgress", mapOf("step" to step))
    } catch (_: Exception) {
    }
  }
}
