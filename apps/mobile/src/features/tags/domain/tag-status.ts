import {
  MAX_BLOCKED_TAGS,
  MAX_POSITIVE_TAGS,
  MIN_POSITIVE_TAGS,
  RECOMMENDED_POSITIVE_TAGS,
  type TagKind,
  type TagSelectionState
} from "./tag-selection";

/** Línea de estado del resumen (corta: cabe junto a los medidores a 360 dp). Mín. 3, se recomiendan 5, máx. 8. */
export function positiveTagsStatus(count: number): string {
  if (count === 0) return `Marca ${MIN_POSITIVE_TAGS} con +`;
  if (count < MIN_POSITIVE_TAGS) {
    const missing = MIN_POSITIVE_TAGS - count;
    return missing === 1 ? "Te falta 1" : `Te faltan ${missing}`;
  }
  if (count < RECOMMENDED_POSITIVE_TAGS) return `Mejor con ${RECOMMENDED_POSITIVE_TAGS}`;
  if (count < MAX_POSITIVE_TAGS) return "Listo";
  return "Completo";
}

/** Bloqueadas: opcional, máx. 5. */
export function blockedTagsStatus(count: number): string {
  if (count === 0) return `Opcional · hasta ${MAX_BLOCKED_TAGS}`;
  if (count < MAX_BLOCKED_TAGS) return `${count} de ${MAX_BLOCKED_TAGS}`;
  return `Has llegado al máximo de ${MAX_BLOCKED_TAGS}`;
}

/** Aviso al tocar «+» o «−» con la lista llena. */
export function tagLimitMessage(kind: TagKind): string {
  return kind === "positive"
    ? `Ya tienes ${MAX_POSITIVE_TAGS} que te gustan. Quita una para marcar otra.`
    : `Ya tienes ${MAX_BLOCKED_TAGS} bloqueadas. Quita una para bloquear otra.`;
}

/** Lo que se anuncia al lector de pantalla tras cambiar una etiqueta. */
export function tagStateAnnouncement(label: string, state: TagSelectionState): string {
  switch (state) {
    case "liked":
      return `${label}: te gusta`;
    case "blocked":
      return `${label}: bloqueada`;
    default:
      return `${label}: sin marcar`;
  }
}
