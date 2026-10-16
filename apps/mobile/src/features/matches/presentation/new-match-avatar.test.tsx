import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../../test/ui/render-with-theme";
import { NewMatchAvatar } from "./new-match-avatar";
import { makeMatch } from "./testing/match-fixture";

describe("NewMatchAvatar", () => {
  it("resets the avatar image, not the whole recycled cell, when its person changes", () => {
    const now = Date.parse("2026-10-15T10:00:00Z");
    const first = makeMatch("first", { lastMessage: null });
    const second = makeMatch("second", { lastMessage: null });
    first.otherProfile.photoUrl = "https://photo/first";
    second.otherProfile.photoUrl = "https://photo/second";
    const onOpen = vi.fn();
    const { rerender } = renderWithTheme(<NewMatchAvatar index={0} match={first} now={now} onOpen={onOpen} />);
    const previousImage = screen.getByTestId("expo-image");
    const previousCell = screen.getByTestId("new-match-first");
    rerender(<NewMatchAvatar index={5} match={second} now={now} onOpen={onOpen} />);
    expect(screen.getByTestId("new-match-second")).toBe(previousCell);
    expect(screen.getByTestId("expo-image")).not.toBe(previousImage);
    expect(previousImage).not.toBeInTheDocument();
    expect(screen.getByTestId("expo-image")).toHaveTextContent("https://photo/second");
  });

  it("preserves expiry hints and describes the match for screen readers", () => {
    const match = makeMatch("new", { lastMessage: null, expiresAt: "2026-10-20T10:00:00Z" });
    const onOpen = vi.fn();
    renderWithTheme(<NewMatchAvatar index={0} match={match} now={Date.parse("2026-10-15T10:00:00Z")} onOpen={onOpen} />);
    expect(screen.getByText("quedan 5 días")).toBeInTheDocument();
    const avatar = screen.getByTestId("new-match-new");
    expect(avatar).toHaveAttribute("aria-label", "Persona new, 31. match nuevo. Quedan 5 días para saludar");
    fireEvent.click(avatar);
    expect(onOpen).toHaveBeenCalledWith(match);
  });

  it("replaces labels, expiry and callbacks when a virtualized cell is reused", () => {
    const now = Date.parse("2026-10-15T10:00:00Z");
    const first = makeMatch("first", { lastMessage: null, expiresAt: "2026-10-16T10:00:00Z" });
    const second = makeMatch("second", { lastMessage: null });
    const onOpen = vi.fn();
    const { rerender } = renderWithTheme(<NewMatchAvatar index={0} match={first} now={now} onOpen={onOpen} />);
    expect(screen.getByText("queda 1 día")).toBeInTheDocument();
    rerender(<NewMatchAvatar index={8} match={second} now={now} onOpen={onOpen} />);
    expect(screen.queryByTestId("new-match-first")).not.toBeInTheDocument();
    expect(screen.queryByText("queda 1 día")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("new-match-second"));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(second);
  });
});
