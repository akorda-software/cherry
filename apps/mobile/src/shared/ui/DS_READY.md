# Sistema de diseño «Libreta kawaii»: listo para usar

Todo se importa desde `src/shared/ui` (ruta relativa desde tu fichero, p. ej. `../../../shared/ui`).
Escaparate vivo con todas las piezas y estados: **http://localhost:8081/kitchen-sink** (solo dev).
Iconos, papel, Mochi, washi, sellos, logo y celebraciones (capa de arte): ver `art/READY.md` y `art/README.md`.
Documento de marca: `docs/08-identidad-visual.md`.

```tsx
import { Screen, TopBar, Text, Button, TagSticker, useTheme } from "../../../shared/ui";
```

## Reglas rápidas (no negociables)

- Colores SOLO desde `useTheme()` (`theme.primitives.color.*`, `theme.primitives.pastel.<p>.{fill,soft,deep}`,
  `theme.semantic.*`). Nunca hex sueltos. Tinta encima de pastel; nunca texto blanco sobre pastel.
- Grosores: superficies grandes (tarjetas, hojas, barra, botones lg, botones redondos lg/xl) `border.bold` (3);
  controles (botones md/sm, campos, pegatinas md/lg, conmutador, interruptor) `border.regular` (2.5);
  detalles pequeños (insignias, contadores, pegatinas sm, círculos de icono) `border.thin` (2).
- Una sola elevación por elemento: sombra dura de tinta (`elevation.*`) y, al pulsar, se hunde hacia ella
  (usa `PressableScale` o los componentes, no reinventes). Radios: tarjetas 16–22, pastillas solo chips/botones.
- Tipografía: SIEMPRE `<Text variant=…>`; nunca `fontWeight` (en Android cada peso es otra familia).
- Iconos: solo `<Icon name=… />` (o `icon="heart"` en los componentes). Emoji solo como contenido de etiquetas.
- Objetivos táctiles ≥ 48 (los componentes ya ponen `hitSlop`). Todo lo pulsable sin texto lleva `accessibilityLabel`.
- Un momento de autor por pantalla; el resto, movimiento de sistema (pulsar, pop de pegatina, aparecer).

## Página

### `Screen`
Papel de puntos + safe areas + teclado + pie fijo. Dentro de las pestañas deja sitio solo a la barra flotante.
Props: `header?` (fijo arriba, normalmente `<TopBar/>`), `footer?` (fijo abajo, sube con el teclado; CTAs),
`scroll?` (def. false), `padded?` (def. true, margen 24), `gap?` (def. `lg`), `tone?: PastelName` (papel teñido,
p. ej. cada paso del onboarding), `dotted?` (def. true), `edges?` (def. todos), `keyboard?` (def. true),
`refreshControl?`, `scrollProps?`, `contentStyle?`, `style?`, `testID?`. Legacy: `title`, `description`, `testId`.

Con `scroll`, el contenido pasa por detrás de la barra de pestañas y el final queda por encima de ella. Si tu pantalla
trae su propia lista (FlashList, carrusel…), usa `edges={["top", "left", "right"]}` (sin `bottom`: Screen no reserva
nada abajo) y añade `useTabBarSpace()` (o `insets.bottom` fuera de pestañas) al `paddingBottom` de tu lista.

```tsx
<Screen
  header={<TopBar left="back" title="Tu bio" />}
  scroll
  footer={<Button fullWidth size="lg" loading={saving} onPress={save}>Guardar</Button>}
>
  <TextField label="Cuéntanos algo" multiline maxLength={240} value={bio} onChangeText={setBio} />
</Screen>
```

### `TopBar`
`title?`, `subtitle?`, `size?: "normal" | "large"` (large = título Mochiy grande bajo la barra, para pestañas),
`left?: "back" | "close" | ReactNode` (back/close hacen `router.back()` o `router.replace(fallbackHref)` si no hay
historial), `right?: ReactNode` (normalmente `IconButton size="sm"`), `onBack?`, `fallbackHref?` (def. `/`), `testID?`.
En `large` sin `left`, título y acciones comparten fila (cabecera compacta de pestaña).
testIDs internos: `top-bar-back`, `top-bar-close`.

```tsx
<TopBar size="large" title="Likes" right={<IconButton icon="sliders" accessibilityLabel="Filtros" size="sm" onPress={…} />} />
```

### Maquetación
- `Stack` (columna; `gap?` clave de espaciado o px, def. `md`; `align?`, `justify?`, `flex?`).
- `Inline` (fila que envuelve; `gap?` def. `sm`; `align?` def. center; `justify?`; `wrap?` def. true).
- `Divider` (línea discontinua de libreta; `label?` accesible, `color?`, `solid?`).

### `Surface` / `Card`
`Surface`: `color?: PastelName | "white" | "paper" | "paperDeep" | "ink"` (def. blanco), `soft?` (tono Soft),
`elevation?` (def. `md`), `radius?` (clave o px, def. `md`=16), `padding?` (def. `md`), `border?` (def. `bold`),
`rotate?` (grados), `clip?` (recorta contenido —fotos, filas— sin recortar la sombra), `onPress?`/`onLongPress?`
(toda la tarjeta se hunde al pulsar), `haptic?`, `accessibilityLabel?`, `testID?`.
`Card` = `Surface` con radio 22 y padding 20; opcional `title`, `description`, `footer`. Nunca anides tarjetas.

```tsx
<Surface color="limonada" soft rotate={-1.5}><Text variant="hand">¡Hola!</Text></Surface>
<Surface clip padding={0} radius="lg" onPress={open}>…foto…</Surface>
```

### Listas y ajustes: `ListSection` + `ListRow` (alias `SettingsRow`)
`ListSection`: `title?` (encabezado), `footnote?`, hijos = filas (separadas por líneas discontinuas).
`ListRow`: `label`, `description?`, `icon?: IconName`, `iconColor?: PastelName` (def. lavanda),
`value?` (texto a la derecha), `trailing?: "chevron" | "switch" | "none" | ReactNode` (def. chevron si hay
`onPress`, switch si hay `onSwitchChange`), `switchValue?`, `onSwitchChange?`, `danger?`, `disabled?`, `onPress?`, `testID?`.

```tsx
<ListSection title="Cuenta" footnote="Redondeamos tu ubicación a 500 m.">
  <ListRow icon="user" label="Lo básico" value="Lucía, 29" onPress={…} />
  <ListRow icon="moon" label="Tomarme un respiro" switchValue={paused} onSwitchChange={setPaused} />
  <ListRow icon="trash" label="Borrar cuenta" danger onPress={…} />
</ListSection>
```

## Texto
- `Text`: `variant?` (def. `body`): `hero · title1 · title2 · title3 · body · bodyStrong · callout · label · caption ·
  micro · button · buttonSmall · hand (Yomogi ≥18) · stamp · numeral`; `color?` rol (`default | muted | faint |
  inverse | accent | danger | success`) o color; `align?`; `numberOfLines?`; resto de props de RN Text.
  `maxFontSizeMultiplier` ya viene ajustado por variante.
- `Heading`: `level?: 1|2|3|4` (→ title1/title2/title3/bodyStrong, rol heading) y `variant?` para forzar.

## Controles

### `Button`
`variant?: "primary" (fresa) | "secondary" (blanco) | "soft" (lavanda suave) | "danger" (tomate) | "ghost" (texto) |
"ink" (tinta, texto blanco, sombra pastel)`; `color?: PastelName` (relleno de primary/soft, sombra de ink);
`size?: "lg" (60) | "md" (52) | "sm" (40)`; `icon?`/`iconRight?` (nombre de icono o nodo); `loading?` (puntitos,
no cambia tamaño, no pulsa); `disabled?` (queda pegado al papel; al habilitarse «sube»); `fullWidth?`; `haptic?`
(`true` = ligero o `"medium"`…); `rotate?`; `onPress`, `onLongPress`, `testID`, `accessibilityLabel`. Texto por
`children` o `label`. Legacy `tone="destructive"` = `danger`.

```tsx
<Button fullWidth size="lg" icon="heart" onPress={start}>Empezar</Button>
<Button variant="ghost" onPress={skip}>Ahora no</Button>
```

### `IconButton` (✕ / ↺ / ♥, atrás, filtros…)
`icon`, `accessibilityLabel` (**obligatorio**), `size?: "sm" (40) | "md" (48) | "lg" (64) | "xl" (76)`,
`color?: PastelName | "white" | "ink"` (def. blanco), `iconFill?` (relleno del icono, p. ej. corazón blanco),
`badge?: number | true`, `selected?` (aria-pressed), `disabled?`, `haptic?`, `flat?` (sin sombra), `onPress`,
`onLongPress`, `testID`. Se hunde, se aplasta un poco y vuelve con rebote.

```tsx
<IconButton icon="x" color="lavanda" size="lg" accessibilityLabel="Paso" onPress={pass} />
<IconButton icon="undo" color="limonada" size="md" accessibilityLabel="Deshacer" onPress={undo} />
<IconButton icon="heart" color="fresa" size="xl" iconFill={theme.primitives.color.white} haptic="medium" accessibilityLabel="Me gusta" onPress={like} />
```

### `PressableScale`
Base neobrutal para tus propios pulsables: `faceStyle` (relleno/contorno/radio/padding de la cara), `style`
(caja exterior), `elevation?` (def. `md`), `radius?` (def. el de `faceStyle`), `pressedScale?` (def. 1),
`releaseSpring?` (`snappy` | `pop`…), `haptic?`, `rotate?`, `shadowColor?`, `sinkWhenDisabled?` + props de Pressable.

### `TagSticker` (el componente estrella)
`label`, `emoji?`, `state?: "neutral" | "selected" | "blocked" | "shared" | "muted"`, `size?: "sm" (30) | "md" (38) |
"lg" (46)`, `tint?: PastelName` (tiñe el estado neutral, p. ej. color de categoría `theme.semantic.category`),
`diecut?` (borde blanco troquelado para pegatinas sobre fotos), `rotate?`, `disabled?`, `onPress?`, `onLongPress?`,
`testID?`. Estados: selected = menta + ♥; blocked = tomate suave con rayas + ✕ + tachado; shared = limonada + destello;
muted = recortable a trazos, sin sombra. Con `onPress` es un checkbox accesible (y el neutral muestra «+» para que el
ancho no salte al elegir). Al cambiar de estado hace pop (despegar/pegar) y háptico de selección, él solo.

```tsx
<Inline gap="sm">
  {tags.map((t) => (
    <TagSticker key={t.slug} emoji={t.emoji} label={t.label} state={stateOf(t)} onPress={() => toggle(t)} testID={`tag-${t.slug}`} />
  ))}
</Inline>
<TagSticker diecut size="sm" rotate={-3} state="shared" emoji="🌿" label="Senderismo" />
```

### `SegmentedControl`
`options: { value, label, icon?, accessibilityLabel?, testID? }[]`, `value`, `onChange(value)`, `size?: "sm" | "md"`,
`color?: PastelName` (pulgar, def. limonada), `fullWidth?`, `accessibilityLabel?`, `testID?`. Semántica de pestañas.

```tsx
<SegmentedControl value={mode} onChange={setMode} options={[
  { value: "swipe", label: "Swipe", icon: "cards", testID: "mode-swipe" },
  { value: "feed", label: "Feed", icon: "feed", testID: "mode-feed" }
]} />
```

### `TextField`
Props de `TextInput` + `label?`, `hint?`, `error?` (tiñe, sacude y se anuncia), `size?: "md" | "xl"` (xl = pregunta
única gigante del onboarding, en Mochiy), `counter?` (def. sí con `maxLength`), `icon?`, `right?`, `color?`
(resaltador al enfocar, def. limonada), `containerStyle?`, `inputStyle?`. `ref` apunta al `TextInput`.

```tsx
<TextField size="xl" label="¿Cómo te llamas?" placeholder="Tu nombre" value={name} onChangeText={setName} autoFocus />
```

### `Switch`, `RangeSlider`, `Slider`
- `Switch`: `value`, `onValueChange`, `disabled?`, `color?` (def. menta), `accessibilityLabel`, `testID`.
- `RangeSlider`: `min`, `max`, `low`, `high`, `step?` (def. 1), `minGap?`, `onChange(low, high)` (cada paso),
  `onChangeEnd(low, high)` (al soltar), `formatLabel?`, `labels?: "drag" | "always" | "none"` (def. drag),
  `color?` (def. fresa), `disabled?`, `lowLabel?`/`highLabel?` (accesibles), `testID?` (`-low`/`-high` en los pulgares).
- `Slider`: igual con un pulgar: `value`, `onChange(value)`, `onChangeEnd(value)`, `accessibilityLabel?`.

```tsx
<RangeSlider min={18} max={99} low={age.low} high={age.high} minGap={2} onChange={(low, high) => setAge({ low, high })} onChangeEnd={save} />
<Slider min={2} max={160} value={km} color="menta" formatLabel={(v) => `${v} km`} onChange={setKm} />
```

## Identidad y avisos
- `Avatar`: `uri?`, `name?` (inicial + color estable + etiqueta), `size?: "xs" 32 | "sm" 40 | "md" 56 | "lg" 80 |
  "xl" 112 | px`, `color?`, `ring?: PastelName | true` (aro de «nuevo»), `elevation?`, `testID?`. `pastelForName(name)`.
- `Badge`: `count?`, `max?` (def. 99 → «99+»), `dot?`, `color?: PastelName | "ink"` (def. fresa), `size?: "sm" | "md"`.
  Hace pop cuando sube el número.
- `Pill` (insignias del sistema: Nuevo · Te dio like · En común · Un poco más lejos): `label`, `icon?`,
  `color?: PastelName | "white" | "ink"`, `size?: "sm" | "md"`, `rotate?`.

```tsx
<Pill color="limonada" icon="sparkle" label="Nuevo" />
<Pill color="fresa" icon="heart" label="Te dio like" />
<Pill color="menta" icon="tag" label="3 en común" />
<Pill color="cielo" icon="pin" label="Un poco más lejos" />
```

## Estados
- `Skeleton` (`width?`, `height?`, `radius?`, `circle?: diámetro`, `color?` def. lavanda), `SkeletonText`
  (`lines?`, `lineHeight?`, `gap?`, `lastLineWidth?`), `SkeletonGroup` (un solo brillo para todos sus hijos).
- `EmptyState`: `title`, `description?`, `mood?: MascotMood` (def. happy), `mascotColor?`, `illustration?`
  (`null` = sin Mochi), `actionLabel?` + `onAction?` (+ `actionIcon?`), `secondaryLabel?` + `onSecondary?`,
  `action?` (nodo), `compact?`, `testID?`.
- `ErrorState`: `message` (qué pasó), `title?` (def. «Vaya, algo se ha torcido»), `onRetry?`, `retryLabel?`
  (def. «Reintentar»), `retrying?`, `mood?`, `compact?`, `testID?` (el botón: `${testID}-retry`).
- `LoadingScreen` (`message?`, `testID?`): pantalla completa de espera con Mochi. `LoadingDots` (`color?`, `size?`).
- `FormMessage` (`tone: "info" | "success" | "error"`): aviso corto con icono.

## Capas
- `Sheet`: `visible`, `onClose`, `title?`, `snap?: "auto" | "tall"`, `footer?` (acciones fijas), `showClose?`,
  `dismissible?` (def. true: velo, arrastrar hacia abajo, ✕ y atrás de Android), `scroll?` (def. true), `testID?`
  (`-scrim`, `-close`).
- `ConfirmSheet`: `visible`, `title`, `message?`, `confirmLabel?`, `cancelLabel?`, `destructive?`, `loading?`,
  `mood?` (`null` = sin Mochi), `onConfirm`, `onCancel`, `testID?` (`-confirm`, `-cancel`).
- Toasts: `const { show } = useToast(); show({ message, tone?, icon?, duration? })` o `toast.show(...)` fuera de
  React. `tone`: `neutral | success | error | info | warning | love`. `ToastHost` ya está montado en la raíz.

```tsx
<ConfirmSheet visible={open} destructive title="¿Deshacer el match?" message="Dejaréis de veros. Sin dramas."
  confirmLabel="Sí, deshacer" loading={busy} onConfirm={unmatch} onCancel={() => setOpen(false)} />
toast.show({ message: "¡Guardado!", tone: "success" });
```

## Movimiento (`motion/`)
- `springs.{pop, soft, snappy, wobbly}` (respetan «reducir movimiento»), `timings.{quick, calm, slow}`,
  `easings.{out, outBack, inOut}`, `stagger(index, step = 45, base = 0)`.
- `<Appear delay? from?="bottom|top|left|right|scale|none" distance? trigger?>` entrada de papel.
- `<PopIn delay? rotate? fromScale? trigger?>` entrada de pegatina. `usePop({ rotate, from, tilt })` → `{ pop(), style }`.
- `<Wiggle active? trigger? amplitude?>` meneo. `useShake()` → `{ shake(), style }` (sacudida de error + háptico).
- `useOnChange(value, (next, prev) => …)` efecto solo en cambios. `useReducedMotion()` (reanimated).
- `haptics.{selection, light, medium, heavy, success, warning, error}()` (no-op en web).
  Momentos: etiqueta (selection, ya lo hace TagSticker), cruzar umbral de swipe (light), like (medium), match (success).

## Armazón de navegación (`app-shell/`)
- Rutas: `appShellRoutes.{login, onboarding, discover, likes, chats, me, settings, filters, about, editPhotos,
  editTags, editBio, editBasics}`, `profileHref(id)`, `chatHref(id)` (→ `router.push(profileHref(card.id))`).
- Ficheros: `app/(app)/(tabs)/{discover,likes,chats,me}.tsx`, `app/(app)/profile/[id].tsx`, `chat/[id].tsx`,
  `filters.tsx` (modal), `edit/{photos,tags,bio,basics}.tsx`, `settings.tsx`, `about.tsx`. Los placeholders
  (`ComingSoonScreen`) son vuestros: sustituid el contenido de la ruta por vuestra pantalla.
- Cabeceras: el Stack no tiene cabecera; cada pantalla pone su `TopBar` en `Screen header`.
- Barra de pestañas: `KawaiiTabBar` (ya montada). Contadores: `useTabBadgesStore.getState().set({ likes: 3, chats: 1 })`.
  testIDs: `tab-discover`, `tab-likes`, `tab-chats`, `tab-me`.
- Dentro de una pestaña, `Screen` ya reserva el hueco de la barra flotante. Si pintas algo a mano pegado al borde
  inferior (p. ej. los botones de Descubrir), usa `useTabBarSpace()` (px que ocupa la barra; 0 fuera de pestañas).
- `ComingSoonScreen` (`title`, `back?`, `close?`, `tone?`, `right?`, `testID?`) para rutas aún sin diseño.
- Overlays globales de la zona privada: `src/features/app-overlays` (ya montado una vez en `app/(app)/_layout.tsx`).

## Tests
Mocks disponibles en `test/mocks/`: reanimated, gesture-handler, expo-haptics, expo-linear-gradient, expo-font,
expo-splash-screen, expo-status-bar, expo-system-ui (además de RN, svg, router, image…). `renderWithTheme` en
`test/ui/render-with-theme.tsx`.
