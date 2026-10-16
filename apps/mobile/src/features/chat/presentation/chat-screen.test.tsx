import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MatchSummary } from "@cherry/contracts";

import { renderWithTheme } from "../../../../test/ui/render-with-theme";
import { useChatDraftStore } from "../application/chat-draft-store";
import { ChatScreen } from "./chat-screen";

const fixture = vi.hoisted(() => ({
  send: vi.fn(),
  notifyTyping: vi.fn(),
  useChatSession: vi.fn(),
  unmatch: vi.fn(),
  match: null as MatchSummary | null
}));

vi.mock("../application/use-chat-session", () => ({ useChatSession: fixture.useChatSession }));
vi.mock("../application/use-icebreakers", () => ({
  useIcebreakers: () => ({ icebreakers: [{ id: "idea", tag: null, message: "Una idea bonita" }], loading: false })
}));
vi.mock("../../matches/application/use-matches", () => ({
  useMatchForConversation: () => ({ match: fixture.match, status: "ready" }),
  useUnmatch: () => fixture.unmatch
}));
vi.mock("../../activity/presentation/use-screen-focus", () => ({
  useScreenFocus: () => true,
  useDelayedFlag: () => false
}));

beforeEach(() => {
  useChatDraftStore.getState().clear();
  fixture.send.mockReset().mockReturnValue(true);
  fixture.notifyTyping.mockReset();
  fixture.match = {
    id: "match", conversationId: "one", matchedAt: "2026-10-01T10:00:00Z",
    expiresAt: null, firstMessageAt: null, lastMessage: null, unreadCount: 0,
    otherProfile: { id: "other", displayName: "Ada", age: 30, photoUrl: null }
  };
  fixture.useChatSession.mockReset().mockReturnValue({
    state: {
      status: "ready", messages: [], outbox: [], liveKeys: new Set(),
      connection: "live", hasOlder: false, loadingOlder: false, olderError: false, otherTyping: false
    },
    timeline: [], send: fixture.send, notifyTyping: fixture.notifyTyping,
    retry: vi.fn(), discard: vi.fn(), loadOlder: vi.fn(), retryLoad: vi.fn()
  });
});

describe("ChatScreen draft isolation", () => {
  it("never carries the previous conversation's cached person into another route", () => {
    const { rerender } = renderWithTheme(<ChatScreen conversationId="one" />);
    expect(screen.getByTestId("chat-header-profile")).toHaveAttribute("aria-label", "Ver el perfil de Ada");
    fixture.match = null;
    rerender(<ChatScreen conversationId="two" />);
    expect(screen.queryByTestId("chat-header-profile")).not.toBeInTheDocument();
  });

  it("updates the editor without rendering the screen/session again for each keystroke", () => {
    renderWithTheme(<ChatScreen conversationId="one" />);
    const calls = fixture.useChatSession.mock.calls.length;
    fireEvent.change(screen.getByTestId("chat-input"), { target: { value: "H" } });
    fireEvent.change(screen.getByTestId("chat-input"), { target: { value: "Hola" } });
    expect(screen.getByTestId("chat-input")).toHaveValue("Hola");
    expect(fixture.notifyTyping).toHaveBeenCalledTimes(2);
    expect(fixture.useChatSession).toHaveBeenCalledTimes(calls);
  });

  it("preserves a rejected message and clears only after an accepted send", () => {
    renderWithTheme(<ChatScreen conversationId="one" />);
    fireEvent.change(screen.getByTestId("chat-input"), { target: { value: "Hola" } });
    fixture.send.mockReturnValue(false);
    fireEvent.click(screen.getByTestId("chat-send"));
    expect(screen.getByTestId("chat-input")).toHaveValue("Hola");
    fixture.send.mockReturnValue(true);
    fireEvent.click(screen.getByTestId("chat-send"));
    expect(fixture.send).toHaveBeenLastCalledWith("Hola");
    expect(screen.getByTestId("chat-input")).toHaveValue("");
    expect(useChatDraftStore.getState().drafts.size).toBe(0);
  });

  it("keeps navigation drafts independent and restores one after remount", () => {
    const first = renderWithTheme(<ChatScreen conversationId="one" />);
    fireEvent.change(screen.getByTestId("chat-input"), { target: { value: "Draft one" } });
    first.rerender(<ChatScreen conversationId="two" />);
    expect(screen.getByTestId("chat-input")).toHaveValue("");
    fireEvent.change(screen.getByTestId("chat-input"), { target: { value: "Draft two" } });
    first.unmount();
    renderWithTheme(<ChatScreen conversationId="one" />);
    expect(screen.getByTestId("chat-input")).toHaveValue("Draft one");
    expect(useChatDraftStore.getState().drafts.get("two")).toBe("Draft two");
  });

  it("can insert an icebreaker and clears the mounted editor when drafts are reset", () => {
    renderWithTheme(<ChatScreen conversationId="one" />);
    fireEvent.click(screen.getByTestId("icebreaker-idea"));
    expect(screen.getByTestId("chat-input")).toHaveValue("Una idea bonita");
    act(() => useChatDraftStore.getState().clear());
    expect(screen.getByTestId("chat-input")).toHaveValue("");
  });
});
