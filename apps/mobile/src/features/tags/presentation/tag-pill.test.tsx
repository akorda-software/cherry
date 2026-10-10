import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Tag } from "@cherry/contracts";

import { renderWithTheme } from "../../../../test/ui/render-with-theme";
import { TagPill } from "./tag-pill";

const tag: Tag = { id: "t1", slug: "music", label: "Música", category: "interests" };

describe("TagPill", () => {
  it("renders the label and both action buttons", () => {
    const { getByText, getByTestId } = renderWithTheme(
      <TagPill tag={tag} state="neutral" onToggleLike={vi.fn()} onToggleBlock={vi.fn()} />
    );

    expect(getByText("Música")).toBeTruthy();
    expect(getByTestId("tag-pill-music-like")).toBeTruthy();
    expect(getByTestId("tag-pill-music-block")).toBeTruthy();
  });

  it("fires onToggleLike when the heart is pressed", () => {
    const onToggleLike = vi.fn();
    const { getByTestId } = renderWithTheme(
      <TagPill tag={tag} state="neutral" onToggleLike={onToggleLike} onToggleBlock={vi.fn()} />
    );

    fireEvent.click(getByTestId("tag-pill-music-like"));

    expect(onToggleLike).toHaveBeenCalledOnce();
  });

  it("fires onToggleBlock when the X is pressed", () => {
    const onToggleBlock = vi.fn();
    const { getByTestId } = renderWithTheme(
      <TagPill tag={tag} state="neutral" onToggleLike={vi.fn()} onToggleBlock={onToggleBlock} />
    );

    fireEvent.click(getByTestId("tag-pill-music-block"));

    expect(onToggleBlock).toHaveBeenCalledOnce();
  });

  it("does not fire onToggleLike when likeDisabled is true", () => {
    const onToggleLike = vi.fn();
    const { getByTestId } = renderWithTheme(
      <TagPill
        tag={tag}
        state="neutral"
        likeDisabled
        onToggleLike={onToggleLike}
        onToggleBlock={vi.fn()}
      />
    );

    fireEvent.click(getByTestId("tag-pill-music-like"));

    expect(onToggleLike).not.toHaveBeenCalled();
  });

  it("renders the liked and blocked states without crashing", () => {
    const { getByTestId, rerender } = renderWithTheme(
      <TagPill tag={tag} state="liked" onToggleLike={vi.fn()} onToggleBlock={vi.fn()} />
    );

    expect(getByTestId("tag-pill-music")).toBeTruthy();

    rerender(
      <TagPill tag={tag} state="blocked" onToggleLike={vi.fn()} onToggleBlock={vi.fn()} />
    );

    expect(getByTestId("tag-pill-music")).toBeTruthy();
  });
});
