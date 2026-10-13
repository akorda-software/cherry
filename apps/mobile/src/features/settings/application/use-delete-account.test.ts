import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDeleteAccount, type DeleteAccountDeps } from "./use-delete-account";

function setup(overrides: Partial<DeleteAccountDeps> = {}) {
  const calls: string[] = [];
  const deps: DeleteAccountDeps = {
    deleteAccount: vi.fn(async () => {
      calls.push("delete");
    }),
    signOut: vi.fn(async () => {
      calls.push("signOut");
    }),
    onDeleted: vi.fn(() => {
      calls.push("onDeleted");
    }),
    ...overrides
  };

  return { deps, calls, ...renderHook(() => useDeleteAccount(deps)) };
}

describe("useDeleteAccount", () => {
  it("deletes the account, clears the local session and then says goodbye", async () => {
    const { result, calls } = setup();

    let deleted = false;
    await act(async () => {
      deleted = await result.current.run();
    });

    expect(deleted).toBe(true);
    expect(calls).toEqual(["delete", "signOut", "onDeleted"]);
    expect(result.current.pending).toBe(false);
  });

  it("stays put with a friendly error if the server could not delete it", async () => {
    const { result, deps } = setup({
      deleteAccount: vi.fn(async () => {
        throw new TypeError("Network request failed");
      })
    });

    let deleted = true;
    await act(async () => {
      deleted = await result.current.run();
    });

    expect(deleted).toBe(false);
    expect(deps.signOut).not.toHaveBeenCalled();
    expect(deps.onDeleted).not.toHaveBeenCalled();
    expect(result.current.error).toBe("Parece que no hay conexión. Revisa tu internet e inténtalo de nuevo.");
  });

  it("still leaves when clearing the local session fails after deleting", async () => {
    const { result, deps } = setup({
      signOut: vi.fn(async () => {
        throw new Error("revoke failed");
      })
    });

    await act(async () => {
      await result.current.run();
    });

    expect(deps.onDeleted).toHaveBeenCalledTimes(1);
  });
});
