import { describe, expect, it, vi } from "vitest";

import type { SessionBundle } from "@snack/contracts";
import { createLogoutSession } from "./logout-session";

const session: SessionBundle = {
  accessToken: "access-token",
  accessTokenExpiresAt: "2026-04-12T21:00:00Z",
  refreshToken: "refresh-token",
  refreshTokenExpiresAt: "2026-04-19T21:00:00Z",
  user: {
    id: "user-1",
    email: "user@example.com",
    displayName: "User"
  }
};

describe("createLogoutSession", () => {
  it("clears secure storage before revoking the device session", async () => {
    const calls: string[] = [];
    const service = createLogoutSession({
      storage: {
        read: async () => session,
        write: async () => undefined,
        clear: async () => {
          calls.push("clear");
        }
      },
      sessionApi: {
        revoke: vi.fn(async () => {
          calls.push("revoke");
        })
      }
    });

    await service.execute(session);

    expect(calls).toEqual(["clear", "revoke"]);
  });

  it("still clears secure storage when there is no active session bundle", async () => {
    const clear = vi.fn(async () => undefined);
    const revoke = vi.fn(async () => undefined);
    const service = createLogoutSession({
      storage: {
        read: async () => null,
        write: async () => undefined,
        clear
      },
      sessionApi: { revoke }
    });

    await service.execute(null);

    expect(clear).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();
  });
});
