# Fuentes

Subconjuntos (latín + Latin-1 + algunos símbolos: ★ ♥ ♪ ✕ … € ¡ ¿) generados con
`pyftsubset` a partir de Google Fonts, para no empaquetar varios MB de glifos CJK.

| Fichero | Familia | Uso | Licencia |
|---|---|---|---|
| `MochiyPopOne-Regular.ttf` | Mochiy Pop One | Titulares, sellos, números grandes | SIL OFL 1.1 |
| `MPLUSRounded1c-{Regular,Medium,Bold,ExtraBold,Black}.ttf` | M PLUS Rounded 1c | Interfaz y texto | SIL OFL 1.1 |
| `Yomogi-Regular.ttf` | Yomogi | Anotaciones manuscritas puntuales (≥ 18 pt) | SIL OFL 1.1 |

Se regeneran con `python3 build_fonts.py <dir-con-los-ttf-originales>` (requiere fonttools),
que además sustituye la elipsis «…» (centrada y a ancho completo en estas fuentes japonesas,
estilo «⋯») por tres puntos sobre la línea base: es el glifo que usan iOS/Android al truncar.

Rango usado:

```
pyftsubset <fuente>.ttf --layout-features='*' \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0152-0153,U+2013-2014,U+2018-201E,U+2022,U+2026,U+20AC,U+2122,U+2190-2193,U+2605-2606,U+2661,U+2665,U+266A,U+2715,U+2764"
```
