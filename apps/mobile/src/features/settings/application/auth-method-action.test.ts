import { describe, expect, it, vi } from "vitest";
import type { AuthCallbackPayload, AuthMethodProof, AuthMethodProvider } from "@cherry/contracts";
import { executeAuthMethodAction, type AuthMethodAction } from "./auth-method-action";

function setup() {
  const authenticate = vi.fn(async (provider: AuthMethodProvider) => ({ provider, payload: {
    providerToken: `${provider}-synthetic`, device: { installationId: "test", platform: "android", deviceName: "Test" }
  } as AuthCallbackPayload }));
  const submit = vi.fn(async (_action: AuthMethodAction, _proof: AuthMethodProof) => ({ methods: [] }));
  return { authenticate, submit, assertCurrentSession: vi.fn() };
}

describe("auth method ownership flow", () => {
  const link = { kind: "link", currentProvider: "google", provider: "apple" } as const;
  it("proves both providers in order and sends no device data or session replacement", async () => {
    const deps = setup();
    await executeAuthMethodAction(link, deps);
    expect(deps.authenticate.mock.calls).toEqual([["google"], ["apple"]]);
    expect(deps.submit).toHaveBeenCalledWith(link, {
      currentProvider: "google", currentCredential: { providerToken: "google-synthetic" },
      credential: { providerToken: "apple-synthetic" }
    });
  });
  it("unlink only proves the method that will remain", async () => {
    const deps = setup();
    await executeAuthMethodAction({ ...link, kind: "unlink" }, deps);
    expect(deps.authenticate.mock.calls).toEqual([["google"]]);
    expect(deps.submit.mock.calls[0]?.[1]).not.toHaveProperty("credential");
  });
  it.each([1, 2])("cancellation at proof %s never submits a change", async (step) => {
    const deps = setup();
    let count = 0;
    deps.authenticate.mockImplementation(async (provider) => {
      if (++count === step) throw Object.assign(new Error("cancelled"), { code: "ERR_REQUEST_CANCELED" });
      return { provider, payload: { providerToken: "test", device: { installationId: "test", platform: "android", deviceName: "Test" } } };
    });
    await expect(executeAuthMethodAction(link, deps)).rejects.toThrow("cancelled");
    expect(deps.submit).not.toHaveBeenCalled();
  });
  it("account/session change during a provider prompt cannot submit against the new session", async () => {
    const deps = setup();
    let current = true;
    deps.assertCurrentSession.mockImplementation(() => { if (!current) throw new Error("session_changed"); });
    deps.authenticate.mockImplementation(async (provider) => {
      current = false;
      return { provider, payload: { providerToken: "test", device: { installationId: "test", platform: "android", deviceName: "Test" } } };
    });
    await expect(executeAuthMethodAction(link, deps)).rejects.toThrow("session_changed");
    expect(deps.submit).not.toHaveBeenCalled();
  });
  it("rejects an adapter returning a different provider", async () => {
    const deps = setup();
    deps.authenticate.mockResolvedValue({ provider: "apple", payload: { providerToken: "test", device: { installationId: "test", platform: "android", deviceName: "Test" } } });
    await expect(executeAuthMethodAction(link, deps)).rejects.toThrow("provider_mismatch");
    expect(deps.submit).not.toHaveBeenCalled();
  });
});
