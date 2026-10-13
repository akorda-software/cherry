# Identidad visual: «Libreta kawaii»

Sistema de diseño de la app móvil de Cherry (decisión D-2026-09-29 en `decisions.md`). Dirección elegida por el propietario el 2026-09-29: **neobrutalismo
kawaii** con forma de libreta de papelería japonesa. Cada perfil es una página de scrapbook: fotos pegadas con
washi tape, etiquetas como pegatinas troqueladas y un sello «¡ME GUSTA!» que cae de golpe. Rechaza el arquetipo del
sector (foto a sangre + degradado oscuro + interfaz blanca genérica).

- API de cada componente con ejemplos: `apps/mobile/src/shared/ui/DS_READY.md`.
- Capa de arte (iconos, papel, Mochi, washi, sellos, notas, pegatinas, logo, celebraciones):
  `apps/mobile/src/shared/ui/art/README.md`.
- Escaparates vivos (solo desarrollo): `/kitchen-sink` (componentes en todos sus estados) y `/art` (ilustración).

## Principios

1. **Tinta sobre pastel.** Todo relleno pastel lleva tinta ciruela encima; nunca texto blanco sobre pastel. El texto
   normal cumple ≥ 4,5:1 (placeholders incluidos, con `text.faint`).
2. **Contorno + sombra dura.** Los elementos tienen contorno de tinta de 2–3 px y una sombra de tinta desplazada y sin
   desenfoque. Al pulsar, el elemento se hunde hacia su sombra. Una sola elevación por elemento.
3. **El estado nunca depende solo del color.** Forma, icono, trazo o texto acompañan siempre al color (pegatina
   elegida con ♥, bloqueada con rayas + ✕ + tachado, en común con destello, no disponible a trazos).
4. **La decoración vive en los bordes.** Washi, destellos y pegatinas nunca tapan caras ni texto.
5. **Un momento de autor por pantalla.** El resto del movimiento es de sistema: pulsar, pegar, aparecer.
6. **La app abraza.** Voz cálida y optimista (tono Ted Lasso), español de España con tuteo, errores que dicen qué
   pasó y cómo seguir.

## Arquitectura de tokens

Capas con dependencia unidireccional:

```
tokens/primitives → themes (roles semánticos) → providers (useTheme) → primitives → composites → pantallas
```

- **Primitivos** (`src/shared/ui/tokens/primitives/`): color, tipografía, grosores, elevación, espaciado, radios,
  tamaños, opacidad y movimiento.
- **Tema** (`themes/light-theme.ts`, nombre `libreta-kawaii`): roles semánticos (`semantic.text`, `surface`, `action`,
  `tag`, `category`, `state`, `layout`…). `createTheme` permite variantes con el mismo contrato.
- **Acceso**: siempre con `useTheme()`. Nada de hex sueltos en pantallas ni componentes.
- `shared/ui` no contiene lógica de producto: rebrandear es editar tokens y tema.

## Color

| Grupo | Tokens | Uso |
|---|---|---|
| Tinta | `ink #2B1938`, `inkSoft`, `inkFaint` | Contornos, texto, sombras duras, iconos |
| Papel | `paper #FFF6FB`, `paperDeep`, `dot #E9D5EC`, `white` | Fondo de página con trama de puntos, superficies |
| Pasteles | `fresa`, `menta`, `lavanda`, `limonada`, `cielo`, `melocoton`, `tomate` | Cada uno con `fill` (rellenos), `soft` (fondos tranquilos) y `deep` (texto de acento ≥ 4,5:1) |
| Velos | `scrim`, `scrimStrong` | Fondo de hojas y modales, lectura sobre foto |

Roles clave: `action.like` (fresa), `action.pass` (lavanda: decir que no no es un drama), `action.undo` (limonada),
`tag.*` (neutral blanco, elegida menta, bloqueada tomate suave con tinta tomate, en común limonada),
`category.<categoría>` (un pastel por categoría de etiqueta), `state.*` (info cielo, éxito menta, peligro tomate,
aviso limonada, cada uno con su `Soft`).

## Tipografía

Fuentes cargadas en `app/_layout.tsx` con `expo-font` (subconjuntos latinos en `assets/fonts`); el splash nativo se
mantiene hasta que están listas.

- **Rubik** (`regular`, `medium`, `bold`, `extraBold`, `black`): toda la interfaz. Los titulares (`fonts.display`) van
  en Black con interletraje cerrado; `fonts.hand` es Rubik Medium (nada de letra «a mano»).
- **Logo**: la palabra «cherry» en Fraunces Black (SOFT 100, opsz 144; OFL), convertida a trazados y retocada a mano
  en `src/shared/ui/art/wordmark-path.ts`. Las bolas de las dos erres son las cerezas, unidas por los rabitos y una
  hoja. No se carga como fuente. El icono de la app son las dos erres con sus cerezas sobre amarillo.

Escala (`theme.primitives.text`): `hero 40`, `title1 30`, `title2 24`, `title3 19`, `body 16`, `bodyStrong 16`,
`callout 15`, `label 15`, `caption 13`, `micro 11 (mayúsculas)`, `button 17`, `buttonSmall 15`, `hand 20`,
`stamp 26 (mayúsculas)`, `numeral 22`.

Reglas: usa siempre `<Text variant=…>`; **nunca `fontWeight`** (en Android cada peso es otra familia). `Text` ya
limita el escalado del sistema por variante (`maxFontSizeMultiplier`) para que los elementos apretados no se rompan.

## Forma y profundidad

- **Grosores** (`border`): superficies grandes (tarjetas, hojas, barra de pestañas, botones `lg`, botones redondos
  `lg`/`xl`) `bold` 3 px; controles (botones `md`/`sm`, campos, pegatinas `md`/`lg`, conmutador, interruptor)
  `regular` 2,5 px; detalles pequeños (insignias, contadores, pegatinas `sm`, círculos de icono) `thin` 2 px.
- **Elevación** (`elevation.xs…xl` = 1, 2, 4, 6, 8 px): sombras `boxShadow` duras en tinta. Los pulsables pintan la
  sombra como una capa propia bajo la cara (`PressableScale`), de modo que la cara se hunde hacia ella y la tapa; así
  el recorte de fotos (`clip`) nunca recorta la sombra.
- **Radios** (`radius`): `xs 6`, `sm 10`, `md 16`, `lg 22`, `xl 28`, `pill`. Tarjetas 16–22; pastillas solo en
  chips y botones; hojas inferiores `xl` arriba.
- **Espaciado** (`spacing`): 2, 4, 8, 16, 24, 32, 40, 56. Margen de página 24 (`layout.screenPadding`).
- **Tamaños**: objetivo táctil mínimo 48; botones 60/52/40; botones redondos 40/48/64/76; barra de pestañas 68.

## Movimiento

Gramática (reanimated 4, `src/shared/ui/motion`):

| Gesto | Cómo | Token |
|---|---|---|
| Pulsar | la cara se hunde hacia su sombra; los redondos además se aplastan y vuelven con rebote | `spring.snappy` (+ `pop` al soltar) |
| Pegatina | se despega y se pega: escala 1,12 → 1 con un giro que se asienta | `spring.pop` (`usePop`, `PopIn`) |
| Papel | funde y se asienta | `spring.soft` (`Appear`) |
| Sello | cae de golpe: escala 1,6 → 1, opacidad rápida, háptico medio | `spring.pop` |
| Celebración | corazones y estrellas pastel | `spring.wobbly` |
| Hoja inferior | sube con curva de cajón (0,32 0,72 0 1) y se cierra arrastrando | 380 ms / 240 ms |
| Error | sacudida corta (`useShake`) + háptico de error | ~300 ms |

- Duraciones `quick 120`, `calm 220`, `slow 360`, `celebrate 900`; curvas `outQuint`, `outBack`, `inOut`.
- **Reducir movimiento**: los muelles usan `ReduceMotion.System`; `Appear`, `PopIn`, `Wiggle`, `useShake`, la hoja y
  los avisos cambian desplazamientos por fundidos cortos; los bucles (brillo de esqueletos, rayas de progreso) se
  paran o solo laten.
- **Hápticos** (`haptics`, no-op en web): selección al elegir etiqueta, cambiar de pestaña, conmutador e interruptor;
  ligero al cruzar el umbral de swipe; medio en like; éxito en match; error en fallos.

## Componentes

Inventario (API completa en `DS_READY.md`):

- **Página**: `Screen` (papel de puntos, safe areas, teclado, cabecera y pie fijos, hueco de la barra de pestañas),
  `TopBar` (atrás/cerrar con `router.back()` y vuelta segura, título normal o grande), `Stack`, `Inline`, `Divider`
  (línea discontinua), `Surface`/`Card`, `ListSection` + `ListRow`/`SettingsRow`.
- **Texto**: `Text`, `Heading`.
- **Controles**: `Button` (primary fresa, secondary blanco, soft lavanda, danger tomate, ghost, ink; lg/md/sm; icono;
  cargando con puntitos; deshabilitado pegado al papel), `IconButton` (40/48/64/76, contador), `PressableScale`
  (base de cualquier pulsable), `TagSticker` (el componente estrella: neutral, elegida, bloqueada, en común, no
  disponible; troquelada sobre fotos), `SegmentedControl` (pulgar que se desliza con muelle), `TextField` (resaltador
  al enfocar, sombra que crece, error con sacudida, contador, tamaño gigante para el onboarding), `Switch`,
  `RangeSlider`, `Slider`.
- **Identidad y avisos**: `Avatar` (inicial Mochiy sobre pastel estable por nombre, aro de «nuevo»), `Badge`,
  `Pill` (insignias del sistema: Nuevo · Te dio like · En común · Un poco más lejos).
- **Estados**: `Skeleton`/`SkeletonText`/`SkeletonGroup` (pastel con brillo), `LoadingDots`, `LoadingScreen`,
  `EmptyState` (Mochi con humor + acción útil), `ErrorState` (qué pasó + reintentar), `FormMessage`, `ProgressBar`
  (rayas que avanzan; modo por pasos).
- **Capas**: `Sheet` (hoja inferior que se cierra arrastrando, con el velo, con ✕ o con atrás), `ConfirmSheet`,
  avisos (`useToast`/`toast` + `ToastHost`: pegatina torcida que llega desde arriba y se va sola).
- **Movimiento**: `Appear`, `PopIn`, `usePop`, `Wiggle`, `useShake`, `useOnChange`, `springs`, `timings`,
  `easings`, `stagger`, `haptics`.
- **Arte** (capa propia): `Icon` (69 iconos SVG de trazo redondeado; único set permitido), `PaperBackground`,
  `Mascot` (Mochi, 8 caras), `Logo`, `WashiTape`, `Stamp`, `StickyNote`, `Sticker`, `Deco`/`Sparkle`,
  `PolaroidFrame`, `HeartBurst`, `Confetti`.

## Navegación

- Raíz (`app/_layout.tsx`): fuentes + splash, `GestureHandlerRootView`, barra de estado oscura, fondo del sistema en
  papel, proveedores (tema, configuración, sesión, bootstrap) y `ToastHost`.
- Zona privada (`app/(app)/_layout.tsx`): guard de sesión y onboarding (con estados de carga y error de la libreta),
  `Stack` sin cabecera (cada pantalla trae su `TopBar`) y `AppOverlays` montado una vez encima. Pantallas: `(tabs)`,
  `profile/[id]`, `chat/[id]`, `filters` (modal), `edit/{photos,tags,bio,basics}`, `settings`, `about`.
- Pestañas (`app/(app)/(tabs)/_layout.tsx`): **Descubrir · Likes · Chats · Yo** con `KawaiiTabBar`, una pastilla
  blanca flotante sobre el papel (respeta el inset inferior) donde la pestaña activa se convierte en una pegatina
  pastel con su nombre (fresa, limonada, cielo y lavanda) y hace pop. Contadores desde `useTabBadgesStore`. En
  Android la barra se oculta con el teclado abierto.
- Rutas canónicas y ayudantes en `src/shared/ui/app-shell/routes.ts` (`appShellRoutes`, `profileHref`, `chatHref`).

## Plataforma y accesibilidad

- Solo tema claro (`userInterfaceStyle: "light"` en `app.config.ts`); el modo oscuro está pendiente (ver `11-deuda-tecnica-pendiente.md`).
- Safe areas siempre (`Screen`, `TopBar`, barra de pestañas, hojas, avisos).
- Teclado: `Screen` y `Sheet` evitan el teclado con `KeyboardAvoidingView` (el pie de acciones sube con él).
- Atrás: el gesto de iOS y el botón/gesto de Android funcionan siempre; cierran hojas (`onRequestClose`) y modales.
- Objetivos táctiles ≥ 48 (los componentes añaden `hitSlop` cuando se dibujan más pequeños).
- Todo lo pulsable sin texto exige `accessibilityLabel`; roles nativos (`button`, `checkbox`, `switch`, `tab`,
  `tablist`, `adjustable`, `progressbar`, `alert`); los errores y avisos se anuncian.
- Las acciones por gesto (swipe, arrastrar hojas) tienen siempre alternativa en botones.

## Prohibido

Eyebrow/kicker sobre titulares; texto con degradado; glassmorphism decorativo; tarjetas anidadas; modales para tareas
que no los necesitan; iconos que no sean del set (emoji solo como contenido de etiquetas); ilustración tipo boceto o
`feTurbulence`; texto blanco sobre pastel; `fontWeight` con las fuentes de la marca; hex sueltos fuera de los tokens.

## Verificación

- `/kitchen-sink` muestra cada componente en todos sus estados (incluidas la barra de pestañas con contadores, hojas y
  avisos) para revisarlos en capturas (`.impeccable/review/ds/`).
- Tests del contrato de tokens y de los componentes clave en `apps/mobile/test/ui/*` (botones, pegatinas, conmutador,
  campos, hojas, avisos, barra de pestañas) y del armazón en `apps/mobile/test/router/*`.
