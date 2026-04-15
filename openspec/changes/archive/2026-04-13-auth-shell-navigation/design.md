# Design: Auth Shell Navigation

## Technical Approach

Build a minimal Expo Router runtime in `apps/mobile` that keeps auth/session ownership in the existing auth foundation and moves navigation into presentation/app-shell adapters. Route tree:

```text
apps/mobile/app/
├── _layout.tsx
├── index.tsx
├── (public)/
│   ├── _layout.tsx
│   └── login.tsx
└── (app)/
    ├── _layout.tsx
    ├── settings.tsx
    └── (tabs)/
        ├── _layout.tsx
        ├── home.tsx
        └── user.tsx
```

`(public)` owns login only. `(app)` owns the authenticated Drawer. `(tabs)` owns the canonical `home` and `user` routes. Drawer Home/User entries navigate to those tab paths; they never register duplicate screens.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Route ownership | Tabs own `home` and `user`; Drawer links to them | Separate drawer screens reusing same components | Prevents duplicate deep links, state, and tests |
| Header ownership | Drawer layout owns private headers; Tabs hide headers | Per-tab headers or mixed ownership | One source of truth avoids nested-header drift |
| Auth boundary | Root/provider reads session, `(app)/_layout` guards private routes | Router calls from application services | Preserves current auth foundation and keeps router in presentation |
| Logout behavior | Shared logout presenter calls `createLogoutSession`, clears local session state, then `router.replace("/(public)/login")` | Dedicated logout route/screen | Logout is an action, not content; private tree unmount prevents back restoration |

## Data Flow

```text
Secure storage -> Auth presentation session provider -> Expo Router layouts/screens
      |                    |                          |
      |                    -> login/logout actions ---|
      -> createSessionManager / createLogoutSession
```

Bootstrap: root provider loads cached session with existing auth services. `index.tsx` redirects signed-out users to `/(public)/login` and signed-in users to `/(app)/(tabs)/home`. If a private route is opened without session, `(app)/_layout.tsx` redirects to login.

Login: `login.tsx` renders generic placeholder content plus Google/Apple CTAs. CTA adapters call existing native provider + `createCompleteAuthCallback`; on success the provider stores the returned `SessionBundle` in presentation state and navigates to canonical Home.

User/Settings: both consume the same session provider. User shows `session.user`. Settings is separate from User, may also show the same summary block, and exposes logout.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/mobile/package.json` | Modify | Add Expo, Expo Router, React Navigation, RN test deps |
| `apps/mobile/vitest.config.ts` | Modify | Switch mobile UI tests to `jsdom` and setup for router/render tests |
| `apps/mobile/app/**` | Create | Route groups, layouts, canonical screens, redirects |
| `apps/mobile/src/features/auth/presentation/session-shell-provider.tsx` | Create | Presentation-only session state, bootstrap, sign-in, sign-out adapters |
| `apps/mobile/src/features/auth/presentation/login-screen.tsx` | Create | Login route adapter using existing auth services |
| `apps/mobile/src/shared/ui/app-shell/**` | Create | `ShellScaffold`, `DrawerContent`, `PlaceholderScreen`, `UserSummaryCard` |
| `apps/mobile/src/features/auth/application/complete-auth-callback.ts` | Modify | Optional navigation callback/port after persistence |
| `apps/mobile/src/features/auth/presentation/index.ts` | Modify | Export presentation adapters/hooks |

## Interfaces / Contracts

```ts
type AuthShellState =
  | { status: "loading"; session: null }
  | { status: "signed-out"; session: null }
  | { status: "signed-in"; session: SessionBundle };

interface AuthShellActions {
  signInWith(provider: "google" | "apple"): Promise<void>;
  signOut(): Promise<void>;
}
```

These stay in presentation and compose existing application services; auth domain/application logic does not import router APIs.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Session provider bootstrap/sign-in/sign-out state transitions | Vitest with mocked auth services and router |
| Unit | Drawer content actions and placeholder components | Testing Library render assertions |
| Integration | Route guard redirects for root and private layouts | Expo Router test harness or mocked router segments under strict TDD |
| Integration | Tabs/Drawer converge on canonical Home/User routes | Render shell, trigger tab press + drawer press, assert same route/screen instance |
| Integration | Logout clears session and blocks back return | Mock `createLogoutSession`, navigate to private route, logout, assert login + private tree removed |
| E2E | None installed | Defer; integration tests are the executable contract for this change |

## Migration / Rollout

No migration required. This is additive runtime/bootstrap work on top of the existing mobile auth foundation.

## Open Questions

- [ ] None blocking; implementation should confirm the exact Expo Router testing helper package chosen during RED setup.

## Implementation Decomposition Guidance

1. Bootstrap Expo/Router dependencies and mobile test environment.
2. Add session-shell provider and root redirects/guards.
3. Add public login route wired to existing auth flows.
4. Add private Drawer + nested Tabs with canonical Home/User routing.
5. Add Settings + shared logout action.
6. Add reusable placeholder UI primitives and finish navigation/logout integration tests.
