import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { DiscoveryMatch } from "@cherry/contracts";

import { renderWithTheme } from "../../../../test/ui/render-with-theme";
import { useMatchCelebrationStore } from "../match-celebration-store";
import { MatchCelebrationHost } from "./match-celebration-host";

const match: DiscoveryMatch = {
  id: "m1",
  conversationId: "c1",
  matchedAt: "2026-09-29T10:00:00Z",
  expiresAt: "2026-10-29T10:00:00Z",
  otherProfile: { id: "p2", displayName: "Hugo", age: 31, photoUrl: "https://x/hugo.jpg" }
};

describe("MatchCelebrationHost", () => {
  beforeEach(() => {
    useMatchCelebrationStore.setState({ match: null, queue: [] });
  });

  it("renders nothing until a match is shown", () => {
    renderWithTheme(<MatchCelebrationHost />);

    expect(screen.queryByTestId("match-celebration")).not.toBeInTheDocument();
  });

  it("celebrates the match with both CTAs and dismisses", () => {
    renderWithTheme(<MatchCelebrationHost />);

    act(() => useMatchCelebrationStore.getState().show(match));

    expect(screen.getByTestId("match-celebration")).toBeInTheDocument();
    expect(screen.getByText("¡Es un match!")).toBeInTheDocument();
    expect(screen.getByText("A Hugo también le gustas.")).toBeInTheDocument();
    expect(screen.getByTestId("match-say-hello")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("match-keep-looking"));

    expect(useMatchCelebrationStore.getState().match).toBeNull();
    expect(screen.queryByTestId("match-celebration")).not.toBeInTheDocument();
  });
});
