## Exploration: Reusable design tokens and UI system foundation for the existing Expo mobile starter

### Current State
The mobile app already has the authenticated/public shell split, canonical drawer-plus-tabs routing, and placeholder auth/shell screens in place. UI composition is still extremely thin: `apps/mobile/src/shared/ui/index.ts` exports nothing, app-shell pieces are simple placeholders, and current screens render raw DOM elements (`div`, `button`, `main`, `section`) instead of a reusable mobile component system.

There is also no token or theme layer yet. `apps/mobile/package.json` contains Expo/router/navigation dependencies, but no styling or design-system dependency. That means this change can still establish the foundation cleanly, but it ALSO means the proposal must deliberately decide how to move from today's DOM-oriented placeholder rendering and JSDOM tests to a reusable Expo-native UI system without breaking strict TDD discipline.

### Affected Areas
- `apps/mobile/package.json` — proposal must formalize whether the starter stays dependency-light or introduces a UI/styling dependency.
- `apps/mobile/src/shared/ui/index.ts` — current empty export surface; natural entry point for a reusable UI system.
- `apps/mobile/src/shared/ui/app-shell/*.tsx` — existing shell composites should be rebuilt on top of shared primitives instead of raw elements.
- `apps/mobile/src/features/auth/presentation/login-screen.tsx` — current public screen should consume semantic components/tokens, not direct markup.
- `apps/mobile/app/(app)/**` and `apps/mobile/app/(public)/**` — route files should stay thin and compose app-specific screens from the shared system.
- `apps/mobile/test/**` and `apps/mobile/vitest.config.ts` — current JSDOM-based testing approach is a constraint for any native-first UI foundation.
- `openspec/changes/mobile-ui-foundation/exploration.md` — exploration artifact for this change.

### Approaches
1. **Internal token-driven UI foundation with minimal dependencies** — create a dedicated reusable mobile UI layer owned by the repo, with typed tokens, semantic themes, a small theme provider, and shared primitives/composites built on React Native-compatible components.
   - Pros: Maximizes starter reusability, keeps component API under project control, avoids locking future apps into a third-party styling abstraction, and matches the product goal of swapping theme/branding more than rebuilding components.
   - Cons: The team must design and maintain token contracts, theme resolution, and primitive APIs itself; proposal must also address test strategy migration carefully.
   - Effort: Medium

2. **Adopt an external styling/UI system library as the foundation** — make a library such as a utility-first or component framework the core abstraction for tokens, themes, and components.
   - Pros: Faster initial setup, prebuilt theming primitives, and less groundwork to build from scratch.
   - Cons: Strong library lock-in, higher upgrade risk for a starter meant to survive across future apps, harder to keep a stable project-owned component contract, and more friction if future apps outgrow the chosen library's opinions.
   - Effort: Medium/High

### Recommendation
Recommend **Approach 1**: establish **one repo-owned mobile UI package/layer** with four explicit levels:

1. **Primitive tokens** — raw scales and immutable values: spacing, radius, typography sizes/weights/line-heights, shadows, motion durations, and palette primitives.
2. **Semantic tokens** — role-based aliases that components consume: `color.surface.default`, `color.text.primary`, `color.border.subtle`, `color.action.primary.background`, `space.screen.padding`, `size.control.md`, etc.
3. **Themes** — brand/light/dark mappings from semantic roles to primitive values. Future apps SHOULD mainly replace theme objects and brand assets, not component implementations.
4. **Components** — primitives and a few composed shell/auth building blocks that consume ONLY semantic tokens, NEVER raw primitive values inline.

That layering gives you ONE stable component API and ONE stable token contract while still allowing multiple future apps to look different. It also keeps the architecture honest: components remain reusable, themes carry branding, and primitives stay brand-agnostic.

For this starter, the initial scope should stay TIGHT:
- **Token foundation**: color, spacing, radius, typography, border width, elevation/shadow, opacity, icon/control sizes, and motion duration.
- **Theme foundation**: light theme first, dark theme contract from day one, plus app-brand overrides as configuration.
- **Primitive components**: `Screen`, `Surface`, `Stack`, `Inline`, `Text`, `Heading`, `Button`, `IconButton`, `Divider`, `Avatar/UserBadge`.
- **Starter composites**: `AppHeader`, `NavListItem`, `Card`, `EmptyState`, `FormMessage`, and shell/auth-specific presenters built FROM primitives.

Keep route files and feature screens app-specific, but make them consume the shared UI layer. In other words: **shared system owns tokens/themes/primitives; app owns composition and feature meaning**.

### Risks
- **Over-abstraction risk**: if the first version tries to cover every future app, the starter will become bloated before real product needs validate the API.
- **Semantic leakage risk**: if screens/components bypass semantic tokens and reach directly for primitive values, multi-brand theming will collapse quickly.
- **Testing transition risk**: current mobile UI tests are JSDOM + DOM-element oriented; proposal must define whether to migrate to React Native testing primitives, keep a web-compatible adapter strategy, or phase the migration gradually under strict TDD.
- **Accessibility/dark-mode risk**: reusable tokens that ignore contrast, dynamic type, focus states, and dark theme invariants will create hidden rework later.
- **Package-boundary risk**: moving too much app meaning into the shared system will turn a reusable foundation into a pseudo-product layer.

### Ready for Proposal
Yes — the proposal should formalize: the package/module boundary for the reusable UI system, the exact token taxonomy, semantic-token naming rules, theme override strategy for future branded apps, the first primitive/component set, the rule that shared components consume semantic tokens only, and the testing strategy for introducing a true mobile UI system under strict TDD.
