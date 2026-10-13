import { useLocalSearchParams } from "expo-router";

import { ChatScreen } from "../../../src/features/chat/presentation/chat-screen";

export default function ChatRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const conversationId = Array.isArray(id) ? (id[0] ?? "") : (id ?? "");

  return <ChatScreen conversationId={conversationId} key={conversationId} />;
}
