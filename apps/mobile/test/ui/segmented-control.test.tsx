import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SegmentedControl } from "../../src/shared/ui";
import { renderWithTheme } from "./render-with-theme";

const options = [
  { value: "swipe", label: "Swipe", icon: "cards", testID: "mode-swipe" },
  { value: "feed", label: "Feed", icon: "feed", testID: "mode-feed" }
] as const;

describe("SegmentedControl", () => {
  it("exposes tab semantics and reports only real changes", () => {
    const onChange = vi.fn();

    renderWithTheme(
      <SegmentedControl accessibilityLabel="Modo" onChange={onChange} options={options} value="swipe" />
    );

    expect(screen.getByRole("tablist", { name: "Modo" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Swipe" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Feed" })).toHaveAttribute("aria-selected", "false");

    fireEvent.click(screen.getByTestId("mode-swipe"));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("mode-feed"));
    expect(onChange).toHaveBeenCalledWith("feed");
  });
});
