import type { DiscoveryActionType, DiscoveryProfileCard } from "@snack/contracts";

/** Post del feed que se está despidiendo (sello + colapso) y aún se pinta en su sitio. */
export interface LeavingPost {
  card: DiscoveryProfileCard;
  index: number;
  action: DiscoveryActionType | null;
}

export interface FeedRow {
  card: DiscoveryProfileCard;
  leaving: LeavingPost | null;
}

/**
 * Filas del feed: la cola real más los posts que se despiden, reinsertados donde estaban
 * hasta que termina su animación. Si un post vuelve a la cola (fallo de red), deja de
 * despedirse.
 */
export function mergeLeavingPosts(profiles: readonly DiscoveryProfileCard[], leaving: readonly LeavingPost[]): FeedRow[] {
  const rows: FeedRow[] = profiles.map((card) => ({ card, leaving: null }));
  const present = new Set(profiles.map((card) => card.id));

  [...leaving]
    .filter((post) => !present.has(post.card.id))
    .sort((a, b) => a.index - b.index)
    .forEach((post) => {
      const at = Math.min(Math.max(post.index, 0), rows.length);
      rows.splice(at, 0, { card: post.card, leaving: post });
      present.add(post.card.id);
    });

  return rows;
}
