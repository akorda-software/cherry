import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { Tag } from "@cherry/contracts";

import { useTheme } from "../../../shared/ui";
import type { TagSelectionState } from "../application/use-tag-selection";
import { TagPill } from "./tag-pill";

export const TAG_CATEGORY_LABELS: Record<string, string> = {
  interests: "Intereses y hobbies",
  active: "Vida activa",
  lifestyle: "Estilo de vida y hábitos",
  values: "Valores",
  personality: "Personalidad",
  pets: "Mascotas",
  relationship: "Relación y familia"
};

export const TAG_CATEGORY_ORDER = [
  "interests",
  "active",
  "lifestyle",
  "values",
  "personality",
  "pets",
  "relationship"
];

interface TagPickerProps {
  catalog: Tag[];
  stateOf(tagId: string): TagSelectionState;
  positiveFull: boolean;
  blockedFull: boolean;
  onToggleLike(tagId: string): void;
  onToggleBlock(tagId: string): void;
}

export function TagPicker({
  catalog,
  stateOf,
  positiveFull,
  blockedFull,
  onToggleLike,
  onToggleBlock
}: TagPickerProps) {
  const theme = useTheme();

  const grouped = useMemo(() => {
    const byCategory = new Map<string, Tag[]>();

    for (const tag of catalog) {
      const list = byCategory.get(tag.category) ?? [];
      list.push(tag);
      byCategory.set(tag.category, list);
    }

    return TAG_CATEGORY_ORDER.map((category) => ({
      category,
      tags: (byCategory.get(category) ?? []).slice().sort(bySortOrder)
    })).filter((group) => group.tags.length > 0);
  }, [catalog]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: {
          gap: theme.primitives.spacing.lg
        },
        section: {
          gap: theme.primitives.spacing.sm
        },
        sectionTitle: {
          color: theme.semantic.text.default,
          fontSize: theme.primitives.typography.caption.fontSize,
          fontWeight: "800" as any,
          textTransform: "uppercase" as any,
          letterSpacing: 0.6
        },
        wrap: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: theme.primitives.spacing.sm
        }
      }),
    [theme]
  );

  return (
    <View style={styles.list}>
      {grouped.map(({ category, tags }) => (
        <View key={category} style={styles.section}>
          <Text style={styles.sectionTitle}>{TAG_CATEGORY_LABELS[category] ?? category}</Text>
          <View style={styles.wrap}>
            {tags.map((tag) => {
              const state = stateOf(tag.id);

              return (
                <TagPill
                  key={tag.id}
                  tag={tag}
                  state={state}
                  likeDisabled={positiveFull && state !== "liked"}
                  blockDisabled={blockedFull && state !== "blocked"}
                  onToggleLike={() => onToggleLike(tag.id)}
                  onToggleBlock={() => onToggleBlock(tag.id)}
                />
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function bySortOrder(a: Tag, b: Tag): number {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
}
