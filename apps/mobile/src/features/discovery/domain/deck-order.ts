/**
 * Cálculos puros de la pila de swipe (se ejecutan también como worklets en el hilo de UI).
 *
 * Cada card no voladora se pinta en la posición `index + residual - (index > 0 ? progress : 0)`:
 * - `progress` (0..1): cuánto se ha arrastrado la card de arriba respecto al umbral;
 *   las de detrás «crecen» hacia su siguiente puesto mientras arrastras.
 * - `residual`: desplazamiento que queda por asentar tras un cambio de orden; se anima a 0.
 */

export type DeckOrderChange = "pop" | "push" | "same" | "reset";

/** Qué ha pasado entre dos órdenes de ids (arriba primero). */
export function classifyDeckOrderChange(previous: readonly string[], next: readonly string[]): DeckOrderChange {
  "worklet";

  if (previous.length === 0 || next.length === 0) {
    return "reset";
  }

  if (previous[0] === next[0]) {
    return "same";
  }

  if (previous.length > 1 && previous[1] === next[0]) {
    return "pop";
  }

  if (next.length > 1 && next[1] === previous[0]) {
    return "push";
  }

  return "reset";
}

/**
 * Nuevo `residual` para que nada salte al cambiar el orden (`progress` pasa a 0):
 * - pop (sale la de arriba): cada card baja un índice → residual + 1 - progress.
 * - push (vuelve una card arriba): cada card sube un índice → residual - 1.
 */
export function nextResidual(change: DeckOrderChange, residual: number, progress: number): number {
  "worklet";

  switch (change) {
    case "pop":
      return residual + 1 - progress;
    case "push":
      return residual - 1;
    case "same":
      return residual;
    default:
      return 0;
  }
}

/** Posición visual (0 = arriba) de la card `index` de la pila. */
export function deckPosition(index: number, residual: number, progress: number): number {
  "worklet";

  const position = index + residual - (index > 0 ? progress : 0);

  return Math.min(Math.max(position, 0), 3);
}

export type SwipeDecision = "like" | "dislike" | "open" | "cancel";

export interface SwipeReleaseInput {
  translationX: number;
  translationY: number;
  velocityX: number;
  velocityY: number;
  width: number;
}

/** Umbral horizontal (fracción del ancho de pantalla) para decidir sin velocidad. */
export const SWIPE_DISTANCE_RATIO = 0.28;
/** Velocidad (px/s) con la que basta un gesto corto («flick»). */
export const SWIPE_VELOCITY = 800;
/** Distancia mínima en la dirección del flick para que cuente. */
export const SWIPE_FLICK_MIN = 24;
/** Arrastre hacia arriba (px) para abrir el perfil completo. */
export const OPEN_PROFILE_DISTANCE = 110;
export const OPEN_PROFILE_VELOCITY = 900;

export function swipeThreshold(width: number): number {
  "worklet";

  return Math.max(96, width * SWIPE_DISTANCE_RATIO);
}

/** Decide qué hacer al soltar la card. */
export function decideSwipe({ translationX, translationY, velocityX, velocityY, width }: SwipeReleaseInput): SwipeDecision {
  "worklet";

  const threshold = swipeThreshold(width);
  const horizontal = Math.abs(translationX) >= Math.abs(translationY) * 0.8;

  if (horizontal) {
    if (translationX >= threshold || (velocityX >= SWIPE_VELOCITY && translationX >= SWIPE_FLICK_MIN)) {
      return "like";
    }

    if (translationX <= -threshold || (velocityX <= -SWIPE_VELOCITY && translationX <= -SWIPE_FLICK_MIN)) {
      return "dislike";
    }
  }

  const upward = -translationY > Math.abs(translationX) * 1.1;

  if (upward && (-translationY >= OPEN_PROFILE_DISTANCE || (velocityY <= -OPEN_PROFILE_VELOCITY && -translationY >= SWIPE_FLICK_MIN))) {
    return "open";
  }

  return "cancel";
}

/** 0..1 según lo cerca que está el arrastre del umbral de decisión. */
export function swipeProgress(translationX: number, width: number): number {
  "worklet";

  return Math.min(Math.abs(translationX) / swipeThreshold(width), 1);
}

/** Inclinación de «reposo» de una foto de la pila (−3°..3°), estable por id. */
export function restingTilt(id: string): number {
  let hash = 0;

  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }

  return ((Math.abs(hash) % 7) - 3) * 0.9;
}
