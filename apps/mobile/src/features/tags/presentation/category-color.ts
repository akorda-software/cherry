import type { AppTheme, PastelName } from "../../../shared/ui";

/**
 * Pastel de una categoría del catálogo (`theme.semantic.category`) como
 * `PastelName`, que es lo que entienden `TagSticker` y `WashiTape`.
 */
export function categoryPastel(theme: AppTheme, category: string): PastelName | undefined {
  const swatch = (theme.semantic.category as Record<string, AppTheme["semantic"]["category"][keyof AppTheme["semantic"]["category"]] | undefined>)[category];

  if (!swatch) {
    return undefined;
  }

  return (Object.keys(theme.primitives.pastel) as PastelName[]).find(
    (name) => theme.primitives.pastel[name].fill === swatch.fill
  );
}
