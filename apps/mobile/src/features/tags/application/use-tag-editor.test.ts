import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Tag } from "@snack/contracts";

import { apiError } from "../../onboarding/testing/fixtures";
import { TagSaveFailure, useTagEditor, type TagEditorApi } from "./use-tag-editor";

const tags = (ids: string[]): Tag[] => ids.map((id) => ({ id, slug: id, label: id, category: "interests", emoji: null }));

function fakeApi(overrides: Partial<TagEditorApi> = {}): TagEditorApi {
  return {
    setPositiveTags: vi.fn(async (ids: string[]) => tags(ids)),
    setBlockedTags: vi.fn(async (ids: string[]) => tags(ids)),
    getPositiveTags: vi.fn(async () => []),
    getBlockedTags: vi.fn(async () => []),
    ...overrides
  };
}

describe("useTagEditor", () => {
  it("returns the outcome of each toggle synchronously", () => {
    const { result } = renderHook(() => useTagEditor());
    let outcome: unknown;
    act(() => {
      outcome = result.current.toggle("positive", "a");
    });
    expect(outcome).toEqual({ type: "added" });
    expect(result.current.stateOf("a")).toBe("liked");
    expect(result.current.dirty).toBe(true);
  });

  it("handles two quick taps in the same frame without losing one", () => {
    const { result } = renderHook(() => useTagEditor());
    act(() => {
      result.current.toggle("positive", "a");
      result.current.toggle("positive", "b");
    });
    expect(result.current.selection.positive).toEqual(["a", "b"]);
  });

  it("rejects blocking one of your tags", () => {
    const { result } = renderHook(() => useTagEditor({ initial: { positive: ["a"], blocked: [] } }));
    let outcome: unknown;
    act(() => {
      outcome = result.current.toggle("blocked", "a");
    });
    expect(outcome).toEqual({ type: "conflict" });
    expect(result.current.selection.blocked).toEqual([]);
  });

  it("press switches a liked tag to blocked (and back) without ever holding it in both lists", () => {
    const { result } = renderHook(() => useTagEditor({ initial: { positive: ["a"], blocked: [] } }));
    const press = result.current.press;
    let outcome: unknown;

    act(() => {
      outcome = result.current.press("blocked", "a");
    });
    expect(outcome).toEqual({ type: "moved" });
    expect(result.current.selection).toEqual({ positive: [], blocked: ["a"] });
    expect(result.current.stateOf("a")).toBe("blocked");

    act(() => {
      result.current.press("blocked", "a");
    });
    expect(result.current.stateOf("a")).toBe("neutral");
    expect(result.current.dirty).toBe(true);
    // Referencia estable: las filas memorizadas no se repintan por ella.
    expect(result.current.press).toBe(press);
  });

  it("press reports the limit and leaves the selection untouched", () => {
    const { result } = renderHook(() =>
      useTagEditor({ initial: { positive: ["p1"], blocked: ["b1", "b2", "b3", "b4", "b5"] } })
    );
    let outcome: unknown;
    act(() => {
      outcome = result.current.press("blocked", "p1");
    });
    expect(outcome).toEqual({ type: "limit_reached", limit: 5 });
    expect(result.current.stateOf("p1")).toBe("liked");
    expect(result.current.dirty).toBe(false);
  });

  it("saves a liked↔blocked swap made on the one-page board without conflicts", async () => {
    const api = fakeApi();
    const { result } = renderHook(() => useTagEditor());
    act(() => result.current.reset({ positive: ["a", "b"], blocked: ["x"] }));
    act(() => {
      result.current.press("blocked", "b");
      result.current.press("positive", "x");
    });
    expect(result.current.selection).toEqual({ positive: ["a", "x"], blocked: ["b"] });

    await act(async () => {
      await result.current.save(api);
    });

    expect(vi.mocked(api.setPositiveTags).mock.calls).toEqual([[["a"]], [["a", "x"]]]);
    expect(api.setBlockedTags).toHaveBeenCalledWith(["b"]);
    expect(result.current.server).toEqual({ positive: ["a", "x"], blocked: ["b"] });
    expect(result.current.dirty).toBe(false);
  });

  it("saves with a conflict-free plan and marks the editor clean", async () => {
    const api = fakeApi();
    const { result } = renderHook(() => useTagEditor());
    act(() => result.current.reset({ positive: [], blocked: ["x"] }));
    act(() => {
      result.current.toggle("positive", "x");
      result.current.toggle("positive", "y");
    });

    await act(async () => {
      await result.current.save(api);
    });

    expect(api.setBlockedTags).toHaveBeenCalledWith([]);
    expect(api.setPositiveTags).toHaveBeenCalledWith(["x", "y"]);
    expect(vi.mocked(api.setBlockedTags).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(api.setPositiveTags).mock.invocationCallOrder[0]
    );
    expect(result.current.dirty).toBe(false);
    expect(result.current.server).toEqual({ positive: ["x", "y"], blocked: [] });
  });

  it("drops unknown tags, refreshes the server copy and explains it on invalid_tags", async () => {
    const api = fakeApi({
      setPositiveTags: vi.fn(async () => {
        throw apiError(422, { error: "invalid_tags", tagIds: ["ghost"] });
      }),
      getPositiveTags: vi.fn(async () => tags(["a"]))
    });
    const { result } = renderHook(() => useTagEditor({ initial: { positive: ["a"], blocked: [] } }));
    act(() => {
      result.current.toggle("positive", "ghost");
    });

    let failure: unknown;
    await act(async () => {
      failure = await result.current.save(api).catch((error: unknown) => error);
    });

    expect(failure).toBeInstanceOf(TagSaveFailure);
    expect((failure as TagSaveFailure).code).toBe("invalid_tags");
    expect((failure as TagSaveFailure).message).toMatch(/ya no está en el catálogo/);
    expect(result.current.selection.positive).toEqual(["a"]);
    expect(result.current.server.positive).toEqual(["a"]);
  });

  it("translates unknown failures into a friendly message", async () => {
    const api = fakeApi({
      setPositiveTags: vi.fn(async () => {
        throw new TypeError("Network request failed");
      })
    });
    const { result } = renderHook(() => useTagEditor());
    act(() => {
      result.current.toggle("positive", "a");
    });

    let failure: unknown;
    await act(async () => {
      failure = await result.current.save(api).catch((error: unknown) => error);
    });

    expect((failure as TagSaveFailure).code).toBe("unknown");
    expect((failure as TagSaveFailure).message).toMatch(/conexión/);
    expect(result.current.dirty).toBe(true);
  });
});
