import { PROVIDER_RETURN_PATH } from "../src/features/verification/presentation/verification-routes";

/**
 * Enlaces del sistema antes de que los vea el router. La vuelta del proveedor de verificación
 * (`<esquema>://verify/selfie/return`) ya la atiende la pantalla que abrió el navegador: con la app
 * abierta se ignora y, si la app arrancó con ella, se va al inicio.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  // The browser adapter owns Apple returns too. Navigating to the public login
  // would unmount an authenticated linking flow before it can consume its proof.
  try {
    const url = new URL(path, "cherry://native");
    if ((url.hostname === "auth" && url.pathname === "/apple") || url.pathname === "/auth/apple") {
      return initial ? "/" : null;
    }
  } catch {
    // An unrelated malformed system path is left to the normal router fallback.
  }
  if (path.includes(PROVIDER_RETURN_PATH)) {
    return initial ? "/" : null;
  }
  return path;
}
