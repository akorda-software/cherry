import { create } from "zustand";

import { useSessionStore } from "../../auth/presentation/session-store";

interface ChatDraftState {
  drafts: ReadonlyMap<string, string>;
  setDraft(conversationId: string, text: string): void;
  clear(): void;
}

export const useChatDraftStore = create<ChatDraftState>((set) => ({
  drafts: new Map(),
  setDraft(conversationId, text) {
    set((state) => {
      if (state.drafts.get(conversationId) === text || (!text && !state.drafts.has(conversationId))) {
        return state;
      }
      const drafts = new Map(state.drafts);
      if (text === "") drafts.delete(conversationId);
      else drafts.set(conversationId, text);
      return { drafts };
    });
  },
  clear() {
    set((state) => state.drafts.size === 0 ? state : { drafts: new Map() });
  }
}));

// Retain actual unsent work, never an entry for every empty/visited conversation.
// Do not persist private text, nor retain it across logout or direct account switches.
// Rotating credentials for the same signed-in account is not a new session.
useSessionStore.subscribe((state, previous) => {
  if (
    (previous.status === "signed-in" && state.status !== "signed-in") ||
    state.session?.user.id !== previous.session?.user.id
  ) {
    useChatDraftStore.getState().clear();
  }
});
