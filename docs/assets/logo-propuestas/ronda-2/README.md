# Logo de Cherry: ronda 2

Son cuatro alternativas a la propuesta 1, Guinda, que fue la elegida. Todas mantienen lo que gustó:

- todo en minúsculas;
- dos «r» y dos cerezas;
- cada cereza forma parte de su «r».

Lo que cambia es la forma de integrar las cerezas. Ahora tienen volumen (base coral, sombra roja, brillo y hoyuelo) y están más trabajadas que la bola terminal plana de la 1.

Vista conjunta, con la 1 original como referencia: [`resumen.png`](resumen.png).

Cada carpeta contiene estos archivos:

- `logo.svg`: logo en color, con el texto convertido en contornos;
- `logo-mono.svg`: logo en una tinta (#1D1426);
- `icon.svg`: icono en un cuadrado redondeado de 1024 px;
- `lamina.png`: lámina con el logo grande, la versión mono, el icono a 512 y 48 px y el logo a unos 24 px de alto.

| | Nombre | Fuente (SIL OFL 1.1) | Idea | Volumen |
|---|---|---|---|---|
| 1a | **Asoma** | Fraunces, instancia wght 900 · opsz 144 · SOFT 0 | Las cerezas asoman por detrás del hombro de cada «r». Un hueco de color de fondo separa la letra de la fruta, así que la «r» la tapa de verdad. | La profundidad sale de las capas (cereza detrás, letra delante) y de la sombra dura en tinta. |
| 1b | **Farol** | Fraunces, instancia wght 800 · opsz 144 · SOFT 50 | El hombro de la «r» se redibuja como un trazo afinado que hace de rabito y termina colgando una cereza. La letra y la fruta son la misma línea. | Sombra desplazada en lavanda, como una segunda tinta de risografía. |
| 1c | **Corona** | Fraunces, instancia wght 900 · opsz 144 · SOFT 100 · WONK 1 | Cada cereza se apoya encima del asta de su «r», como una pegatina con borde de papel, y los rabitos se unen arriba en una hoja. | Borde de papel más una sombra de pegatina, que la despegan de la letra. |
| 1d | **Abrazo** | Fraunces, instancia wght 900 · opsz 144 · SOFT 100 | El brazo de la «r» se alarga y se curva por delante de la cereza para sujetarla. | Letras amarillas con contorno y extrusión de tinta, al estilo de un rótulo. |

## Puntos fuertes y débiles

- **1a Asoma.** Es la idea de la propietaria, «por detrás», resuelta con profundidad real. Es limpia y se lee bien a 24 px, y el icono «rr» sobre amarillo funciona muy bien. Sus puntos débiles:
  - los rabitos son finos a tamaños muy pequeños.
- **1b Farol.** Es la integración más original, porque la letra se convierte en el rabito. Sus puntos débiles:
  - la palabra es más ancha por el espaciado extra;
  - la sombra lavanda resta contraste en pequeño.
- **1c Corona.** Las cerezas tienen mucha presencia y transmiten mucha simpatía. Sus puntos débiles:
  - a tamaños pequeños las cerezas dominan sobre la palabra;
  - parecen más «puestas encima» que integradas.
- **1d Abrazo.** Es la más rotulada y expresiva en grande. Sus puntos débiles:
  - a 24 px se empasta por la extrusión y el amarillo;
  - es la más difícil de llevar a una sola tinta.

## Exploraciones descartadas

- **Calco**: cerezas sobreimpresas en XOR. No se podía leer.
- **Entrelazo**: brazo y cereza tejidos. La bola de Fraunces se leía como una segunda bola amarilla.
- **Lazo**: ligadura «rr». Las «r» se leían como una «f» o una barra.

## Cómo regenerar

Las fuentes descargadas, las instancias de Fraunces y los scripts no están en el repositorio.

Para regenerarlo todo:

```
node scripts/r2a.js
node scripts/r2b.js
node scripts/r2c.js
node scripts/r2d.js
node scripts/resumen2.js
```

Las herramientas son opentype.js y paper.js para las formas y Chrome headless para las láminas.
