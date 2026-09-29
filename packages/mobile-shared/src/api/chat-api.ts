import type {
  ChatMessage,
  ConversationMessagesPage,
  ConversationMessagesQuery,
  ConversationSummary,
  ConversationsResponse,
  OkResponse,
  SendMessageResponse
} from "@snack/contracts";

import type { HttpClient } from "./auth-api";
import { buildCursorPath, pathSegment } from "./http-utils";

export interface ChatApi {
  /** Conversaciones activas con último mensaje y no leídos (misma regla que los matches). */
  listConversations(): Promise<ConversationSummary[]>;
  /** Historial: más nuevos primero; pasa `nextCursor` para cargar mensajes más antiguos. */
  listMessages(
    conversationId: string,
    query?: ConversationMessagesQuery
  ): Promise<ConversationMessagesPage>;
  sendMessage(conversationId: string, body: string): Promise<ChatMessage>;
  /** Marca la conversación como leída hasta ahora (resetea `unreadCount` y el match "nuevo"). */
  markRead(conversationId: string): Promise<void>;
}

function conversationPath(conversationId: string): string {
  return `/api/conversations/${pathSegment(conversationId)}`;
}

export function createChatApi(httpClient: HttpClient): ChatApi {
  return {
    async listConversations() {
      const response = await httpClient.get<ConversationsResponse>("/api/conversations");
      return response.conversations;
    },
    listMessages(conversationId, query) {
      return httpClient.get<ConversationMessagesPage>(
        buildCursorPath(`${conversationPath(conversationId)}/messages`, query)
      );
    },
    async sendMessage(conversationId, body) {
      const response = await httpClient.post<SendMessageResponse>(
        `${conversationPath(conversationId)}/messages`,
        { body }
      );
      return response.message;
    },
    async markRead(conversationId) {
      await httpClient.post<OkResponse>(`${conversationPath(conversationId)}/read`, {});
    }
  };
}
