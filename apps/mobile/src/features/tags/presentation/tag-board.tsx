import { memo, type ReactNode, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { Tag } from "@snack/contracts";

import { EmptyState, Icon, Inline, Stack, TagSticker, type TagStickerState, Text, TextField, useTheme, WashiTape } from "../../../shared/ui";
import { groupTagsByCategory, searchTags } from "../domain/tag-catalog";
import type { TagKind, TagSelectionState } from "../domain/tag-selection";
import { categoryPastel } from "./category-color";

export interface TagBoardProps {
  kind: TagKind;
  catalog: ReadonlyArray<Tag>;
  stateOf(tagId: string): TagSelectionState;
  onToggle(tag: Tag): void;
  /** Buscador (opcional, por defecto sí). */
  searchable?: boolean;
  testID?: string;
}

/**
 * Catálogo de pegatinas por categorías (cada una con su color) y buscador
 * opcional. En modo `blocked`, las etiquetas tuyas salen recortadas a trazos
 * (no se pueden bloquear) y las bloqueadas, con rayas y ✕.
 */
export function TagBoard({ kind, catalog, stateOf, onToggle, searchable = true, testID = "tag-board" }: TagBoardProps) {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const sections = useMemo(() => groupTagsByCategory(catalog), [catalog]);
  const results = useMemo(() => (query.trim() ? searchTags(catalog, query) : null), [catalog, query]);

  const stickerState = (tag: Tag): TagStickerState => {
    const state = stateOf(tag.id);

    if (kind === "positive") {
      return state === "liked" ? "selected" : state === "blocked" ? "blocked" : "neutral";
    }

    return state === "blocked" ? "blocked" : state === "liked" ? "muted" : "neutral";
  };

  const hintFor = (state: TagStickerState) => {
    if (kind === "blocked" && state === "muted") return "Es una de las tuyas: no se puede bloquear";
    if (kind === "positive" && state === "blocked") return "La tienes bloqueada: tócala para que pase a ser tuya";
    return undefined;
  };

  const renderSticker = (tag: Tag) => {
    const state = stickerState(tag);

    return (
      <TagSticker
        accessibilityHint={hintFor(state)}
        emoji={tag.emoji}
        key={tag.id}
        label={tag.label}
        onPress={() => onToggle(tag)}
        state={state}
        testID={`${testID}-${tag.slug}`}
        tint={categoryPastel(theme, tag.category)}
      />
    );
  };

  return (
    <Stack gap="lg" testID={testID}>
      {searchable ? (
        <TextField
          accessibilityLabel="Buscar etiqueta"
          autoCapitalize="none"
          autoCorrect={false}
          icon="search"
          onChangeText={setQuery}
          placeholder="Busca una etiqueta"
          returnKeyType="search"
          right={
            query ? (
              <Pressable
                accessibilityLabel="Borrar búsqueda"
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => setQuery("")}
                style={styles.clear}
              >
                <Icon color={theme.semantic.icon.muted} name="close" size={20} />
              </Pressable>
            ) : undefined
          }
          testID={`${testID}-search`}
          value={query}
        />
      ) : null}

      {results ? (
        results.length > 0 ? (
          <Inline gap="sm">{results.map(renderSticker)}</Inline>
        ) : (
          <EmptyState
            compact
            description="Prueba con otra palabra. El catálogo es cerrado para que las etiquetas signifiquen lo mismo para todo el mundo."
            mood="thinking"
            testID={`${testID}-no-results`}
            title="No encontramos esa etiqueta"
          />
        )
      ) : (
        sections.map((section) => (
          <CategorySection category={section.category} key={section.category} label={section.label}>
            <Inline gap="sm">{section.tags.map(renderSticker)}</Inline>
          </CategorySection>
        ))
      )}
    </Stack>
  );
}

const CategorySection = memo(function CategorySection({
  category,
  label,
  children
}: {
  category: string;
  label: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const color = categoryPastel(theme, category) ?? "lavanda";

  return (
    <Stack gap="sm">
      <View style={styles.sectionHeader}>
        <WashiTape color={color} height={18} pattern="stripes" rotation={-4} width={34} />
        <Text accessibilityRole="header" variant="title3">
          {label}
        </Text>
      </View>
      {children}
    </Stack>
  );
});

const styles = StyleSheet.create({
  clear: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  }
});
