import { memo, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Image } from "expo-image";

import {
  Button,
  FormMessage,
  Icon,
  IconButton,
  LoadingDots,
  PolaroidFrame,
  PressableScale,
  ProgressBar,
  Stack,
  Text,
  useTheme
} from "../../../shared/ui";
import type { PhotoManager } from "../application/use-photo-manager";
import { PHOTO_ASPECT_RATIO } from "../domain/compression-plan";
import type { PendingPhoto, PhotoManagerMode, PhotoSlot, PhotoUploadStage } from "../domain/photo-slots";
import { cameraAvailable } from "../infrastructure/image-picker";

const GAP = 16;
const POLAROID_SIDE = 10;
const POLAROID_BOTTOM = 30;
const POLAROID_CAPTION_BOTTOM = 46;
const TILTS = [-2, 1.6, 1.2, -1.4];

const STAGE_LABEL: Record<PhotoUploadStage, string> = {
  preparing: "Preparando…",
  uploading: "Subiendo…",
  confirming: "Casi está…"
};

export interface PhotoGridProps {
  manager: PhotoManager;
  mode: PhotoManagerMode;
  /** Abre los Ajustes del sistema (permiso de cámara bloqueado). */
  onOpenSettings?: () => void;
  testID?: string;
}

/**
 * Rejilla de 4 polaroids pegadas en la libreta: huecos para añadir, progreso
 * por foto, reintento, quitar y elegir la principal (la primera).
 */
export function PhotoGrid({ manager, mode, onOpenSettings, testID = "photo-grid" }: PhotoGridProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const cell = width > 0 ? Math.floor((width - GAP) / 2) : 0;

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
  };

  let firstEmpty = true;

  return (
    <Stack gap="md" testID={testID}>
      <View onLayout={onLayout} style={styles.grid}>
        {cell > 0
          ? manager.slots.map((slot, index) => {
              const isFirstEmpty = slot.kind === "empty" && firstEmpty;
              if (slot.kind === "empty") firstEmpty = false;

              return (
                <View key={slot.key} style={{ width: cell }}>
                  <SlotView
                    cell={cell}
                    index={index}
                    isFirstEmpty={isFirstEmpty}
                    manager={manager}
                    mode={mode}
                    slot={slot}
                    testID={testID}
                  />
                </View>
              );
            })
          : null}
      </View>

      {cameraAvailable && manager.canAdd ? (
        <Button icon="camera" onPress={() => void manager.add("camera")} size="md" testID={`${testID}-camera`} variant="secondary">
          Hacer una foto
        </Button>
      ) : null}

      {manager.notice ? (
        <Stack gap="xs">
          <FormMessage tone="info">{manager.notice.message}</FormMessage>
          {manager.notice.action === "settings" && onOpenSettings ? (
            <Button icon="gear" onPress={onOpenSettings} size="sm" variant="ghost">
              Abrir Ajustes
            </Button>
          ) : null}
        </Stack>
      ) : null}

      <View style={styles.tip}>
        <Icon color={theme.semantic.icon.muted} name="sparkle" size={18} />
        <Text color="muted" style={styles.tipText} variant="callout">
          Que se te vea la cara y la luz sea buena. La primera es la que se ve antes.
        </Text>
      </View>
    </Stack>
  );
}

interface SlotViewProps {
  slot: PhotoSlot;
  index: number;
  cell: number;
  isFirstEmpty: boolean;
  manager: PhotoManager;
  mode: PhotoManagerMode;
  testID: string;
}

function polaroidHeight(cell: number, caption: boolean) {
  const photo = (cell - POLAROID_SIDE * 2 - 5) / PHOTO_ASPECT_RATIO;
  return POLAROID_SIDE + photo + (caption ? POLAROID_CAPTION_BOTTOM : POLAROID_BOTTOM) + 5;
}

const SlotView = memo(function SlotView({ slot, index, cell, isFirstEmpty, manager, testID }: SlotViewProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const tilt = TILTS[index % TILTS.length];

  if (slot.kind === "empty") {
    const height = polaroidHeight(cell, false);
    const disabled = !manager.canAdd;

    return (
      <PressableScale
        accessibilityHint="Abre tu galería"
        accessibilityLabel="Añadir foto"
        accessibilityRole="button"
        disabled={disabled}
        elevation="none"
        faceStyle={[
          styles.empty,
          {
            height,
            borderRadius: theme.primitives.radius.sm,
            borderWidth: theme.primitives.border.regular,
            borderColor: c.inkSoft,
            backgroundColor: isFirstEmpty ? c.white : c.paperDeep
          }
        ]}
        onPress={() => void manager.add("library")}
        testID={`${testID}-add-${index}`}
      >
        <View style={[styles.plus, { borderColor: c.ink, backgroundColor: isFirstEmpty ? c.fresa : c.white }]}>
          <Icon color={c.ink} name="plus" size={26} strokeWidth={2.75} />
        </View>
        {isFirstEmpty ? (
          <Text align="center" variant="label">
            Añadir foto
          </Text>
        ) : null}
      </PressableScale>
    );
  }

  if (slot.kind === "pending") {
    return <PendingPolaroid cell={cell} manager={manager} pending={slot.pending} testID={`${testID}-pending-${index}`} tilt={tilt} />;
  }

  const { photo, isMain } = slot;
  const busy = manager.busyPhotoId === photo.id;

  return (
    <Stack gap="sm">
      <View>
        <PolaroidFrame
          accessibilityLabel={isMain ? "Tu foto principal" : `Tu foto ${index + 1}`}
          caption={isMain ? "¡La principal!" : undefined}
          elevation="md"
          photoAspectRatio={PHOTO_ASPECT_RATIO}
          tapeColors={isMain ? ["fresa", "limonada"] : ["lavanda"]}
          tapes={isMain ? "corners" : "top"}
          testID={`${testID}-photo-${index}`}
          tilt={tilt}
          uri={photo.url}
          width={cell}
        />
        {busy ? (
          <View style={[styles.busy, { backgroundColor: c.scrim }]}>
            <LoadingDots color={c.white} />
          </View>
        ) : null}
      </View>
      <View style={styles.actions}>
        {isMain ? null : (
          <IconButton
            accessibilityLabel="Hacer principal"
            disabled={busy || manager.uploading}
            icon="star"
            onPress={() => void manager.makeMain(photo.id)}
            size="sm"
            testID={`${testID}-main-${index}`}
          />
        )}
        <IconButton
          accessibilityLabel="Quitar foto"
          color="white"
          disabled={busy}
          icon="trash"
          onPress={() => void manager.remove(photo.id)}
          size="sm"
          testID={`${testID}-remove-${index}`}
        />
      </View>
    </Stack>
  );
});

function PendingPolaroid({
  pending,
  cell,
  tilt,
  manager,
  testID
}: {
  pending: PendingPhoto;
  cell: number;
  tilt: number;
  manager: PhotoManager;
  testID: string;
}) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const failed = pending.error !== null;
  const retryable = failed && pending.retryable !== false;

  return (
    <Stack gap="sm">
      <PolaroidFrame
        elevation="md"
        photoAspectRatio={PHOTO_ASPECT_RATIO}
        tapes="none"
        testID={testID}
        tilt={tilt}
        width={cell}
      >
        <Image contentFit="cover" source={{ uri: pending.localUri }} style={StyleSheet.absoluteFill} />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: failed ? theme.semantic.state.dangerSoft : c.paper, opacity: failed ? 0.94 : 0.62 }
          ]}
        />
        <View style={[StyleSheet.absoluteFill, styles.pendingOverlay]}>
          {failed ? (
            <Stack align="center" gap="xs">
              <Icon color={theme.semantic.state.danger} name="alert" size={26} />
              <Text align="center" color="danger" numberOfLines={5} variant="caption">
                {pending.error}
              </Text>
            </Stack>
          ) : (
            <Stack align="stretch" gap="xs" style={styles.progressBox}>
              <Text align="center" variant="label">
                {STAGE_LABEL[pending.stage]}
              </Text>
              <ProgressBar accessibilityLabel="Subiendo foto" color="menta" size="sm" value={pending.progress} />
            </Stack>
          )}
        </View>
      </PolaroidFrame>
      {failed ? (
        <View style={styles.actions}>
          {retryable ? (
            <IconButton
              accessibilityLabel="Reintentar subida"
              color="limonada"
              icon="refresh"
              onPress={() => manager.retry(pending.key)}
              size="sm"
              testID={`${testID}-retry`}
            />
          ) : null}
          <IconButton
            accessibilityLabel="Descartar foto"
            icon="close"
            onPress={() => manager.discard(pending.key)}
            size="sm"
            testID={`${testID}-discard`}
          />
        </View>
      ) : (
        <View style={styles.actionsPlaceholder}>
          <Text color="faint" variant="caption">{`${Math.round(pending.progress * 100)} %`}</Text>
        </View>
      )}
    </Stack>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: GAP,
    rowGap: GAP + 4
  },
  empty: {
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  plus: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center"
  },
  busy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    minHeight: 40
  },
  actionsPlaceholder: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  pendingOverlay: {
    alignItems: "center",
    justifyContent: "center",
    padding: 10
  },
  progressBox: {
    width: "86%"
  },
  tip: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start"
  },
  tipText: {
    flex: 1
  }
});
