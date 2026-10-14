---
name: Cherry
description: App de citas con forma de libreta: neobrutalismo kawaii para adultos sobre papel de puntos.
colors:
  ink: "#1D1426"
  inkSoft: "#5E5468"
  inkFaint: "#726980"
  paper: "#FAF6F0"
  paperDeep: "#F1EAE0"
  dot: "#E6DDCE"
  white: "#FFFFFF"
  fresa: "#FF6B57"
  fresaSoft: "#FFDBD7"
  fresaDeep: "#BD240F"
  menta: "#62D98C"
  mentaSoft: "#D9F6E3"
  mentaDeep: "#1E7A3E"
  lavanda: "#A58BFF"
  lavandaSoft: "#E9E3FF"
  lavandaDeep: "#663FEF"
  limonada: "#FFC53D"
  limonadaSoft: "#FFF1D0"
  limonadaDeep: "#89630B"
  cielo: "#5EC0FF"
  cieloSoft: "#D8F0FF"
  cieloDeep: "#0E6EAC"
  melocoton: "#B9E53C"
  melocotonSoft: "#EEF9D0"
  melocotonDeep: "#59730F"
  tomate: "#F2544F"
  tomateSoft: "#FCD6D5"
  tomateDeep: "#C11510"
  scrim: "rgba(29, 20, 38, 0.45)"
typography:
  hero:
    fontFamily: "Rubik-Black"
    fontSize: "40px"
    fontWeight: 900
    lineHeight: "48px"
    letterSpacing: "-1px"
  title1:
    fontFamily: "Rubik-Black"
    fontSize: "30px"
    fontWeight: 900
    lineHeight: "37px"
    letterSpacing: "-0.7px"
  title2:
    fontFamily: "Rubik-Black"
    fontSize: "24px"
    fontWeight: 900
    lineHeight: "30px"
    letterSpacing: "-0.4px"
  title3:
    fontFamily: "Rubik-Black"
    fontSize: "19px"
    fontWeight: 900
    lineHeight: "24px"
    letterSpacing: "-0.2px"
  numeral:
    fontFamily: "Rubik-Black"
    fontSize: "22px"
    fontWeight: 900
    lineHeight: "27px"
  body:
    fontFamily: "Rubik-Regular"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "23px"
  bodyStrong:
    fontFamily: "Rubik-Bold"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: "23px"
  callout:
    fontFamily: "Rubik-Regular"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "21px"
  label:
    fontFamily: "Rubik-Bold"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: "20px"
  caption:
    fontFamily: "Rubik-Medium"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
  button:
    fontFamily: "Rubik-ExtraBold"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: "22px"
  buttonSmall:
    fontFamily: "Rubik-Bold"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: "20px"
  hand:
    fontFamily: "Rubik-Medium"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: "24px"
  stamp:
    fontFamily: "Rubik-Black"
    fontSize: "24px"
    fontWeight: 900
    lineHeight: "30px"
    letterSpacing: "0.5px"
rounded:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "22px"
  xl: "28px"
  pill: "999px"
spacing:
  xxs: "2px"
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "40px"
  xxxl: "56px"
components:
  button-primary:
    backgroundColor: "{colors.fresa}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "52px"
  button-primary-lg:
    backgroundColor: "{colors.fresa}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 28px"
    height: "60px"
  button-primary-sm:
    backgroundColor: "{colors.fresa}"
    textColor: "{colors.ink}"
    typography: "{typography.buttonSmall}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "52px"
  button-soft:
    backgroundColor: "{colors.lavandaSoft}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "52px"
  button-danger:
    backgroundColor: "{colors.tomate}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "52px"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 22px"
    height: "52px"
  button-ghost:
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    padding: "0 13px"
    height: "52px"
  button-disabled:
    backgroundColor: "{colors.paperDeep}"
    textColor: "{colors.inkFaint}"
    rounded: "{rounded.pill}"
    height: "52px"
  icon-button-md:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "48px"
  icon-button-like:
    backgroundColor: "{colors.fresa}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "76px"
  icon-button-pass:
    backgroundColor: "{colors.lavanda}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "64px"
  tag-sticker-neutral:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 13px"
    height: "40px"
  tag-sticker-selected:
    backgroundColor: "{colors.menta}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "40px"
  tag-sticker-shared:
    backgroundColor: "{colors.limonada}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "40px"
  tag-sticker-blocked:
    backgroundColor: "{colors.tomateSoft}"
    textColor: "{colors.tomateDeep}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "40px"
  tag-sticker-muted:
    backgroundColor: "{colors.paperDeep}"
    textColor: "{colors.inkSoft}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "40px"
  pill:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "28px"
  text-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 16px"
  text-field-focus:
    backgroundColor: "{colors.limonadaSoft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  text-field-error:
    backgroundColor: "{colors.tomateSoft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  surface:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
  list-section:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  segmented-control:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "48px"
  segmented-control-thumb:
    backgroundColor: "{colors.limonada}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
  tab-bar:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "72px"
  sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "8px 20px"
  toast:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.bodyStrong}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
---

# Design System: Cherry

## Overview

**Creative North Star: "La libreta, en serio"**

Cherry es neobrutalismo sobrio con color, para adultos (hombres y mujeres, 18+): papel blanco roto con trama de puntos, tinta ciruela para contornos, texto y sombras duras sin desenfoque, y siete rotuladores de saturación igualada que siempre llevan tinta encima. El diseño es duro y ordenado; el color pone la alegría. Cada perfil sigue siendo una página de libreta (fotos en polaroid con washi, etiquetas, sellos), pero sin nada aniñado: ni letra manuscrita, ni coloretes, ni rosa por todas partes. La app tiene que sentirse física: las cosas se pegan, se sellan y se hunden en su sombra al pulsarlas.

La densidad es de app móvil tranquila: una columna, márgenes de 24, grupos separados por aire y por líneas discontinuas de libreta, nunca por cajas dentro de cajas. La decoración (washi, la mascota, pegatinas) vive en los bordes de las piezas y jamás tapa caras ni texto. Cada pantalla tiene como mucho un momento de autor (un sello, una celebración); el resto es movimiento de sistema.

Se rechaza de forma explícita el arquetipo del sector: foto a sangre con degradado oscuro encima e interfaz blanca genérica. La foto siempre va enmarcada (polaroid, recorte con contorno), nunca a sangre. Este fichero es el registro canónico de tokens y reglas visuales; la API de cada pieza vive en `src/shared/ui/DS_READY.md` y `src/shared/ui/art/README.md`.

**Key Characteristics:**
- Papel blanco roto con trama de puntos arena a pantalla completa como fondo de todo; no se tiñe (tampoco en el onboarding: cada paso cambia de color de acento, no de papel).
- Contorno de tinta de 2–3 px en todo lo que es una pieza; sombra dura de tinta desplazada hacia abajo a la derecha.
- Color de relleno, tinta de texto: nunca texto blanco sobre color.
- Una sola familia, Rubik: Black para titulares (interletraje cerrado), Regular/Medium/Bold/ExtraBold para la interfaz.
- Titulares del onboarding con la última palabra marcada con rotulador (fondo del color de acento del paso).
- Pegatinas, washi, sellos, notas adhesivas y polaroids como gramática de componentes, no como adorno suelto.
- La mascota (dos cerezas de un mismo rabito, provisional hasta el icono definitivo) acompaña vacíos, esperas, errores y celebraciones.
- Kawaii para adultos: nada de brillos de gominola, coloretes, lengüitas ni «¡hola!» manuscritos; la app no lleva eslóganes ni promesas comerciales (gratis, sin muros de pago, código abierto…), eso vive en el marketing.

## Colors

Un papel blanco roto, una tinta ciruela y siete rotuladores de saturación igualada. **Para cambiar colores se edita solo `brandPalette` en `src/shared/ui/tokens/primitives/color.ts`**: cada rol ocupa una ranura con nombre histórico (fresa, limonada…) que usan los componentes, y los tonos `Soft` (fondos, estados suaves) y `Deep` (texto de acento, ≥ 4.5:1 sobre papel y sobre su `Soft`) se derivan solos.

| Rol (`brandPalette`) | Ranura | Uso |
|---|---|---|
| `primary` coral | `fresa` | Marca y acción principal: botones primarios, «me gusta», pestaña Descubrir, burbuja propia, logo. |
| `secondary` girasol | `limonada` | Lo destacado y lo compartido: etiquetas en común, deshacer, pestaña Likes, foco de campos. |
| `tertiary` lavanda | `lavanda` | El «no» amable («paso»), `soft`, pestaña Yo, skeletons. |
| `quaternary` cielo | `cielo` | Información, pestaña Chats. |
| `quinary` lima | `melocoton` | Toque extra: categorías y acentos de pasos del onboarding. |
| `positive` menta | `menta` | «Me gusta» en etiquetas, lo elegido y lo correcto, éxito. |
| `negative` rojo | `tomate` | Bloqueo, peligro y errores. |

Cada categoría del catálogo de etiquetas tiene su color fijo (`semantic.category`); en el onboarding cada paso tiene su color de acento (`STEP_TONES`), evitando menta y tomate porque significan «me gusta» y «bloqueo».

### Neutral
- **Tinta ciruela** (`ink`): texto por defecto, todos los contornos, todas las sombras duras, iconos. Es el único «negro» del sistema.
- **Tinta suave** (`inkSoft`): texto secundario (subtítulos, descripciones de filas).
- **Tinta tenue** (`inkFaint`): placeholders, notas terciarias y el contorno de lo deshabilitado; cumple ≥ 4.5:1 sobre papel.
- **Papel blanco roto** (`paper`): fondo de pantalla y de las hojas inferiores.
- **Papel hondo** (`paperDeep`): superficies hundidas, relleno de lo deshabilitado y de las pegatinas `muted`.
- **Punto de libreta** (`dot`): la trama del papel y los separadores sutiles.
- **Blanco** (`white`): cara de tarjetas, campos, botones secundarios, barra de pestañas y el anillo troquelado de las pegatinas. Solo lleva texto blanco encima la variante `ink` del botón.
- **Velo** (`scrim`): tinta translúcida bajo hojas y modales.

### Named Rules
**The Tinta Encima Rule.** Sobre cualquier relleno pastel el texto y los iconos son `ink` (o el `Deep` del mismo pastel). Nunca texto blanco sobre pastel. El único texto blanco del sistema va sobre `ink`.

**The Three Tones Rule.** Un color se usa en sus tres tonos (derivados de su base): base = relleno de piezas, `Soft` = fondos y estados suaves, `Deep` = texto de acento. No se inventan tonos intermedios salvo el tinte neutral de las pegatinas de categoría (mezcla 45 % entre `Soft` y base, calculada en el componente).

**The Color Is Never Alone Rule.** El estado nunca depende solo del color: la pegatina elegida lleva ♥, la bloqueada rayas + ✕ + tachado, la compartida un destello, la no disponible contorno a trazos; los errores sacuden el campo y se anuncian.

**The Tokens Only Rule.** Todo color sale de `useTheme()`. Los únicos hex sueltos admitidos son las marcas de terceros (el logotipo de Google y el botón de Apple en el login).

**The Welcome Exception.** El login es la única pantalla sin neobrutalismo: fondo amarillo (`limonada`) con una luz suave detrás de Mochi enamorada (el logo), hoja blanca abajo, botones de proveedor con sombras suaves y sin contornos de tinta. El resto de la app sigue la libreta.

## Typography

**Familia única:** Rubik (`Rubik-Regular | Medium | Bold | ExtraBold | Black`), subconjunto latino en `assets/fonts/`.

**Character:** grotesca redondeada con peso: en Black da titulares compactos y contundentes (neobrutalismo), en Regular/Medium se lee tranquila. Los interlineados cubren el ascendente y descendente de Rubik (≈ 1.19 em) para que «¿», «¡» y las tildes nunca se recorten en Android.

### Hierarchy
- **Hero** (Black, 40/48, −1): una sola vez por pantalla, en momentos de marca (celebración de match).
- **Title 1** (Black, 30/37, −0.7): título de pestaña y preguntas del onboarding (última palabra con rotulador).
- **Title 2** (Black, 24/30, −0.4): títulos de sección grandes, nombre y edad en la pegatina de la polaroid.
- **Title 3** (Black, 19/24, −0.2): encabezados de sección y de categoría, título de `TopBar` normal.
- **Numeral** (Black, 22/27): contadores grandes.
- **Body** (Regular, 16/23) y **Body Strong** (Bold, 16/23): texto corrido y énfasis.
- **Callout** (Regular, 15/21): subtítulos y avisos.
- **Label** (Bold, 15/20): pegatinas, segmentos, rótulos de campo.
- **Caption** (Medium, 13/18): descripciones, contadores, ayudas.
- **Button** (ExtraBold, 17/22) y **Button Small** (Bold, 15/20).
- **Hand** (Medium, 17/24): variante heredada; ya no hay letra manuscrita.
- **Stamp** (Black, 24/30, +0.5, mayúsculas): solo en los sellos («¡ME GUSTA!», «PASO», «¡MATCH!»).

### Named Rules
**The Family Is The Weight Rule.** Nunca `fontWeight` con estas fuentes: en Android cada peso es otra familia. Se elige la variante de `<Text variant=…>` (o la familia del peso); el `fontWeight` del frontmatter es solo descriptivo.

**The Black Speaks Once Rule.** Rubik Black es para titulares, números y sellos. El texto de interfaz, los botones y las pegatinas van en los pesos de interfaz.

**The No Kicker Rule.** No hay antetítulos en versalitas encima de los titulares: una sección se encabeza con su título en Rubik Black (y, en categorías, con un cuadradito del color de la categoría), nunca con una etiqueta gris en mayúsculas.

## Layout

Una columna por pantalla con margen lateral de 24 (`spacing.lg`, `semantic.layout.screenPadding`) sobre el papel de puntos; el contenido se limita a 720 de ancho (`size.contentMax`) y la barra de pestañas y los toasts a 480. El ritmo vertical entre bloques de una pantalla es 24 (`gap` por defecto de `Screen`); dentro de un grupo, 16; entre pegatinas o chips en fila, 8 (`Inline`). Las listas y ajustes se agrupan en tarjetas (`ListSection`) separadas por líneas discontinuas de libreta, no por tarjetas anidadas.

Todo va dentro de `Screen`, que pone el papel, respeta las safe areas, sube con el teclado y fija un pie opcional para los CTA (el botón principal va abajo, a lo ancho, en tamaño `lg`). En las pestañas, la barra flotante tipo pastilla (alto 72, separada 16 de los lados y al menos 12 del borde inferior) se superpone al contenido, que se desplaza por detrás; `useTabBarSpace()` reserva su hueco. Objetivos táctiles de al menos 48 (`size.touchTarget`); lo que es más pequeño a la vista (pegatinas `sm`, botones `sm`) amplía su área con `hitSlop`.

Las piezas pueden girarse ligeramente (entre −3° y 3°: pegatinas, notas adhesivas, polaroids de la lista de likes) para que la página parezca pegada a mano; los controles de formulario y las filas de lista van rectos.

## Elevation & Depth

La profundidad es neobrutal y física: una sola sombra dura de tinta, desplazada abajo a la derecha, sin desenfoque. No hay sombras difusas ni capas tonales. Cada pieza tiene exactamente una elevación, proporcional a su tamaño, y la sombra comparte el radio de la cara. Al pulsar, la cara se desplaza hacia su sombra hasta taparla (`spring.snappy`) y vuelve al soltar; lo deshabilitado queda «pegado al papel», sin sombra, y al habilitarse sube con `spring.pop`. El botón `ink` es la única pieza cuya sombra es pastel en lugar de tinta.

### Shadow Vocabulary
- **Roce** (`xs`, 1 px): insignias `Pill` y detalles diminutos.
- **Pegada** (`sm`, 2 px): pegatinas `sm`/`md`, botones `sm`, botones de icono `sm`, conmutador segmentado, pestaña activa, campos en reposo.
- **Tarjeta** (`md`, 4 px): tarjetas, filas agrupadas, botones `md`/`lg`, botones de icono `md`/`lg`, pegatinas `lg`, barra de pestañas, campos enfocados (la sombra crece de 2 a 4 al enfocar).
- **Protagonista** (`lg`, 6 px): la polaroid de Descubrir y del perfil, el botón de «me gusta» `xl`.

### Named Rules
**The One Elevation Rule.** Una pieza, una sombra dura. Nunca se suma una sombra difusa, un brillo o un segundo contorno para «levantar» algo más.

**The Sink Into Shadow Rule.** Todo lo pulsable con sombra se hunde hacia ella al tocarlo (`PressableScale` o los componentes del sistema); no se reinventa el feedback de pulsación con opacidad.

**The Sibling Shadow Rule.** La sombra es una vista hermana detrás de la cara (un `View` de tinta, desplazado N px abajo a la derecha, con el mismo radio), nunca `boxShadow`: en Android (Fabric) `boxShadow` es caro de pintar y el mazo de Descubrir iba a tirones (78 % de frames lentos con él, 55 % sin él). Se usa `HardShadow` (reparte el estilo entre la caja exterior —márgenes, posición, tamaño, flex, giro, opacidad— y la cara), `PressableScale` para lo pulsable o `HardShadowLayer` dentro de piezas propias. La sombra queda fuera del recorte de una cara con `overflow: hidden` y gira con ella. Los tokens `elevation.*` con `boxShadow` quedan solo por compatibilidad: no se esparcen en estilos.

## Shapes

Formas redondas y amables con contorno de rotulador. El contorno es siempre `ink` y su grosor depende del tamaño: superficies grandes (tarjetas, hojas, barra de pestañas, botones `lg`, botones de icono `lg`/`xl`) llevan `border.bold` (3); los controles (botones `md`/`sm`, campos, pegatinas `md`/`lg`, conmutador, interruptor) `border.regular` (2.5); los detalles pequeños (insignias, contadores, pegatinas `sm`, círculos de icono) `border.thin` (2).

Radios: las tarjetas van entre `md` (16) y `lg` (22); las hojas inferiores `xl` (28) arriba; los sellos rectangulares `xs` (6) en el borde interior. La pastilla (`pill`) queda reservada a botones, botones de icono (círculos), pegatinas, insignias, el conmutador y la barra de pestañas. Las líneas separadoras son discontinuas, como el rayado de una libreta; el contorno a trazos también marca huecos vacíos (ranuras de fotos y de etiquetas por rellenar) y lo no disponible.

Siluetas propias del mundo: la pegatina troquelada (contorno de tinta + anillo blanco + impresión pastel), la tira de washi con extremos en zigzag, la nota adhesiva con esquina doblada, la polaroid más ancha abajo, el sello de goma de doble borde (interior discontinuo) y los destellos de cuatro puntas. La ilustración es SVG geométrico y nítido, sin trazos «sketch» ni texturas de ruido.

## Components

### Buttons
Gordos, en pastilla, con contorno y sombra dura; se hunden al pulsar.
- **Shape:** pastilla (`rounded.pill`); alto 60 / 52 / 40 (`lg` / `md` / `sm`); contorno 3 en `lg`, 2.5 en `md`/`sm`.
- **Primary:** relleno fresa (o el pastel que se indique), texto tinta; el CTA de pantalla va en el pie, a lo ancho, en `lg`.
- **Secondary:** cara blanca con el mismo contorno y sombra (p. ej. «Continuar con Google», «Seguir mirando»).
- **Soft / Danger / Ink:** lavanda suave; tomate con texto tinta; tinta con texto blanco y sombra pastel.
- **Ghost:** solo texto tinta subrayado, sin contorno ni sombra («Ahora no», «¿No es tu cuenta? Salir»).
- **Pressed / Loading / Disabled:** se hunde hacia la sombra; al cargar muestra puntitos que rebotan sin cambiar de tamaño; deshabilitado pasa a papel hondo con contorno y texto `inkFaint`, sin sombra.

### Icon buttons
- **Style:** círculo con contorno de tinta y sombra dura; 40 / 48 / 64 / 76 (`sm` / `md` / `lg` / `xl`), blanco por defecto.
- **Acciones de decisión:** ✕ lavanda `lg`, ↺ limonada `md` (deshacer), ♥ fresa `xl` con el corazón relleno en blanco. Siempre con `accessibilityLabel`.
- **Pressed:** se hunde, se aplasta un poco y vuelve con rebote.

### Chips (TagSticker, el componente estrella)
- **Style:** pegatina troquelada: contorno de tinta, anillo blanco y una impresión pastel dentro, con sombra dura; alto 32 / 40 / 50; emoji de la etiqueta + nombre en `label`.
- **State:** neutral blanco o teñido con el pastel de su categoría y un «+» (para que el ancho no salte); seleccionada menta con ♥; en común limonada con destello; bloqueada tomate suave con rayas, ✕ y tachado; no disponible (`muted`) a trazos y sin sombra. Al cambiar de estado hace pop (se despega y se pega) con háptico de selección.
- La pastilla plana (`diecut={false}`) queda solo para huecos muy apretados.

### Ficha de etiqueta con +/− (elegir y bloquear en una sola página)
- **Rejilla** de dos columnas iguales (celdas al 50 % con 8 de hueco); las dos fichas de una fila miden lo mismo.
- **Ficha:** alto mínimo 68, radio 12, contorno fino; emoji arriba y nombre en Bold 13 (hasta dos líneas) a la izquierda; a la derecha dos teclas apiladas de 28: **+** arriba (me gusta) y **−** abajo (bloquear).
- **Estados:** neutral blanca y sin sombra; me gusta menta con la tecla + en tinta y ✓ menta; bloqueada tomate suave, nombre tachado en `tomateDeep` y la tecla − en tomate. Límites 8 y 5 con resumen fijo arriba («♥ 3/8 · ✕ 1/5»).

### Pills (insignias)
- **Style:** pastilla pequeña (24–28 de alto) con contorno fino, sombra de roce, icono + texto Rubik ExtraBold de 13 (11.5 en `sm`).
- **Vocabulario cerrado:** Nuevo (limonada, destello) · Te dio like (fresa, corazón) · En común (menta, etiqueta) · Un poco más lejos (cielo, pin). No se inventan insignias sueltas con texto libre.

### Cards / Containers
- **Corner Style:** `Surface` 16 (`md`); `Card` y grupos de lista 22 (`lg`).
- **Background:** blanco por defecto; cualquier pastel o su `Soft` para notas y avisos.
- **Shadow Strategy:** `md` por defecto; ver Elevation & Depth.
- **Border:** tinta `bold` (3).
- **Internal Padding:** 16 (`Surface`), 20 (`Card`), 12×16 en filas.
- Nunca se anidan tarjetas. Una tarjeta pulsable se hunde entera. Con `clip` recorta fotos y filas sin recortar la sombra.

### Inputs / Fields
- **Style:** cara blanca con contorno tinta 2.5, radio 16, sombra dura de 2; en `xl` (pregunta única del onboarding) contorno 3, radio 22, texto en Rubik Black.
- **Focus:** se «resalta» con el `Soft` de un pastel (limonada por defecto) y la sombra crece de 2 a 4.
- **Error / Disabled:** fondo tomate suave, contorno tomate `Deep`, sacudida y mensaje anunciado; contador de caracteres cuando hay `maxLength`. Placeholders en `inkFaint`.

### Navigation
- **Barra de pestañas:** pastilla flotante blanca (alto 72, contorno 3, sombra `md`). Cada pestaña es icono + rótulo `caption`; la activa se convierte en una pegatina pastel con contorno 2.5 y sombra `sm` que hace pop al entrar: Descubrir fresa, Likes limonada, Chats cielo, Yo lavanda. Contadores con `Badge` fresa.
- **TopBar:** sin cabecera nativa; botón de icono circular (atrás, cerrar, bajar) a la izquierda, título Rubik Black centrado o grande a la izquierda en pestañas, acciones circulares a la derecha.
- **SegmentedControl:** pastilla blanca con contorno y sombra `sm`, y un pulgar pastel (limonada por defecto) que se desliza con muelle; semántica de pestañas.

### Sheets, toasts y estados
- **Sheet:** hoja de papel con contorno 3 y radio 28 arriba, asa de pastilla, velo de tinta; se cierra deslizando, tocando el velo, con ✕ o con el atrás del sistema. `ConfirmSheet` añade la mascota y un par de botones.
- **Toast:** tarjeta con contorno 2.5, radio 22, sombra dura y círculo de icono blanco; el relleno sigue el tono con el pastel pleno (menta éxito, tomate error, cielo info, limonada aviso, fresa `love`, blanco neutro) y el texto va en tinta.
- **Estados:** carga con skeletons lavanda con brillo; vacío con la mascota y una acción útil; error que dice qué pasó y ofrece «Reintentar».

### Polaroid y papelería (signature)
La polaroid (marco blanco más ancho abajo, contorno 3, sombra `lg`, dos tiras de washi en las esquinas superiores) es la unidad de perfil: la foto va dentro, nunca a sangre; el nombre y la edad van en una pegatina Rubik Black que se sale por el borde inferior de la foto. La bio va en una nota adhesiva limonada con esquina doblada y tira de washi. Los sellos de goma («¡ME GUSTA!», «PASO», «¡MATCH!») aparecen en proporción al arrastre y caen de golpe (1.6 → 1). La mascota aparece en vacíos, esperas, errores, el login y las celebraciones, con un estado de ánimo acorde (en el icono y el login, ojos de corazón).

### Movimiento
Las pegatinas se despegan y se pegan (`spring.pop`: escala 1.12 → 1 con giro que se asienta), los sellos caen de golpe, el papel se desliza y asienta (`spring.soft`), los botones se hunden (`spring.snappy`), las celebraciones estallan en corazones y estrellas pastel (`spring.wobbly`, ~900 ms, ≤ 24 partículas). Con «reducir movimiento» todo pasa a fundidos cortos. Hápticos solo en momentos clave: etiqueta (selección), cruzar el umbral del swipe (ligero), like (medio), match (éxito).

**The Nothing Loops Forever Rule.** Ninguna animación decorativa se repite en bucle infinito: la mascota respira y parpadea un par de veces al aparecer y se queda quieta, las rayas de la barra de progreso avanzan al cambiar de paso y paran. Un bucle infinito repinta a 60 fps sin parar (medido: pestañas en reposo a ~60 fps) y hunde el rendimiento en Android. Solo los indicadores de carga (puntitos, skeletons) se repiten, y solo mientras algo carga.

## Do's and Don'ts

### Do:
- **Do** poner tinta (`ink`) encima de cualquier pastel y reservar el texto blanco para el botón `ink`.
- **Do** dar a cada pieza un contorno de tinta de 2, 2.5 o 3 según su tamaño y una única sombra dura de `xs` a `lg`.
- **Do** hundir hacia la sombra todo lo pulsable (`PressableScale`, `Button`, `IconButton`, `Surface onPress`).
- **Do** enmarcar las fotos (polaroid o recorte con contorno) y dejar la decoración en los bordes.
- **Do** usar solo el set SVG de `Icon`; el emoji aparece únicamente como contenido de las etiquetas y del texto que escribe la gente.
- **Do** acompañar cada estado de color con forma, icono o trazo (♥, ✕ + rayas, destello, trazo discontinuo).
- **Do** usar `<Text variant=…>` para todo texto.
- **Do** diseñar siempre carga, vacío (con la mascota), error (qué pasó + reintentar), deshabilitado y pulsado.

### Don't:
- **Don't** usar foto a sangre con degradado oscuro encima ni interfaz blanca genérica: es el arquetipo del sector que Cherry rechaza.
- **Don't** poner texto blanco sobre pastel.
- **Don't** usar sombras difusas, glassmorphism decorativo, texto con degradado o una segunda elevación sobre una pieza.
- **Don't** poner antetítulos en versalitas grises encima de los titulares.
- **Don't** anidar tarjetas ni usar pastillas para contenedores: la pastilla es de botones, pegatinas e insignias.
- **Don't** usar emoji como iconos de interfaz ni fuentes de iconos.
- **Don't** escribir hex sueltos ni `fontWeight`; todo sale de `useTheme()` y de las variantes de texto.
- **Don't** dibujar ilustración con trazo «sketch», garabatos o texturas de ruido: la ilustración es geométrica y nítida.
- **Don't** repartir efectos por toda la pantalla: un momento de autor por pantalla.
