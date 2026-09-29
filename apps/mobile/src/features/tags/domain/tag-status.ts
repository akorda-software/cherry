import { MAX_BLOCKED_TAGS, MAX_POSITIVE_TAGS, MIN_POSITIVE_TAGS, RECOMMENDED_POSITIVE_TAGS } from "./tag-selection";

/** Texto del estante de «Así soy yo» según cuántas lleva (mín. 3, se recomiendan 5, máx. 8). */
export function positiveTagsStatus(count: number): string {
  if (count === 0) return `Elige al menos ${MIN_POSITIVE_TAGS}`;
  if (count < MIN_POSITIVE_TAGS) {
    const missing = MIN_POSITIVE_TAGS - count;
    return missing === 1 ? "Te falta 1" : `Te faltan ${missing}`;
  }
  if (count < RECOMMENDED_POSITIVE_TAGS) return `¡Bien! Con ${RECOMMENDED_POSITIVE_TAGS} se te entiende mejor`;
  if (count < MAX_POSITIVE_TAGS) return "¡Genial! Así da gusto conocerte";
  return "¡Estante completo!";
}

/** Texto del estante de «No va conmigo» (opcional, máx. 5). */
export function blockedTagsStatus(count: number): string {
  if (count === 0) return `Opcional · hasta ${MAX_BLOCKED_TAGS}`;
  if (count < MAX_BLOCKED_TAGS) return `${count} de ${MAX_BLOCKED_TAGS} · nada de dramas`;
  return "Has llegado al máximo";
}
