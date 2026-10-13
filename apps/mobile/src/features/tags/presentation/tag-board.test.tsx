import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Tag } from "@cherry/contracts";

import { renderWithTheme } from "../../../../test/ui/render-with-theme";
import { useToastStore } from "../../../shared/ui";
import * as ui from "../../../shared/ui";
import { makeTag } from "../../onboarding/testing/fixtures";
import { useTagEditor } from "../application/use-tag-editor";
import type { TagSelection } from "../domain/tag-selection";
import { TagBoard } from "./tag-board";
import { TagSummary } from "./tag-summary";
import { useTagControls } from "./use-tag-controls";

vi.mock("../../../shared/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../shared/ui")>();
  return { ...actual, useTheme: vi.fn(actual.useTheme) };
});

const catalog: Tag[] = [
  ...Array.from({ length: 10 }, (_, index) => makeTag(index + 1, { category: "interests" })),
  makeTag(20, { category: "lifestyle", label: "Fumar", slug: "smoking", emoji: "🚬" }),
  makeTag(21, { category: "active", label: "Senderismo", slug: "hiking", emoji: "🥾" }),
  makeTag(22, { category: "values", label: "Una etiqueta con un nombre larguísimo que no cabe", slug: "long" })
];

function Harness({ initial }: { initial?: TagSelection }) {
  const editor = useTagEditor({ initial });
  const { onPress, likedShakeStyle, blockedShakeStyle } = useTagControls(editor.press);

  return (
    <>
      <TagSummary
        blockedCount={editor.selection.blocked.length}
        blockedShakeStyle={blockedShakeStyle}
        likedCount={editor.selection.positive.length}
        likedShakeStyle={likedShakeStyle}
        tone="limonada"
      />
      <TagBoard catalog={catalog} onPress={onPress} selection={editor.selection} />
    </>
  );
}

const like = (slug: string) => screen.getByTestId(`tag-board-${slug}-like`);
const block = (slug: string) => screen.getByTestId(`tag-board-${slug}-block`);

describe("TagBoard (one page of compact chips, + and − per tag)", () => {
  beforeEach(() => {
    useToastStore.getState().clear();
  });

  it("lays the stickers out in a three-column sheet, without a search field", () => {
    renderWithTheme(<Harness />);
    const chip = screen.getByTestId("tag-board-hiking");
    expect(chip.parentElement).toHaveStyle({ width: "33.3333%" });
    expect(chip.parentElement?.parentElement).toHaveStyle({ flexDirection: "row", flexWrap: "wrap" });
    expect(chip).toHaveStyle({ minHeight: "112px" });
    expect(screen.queryByTestId("tag-board-search")).not.toBeInTheDocument();
  });

  it("gives each tag two labelled controls in Spanish", () => {
    renderWithTheme(<Harness />);

    expect(screen.getByRole("checkbox", { name: "Me gusta: Senderismo" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("checkbox", { name: "Bloquear: Fumar" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Una etiqueta con un nombre larguísimo que no cabe")).toBeInTheDocument();
    expect(screen.getByTestId("tag-summary-liked-count")).toHaveTextContent("0/8");
    expect(screen.getByTestId("tag-summary-blocked-count")).toHaveTextContent("0/5");
  });

  it("+ likes, + again clears, − blocks, and the other control switches", () => {
    renderWithTheme(<Harness />);

    fireEvent.click(like("hiking"));
    expect(like("hiking")).toHaveAttribute("aria-checked", "true");
    // Marca además del color: el «+» pasa a ✓.
    expect(screen.getByTestId("tag-board-hiking-like-mark")).toBeInTheDocument();
    expect(screen.getByTestId("tag-summary-liked-count")).toHaveTextContent("1/8");

    fireEvent.click(like("hiking"));
    expect(like("hiking")).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByTestId("tag-board-hiking-like-mark")).not.toBeInTheDocument();

    fireEvent.click(block("smoking"));
    expect(block("smoking")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Fumar")).toHaveStyle({ textDecorationLine: "line-through" });
    expect(screen.getByTestId("tag-summary-blocked-count")).toHaveTextContent("1/5");

    // Cambiar de «bloqueada» a «me gusta» con el otro control: nunca las dos a la vez.
    fireEvent.click(like("smoking"));
    expect(like("smoking")).toHaveAttribute("aria-checked", "true");
    expect(block("smoking")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("tag-summary-blocked-count")).toHaveTextContent("0/5");
    expect(screen.getByTestId("tag-summary-liked-count")).toHaveTextContent("1/8");
  });

  it("stops at 8 liked with a warning toast (shown once, not queued per tap)", () => {
    const eight = catalog.slice(0, 8).map((tag) => tag.id);
    renderWithTheme(<Harness initial={{ positive: eight, blocked: [] }} />);

    fireEvent.click(like("hiking"));
    fireEvent.click(like("smoking"));

    expect(like("hiking")).toHaveAttribute("aria-checked", "false");
    const { current, queue } = useToastStore.getState();
    expect(current?.message).toMatch(/Ya tienes 8 que te gustan/);
    expect(current?.tone).toBe("warning");
    expect(queue).toHaveLength(0);
  });

  it("stops at 5 blocked, also when switching a liked tag", () => {
    const five = catalog.slice(0, 5).map((tag) => tag.id);
    renderWithTheme(<Harness initial={{ positive: [catalog[11].id], blocked: five }} />);

    fireEvent.click(block("hiking"));

    expect(like("hiking")).toHaveAttribute("aria-checked", "true");
    expect(block("hiking")).toHaveAttribute("aria-checked", "false");
    expect(useToastStore.getState().current?.message).toMatch(/Ya tienes 5 bloqueadas/);
  });

  it("only re-renders the row that changed", () => {
    renderWithTheme(<Harness />);
    const useTheme = vi.mocked(ui.useTheme);
    const before = useTheme.mock.calls.length;

    act(() => {
      fireEvent.click(like("hiking"));
    });

    // Resumen (+ sus 2 medidores) + la sección de «hiking» (+ su contador nuevo) + su
    // pegatina + su «+»; ni las otras pegatinas (3 llamadas cada una) ni el «−».
    expect(useTheme.mock.calls.length - before).toBe(7);
  });
});
