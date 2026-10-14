import type {
  AgeVerificationResponse,
  NfcCountriesResponse,
  NfcVerificationRequest,
  ProviderCheckResponse,
  ProviderSessionResponse
} from "@cherry/contracts";

import type { HttpClient } from "./auth-api";

export interface VerificationApi {
  /** Estado de verificación de edad del usuario y si la instancia la exige. */
  get(): Promise<AgeVerificationResponse>;
  /** Países cuyos documentos se pueden comprobar por NFC. */
  nfcCountries(): Promise<NfcCountriesResponse>;
  /** Envía DG1, DG2 y SOD leídos del chip (base64). Errores en `AgeVerificationErrorCode`. */
  verifyNfc(request: NfcVerificationRequest): Promise<AgeVerificationResponse>;
  /** Abre una sesión con el proveedor (selfie + documento). `callback`: adónde vuelve el navegador. */
  startProvider(callback?: string): Promise<ProviderSessionResponse>;
  /** Pregunta al servidor cómo ha ido la sesión del proveedor. */
  checkProvider(sessionId: string): Promise<ProviderCheckResponse>;
}

export function createVerificationApi(httpClient: HttpClient): VerificationApi {
  return {
    get() {
      return httpClient.get<AgeVerificationResponse>("/api/me/verification");
    },
    nfcCountries() {
      return httpClient.get<NfcCountriesResponse>("/api/me/verification/nfc/countries");
    },
    verifyNfc(request) {
      return httpClient.post<AgeVerificationResponse>("/api/me/verification/nfc", {
        dg1: request.dg1,
        dg2: request.dg2,
        sod: request.sod
      });
    },
    startProvider(callback) {
      return httpClient.post<ProviderSessionResponse>("/api/me/verification/provider", callback ? { callback } : {});
    },
    checkProvider(sessionId) {
      return httpClient.post<ProviderCheckResponse>("/api/me/verification/provider/check", { sessionId });
    }
  };
}
