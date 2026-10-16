import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActivitySummary, ChatMessage, MatchSummary, SessionBundle } from "@cherry/contracts";

import { useActivityStore } from "../../activity/application/activity-store";
import { useSessionStore } from "../../auth/presentation/session-store";
import { useMatchesStore } from "../../matches/application/matches-store";
import { FakeSocket } from "../test-utils/fake-phoenix";
import { useChatSession } from "./use-chat-session";

vi.mock("phoenix", () => import("../test-utils/fake-phoenix"));

const appState = vi.hoisted(() => {
  const listeners = new Set<(state: string) => void>();
  return {
    currentState: "active",
    addEventListener: (_type: string, listener: (state: string) => void) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
    emit(state: string) {
      appState.currentState = state;
      listeners.forEach((listener) => listener(state));
    }
  };
});

vi.mock("react-native", async () => {
  const base = await import("../../../../test/mocks/react-native");
  return { ...base, AppState: appState, Platform: { OS: "ios" } };
});

const chatApi = vi.hoisted(() => ({
  listMessages: vi.fn(),
  sendMessage: vi.fn(),
  markRead: vi.fn()
}));

const auth = vi.hoisted(() => {
  const callApi = (run: (api: unknown) => Promise<unknown>) => run(chatApi);
  const shell = { executeAuthenticated: (request: (token: string) => Promise<unknown>) => request("tok") };
  const config = { apiBaseUrl: "http://localhost:4000", bootstrapConfig: null, reader: null, loading: false };
  return { callApi, shell, config };
});

vi.mock("../../auth/presentation", () => ({
  useAuthedApi: () => auth.callApi,
  useSessionShell: () => auth.shell
}));

vi.mock("../../../shared/config", () => ({
  useRuntimeConfig: () => auth.config
}));

const CONV = "conv-1";
const OTHER = "other";

function message(id: string, sender: string, seconds: number): ChatMessage {
  return {
    id,
    conversationId: CONV,
    senderProfileId: sender,
    body: `body ${id}`,
    insertedAt: new Date(Date.UTC(2026, 8, 29, 10, 0, seconds)).toISOString()
  };
}

function match(overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    id: "match-1",
    conversationId: CONV,
    matchedAt: "2026-09-28T10:00:00Z",
    expiresAt: null,
    firstMessageAt: "2026-09-28T10:00:00Z",
    otherProfile: { id: OTHER, displayName: "Lucía", age: 29, photoUrl: null },
    lastMessage: message("m1", OTHER, 1),
    unreadCount: 2,
    ...overrides
  };
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.reset();
  appState.currentState = "active";
  chatApi.listMessages.mockReset().mockResolvedValue({ messages: [message("m1", OTHER, 1)], nextCursor: null });
  chatApi.sendMessage.mockReset();
  chatApi.markRead.mockReset().mockResolvedValue(undefined);
  useMatchesStore.getState().reset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  useSessionStore.setState({ status: "signed-out", session: null });
  vi.useRealTimers();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const sessionBundle: SessionBundle = {
  accessToken: "test-access", accessTokenExpiresAt: "2099-01-01T00:00:00Z",
  refreshToken: "test-refresh", refreshTokenExpiresAt: "2099-01-01T00:00:00Z",
  user: { id: "account-a", displayName: "A", email: "a@example.test" }
};

async function startSummaryRefresh() {
  const response = deferred<Response>();
  const fetchMock = vi.fn(() => response.promise);
  vi.stubGlobal("fetch", fetchMock);
  const hook = renderHook(() => useChatSession(CONV, { otherProfileId: OTHER, focused: false }));
  await flush();
  act(() => FakeSocket.last().simulateError());
  await flush();
  expect(fetchMock).toHaveBeenCalledOnce();
  return { ...hook, respond: (summary: ActivitySummary) => response.resolve(new Response(JSON.stringify(summary), { status: 200 })) };
}

describe("useChatSession", () => {
  it("never applies a reconnection summary before the authenticated response ownership check", async () => {
    useSessionStore.setState({
      status: "signed-in", session: sessionBundle,
      services: { ...useSessionStore.getState().services, executeAuthenticated: undefined }
    });
    vi.spyOn(auth.shell, "executeAuthenticated").mockImplementation(useSessionStore.getState().executeAuthenticated);
    const hook = await startSummaryRefresh();
    const current = { receivedLikesCount: 1, newMatchesCount: 2, unreadConversationsCount: 3 };
    useSessionStore.setState({ session: { ...sessionBundle, user: { ...sessionBundle.user, id: "account-b" } } });
    useActivityStore.getState().setSummary(current);
    hook.respond({ receivedLikesCount: 9, newMatchesCount: 9, unreadConversationsCount: 9 });
    await flush();
    expect(useActivityStore.getState().summary).toEqual(current);
  });

  it("does not publish a late reconnection summary after the chat unmounts", async () => {
    const hook = await startSummaryRefresh();
    const current = { receivedLikesCount: 1, newMatchesCount: 2, unreadConversationsCount: 3 };
    useActivityStore.getState().setSummary(current);
    hook.unmount();
    hook.respond({ receivedLikesCount: 9, newMatchesCount: 9, unreadConversationsCount: 9 });
    await flush();
    expect(useActivityStore.getState().summary).toEqual(current);
  });

  it("still publishes a current reconnection summary after validation", async () => {
    const hook = await startSummaryRefresh();
    const summary = { receivedLikesCount: 4, newMatchesCount: 2, unreadConversationsCount: 1 };
    hook.respond(summary);
    await flush();
    expect(useActivityStore.getState().summary).toEqual(summary);
  });

  it("loads the history, opens the socket on the derived URL and builds the timeline", async () => {
    const { result } = renderHook(() => useChatSession(CONV, { otherProfileId: OTHER, focused: true }));
    await flush();

    expect(chatApi.listMessages).toHaveBeenCalledWith(CONV, { limit: 40 });
    expect(result.current.state.status).toBe("ready");
    expect(result.current.timeline.map((item) => item.key)).toEqual(["m1", expect.stringMatching(/^day-/)]);

    const socket = FakeSocket.last();
    expect(socket.endPoint).toBe("ws://localhost:4000/socket");
    expect(socket.connectParams).toEqual([{ token: "tok" }]);
  });

  it("marks as read when focused and clears the unread count in the chats list", async () => {
    await act(async () => {
      await useMatchesStore.getState().load(async () => ({ matches: [match()], nextCursor: null }));
    });

    renderHook(() => useChatSession(CONV, { otherProfileId: OTHER, focused: true }));
    await flush();
    await flush();

    expect(chatApi.markRead).toHaveBeenCalledWith(CONV);
    expect(useMatchesStore.getState().matches[0]!.unreadCount).toBe(0);
  });

  it("does not mark as read while the screen is not focused", async () => {
    const { rerender } = renderHook(({ focused }) => useChatSession(CONV, { otherProfileId: OTHER, focused }), {
      initialProps: { focused: false }
    });
    await flush();
    expect(chatApi.markRead).not.toHaveBeenCalled();

    rerender({ focused: true });
    await flush();
    expect(chatApi.markRead).toHaveBeenCalledTimes(1);
  });

  it("releases the socket in background and resumes in foreground", async () => {
    renderHook(() => useChatSession(CONV, { otherProfileId: OTHER, focused: true }));
    await flush();
    const socket = FakeSocket.last();
    socket.simulateOpen();
    socket.channelFor(`chat:${CONV}`).simulateJoinOk();
    await flush();

    act(() => appState.emit("background"));
    expect(socket.disconnectCalls).toBe(1);

    chatApi.listMessages.mockClear();
    act(() => appState.emit("active"));
    await flush();
    expect(chatApi.listMessages).toHaveBeenCalledTimes(1);
    expect(socket.connectCalls).toBe(2);
  });

  it("sends and patches the chats list with my message", async () => {
    await act(async () => {
      await useMatchesStore.getState().load(async () => ({ matches: [match()], nextCursor: null }));
    });
    const { result } = renderHook(() => useChatSession(CONV, { otherProfileId: OTHER, focused: true }));
    await flush();
    chatApi.sendMessage.mockResolvedValueOnce(message("s1", "me", 30));

    let accepted = false;
    act(() => {
      accepted = result.current.send("¡Hola!");
    });
    expect(accepted).toBe(true);
    await flush();

    expect(chatApi.sendMessage).toHaveBeenCalledWith(CONV, "¡Hola!");
    expect(useMatchesStore.getState().matches[0]!.lastMessage?.id).toBe("s1");
    expect(result.current.send("   ")).toBe(false);
  });

  it("drops the match from the list when the conversation is no longer available", async () => {
    await act(async () => {
      await useMatchesStore.getState().load(async () => ({ matches: [match()], nextCursor: null }));
    });
    chatApi.listMessages
      .mockReset()
      .mockRejectedValue(
        Object.assign(new Error("conversation_not_active"), { status: 403, code: "conversation_not_active" })
      );

    const { result } = renderHook(() => useChatSession(CONV, { otherProfileId: OTHER, focused: true }));
    await flush();

    expect(result.current.state.status).toBe("unavailable");
    expect(useMatchesStore.getState().matches).toEqual([]);
  });

  it("disposes the session on unmount", async () => {
    const { unmount } = renderHook(() => useChatSession(CONV, { otherProfileId: OTHER, focused: true }));
    await flush();
    const socket = FakeSocket.last();

    unmount();
    expect(socket.disconnectCalls).toBe(1);
  });
});
