# Iconos y papel: listos

`Icon` y `PaperBackground` ya están exportados desde `src/shared/ui` (y desde `src/shared/ui/art`).

## Icon

```tsx
import { Icon, type IconName, useTheme } from "../src/shared/ui";

const theme = useTheme();

<Icon name="heart" />                                            // 24 pt, tinta, decorativo (oculto a lectores)
<Icon name="heart" size={32} fill={theme.primitives.color.fresa} /> // pegatina: relleno pastel con tinta encima
<Icon name="heart-filled" color={theme.primitives.color.fresaDeep} /> // macizo del color de la tinta
<Icon name="info" size={20} accessibilityLabel="Más información" />  // se anuncia como imagen
```

Props: `name: IconName`, `size?` (def. 24; pensado para 16/20/24/32/48), `color?` (tinta; def. `semantic.icon.default`),
`fill?` (relleno pastel de las formas cerradas), `strokeWidth?` (unidades de la retícula 24; por defecto óptico:
2.25, nunca menos de 1.6 px ni más de 3.6 px), `accessibilityLabel?`, `style?`, `testID?`.
El icono nunca captura toques (`pointerEvents: none`): ponlo dentro de tu `Pressable` y etiqueta el `Pressable`.
`iconNames` exporta la lista completa.

Nombres (69):

- Descubrir: `heart`, `heart-filled`, `heart-crack` (deshacer match), `x` (paso), `close` (cerrar), `undo`, `star`,
  `star-filled`, `sparkle`, `sparkles`
- Personas y chat: `chat`, `chat-dots`, `user`, `users`, `smile`, `send`, `mail`, `bell`
- Modos y navegación: `cards` (modo swipe), `feed` (modo feed), `home`, `sliders` (filtros), `gear`, `menu`, `more`
  (kebab), `more-horizontal`, `grip` (reordenar), `search`, `chevron-left`, `chevron-right`, `chevron-down`,
  `chevron-up`, `arrow-up`, `arrow-down`, `arrow-left`, `arrow-right`, `external`, `refresh`, `logout`, `download`
- Edición y fotos: `plus`, `minus`, `check`, `check-circle`, `camera`, `image`, `pencil`, `trash`, `pause`, `play`,
  `tag`
- Seguridad y ajustes: `flag`, `block`, `shield`, `shield-check`, `lock`, `eye`, `eye-off` (ojo cerrado), `info`,
  `alert`, `help`, `clock`, `moon` (respiro/pausa), `pin` (ubicación)
- Pequeños placeres: `gift`, `code` (open source), `cake` (cumpleaños), `leaf`, `flower`

## PaperBackground

```tsx
<View style={{ flex: 1 }}>
  <PaperBackground />                 {/* papel rosado con trama de puntos */}
  <PaperBackground tone="menta" />    {/* papel teñido con el soft de un pastel (funde al cambiar) */}
  <PaperBackground dotted={false} />  {/* papel liso */}
  …contenido…
</View>
```

Props: `tone?: PastelName`, `dotted?` (def. `true`), `spacing?` (def. 20), `animateTone?` (def. `true`; con
«reducir movimiento» cambia sin fundido), `style?`, `testID?`. Es `position: absolute` a pantalla completa y
`pointerEvents: none`: ponlo como primer hijo del contenedor.

## Tests

`react-native-reanimated` ya tiene mock (`test/mocks/react-native-reanimated.tsx`, registrado en `test/setup.ts`) y el
mock de `react-native-svg` exporta también `Pattern`, `Ellipse`, `Line`, `Polygon`, `RadialGradient`, `Mask`, `Text`,
`TSpan`.
