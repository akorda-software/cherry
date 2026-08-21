import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useTagSelection } from "./use-tag-selection";

describe("useTagSelection", () => {
  it("starts neutral and toggles a tag to liked and back", () => {
    const { result } = renderHook(() => useTagSelection());

    expect(result.current.stateOf("t1")).toBe("neutral");

    act(() => result.current.toggleLike("t1"));
    expect(result.current.stateOf("t1")).toBe("liked");
    expect(result.current.positiveCount).toBe(1);

    act(() => result.current.toggleLike("t1"));
    expect(result.current.stateOf("t1")).toBe("neutral");
    expect(result.current.positiveCount).toBe(0);
  });

  it("treats like and block as mutually exclusive", () => {
    const { result } = renderHook(() => useTagSelection());

    act(() => result.current.toggleLike("t1"));
    act(() => result.current.toggleBlock("t1"));

    expect(result.current.stateOf("t1")).toBe("blocked");
    expect(result.current.positiveCount).toBe(0);
    expect(result.current.blockedCount).toBe(1);

    act(() => result.current.toggleLike("t1"));
    expect(result.current.stateOf("t1")).toBe("liked");
    expect(result.current.blockedCount).toBe(0);
  });

  it("enforces the default positive limit of 8", () => {
    const { result } = renderHook(() => useTagSelection());

    for (let i = 1; i <= 8; i++) {
      act(() => result.current.toggleLike(`t${i}`));
    }

    expect(result.current.positiveCount).toBe(8);
    expect(result.current.positiveFull).toBe(true);

    act(() => result.current.toggleLike("t9"));
    expect(result.current.stateOf("t9")).toBe("neutral");
    expect(result.current.positiveCount).toBe(8);
  });

  it("enforces the default blocked limit of 5", () => {
    const { result } = renderHook(() => useTagSelection());

    for (let i = 1; i <= 5; i++) {
      act(() => result.current.toggleBlock(`t${i}`));
    }

    expect(result.current.blockedFull).toBe(true);

    act(() => result.current.toggleBlock("t6"));
    expect(result.current.stateOf("t6")).toBe("neutral");
  });

  it("respects custom limits", () => {
    const { result } = renderHook(() => useTagSelection({ maxPositive: 2, maxBlocked: 1 }));

    act(() => result.current.toggleLike("t1"));
    act(() => result.current.toggleLike("t2"));
    act(() => result.current.toggleLike("t3"));
    expect(result.current.positiveCount).toBe(2);
  });

  it("reset overwrites both lists", () => {
    const { result } = renderHook(() => useTagSelection());

    act(() => result.current.toggleLike("old"));
    act(() => result.current.reset({ positive: ["a"], blocked: ["b"] }));

    expect(result.current.stateOf("old")).toBe("neutral");
    expect(result.current.stateOf("a")).toBe("liked");
    expect(result.current.stateOf("b")).toBe("blocked");
  });
});
