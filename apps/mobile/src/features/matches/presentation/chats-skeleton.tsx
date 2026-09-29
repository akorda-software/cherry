import { StyleSheet, View } from "react-native";

import { Divider, Skeleton, SkeletonGroup, Surface } from "../../../shared/ui";
import { NEW_MATCH_WIDTH } from "./new-match-avatar";

/** Esqueleto de la pestaña Chats: fila de matches nuevos + tarjeta de conversaciones. */
export function ChatsSkeleton() {
  return (
    <SkeletonGroup>
      <View
        accessibilityLabel="Cargando tus chats"
        accessibilityRole="progressbar"
        style={styles.root}
        testID="chats-loading"
      >
        <Skeleton height={22} radius={11} width={170} />
        <View style={styles.avatars}>
          {["fresa", "menta", "lavanda", "limonada"].map((color) => (
            <View key={color} style={styles.avatar}>
              <Skeleton circle={80} color={color as "fresa"} />
              <Skeleton height={12} radius={6} width={56} />
            </View>
          ))}
        </View>
        <Skeleton height={22} radius={11} width={120} />
        <Surface clip padding={0} radius="lg">
          {[0, 1, 2, 3].map((row) => (
            <View key={row}>
              {row > 0 ? <Divider style={styles.divider} /> : null}
              <View style={styles.row}>
                <Skeleton circle={56} color={row % 2 === 0 ? "cielo" : "melocoton"} />
                <View style={styles.lines}>
                  <Skeleton height={14} radius={7} width="46%" />
                  <Skeleton height={12} radius={6} width="78%" />
                </View>
              </View>
            </View>
          ))}
        </Surface>
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 16
  },
  avatars: {
    flexDirection: "row",
    gap: 10
  },
  avatar: {
    width: NEW_MATCH_WIDTH,
    alignItems: "center",
    gap: 8
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  lines: {
    flex: 1,
    gap: 8
  },
  divider: {
    marginHorizontal: 16
  }
});
