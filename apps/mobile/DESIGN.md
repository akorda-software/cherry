---
name: Snack
description: App de citas gratuita y de código abierto con forma de libreta kawaii (neobrutalismo kawaii sobre papel de puntos).
colors:
  ink: "#2B1938"
  inkSoft: "#6B5680"
  inkFaint: "#7A6690"
  paper: "#FFF6FB"
  paperDeep: "#FBE9F3"
  dot: "#E9D5EC"
  white: "#FFFFFF"
  fresa: "#FF9EC7"
  fresaSoft: "#FFD6E8"
  fresaDeep: "#B0154F"
  menta: "#8FE3C0"
  mentaSoft: "#D2F6E7"
  mentaDeep: "#136E4D"
  lavanda: "#C3B1FF"
  lavandaSoft: "#E8E0FF"
  lavandaDeep: "#5B3FC4"
  limonada: "#FFE680"
  limonadaSoft: "#FFF5C7"
  limonadaDeep: "#7A5800"
  cielo: "#9FD3FF"
  cieloSoft: "#DCEFFF"
  cieloDeep: "#1A62A0"
  melocoton: "#FFBE98"
  melocotonSoft: "#FFE5D6"
  melocotonDeep: "#9E4018"
  tomate: "#FF8A7A"
  tomateSoft: "#FFD9D3"
  tomateDeep: "#B3261E"
  scrim: "rgba(43, 25, 56, 0.45)"
typography:
  hero:
    fontFamily: "MochiyPopOne"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: "46px"
    letterSpacing: "-0.4px"
  title1:
    fontFamily: "MochiyPopOne"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: "36px"
    letterSpacing: "-0.3px"
  title2:
    fontFamily: "MochiyPopOne"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: "30px"
    letterSpacing: "-0.2px"
  title3:
    fontFamily: "MochiyPopOne"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: "25px"
  numeral:
    fontFamily: "MochiyPopOne"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: "26px"
  body:
    fontFamily: "MPLUSRounded1c-Medium"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "23px"
  bodyStrong:
    fontFamily: "MPLUSRounded1c-Bold"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: "23px"
  callout:
    fontFamily: "MPLUSRounded1c-Medium"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: "21px"
  label:
    fontFamily: "MPLUSRounded1c-ExtraBold"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: "20px"
  caption:
    fontFamily: "MPLUSRounded1c-Bold"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: "18px"
  button:
    fontFamily: "MPLUSRounded1c-ExtraBold"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: "22px"
  buttonSmall:
    fontFamily: "MPLUSRounded1c-ExtraBold"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: "20px"
  hand:
    fontFamily: "Yomogi"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: "25px"
  stamp:
    fontFamily: "MochiyPopOne"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: "30px"
    letterSpacing: "1px"
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

# Design System: Snack

## Overview

**Creative North Star: "La libreta kawaii"**

Snack es una libreta de papelería japonesa en la que cada perfil es una página de scrapbook: fotos pegadas con washi tape dentro de marcos polaroid, etiquetas convertidas en pegatinas troqueladas, notas adhesivas con la bio escrita a mano y un sello «¡ME GUSTA!» que cae de golpe. El mundo es neobrutalismo kawaii: papel de puntos rosado, tinta ciruela para contornos, texto y sombras duras sin desenfoque, y rellenos pastel muy vivos que siempre llevan tinta encima. La app tiene que sentirse física: las cosas se despegan, se pegan, se sellan y se hunden en su sombra al pulsarlas.

La densidad es de app móvil tranquila: una columna, márgenes de 24, grupos separados por aire y por líneas discontinuas de libreta, nunca por cajas dentro de cajas. La decoración (washi, destellos, Mochi, pegatinas) vive en los bordes de las piezas y jamás tapa caras ni texto. Cada pantalla tiene como mucho un momento de autor (un sello, una celebración, una nota girada); el resto es movimiento de sistema.

Se rechaza de forma explícita el arquetipo del sector: foto a sangre con degradado oscuro encima e interfaz blanca genérica. La foto siempre va enmarcada (polaroid, recorte con contorno), nunca a sangre. El documento de marca en prosa, con la voz y los principios completos, está en [`docs/08-identidad-visual.md`](../../docs/08-identidad-visual.md); este fichero es el registro canónico de tokens y reglas visuales. La API de cada pieza vive en `src/shared/ui/DS_READY.md` y `src/shared/ui/art/README.md`.

**Key Characteristics:**
- Papel de puntos rosado a pantalla completa como fondo de todo (teñido con el `Soft` de un pastel en cada paso del onboarding).
- Contorno de tinta de 2–3 px en todo lo que es una pieza; sombra dura de tinta desplazada hacia abajo a la derecha.
- Pastel de relleno, tinta de texto: nunca texto blanco sobre pastel.
- Tres voces tipográficas: Mochiy Pop One (titulares), M PLUS Rounded 1c (interfaz), Yomogi (notas a mano).
- Pegatinas, washi, sellos, notas adhesivas y polaroids como gramática de componentes, no como adorno suelto.
- Mochi, la mascota, acompaña vacíos, esperas, errores y celebraciones.

## Colors

Un papel rosado, una tinta ciruela y siete rotuladores pastel, cada uno en tres tonos con papel fijo: `base` para rellenar, `Soft` para fondos y estados suaves, `Deep` para texto o iconos de acento.

### Primary
- **Fresa** (`fresa`): el color de la marca y de la acción principal. Relleno de los botones primarios, del botón y sello de «me gusta», de la pestaña Descubrir activa, de la burbuja de chat propia y de la pegatina del logo. `fresaDeep` es el texto de acento (rangos de filtros, sellos rosa); `fresaSoft` tiñe fondos y avisos cariñosos («Te ha dado like»).

### Secondary
- **Lavanda** (`lavanda`): el «no» amable. Botón y sello de «paso», relleno por defecto de `soft`, círculo de icono por defecto de las filas de ajustes, pestaña Yo activa y skeletons. `lavandaDeep` es el acento frío para texto sobre papel.
- **Limonada** (`limonada`): lo destacado y lo compartido. Etiquetas en común (con destello), pulgar del conmutador, resaltador de campos al enfocar (`limonadaSoft`), botón de deshacer, pestaña Likes activa y la nota adhesiva de la bio.
- **Menta** (`menta`): lo elegido y lo correcto. Pegatinas seleccionadas (con ♥), interruptor activado, avisos de éxito, notas de «perfil completo».

### Tertiary
- **Cielo** (`cielo`): información y la pestaña Chats activa; categoría «intereses».
- **Melocotón** (`melocoton`): categoría «estilo de vida» y fondos de paso del onboarding.
- **Tomate** (`tomate`): peligro y bloqueo. Botón `danger`, pegatinas bloqueadas (`tomateSoft` con texto `tomateDeep`, rayas, ✕ y tachado), errores de campo.

Cada categoría del catálogo de etiquetas tiene su pastel fijo (`semantic.category`): intereses cielo, vida activa menta, estilo de vida melocotón, valores lavanda, personalidad limonada, mascotas fresa, relación y familia tomate.

### Neutral
- **Tinta ciruela** (`ink`): texto por defecto, todos los contornos, todas las sombras duras, iconos. Es el único «negro» del sistema.
- **Tinta suave** (`inkSoft`): texto secundario (subtítulos, descripciones de filas).
- **Tinta tenue** (`inkFaint`): placeholders, notas terciarias y el contorno de lo deshabilitado; cumple ≥ 4.5:1 sobre papel.
- **Papel rosado** (`paper`): fondo de pantalla y de las hojas inferiores.
- **Papel hondo** (`paperDeep`): superficies hundidas, relleno de lo deshabilitado y de las pegatinas `muted`.
- **Punto de libreta** (`dot`): la trama del papel y los separadores sutiles.
- **Blanco** (`white`): cara de tarjetas, campos, botones secundarios, barra de pestañas y el anillo troquelado de las pegatinas. Solo lleva texto blanco encima la variante `ink` del botón.
- **Velo** (`scrim`): tinta translúcida bajo hojas y modales.

### Named Rules
**The Tinta Encima Rule.** Sobre cualquier relleno pastel el texto y los iconos son `ink` (o el `Deep` del mismo pastel). Nunca texto blanco sobre pastel. El único texto blanco del sistema va sobre `ink`.

**The Three Tones Rule.** Un pastel se usa en sus tres tonos con papel fijo: base = relleno de piezas, `Soft` = fondos y estados suaves, `Deep` = texto de acento. No se inventan tonos intermedios salvo el tinte neutral de las pegatinas de categoría (mezcla 45 % entre `Soft` y base, calculada en el componente).

**The Color Is Never Alone Rule.** El estado nunca depende solo del color: la pegatina elegida lleva ♥, la bloqueada rayas + ✕ + tachado, la compartida un destello, la no disponible contorno a trazos; los errores sacuden el campo y se anuncian.

**The Tokens Only Rule.** Todo color sale de `useTheme()`. Los únicos hex sueltos admitidos son las marcas de terceros (el logotipo de Google y el botón de Apple en el login).

## Typography

**Display Font:** Mochiy Pop One (`MochiyPopOne`)
**Body Font:** M PLUS Rounded 1c (`MPLUSRounded1c-Regular | Medium | Bold | ExtraBold | Black`)
**Label/Mono Font:** Yomogi (`Yomogi`) para anotaciones manuscritas

**Character:** Mochiy es pop japonés gordo y redondo, con una sola voz de peso; M PLUS Rounded es la letra de interfaz, redonda y muy legible en todos sus pesos; Yomogi es la letra de alguien escribiendo en su libreta. Las tres son subconjuntos latinos empaquetados en `assets/fonts/`.

### Hierarchy
- **Hero** (Mochiy, 40/46, −0.4): una sola vez por pantalla y solo en momentos de marca: login («Ligar sin trucos.»), celebración de match.
- **Title 1** (Mochiy, 30/36, −0.3): título de pestaña (`TopBar size="large"`) y preguntas del onboarding.
- **Title 2** (Mochiy, 24/30, −0.2): títulos de sección grandes, nombre y edad en la pegatina de la polaroid.
- **Title 3** (Mochiy, 19/25): encabezados de sección y de categoría (con su tira de washi), título de `TopBar` normal.
- **Numeral** (Mochiy, 22/26): contadores grandes («0/8», «3/5»).
- **Body** (M PLUS Medium, 16/23): texto corrido, bios fuera de la nota, mensajes de chat.
- **Body Strong** (M PLUS Bold, 16/23): etiquetas de filas de lista, mensajes de toast, énfasis en línea.
- **Callout** (M PLUS Medium, 15/21): subtítulos bajo un título, valores a la derecha de las filas, avisos.
- **Label** (M PLUS ExtraBold, 15/20): texto de pegatinas, segmentos y rótulos de campo.
- **Caption** (M PLUS Bold, 13/18): descripciones de filas, contadores y ayudas de campos, notas al pie de sección. Las insignias (`Pill`, 13 u 11.5) y los rótulos de la barra de pestañas (11) usan M PLUS ExtraBold/Bold a tamaño fijo dentro de su componente.
- **Button** (M PLUS ExtraBold, 17/22) y **Button Small** (15/20): texto de botones.
- **Hand** (Yomogi, 20/25): bio en la nota adhesiva, pies de polaroid («¡Portada!»), «Así te ven», «¡hola!». Nunca por debajo de 18.
- **Stamp** (Mochiy, 26/30, +1, mayúsculas): solo dentro de los sellos de goma (`Stamp`: «¡ME GUSTA!», «PASO», «¡MATCH!», «GRATIS»).

### Named Rules
**The Family Is The Weight Rule.** Nunca `fontWeight` con estas fuentes: en Android cada peso es otra familia. Se elige la variante de `<Text variant=…>` (o la familia del peso); el `fontWeight` del frontmatter es solo descriptivo.

**The Mochiy Speaks Once Rule.** Mochiy es para titulares, números y sellos. El texto de interfaz, los botones y las pegatinas van en M PLUS Rounded; Yomogi se reserva para lo que «escribe a mano» una persona.

**The No Kicker Rule.** No hay antetítulos en versalitas encima de los titulares: una sección se encabeza con su título en Mochiy (y, en categorías, con su tira de washi del pastel de la categoría), nunca con una etiqueta gris en mayúsculas.

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

### Pills (insignias)
- **Style:** pastilla pequeña (24–28 de alto) con contorno fino, sombra de roce, icono + texto M PLUS ExtraBold de 13 (11.5 en `sm`).
- **Vocabulario cerrado:** Nuevo (limonada, destello) · Te dio like (fresa, corazón) · En común (menta, etiqueta) · Un poco más lejos (cielo, pin). No se inventan insignias sueltas con texto libre.

### Cards / Containers
- **Corner Style:** `Surface` 16 (`md`); `Card` y grupos de lista 22 (`lg`).
- **Background:** blanco por defecto; cualquier pastel o su `Soft` para notas y avisos.
- **Shadow Strategy:** `md` por defecto; ver Elevation & Depth.
- **Border:** tinta `bold` (3).
- **Internal Padding:** 16 (`Surface`), 20 (`Card`), 12×16 en filas.
- Nunca se anidan tarjetas. Una tarjeta pulsable se hunde entera. Con `clip` recorta fotos y filas sin recortar la sombra.

### Inputs / Fields
- **Style:** cara blanca con contorno tinta 2.5, radio 16, sombra dura de 2; en `xl` (pregunta única del onboarding) contorno 3, radio 22, texto en Mochiy.
- **Focus:** se «resalta» con el `Soft` de un pastel (limonada por defecto) y la sombra crece de 2 a 4.
- **Error / Disabled:** fondo tomate suave, contorno tomate `Deep`, sacudida y mensaje anunciado; contador de caracteres cuando hay `maxLength`. Placeholders en `inkFaint`.

### Navigation
- **Barra de pestañas:** pastilla flotante blanca (alto 72, contorno 3, sombra `md`). Cada pestaña es icono + rótulo `caption`; la activa se convierte en una pegatina pastel con contorno 2.5 y sombra `sm` que hace pop al entrar: Descubrir fresa, Likes limonada, Chats cielo, Yo lavanda. Contadores con `Badge` fresa.
- **TopBar:** sin cabecera nativa; botón de icono circular (atrás, cerrar, bajar) a la izquierda, título Mochiy centrado o grande a la izquierda en pestañas, acciones circulares a la derecha.
- **SegmentedControl:** pastilla blanca con contorno y sombra `sm`, y un pulgar pastel (limonada por defecto) que se desliza con muelle; semántica de pestañas.

### Sheets, toasts y estados
- **Sheet:** hoja de papel con contorno 3 y radio 28 arriba, asa de pastilla, velo de tinta; se cierra deslizando, tocando el velo, con ✕ o con el atrás del sistema. `ConfirmSheet` añade a Mochi y un par de botones.
- **Toast:** tarjeta con contorno 2.5, radio 22, sombra dura y círculo de icono blanco; el relleno sigue el tono con el pastel pleno (menta éxito, tomate error, cielo info, limonada aviso, fresa `love`, blanco neutro) y el texto va en tinta.
- **Estados:** carga con skeletons lavanda con brillo; vacío con Mochi y una acción útil; error que dice qué pasó y ofrece «Reintentar».

### Polaroid y papelería (signature)
La polaroid (marco blanco más ancho abajo, contorno 3, sombra `lg`, dos tiras de washi en las esquinas superiores) es la unidad de perfil: la foto va dentro, nunca a sangre; el nombre y la edad van en una pegatina Mochiy que se sale por el borde inferior de la foto. La bio va en una nota adhesiva limonada con esquina doblada y tira de washi, escrita en Yomogi. Los sellos de goma («¡ME GUSTA!», «PASO», «¡MATCH!») aparecen en proporción al arrastre y caen de golpe (1.6 → 1). Mochi aparece en vacíos, esperas, errores, el login y las celebraciones, con un estado de ánimo acorde.

### Movimiento
Las pegatinas se despegan y se pegan (`spring.pop`: escala 1.12 → 1 con giro que se asienta), los sellos caen de golpe, el papel se desliza y asienta (`spring.soft`), los botones se hunden (`spring.snappy`), las celebraciones estallan en corazones y estrellas pastel (`spring.wobbly`, ~900 ms, ≤ 24 partículas). Con «reducir movimiento» todo pasa a fundidos cortos. Hápticos solo en momentos clave: etiqueta (selección), cruzar el umbral del swipe (ligero), like (medio), match (éxito).

## Do's and Don'ts

### Do:
- **Do** poner tinta (`ink`) encima de cualquier pastel y reservar el texto blanco para el botón `ink`.
- **Do** dar a cada pieza un contorno de tinta de 2, 2.5 o 3 según su tamaño y una única sombra dura de `xs` a `lg`.
- **Do** hundir hacia la sombra todo lo pulsable (`PressableScale`, `Button`, `IconButton`, `Surface onPress`).
- **Do** enmarcar las fotos (polaroid o recorte con contorno) y dejar la decoración en los bordes.
- **Do** usar solo el set SVG de `Icon`; el emoji aparece únicamente como contenido de las etiquetas y del texto que escribe la gente.
- **Do** acompañar cada estado de color con forma, icono o trazo (♥, ✕ + rayas, destello, trazo discontinuo).
- **Do** usar `<Text variant=…>` para todo texto y Yomogi solo a 18 o más.
- **Do** diseñar siempre carga, vacío (con Mochi), error (qué pasó + reintentar), deshabilitado y pulsado.

### Don't:
- **Don't** usar foto a sangre con degradado oscuro encima ni interfaz blanca genérica: es el arquetipo del sector que Snack rechaza.
- **Don't** poner texto blanco sobre pastel.
- **Don't** usar sombras difusas, glassmorphism decorativo, texto con degradado o una segunda elevación sobre una pieza.
- **Don't** poner antetítulos en versalitas grises encima de los titulares.
- **Don't** anidar tarjetas ni usar pastillas para contenedores: la pastilla es de botones, pegatinas e insignias.
- **Don't** usar emoji como iconos de interfaz ni fuentes de iconos.
- **Don't** escribir hex sueltos ni `fontWeight`; todo sale de `useTheme()` y de las variantes de texto.
- **Don't** dibujar ilustración con trazo «sketch», garabatos o texturas de ruido: la ilustración es geométrica y nítida.
- **Don't** repartir efectos por toda la pantalla: un momento de autor por pantalla.
