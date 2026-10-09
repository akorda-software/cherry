import { useCallback, useRef } from "react";
import { AccessibilityInfo } from "react-native";

import type { Tag } from "@snack/contracts";

import { haptics, toast, useShake } from "../../../shared/ui";
import type { TagKind, TagSelectionState, ToggleOutcome } from "../domain/tag-selection";
import { tagLimitMessage, tagStateAnnouncement } from "../domain/tag-status";

/** No se repite el mismo aviso de límite mientras sigue en pantalla. */
const LIMIT_TOAST_COOLDOWN_MS = 3000;

/**
 * Conecta los «+» / «−» del tablero con el editor: háptico de selección y
 * anuncio para el lector de pantalla en cada cambio; con la lista llena,
 * háptico de aviso, sacudida del contador y un toast (sin encolar repetidos).
 * `onPress` es estable: las filas memorizadas no se repintan por él.
 */
export function useTagControls(press: (kind: TagKind, tagId: string) => ToggleOutcome) {
  const liked = useShake({ distance: 6, haptic: false });
  const blocked = useShake({ distance: 6, haptic: false });
  const latest = useRef({ press, shakeLiked: liked.shake, shakeBlocked: blocked.shake });
  latest.current = { press, shakeLiked: liked.shake, shakeBlocked: blocked.shake };
  const lastLimit = useRef<{ kind: TagKind; at: number } | null>(null);

  const onPress = useCallback((tag: Tag, kind: TagKind) => {
    const { press: apply, shakeLiked, shakeBlocked } = latest.current;
    const outcome = apply(kind, tag.id);

    if (outcome.type === "limit_reached") {
      haptics.warning();
      (kind === "positive" ? shakeLiked : shakeBlocked)();

      const now = Date.now();
      const previous = lastLimit.current;

      if (!previous || previous.kind !== kind || now - previous.at > LIMIT_TOAST_COOLDOWN_MS) {
        lastLimit.current = { kind, at: now };
        // El toast ya se anuncia solo al lector de pantalla.
        toast.show({ message: tagLimitMessage(kind), tone: "warning", icon: kind === "positive" ? "heart" : "block" });
      }

      return;
    }

    if (outcome.type === "conflict") {
      return;
    }

    haptics.selection();
    const state: TagSelectionState = outcome.type === "removed" ? "neutral" : kind === "positive" ? "liked" : "blocked";
    AccessibilityInfo.announceForAccessibility?.(tagStateAnnouncement(tag.label, state));
  }, []);

  return { onPress, likedShakeStyle: liked.style, blockedShakeStyle: blocked.style };
}
