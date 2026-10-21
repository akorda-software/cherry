import type { AgeVerificationErrorCode } from "@cherry/contracts";

import type { DocumentNfcErrorCode, DocumentReadStep } from "../../../../modules/document-nfc";

/**
 * Qué hacer tras un error: volver a leer, corregir la clave, abrir ajustes, solo salir o cerrar
 * la sesión (la cuenta ya no existe).
 */
export type VerificationErrorAction = "retry" | "edit_key" | "settings" | "none" | "sign_out";

export interface VerificationErrorCopy {
  title: string;
  message: string;
  action: VerificationErrorAction;
  /** Ofrecer abrir el chip con los datos de la MRZ (tarjetas que no se abren con el CAN). */
  offerMrz?: boolean;
}

export type DocumentKind = "id_card" | "passport";

/**
 * Con qué se abre el chip: el CAN (el DNI y la mayoría de documentos de identidad) o los datos
 * de la MRZ (pasaportes y tarjetas sin CAN).
 */
export type DocumentAccess = "can" | "mrz";

/** El CAN para las tarjetas y la MRZ para los pasaportes. */
export function defaultAccess(kind: DocumentKind): DocumentAccess {
  return kind === "passport" ? "mrz" : "can";
}

/** Por qué se pide (primera pantalla de la verificación). */
export const WHY_REASONS = [
  {
    icon: "cake",
    title: "Cherry es solo para mayores de edad",
    body: "La ley obliga a comprobarlo de verdad: escribir tu fecha de nacimiento no basta."
  },
  {
    icon: "shield",
    title: "Para frenar bots y perfiles falsos",
    body: "Comprobar que detrás de cada perfil hay una persona real deja fuera a los bots, los spammers y las estafas."
  },
  {
    icon: "user",
    title: "Una persona, una cuenta",
    body: "Cada documento sirve para una sola cuenta. Quien sea expulsado no puede volver con otra."
  },
  {
    icon: "lock",
    title: "Tu documento no se queda aquí",
    body: "Solo guardamos que eres mayor de edad. Lo demás se borra en cuanto termina la comprobación."
  }
] as const;

export type VerificationMethodId = "nfc" | "selfie_provider" | "eu_wallet";

/**
 * Formas de verificarse. La del DNI por NFC es la recomendada; la del selfie depende de que el
 * servidor tenga proveedor (`providerAvailable` del bootstrap). La cartera europea llegará más adelante.
 */
export const VERIFICATION_METHODS: readonly {
  id: VerificationMethodId;
  icon: "shield-check" | "camera" | "lock";
  title: string;
  body: string;
  available: boolean;
  recommended: boolean;
}[] = [
  {
    id: "nfc",
    icon: "shield-check",
    title: "Con tu DNI y el NFC del móvil",
    body: "Tarda menos de un minuto. Sirven el DNI desde 2015 y los pasaportes y documentos de identidad con chip de muchos países. El TIE y los permisos de residencia, no.",
    available: true,
    recommended: true
  },
  {
    id: "selfie_provider",
    icon: "camera",
    title: "Con un selfie y una foto del documento",
    body: "Para quien no tenga NFC en el móvil o un documento con chip. Lo hace Didit, una empresa de verificación.",
    available: true,
    recommended: false
  },
  {
    id: "eu_wallet",
    icon: "lock",
    title: "Con la cartera digital europea",
    body: "La app oficial de la UE, que confirma tu edad sin dar ningún otro dato.",
    available: false,
    recommended: false
  }
];

/** Texto del selfie cuando se ha llegado al máximo de comprobaciones del mes. */
export const PROVIDER_LIMIT_REACHED_BODY =
  "Este mes ya no quedan comprobaciones con selfie. Vuelve a partir del día 1 o hazlo con el DNI o el pasaporte por NFC.";

/** Qué hace falta antes de empezar con el DNI. */
export const NFC_REQUIREMENTS = [
  {
    icon: "shield-check",
    text: "Un DNI de 2015 o posterior, o un pasaporte o documento de identidad con chip, en vigor. El TIE no sirve."
  },
  { icon: "check-circle", text: "El NFC del móvil activado." },
  { icon: "clock", text: "Un minuto y una mesa donde apoyarte." }
] as const;

/** Pasos de cómo colocar el documento, según la plataforma. */
export function placementSteps(platform: string, kind: DocumentKind): string[] {
  const document = kind === "passport" ? "el pasaporte" : "el DNI";
  const where = kind === "passport" ? "abierto por la página de tus datos" : "por cualquier cara";

  return platform === "ios"
    ? [
        `Deja ${document} sobre la mesa, ${where}.`,
        "Apoya encima la parte de arriba del iPhone (donde está la cámara).",
        "Cuando empiece a leer, no muevas nada hasta que termine. Tarda unos segundos."
      ]
    : [
        "Si la funda es gruesa o tiene metal, quítala.",
        `Apoya ${document} en la parte de atrás del móvil, a la altura de la cámara.`,
        "Si no lo detecta, deslízalo despacio hacia el centro.",
        "Cuando empiece a leer, no lo muevas hasta que termine. Tarda unos segundos."
      ];
}

/** Qué hace falta para la vía del selfie. */
export const PROVIDER_REQUIREMENTS = [
  { icon: "shield-check", text: "Tu DNI o pasaporte en vigor, a mano. El TIE no sirve." },
  { icon: "camera", text: "Buena luz y la cara despejada: sin gafas de sol ni gorra." },
  { icon: "clock", text: "Un par de minutos." }
] as const;

/** Qué pasa en la vía del selfie, paso a paso. */
export const PROVIDER_STEPS = [
  "Se abre la página de Didit, la empresa que hace la comprobación.",
  "Haces una foto de las dos caras del documento.",
  "Te grabas la cara unos segundos, para comprobar que eres tú y que eres una persona real.",
  "Al terminar, vuelves aquí y lo comprobamos."
] as const;

/** Qué ve Didit, qué se guarda y qué se borra (vía del selfie). */
export const PROVIDER_DATA_SUMMARY = [
  {
    icon: "eye",
    title: "Qué ve Didit",
    body: "Las fotos del documento y de tu cara. Las usa solo para esta comprobación."
  },
  {
    icon: "shield-check",
    title: "Qué se guarda en Cherry",
    body: "Lo mismo que con el NFC: que eres mayor de edad, la fecha y una huella cifrada del número del documento."
  },
  {
    icon: "trash",
    title: "Qué se borra",
    body: "En cuanto tenemos la respuesta, pedimos a Didit que borre las fotos y los datos de la sesión."
  }
] as const;

/** Consentimiento expreso para la comparación facial (dato biométrico) antes de abrir Didit. */
export const PROVIDER_CONSENT =
  "Al pulsar «Aceptar y empezar» aceptas que Didit compare tu cara con la foto del documento, un dato biométrico, solo para esta comprobación. Si prefieres que no se trate tu imagen, usa el DNI con NFC.";

/** Qué se lee, qué se guarda y qué se borra (pantalla inicial). */
export const DATA_SUMMARY = [
  {
    icon: "eye",
    title: "Qué se lee",
    body: "Los datos de la zona de abajo del documento (entre ellos, tu fecha de nacimiento) y la firma digital del Estado. La foto del chip no se lee."
  },
  {
    icon: "shield-check",
    title: "Qué se guarda",
    body: "Que eres mayor de edad, la fecha de la comprobación y una huella cifrada del número del documento, para que cada documento sirva para una sola cuenta."
  },
  {
    icon: "trash",
    title: "Qué se borra",
    body: "Todo lo demás, en cuanto termina la comprobación. El CAN no sale de tu móvil."
  }
] as const;

export const READ_STEP_COPY: Record<DocumentReadStep, string> = {
  waiting: "Esperando al documento…",
  connecting: "Conectando con el chip…",
  authenticating: "Abriendo el chip…",
  reading_dg1: "Leyendo los datos…",
  reading_sod: "Leyendo la firma…",
  retrying: "Se ha cortado la conexión. No lo muevas: lo intentamos otra vez…",
  done: "Lectura completa."
};

/** Avance aproximado de la lectura (0–1) para la barra. La firma es lo más largo. */
export const READ_STEP_PROGRESS: Record<DocumentReadStep, number> = {
  waiting: 0,
  connecting: 0.1,
  authenticating: 0.25,
  reading_dg1: 0.45,
  reading_sod: 0.65,
  retrying: 0.1,
  done: 1
};

export function holdInstruction(platform: string, kind: DocumentKind): string {
  const document = kind === "passport" ? "el pasaporte" : "el DNI";

  return platform === "ios"
    ? `Acerca ${document} a la parte de arriba del iPhone y no lo muevas hasta que termine.`
    : `Apoya ${document} en la parte de atrás del móvil, hacia el centro, y no lo muevas hasta que termine.`;
}

/** Errores de la lectura NFC. `CANCELLED` no se muestra: se vuelve al paso anterior. */
export function readErrorCopy(
  code: DocumentNfcErrorCode,
  kind: DocumentKind,
  access: DocumentAccess = defaultAccess(kind)
): VerificationErrorCopy {
  const document = kind === "passport" ? "el pasaporte" : access === "mrz" ? "el documento" : "el DNI";

  switch (code) {
    case "NFC_UNAVAILABLE":
      return {
        title: "Este móvil no puede leer el chip",
        message: "No tiene NFC o esta versión de la app no lo incluye.",
        action: "none"
      };
    case "NFC_DISABLED":
      return {
        title: "Activa el NFC",
        message: "Está apagado en los ajustes del móvil. Actívalo y vuelve aquí.",
        action: "settings"
      };
    case "ACCESS_DENIED":
    case "INVALID_KEY":
      if (kind === "passport") {
        return {
          title: "Los datos no coinciden",
          message: "Revisa el número del pasaporte y las dos fechas, tal como aparecen en la página de tus datos.",
          action: "edit_key"
        };
      }
      return access === "mrz"
        ? {
            title: "Los datos no coinciden",
            message:
              "Revisa el número del documento y las dos fechas, tal como aparecen en las líneas de letras y números de la tarjeta.",
            action: "edit_key"
          }
        : {
            title: "El CAN no coincide",
            message:
              "Revisa las 6 cifras: en el DNI están en la cara delantera, abajo a la derecha. Si tu documento no tiene CAN, usa sus datos.",
            action: "edit_key",
            offerMrz: true
          };
    case "TAG_LOST":
      return {
        title: "Se ha cortado la conexión con el chip",
        message: `Suele pasar cuando ${document} no queda justo encima de la antena. Quita la funda si es gruesa, apóyalo a la altura de la cámara y, si no lo detecta, deslízalo despacio hasta encontrar el punto. Luego no lo muevas.`,
        action: "retry"
      };
    case "UNSUPPORTED_DOCUMENT":
      if (kind === "id_card" && access === "can") {
        return {
          title: "Este chip no se abre con el CAN",
          message: "Prueba con los datos del documento: su número y las fechas de nacimiento y caducidad.",
          action: "none",
          offerMrz: true
        };
      }
      return {
        title: "No podemos leer este documento",
        message:
          "Hace falta un documento con chip: DNI desde 2015 (DNI 3.0 o 4.0), pasaporte electrónico o documento de identidad con chip.",
        action: "retry"
      };
    case "TIMEOUT":
      return {
        title: "No ha llegado ningún documento",
        message: `Acerca ${document} al móvil y vuelve a probar. Si tienes una funda gruesa, quítala.`,
        action: "retry"
      };
    case "BUSY":
      return { title: "Ya hay una lectura en marcha", message: "Espera un momento y vuelve a probar.", action: "retry" };
    default:
      return {
        title: "No se ha podido leer el chip",
        message: "Vuelve a intentarlo. Si sigue fallando, prueba sin funda y moviendo el documento poco a poco.",
        action: "retry"
      };
  }
}

/** Errores del servidor al comprobar el documento. */
export function serverErrorCopy(
  code: AgeVerificationErrorCode | string | null,
  details: { retryAfterSeconds?: number } = {}
): VerificationErrorCopy {
  switch (code) {
    case "underage":
      return {
        title: "Cherry es para mayores de edad",
        message:
          "Según el documento, aún no tienes 18 años. Hemos borrado tu cuenta y todo lo que habías subido, y no hemos guardado nada del documento.",
        action: "sign_out"
      };
    case "document_expired":
      return {
        title: "El documento está caducado",
        message: "Usa un documento en vigor: un DNI, un pasaporte o un documento de identidad sin caducar.",
        action: "none"
      };
    case "document_already_used":
      return {
        title: "Este documento ya está en otra cuenta",
        message: "Cada documento sirve para una sola cuenta. Si tienes otra cuenta en Cherry, entra con ella.",
        action: "none"
      };
    case "already_verified":
      return {
        title: "Ya tenías la edad comprobada",
        message: "Lo hiciste con otro documento. No hace falta repetirlo.",
        action: "none"
      };
    case "verification_revoked":
      return {
        title: "No podemos comprobarlo ahora",
        message: "Tu comprobación anterior se anuló.",
        action: "none"
      };
    case "document_not_verified":
      return {
        title: "No hemos podido comprobar el documento",
        message: "La firma del chip no cuadra o no reconocemos a quién lo emitió.",
        action: "retry"
      };
    case "too_many_attempts": {
      const minutes = Math.max(1, Math.ceil((details.retryAfterSeconds ?? 3600) / 60));
      return {
        title: "Demasiados intentos",
        message: `Vuelve a probar dentro de ${minutes === 1 ? "1 minuto" : `${minutes} minutos`}.`,
        action: "none"
      };
    }
    case "verification_declined":
      return {
        title: "No se ha podido comprobar",
        message: "Las fotos no han servido: puede que se vieran borrosas o con reflejos. Prueba otra vez con buena luz.",
        action: "retry"
      };
    case "session_expired":
      return {
        title: "La comprobación se quedó a medias",
        message: "Ha caducado o se cerró antes de acabar. Empieza otra vez.",
        action: "retry"
      };
    case "unsupported_document":
      return {
        title: "Ese documento no nos sirve",
        message:
          "Sirven el DNI, el pasaporte y los documentos de identidad de otros países. El TIE, los permisos de residencia y el carné de conducir, no.",
        action: "retry"
      };
    case "session_not_found":
      return {
        title: "No encontramos la comprobación",
        message: "Empieza otra vez desde el principio.",
        action: "retry"
      };
    case "provider_error":
      return {
        title: "No podemos conectar con Didit",
        message: "Su servicio no responde ahora mismo. Inténtalo de nuevo en un rato.",
        action: "retry"
      };
    case "provider_limit_reached":
      return {
        title: "No disponible hasta el mes que viene",
        message: "Ya se han hecho todas las comprobaciones con selfie de este mes. Mientras, puedes hacerlo con el DNI o el pasaporte por NFC.",
        action: "none"
      };
    case "age_verification_unavailable":
      return {
        title: "La comprobación no está disponible",
        message: "Este servidor no la tiene activada todavía.",
        action: "none"
      };
    default:
      return {
        title: "Algo se ha torcido",
        message: "No hemos podido comprobar el documento. Inténtalo otra vez.",
        action: "retry"
      };
  }
}

/** Solo cifras, como mucho 6. */
export function sanitizeCan(input: string): string {
  return input.replace(/\D/g, "").slice(0, 6);
}

/** «DD/MM/AAAA» (o «DDMMAAAA») → «AAMMDD» de la MRZ; `null` si no es una fecha válida. */
export function toMrzDate(input: string): string | null {
  const match = /^(\d{1,2})[/.\- ]?(\d{1,2})[/.\- ]?(\d{4})$/.exec(input.trim());
  if (!match) {
    return null;
  }

  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return `${String(year % 100).padStart(2, "0")}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

/** Número del documento tal como lo usa la MRZ: mayúsculas, sin espacios. */
export function sanitizeDocumentNumber(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
