import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MatchSummary } from "@snack/contracts";

import { renderWithTheme } from "../../../../test/ui/render-with-theme";
import { ConversationRow } from "./conversation-row";

const now = new Date(2026, 8, 29, 18, 0).getTime();

function match(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    id: "match-1",
    conversationId: "conv-1",
    matchedAt: new Date(2026, 8, 20, 10, 0).toISOString(),
    expiresAt: null,
    firstMessageAt: new Date(2026, 8, 20, 11, 0).toISOString(),
    otherProfile: { id: "other", displayName: "Pablo", age: 31, photoUrl: null },
    lastMessage: {
      id: "m1",
      conversationId: "conv-1",
      senderProfileId: "me",
      body: "¡Allí estaré!",
      insertedAt: new Date(2026, 8, 29, 17, 55).toISOString()
    },
    unreadCount: 0,
    ...overrides
  };
}

describe("ConversationRow", () => {
  it("shows my last message with «Tú:» and a relative time", () => {
    renderWithTheme(<ConversationRow match={match()} now={now} onOpen={vi.fn()} />);

    expect(screen.getByText("Pablo")).toBeInTheDocument();
    expect(screen.getByText("Tú: ¡Allí estaré!")).toBeInTheDocument();
    expect(screen.getByText("hace 5 min")).toBeInTheDocument();
    expect(screen.queryByTestId("conversation-unread-match-1")).not.toBeInTheDocument();
  });

  it("highlights unread messages and describes them for screen readers", () => {
    const onOpen = vi.fn();
    const unread = match({
      unreadCount: 2,
      lastMessage: { ...match().lastMessage!, senderProfileId: "other", body: "¿Vienes?" }
    });
    renderWithTheme(<ConversationRow match={unread} now={now} onOpen={onOpen} />);

    expect(screen.getByText("¿Vienes?")).toBeInTheDocument();
    expect(screen.getByTestId("conversation-unread-match-1")).toHaveTextContent("2");

    const row = screen.getByTestId("conversation-match-1");
    expect(row).toHaveAttribute("aria-label", "Pablo. ¿Vienes?. hace 5 minutos. 2 mensajes sin leer");

    fireEvent.click(row);
    expect(onOpen).toHaveBeenCalledWith(unread);
  });
});
