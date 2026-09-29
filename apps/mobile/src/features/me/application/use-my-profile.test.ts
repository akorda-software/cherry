import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Profile, ProfileResponse } from "@snack/contracts";

import { useMyProfile } from "./use-my-profile";

const profile = { id: "me", displayName: "Lucía" } as Profile;

function httpError(status: number) {
  return Object.assign(new Error("boom"), { status });
}

describe("useMyProfile", () => {
  it("loads the profile on mount", async () => {
    const fetchProfile = vi.fn(async (): Promise<ProfileResponse> => ({ profile, completeness: true }));

    const { result } = renderHook(() => useMyProfile(fetchProfile));

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.profile).toBe(profile);
    expect(fetchProfile).toHaveBeenCalledTimes(1);
  });

  it("reports a missing profile distinctly", async () => {
    const fetchProfile = vi.fn(async (): Promise<ProfileResponse> => ({ profile: null, completeness: false }));

    const { result } = renderHook(() => useMyProfile(fetchProfile));

    await waitFor(() => expect(result.current.status).toBe("missing"));
  });

  it("shows a friendly error when the first load fails", async () => {
    const fetchProfile = vi.fn(async (): Promise<ProfileResponse> => {
      throw httpError(500);
    });

    const { result } = renderHook(() => useMyProfile(fetchProfile));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Algo ha fallado por nuestra parte. Danos un momento y vuelve a probar.");
  });

  it("keeps the visible profile when a background reload fails", async () => {
    const fetchProfile = vi
      .fn<() => Promise<ProfileResponse>>()
      .mockResolvedValueOnce({ profile, completeness: true })
      .mockRejectedValueOnce(httpError(0));

    const { result } = renderHook(() => useMyProfile(fetchProfile));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.profile).toBe(profile);
    expect(result.current.refreshing).toBe(false);
  });

  it("shares one request between simultaneous reloads", async () => {
    let resolve!: (value: ProfileResponse) => void;
    const fetchProfile = vi.fn(
      () =>
        new Promise<ProfileResponse>((next) => {
          resolve = next;
        })
    );

    const { result } = renderHook(() => useMyProfile(fetchProfile));

    await act(async () => {
      void result.current.reload();
      void result.current.reload();
      resolve({ profile, completeness: true });
    });

    expect(fetchProfile).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });
});
