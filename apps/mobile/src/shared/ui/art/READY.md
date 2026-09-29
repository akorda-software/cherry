# Capa de arte: lista

Todo exportado desde `src/shared/ui` (y `src/shared/ui/art`). API completa en `README.md`; iconos en `ICONS_READY.md`.

- `Icon` (69 iconos, `IconName`, `iconNames`) y `PaperBackground` (papel de puntos, `tone` pastel con fundido).
- `Mascot` (Mochi): 8 moods (`happy`, `love`, `wink`, `sleepy`, `surprised`, `sad`, `celebrate`, `thinking`),
  cualquier pastel, respiración + parpadeo + saltito en `celebrate`, respeta «reducir movimiento».
- `Logo` (palabra «snack» vectorizada como pegatina con corazón; `variant`, `fill`, `height`).
- Papelería: `WashiTape`, `Stamp` (con `slam`), `StickyNote`, `Sticker` (con `pop`), `Deco`/`Sparkle`, `PolaroidFrame`.
- Celebración: `HeartBurst` y `Confetti` (`trigger`, `autoPlay` o `ref.fire()`; ≤ 24 partículas en el hilo de UI).
- Marca: `assets/images/icon.png`, `adaptive-icon*.png` (primer plano, fondo y monocromo), `splash-icon.png`,
  `favicon.png`, enlazados en `app.config.ts`.
- Escaparate solo-dev: `/art`. Tests: `src/shared/ui/art/*.test.tsx`.
