# profile-card: listo para usar

Átomos presentacionales para pintar a OTRA persona (cards del feed/likes, perfil público). Todo se importa desde
`src/features/profile-card` (ruta relativa, p. ej. `../../profile-card`). Sin lógica de producto ni llamadas.

```tsx
import { NameSticker, PhotoCarousel, ProfileBadges, ProfileSummary, TagStickerRow, toProfilePerson } from "../../profile-card";
```

## Modelo

- `toProfilePerson(source)` → `ProfilePerson`. Acepta `DiscoveryProfileCard` (feed, likes, deshacer), `PublicProfile`
  (`GET /api/profiles/:id`) o un `ProfilePerson` ya normalizado (idempotente). Ordena fotos por posición, pone las
  etiquetas compartidas primero, calcula `sharedTagsCount` si falta y rellena `photos` con `photoUrl` en payloads viejos.
- `PersonSource` = `DiscoveryProfileCard | PublicProfile | ProfilePerson` (lo que aceptan los compuestos).
- Helpers: `nameWithAge(person)` («Lucía, 29»), `sortTagsForDisplay(tags)`, `sharedTags(tags)`,
  `groupOtherTagsByCategory(tags)` (`{ category, label, tags }[]` en el orden del catálogo), `tagCategoryLabel(cat)`.
- `profileBadges(person, { includeShared?, includeFarther? })` → `ProfileBadge[]` (`kind`, `label`,
  `accessibilityLabel`, `tone`, `icon`) en orden fijo: Nuevo · Te dio like · N en común · Un poco más lejos.
- `describeIntent(intent)` → `{ label, sentence, icon, tone }` («Busca pareja», «Algo casual»,
  «Conocer gente», «A ver qué pasa»); `null` si no hay intención. `describeIntents(lookingFor)` → todas
  (sin repetir, orden canónico); `intentsText(descriptors, sentence?)` las une con « · ».

## Componentes

### `PhotoCarousel`
Fotos de una persona con `expo-image` (caché memoria+disco y precarga de todas sus fotos).
Props: `photos`, `name` (texto alternativo y placeholder sin fotos), `width`, `height`,
`mode?: "tap" | "swipe"` (def. `tap`: zonas de toque izq/der + segmentos arriba · `swipe`: carrusel horizontal
arrastrable + puntos abajo), `index?` + `onIndexChange?` (controlado), `interactive?` (def. true; desactívalo si otro
gesto gestiona los toques), `onPress?` (toque en modo `swipe`), `radius?`, `tape?` (washi en las esquinas de arriba),
`preload?` (def. true), `indicatorInset?`, `style?`, `testID?` (`-prev`, `-next`, `-pager`).

```tsx
<PhotoCarousel photos={person.photos} name={person.displayName} width={w} height={w * 1.25} mode="swipe" onPress={open} />
```

### `NameSticker`
Nombre y edad en pegatina Mochiy troquelada. `name`, `age` (`null` = sin edad), `size?: "md" | "lg"`, `color?:
PastelName` (def. blanca), `rotate?` (def. -2), `pop?` (se pega al montarse), `style?`, `testID?`.
Colócala solapando el borde inferior de la foto (`marginTop: -22`).

### `ProfileBadges`
Fila de `Pill` con el sistema de insignias. `person` (card, perfil o `ProfilePerson`), `size?: "sm" | "md"`,
`limit?`, `singleLine?`, `includeShared?` (def. true), `includeFarther?` (def. true), `testID?`
(`-newcomer`, `-likedYou`, `-shared`, `-farther`).

### `IntentBadge`
Qué busca: una chapita pastel con icono por intención (solapadas si hay varias) + el texto de todas unidas
con « · ». `intents` (`lookingFor`, 1–4), `size?: "sm" | "md"`, `sentence?` (frases completas «Busca una
relación»), `style?`, `testID?`. Sin intenciones no pinta nada.

### `TagStickerRow` / `TagCloud`
- `TagStickerRow`: una sola fila de `TagSticker` (compartidas primero, en limonada con destello) y un «+N».
  `tags`, `limit?` (def. 3), `sharedOnly?`, `size?` (def. `sm`), `diecut?` (sobre fotos), `style?`, `testID?`.
- `TagCloud`: `tags`, `layout?: "flat" | "grouped"` (grouped = «N en común contigo» con destello y luego el resto por
  categoría con su color), `size?` (def. `md`), `limit?` (solo flat), `animateShared?` (pop escalonado), `testID?`.

### `BioNote`
La bio escrita a mano (Yomogi) en una nota adhesiva con washi. `bio`, `color?` (def. limonada), `tilt?`,
`numberOfLines?`, `style?`, `testID?`. No pinta nada si no hay bio.

### `ProfileSummary`
Bloque de información bajo las fotos. `profile` (`PersonSource`), `variant?: "feed" | "full"`, `showName?`
(def. false: el contenedor suele poner `NameSticker` sobre la foto), `style?`, `testID?`.
- `feed`: insignias, qué busca + distancia, fila de etiquetas (compartidas primero), bio (4 líneas).
- `full`: insignias (sin «en común», que ya encabeza las etiquetas), frase de intención + distancia, bio completa y
  `TagCloud` agrupada.
También exporta `MetaLine` (`intent`, `distanceLabel`, `sentence?`).

## Abrir el perfil completo (desde cualquier pestaña)

Vive en Descubrir (`src/features/discovery`): pinta el perfil al instante con la card que ya tienes y lo refresca con
`GET /api/profiles/:id`.

```tsx
import { useOpenProfile } from "../../discovery";

const openProfile = useOpenProfile();
openProfile(card, {
  origin: "likes",                                   // "discover" | "likes" | "matches" | "chat" | "other"
  onAction: ({ action, response }) => dropFromList(card.id), // tras ✕/♥ en el perfil (response null si lo gestionó Descubrir)
  onSafetyAction: (kind) => dropFromList(card.id)            // "blocked" | "reported"
});
```

El perfil completo registra la acción (`POST /api/discovery/actions`), lanza la celebración si hay match
(`useMatchCelebrationStore`) y vuelve atrás; con match vivo muestra «Enviar mensaje» → `chatHref(conversationId)`.
