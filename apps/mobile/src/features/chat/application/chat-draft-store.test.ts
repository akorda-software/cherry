import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SessionBundle } from "@cherry/contracts";

import { useSessionStore } from "../../auth/presentation/session-store";
import { useChatDraftStore } from "./chat-draft-store";

const account: SessionBundle = {
  accessToken: "test-access", accessTokenExpiresAt: "2099-01-01T00:00:00Z",
  refreshToken: "test-refresh", refreshTokenExpiresAt: "2099-01-01T00:00:00Z",
  user: { id: "account-a", displayName: "A", email: "a@example.test" }
};

beforeEach(() => {
  useSessionStore.setState({ status: "signed-in", session: account });
  useChatDraftStore.getState().clear();
});
afterEach(() => {
  useSessionStore.setState({ status: "signed-out", session: null });
  useChatDraftStore.getState().clear();
});

describe("chat drafts", () => {
  it("keeps drafts by conversation and removes empty drafts", () => {
    const { setDraft } = useChatDraftStore.getState();
    setDraft("one", "Hola");
    setDraft("two", "Sin terminar");
    setDraft("one", "");
    expect([...useChatDraftStore.getState().drafts]).toEqual([["two", "Sin terminar"]]);
  });

  it("does not accumulate empty visited chats or silently evict real unsent work", () => {
    const { setDraft } = useChatDraftStore.getState();
    setDraft("unfinished", "Keep this work");
    for (let i = 0; i < 1_000; i += 1) {
      setDraft(`chat-${i}`, "");
      setDraft(`finished-${i}`, "Sent later");
      setDraft(`finished-${i}`, "");
    }
    expect([...useChatDraftStore.getState().drafts]).toEqual([["unfinished", "Keep this work"]]);
  });

  it("clears on logout, including login to the same account afterward", () => {
    useChatDraftStore.getState().setDraft("one", "Private text");
    useSessionStore.setState({ status: "signed-out", session: null });
    useSessionStore.setState({ status: "signed-in", session: account });
    expect(useChatDraftStore.getState().drafts.size).toBe(0);
  });

  it("clears on a direct account switch but not on token refresh", () => {
    useChatDraftStore.getState().setDraft("one", "Private text");
    useSessionStore.setState({ session: { ...account, accessToken: "refreshed" } });
    expect(useChatDraftStore.getState().drafts.get("one")).toBe("Private text");
    useSessionStore.setState({ session: { ...account, user: { ...account.user, id: "account-b" } } });
    expect(useChatDraftStore.getState().drafts.size).toBe(0);
  });

  it("does not publish identical or empty no-op edits", () => {
    useChatDraftStore.getState().setDraft("one", "Hola");
    const before = useChatDraftStore.getState();
    before.setDraft("one", "Hola");
    before.setDraft("absent", "");
    expect(useChatDraftStore.getState()).toBe(before);
  });
});
