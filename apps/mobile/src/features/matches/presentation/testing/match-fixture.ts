import type { MatchSummary } from "@cherry/contracts";

export function makeMatch(id: string, overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    id,
    conversationId: `conv-${id}`,
    matchedAt: "2026-10-01T10:00:00Z",
    expiresAt: null,
    firstMessageAt: "2026-10-01T11:00:00Z",
    otherProfile: { id: `profile-${id}`, displayName: `Persona ${id}`, age: 31, photoUrl: null },
    lastMessage: {
      id: `message-${id}`,
      conversationId: `conv-${id}`,
      senderProfileId: `profile-${id}`,
      body: `Mensaje ${id}`,
      insertedAt: "2026-10-15T10:00:00Z"
    },
    unreadCount: 0,
    ...overrides
  };
}
