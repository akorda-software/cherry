export const TAG_CATEGORIES = [
  "interests",
  "active",
  "lifestyle",
  "values",
  "personality",
  "pets",
  "relationship"
] as const;

export type TagCategory = (typeof TAG_CATEGORIES)[number];

/** Etiqueta del catálogo cerrado. `emoji` puede ser `null` si el catálogo aún no lo define. */
export interface Tag {
  id: string;
  slug: string;
  label: string;
  // `| string` deja pasar categorías futuras sin romper el tipado del cliente.
  category: TagCategory | string;
  sortOrder?: number;
  emoji: string | null;
}

/**
 * Etiqueta positiva de OTRO perfil (cards, perfil público, likes).
 * `shared` = el viewer también la tiene entre sus etiquetas positivas.
 * El backend las ordena: compartidas primero, luego categoría/sortOrder.
 */
export interface ProfileTag extends Tag {
  shared: boolean;
}

export interface TagCatalogResponse {
  tags: Tag[];
}

export interface ProfileTagsResponse {
  tags: Tag[];
}

export interface BlockedTagsResponse {
  blockedTags: Tag[];
}

export const MAX_POSITIVE_TAGS = 8;
export const MAX_BLOCKED_TAGS = 5;

export function isTagCategory(value: unknown): value is TagCategory {
  return typeof value === "string" && (TAG_CATEGORIES as readonly string[]).includes(value);
}
