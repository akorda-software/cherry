import type { AuthCallbackPayload, AuthMethodProof, AuthMethodProvider, AuthMethodsSnapshot } from "@cherry/contracts";

export interface AuthMethodAction {
  kind: "link" | "unlink";
  provider: AuthMethodProvider;
  currentProvider: AuthMethodProvider;
}

interface Dependencies {
  authenticate(provider: AuthMethodProvider): Promise<{ provider: AuthMethodProvider; payload: AuthCallbackPayload }>;
  assertCurrentSession(): void;
  submit(action: AuthMethodAction, proof: AuthMethodProof): Promise<AuthMethodsSnapshot>;
}

// Credentials stay in this call's memory: no store, logs, URLs or app session replacement.
export async function executeAuthMethodAction(action: AuthMethodAction, deps: Dependencies) {
  deps.assertCurrentSession();
  const current = await deps.authenticate(action.currentProvider);
  deps.assertCurrentSession();
  if (current.provider !== action.currentProvider) throw new Error("provider_mismatch");
  const { device: _currentDevice, ...currentCredential } = current.payload;
  const proof: AuthMethodProof = { currentProvider: action.currentProvider, currentCredential };
  if (action.kind === "link") {
    const added = await deps.authenticate(action.provider);
    deps.assertCurrentSession();
    if (added.provider !== action.provider) throw new Error("provider_mismatch");
    const { device: _addedDevice, ...credential } = added.payload;
    proof.credential = credential;
  }
  deps.assertCurrentSession();
  return deps.submit(action, proof);
}
