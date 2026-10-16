import { forwardRef, memo } from "react";
import type { TextInput } from "react-native";

import { useChatDraftStore } from "../application/chat-draft-store";
import { Composer } from "./composer";

interface DraftComposerProps {
  conversationId: string;
  accessibilityLabel: string;
  onSend(body: string): boolean;
  onTyping(): void;
}

/** Subscribe at the editor boundary: typing must not rerender the history or realtime session. */
export const DraftComposer = memo(forwardRef<TextInput, DraftComposerProps>(function DraftComposer(
  { conversationId, accessibilityLabel, onSend, onTyping },
  ref
) {
  const text = useChatDraftStore((state) => state.drafts.get(conversationId) ?? "");
  const setDraft = useChatDraftStore.getState().setDraft;

  return (
    <Composer
      accessibilityLabel={accessibilityLabel}
      onChangeText={(next) => {
        setDraft(conversationId, next);
        if (next.trim() !== "") onTyping();
      }}
      onSend={() => {
        if (onSend(text)) setDraft(conversationId, "");
      }}
      placeholder="Escribe algo bonito…"
      ref={ref}
      value={text}
    />
  );
}));
