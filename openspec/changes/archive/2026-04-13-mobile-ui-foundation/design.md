# Design: Mobile UI Foundation

## Technical Approach

Extend `apps/mobile/src/shared/ui/` into a repo-owned design-system slice that sits under current auth/navigation presentation. Tokens and themes define visual meaning, `ThemeProvider` resolves semantics, primitives render generic building blocks, composites assemble reusable patterns, and screens keep feature logic plus route ownership. Existing login/home/user/settings screens migrate by swapping raw markup for shared UI composition only.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|---|---|---|---|
| Token layering | Flat tokens vs primitive+semantic | Primitive catalog + semantic contract | Enables future brand/app swaps without changing component APIs. |
| Theme boundary | Inline imports vs provider/context | `ThemeProvider` + `useTheme()` | Centralizes semantic resolution and keeps components from reaching raw tokens. |
| Shared UI scope | Product widgets vs generic system | Generic primitives + starter composites only | Prevents domain leakage and keeps future-app reuse viable. |
| Screen migration | Move logic into UI layer vs presentation-only adoption | Screens keep orchestration; UI layer handles styling/layout | Preserves auth/session/navigation foundations and route ownership. |

## Data Flow

```text
primitive-tokens -> semantic-theme-maps -> ThemeProvider -> primitives -> composites -> screens/routes
                                              ^                                        |
                                              |----------------------------------------|
                                 screen state/copy/navigation stay outside UI system
```

Sequence: screen reads feature/session state -> passes content/handlers into composites -> composites compose primitives -> primitives call `useTheme()` -> semantic roles resolve to concrete React Native style objects.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/mobile/src/shared/ui/tokens/primitives/{color,spacing,radius,size,typography,border,elevation,opacity,motion}.ts` | Create | Raw scales only. |
| `apps/mobile/src/shared/ui/tokens/semantics/{color,text,icon,surface,border,action,state,layout}.ts` | Create | Role contracts consumed by UI. |
| `apps/mobile/src/shared/ui/themes/{theme-types,light-theme,create-theme,index}.ts` | Create | Theme model and default light theme. |
| `apps/mobile/src/shared/ui/providers/theme-provider.tsx` | Create | Provider + hook boundary. |
| `apps/mobile/src/shared/ui/primitives/{screen,surface,stack,inline,text,heading,button,icon-button,divider,user-badge}.tsx` | Create | Generic presentational building blocks. |
| `apps/mobile/src/shared/ui/composites/{app-header,card,empty-state,form-message,nav-list-item}.tsx` | Create | Shared composed patterns. |
| `apps/mobile/src/shared/ui/app-shell/{placeholder-screen,user-summary-card,drawer-content,shell-scaffold}.tsx` | Modify | Rebuild using primitives/composites; keep route behavior. |
| `apps/mobile/src/shared/ui/index.ts` | Modify | Export tokens/themes/providers/components. |
| `apps/mobile/app/_layout.tsx` | Modify | Mount `ThemeProvider` above current session provider tree. |
| `apps/mobile/src/features/auth/presentation/login-screen.tsx` | Modify | Adopt shared primitives/composites without changing auth flow. |
| `apps/mobile/app/(app)/(tabs)/home.tsx`, `user.tsx`, `apps/mobile/app/(app)/settings.tsx` | Modify | Use screen wrappers/shared UI while keeping current logic. |
| `apps/mobile/test/ui/**`, `apps/mobile/src/**/*.test.tsx`, `apps/mobile/vitest.config.ts`, `apps/mobile/test/setup.ts` | Modify/Create | UI contract tests and RN-safe matchers/mocks. |

## Interfaces / Contracts

```ts
type PrimitiveTokens = { color: {...}; spacing: {...}; radius: {...}; typography: {...} };
type SemanticTokens = {
  screen: { background: string };
  text: { default: string; muted: string; inverse: string };
  action: { primaryBg: string; primaryFg: string; dangerBg: string };
  surface: { base: string; elevated: string };
  border: { subtle: string; strong: string };
};
type AppTheme = { name: string; primitives: PrimitiveTokens; semantic: SemanticTokens };
```

Dependency direction: `tokens/primitives` -> `tokens/semantics` contract -> `themes` -> `providers` -> `primitives` -> `composites` -> `screens/app routes`. Business/application/domain layers MUST NOT import UI tokens.

Taxonomy: primitives own layout/typography/interaction rendering; composites own generic arrangement and state presentation; screen wrappers own feature copy, handlers, and session-derived content.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Primitive token catalogs and semantic contracts | Red-first snapshots/object assertions for keys and immutability. |
| Unit | `createTheme` and provider resolution | Render hooks/components under provider, assert semantic values map correctly. |
| Unit | Primitive/composite states | Testing Library role/text/state assertions for default, disabled, destructive, message variants. |
| Integration | App-shell rebuild | Existing router tests assert canonical routes still render through new shared UI. |
| Integration | Screen adoption | Login/home/user/settings tests verify business behavior unchanged while shared UI renders expected structure. |
| E2E | None installed | Treat integration suite as executable contract under strict TDD. |

## Migration / Rollout

No migration required. Implement in slices: tokens/theme/provider -> primitives -> composites -> app-shell rebuild -> screen adoption. Keep old markup only until each slice goes green, then remove it.

## Open Questions

- [ ] Confirm whether v1 icon usage stays text-only or introduces a small icon adapter with the same semantic color contract.

## Implementation Decomposition Guidance

1. Add failing tests for token catalogs, semantic contract, and theme provider. 2. Implement light theme plus exports. 3. Add primitive component tests, then primitives. 4. Add composite tests, then composites. 5. Refactor app-shell pieces onto the new system. 6. Migrate login/home/user/settings one screen at a time, preserving existing auth/navigation assertions.
