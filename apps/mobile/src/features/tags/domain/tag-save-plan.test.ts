import { describe, expect, it, vi } from "vitest";

import type { Tag } from "@snack/contracts";

import { apiError } from "../../onboarding/testing/fixtures";
import { executeTagSave, parseTagSaveError, planTagSave, type TagSaveApi } from "./tag-save-plan";
import type { TagSelection } from "./tag-selection";

/** Backend de mentira que aplica la MISMA regla que el real: nunca una etiqueta en las dos listas. */
function strictBackend(initial: TagSelection) {
  const state = { positive: [...initial.positive], blocked: [...initial.blocked] };
  const toTags = (list: string[]): Tag[] =>
    list.map((id) => ({ id, slug: id, label: id, category: "interests", emoji: null }));

  const api: TagSaveApi = {
    setPositiveTags: vi.fn(async (next: string[]) => {
      const conflicts = next.filter((id) => state.blocked.includes(id));
      if (conflicts.length > 0) throw apiError(422, { error: "tag_conflict", tagIds: conflicts });
      if (next.length > 8) throw apiError(422, { error: "too_many_tags" });
      state.positive = [...next];
      return toTags(state.positive);
    }),
    setBlockedTags: vi.fn(async (next: string[]) => {
      const conflicts = next.filter((id) => state.positive.includes(id));
      if (conflicts.length > 0) throw apiError(422, { error: "tag_conflict", tagIds: conflicts });
      if (next.length > 5) throw apiError(422, { error: "too_many_blocked_tags" });
      state.blocked = [...next];
      return toTags(state.blocked);
    })
  };

  return { api, state };
}

describe("planTagSave", () => {
  it("does nothing when nothing changed (order does not matter)", () => {
    expect(planTagSave({ positive: ["a", "b"], blocked: ["c"] }, { positive: ["b", "a"], blocked: ["c"] })).toEqual([]);
  });

  it("saves only the list that changed", () => {
    expect(planTagSave({ positive: ["a"], blocked: [] }, { positive: ["a", "b"], blocked: [] })).toEqual([
      { kind: "positive", ids: ["a", "b"] }
    ]);
    expect(planTagSave({ positive: ["a"], blocked: [] }, { positive: ["a"], blocked: ["x"] })).toEqual([
      { kind: "blocked", ids: ["x"] }
    ]);
  });

  it("un-blocks first when a blocked tag becomes yours", () => {
    expect(planTagSave({ positive: ["a"], blocked: ["x", "y"] }, { positive: ["a", "x"], blocked: ["y"] })).toEqual([
      { kind: "blocked", ids: ["y"] },
      { kind: "positive", ids: ["a", "x"] }
    ]);
  });

  it("frees your tag first when it becomes blocked", () => {
    expect(planTagSave({ positive: ["a", "b"], blocked: [] }, { positive: ["a"], blocked: ["b"] })).toEqual([
      { kind: "positive", ids: ["a"] },
      { kind: "blocked", ids: ["b"] }
    ]);
  });

  it("uses three steps for a swap in both directions", () => {
    expect(planTagSave({ positive: ["a", "b"], blocked: ["x"] }, { positive: ["a", "x"], blocked: ["b"] })).toEqual([
      { kind: "positive", ids: ["a"] },
      { kind: "blocked", ids: ["b"] },
      { kind: "positive", ids: ["a", "x"] }
    ]);
  });

  it("never triggers a tag_conflict against a strict backend (exhaustive over a small universe)", async () => {
    const universe = ["a", "b", "c", "d"];
    // Cada etiqueta puede estar: 0 = en ninguna, 1 = positiva, 2 = bloqueada.
    const states: TagSelection[] = [];
    const total = 3 ** universe.length;
    for (let code = 0; code < total; code += 1) {
      const selection: TagSelection = { positive: [], blocked: [] };
      let rest = code;
      for (const id of universe) {
        const slot = rest % 3;
        rest = Math.floor(rest / 3);
        if (slot === 1) selection.positive.push(id);
        if (slot === 2) selection.blocked.push(id);
      }
      states.push(selection);
    }

    for (const from of states) {
      for (const to of states) {
        const { api, state } = strictBackend(from);
        await executeTagSave(api, planTagSave(from, to));
        expect(new Set(state.positive)).toEqual(new Set(to.positive));
        expect(new Set(state.blocked)).toEqual(new Set(to.blocked));
      }
    }
  });
});

describe("executeTagSave", () => {
  it("reports what the server confirmed after each step", async () => {
    const { api } = strictBackend({ positive: ["a"], blocked: ["x"] });
    const applied: Array<[string, string[]]> = [];
    await executeTagSave(
      api,
      planTagSave({ positive: ["a"], blocked: ["x"] }, { positive: ["a", "x"], blocked: [] }),
      (kind, tags) => applied.push([kind, tags.map((tag) => tag.id)])
    );
    expect(applied).toEqual([
      ["blocked", []],
      ["positive", ["a", "x"]]
    ]);
  });

  it("stops at the first failure and rethrows it", async () => {
    const api: TagSaveApi = {
      setPositiveTags: vi.fn(async () => {
        throw apiError(422, { error: "invalid_tags", tagIds: ["ghost"] });
      }),
      setBlockedTags: vi.fn(async () => [])
    };
    await expect(
      executeTagSave(api, [
        { kind: "positive", ids: ["ghost"] },
        { kind: "blocked", ids: [] }
      ])
    ).rejects.toMatchObject({ code: "invalid_tags" });
    expect(api.setBlockedTags).not.toHaveBeenCalled();
  });
});

describe("parseTagSaveError", () => {
  it("reads code and tag ids from the API error", () => {
    expect(parseTagSaveError(apiError(422, { error: "tag_conflict", tagIds: ["a", 3, "b"] }))).toEqual({
      code: "tag_conflict",
      tagIds: ["a", "b"]
    });
    expect(parseTagSaveError(apiError(422, { error: "invalid_tags", tagIds: ["nope"] }))).toEqual({
      code: "invalid_tags",
      tagIds: ["nope"]
    });
    expect(parseTagSaveError(apiError(422, { error: "too_many_blocked_tags" })).code).toBe("too_many_tags");
    expect(parseTagSaveError(new TypeError("offline")).code).toBe("unknown");
  });
});
