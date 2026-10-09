import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MatchSummary } from "@snack/contracts";

const api = vi.hoisted(() => {
  const getForConversation = vi.fn();
  return { getForConversation, callApi: (run: (client: { getForConversation: typeof getForConversation }) => unknown) => run({ getForConversation }) };
});
vi.mock("../../auth/presentation", () => ({ useAuthedApi: () => api.callApi }));

import { useMatchesStore } from "./matches-store";
import { useMatchForConversation } from "./use-matches";

function entry(id: string): MatchSummary {
  return {
    id, conversationId: `conv-${id}`, matchedAt: "2026-10-01T12:00:00Z", expiresAt: null,
    firstMessageAt: null, lastMessage: null, unreadCount: 0,
    otherProfile: { id: `other-${id}`, displayName: id, age: 30, photoUrl: null }
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

beforeEach(() => {
  useMatchesStore.getState().reset();
  api.getForConversation.mockReset();
});

describe("conversation match lookup", () => {
  it("opens a notification's conversation without walking inbox pages", async () => {
    await useMatchesStore.getState().load(async () => ({ matches: [entry("first-page")], nextCursor: "more" }));
    api.getForConversation.mockResolvedValue(entry("older"));
    const { result } = renderHook(() => useMatchForConversation("conv-older"));
    await waitFor(() => expect(result.current.match?.id).toBe("older"));
    expect(api.getForConversation).toHaveBeenCalledOnce();
    expect(api.getForConversation).toHaveBeenCalledWith("conv-older");
    expect(useMatchesStore.getState().nextCursor).toBe("more");
  });

  it("uses an already cached match immediately", () => {
    useMatchesStore.getState().upsertFetchedMatch(entry("cached"));
    const { result } = renderHook(() => useMatchForConversation("conv-cached"));
    expect(result.current).toMatchObject({ match: { id: "cached" }, status: "ready" });
    expect(api.getForConversation).not.toHaveBeenCalled();
  });

  it("does not restore private data after sign-out", async () => {
    const pending = deferred<MatchSummary>();
    api.getForConversation.mockReturnValue(pending.promise);
    renderHook(() => useMatchForConversation("conv-old"));
    await act(async () => {
      useMatchesStore.getState().reset();
      pending.resolve(entry("old"));
      await pending.promise;
    });
    expect(useMatchesStore.getState().matches).toEqual([]);
  });

  it("ignores a lookup overtaken by navigation to another conversation", async () => {
    const pending = deferred<MatchSummary>();
    api.getForConversation.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(entry("new"));
    const { result, rerender } = renderHook(({ id }) => useMatchForConversation(id), { initialProps: { id: "conv-old" } });
    rerender({ id: "conv-new" });
    await waitFor(() => expect(result.current.match?.id).toBe("new"));
    await act(async () => { pending.resolve(entry("old")); await pending.promise; });
    expect(useMatchesStore.getState().matches.map((match) => match.id)).toEqual(["new"]);
  });

  it("ignores an unmounted lookup and supports retry after failure", async () => {
    const pending = deferred<MatchSummary>();
    api.getForConversation.mockReturnValueOnce(pending.promise);
    const { unmount } = renderHook(() => useMatchForConversation("conv-old"));
    unmount();
    await act(async () => { pending.resolve(entry("old")); await pending.promise; });
    expect(useMatchesStore.getState().matches).toEqual([]);

    api.getForConversation.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useMatchForConversation("conv-retry"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    api.getForConversation.mockResolvedValue(entry("retry"));
    await act(async () => { await result.current.reload(); });
    expect(result.current).toMatchObject({ match: { id: "retry" }, status: "ready" });
  });
});
