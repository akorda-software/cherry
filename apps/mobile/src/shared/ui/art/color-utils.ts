/** Mezcla lineal de dos colores `#RRGGBB` (t = 0 → a, t = 1 → b). */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const k = Math.min(Math.max(t, 0), 1);
  const channel = (i: 0 | 1 | 2) => Math.round(pa[i] + (pb[i] - pa[i]) * k);
  return `#${[channel(0), channel(1), channel(2)].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** `#RRGGBB` con opacidad → `rgba(...)`. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.replace(/(.)/g, "$1$1") : value.slice(0, 6);
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Id estable y seguro para `url(#id)` en SVG (useId de React trae «:» o «»»). */
export function svgSafeId(prefix: string, reactId: string): string {
  return `${prefix}-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}
