import { act, render, screen } from "@testing-library/react";
import { AppState } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrivatePhotoAccessContext, PrivatePhotoImage } from "./private-photo-image";

const url = (time: string) => `https://account.eu.r2.cloudflarestorage.com/bucket/photos/a.jpg?X-Amz-Date=${time}&X-Amz-Expires=300&X-Amz-Signature=sig`;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-17T10:00:00Z")); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("private image renewal", () => {
  it("renews before expiry, pauses in the background, catches up on resume and cleans up", async () => {
    let change!: (state: string) => void;
    const remove = vi.fn();
    vi.spyOn(AppState, "addEventListener").mockImplementation(((_event: string, listener: typeof change) => {
      change = listener; return { remove };
    }) as typeof AppState.addEventListener);
    const renew = vi.fn().mockResolvedValueOnce(url("20261017T100400Z")).mockResolvedValue(url("20261017T101000Z"));
    const view = render(<PrivatePhotoAccessContext.Provider value={renew}><PrivatePhotoImage source={{ uri: url("20261017T100000Z") }} /></PrivatePhotoAccessContext.Provider>);
    await act(async () => vi.advanceTimersByTime(240_000));
    expect(renew).toHaveBeenCalledExactlyOnceWith("photos/a.jpg");
    expect(screen.getByTestId("expo-image").textContent).toContain("20261017T100400Z");
    act(() => change("background"));
    await act(async () => vi.advanceTimersByTime(360_000));
    expect(renew).toHaveBeenCalledTimes(1);
    await act(async () => change("active"));
    expect(renew).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(remove).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("removes the image when authorization is no longer valid", async () => {
    const renew = vi.fn().mockRejectedValue({ status: 404 });
    render(<PrivatePhotoAccessContext.Provider value={renew}><PrivatePhotoImage source={{ uri: url("20261017T100000Z") }} /></PrivatePhotoAccessContext.Provider>);
    await act(async () => vi.advanceTimersByTime(240_000));
    expect(screen.getByTestId("expo-image").textContent).toBe("");
    expect(vi.getTimerCount()).toBe(0);
  });
});
