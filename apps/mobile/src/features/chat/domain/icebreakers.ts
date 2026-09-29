import type { ProfileTag } from "@snack/contracts";

/**
 * Rompehielos para una conversación vacía a partir de las etiquetas en común.
 * Solo preguntas ligeras y amables: las etiquetas delicadas (hijos, tipo de relación,
 * tabaco, cannabis…) nunca se usan como excusa para abrir conversación.
 */

export interface IcebreakerTag {
  slug: string;
  label: string;
  emoji: string | null;
}

export interface Icebreaker {
  id: string;
  /** Etiqueta en común que lo inspira (`null` = sugerencia genérica). */
  tag: IcebreakerTag | null;
  /** Texto que se copia en el campo de mensaje. */
  message: string;
}

const PROMPTS_BY_SLUG: Readonly<Record<string, string>> = {
  music: "¿Qué canción llevas en bucle estos días?",
  cinema: "¿Qué serie o peli me recomendarías sin dudarlo?",
  reading: "¿Qué libro te ha atrapado últimamente?",
  gaming: "¿A qué estás jugando ahora mismo?",
  travel: "¿Cuál ha sido tu mejor viaje hasta ahora?",
  cooking: "¿Cuál es tu plato estrella en la cocina?",
  art: "¿Qué artista te inspira últimamente?",
  photography: "¿Qué es lo que más te gusta fotografiar?",
  dancing: "¿Qué canción te saca a bailar sí o sí?",
  languages: "¿Qué idiomas hablas o estás aprendiendo?",
  anime: "¿Qué anime o manga me recomendarías para empezar?",
  board_games: "¿Cuál es tu juego de mesa favorito para una tarde larga?",
  concerts: "¿Cuál es el mejor concierto al que has ido?",
  fitness: "¿Qué es lo que más te gusta entrenar?",
  running: "¿Tienes alguna carrera marcada en el calendario?",
  yoga: "¿Cuál es tu postura de yoga favorita?",
  cycling: "¿Cuál es tu ruta favorita en bici?",
  hiking: "¿Qué ruta de montaña me recomendarías?",
  team_sports: "¿A qué deporte juegas y en qué posición?",
  nature: "¿Cuál es tu rincón favorito para desconectar en la naturaleza?",
  adventure: "¿Cuál es la aventura más loca que has hecho?",
  party: "¿Cómo es tu noche de fiesta perfecta?",
  chill: "¿Cómo es tu plan tranquilo ideal para un domingo?",
  night_owl: "¿Qué es lo que más te gusta hacer cuando todo el mundo duerme?",
  foodie: "¿Cuál es el mejor sitio en el que has comido este año?",
  coffee: "¿Cuál es tu cafetería favorita?",
  vegan: "¿Cuál es tu receta vegana favorita?",
  vegetarian: "¿Qué plato vegetariano te encanta?",
  sober: "¿Cuál es tu bebida sin alcohol favorita para brindar?",
  tattoos: "¿Tienes algún tatuaje con historia?",
  meditation: "¿Cómo empezaste a meditar?",
  spirituality: "¿Qué te ayuda a sentirte en calma?",
  astrology: "Pregunta obligatoria: ¿de qué signo eres?",
  environmentalist: "¿Qué pequeño gesto verde no te saltas nunca?",
  family_oriented: "¿Cuál es tu plan favorito en familia?",
  volunteer: "¿Con qué causa colaboras?",
  introvert: "¿Cuál es tu plan perfecto para recargar pilas?",
  extrovert: "¿Qué plan con gente te hace más ilusión?",
  ambitious: "¿Qué proyecto te hace ilusión ahora mismo?",
  creative: "¿Qué es lo último que has creado?",
  curious: "¿Qué es lo último que has aprendido que te voló la cabeza?",
  dogs: "¿Tienes perro? Cuéntamelo todo.",
  cats: "¿Tienes gato? Cuéntamelo todo."
};

const GENERIC_PROMPTS: readonly string[] = [
  "¿Qué plan te haría ilusión este finde?",
  "Si solo pudieras comer un snack el resto de tu vida, ¿cuál sería?",
  "¿Qué es lo mejor que te ha pasado esta semana?"
];

export function icebreakerPromptForTag(slug: string): string | null {
  return PROMPTS_BY_SLUG[slug] ?? null;
}

export interface BuildIcebreakersOptions {
  /** Cuántas sugerencias como máximo (por defecto 3). */
  max?: number;
  /** Mínimo a mostrar rellenando con sugerencias genéricas (por defecto 2). */
  min?: number;
  /** Semilla estable (p. ej. el id de la conversación) para variar entre chats sin parpadeos. */
  seed?: string;
}

export function buildIcebreakers(
  tags: readonly ProfileTag[] | null | undefined,
  { max = 3, min = 2, seed = "" }: BuildIcebreakersOptions = {}
): Icebreaker[] {
  const shared = (tags ?? []).filter((tag) => tag.shared && icebreakerPromptForTag(tag.slug) !== null);
  const offset = shared.length > 0 ? hashSeed(seed) % shared.length : 0;
  const rotated = [...shared.slice(offset), ...shared.slice(0, offset)];

  const suggestions: Icebreaker[] = rotated.slice(0, max).map((tag) => ({
    id: `tag-${tag.slug}`,
    tag: { slug: tag.slug, label: tag.label, emoji: tag.emoji },
    message: icebreakerPromptForTag(tag.slug)!
  }));

  const genericOffset = hashSeed(`${seed}:generic`) % GENERIC_PROMPTS.length;
  for (let index = 0; suggestions.length < Math.min(min, max) && index < GENERIC_PROMPTS.length; index += 1) {
    const message = GENERIC_PROMPTS[(genericOffset + index) % GENERIC_PROMPTS.length]!;
    suggestions.push({ id: `generic-${(genericOffset + index) % GENERIC_PROMPTS.length}`, tag: null, message });
  }

  return suggestions;
}

/** Texto de contexto del rompehielos: «Os gusta ☕ Amante del café a los dos». */
export function icebreakerContext(icebreaker: Icebreaker): string {
  if (icebreaker.tag === null) {
    return "Para empezar con buen pie";
  }

  const label = icebreaker.tag.emoji ? `${icebreaker.tag.emoji} ${icebreaker.tag.label}` : icebreaker.tag.label;
  return `En común: ${label}`;
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}
