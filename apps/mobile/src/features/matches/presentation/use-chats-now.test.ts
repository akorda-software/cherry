import { act, renderHook } from "@testing-library/react";
import { AppState } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CHATS_PRESENTATION } from "./chats-presentation-config";
import { useChatsNow } from "./use-chats-now";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Chats relative-time clock", () => {
  it("does no repeated work while hidden, catches up on focus and cleans up on unmount", () => {
    const { result, rerender, unmount } = renderHook(({ focused }) => useChatsNow(focused), {
      initialProps: { focused: false }
    });
    const initial = result.current;
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(CHATS_PRESENTATION.relativeTimeIntervalMs * 3));
    expect(result.current).toBe(initial);
    rerender({ focused: true });
    expect(result.current).toBe(Date.now());
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(CHATS_PRESENTATION.relativeTimeIntervalMs));
    expect(result.current).toBe(Date.now());
    rerender({ focused: false });
    expect(vi.getTimerCount()).toBe(0);
    rerender({ focused: true });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops in the background, resumes immediately, and removes the foreground listener", () => {
    let change!: (state: string) => void;
    const remove = vi.fn();
    vi.spyOn(AppState, "addEventListener").mockImplementation(((_event: string, listener: typeof change) => {
      change = listener;
      return { remove };
    }) as typeof AppState.addEventListener);
    const { result, unmount } = renderHook(() => useChatsNow(true));
    act(() => change("background"));
    expect(vi.getTimerCount()).toBe(0);
    const background = result.current;
    act(() => vi.advanceTimersByTime(CHATS_PRESENTATION.relativeTimeIntervalMs * 5));
    expect(result.current).toBe(background);
    act(() => change("active"));
    expect(result.current).toBe(Date.now());
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(remove).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
