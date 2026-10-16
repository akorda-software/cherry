import { act, fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../../test/ui/render-with-theme";
import type { MatchesListResult } from "../application/use-matches";
import { ChatsScreen } from "./chats-screen";
import { makeMatch } from "./testing/match-fixture";
import { TEST_WINDOW_SIZE, windowedLists } from "./testing/windowed-flash-list";

const fixture = vi.hoisted(() => ({
  list: null as unknown as MatchesListResult,
  push: vi.fn(),
  navigate: vi.fn(),
  focused: true,
  onFocus: null as ((first: boolean) => void) | null,
  refreshSummary: vi.fn()
}));

vi.mock("@shopify/flash-list", () => import("./testing/windowed-flash-list"));
vi.mock("react-native", async () => ({
  ...await import("../../../../test/mocks/react-native"),
  RefreshControl: () => null
}));
vi.mock("../application/use-matches", () => ({ useMatchesList: () => fixture.list }));
vi.mock("../../activity/application/use-activity-summary", () => ({ useActivitySummary: () => null }));
vi.mock("../../activity/application/activity-poller", () => ({ refreshActivitySummary: fixture.refreshSummary }));
vi.mock("../../activity/presentation/use-screen-focus", () => ({
  useScreenFocus: (onFocus: (first: boolean) => void) => {
    fixture.onFocus = onFocus;
    return fixture.focused;
  }
}));
vi.mock("expo-router", async () => ({
  ...await import("../../../../test/mocks/expo-router"),
  useRouter: () => ({ push: fixture.push, navigate: fixture.navigate })
}));

beforeEach(() => {
  fixture.list = {
    matches: [], newMatches: [], conversations: [], status: "ready", error: null,
    refreshing: false, loadingMore: false, hasMore: false,
    loadMore: vi.fn().mockResolvedValue(undefined), reload: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined), refreshSilently: vi.fn().mockResolvedValue(undefined)
  };
  fixture.push.mockReset();
  fixture.navigate.mockReset();
  fixture.refreshSummary.mockReset();
  fixture.focused = true;
  windowedLists.clear();
});

function setContent(newCount: number, conversationCount: number) {
  fixture.list.newMatches = Array.from({ length: newCount }, (_, i) => makeMatch(`new-${i}`, { lastMessage: null }));
  fixture.list.conversations = Array.from({ length: conversationCount }, (_, i) => makeMatch(String(i), { unreadCount: i === 0 ? 2 : 0 }));
  fixture.list.matches = [...fixture.list.newMatches, ...fixture.list.conversations];
}

describe("ChatsScreen", () => {
  it.each(["idle", "loading"] as const)("shows loading, not the empty state, during %s", (status) => {
    fixture.list.status = status;
    renderWithTheme(<ChatsScreen />);
    expect(screen.getByTestId("chats-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("chats-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chats-error")).not.toBeInTheDocument();
  });

  it("keeps empty discovery navigation and error retry", () => {
    const { rerender } = renderWithTheme(<ChatsScreen />);
    expect(screen.getByTestId("chats-empty")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ir a Descubrir" }));
    expect(fixture.navigate).toHaveBeenCalledWith("/(app)/(tabs)/discover");
    fixture.list.status = "error";
    fixture.list.error = new Error("Offline");
    rerender(<ChatsScreen />);
    expect(screen.getByTestId("chats-error")).toBeInTheDocument();
    expect(screen.queryByTestId("chats-empty")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reintentar/i }));
    expect(fixture.list.reload).toHaveBeenCalledOnce();
  });

  it("preserves section order, grouped edges, unread labels and navigation", () => {
    setContent(2, 3);
    renderWithTheme(<ChatsScreen />);
    expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual(["Chats", "Nuevos matches", "Mensajes"]);
    expect(screen.queryByTestId("chats-icebreak-note")).not.toBeInTheDocument();
    expect(screen.getByTestId("conversation-group-0")).toHaveStyle({ borderTopWidth: "3px", borderBottomWidth: "0px" });
    expect(screen.getByTestId("conversation-group-1")).toHaveStyle({ borderTopWidth: "0px", borderBottomWidth: "0px" });
    expect(screen.getByTestId("conversation-group-2")).toHaveStyle({ borderTopWidth: "0px", borderBottomWidth: "3px" });
    expect(screen.getByTestId("conversation-shadow-0")).toHaveStyle({ top: "4px", bottom: "0px" });
    expect(screen.getByTestId("conversation-shadow-1")).toHaveStyle({ top: "0px", bottom: "0px" });
    expect(screen.getByTestId("conversation-shadow-2")).toHaveStyle({ top: "0px", bottom: "-4px" });
    expect(screen.getAllByRole("separator")).toHaveLength(2);
    expect(screen.getByTestId("conversation-0")).toHaveAttribute("aria-label", expect.stringContaining("2 mensajes sin leer"));
    fireEvent.click(screen.getByTestId("conversation-0"));
    expect(fixture.push).toHaveBeenLastCalledWith({ pathname: "/(app)/chat/[id]", params: { id: "conv-0" } });
    fireEvent.click(screen.getByTestId("new-match-new-1"));
    expect(fixture.push).toHaveBeenLastCalledWith({ pathname: "/(app)/chat/[id]", params: { id: "conv-new-1" } });
  });

  it("shows the icebreaker only for new matches and combines both corners for a single conversation", () => {
    setContent(1, 0);
    const { rerender } = renderWithTheme(<ChatsScreen />);
    expect(screen.getByTestId("chats-icebreak-note")).toBeInTheDocument();
    expect(screen.queryByTestId("chats-conversations")).not.toBeInTheDocument();
    setContent(0, 1);
    rerender(<ChatsScreen />);
    expect(screen.queryByTestId("chats-icebreak-note")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chats-new-matches")).not.toBeInTheDocument();
    expect(screen.getByTestId("conversation-group-0")).toHaveStyle({ borderTopWidth: "3px", borderBottomWidth: "3px" });
  });

  it("keeps refresh, silent refocus, automatic pagination and manual error recovery", () => {
    setContent(1, 2);
    fixture.list.hasMore = true;
    const { rerender } = renderWithTheme(<ChatsScreen />);
    expect(fixture.list.loadMore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("chats-list-refresh"));
    expect(fixture.list.refresh).toHaveBeenCalledOnce();
    act(() => fixture.onFocus?.(true));
    expect(fixture.list.refreshSilently).not.toHaveBeenCalled();
    act(() => fixture.onFocus?.(false));
    expect(fixture.list.refreshSilently).toHaveBeenCalledOnce();
    expect(fixture.refreshSummary).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId("chats-list-start"));
    expect(fixture.list.loadMore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("chats-list-end"));
    expect(fixture.list.loadMore).toHaveBeenCalledOnce();

    fixture.list.loadingMore = true;
    rerender(<ChatsScreen />);
    expect(screen.getByTestId("chats-load-more")).toBeDisabled();
    expect(screen.getByTestId("chats-load-more")).toHaveTextContent("Cargando chats…");
    fireEvent.click(screen.getByTestId("chats-list-end"));
    expect(fixture.list.loadMore).toHaveBeenCalledOnce();

    fixture.list.loadingMore = false;
    fixture.list.error = new Error("Offline");
    fixture.list.status = "error";
    rerender(<ChatsScreen />);
    expect(screen.getByTestId("conversation-0")).toBeInTheDocument();
    expect(screen.queryByTestId("chats-error")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("chats-list-end"));
    expect(fixture.list.loadMore).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId("chats-load-more"));
    expect(fixture.list.loadMore).toHaveBeenCalledTimes(2);
    fixture.list.hasMore = false;
    rerender(<ChatsScreen />);
    expect(screen.queryByTestId("chats-load-more")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("chats-list-end"));
    expect(fixture.list.loadMore).toHaveBeenCalledTimes(2);
  });

  it("hands 2400 matches to two virtualizers, not to a map of mounted rows", () => {
    setContent(1_200, 1_200);
    const { rerender } = renderWithTheme(<ChatsScreen />);
    expect(screen.getByTestId("chats-list")).toHaveAttribute("data-total-count", "1202");
    expect(screen.getByTestId("chats-new-matches-list")).toHaveAttribute("data-total-count", "1200");
    expect(screen.getAllByTestId(/^conversation-group-/)).toHaveLength(TEST_WINDOW_SIZE - 2);
    expect(within(screen.getByTestId("chats-new-matches-list")).getAllByTestId(/^new-match-/)).toHaveLength(TEST_WINDOW_SIZE);
    expect(screen.queryByTestId("conversation-1000")).not.toBeInTheDocument();
    expect(screen.queryByTestId("new-match-new-1000")).not.toBeInTheDocument();

    const data = windowedLists.get("chats-list")!.data;
    // An unrelated refresh flag must not rebuild all presentation items.
    fixture.list.refreshing = true;
    rerender(<ChatsScreen />);
    expect(windowedLists.get("chats-list")!.data).toBe(data);
    expect(windowedLists.get("chats-list")!.refreshControl?.props.refreshing).toBe(true);
    fireEvent.click(screen.getByTestId("chats-new-matches-list-next-window"));
    expect(screen.queryByTestId("new-match-new-0")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("new-match-new-8"));
    expect(fixture.push).toHaveBeenLastCalledWith({ pathname: "/(app)/chat/[id]", params: { id: "conv-new-8" } });
    fireEvent.click(screen.getByTestId("chats-list-next-window"));
    expect(screen.queryByTestId("conversation-0")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("conversation-6"));
    expect(fixture.push).toHaveBeenLastCalledWith({ pathname: "/(app)/chat/[id]", params: { id: "conv-6" } });
  });

  it("appends pages without losing existing rows and transfers the grouped bottom edge", () => {
    setContent(0, 2);
    fixture.list.hasMore = true;
    const original = fixture.list.conversations[0];
    const { rerender } = renderWithTheme(<ChatsScreen />);
    const firstNode = screen.getByTestId("conversation-0");
    expect(screen.getByTestId("conversation-group-1")).toHaveStyle({ borderBottomWidth: "3px" });
    fixture.list.conversations = [...fixture.list.conversations, makeMatch("page-2")];
    fixture.list.matches = fixture.list.conversations;
    fixture.list.hasMore = false;
    rerender(<ChatsScreen />);
    expect(fixture.list.conversations[0]).toBe(original);
    expect(screen.getByTestId("conversation-0")).toBe(firstNode);
    expect(screen.getByTestId("conversation-group-1")).toHaveStyle({ borderBottomWidth: "0px" });
    expect(screen.getByTestId("conversation-group-page-2")).toHaveStyle({ borderBottomWidth: "3px" });
    expect(screen.queryByTestId("chats-load-more")).not.toBeInTheDocument();
  });
});
