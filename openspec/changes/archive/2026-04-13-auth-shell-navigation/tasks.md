# Tasks: Auth Shell Navigation

## Phase 1: Router Bootstrap + Guard Foundations

- [x] 1.1 RED — Add failing route-guard tests in `apps/mobile/test/router/root-navigation.test.tsx` for `app/index.tsx` redirecting signed-out users to `/(public)/login`, signed-in users to `/(app)/(tabs)/home`, and `app/(app)/_layout.tsx` blocking private access without session.
- [x] 1.2 GREEN — Update `apps/mobile/package.json` and `apps/mobile/vitest.config.ts` for Expo Router/React Navigation/jsdom test support; create `apps/mobile/app/_layout.tsx`, `apps/mobile/app/index.tsx`, and minimal provider wiring to satisfy the guard tests.
- [x] 1.3 REFACTOR — Extract reusable router render/mocking helpers into `apps/mobile/test/router/**` and expose clean session-shell entry points from `apps/mobile/src/features/auth/presentation/index.ts`.

Acceptance focus: root bootstrap resolves the correct public/private entry before any feature screen renders.

## Phase 2: Public Login Flow Batch

- [x] 2.1 RED — Add failing UI tests in `apps/mobile/src/features/auth/presentation/login-screen.test.tsx` for welcome placeholder content, Google/Apple actions, loading/error handling, and post-success handoff into canonical Home.
- [x] 2.2 GREEN — Create `apps/mobile/src/features/auth/presentation/session-shell-provider.tsx` with bootstrap/sign-in/sign-out state, then update `apps/mobile/src/features/auth/application/complete-auth-callback.ts` to accept an optional completion callback without importing router APIs.
- [x] 2.3 GREEN — Create `apps/mobile/app/(public)/_layout.tsx`, `apps/mobile/app/(public)/login.tsx`, and `apps/mobile/src/features/auth/presentation/login-screen.tsx` wired to existing provider + callback services through the session-shell provider.
- [x] 2.4 REFACTOR — Normalize auth presentation exports and extract any repeated CTA or async-state UI into `apps/mobile/src/features/auth/presentation/**` or `apps/mobile/src/shared/ui/app-shell/**`.

Acceptance focus: `login` is the only public screen and successful auth lands on `/(app)/(tabs)/home`.

## Phase 3: Private Drawer + Canonical Tabs Batch

- [x] 3.1 RED — Add failing shell integration tests in `apps/mobile/test/router/private-shell.test.tsx` proving Tabs own `home`/`user`, Drawer Home/User target those exact routes, and deep links resolve a single canonical screen instance.
- [x] 3.2 GREEN — Create `apps/mobile/app/(app)/(tabs)/_layout.tsx`, `home.tsx`, and `user.tsx`; create `apps/mobile/app/(app)/_layout.tsx`; add `ShellScaffold`, `DrawerContent`, `PlaceholderScreen`, and `UserSummaryCard` under `apps/mobile/src/shared/ui/app-shell/**`.
- [x] 3.3 GREEN — Create `apps/mobile/app/(app)/settings.tsx` as a separate private route using the shared shell primitives and authenticated user summary.
- [x] 3.4 REFACTOR — Centralize drawer item config, canonical route constants, and header ownership so Drawer owns headers and Tabs keep headers hidden.

Acceptance focus: Home/User exist once, remain tab-owned, and are reachable identically from tabs, drawer, and deep links.

## Phase 4: Logout + Shell Hardening Batch

- [x] 4.1 RED — Add failing tests in `apps/mobile/src/features/auth/presentation/session-shell-provider.test.tsx` and `apps/mobile/test/router/logout-flow.test.tsx` for logout invoking `createLogoutSession`, replacing to `/(public)/login`, and preventing back-navigation restoration of private shell content.
- [x] 4.2 GREEN — Wire Drawer/Settings logout actions through `apps/mobile/src/features/auth/presentation/session-shell-provider.tsx` and existing `apps/mobile/src/features/auth/application/logout-session.ts`, ensuring private layouts unmount after sign-out.
- [x] 4.3 REFACTOR — Remove presentation/router leakage from non-UI layers, clean shared placeholder/session formatting, and verify route/layout file ownership remains within approved scope only.

Acceptance focus: logout is an action, not a screen; after sign-out, private history cannot be reopened.
