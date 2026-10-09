/**
 * Paleta de Snack: neobrutalismo sobrio con color. Papel blanco roto, tinta ciruela
 * (contornos, texto y sombras duras) y siete rotuladores de saturación igualada.
 *
 * PARA CAMBIAR LOS COLORES, EDITA SOLO `brandPalette`. Cada rol ocupa una «ranura»
 * con nombre histórico (fresa, limonada…) que usan los componentes; los tonos
 * `Soft` (fondos) y `Deep` (texto de acento, ≥ 4.5:1) se derivan solos.
 * Nunca texto blanco sobre color: sobre cualquier relleno va tinta.
 */
export const brandPalette = {
  /** Fondo de pantalla. */
  paper: "#FAF6F0",
  /** Arena: trama de puntos del papel y superficies hundidas (mezclado con el papel). */
  sand: "#E3D8C8",
  /** Contornos, texto, sombras duras. El único «negro». */
  ink: "#1D1426",
  /** Texto secundario y terciario (≥ 4.5:1 sobre papel). */
  inkSoft: "#5E5468",
  inkFaint: "#726980",
  /** Principal: marca, acción principal, «me gusta», pestaña activa (ranura `fresa`). */
  primary: "#FF6B57",
  /** Secundario: lo destacado y lo compartido, «en común» (ranura `limonada`). */
  secondary: "#FFC53D",
  /** Terciario: el «no» amable, acciones suaves (ranura `lavanda`). */
  tertiary: "#A58BFF",
  /** Cuarto: información (ranura `cielo`). */
  quaternary: "#5EC0FF",
  /** Quinto: toque extra para categorías y páginas (ranura `melocoton`). */
  quinary: "#B9E53C",
  /** Positivo: me gusta en etiquetas, éxito (ranura `menta`). */
  positive: "#62D98C",
  /** Negativo: bloqueo, peligro, errores (ranura `tomate`). */
  negative: "#F2544F"
} as const;

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function mix(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  return toHex([0, 1, 2].map((i) => pa[i] + (pb[i] - pa[i]) * t) as Rgb);
}

function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Tono `Soft`: el color muy aclarado hacia el blanco (fondos, estados suaves). */
function softOf(base: string): string {
  return mix(base, "#FFFFFF", 0.76);
}

function toHsl(hex: string): Rgb {
  const [r, g, b] = parseHex(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, sat, l];
}

function fromHsl([h, sat, l]: Rgb): string {
  if (sat === 0) return toHex([l * 255, l * 255, l * 255]);
  const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
  const p = 2 * l - q;
  const channel = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    const v = u < 1 / 6 ? p + (q - p) * 6 * u : u < 1 / 2 ? q : u < 2 / 3 ? p + (q - p) * (2 / 3 - u) * 6 : p;
    return v * 255;
  };
  return toHex([channel(h + 1 / 3), channel(h), channel(h - 1 / 3)]);
}

/** Tono `Deep`: mismo matiz, más oscuro, hasta leerse (≥ 4.5:1) sobre papel y sobre su `Soft`. */
function deepOf(base: string): string {
  const soft = softOf(base);
  const [h, sat, l] = toHsl(base);
  for (let lightness = l; lightness > 0.05; lightness -= 0.01) {
    const deep = fromHsl([h, Math.min(sat, 0.85), lightness]);
    if (contrast(deep, soft) >= 4.6 && contrast(deep, brandPalette.paper) >= 4.6) {
      return deep;
    }
  }
  return brandPalette.ink;
}

function swatch(base: string) {
  return { base, soft: softOf(base), deep: deepOf(base) };
}

const slots = {
  fresa: swatch(brandPalette.primary),
  limonada: swatch(brandPalette.secondary),
  lavanda: swatch(brandPalette.tertiary),
  cielo: swatch(brandPalette.quaternary),
  melocoton: swatch(brandPalette.quinary),
  menta: swatch(brandPalette.positive),
  tomate: swatch(brandPalette.negative)
};

const paperDeep = mix(brandPalette.paper, brandPalette.sand, 0.4);
const dot = mix(brandPalette.paper, brandPalette.sand, 0.85);

export const primitiveColorTokens = {
  // Tinta y papel
  ink: brandPalette.ink,
  inkSoft: brandPalette.inkSoft,
  inkFaint: brandPalette.inkFaint,
  paper: brandPalette.paper,
  paperDeep,
  dot,
  white: "#FFFFFF",

  // Rotuladores (ver `brandPalette` para el rol de cada ranura)
  fresa: slots.fresa.base,
  fresaSoft: slots.fresa.soft,
  fresaDeep: slots.fresa.deep,
  menta: slots.menta.base,
  mentaSoft: slots.menta.soft,
  mentaDeep: slots.menta.deep,
  lavanda: slots.lavanda.base,
  lavandaSoft: slots.lavanda.soft,
  lavandaDeep: slots.lavanda.deep,
  limonada: slots.limonada.base,
  limonadaSoft: slots.limonada.soft,
  limonadaDeep: slots.limonada.deep,
  cielo: slots.cielo.base,
  cieloSoft: slots.cielo.soft,
  cieloDeep: slots.cielo.deep,
  melocoton: slots.melocoton.base,
  melocotonSoft: slots.melocoton.soft,
  melocotonDeep: slots.melocoton.deep,
  tomate: slots.tomate.base,
  tomateSoft: slots.tomate.soft,
  tomateDeep: slots.tomate.deep,

  // Velos (tinta translúcida) para fondos de modales y lectura sobre foto
  scrim: `rgba(${parseHex(brandPalette.ink).join(", ")}, 0.45)`,
  scrimStrong: `rgba(${parseHex(brandPalette.ink).join(", ")}, 0.72)`,

  /** @deprecated alias del tema neobrutal anterior; usar los tonos de arriba. */
  cloud: paperDeep,
  /** @deprecated */
  mist: dot,
  /** @deprecated */
  blue: slots.lavanda.deep,
  /** @deprecated */
  blueDark: brandPalette.ink,
  /** @deprecated */
  red: slots.tomate.base,
  /** @deprecated */
  pink: slots.fresa.base,
  /** @deprecated */
  yellow: slots.limonada.base,
  /** @deprecated */
  green: slots.menta.base,
  /** @deprecated */
  purple: slots.lavanda.base,
  /** @deprecated */
  orange: slots.melocoton.base,
  /** @deprecated */
  slate50: brandPalette.paper,
  /** @deprecated */
  slate100: paperDeep,
  /** @deprecated */
  slate300: dot,
  /** @deprecated */
  slate500: brandPalette.inkFaint,
  /** @deprecated */
  slate700: brandPalette.inkSoft,
  /** @deprecated */
  slate900: brandPalette.ink,
  /** @deprecated */
  blue600: slots.lavanda.deep,
  /** @deprecated */
  blue700: brandPalette.ink,
  /** @deprecated */
  red600: slots.tomate.deep,
  /** @deprecated */
  amber500: slots.limonada.base,
  /** @deprecated */
  emerald600: slots.menta.deep
} as const;

export type PastelName = "fresa" | "menta" | "lavanda" | "limonada" | "cielo" | "melocoton" | "tomate";

export interface PastelSwatch {
  fill: string;
  soft: string;
  deep: string;
}

export const pastelSwatches: Record<PastelName, PastelSwatch> = {
  fresa: { fill: primitiveColorTokens.fresa, soft: primitiveColorTokens.fresaSoft, deep: primitiveColorTokens.fresaDeep },
  menta: { fill: primitiveColorTokens.menta, soft: primitiveColorTokens.mentaSoft, deep: primitiveColorTokens.mentaDeep },
  lavanda: {
    fill: primitiveColorTokens.lavanda,
    soft: primitiveColorTokens.lavandaSoft,
    deep: primitiveColorTokens.lavandaDeep
  },
  limonada: {
    fill: primitiveColorTokens.limonada,
    soft: primitiveColorTokens.limonadaSoft,
    deep: primitiveColorTokens.limonadaDeep
  },
  cielo: { fill: primitiveColorTokens.cielo, soft: primitiveColorTokens.cieloSoft, deep: primitiveColorTokens.cieloDeep },
  melocoton: {
    fill: primitiveColorTokens.melocoton,
    soft: primitiveColorTokens.melocotonSoft,
    deep: primitiveColorTokens.melocotonDeep
  },
  tomate: { fill: primitiveColorTokens.tomate, soft: primitiveColorTokens.tomateSoft, deep: primitiveColorTokens.tomateDeep }
};
