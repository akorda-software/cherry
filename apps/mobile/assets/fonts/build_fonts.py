#!/usr/bin/env python3
"""Regenera las fuentes de la app: subconjunto latino + elipsis en la línea base.

Uso (con fonttools instalado):
    python3 build_fonts.py <dir-con-los-ttf-originales-de-google-fonts>

1. Subconjunto: latín + Latin-1 + algunos símbolos (ver UNICODES) para no
   empaquetar varios MB de glifos CJK.
2. Elipsis: las tres familias son japonesas y dibujan «…» (U+2026) centrado y
   a ancho completo, al estilo «⋯». En español se ve raro y además es el glifo
   que usan iOS/Android al truncar texto (numberOfLines), así que se sustituye
   por un compuesto de tres puntos de la propia fuente sobre la línea base.
"""
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphComponent

FONTS = [
    "MochiyPopOne-Regular.ttf",
    "MPLUSRounded1c-Regular.ttf",
    "MPLUSRounded1c-Medium.ttf",
    "MPLUSRounded1c-Bold.ttf",
    "MPLUSRounded1c-ExtraBold.ttf",
    "MPLUSRounded1c-Black.ttf",
    "Yomogi-Regular.ttf",
]

UNICODES = (
    "U+0020-007E,U+00A0-00FF,U+0152-0153,U+2013-2014,U+2018-201E,U+2022,U+2026,"
    "U+20AC,U+2122,U+2190-2193,U+2605-2606,U+2661,U+2665,U+266A,U+2715,U+2764"
)

# Separación máxima entre puntos (unidades de 1000/em): evita elipsis
# kilométricas en fuentes casi monoespaciadas como Yomogi.
MAX_DOT_STEP = 330


def subset_font(source: Path, target: Path) -> None:
    options = subset.Options()
    options.layout_features = ["*"]
    font = subset.load_font(str(source), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=subset.parse_unicodes(UNICODES))
    subsetter.subset(font)
    subset.save_font(font, str(target), options)


def baseline_ellipsis(path: Path) -> None:
    font = TTFont(str(path))
    glyf = font["glyf"]
    hmtx = font["hmtx"]
    cmap = font.getBestCmap()
    period = cmap[0x2E]
    ellipsis = cmap[0x2026]

    period_advance, period_lsb = hmtx[period]
    step = min(period_advance, MAX_DOT_STEP)

    glyph = Glyph()
    glyph.numberOfContours = -1
    glyph.components = []
    for index in range(3):
        component = GlyphComponent()
        component.glyphName = period
        component.x = index * step
        component.y = 0
        component.flags = 0x4  # ROUND_XY_TO_GRID
        glyph.components.append(component)

    glyf[ellipsis] = glyph
    glyph.recalcBounds(glyf)
    hmtx[ellipsis] = (2 * step + period_advance, period_lsb)
    font.save(str(path))


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)

    source_dir = Path(sys.argv[1])
    target_dir = Path(__file__).resolve().parent

    for name in FONTS:
        target = target_dir / name
        subset_font(source_dir / name, target)
        baseline_ellipsis(target)
        print(f"{name}: {target.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
