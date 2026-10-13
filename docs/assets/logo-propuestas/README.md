# Propuestas de logo para Cherry

Seis wordmarks nuevos con las cerezas integradas en las letras. Cada carpeta trae:

- `logo.svg`: logo a color.
- `logo-mono.svg`: monocromo en tinta.
- `icon.svg`: icono de app de 1024 × 1024.
- `lamina.png`: lámina con el logo, el monocromo, el icono a 512, 48 y 29 px y el logo a 24 y 40 px de alto.

`resumen.png` reúne las seis.

En los SVG todo el texto está convertido a trazados: no dependen de ninguna fuente instalada. Las letras salen de la fuente indicada, pero cada propuesta lleva retoques a mano: kerning, cortes, ligaduras y formas redibujadas. Paleta de la app: tinta `#1D1426`, papel `#FAF6F0`, coral, amarillo, lavanda, cielo, lima y menta.

Todas las fuentes son SIL Open Font License 1.1, compatibles con AGPL y con redistribuir los dibujos bajo CC BY-SA. Se descargaron de [google/fonts](https://github.com/google/fonts/tree/main/ofl) y no están en el repositorio.

| # | Nombre | Tipografía (carpeta en google/fonts) | Licencia |
|---|---|---|---|
| 1 | Guinda | Fraunces, instancia Black · SOFT 100 · opsz 144 (`ofl/fraunces`) | OFL 1.1 |
| 2 | Guiño | Shrikhand (`ofl/shrikhand`) | OFL 1.1 |
| 3 | Ojo | Bricolage Grotesque, ExtraBold · wdth 75 · opsz 96 (`ofl/bricolagegrotesque`) | OFL 1.1 |
| 4 | Plantilla | Dela Gothic One (`ofl/delagothicone`) | OFL 1.1 |
| 5 | Rama | Gloock (`ofl/gloock`) | OFL 1.1 |
| 6 | Colgantes | Bagel Fat One (`ofl/bagelfatone`) | OFL 1.1 |

## 1 · Guinda

- **Cerezas:** las bolas terminales de las dos «r» se convierten en las cerezas. Los rabitos salen de ellas y se juntan arriba en una hoja.
- **Por qué funciona:** la cereza ya estaba escondida en la letra, porque Fraunces Soft tiene remates de bola. Tiene el calor de una Cooper (la familia de Mailchimp) sin copiarla. A 24 px se lee entero.
- **Puntos débiles:** es la más clásica, y el rabito alto le da mucha altura al conjunto. El icono «rr» es algo denso a 29 px.

## 2 · Guiño

- **Cerezas:** la cola de la «y» sigue en una rúbrica que subraya la palabra. En su extremo cuelga el par de cerezas.
- **Por qué funciona:** tiene actitud de cartel de los 70, coqueta y con mucha voz. Las letras coral con contorno y sombra dura de tinta encajan con el neobrutalismo de la app.
- **Puntos débiles:** las cerezas bajo la palabra hacen el logo alto, así que a 24 px las letras quedan pequeñas. El icono no lleva letra y se acerca al emoji 🍒. La «y» pierde su gancho original y se lee gracias a la rúbrica.

## 3 · Ojo

- **Cerezas:** la «e» es una cereza redonda entre letras estrechas. Su ojo es la contraforma, el rabito y la hoja salen de arriba, y un brillo la remata.
- **Por qué funciona:** es una sola letra que es a la vez fruta, y una sola idea muy clara. El contraste entre la bola y la grotesca condensada se ve desde lejos. El icono es el más fuerte de los seis: se lee a 29 px.
- **Puntos débiles:** solo hay una cereza, no el par de Mochi. La ranura de la «e» puede leerse como una boca: puede ser un guiño, o puede distraer.

## 4 · Plantilla

- **Cerezas:** las contraformas de las dos «R» son las cerezas. Los rabitos se cortan en negativo a través de las letras, como en una plantilla de estarcido, y salen a juntarse en la hoja.
- **Por qué funciona:** aquí el espacio negativo hace el trabajo, como la flecha de FedEx. Las mayúsculas anchas se leen perfectas a 24 px. En el icono los rabitos dejan ver el color del fondo.
- **Puntos débiles:** es la más seria y la menos kawaii, y su calidez depende casi solo del color. Las cerezas son pequeñas frente a la masa de las letras.

## 5 · Rama

- **Cerezas:** el remate de la «h» brota como una rama que sustituye el espolón superior de la «C», así que forma una ligadura «Ch». De la rama cuelga el par de cerezas, dentro del hueco de la C.
- **Por qué funciona:** es la más adulta y editorial: una serifa de alto contraste, como de revista. La C hace de nido y el monograma «Ch» sirve como icono.
- **Puntos débiles:** los rabitos son finos y casi desaparecen por debajo de 40 px; quedan las bolas. Es la que menos casa con el neobrutalismo y necesitaría una versión con trazos más gruesos para la interfaz.

## 6 · Colgantes

- **Cerezas:** las dos «r» hacen de rabitos. Sus astas siguen por debajo de la línea base y de ellas cuelgan las cerezas, como pendientes.
- **Por qué funciona:** es la más juguetona y pegatina, la más cercana a Mochi. La idea se entiende en un segundo.
- **Puntos débiles:** es la que más se acerca a lo infantil, sobre todo con lavanda y lima. Con el contorno, a 24 px las letras se empastan. Hubo que abrir a mano el ojo de la «e» de Bagel y recortar la sombra para que no se cegara.

## Regenerar

Los scripts (Node con opentype.js y paper.js, y Chrome sin interfaz para las láminas) y las fuentes descargadas están fuera del repositorio, en la carpeta de trabajo temporal. Si una propuesta sigue adelante, habría que llevar su script al repositorio y documentar la fuente (`.ttf` y `OFL.txt`) en la carpeta donde se guarde.
