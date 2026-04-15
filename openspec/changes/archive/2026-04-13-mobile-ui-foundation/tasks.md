# Tasks: Mobile UI Foundation

## Phase 1: Token + Theme Foundation Batch
Acceptance focus: semantic roles resolve through one provider contract and remain swappable without component API changes.

- [x] 1.1 RED — Add failing theme-contract tests in `apps/mobile/test/ui/tokens-theme.test.tsx` for primitive catalogs, semantic role keys, `createTheme`, provider fallback, and theme swapping.
- [x] 1.2 GREEN — Create `apps/mobile/src/shared/ui/tokens/primitives/{color,spacing,radius,size,typography,border,elevation,opacity,motion}.ts`, `tokens/semantics/{color,text,icon,surface,border,action,state,layout}.ts`, `themes/{theme-types,light-theme,create-theme,index}.ts`, and `providers/theme-provider.tsx`.
- [x] 1.3 REFACTOR — Update `apps/mobile/src/shared/ui/index.ts` and add `apps/mobile/test/ui/render-with-theme.tsx` so token/theme imports stay centralized and tests stop touching raw theme setup.

## Phase 2: Primitive Component Batch
Acceptance focus: primitives consume semantic tokens only and expose accessible, reusable states.

- [x] 2.1 RED — Add failing tests in `apps/mobile/test/ui/primitives.test.tsx` for `screen`, `surface`, `stack`, `inline`, `text`, `heading`, `button`, `icon-button`, `divider`, and `user-badge` covering default, disabled, destructive, and selected/readable states.
- [x] 2.2 GREEN — Create `apps/mobile/src/shared/ui/primitives/{screen,surface,stack,inline,text,heading,button,icon-button,divider,user-badge}.tsx` using `useTheme()` only for visual decisions.
- [x] 2.3 REFACTOR — Extract shared style/variant helpers under `apps/mobile/src/shared/ui/primitives/` and tighten prop types so primitives stay generic and future-app reusable.

## Phase 3: Composite + Provider Wiring Batch
Acceptance focus: generic composed patterns and app shell render through the new UI system without changing route ownership.

- [x] 3.1 RED — Add failing tests in `apps/mobile/test/ui/composites.test.tsx` and extend `apps/mobile/test/router/private-shell.test.tsx` for `app-header`, `card`, `empty-state`, `form-message`, `nav-list-item`, drawer actions, and themed shell scaffolding.
- [x] 3.2 GREEN — Create `apps/mobile/src/shared/ui/composites/{app-header,card,empty-state,form-message,nav-list-item}.tsx`, rebuild `src/shared/ui/app-shell/{placeholder-screen,user-summary-card,drawer-content,shell-scaffold}.tsx`, and mount `ThemeProvider` in `apps/mobile/app/_layout.tsx`.
- [x] 3.3 REFACTOR — Normalize shared exports/config in `apps/mobile/src/shared/ui/{app-shell/index.ts,index.ts}` and keep route labels/constants in `src/shared/ui/app-shell/routes.ts` instead of component-local markup.

## Phase 4: Login Screen Migration Batch
Acceptance focus: login presentation moves to shared UI while auth flow, loading, errors, and redirect behavior stay unchanged.

- [x] 4.1 RED — Update `apps/mobile/src/features/auth/presentation/login-screen.test.tsx` to assert shared UI structure plus existing Google/Apple busy, error, and post-success home handoff scenarios.
- [x] 4.2 GREEN — Refactor `apps/mobile/src/features/auth/presentation/login-screen.tsx` and `auth-action-list.tsx` to compose `Screen`, `Card`, `Heading`, `Button`, and `FormMessage` without moving auth/session logic into shared UI.
- [x] 4.3 REFACTOR — Extract any reusable auth-presentational glue into `apps/mobile/src/features/auth/presentation/**` only when it remains feature-owned and does not leak product meaning into shared primitives/composites.

## Phase 5: Home/User/Settings Adoption Batch
Acceptance focus: current private screens adopt the UI foundation, preserve canonical routes/logout/session behavior, and avoid product-specific shared components.

- [x] 5.1 RED — Extend `apps/mobile/test/router/private-shell.test.tsx` and `logout-flow.test.tsx` to assert themed home/user/settings structure, preserved user summary rendering, and unchanged logout/private-history behavior.
- [x] 5.2 GREEN — Migrate `apps/mobile/app/(app)/(tabs)/home.tsx`, `user.tsx`, and `apps/mobile/app/(app)/settings.tsx` to shared primitives/composites, keeping existing `useSessionShell` and `useLogoutAction` ownership intact.
- [x] 5.3 REFACTOR — Remove obsolete raw placeholder markup, verify no business/application layer imports `src/shared/ui/tokens/**`, and leave the UI surface generic for future theme overrides.
