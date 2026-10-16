import { networkPerformance } from "../config/performance";

export const DEFAULT_REQUEST_TIMEOUT_MS = networkPerformance.requestTimeoutMs;
const MAX_TIMER_DELAY_MS = 2_147_483_647;

/** Timeout is transient like fetch's other network errors, never a fatal auth rejection. */
export function createRequestTimeoutError(): TypeError {
  const error = new TypeError("Network request timed out");
  (error as TypeError & { timedOut: true }).timedOut = true;
  return error;
}

function abortError(): Error {
  const error = new Error("aborted");
  error.name = "AbortError";
  return error;
}

/** Bounds headers AND body, even when work ignores abort. Starts work eagerly and always cleans up. */
export function withRequestTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
  externalSignal?: AbortSignal
): Promise<T> {
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMER_DELAY_MS) {
    return Promise.reject(new RangeError("Request timeout must be a positive timer-safe number of milliseconds"));
  }
  if (externalSignal?.aborted) return Promise.reject(abortError());

  return new Promise<T>((resolve, reject) => {
    const controller = new AbortController();
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (settle: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", onAbort);
      settle();
    };
    const onAbort = () => {
      if (settled) return;
      finish(() => reject(abortError()));
      controller.abort();
    };

    timer = setTimeout(() => {
      finish(() => reject(createRequestTimeoutError()));
      controller.abort();
    }, timeoutMs);
    externalSignal?.addEventListener("abort", onAbort);
    if (externalSignal?.aborted) {
      onAbort();
      return;
    }

    try {
      void run(controller.signal).then(
        (value) => finish(() => resolve(value)),
        (error: unknown) => finish(() => reject(error))
      );
    } catch (error) {
      finish(() => reject(error));
    }
  });
}
