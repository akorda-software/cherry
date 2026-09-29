import { memo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import type { Tag } from "@snack/contracts";

import { type PastelName, PopIn, ProgressBar, TagSticker, Text, useTheme } from "../../../shared/ui";
import type { TagKind } from "../domain/tag-selection";

export interface TagShelfProps {
  kind: TagKind;
  tags: ReadonlyArray<Tag>;
  max: number;
  /** Texto de estado («Te faltan 2», «¡Genial!»…) o el aviso del momento. */
  status: string;
  /** El aviso es una advertencia (límite, conflicto): se pinta en su tono. */
  warning?: boolean;
  /** Estilo animado de la sacudida (useShake). */
  shakeStyle?: object;
  /** Fondo opaco del estante (el pastel suave de la página). */
  tone: PastelName;
  onRemove(tag: Tag): void;
  testID?: string;
}

/**
 * Estante de las etiquetas elegidas: se «pegan» aquí con un pop al tocarlas
 * en el catálogo y se despegan tocándolas otra vez. Contador visual con un
 * segmento por hueco; al llegar al límite, sacudida amable y mensaje.
 */
export const TagShelf = memo(function TagShelf({
  kind,
  tags,
  max,
  status,
  warning = false,
  shakeStyle,
  tone,
  onRemove,
  testID = "tag-shelf"
}: TagShelfProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const empty = Math.max(0, max - tags.length);
  const positive = kind === "positive";
  const progressColor: PastelName = positive ? (tags.length >= 5 ? "menta" : tags.length >= 3 ? "limonada" : "fresa") : "lavanda";

  return (
    <View
      style={[
        styles.shelf,
        {
          backgroundColor: theme.primitives.pastel[tone].soft,
          borderBottomColor: c.ink,
          borderBottomWidth: theme.primitives.border.thin,
          paddingHorizontal: theme.semantic.layout.screenPadding
        }
      ]}
      testID={testID}
    >
      <Animated.View style={[styles.header, shakeStyle]}>
        <Text style={styles.count} variant="numeral">{`${tags.length}/${max}`}</Text>
        <View style={styles.progress}>
          <ProgressBar
            accessibilityLabel={`${tags.length} de ${max} etiquetas`}
            color={progressColor}
            segments={max}
            size="sm"
            striped={false}
            value={tags.length}
          />
        </View>
      </Animated.View>
      <Text
        accessibilityLiveRegion="polite"
        color={warning ? theme.semantic.state.danger : "muted"}
        numberOfLines={1}
        testID={`${testID}-status`}
        variant="caption"
      >
        {status}
      </Text>
      <ScrollView
        contentContainerStyle={styles.row}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {tags.map((tag) => (
          <PopIn key={tag.id} rotate={positive ? -2 : 2}>
            <TagSticker
              accessibilityHint="Toca para despegarla"
              emoji={tag.emoji}
              label={tag.label}
              onPress={() => onRemove(tag)}
              size="sm"
              state={positive ? "selected" : "blocked"}
              testID={`${testID}-${tag.slug}`}
            />
          </PopIn>
        ))}
        {Array.from({ length: empty }, (_, index) => (
          <View
            key={`slot-${index}`}
            style={[
              styles.slot,
              {
                borderColor: c.inkFaint,
                borderWidth: theme.primitives.border.thin,
                minWidth: 44
              }
            ]}
          >
            {index === 0 && tags.length === 0 ? (
              <Text color="faint" numberOfLines={1} variant="caption">
                {positive ? "Pega aquí las tuyas" : "Nada por ahora"}
              </Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  shelf: {
    paddingTop: 10,
    paddingBottom: 12,
    gap: 6
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  count: {
    minWidth: 44
  },
  progress: {
    flex: 1
  },
  row: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    paddingRight: 8,
    minHeight: 40
  },
  slot: {
    height: 30,
    borderRadius: 15,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  }
});
