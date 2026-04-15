# Proposal: Mobile UI Foundation

## Intent

Create one repo-owned mobile design-token and UI-system foundation that can skin future apps by theme/branding instead of rebuilding components, while preserving the existing auth shell, placeholder UX, and strict TDD workflow.

## Scope

### In Scope
- Define primitive tokens, semantic tokens, and theme contracts for mobile UI.
- Introduce a reusable shared UI layer for primitives plus a small starter set of composites.
- Rebuild current shell/auth placeholder presenters on top of that layer without changing route ownership.
- Establish the testing migration needed for Expo-native UI under strict TDD.

### Out of Scope
- Product-specific business components, copy, flows, or screen logic.
- Full design-system coverage, animations polish, or exhaustive dark-mode implementation.
- Replacing the completed auth/session/navigation foundations.

## Capabilities

### New Capabilities
- `mobile-ui-foundation`: Token taxonomy, themes, primitive components, starter composites, and semantic-token-only consumption rules for reusable mobile UI.

### Modified Capabilities
- None.

## Approach

Adopt an internal, dependency-light architecture inside `apps/mobile/src/shared/ui/`:
- **Primitive tokens**: raw scales for color palette, spacing, radius, typography, border, elevation, opacity, sizes, motion.
- **Semantic tokens**: role aliases consumed by components only (`surface`, `text`, `border`, `action`, `screen`, `control`).
- **Themes**: base light theme now, dark-theme contract and brand override shape from day one.
- **Components**: primitives (`Screen`, `Surface`, `Stack`, `Inline`, `Text`, `Heading`, `Button`, `IconButton`, `Divider`, `UserBadge`) and starter composites (`AppHeader`, `NavListItem`, `Card`, `EmptyState`, `FormMessage`).

Ownership: tokens define values, themes map semantics, primitives render generic UI, composites assemble reusable patterns, screens/routes keep app meaning and orchestration.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/mobile/src/shared/ui/**` | Modified | Add tokens, themes, primitives, composites, exports |
| `apps/mobile/src/features/auth/presentation/login-screen.tsx` | Modified | Swap raw markup for shared UI composition |
| `apps/mobile/src/shared/ui/app-shell/*.tsx` | Modified | Rebuild placeholder shell pieces from primitives |
| `apps/mobile/app/(app)/**`, `app/(public)/**` | Modified | Keep routes thin; consume updated screens |
| `apps/mobile/test/**`, `apps/mobile/vitest.config.ts` | Modified | Formalize native-compatible UI test strategy |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Over-abstraction | Med | Limit v1 scope to starter tokens/components only |
| Semantic leakage | High | Spec rule: shared components consume semantic tokens only |
| Test friction | High | Design phase must define incremental TDD-safe test migration |

## Rollback Plan

Keep route ownership and feature orchestration unchanged; if the shared layer fails, revert presenters/screens to current placeholder rendering and remove the new UI module surface without touching auth/session/navigation foundations.

## Dependencies

- Existing `mobile-auth-foundation` and `mobile-shell-navigation` capabilities
- Strict TDD from `openspec/config.yaml`

## Success Criteria

- [ ] A new `mobile-ui-foundation` spec can be written from this proposal without guessing architecture boundaries.
- [ ] Current login, home, user, and settings placeholders can adopt the shared UI layer without becoming product-specific.
- [ ] Future apps can vary primarily through theme/token overrides rather than component rewrites.
