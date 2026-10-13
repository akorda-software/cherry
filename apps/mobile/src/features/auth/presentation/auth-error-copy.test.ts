import { describe, expect, it } from "vitest";

import { describeAuthError, isAuthCancellation } from "./auth-error-copy";

function apiError(status: number, code?: string) {
  return Object.assign(new Error(code ?? `Request failed with status ${status}`), { status, code });
}

describe("describeAuthError", () => {
  it("stays quiet when the person cancels the provider sheet", () => {
    expect(describeAuthError(new Error("Google Sign-In was cancelled by the user"), "google")).toBeNull();
    expect(describeAuthError(Object.assign(new Error("The operation couldn’t be completed."), { code: "ERR_REQUEST_CANCELED" }), "apple")).toBeNull();
    expect(isAuthCancellation("cancel")).toBe(false);
  });

  it("explains a deleted account", () => {
    expect(describeAuthError(apiError(403, "account_deleted"), "google")).toBe(
      "Esta cuenta se borró y ya no se puede usar para entrar."
    );
  });

  it("reuses the friendly network and server copy", () => {
    expect(describeAuthError(new TypeError("Network request failed"), "apple")).toBe(
      "Parece que no hay conexión. Revisa tu internet e inténtalo de nuevo."
    );
    expect(describeAuthError(apiError(502), "google")).toBe(
      "Algo ha fallado por nuestra parte. Danos un momento y vuelve a probar."
    );
  });

  it("never leaks provider internals", () => {
    expect(describeAuthError(new Error("Apple is unavailable"), "apple")).toBe(
      "No hemos podido entrar con Apple. Inténtalo otra vez."
    );
    expect(describeAuthError(apiError(401, "invalid_token"), "google")).toBe(
      "No hemos podido entrar con Google. Inténtalo otra vez."
    );
    expect(describeAuthError(new Error("Apple Sign-In is not available on this device"), "apple")).toBe(
      "Entrar con Apple no está disponible en este dispositivo."
    );
  });

  it("gives developers a useful hint for the test login", () => {
    expect(describeAuthError(apiError(404, "dev_test_login_disabled"), "test")).toBe(
      "El acceso de pruebas está desactivado en este servidor."
    );
  });
});
