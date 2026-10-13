/** Rutas de «Comprobar tu edad» (`app/(app)/verify`). */
export const verificationRoutes = {
  intro: "/(app)/verify",
  methods: "/(app)/verify/methods",
  document: "/(app)/verify/document",
  selfie: "/(app)/verify/selfie"
} as const;

/**
 * Enlace por el que vuelve el navegador al terminar con el proveedor. No es una pantalla: lo recoge
 * `openAuthSessionAsync` y `app/+native-intent.tsx` evita que el router navegue con él.
 */
export const PROVIDER_RETURN_PATH = "verify/selfie/return";
