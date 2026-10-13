import { fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Inline, TagSticker, type TagStickerState } from "../../src/shared/ui";
import { renderWithTheme } from "./render-with-theme";

describe("TagSticker", () => {
  it("describes every state in words, not only with color", () => {
    renderWithTheme(
      <Inline>
        <TagSticker emoji="🧘" label="Yoga" state="selected" />
        <TagSticker label="Fumar" state="blocked" />
        <TagSticker label="Senderismo" state="shared" />
        <TagSticker label="Gatos" state="muted" />
        <TagSticker label="Café" />
      </Inline>
    );

    expect(screen.getByLabelText("🧘 Yoga, elegida")).toBeInTheDocument();
    expect(screen.getByLabelText("Fumar, bloqueada")).toBeInTheDocument();
    expect(screen.getByLabelText("Senderismo, en común")).toBeInTheDocument();
    expect(screen.getByLabelText("Gatos, no disponible")).toBeInTheDocument();
    expect(screen.getByLabelText("Café")).toBeInTheDocument();
    expect(screen.getByText("Fumar")).toHaveStyle({ textDecorationLine: "line-through" });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("behaves as a checkbox when interactive and toggles through its parent", () => {
    function Picker() {
      const [state, setState] = useState<TagStickerState>("neutral");
      return (
        <TagSticker
          emoji="☕"
          label="Café"
          onPress={() => setState((current) => (current === "selected" ? "neutral" : "selected"))}
          state={state}
          testID="tag-cafe"
        />
      );
    }

    renderWithTheme(<Picker />);

    const sticker = screen.getByTestId("tag-cafe");
    expect(sticker).toHaveAttribute("role", "checkbox");
    expect(sticker).toHaveAttribute("aria-checked", "false");

    fireEvent.click(sticker);

    expect(screen.getByTestId("tag-cafe")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "☕ Café, elegida" })).toBeInTheDocument();
  });

  it("marks blocked stickers as checked and respects disabled", () => {
    const onPress = vi.fn();

    renderWithTheme(
      <Inline>
        <TagSticker label="Fumar" onPress={onPress} state="blocked" />
        <TagSticker disabled label="Videojuegos" onPress={onPress} />
      </Inline>
    );

    expect(screen.getByRole("checkbox", { name: "Fumar, bloqueada" })).toHaveAttribute("aria-checked", "true");
    const disabled = screen.getByRole("checkbox", { name: "Videojuegos" });
    fireEvent.click(disabled);
    expect(disabled).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
  });
});
