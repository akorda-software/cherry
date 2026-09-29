import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage, ConversationMessagesPage } from "@snack/contracts";

import { FakeSocket } from "../test-utils/fake-phoenix";
import {
  AUTO_RETRY_DELAY_MS,
  CHAT_PAGE_SIZE,
  TYPING_THROTTLE_MS,
  TYPING_TTL_MS,
  createChatSession,
  type ChatSessionOptions
} from "./chat-session";

vi.mock("phoenix", () => import("../test-utils/fake-phoenix"));

const CONV = "conv-1";
const TOPIC = `chat:${CONV}`;
const ME = "profile-me";
const OTHER = "profile-other";
const T0 = Date.parse("2026-09-29T10:00:00Z");

function at(seconds: number): string {
  return new Date(T0 + seconds * 1000).toISOString();
}

function msg(id: string, sender: string, body: string, secondsFromT0: number): ChatMessage {
  return { id, conversationId: CONV, senderProfileId: sender, body, insertedAt: at(secondsFromT0) };
}

function page(messages: ChatMessage[], nextCursor: string | null = null): ConversationMessagesPage {
  // El backend devuelve de más nuevo a más antiguo.
  return { messages: [...messages].sort((a, b) => b.insertedAt.localeCompare(a.insertedAt)), nextCursor };
}

function apiError(status: number, code?: string): Error {
  const error = new Error(code ?? `status ${status}`) as Error & { status: number; code?: string };
  error.status = status;
  if (code) {
    error.code = code;
  }
  return error;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}

function setup(overrides: Partial<ChatSessionOptions> = {}, initial: ConversationMessagesPage = page([])) {
  let ids = 0;
  const api = {
    listMessages: vi.fn<ChatSessionOptions["api"]["listMessages"]>().mockResolvedValue(initial),
    sendMessage: vi.fn<ChatSessionOptions["api"]["sendMessage"]>(),
    markRead: vi.fn<ChatSessionOptions["api"]["markRead"]>().mockResolvedValue(undefined)
  };
  const getSocketToken = vi.fn(async ({ fresh }: { fresh: boolean }) => (fresh ? "fresh-token" : "stored-token"));
  const events = {
    onLatestMessage: vi.fn(),
    onRead: vi.fn(),
    onIncomingMessage: vi.fn(),
    onUnavailable: vi.fn()
  };

  const session = createChatSession({
    conversationId: CONV,
    socketUrl: "ws://localhost:4000/socket",
    api,
    getSocketToken,
    otherProfileId: OTHER,
    events,
    createClientId: () => `client-${++ids}`,
    ...overrides
  });

  const listener = vi.fn();
  session.subscribe(listener);

  return { session, api, getSocketToken, events, listener };
}

/** Arranca, carga el historial y deja el canal unido. */
async function startJoined(options: Parameters<typeof setup>[0] = {}, initial?: ConversationMessagesPage) {
  const ctx = setup(options, initial);
  ctx.session.start();
  await flush();
  const socket = FakeSocket.last();
  socket.simulateOpen();
  const channel = socket.channelFor(TOPIC);
  channel.simulateJoinOk();
  await flush();
  ctx.api.listMessages.mockClear();
  return { ...ctx, socket, channel };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0 + 60_000);
  FakeSocket.reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("chat session · carga inicial", () => {
  it("loads the newest page, sorts it newest first and then opens the socket", async () => {
    const history = page([msg("m1", OTHER, "hola", 1), msg("m2", ME, "¡hola!", 2)], "cursor-older");
    const { session, api, getSocketToken } = setup({}, history);

    expect(session.getState().status).toBe("loading");
    session.start();
    await flush();

    const state = session.getState();
    expect(api.listMessages).toHaveBeenCalledWith({ limit: CHAT_PAGE_SIZE });
    expect(state.status).toBe("ready");
    expect(state.messages.map((m) => m.id)).toEqual(["m2", "m1"]);
    expect(state.hasOlder).toBe(true);
    expect(state.myProfileId).toBe(ME);

    expect(getSocketToken).toHaveBeenCalledWith({ fresh: false });
    const socket = FakeSocket.last();
    expect(socket.endPoint).toBe("ws://localhost:4000/socket");
    expect(socket.connectParams).toEqual([{ token: "stored-token" }]);
    expect(socket.channels.map((channel) => channel.topic)).toEqual([TOPIC]);
    expect(state.connection).toBe("connecting");
  });

  it("does not start twice", async () => {
    const { session, api } = setup();
    session.start();
    session.start();
    await flush();
    expect(api.listMessages).toHaveBeenCalledTimes(1);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("shows an error state on a network failure and recovers with retryLoad", async () => {
    const { session, api } = setup();
    api.listMessages.mockRejectedValueOnce(new TypeError("Network request failed"));

    session.start();
    await flush();

    expect(session.getState().status).toBe("error");
    expect(session.getState().error).toBeInstanceOf(TypeError);
    expect(FakeSocket.instances).toHaveLength(0);

    session.retryLoad();
    await flush();

    expect(session.getState().status).toBe("ready");
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it.each(["conversation_not_active", "not_participant"])(
    "becomes unavailable when REST answers 403 %s",
    async (code) => {
      const { session, api, events } = setup();
      api.listMessages.mockRejectedValueOnce(apiError(403, code));

      session.start();
      await flush();

      expect(session.getState().status).toBe("unavailable");
      expect(session.getState().unavailableReason).toBe(code);
      expect(events.onUnavailable).toHaveBeenCalledWith(code);
      expect(FakeSocket.instances).toHaveLength(0);
    }
  );

  it("works without realtime when there is no socket URL", async () => {
    const { session } = setup({ socketUrl: null }, page([msg("m1", OTHER, "hola", 1)]));
    session.start();
    await flush();

    expect(session.getState().status).toBe("ready");
    expect(session.getState().connection).toBe("offline");
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it("stays on REST when the socket token cannot be obtained", async () => {
    const { session, getSocketToken } = setup();
    getSocketToken.mockRejectedValueOnce(new Error("missing_session"));

    session.start();
    await flush();

    expect(session.getState().status).toBe("ready");
    expect(session.getState().connection).toBe("offline");
    expect(FakeSocket.instances).toHaveLength(0);
  });
});

describe("chat session · canal", () => {
  it("goes live on join and backfills to cover the gap between REST and the join", async () => {
    const { session, api } = setup({}, page([msg("m1", OTHER, "hola", 1)]));
    session.start();
    await flush();

    api.listMessages.mockResolvedValueOnce(page([msg("m1", OTHER, "hola", 1), msg("m2", OTHER, "¿qué tal?", 2)]));
    const socket = FakeSocket.last();
    socket.simulateOpen();
    socket.channelFor(TOPIC).simulateJoinOk();
    await flush();

    expect(session.getState().connection).toBe("live");
    expect(api.listMessages).toHaveBeenCalledTimes(2);
    expect(session.getState().messages.map((m) => m.id)).toEqual(["m2", "m1"]);
  });

  it.each(["not_participant", "conversation_not_active", "profile_required"])(
    "leaves the channel and becomes unavailable on join error %s",
    async (reason) => {
      const { session, events } = setup();
      session.start();
      await flush();

      const socket = FakeSocket.last();
      socket.simulateOpen();
      const channel = socket.channelFor(TOPIC);
      channel.simulateJoinError({ reason });

      expect(session.getState().status).toBe("unavailable");
      expect(session.getState().unavailableReason).toBe(reason);
      expect(session.getState().connection).toBe("offline");
      expect(channel.left).toBe(true);
      expect(socket.disconnectCalls).toBe(1);
      expect(events.onUnavailable).toHaveBeenCalledWith(reason);
    }
  );

  it("keeps waiting for Phoenix to rejoin on unknown join errors", async () => {
    const { session } = setup();
    session.start();
    await flush();
    const socket = FakeSocket.last();
    socket.simulateOpen();
    const channel = socket.channelFor(TOPIC);
    channel.simulateJoinError({ reason: "something_else" });

    expect(session.getState().status).toBe("ready");
    expect(channel.left).toBe(false);
  });

  it("adds incoming messages at the bottom, deduplicates by id and notifies", async () => {
    const { session, channel, events } = await startJoined({}, page([msg("m1", OTHER, "hola", 1)]));
    const incoming = msg("m2", OTHER, "¿vamos a por un café?", 30);

    channel.simulateEvent("new_message", incoming);
    channel.simulateEvent("new_message", incoming);

    const state = session.getState();
    expect(state.messages.map((m) => m.id)).toEqual(["m2", "m1"]);
    expect(state.liveKeys.has("m2")).toBe(true);
    expect(state.liveKeys.has("m1")).toBe(false);
    expect(events.onIncomingMessage).toHaveBeenCalledTimes(1);
    expect(events.onLatestMessage).toHaveBeenLastCalledWith(incoming, false);
  });

  it("ignores messages from other conversations", async () => {
    const { session, channel } = await startJoined();
    channel.simulateEvent("new_message", { ...msg("x", OTHER, "hola", 5), conversationId: "another" });
    expect(session.getState().messages).toHaveLength(0);
  });

  it("orders same-second live messages by arrival", async () => {
    const { session, channel } = await startJoined();
    channel.simulateEvent("new_message", msg("a", OTHER, "uno", 10));
    channel.simulateEvent("new_message", msg("b", OTHER, "dos", 10));
    expect(session.getState().messages.map((m) => m.id)).toEqual(["b", "a"]);
  });
});

describe("chat session · escribiendo…", () => {
  it("shows the other person typing for a few seconds", async () => {
    const { session, channel } = await startJoined();

    channel.simulateEvent("typing", { conversationId: CONV, profileId: OTHER });
    expect(session.getState().otherTyping).toBe(true);

    await vi.advanceTimersByTimeAsync(TYPING_TTL_MS - 100);
    channel.simulateEvent("typing", { conversationId: CONV, profileId: OTHER });
    await vi.advanceTimersByTimeAsync(TYPING_TTL_MS - 100);
    expect(session.getState().otherTyping).toBe(true);

    await vi.advanceTimersByTimeAsync(200);
    expect(session.getState().otherTyping).toBe(false);
  });

  it("hides the indicator as soon as their message arrives", async () => {
    const { session, channel } = await startJoined();
    channel.simulateEvent("typing", { conversationId: CONV, profileId: OTHER });
    channel.simulateEvent("new_message", msg("m1", OTHER, "¡ya está!", 5));
    expect(session.getState().otherTyping).toBe(false);
  });

  it("ignores typing events from anyone else", async () => {
    const { session, channel } = await startJoined();
    channel.simulateEvent("typing", { conversationId: CONV, profileId: "someone-else" });
    expect(session.getState().otherTyping).toBe(false);
  });

  it("throttles my typing notifications and only sends them when joined", async () => {
    const { session } = setup();
    session.notifyTyping(); // aún sin canal
    session.start();
    await flush();
    const socket = FakeSocket.last();
    const channel = socket.channelFor(TOPIC);
    session.notifyTyping(); // canal sin unir
    expect(channel.pushesFor("typing")).toHaveLength(0);

    socket.simulateOpen();
    channel.simulateJoinOk();
    await flush();

    session.notifyTyping();
    session.notifyTyping();
    expect(channel.pushesFor("typing")).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(TYPING_THROTTLE_MS);
    session.notifyTyping();
    expect(channel.pushesFor("typing")).toHaveLength(2);
  });
});

describe("chat session · leído", () => {
  it("marks the conversation as read on open when visible", async () => {
    const { session, api, events } = setup({}, page([msg("m1", OTHER, "hola", 1)]));
    session.setVisible(true);
    session.start();
    await flush();
    await flush();

    expect(api.markRead).toHaveBeenCalledTimes(1);
    expect(events.onRead).toHaveBeenCalledTimes(1);
  });

  it("waits until the screen is visible", async () => {
    const { session, api } = setup({}, page([msg("m1", OTHER, "hola", 1)]));
    session.start();
    await flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.markRead).not.toHaveBeenCalled();

    session.setVisible(true);
    await flush();
    expect(api.markRead).toHaveBeenCalledTimes(1);
  });

  it("marks again (debounced) when their messages arrive while visible", async () => {
    const { session, channel, api } = await startJoined();
    session.setVisible(true);
    await flush();
    api.markRead.mockClear();

    channel.simulateEvent("new_message", msg("m1", OTHER, "uno", 5));
    channel.simulateEvent("new_message", msg("m2", OTHER, "dos", 6));
    await vi.advanceTimersByTimeAsync(500);

    expect(api.markRead).toHaveBeenCalledTimes(1);
  });

  it("does not mark while hidden and catches up when shown again", async () => {
    const { session, channel, api } = await startJoined();
    session.setVisible(true);
    await flush();
    api.markRead.mockClear();

    session.setVisible(false);
    channel.simulateEvent("new_message", msg("m1", OTHER, "¿sigues ahí?", 5));
    await vi.advanceTimersByTimeAsync(2000);
    expect(api.markRead).not.toHaveBeenCalled();

    session.setVisible(true);
    await flush();
    expect(api.markRead).toHaveBeenCalledTimes(1);
  });

  it("does not mark my own messages as something to read", async () => {
    const { session, channel, api } = await startJoined();
    session.setVisible(true);
    await flush();
    api.markRead.mockClear();

    channel.simulateEvent("new_message", msg("m1", ME, "desde otro móvil", 5));
    await vi.advanceTimersByTimeAsync(1000);
    expect(api.markRead).not.toHaveBeenCalled();
  });

  it("retries marking as read on the next trigger after a failure", async () => {
    const { session, api, channel } = await startJoined();
    api.markRead.mockReset().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValue(undefined);
    session.setVisible(true);
    await flush();
    expect(api.markRead).toHaveBeenCalledTimes(1);

    channel.simulateEvent("new_message", msg("m1", OTHER, "hola", 5));
    await vi.advanceTimersByTimeAsync(500);
    expect(api.markRead).toHaveBeenCalledTimes(2);
  });
});

describe("chat session · envío", () => {
  it("rejects empty or too long texts and trims the body", async () => {
    const { session, channel } = await startJoined();

    expect(session.send("   \n ")).toBeNull();
    expect(session.send("a".repeat(2001))).toBeNull();

    const sent = session.send("  hola 👋  ");
    expect(sent?.body).toBe("hola 👋");
    expect(channel.lastPush("send_message")?.payload).toEqual({ body: "hola 👋" });
  });

  it("sends through the channel optimistically and confirms with the reply", async () => {
    const { session, channel, events, api } = await startJoined();

    const item = session.send("¡Hola, Lucía!")!;
    let state = session.getState();
    expect(state.outbox).toEqual([expect.objectContaining({ clientId: item.clientId, status: "sending" })]);
    expect(state.liveKeys.has(item.clientId)).toBe(true);
    expect(api.sendMessage).not.toHaveBeenCalled();

    const server = msg("s1", ME, "¡Hola, Lucía!", 61);
    channel.lastPush("send_message")!.reply("ok", { message: server });
    await flush();

    state = session.getState();
    expect(state.outbox).toEqual([]);
    expect(state.messages.map((m) => m.id)).toEqual(["s1"]);
    expect(state.keyAliases.get("s1")).toBe(item.clientId);
    expect(state.myProfileId).toBe(ME);
    expect(events.onRead).toHaveBeenCalled();
    expect(events.onLatestMessage).toHaveBeenLastCalledWith(server, true);
  });

  it("never duplicates when the broadcast echo arrives before the reply", async () => {
    const { session, channel } = await startJoined();
    const item = session.send("hola")!;
    const server = msg("s1", ME, "hola", 61);

    channel.simulateEvent("new_message", server);
    expect(session.getState().outbox).toEqual([]);
    expect(session.getState().messages).toHaveLength(1);
    expect(session.getState().keyAliases.get("s1")).toBe(item.clientId);

    channel.lastPush("send_message")!.reply("ok", { message: server });
    await flush();
    expect(session.getState().messages).toHaveLength(1);
    expect(session.getState().outbox).toEqual([]);
  });

  it("falls back to REST while the channel is not joined", async () => {
    const { session, api } = setup();
    session.start();
    await flush();
    api.sendMessage.mockResolvedValueOnce(msg("s1", ME, "hola", 61));

    const item = session.send("hola")!;
    await flush();

    expect(api.sendMessage).toHaveBeenCalledWith("hola");
    expect(session.getState().outbox).toEqual([]);
    expect(session.getState().keyAliases.get("s1")).toBe(item.clientId);
  });

  it("retries automatically after a timeout, checking the history first to avoid duplicates", async () => {
    const { session, channel, api } = await startJoined();
    session.send("¿cenamos el viernes?");
    channel.lastPush("send_message")!.reply("timeout");
    await flush();

    // Sigue «enviando» mientras reintenta.
    expect(session.getState().outbox[0]).toMatchObject({ status: "sending", ambiguous: true });

    // El primer intento sí llegó: el backfill lo encuentra y no se reenvía.
    api.listMessages.mockResolvedValueOnce(page([msg("s1", ME, "¿cenamos el viernes?", 61)]));
    await vi.advanceTimersByTimeAsync(AUTO_RETRY_DELAY_MS);

    expect(api.listMessages).toHaveBeenCalledTimes(1);
    expect(channel.pushesFor("send_message")).toHaveLength(1);
    expect(session.getState().outbox).toEqual([]);
    expect(session.getState().messages.map((m) => m.id)).toEqual(["s1"]);
  });

  it("resends after a timeout when the history shows it never arrived", async () => {
    const { session, channel, api } = await startJoined();
    session.send("hola");
    channel.lastPush("send_message")!.reply("timeout");
    await flush();

    api.listMessages.mockResolvedValueOnce(page([]));
    await vi.advanceTimersByTimeAsync(AUTO_RETRY_DELAY_MS);

    expect(channel.pushesFor("send_message")).toHaveLength(2);
    channel.lastPush("send_message")!.reply("ok", { message: msg("s1", ME, "hola", 62) });
    await flush();
    expect(session.getState().outbox).toEqual([]);
    expect(session.getState().messages).toHaveLength(1);
  });

  it("shows «no se ha podido enviar» after the automatic retry fails, and retries on demand", async () => {
    const { session, channel } = await startJoined();
    const item = session.send("hola")!;

    channel.lastPush("send_message")!.reply("error", { reason: "rate_limited" });
    await vi.advanceTimersByTimeAsync(AUTO_RETRY_DELAY_MS);
    channel.lastPush("send_message")!.reply("error", { reason: "rate_limited" });
    await flush();

    expect(session.getState().outbox[0]).toMatchObject({
      clientId: item.clientId,
      status: "failed",
      retryable: true
    });

    session.retry(item.clientId);
    expect(session.getState().outbox[0]!.status).toBe("sending");
    expect(channel.pushesFor("send_message")).toHaveLength(3);

    channel.lastPush("send_message")!.reply("ok", { message: msg("s1", ME, "hola", 70) });
    await flush();
    expect(session.getState().outbox).toEqual([]);
  });

  it("uses REST for the retry if the channel dropped meanwhile", async () => {
    const { session, channel, socket, api } = await startJoined();
    const item = session.send("hola")!;
    channel.lastPush("send_message")!.reply("error", {});
    await vi.advanceTimersByTimeAsync(AUTO_RETRY_DELAY_MS);
    channel.lastPush("send_message")!.reply("error", {});
    await flush();

    socket.simulateClose();
    api.sendMessage.mockResolvedValueOnce(msg("s1", ME, "hola", 70));
    session.retry(item.clientId);
    await flush();

    expect(api.sendMessage).toHaveBeenCalledWith("hola");
    expect(session.getState().outbox).toEqual([]);
  });

  it("marks the conversation unavailable when sending is rejected", async () => {
    const { session, channel, events } = await startJoined();
    const item = session.send("hola")!;

    channel.lastPush("send_message")!.reply("error", { reason: "conversation_not_active" });
    await flush();

    const state = session.getState();
    expect(state.status).toBe("unavailable");
    expect(state.outbox[0]).toMatchObject({ clientId: item.clientId, status: "failed", retryable: false });
    expect(events.onUnavailable).toHaveBeenCalledWith("conversation_not_active");
    expect(session.send("¿hola?")).toBeNull();
  });

  it("marks REST 403 as unavailable too", async () => {
    const { session, api } = setup();
    session.start();
    await flush();
    api.sendMessage.mockRejectedValueOnce(apiError(403, "conversation_not_active"));

    session.send("hola");
    await flush();

    expect(session.getState().status).toBe("unavailable");
  });

  it("does not retry invalid messages", async () => {
    const { session, channel } = await startJoined();
    session.send("hola");
    channel.lastPush("send_message")!.reply("error", { errors: { body: ["should be at most 2000 character(s)"] } });
    await vi.advanceTimersByTimeAsync(AUTO_RETRY_DELAY_MS * 2);

    expect(channel.pushesFor("send_message")).toHaveLength(1);
    expect(session.getState().outbox[0]).toMatchObject({ status: "failed", retryable: false });
  });

  it("lets me discard a failed message", async () => {
    const { session, channel } = await startJoined();
    const item = session.send("hola")!;
    session.discard(item.clientId); // enviando: no se puede descartar
    expect(session.getState().outbox).toHaveLength(1);

    channel.lastPush("send_message")!.reply("error", { errors: { body: ["invalid"] } });
    await flush();
    session.discard(item.clientId);
    expect(session.getState().outbox).toEqual([]);
  });

  it("keeps pending messages in send order below the history", async () => {
    const { session, channel } = await startJoined({}, page([msg("m1", OTHER, "hola", 1)]));
    const first = session.send("uno")!;
    const second = session.send("dos")!;
    expect(session.getState().outbox.map((item) => item.clientId)).toEqual([first.clientId, second.clientId]);

    // Llega la respuesta del segundo antes que la del primero.
    channel.pushesFor("send_message")[1]!.reply("ok", { message: msg("s2", ME, "dos", 62) });
    await flush();
    expect(session.getState().outbox.map((item) => item.clientId)).toEqual([first.clientId]);
  });
});

describe("chat session · reconexión", () => {
  it("refreshes the socket token after a connection error (throttled)", async () => {
    const { session, socket, getSocketToken } = await startJoined();
    getSocketToken.mockClear();

    socket.simulateError();
    await flush();
    socket.simulateError();
    await flush();

    expect(getSocketToken).toHaveBeenCalledTimes(1);
    expect(getSocketToken).toHaveBeenCalledWith({ fresh: true });
    expect(socket.params()).toEqual({ token: "fresh-token" });
    expect(session.getState().connection).toBe("connecting");

    await vi.advanceTimersByTimeAsync(5_000);
    socket.simulateError();
    await flush();
    expect(getSocketToken).toHaveBeenCalledTimes(2);
  });

  it("backfills after rejoining and merges by id without duplicates", async () => {
    const { session, socket, channel, api } = await startJoined({}, page([msg("m1", OTHER, "hola", 1)]));

    socket.simulateClose();
    expect(session.getState().connection).toBe("connecting");

    api.listMessages.mockResolvedValueOnce(
      page([msg("m1", OTHER, "hola", 1), msg("m2", OTHER, "¿estás?", 20), msg("m3", OTHER, "🙂", 21)])
    );
    socket.simulateOpen();
    expect(channel.joinAttempts).toBe(2);
    channel.simulateJoinOk();
    await flush();

    expect(session.getState().connection).toBe("live");
    expect(session.getState().messages.map((m) => m.id)).toEqual(["m3", "m2", "m1"]);
  });

  it("replaces the list when the backfill does not overlap (too much missed)", async () => {
    const { session, socket, channel, api } = await startJoined({}, page([msg("m1", OTHER, "hola", 1)], null));

    socket.simulateClose();
    api.listMessages.mockResolvedValueOnce(
      page([msg("m90", OTHER, "noventa", 900), msg("m91", OTHER, "noventa y uno", 901)], "cursor-m90")
    );
    socket.simulateOpen();
    channel.simulateJoinOk();
    await flush();

    const state = session.getState();
    expect(state.messages.map((m) => m.id)).toEqual(["m91", "m90"]);
    expect(state.hasOlder).toBe(true);

    api.listMessages.mockResolvedValueOnce(page([msg("m1", OTHER, "hola", 1)], null));
    await session.loadOlder();
    expect(api.listMessages).toHaveBeenLastCalledWith({ cursor: "cursor-m90", limit: CHAT_PAGE_SIZE });
    expect(session.getState().messages.map((m) => m.id)).toEqual(["m91", "m90", "m1"]);
  });

  it("gives up on realtime when the session cannot be refreshed", async () => {
    const { session, socket, getSocketToken } = await startJoined();
    getSocketToken.mockRejectedValueOnce(new Error("session_refresh_failed"));

    socket.simulateError();
    await flush();

    expect(session.getState().connection).toBe("offline");
    expect(socket.disconnectCalls).toBeGreaterThan(0);
  });

  it("releases the socket in background and reconnects on resume after a backfill", async () => {
    const { session, socket, channel, api } = await startJoined({}, page([msg("m1", OTHER, "hola", 1)]));

    session.pause();
    expect(session.getState().connection).toBe("offline");
    expect(socket.isConnected()).toBe(false);
    expect(socket.disconnectCalls).toBe(1);

    api.listMessages.mockResolvedValueOnce(page([msg("m1", OTHER, "hola", 1), msg("m2", OTHER, "buenos días", 500)]));
    session.resume();
    await flush();

    expect(session.getState().messages.map((m) => m.id)).toEqual(["m2", "m1"]);
    expect(socket.connectCalls).toBe(2);
    socket.simulateOpen();
    channel.simulateJoinOk();
    await flush();
    expect(session.getState().connection).toBe("live");
  });

  it("forces an immediate reconnect on resume if Phoenix is still waiting for its backoff", async () => {
    const { session, socket } = await startJoined();
    socket.simulateError();
    await flush();
    expect(socket.hasConnection).toBe(true); // conexión muerta retenida

    session.resume();
    await flush();

    expect(socket.disconnectCalls).toBe(1);
    expect(socket.connectCalls).toBe(2);
    expect(socket.connectParams[socket.connectParams.length - 1]).toEqual({ token: "fresh-token" });
  });
});

describe("chat session · historial antiguo", () => {
  it("paginates backwards with the cursor until the beginning", async () => {
    const { session, api } = await startJoined({}, page([msg("m3", OTHER, "tres", 3)], "c1"));

    api.listMessages.mockResolvedValueOnce(page([msg("m2", ME, "dos", 2)], "c2"));
    await session.loadOlder();
    expect(api.listMessages).toHaveBeenLastCalledWith({ cursor: "c1", limit: CHAT_PAGE_SIZE });

    api.listMessages.mockResolvedValueOnce(page([msg("m1", OTHER, "uno", 1)], null));
    await session.loadOlder();
    expect(api.listMessages).toHaveBeenLastCalledWith({ cursor: "c2", limit: CHAT_PAGE_SIZE });

    const state = session.getState();
    expect(state.messages.map((m) => m.id)).toEqual(["m3", "m2", "m1"]);
    expect(state.hasOlder).toBe(false);
    expect(state.liveKeys.size).toBe(0);

    await session.loadOlder();
    expect(api.listMessages).toHaveBeenCalledTimes(2);
  });

  it("does not trigger typing or read changes with old messages", async () => {
    const { session, api } = await startJoined({}, page([msg("m3", OTHER, "tres", 3)], "c1"));
    session.setVisible(true);
    await flush();
    api.markRead.mockClear();

    api.listMessages.mockResolvedValueOnce(page([msg("m2", OTHER, "dos", 2)], null));
    await session.loadOlder();
    await vi.advanceTimersByTimeAsync(1000);

    expect(api.markRead).not.toHaveBeenCalled();
  });

  it("ignores concurrent loadOlder calls", async () => {
    const { session, api } = await startJoined({}, page([msg("m3", OTHER, "tres", 3)], "c1"));
    const pending = deferred<ConversationMessagesPage>();
    api.listMessages.mockReturnValueOnce(pending.promise);

    const first = session.loadOlder();
    const second = session.loadOlder();
    expect(session.getState().loadingOlder).toBe(true);
    pending.resolve(page([msg("m2", OTHER, "dos", 2)], null));
    await Promise.all([first, second]);

    expect(api.listMessages).toHaveBeenCalledTimes(1);
    expect(session.getState().loadingOlder).toBe(false);
  });

  it("discards an older page that lands after a backfill replaced the list", async () => {
    const { session, socket, channel, api } = await startJoined({}, page([msg("m3", OTHER, "tres", 3)], "c-old"));
    const older = deferred<ConversationMessagesPage>();
    api.listMessages.mockReturnValueOnce(older.promise);
    const loading = session.loadOlder();

    // Reconexión con hueco: la lista se sustituye y se pagina desde «c-new».
    socket.simulateClose();
    api.listMessages.mockResolvedValueOnce(
      page([msg("m90", OTHER, "noventa", 900), msg("m91", OTHER, "noventa y uno", 901)], "c-new")
    );
    socket.simulateOpen();
    channel.simulateJoinOk();
    await flush();
    expect(session.getState().messages.map((m) => m.id)).toEqual(["m91", "m90"]);

    older.resolve(page([msg("m2", OTHER, "dos", 2)], null));
    await loading;

    const state = session.getState();
    expect(state.messages.map((m) => m.id)).toEqual(["m91", "m90"]);
    expect(state).toMatchObject({ loadingOlder: false, hasOlder: true });

    api.listMessages.mockResolvedValueOnce(page([msg("m80", OTHER, "ochenta", 800)], null));
    await session.loadOlder();
    expect(api.listMessages).toHaveBeenLastCalledWith({ cursor: "c-new", limit: CHAT_PAGE_SIZE });
  });

  it("flags an error to retry loading older messages", async () => {
    const { session, api } = await startJoined({}, page([msg("m3", OTHER, "tres", 3)], "c1"));
    api.listMessages.mockRejectedValueOnce(new TypeError("offline"));

    await session.loadOlder();
    expect(session.getState()).toMatchObject({ loadingOlder: false, olderError: true, hasOlder: true });

    api.listMessages.mockResolvedValueOnce(page([msg("m2", OTHER, "dos", 2)], null));
    await session.loadOlder();
    expect(session.getState()).toMatchObject({ olderError: false, hasOlder: false });
  });

  it("restarts from the newest page on invalid_cursor", async () => {
    const { session, api } = await startJoined({}, page([msg("m3", OTHER, "tres", 3)], "broken"));
    api.listMessages
      .mockRejectedValueOnce(apiError(422, "invalid_cursor"))
      .mockResolvedValueOnce(page([msg("m3", OTHER, "tres", 3)], "c-good"));

    await session.loadOlder();
    await flush();

    expect(api.listMessages).toHaveBeenLastCalledWith({ limit: CHAT_PAGE_SIZE });
    expect(session.getState()).toMatchObject({ hasOlder: true, olderError: false });

    api.listMessages.mockResolvedValueOnce(page([msg("m2", OTHER, "dos", 2)], null));
    await session.loadOlder();
    expect(api.listMessages).toHaveBeenLastCalledWith({ cursor: "c-good", limit: CHAT_PAGE_SIZE });
  });
});

describe("chat session · identidad y ciclo de vida", () => {
  it("learns who I am once the other profile is known", async () => {
    const { session } = setup({ otherProfileId: null }, page([msg("m1", OTHER, "hola", 1), msg("m2", ME, "hey", 2)]));
    session.start();
    await flush();
    expect(session.getState().myProfileId).toBeNull();

    session.setOtherProfileId(OTHER);
    expect(session.getState().myProfileId).toBe(ME);
  });

  it("recognises my own echo even before knowing who is who", async () => {
    const { session } = setup({ otherProfileId: null });
    session.start();
    await flush();
    const socket = FakeSocket.last();
    socket.simulateOpen();
    const channel = socket.channelFor(TOPIC);
    channel.simulateJoinOk();
    await flush();

    session.send("hola");
    channel.simulateEvent("new_message", msg("s1", ME, "hola", 61));
    expect(session.getState().outbox).toEqual([]);
    expect(session.getState().messages).toHaveLength(1);
  });

  it("notifies subscribers and stops after dispose", async () => {
    const { session, socket, channel, listener } = await startJoined();
    expect(listener).toHaveBeenCalled();
    listener.mockClear();

    session.dispose();
    expect(channel.left).toBe(true);
    expect(socket.disconnectCalls).toBe(1);

    channel.simulateEvent("new_message", msg("late", OTHER, "¿hola?", 5));
    session.send("hola");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(listener).not.toHaveBeenCalled();
    expect(session.getState().messages).toHaveLength(0);
  });

  it("ignores a slow initial load that resolves after dispose", async () => {
    const { session, api } = setup();
    const pending = deferred<ConversationMessagesPage>();
    api.listMessages.mockReturnValueOnce(pending.promise);

    session.start();
    session.dispose();
    pending.resolve(page([msg("m1", OTHER, "hola", 1)]));
    await flush();

    expect(session.getState().status).toBe("loading");
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it("returns a stable snapshot between changes", async () => {
    const { session } = await startJoined();
    expect(session.getState()).toBe(session.getState());
  });
});
