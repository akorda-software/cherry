import type { AgeVerificationResponse, NfcVerificationRequest } from "@snack/contracts";

import type { HttpClient } from "./auth-api";

export interface VerificationApi {
  /** Estado de verificación de edad del usuario y si la instancia la exige. */
  get(): Promise<AgeVerificationResponse>;
  /** Envía DG1, DG2 y SOD leídos del chip (base64). Errores en `AgeVerificationErrorCode`. */
  verifyNfc(request: NfcVerificationRequest): Promise<AgeVerificationResponse>;
}

export function createVerificationApi(httpClient: HttpClient): VerificationApi {
  return {
    get() {
      return httpClient.get<AgeVerificationResponse>("/api/me/verification");
    },
    verifyNfc(request) {
      return httpClient.post<AgeVerificationResponse>("/api/me/verification/nfc", {
        dg1: request.dg1,
        dg2: request.dg2,
        sod: request.sod
      });
    }
  };
}
