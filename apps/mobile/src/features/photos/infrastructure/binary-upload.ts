import { withRequestTimeout } from "../../../shared/api/request-timeout";
import { networkPerformance } from "../../../shared/config/performance";

/**
 * `PUT` del binario de la foto a la URL firmada del intent, con TODAS las
 * cabeceras que devuelve el backend (R2/S3 firma `Content-Type`; el almacén
 * local exige además `If-None-Match: *`). Con XHR hay progreso real en iOS,
 * Android y web; sin XHR se usa `fetch` (sin progreso intermedio).
 */
export interface BinaryUploadRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Blob;
  /** Fracción 0–1 de bytes enviados. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export type BinaryUploader = (request: BinaryUploadRequest) => Promise<void>;

/** Error HTTP de la subida (`code` = `error` del JSON si lo hay, p. ej. `upload_too_large`). */
export interface BinaryUploadHttpError extends Error {
  status: number;
  code?: string;
  body?: unknown;
}

const DEFAULT_TIMEOUT_MS = networkPerformance.uploadTimeoutMs;

function parseJson(text: string | null | undefined): unknown {
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function binaryUploadHttpError(status: number, bodyText?: string | null): BinaryUploadHttpError {
  const body = parseJson(bodyText);
  const code = (body as { error?: unknown } | undefined)?.error;
  const error = new Error(typeof code === "string" ? code : `Upload failed with status ${status}`) as BinaryUploadHttpError;
  error.status = status;
  error.code = typeof code === "string" ? code : undefined;
  error.body = body;
  return error;
}

function abortError(): Error {
  const error = new Error("aborted");
  error.name = "AbortError";
  return error;
}

export const uploadBinaryWithFetch: BinaryUploader = async ({
  url, method, headers, body, onProgress, signal, timeoutMs = DEFAULT_TIMEOUT_MS
}) => {
  await withRequestTimeout(async (requestSignal) => {
    onProgress?.(0);
    const response = await fetch(url, { method, headers, body, signal: requestSignal });
    if (!response.ok) {
      let text: string | null = null;
      try {
        text = await response.text();
      } catch {
        text = null;
      }
      throw binaryUploadHttpError(response.status, text);
    }
  }, timeoutMs, signal);
  onProgress?.(1);
};

export const uploadBinaryWithXhr: BinaryUploader = ({
  url,
  method,
  headers,
  body,
  onProgress,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS
}) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.timeout = timeoutMs;

    for (const [name, value] of Object.entries(headers)) {
      xhr.setRequestHeader(name, value);
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress(event.loaded / event.total);
        }
      };
    }

    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort);
    const cleanup = () => signal?.removeEventListener("abort", onAbort);

    xhr.onload = () => {
      cleanup();

      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
        return;
      }

      reject(binaryUploadHttpError(xhr.status, typeof xhr.responseText === "string" ? xhr.responseText : null));
    };
    xhr.onerror = () => {
      cleanup();
      reject(new TypeError("Network request failed"));
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(new TypeError("Network request timed out"));
    };
    xhr.onabort = () => {
      cleanup();
      reject(abortError());
    };

    try {
      onProgress?.(0);
      xhr.send(body);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });

/** XHR si existe (progreso real); `fetch` en cualquier otro caso. */
export const uploadBinary: BinaryUploader = (request) =>
  typeof XMLHttpRequest === "function" ? uploadBinaryWithXhr(request) : uploadBinaryWithFetch(request);

/**
 * Lee un fichero local como `Blob` (`file://`, `content://`, `blob:` o `data:`).
 * En React Native y en web: `fetch(uri).blob()`.
 */
export async function readUriAsBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);

  if (!response.ok && response.status !== 0) {
    throw new Error(`Could not read ${uri} (${response.status})`);
  }

  return response.blob();
}
