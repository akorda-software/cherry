import { ScrollView, StyleSheet, View } from "react-native";

import {
  Icon,
  Mascot,
  Pill,
  PopIn,
  PressableScale,
  Skeleton,
  TagSticker,
  Text,
  useTheme,
  type PastelName
} from "../../../shared/ui";
import type { ExpiryHint } from "../../matches/domain/match-list";
import { icebreakerContext, type Icebreaker } from "../domain/icebreakers";

export interface IcebreakersPanelProps {
  name: string;
  icebreakers: Icebreaker[];
  /** Aún pidiendo las etiquetas de su perfil. */
  loading: boolean;
  expiryHint: ExpiryHint | null;
  onPick(message: string): void;
}

const NOTE_COLORS: readonly PastelName[] = ["limonada", "menta", "cielo"];

/**
 * Conversación vacía: 2–3 ideas para romper el hielo a partir de las etiquetas en común.
 * Tocar una la copia en el campo de mensaje para ajustarla antes de enviar.
 */
export function IcebreakersPanel({ name, icebreakers, loading, expiryHint, onPick }: IcebreakersPanelProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const fromTags = icebreakers.some((icebreaker) => icebreaker.tag !== null);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      testID="chat-icebreakers"
    >
      <View style={styles.intro}>
        <Mascot color="fresa" mood="love" size={88} />
        <Text align="center" role="heading" variant="title2">
          Rompe el hielo con {name}
        </Text>
        <Text align="center" color="muted" style={styles.lede}>
          {fromTags
            ? "Tenéis cosas en común. Toca una idea y ajústala a tu manera."
            : "Un «hola» con una pregunta funciona de maravilla. Toca una idea y ajústala a tu manera."}
        </Text>
        {expiryHint ? (
          <Pill color="limonada" icon="clock" label={expiryHint.accessibilityLabel} size="sm" style={styles.centered} />
        ) : null}
      </View>

      <View style={styles.ideas}>
        {loading
          ? [0, 1].map((index) => <Skeleton color="limonada" height={92} key={index} radius={16} />)
          : icebreakers.map((icebreaker, index) => (
              <PopIn delay={120 + index * 90} fromScale={0.85} key={icebreaker.id} rotate={index % 2 === 0 ? -1 : 1}>
                <PressableScale
                  accessibilityHint="Lo copia en el campo de mensaje para que lo ajustes"
                  accessibilityLabel={`${icebreakerContext(icebreaker)}. ${icebreaker.message}`}
                  elevation="sm"
                  faceStyle={[
                    styles.idea,
                    {
                      backgroundColor: theme.primitives.pastel[NOTE_COLORS[index % NOTE_COLORS.length]!].soft,
                      borderColor: c.ink,
                      borderWidth: theme.primitives.border.regular,
                      borderRadius: theme.primitives.radius.md
                    }
                  ]}
                  onPress={() => onPick(icebreaker.message)}
                  testID={`icebreaker-${icebreaker.id}`}
                >
                  <View style={styles.ideaHeader}>
                    {icebreaker.tag ? (
                      <TagSticker
                        emoji={icebreaker.tag.emoji ?? undefined}
                        label={icebreaker.tag.label}
                        size="sm"
                        state="shared"
                      />
                    ) : (
                      <Pill color="lavanda" icon="sparkle" label="Idea" size="sm" />
                    )}
                    <Icon color={c.inkSoft} name="pencil" size={18} style={styles.pencil} />
                  </View>
                  <Text variant="bodyStrong">{icebreaker.message}</Text>
                </PressableScale>
              </PopIn>
            ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
    gap: 24,
    paddingHorizontal: 24,
    paddingVertical: 24
  },
  intro: {
    alignItems: "center",
    gap: 10
  },
  lede: {
    maxWidth: 320
  },
  centered: {
    alignSelf: "center"
  },
  ideas: {
    gap: 14
  },
  idea: {
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  ideaHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  pencil: {
    marginLeft: "auto"
  }
});
