import {
  MARK_READ_DEBOUNCE_MS,
  MARK_READ_RETRY_INITIAL_MS,
  MARK_READ_RETRY_JITTER,
  MARK_READ_RETRY_MAX_MS
} from "./chat-session-config";

interface ReadReceiptOptions {
  send(): Promise<void>;
  canSend(): boolean;
  onRead?(): void;
  /** Returns true for terminal failures (conversation unavailable). */
  onError?(error: unknown): boolean;
  now?: () => number;
  random?: () => number;
}

/** Owns only read-receipt scheduling; knows nothing about sockets, messages or React. */
export function createReadReceiptController({
  send, canSend, onRead, onError, now = Date.now, random = Math.random
}: ReadReceiptOptions) {
  let pending = false;
  let inFlight = false;
  let disposed = false;
  let failures = 0;
  let retryAt = 0;
  let acknowledgeEpoch = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function cancel() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function schedule(delayMs: number = MARK_READ_DEBOUNCE_MS) {
    if (!pending || inFlight || disposed || !canSend()) return;
    cancel();
    const delay = Math.max(delayMs, retryAt - now(), 0);
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, delay);
  }

  async function flush() {
    if (!pending || inFlight || disposed || !canSend()) return;
    inFlight = true;
    pending = false;
    const startedAcknowledgeEpoch = acknowledgeEpoch;

    try {
      await send();
      if (disposed) return;
      failures = 0;
      retryAt = 0;
      onRead?.();
    } catch (error) {
      if (disposed) return;
      if (onError?.(error)) {
        pending = false;
        cancel();
        return;
      }
      // Sending a message may already have marked the conversation as read.
      // A late failure must not resurrect that obsolete receipt.
      if (startedAcknowledgeEpoch === acknowledgeEpoch) {
        pending = true;
        failures += 1;
        const base = Math.min(MARK_READ_RETRY_MAX_MS, MARK_READ_RETRY_INITIAL_MS * 2 ** (failures - 1));
        const delay = Math.min(MARK_READ_RETRY_MAX_MS, Math.round(base * (1 + MARK_READ_RETRY_JITTER * (2 * random() - 1))));
        retryAt = now() + delay;
      }
    } finally {
      inFlight = false;
      schedule();
    }
  }

  return {
    request(delayMs: number = MARK_READ_DEBOUNCE_MS) {
      if (disposed) return;
      pending = true;
      schedule(delayMs);
    },
    schedule,
    cancel,
    acknowledge() {
      acknowledgeEpoch += 1;
      pending = false;
      failures = 0;
      retryAt = 0;
      cancel();
    },
    dispose() {
      disposed = true;
      pending = false;
      cancel();
    }
  };
}
