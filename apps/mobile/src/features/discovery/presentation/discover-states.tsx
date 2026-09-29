import { StyleSheet, View } from "react-native";

import {
  Button,
  EmptyState,
  ErrorState,
  Mascot,
  Skeleton,
  SkeletonGroup,
  SkeletonText,
  Stack,
  Text,
  useTheme
} from "../../../shared/ui";

/** Card polaroid pastel con brillo mientras llegan perfiles. */
export function DeckSkeleton({ width, height, testID = "discover-loading" }: { width: number; height: number; testID?: string }) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const photoHeight = Math.round(Math.max(height - 170, height * 0.64));

  return (
    <View
      accessibilityLabel="Buscando gente para ti"
      accessibilityRole="progressbar"
      style={[
        styles.skeletonCard,
        {
          width,
          height,
          backgroundColor: c.white,
          borderColor: c.ink,
          borderWidth: theme.primitives.border.bold,
          borderRadius: theme.primitives.radius.md
        },
        theme.primitives.elevation.lg
      ]}
      testID={testID}
    >
      <SkeletonGroup>
        <Skeleton color="fresa" height={photoHeight} radius={theme.primitives.radius.sm} />
        <View style={styles.skeletonInfo}>
          <Skeleton color="limonada" height={34} radius={17} width="56%" />
          <View style={styles.skeletonRow}>
            <Skeleton color="menta" height={26} radius={13} width={96} />
            <Skeleton color="cielo" height={26} radius={13} width={120} />
          </View>
          <SkeletonText color="lavanda" lastLineWidth="40%" lineHeight={12} lines={1} />
        </View>
      </SkeletonGroup>
    </View>
  );
}

/** Post del feed pastel con brillo (carga y «cargando más»). */
export function FeedPostSkeleton({ width }: { width: number }) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const inner = width - 20;

  return (
    <View
      accessibilityLabel="Cargando más perfiles"
      accessibilityRole="progressbar"
      style={[
        styles.post,
        {
          width,
          backgroundColor: c.white,
          borderColor: c.ink,
          borderWidth: theme.primitives.border.bold,
          borderRadius: theme.primitives.radius.md
        },
        theme.primitives.elevation.md
      ]}
      testID="feed-post-skeleton"
    >
      <SkeletonGroup>
        <Skeleton color="melocoton" height={inner * 1.18} radius={theme.primitives.radius.sm} />
        <Stack gap="sm" style={styles.postInfo}>
          <Skeleton color="limonada" height={34} radius={17} width="50%" />
          <SkeletonText color="lavanda" lineHeight={12} lines={2} />
        </Stack>
      </SkeletonGroup>
    </View>
  );
}

export function DiscoverEmpty({
  onWidenFilters,
  onRetry,
  retrying,
  compact = false
}: {
  onWidenFilters(): void;
  onRetry(): void;
  retrying?: boolean;
  compact?: boolean;
}) {
  return (
    <EmptyState
      actionIcon="sliders"
      actionLabel="Ampliar filtros"
      compact={compact}
      description="Vuelve en un rato o amplía tu radio: siempre llega gente nueva."
      mood="sleepy"
      onAction={onWidenFilters}
      onSecondary={retrying ? undefined : onRetry}
      secondaryLabel={retrying ? "Buscando…" : "Volver a intentarlo"}
      testID="discover-empty"
      title="Te has visto a todo el mundo por aquí 🌸"
    />
  );
}

export function DiscoverError({ message, onRetry, retrying }: { message: string; onRetry(): void; retrying?: boolean }) {
  return (
    <ErrorState
      message={message}
      mood="sad"
      onRetry={onRetry}
      retrying={retrying}
      testID="discover-error"
      title="No hemos podido traer perfiles"
    />
  );
}

export function DiscoverPaused({ onResume, resuming, error }: { onResume(): void; resuming: boolean; error: string | null }) {
  return (
    <View style={styles.center} testID="discover-paused">
      <Mascot mood="sleepy" size={132} color="lavanda" />
      <Stack align="center" gap="sm">
        <Text accessibilityRole="header" align="center" variant="title2">
          Tu perfil está en pausa
        </Text>
        <Text align="center" color="muted" style={styles.copy} variant="body">
          Nadie te ve en Descubrir ni en Likes, y tú tampoco ves a nadie nuevo. Tus matches y chats siguen aquí. Tomarte un
          respiro está bien.
        </Text>
      </Stack>
      <Button icon="play" loading={resuming} onPress={onResume} size="lg" testID="discover-resume">
        Reanudar mi perfil
      </Button>
      {error ? (
        <Text align="center" color="danger" variant="callout">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonCard: {
    padding: 10,
    overflow: "hidden"
  },
  skeletonInfo: {
    paddingTop: 16,
    gap: 12
  },
  skeletonRow: {
    flexDirection: "row",
    gap: 8
  },
  post: {
    padding: 10,
    alignSelf: "center"
  },
  postInfo: {
    paddingTop: 14,
    paddingBottom: 6
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 28
  },
  copy: {
    maxWidth: 360
  }
});
