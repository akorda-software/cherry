import type { MatchSummary } from "@cherry/contracts";

export type ChatsListItem =
  | { type: "new-matches"; key: "new-matches"; matches: MatchSummary[] }
  | { type: "heading"; key: "conversations-heading" }
  | { type: "conversation"; key: string; match: MatchSummary; first: boolean; last: boolean }
  | { type: "icebreak"; key: "icebreak" };

/** Solo referencias/posición: no vuelve a ordenar ni a transformar el contenido de dominio. */
export function buildChatsListItems(newMatches: MatchSummary[], conversations: MatchSummary[]): ChatsListItem[] {
  const items: ChatsListItem[] = [];
  if (newMatches.length > 0) items.push({ type: "new-matches", key: "new-matches", matches: newMatches });

  if (conversations.length > 0) {
    items.push({ type: "heading", key: "conversations-heading" });
    conversations.forEach((match, index) => {
      items.push({
        type: "conversation",
        key: `conversation-${match.id}`,
        match,
        first: index === 0,
        last: index === conversations.length - 1
      });
    });
  } else if (newMatches.length > 0) {
    items.push({ type: "icebreak", key: "icebreak" });
  }
  return items;
}

export const chatsItemKey = (item: ChatsListItem): string => item.key;
export const chatsItemType = (item: ChatsListItem): ChatsListItem["type"] => item.type;
export const matchItemKey = (match: MatchSummary): string => match.id;
