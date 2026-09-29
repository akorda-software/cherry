import { describe, expect, it, vi } from "vitest";

import type {
  ActivitySummary,
  ChatMessage,
  ConversationMessagesPage,
  MatchSummary,
  PublicProfile,
  ReceivedLikesPage
} from "@snack/contracts";

import { createActivityApi } from "./activity-api";
import type { HttpClient } from "./auth-api";
import { createChatApi } from "./chat-api";
import { buildQueryPath } from "./http-utils";
import { createLikesApi } from "./likes-api";
import { createMatchesApi } from "./matches-api";
import { createPublicProfileApi } from "./public-profile-api";
import { createSafetyApi } from "./safety-api";
import { createSettingsApi } from "./settings-api";

function createMockHttpClient() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  } as unknown as HttpClient;
}

const message: ChatMessage = {
  id: "message-1",
  conversationId: "conversation-1",
  senderProfileId: "profile-2",
  body: "¡Hola!",
  insertedAt: "2026-09-29T10:00:00Z"
};

describe("buildQueryPath", () => {
  it("skips empty values and encodes the rest", () => {
    expect(buildQueryPath("/api/x", { limit: 10, cursor: null, q: "a b" })).toBe(
      "/api/x?limit=10&q=a%20b"
    );
    expect(buildQueryPath("/api/x", { cursor: "" })).toBe("/api/x");
    expect(buildQueryPath("/api/x")).toBe("/api/x");
  });
});

describe("createLikesApi", () => {
  it("GETs the received likes root without query", async () => {
    const http = createMockHttpClient();
    const page: ReceivedLikesPage = { likes: [], nextCursor: null };
    vi.mocked(http.get).mockResolvedValueOnce(page);

    const result = await createLikesApi(http).listReceived();

    expect(http.get).toHaveBeenCalledWith("/api/likes/received");
    expect(result).toEqual(page);
  });

  it("passes limit and an opaque cursor", async () => {
    const http = createMockHttpClient();
    vi.mocked(http.get).mockResolvedValueOnce({ likes: [], nextCursor: null });

    await createLikesApi(http).listReceived({ limit: 30, cursor: "abc+/=" });

    expect(http.get).toHaveBeenCalledWith("/api/likes/received?limit=30&cursor=abc%2B%2F%3D");
  });
});

describe("createMatchesApi", () => {
  it("lists matches unwrapping the matches array", async () => {
    const http = createMockHttpClient();
    const match: MatchSummary = {
      id: "match-1",
      conversationId: "conversation-1",
      matchedAt: "2026-09-28T10:00:00Z",
      expiresAt: "2026-10-28T10:00:00Z",
      firstMessageAt: null,
      otherProfile: { id: "profile-2", displayName: "Lucía", age: 29, photoUrl: null },
      lastMessage: null,
      unreadCount: 0
    };
    vi.mocked(http.get).mockResolvedValueOnce({ matches: [match] });

    const result = await createMatchesApi(http).list();

    expect(http.get).toHaveBeenCalledWith("/api/matches");
    expect(result).toEqual([match]);
  });

  it("unmatches through the unmatch action", async () => {
    const http = createMockHttpClient();
    vi.mocked(http.post).mockResolvedValueOnce({ ok: true });

    await createMatchesApi(http).unmatch("match-1");

    expect(http.post).toHaveBeenCalledWith("/api/matches/match-1/unmatch", {});
  });
});

describe("createChatApi", () => {
  it("lists conversations unwrapping the array", async () => {
    const http = createMockHttpClient();
    vi.mocked(http.get).mockResolvedValueOnce({ conversations: [] });

    const result = await createChatApi(http).listConversations();

    expect(http.get).toHaveBeenCalledWith("/api/conversations");
    expect(result).toEqual([]);
  });

  it("lists messages with pagination", async () => {
    const http = createMockHttpClient();
    const page: ConversationMessagesPage = { messages: [message], nextCursor: "next" };
    vi.mocked(http.get).mockResolvedValueOnce(page);

    const api = createChatApi(http);
    const result = await api.listMessages("conversation-1", { limit: 50, cursor: "prev" });

    expect(http.get).toHaveBeenCalledWith(
      "/api/conversations/conversation-1/messages?limit=50&cursor=prev"
    );
    expect(result).toEqual(page);
  });

  it("requests the first page without query", async () => {
    const http = createMockHttpClient();
    vi.mocked(http.get).mockResolvedValueOnce({ messages: [], nextCursor: null });

    await createChatApi(http).listMessages("conversation-1");

    expect(http.get).toHaveBeenCalledWith("/api/conversations/conversation-1/messages");
  });

  it("sends a message and unwraps it", async () => {
    const http = createMockHttpClient();
    vi.mocked(http.post).mockResolvedValueOnce({ message });

    const result = await createChatApi(http).sendMessage("conversation-1", "¡Hola!");

    expect(http.post).toHaveBeenCalledWith("/api/conversations/conversation-1/messages", {
      body: "¡Hola!"
    });
    expect(result).toEqual(message);
  });

  it("marks a conversation as read", async () => {
    const http = createMockHttpClient();
    vi.mocked(http.post).mockResolvedValueOnce({ ok: true });

    await createChatApi(http).markRead("conversation-1");

    expect(http.post).toHaveBeenCalledWith("/api/conversations/conversation-1/read", {});
  });
});

describe("createSafetyApi", () => {
  it("blocks a profile", async () => {
    const http = createMockHttpClient();
    vi.mocked(http.post).mockResolvedValueOnce({ ok: true });

    await createSafetyApi(http).block("profile-2");

    expect(http.post).toHaveBeenCalledWith("/api/users/profile-2/block", {});
  });

  it("reports a profile with reason and optional details", async () => {
    const http = createMockHttpClient();
    const report = {
      id: "report-1",
      reason: "spam",
      details: null,
      status: "open",
      insertedAt: "2026-09-29T10:00:00Z"
    };
    vi.mocked(http.post).mockResolvedValue({ report });

    const api = createSafetyApi(http);
    const result = await api.report("profile-2", { reason: "spam" });
    await api.report("profile-2", { reason: "other", details: "Pide dinero" });

    expect(http.post).toHaveBeenNthCalledWith(1, "/api/users/profile-2/report", {
      reason: "spam"
    });
    expect(http.post).toHaveBeenNthCalledWith(2, "/api/users/profile-2/report", {
      reason: "other",
      details: "Pide dinero"
    });
    expect(result).toEqual(report);
  });
});

describe("createSettingsApi", () => {
  it("pauses and unpauses the profile", async () => {
    const http = createMockHttpClient();
    vi.mocked(http.post).mockResolvedValue({ ok: true });

    const api = createSettingsApi(http);
    await api.pause();
    await api.unpause();

    expect(http.post).toHaveBeenNthCalledWith(1, "/api/me/pause", {});
    expect(http.post).toHaveBeenNthCalledWith(2, "/api/me/unpause", {});
  });

  it("deletes the account with the DELETE verb", async () => {
    const http = createMockHttpClient();
    vi.mocked(http.delete!).mockResolvedValueOnce({ ok: true });

    await createSettingsApi(http).deleteAccount();

    expect(http.delete).toHaveBeenCalledWith("/api/me/account", {});
  });
});

describe("createPublicProfileApi", () => {
  it("GETs a public profile and unwraps it", async () => {
    const http = createMockHttpClient();
    const profile: PublicProfile = {
      id: "profile-2",
      displayName: "Lucía",
      age: 29,
      bio: null,
      gender: "woman",
      whatIAmLookingFor: "relationship",
      distanceLabel: "A unos 5 km",
      distanceKmApprox: 5,
      photos: [],
      tags: [],
      likedYou: true,
      youLiked: false,
      matchId: null,
      conversationId: null,
      isNewcomer: false
    };
    vi.mocked(http.get).mockResolvedValueOnce({ profile });

    const result = await createPublicProfileApi(http).getProfile("profile-2");

    expect(http.get).toHaveBeenCalledWith("/api/profiles/profile-2");
    expect(result).toEqual(profile);
  });

  it("encodes profile ids in the path", async () => {
    const http = createMockHttpClient();
    vi.mocked(http.get).mockResolvedValueOnce({ profile: {} });

    await createPublicProfileApi(http).getProfile("a/b");

    expect(http.get).toHaveBeenCalledWith("/api/profiles/a%2Fb");
  });
});

describe("createActivityApi", () => {
  it("GETs the activity summary", async () => {
    const http = createMockHttpClient();
    const summary: ActivitySummary = {
      receivedLikesCount: 2,
      newMatchesCount: 1,
      unreadConversationsCount: 0
    };
    vi.mocked(http.get).mockResolvedValueOnce(summary);

    const result = await createActivityApi(http).getSummary();

    expect(http.get).toHaveBeenCalledWith("/api/me/summary");
    expect(result).toEqual(summary);
  });
});
