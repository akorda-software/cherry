import { TAG_CATEGORIES, type Tag } from "@cherry/contracts";

export const TAG_CATEGORY_LABELS: Record<string, string> = {
  interests: "Intereses",
  active: "Vida activa",
  lifestyle: "Estilo de vida",
  values: "Valores",
  personality: "Personalidad",
  pets: "Mascotas",
  relationship: "Relación y familia"
};

/** Orden de las secciones (el del catálogo); las categorías desconocidas van al final. */
export const TAG_CATEGORY_ORDER: ReadonlyArray<string> = TAG_CATEGORIES;

export function tagCategoryLabel(category: string): string {
  return TAG_CATEGORY_LABELS[category] ?? category;
}

export interface TagSection {
  category: string;
  label: string;
  tags: Tag[];
}

function byCatalogOrder(a: Tag, b: Tag): number {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.label.localeCompare(b.label, "es");
}

export function groupTagsByCategory(catalog: ReadonlyArray<Tag>): TagSection[] {
  const byCategory = new Map<string, Tag[]>();

  for (const tag of catalog) {
    const list = byCategory.get(tag.category) ?? [];
    list.push(tag);
    byCategory.set(tag.category, list);
  }

  const known = TAG_CATEGORY_ORDER.filter((category) => byCategory.has(category));
  const unknown = [...byCategory.keys()].filter((category) => !TAG_CATEGORY_ORDER.includes(category)).sort();

  return [...known, ...unknown].map((category) => ({
    category,
    label: tagCategoryLabel(category),
    tags: (byCategory.get(category) ?? []).slice().sort(byCatalogOrder)
  }));
}

/** Minúsculas y sin tildes: «Música» y «musica» encuentran lo mismo. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Filtra el catálogo por texto: busca en la etiqueta, el slug y el nombre de la
 * categoría. Consulta vacía = catálogo entero.
 */
export function searchTags(catalog: ReadonlyArray<Tag>, query: string): Tag[] {
  const needle = normalizeSearchText(query);

  if (needle === "") {
    return [...catalog];
  }

  return catalog.filter((tag) => {
    const haystack = normalizeSearchText(`${tag.label} ${tag.slug} ${tagCategoryLabel(tag.category)}`);
    return needle.split(" ").every((word) => haystack.includes(word));
  });
}

/** Etiquetas del catálogo en el orden de los ids dados (ignora ids desconocidos). */
export function tagsByIds(catalog: ReadonlyArray<Tag>, ids: ReadonlyArray<string>): Tag[] {
  const byId = new Map(catalog.map((tag) => [tag.id, tag]));
  return ids.flatMap((id) => {
    const tag = byId.get(id);
    return tag ? [tag] : [];
  });
}
