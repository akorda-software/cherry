/**
 * Geometría del logo de Cherry (un par de cerezas cuyas hojas son corazones), en las unidades
 * de `assets/brand/cherry-logo.svg`: los mismos trazados que los iconos de `assets/images`.
 * Si cambias algo aquí, cambia también el SVG fuente y regenera los PNG.
 */
export const CHERRY_MARK_WIDTH = 614;
export const CHERRY_MARK_HEIGHT = 800;
export const CHERRY_MARK_VIEWBOX = `0 0 ${CHERRY_MARK_WIDTH} ${CHERRY_MARK_HEIGHT}`;

/** Grosor del trazo de los rabitos. */
export const CHERRY_MARK_STEM_WIDTH = 28;

/** Rabitos de las dos cerezas, que se juntan en `junction`. */
export const CHERRY_MARK_STEMS_PATH = "M178 484Q186 384 320 304M454 526Q414 404 320 304";

/** Rabito común (de la unión a la hoja grande) y la rama de la hoja pequeña. */
export const CHERRY_MARK_STALK_PATH = "M320 304L307.2 212.9M314.2 263L339.7 247.1";

/** Hoja-corazón grande, inclinada a la izquierda, con la punta en `bigTip`. */
export const CHERRY_MARK_BIG_HEART_PATH =
  "M307.2 212.9C268.9 194.7 188.1 173.5 167.1 121.5A47.8 52 -22 0 1 255.8 85.6A47.8 52 -22 0 1 344.5 49.8C365.5 101.8 322.1 173.2 307.2 212.9Z";

/** Hoja-corazón pequeña, a la derecha, con la punta en `smallTip`. */
export const CHERRY_MARK_SMALL_HEART_PATH =
  "M339.7 247.1C348.5 214.9 353.9 149.2 391.5 125.8A37.7 41 58 0 1 431.5 189.7A37.7 41 58 0 1 471.4 253.7C433.9 277.2 372.5 253.3 339.7 247.1Z";

export interface CherryMarkCherry {
  cx: number;
  cy: number;
  r: number;
  /** Brillo: arco de papel arriba a la izquierda. */
  shine: string;
  shineWidth: number;
}

/** Cereza de detrás (derecha) primero, para pintarlas en orden. */
export const CHERRY_MARK_CHERRIES: readonly CherryMarkCherry[] = [
  { cx: 462, cy: 648, r: 136, shine: "M377.7 617.3A89.8 89.8 0 0 1 424.1 566.6", shineWidth: 17.7 },
  { cx: 170, cy: 624, r: 154, shine: "M74.5 589.2A101.6 101.6 0 0 1 127 531.9", shineWidth: 20 }
];

/** Puntos de giro para animar: la unión de los rabitos y la punta de cada hoja. */
export const CHERRY_MARK_PIVOTS = {
  junction: { x: 320, y: 304 },
  bigTip: { x: 307.2, y: 212.9 },
  smallTip: { x: 339.7, y: 247.1 }
} as const;

/**
 * Centro del círculo que envuelve el dibujo. Los iconos y el splash nativo centran este punto
 * (no el de la caja), así que la animación de arranque también.
 */
export const CHERRY_MARK_OPTICAL_CENTER = { x: 315, y: 420 } as const;
