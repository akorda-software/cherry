import { StyleSheet, useWindowDimensions, View } from "react-native";

import { Avatar, IconButton, PressableScale, Skeleton, Text, TopBar } from "../../../shared/ui";

export interface ChatHeaderProps {
  name: string | null;
  /** Aún no sabemos con quién es (esqueleto); si no se sabrá nunca, solo queda «atrás». */
  loading: boolean;
  age: number | null;
  photoUrl: string | null;
  onBack(): void;
  onOpenProfile(): void;
  onOpenMenu(): void;
}

/** Cabecera del chat: atrás, avatar + nombre (abre su perfil) y menú ⋯. */
export function ChatHeader({ name, loading, age, photoUrl, onBack, onOpenProfile, onOpenMenu }: ChatHeaderProps) {
  const { width } = useWindowDimensions();
  const nameWidth = Math.max(120, Math.min(width, 640) - 190);

  return (
    <TopBar
      left={
        <View style={styles.left}>
          <IconButton accessibilityLabel="Volver" icon="arrow-left" onPress={onBack} size="sm" testID="top-bar-back" />
          {name ? (
            <PressableScale
              accessibilityHint="Abre su perfil completo"
              accessibilityLabel={`Ver el perfil de ${name}`}
              elevation="none"
              faceStyle={styles.person}
              onPress={onOpenProfile}
              pressedScale={0.97}
              testID="chat-header-profile"
            >
              <Avatar name={name} size="sm" uri={photoUrl} />
              <View style={{ maxWidth: nameWidth }}>
                <Text maxFontSizeMultiplier={1.2} numberOfLines={1} variant="title3">
                  {name}
                </Text>
                {age ? (
                  <Text color="muted" maxFontSizeMultiplier={1.2} numberOfLines={1} variant="caption">
                    {age} años
                  </Text>
                ) : null}
              </View>
            </PressableScale>
          ) : loading ? (
            <View style={styles.person}>
              <Skeleton circle={40} />
              <Skeleton height={16} radius={8} width={110} />
            </View>
          ) : null}
        </View>
      }
      right={
        name ? (
          <IconButton accessibilityLabel="Más opciones" icon="more" onPress={onOpenMenu} size="sm" testID="chat-menu" />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 6
  }
});
