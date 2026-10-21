import type { LegalStatus } from "../../legal/domain/legal";

export interface AppBootstrapUser {
  id: string;
  email: string;
  displayName: string | null;
}

export interface AppBootstrapProfileState {
  exists: boolean;
  isComplete: boolean;
  isDiscoverable: boolean;
  isPaused: boolean;
  onboardingRequired: boolean;
  nextOnboardingStep: string | null;
}

/** Verificación de edad (`docs/compliance/02-mayoria-de-edad.md`). */
export interface AppBootstrapAgeVerification {
  /** Si la instancia exige verificarse para usar la app (`AGE_VERIFICATION_REQUIRED`). */
  required: boolean;
  status: "unverified" | "verified" | "revoked";
  /** Si se puede empezar ahora la verificación con proveedor externo (selfie + documento). */
  providerAvailable?: boolean;
  /** El proveedor está configurado pero se ha llegado al máximo de este mes: solo queda el NFC. */
  providerLimitReached?: boolean;
}

export interface AppBootstrap {
  user: AppBootstrapUser;
  profile: AppBootstrapProfileState;
  /** Ausente en servidores anteriores a la verificación: se trata como no obligatoria. */
  ageVerification?: AppBootstrapAgeVerification;
  legal?: LegalStatus;
}

/**
 * «Pendiente de verificar»: la instancia exige verificarse y esta cuenta aún no lo ha hecho.
 * Es distinto de la pausa: puedes editar tu perfil, pero ni ves a nadie ni nadie te ve.
 */
export function isAgeVerificationPending(bootstrap: Pick<AppBootstrap, "ageVerification">): boolean {
  const verification = bootstrap.ageVerification;
  return Boolean(verification?.required) && verification?.status !== "verified";
}
