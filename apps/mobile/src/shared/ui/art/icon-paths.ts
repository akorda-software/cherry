/**
 * Geometría del set de iconos de la «Libreta kawaii».
 *
 * Un único lenguaje: retícula de 24, trazo de tinta con extremos y uniones
 * redondeados, proporciones rechonchas y ningún detalle más fino que el hueco
 * mínimo que sobrevive a 16 px. Cada icono es una lista de trazos:
 * - `fillable`: forma cerrada que recibe el relleno pastel opcional (`fill`).
 * - `solid`: punto macizo del color de la tinta (ojos, puntos de la «i»…).
 *
 * Datos puros (sin React) para poder previsualizarlos y testearlos aparte.
 */
export interface IconPart {
  d: string;
  fillable?: boolean;
  solid?: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Círculo como trazo (dos arcos). */
export function circle(cx: number, cy: number, r: number): string {
  return `M${r2(cx - r)} ${r2(cy)}a${r2(r)} ${r2(r)} 0 1 0 ${r2(2 * r)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(-2 * r)} 0Z`;
}

/** Rectángulo con esquinas redondeadas. */
function rrect(x: number, y: number, w: number, h: number, r: number): string {
  const iw = r2(w - 2 * r);
  const ih = r2(h - 2 * r);
  return `M${r2(x + r)} ${r2(y)}h${iw}a${r} ${r} 0 0 1 ${r} ${r}v${ih}a${r} ${r} 0 0 1 ${-r} ${r}h${-iw}a${r} ${r} 0 0 1 ${-r} ${-r}v${-ih}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
}

const stroke = (d: string): IconPart => ({ d });
const shape = (d: string): IconPart => ({ d, fillable: true });
const dot = (cx: number, cy: number, r: number): IconPart => ({ d: circle(cx, cy, r), solid: true });

/** Formas base (retícula 24) reutilizadas por la mascota, las decoraciones y las celebraciones. */
export const HEART =
  "M12 20.25C7.4 17.4 3 13.9 3 9.2 3 6.3 5.2 4 8 4c1.7 0 3.1.9 4 2.4.9-1.5 2.3-2.4 4-2.4 2.8 0 5 2.3 5 5.2 0 4.7-4.4 8.2-9 11.05Z";
export const STAR =
  "M11.27 4.53Q12 3 12.73 4.53L14.38 7.99Q14.76 8.8 15.65 8.91L19.44 9.41Q21.13 9.63 19.9 10.8L17.12 13.43Q16.47 14.05 16.63 14.94L17.33 18.7Q17.64 20.37 16.15 19.55L12.79 17.73Q12 17.3 11.21 17.73L7.85 19.55Q6.36 20.37 6.67 18.7L7.37 14.94Q7.53 14.05 6.88 13.43L4.1 10.8Q2.87 9.63 4.56 9.41L8.35 8.91Q9.24 8.8 9.62 7.99Z";
export const SPARKLE = "M12 2.75Q13.7 10.3 21.25 12Q13.7 13.7 12 21.25Q10.3 13.7 2.75 12Q10.3 10.3 12 2.75Z";
const CHAT =
  "M9 4H15A5.5 5.5 0 0 1 20.5 9.5V11.5A5.5 5.5 0 0 1 15 17H10.5L6.8 20V16.54A5.5 5.5 0 0 1 3.5 11.5V9.5A5.5 5.5 0 0 1 9 4Z";
const SHIELD = "M12 3.25l7.25 2.6v5.9c0 4.35-3.05 7.65-7.25 9.25-4.2-1.6-7.25-4.9-7.25-9.25v-5.9Z";

export const iconPaths = {
  // Acciones de descubrir
  heart: [shape(HEART)],
  "heart-filled": [shape(HEART)],
  "heart-crack": [shape(HEART), stroke("M12 6.4l-1.7 3.7 3.3 2.2-2 3.8")],
  x: [stroke("M6 6l12 12M18 6 6 18")],
  close: [stroke("M7 7l10 10M17 7 7 17")],
  undo: [stroke("M9 4.75 4.75 9 9 13.25"), stroke("M4.75 9h10a5 5 0 0 1 0 10H11")],
  star: [shape(STAR)],
  "star-filled": [shape(STAR)],
  sparkle: [shape(SPARKLE)],
  sparkles: [
    shape("M9.75 6.25Q10.88 12.37 17 13.5Q10.88 14.63 9.75 20.75Q8.62 14.63 2.5 13.5Q8.62 12.37 9.75 6.25Z"),
    { d: "M18 2.6Q18.58 5.42 21.4 6Q18.58 6.58 18 9.4Q17.42 6.58 14.6 6Q17.42 5.42 18 2.6Z", solid: true },
    dot(19.25, 17.25, 1.35)
  ],

  // Personas y conversación
  chat: [shape(CHAT)],
  "chat-dots": [shape(CHAT), dot(8.25, 10.5, 1.35), dot(12, 10.5, 1.35), dot(15.75, 10.5, 1.35)],
  user: [shape(circle(12, 7.75, 3.75)), shape("M5 20.5C5 17 8.1 15 12 15s7 2 7 5.5Z")],
  users: [
    shape(circle(9, 8.25, 3.5)),
    shape("M2.75 20.5C2.75 17.1 5.5 15 9 15s6.25 2.1 6.25 5.5Z"),
    stroke("M15.25 4.9a3.4 3.4 0 0 1 0 6.7"),
    stroke("M17.6 15.25c2.2.65 3.65 2.5 3.65 5.25")
  ],
  smile: [shape(circle(12, 12, 9)), dot(9, 10, 1.35), dot(15, 10, 1.35), stroke("M8.75 14a3.75 3.75 0 0 0 6.5 0")],
  send: [shape("M4.25 4.6 20.25 12 4.25 19.4 6.9 12Z"), stroke("M6.9 12h5.6")],
  mail: [shape(rrect(3, 5.25, 18, 13.5, 3.25)), stroke("M4.75 7.75 12 12.75l7.25-5")],
  bell: [
    shape(
      "M12 3.5a6 6 0 0 0-6 6v3.15c0 1.2-.45 2.35-1.25 3.25l-.55.6h15.6l-.55-.6c-.8-.9-1.25-2.05-1.25-3.25V9.5a6 6 0 0 0-6-6Z"
    ),
    stroke("M9.75 19.6a2.35 2.35 0 0 0 4.5 0")
  ],

  // Modos y navegación
  cards: [
    stroke(
      "M10.26 4.63L10.79 4.22L11.73 3.86L12.4 3.8L13.06 3.89L18.72 5.32L19.59 5.82L20.25 6.58L20.53 7.19L20.66 7.85L20.65 8.52L20.42 9.51L18.67 16.45L18.17 17.32L17.41 17.98"
    ),
    shape(
      "M6.25 7.25H11.75A3 3 0 0 1 14.75 10.25V17.75A3 3 0 0 1 11.75 20.75H6.25A3 3 0 0 1 3.25 17.75V10.25A3 3 0 0 1 6.25 7.25Z"
    )
  ],
  feed: [shape(rrect(4, 3, 16, 7.5, 2.5)), shape(rrect(4, 13.5, 16, 7.5, 2.5))],
  home: [
    shape("M4 10.25 12 3.75l8 6.5V18a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18Z"),
    stroke("M9.75 20.5v-4.25a2.25 2.25 0 0 1 4.5 0v4.25")
  ],
  sliders: [
    stroke("M3.5 8h8M17.5 8h3"),
    shape(circle(14.5, 8, 3)),
    stroke("M3.5 16h3M12.5 16h8"),
    shape(circle(9.5, 16, 3))
  ],
  gear: [
    shape(
      "M9.92 5.21L10.19 2.67A9.5 9.5 0 0 1 13.81 2.67L14.08 5.21A7.1 7.1 0 0 1 16.84 6.81L19.17 5.77A9.5 9.5 0 0 1 20.98 8.91L18.92 10.4A7.1 7.1 0 0 1 18.92 13.6L20.98 15.09A9.5 9.5 0 0 1 19.17 18.23L16.84 17.19A7.1 7.1 0 0 1 14.08 18.79L13.81 21.33A9.5 9.5 0 0 1 10.19 21.33L9.92 18.79A7.1 7.1 0 0 1 7.16 17.19L4.83 18.23A9.5 9.5 0 0 1 3.02 15.09L5.08 13.6A7.1 7.1 0 0 1 5.08 10.4L3.02 8.91A9.5 9.5 0 0 1 4.83 5.77L7.16 6.81A7.1 7.1 0 0 1 9.92 5.21Z"
    ),
    shape(circle(12, 12, 2.9))
  ],
  menu: [stroke("M4.5 6.75h15M4.5 12h15M4.5 17.25h15")],
  more: [dot(12, 5.25, 2), dot(12, 12, 2), dot(12, 18.75, 2)],
  "more-horizontal": [dot(5.25, 12, 2), dot(12, 12, 2), dot(18.75, 12, 2)],
  grip: [dot(9, 6, 1.6), dot(15, 6, 1.6), dot(9, 12, 1.6), dot(15, 12, 1.6), dot(9, 18, 1.6), dot(15, 18, 1.6)],
  search: [shape(circle(10.5, 10.5, 6.75)), stroke("M15.6 15.6l4.65 4.65")],
  "chevron-left": [stroke("M14.5 5.5 8 12l6.5 6.5")],
  "chevron-right": [stroke("M9.5 5.5 16 12l-6.5 6.5")],
  "chevron-down": [stroke("M5.5 9.25 12 15.75l6.5-6.5")],
  "chevron-up": [stroke("M5.5 14.75 12 8.25l6.5 6.5")],
  "arrow-up": [stroke("M12 19.5V5M5.75 11.25 12 5l6.25 6.25")],
  "arrow-down": [stroke("M12 4.5V19M5.75 12.75 12 19l6.25-6.25")],
  "arrow-left": [stroke("M19.5 12H5M11.25 5.75 5 12l6.25 6.25")],
  "arrow-right": [stroke("M4.5 12H19M12.75 5.75 19 12l-6.25 6.25")],
  external: [
    stroke("M13.75 4.25h6v6M19.5 4.5l-7.75 7.75"),
    stroke("M17.5 13.75v3.5a2.75 2.75 0 0 1-2.75 2.75h-8A2.75 2.75 0 0 1 4 17.25v-8A2.75 2.75 0 0 1 6.75 6.5h3.5")
  ],
  refresh: [
    stroke("M4.51 9.99A7.75 7.75 0 0 1 17.76 6.81M17.54 3.62l.22 3.19-3.15-.55"),
    stroke("M19.49 14.01A7.75 7.75 0 0 1 6.24 17.19M6.46 20.38l-.22-3.19 3.15.55")
  ],
  logout: [
    stroke("M9.75 20.25H7a3 3 0 0 1-3-3V6.75a3 3 0 0 1 3-3h2.75"),
    stroke("M15 7.5l4.5 4.5-4.5 4.5M19.5 12H9.5")
  ],
  download: [stroke("M12 4v10.5M7.5 10.25 12 14.75l4.5-4.5M4.75 19.5h14.5")],

  // Edición y fotos
  plus: [stroke("M12 5v14M5 12h14")],
  minus: [stroke("M5 12h14")],
  check: [stroke("M4.75 12.75l4.5 4.5L19.25 7")],
  "check-circle": [shape(circle(12, 12, 9)), stroke("M8 12.4l2.7 2.7L16 9.6")],
  camera: [
    shape(
      "M3 10.5A3.5 3.5 0 0 1 6.5 7h1.7l1.4-2.25h4.8L15.8 7h1.7a3.5 3.5 0 0 1 3.5 3.5V16a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 16Z"
    ),
    shape(circle(12, 13.25, 3.25)),
    dot(17.6, 9.9, 0.95)
  ],
  image: [shape(rrect(3, 4, 18, 16, 4)), shape(circle(9, 9.5, 2)), stroke("M20.75 15.5l-3.2-3.2a2 2 0 0 0-2.83 0L7 20")],
  pencil: [
    shape("M15.83 4.63 6.23 14.23 4.3 19.7l5.47-1.93 9.6-9.6a2.5 2.5 0 0 0-3.54-3.54Z"),
    stroke("M13.57 6.89l3.53 3.54")
  ],
  trash: [
    shape("M5.75 6.5h12.5l-.95 12.15a2 2 0 0 1-2 1.85H8.7a2 2 0 0 1-2-1.85Z"),
    stroke("M3.75 6.5h16.5M9 6.5V5a1.75 1.75 0 0 1 1.75-1.75h2.5A1.75 1.75 0 0 1 15 5v1.5M10 10.5v6M14 10.5v6")
  ],
  pause: [shape(rrect(6, 4.75, 4, 14.5, 1.75)), shape(rrect(14, 4.75, 4, 14.5, 1.75))],
  play: [shape("M7.5 6.45Q7.5 4.25 9.37 5.41L18.13 10.84Q20 12 18.13 13.16L9.37 18.59Q7.5 19.75 7.5 17.55Z")],
  tag: [
    shape(
      "M3.5 5.75v5.35a2.25 2.25 0 0 0 .66 1.59l7.9 7.9a2.25 2.25 0 0 0 3.18 0l5.35-5.35a2.25 2.25 0 0 0 0-3.18l-7.9-7.9A2.25 2.25 0 0 0 11.1 3.5H5.75A2.25 2.25 0 0 0 3.5 5.75Z"
    ),
    dot(8, 8, 1.5)
  ],

  // Seguridad y ajustes
  flag: [
    shape("M4.5 4.25C7.1 2.95 9.4 2.95 12 4.25s4.9 1.3 7.5 0v9c-2.6 1.3-4.9 1.3-7.5 0s-4.9-1.3-7.5 0Z"),
    stroke("M4.5 4.25V21")
  ],
  block: [shape(circle(12, 12, 8.75)), stroke("M5.8 5.8l12.4 12.4")],
  shield: [shape(SHIELD)],
  "shield-check": [shape(SHIELD), stroke("M9 12.25l2.1 2.1 3.9-4")],
  lock: [shape(rrect(4.5, 10, 15, 10.5, 3.25)), stroke("M8 10V7.75a4 4 0 0 1 8 0V10"), dot(12, 15.25, 1.5)],
  eye: [
    shape("M2.75 12C5 7.6 8.3 5.5 12 5.5s7 2.1 9.25 6.5C19 16.4 15.7 18.5 12 18.5S5 16.4 2.75 12Z"),
    stroke(circle(12, 12, 3.1))
  ],
  "eye-off": [stroke("M3.5 7.75C6.25 12.25 9 13.5 12 13.5s5.75-1.25 8.5-5.75M6 11.35l-1.7 2.2M12 13.5v2.75M18 11.35l1.7 2.2")],
  info: [shape(circle(12, 12, 9)), stroke("M12 11v5.25"), dot(12, 7.6, 1.35)],
  alert: [shape(circle(12, 12, 9)), stroke("M12 7.25v5.5"), dot(12, 16.4, 1.35)],
  help: [shape(circle(12, 12, 9)), stroke("M9.35 9.5a2.75 2.75 0 1 1 3.8 2.55c-.7.3-1.15.95-1.15 1.7v.35"), dot(12, 17, 1.3)],
  clock: [shape(circle(12, 12, 9)), stroke("M12 7.25V12l3.25 2.25")],
  moon: [shape("M20 14.6A8.25 8.25 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6Z")],
  pin: [
    shape("M12 21C9.4 18.6 4.75 14.2 4.75 9.75a7.25 7.25 0 0 1 14.5 0c0 4.45-4.65 8.85-7.25 11.25Z"),
    stroke(circle(12, 9.75, 2.6))
  ],

  // Pequeños placeres
  gift: [
    shape(rrect(3.5, 8, 17, 4.25, 1.5)),
    shape("M5 12.25h14v6.25a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"),
    stroke("M12 8v12.5"),
    stroke("M12 8C10.9 5.2 8.1 4 7.1 5.6 6.3 7 8.3 8 12 8Zm0 0c1.1-2.8 3.9-4 4.9-2.4.8 1.4-1.2 2.4-4.9 2.4Z")
  ],
  code: [stroke("M8.25 7.5 3.75 12l4.5 4.5M15.75 7.5l4.5 4.5-4.5 4.5M13.25 5.25l-2.5 13.5")],
  cake: [
    shape(rrect(4, 12.25, 16, 8.25, 2.5)),
    stroke("M4 15.75c1.33 1.2 2.67 1.2 4 0s2.67-1.2 4 0 2.67 1.2 4 0 2.67-1.2 4 0M12 12.25v-3.5"),
    { d: "M12 3.25c1.15 1.2 1.7 2.2 1.25 3.05a1.4 1.4 0 0 1-2.5 0c-.45-.85.1-1.85 1.25-3.05Z", solid: true }
  ],
  leaf: [
    shape("M4.75 19.25C4.75 10.5 10 4.75 19.25 4.75c0 8.75-5.75 14.5-14.5 14.5Z"),
    stroke("M3.75 20.25 12.5 11.5")
  ],
  flower: [
    shape(
      "M8 6.49A4.05 4.05 0 1 1 16 6.49A4.05 4.05 0 1 1 18.48 14.1A4.05 4.05 0 1 1 12 18.81A4.05 4.05 0 1 1 5.52 14.1A4.05 4.05 0 1 1 8 6.49Z"
    ),
    stroke(circle(12, 12, 2.4))
  ]
} as const satisfies Record<string, readonly IconPart[]>;

export type IconName = keyof typeof iconPaths;

/** Iconos que, sin `fill` explícito, se rellenan con su propio color. */
export const solidByDefault: ReadonlySet<IconName> = new Set<IconName>(["heart-filled", "star-filled"]);

export const iconNames = Object.keys(iconPaths) as IconName[];
