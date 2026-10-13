import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import type { Tag } from "@cherry/contracts";

import { Icon, Skeleton, SkeletonGroup, Stack, Text, useTheme } from "../../../shared/ui";
import { groupTagsByCategory } from "../domain/tag-catalog";
import type { TagKind, TagSelection, TagSelectionState } from "../domain/tag-selection";
import { categoryPastel } from "./category-color";
import { CHIP_COLUMN_GAP, CHIP_HEIGHT, CHIP_ROW_GAP, TagChip } from "./tag-chip";

export interface TagBoardProps {
  catalog: ReadonlyArray<Tag>;
  selection: TagSelection;
  /** «+» (`positive`) o «−» (`blocked`) sobre una etiqueta. Mejor si es estable. */
  onPress(tag: Tag, kind: TagKind): void;
  testID?: string;
}

/** Estado de cada etiqueta codificado en un carácter: una sección compara un string y no se repinta si no cambia. */
const STATE_CODE: Record<TagSelectionState, string> = { neutral: "n", liked: "l", blocked: "b" };
const CODE_STATE: Record<string, TagSelectionState> = { n: "neutral", l: "liked", b: "blocked" };

function stateMarks(tags: ReadonlyArray<Tag>, states: ReadonlyMap<string, TagSelectionState>): string {
  let marks = "";
  for (const tag of tags) marks += STATE_CODE[states.get(tag.id) ?? "neutral"];
  return marks;
}

/**
 * Página única de etiquetas: el catálogo por categorías, como una hoja de pegatinas
 * de tres columnas. En cada pegatina, «+» la marca como tuya y «−» la bloquea. Sin
 * buscador: el catálogo es corto. Cada sección y cada pegatina están memorizadas:
 * un toque solo repinta la que cambia (y su sección, que compara un string).
 */
export function TagBoard({ catalog, selection, onPress, testID = "tag-board" }: TagBoardProps) {
  const sections = useMemo(() => groupTagsByCategory(catalog), [catalog]);
  const states = useMemo(() => {
    const map = new Map<string, TagSelectionState>();
    for (const id of selection.positive) map.set(id, "liked");
    for (const id of selection.blocked) map.set(id, "blocked");
    return map;
  }, [selection.blocked, selection.positive]);

  return (
    <Stack gap={28} testID={testID}>
      {sections.map((section) => (
        <CategorySection
          category={section.category}
          key={section.category}
          label={section.label}
          marks={stateMarks(section.tags, states)}
          onPress={onPress}
          tags={section.tags}
          testID={testID}
        />
      ))}
    </Stack>
  );
}

interface TagChipsProps {
  tags: ReadonlyArray<Tag>;
  /** Un carácter por etiqueta (`n`/`l`/`b`), en el mismo orden que `tags`. */
  marks: string;
  onPress(tag: Tag, kind: TagKind): void;
  testID: string;
}

const TagChips = memo(function TagChips({ tags, marks, onPress, testID }: TagChipsProps) {
  return (
    <View style={styles.chips}>
      {tags.map((tag, index) => (
        <View key={tag.id} style={styles.cell}>
          <TagChip onPress={onPress} state={CODE_STATE[marks[index]] ?? "neutral"} tag={tag} testID={`${testID}-${tag.slug}`} />
        </View>
      ))}
    </View>
  );
});

const CategorySection = memo(function CategorySection({
  category,
  label,
  ...chips
}: TagChipsProps & { category: string; label: string }) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const color = theme.primitives.pastel[categoryPastel(theme, category) ?? "lavanda"].fill;
  const liked = chips.marks.split("l").length - 1;
  const blocked = chips.marks.split("b").length - 1;

  return (
    <Stack gap={14}>
      <View style={styles.sectionHeader}>
        <View
          style={[
            styles.marker,
            { backgroundColor: color, borderColor: c.ink, borderWidth: theme.primitives.border.thin }
          ]}
        />
        <Text accessibilityRole="header" style={styles.sectionTitle} variant="title3">
          {label}
        </Text>
        {liked > 0 ? <SectionCount color={theme.semantic.tag.likedBackground} icon="heart" value={liked} /> : null}
        {blocked > 0 ? <SectionCount color={theme.semantic.tag.blockedBackground} icon="x" value={blocked} /> : null}
      </View>
      <TagChips {...chips} />
    </Stack>
  );
});

/** Contador pequeño de la cabecera: cuántas de la categoría llevas marcadas. */
function SectionCount({ icon, value, color }: { icon: "heart" | "x"; value: number; color: string }) {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel={icon === "heart" ? `${value} te gustan` : `${value} bloqueadas`}
      accessible
      style={[styles.count, { backgroundColor: color, borderColor: theme.primitives.color.ink, borderWidth: theme.primitives.border.thin }]}
    >
      <Icon name={icon} size={12} strokeWidth={3} />
      <Text maxFontSizeMultiplier={1.2} variant="caption">
        {value}
      </Text>
    </View>
  );
}

const SKELETON_CELLS = 9;

/** Esqueleto del catálogo mientras carga (misma forma que los chips). */
export function TagCatalogSkeleton() {
  return (
    <SkeletonGroup>
      <Stack gap={20}>
        {[0, 1].map((section) => (
          <Stack gap={12} key={section}>
            <Skeleton height={22} radius={8} width={140} />
            <View style={styles.chips}>
              {Array.from({ length: SKELETON_CELLS }, (_, index) => (
                <View key={index} style={styles.cell}>
                  <Skeleton height={CHIP_HEIGHT} radius={14} width="100%" />
                </View>
              ))}
            </View>
          </Stack>
        ))}
      </Stack>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  sectionTitle: {
    flexShrink: 1
  },
  marker: {
    width: 14,
    height: 14,
    borderRadius: 4
  },
  count: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 999
  },
  /** Hoja de tres columnas iguales: cada celda es un tercio de fila menos medio hueco a cada lado. */
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -CHIP_COLUMN_GAP / 2,
    rowGap: CHIP_ROW_GAP
  },
  cell: {
    width: "33.3333%",
    paddingHorizontal: CHIP_COLUMN_GAP / 2,
    // Las pegatinas de una fila miden lo mismo aunque un nombre ocupe dos líneas.
    alignSelf: "stretch"
  }
});
