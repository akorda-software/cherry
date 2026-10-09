# Fuentes

Rubik (SIL OFL 1.1) en cinco pesos estáticos, uno por familia porque en Android cada
peso es una familia distinta: `Rubik-{Regular,Medium,Bold,ExtraBold,Black}.ttf`.

Se generan a partir de la fuente variable de Google Fonts (`ofl/rubik/Rubik[wght].ttf`):
se instancia cada peso (400, 500, 700, 800, 900) con `fontTools.varLib.instancer`, se le
pone como nombre de familia `Rubik-<Peso>` y se reduce al subconjunto latino:

```
pyftsubset <fuente>.ttf --layout-features='*' \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0152-0153,U+2013-2014,U+2018-201E,U+2022,U+2026,U+20AC,U+2122,U+2190-2193,U+2605-2606,U+2661,U+2665,U+266A,U+2715,U+2764"
```
