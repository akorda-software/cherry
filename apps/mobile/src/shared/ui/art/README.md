# Capa de arte de la «Libreta kawaii»

Ilustración y decoración del sistema de diseño. Todo es SVG geométrico (nada de trazos "sketch" ni
`feTurbulence`), con contorno de tinta y rellenos pastel de los tokens (`useTheme()`); nada de hex sueltos.
Se importa desde `src/shared/ui` (o `src/shared/ui/art`). Escaparate solo-dev en `/art` (`app/(dev)/art.tsx`).

Reglas de uso: la decoración vive en los bordes (nunca tapa caras ni texto); un momento de autor por pantalla;
los hápticos los pone quien dispara el momento (like, match…), no estas piezas. Todo respeta «reducir
movimiento» (`useReducedMotion` de reanimated) y nada captura toques salvo tu propio `Pressable`.

## Icon

`<Icon name size? color? fill? strokeWidth? accessibilityLabel? style? testID? />` · `IconName`, `iconNames`,
`opticalStrokeWidth(size)`.
Retícula 24, trazo 2.25 redondeado (óptico: 1.6–3.6 px reales), relleno pastel opcional en formas cerradas;
`heart-filled` y `star-filled` salen macizos. Decorativo salvo que lleve `accessibilityLabel`. Lista de nombres
en `ICONS_READY.md`.

## PaperBackground

`<PaperBackground tone? dotted? animateTone? style? testID? />`
Papel de puntos a pantalla completa (`position: absolute`, `pointerEvents: none`), un único `<Pattern>`. `tone`
tiñe con el `soft` de un pastel y funde el color al cambiar (onboarding). Primer hijo del contenedor.

## Mascot (Mochi)

`<Mascot size? mood? color? animated? accessibilityLabel? style? testID? />` · `MascotMood`, `mascotMoods`.
Moods: `happy`, `love` (ojos corazón), `wink`, `sleepy` (ojos cerrados + «z»), `surprised`, `sad` (lágrima y
brotes caídos, para consolar), `celebrate` (bracitos arriba y destellos), `thinking` (mira a sus burbujas).
`color`: cualquier pastel (fresa por defecto). `animated`: respira (squash & stretch desde el suelo) y parpadea
cada ~4 s; en `celebrate` da saltitos con anticipación y aterrizaje. Con «reducir movimiento» queda quieto
(solo parpadea). Lienzo cuadrado de `size` (def. 120); decorativo salvo `accessibilityLabel`.

## Logo

`<CherryMark size? tone? decorative? accessibilityLabel? style? testID? />` — el logo: un par de cerezas cuyas hojas
son dos corazones, plano (sin contornos ni sombras). `size` es el alto (el ancho sale de la proporción, 614 × 800);
`tone`: `color` (def.), `ink` o `white` (de una tinta, sin brillos). Trazados en `cherry-mark-geometry.ts`, iguales
que `assets/brand/cherry-logo.svg`; `CherryMarkShapes` pinta partes sueltas (la animación de arranque las mueve).

`<Logo height? wordmark? tone? accessibilityLabel? style? testID? />` — logotipo: las cerezas y la palabra «cherry» en
Rubik Black al lado (`wordmark={false}`: solo las cerezas). Es una sola imagen para el lector de pantalla.

## Papelería

- `<WashiTape width? height? color? pattern? rotation? outlined? />` — tira translúcida con los extremos en
  zigzag; `pattern`: `dots | stripes | grid | hearts | plain`. `washiPath(w, h)` da el contorno.
- `<Stamp label tone? shape? rotation? size? backdrop? slam? />` — sello de goma: doble borde (interior
  discontinuo), letras Mochiy en mayúsculas; `tone`: `ink` o un pastel (usa su `deep`); `shape`:
  `rounded | circle` (el circular lleva corazón y puntos); `size`: `sm | md | lg`; `backdrop` (def. sí) pone
  papel blanco translúcido para leerse sobre fotos; `slam` cae de golpe al montarse (1.6 → 1, `spring.pop`).
  Para la previsualización del swipe, envuélvelo en tu `Animated.View` y controla la opacidad con el arrastre.
- `<StickyNote color? tilt? tape? fold? padding?>{children}</StickyNote>` — nota adhesiva con esquina doblada,
  sombra dura y tira de washi arriba (`tape={false}` la quita).
- `<Sticker color? shape? rotation? rim? padding? elevation? pop?>{children}</Sticker>` — convierte cualquier
  contenido en pegatina (troquelado blanco + contorno + sombra dura); `pop` la «pega» al montarse
  (1.12 → 1 con giro que se asienta).
- `<Deco kind size? color? rotation? />` y `<Sparkle />` — formas exactas para esquinas: `sparkle`, `star`,
  `heart`, `circle`, `dot`, `bubble`, `bow`, `flower` (`decoKinds`).
- `<PolaroidFrame uri? width? photoAspectRatio? caption? tapes? tapeColors? tapePattern? tilt? elevation?
  accessibilityLabel?>{children?}</PolaroidFrame>` — marco polaroid (más ancho abajo, contorno, sombra dura)
  con foto por `expo-image` o `children`; `photoAspectRatio="fill"` para que la foto ocupe el alto disponible;
  `tapes`: `corners | top | none`; `caption` en letra manuscrita (Yomogi).

## Celebración

`<HeartBurst ref? trigger? autoPlay? origin? count? shapes? colors? particleSize? direction? spread? power?
duration? onDone? />` y `<Confetti … />` (fuente hacia arriba, 24 partículas).
Corazones, estrellas, destellos y círculos pastel con contorno que estallan desde `origin` (def. centro) con
gravedad, rozamiento y giro, ~900 ms, en el hilo de UI con una única línea de tiempo (≤ 24 partículas). Se
dispara cambiando `trigger` (tras el montaje), con `autoPlay` o con `ref.current.fire(origin?)`. Con «reducir
movimiento» se sustituye por un destello que aparece y se apaga. Capa absoluta sobre el contenido.

```tsx
const burst = useRef<HeartBurstHandle>(null);
<View style={{ flex: 1 }}>
  …
  <HeartBurst ref={burst} />
</View>
// al hacer match: Haptics.notificationAsync(Success); burst.current?.fire();
```

## Recursos de marca

Fuente: `assets/brand/cherry-logo.svg` (el logo) y `assets/brand/cherry-icon.svg` (el icono con su fondo). Desde
ellos, rasterizados a 1024 px: `assets/images/icon.png` (cerezas sobre amarillo, opaco), `adaptive-icon.png`
(cerezas dentro del círculo seguro de 66 dp) + `adaptive-icon-background.png` (amarillo) +
`adaptive-icon-monochrome.png` (blanco con los brillos calados, icono temático de Android 13), `splash-icon.png`
(cerezas sobre transparente, dentro del círculo de 192 dp del splash de Android 12; el fondo amarillo lo pone
`app.config.ts`) y `favicon.png` (48 px, rabitos más gruesos). Si cambian el dibujo o `imageWidth` del splash,
revisa `SPLASH_IMAGE_WIDTH` en `composites/boot-splash.tsx`.
