# Proposal: Auth Shell Navigation

## Intent

Extend the completed mobile auth foundation with a reusable Expo Router shell: one public Login flow and one authenticated shell using a Drawer around Tabs. This adds navigation/runtime structure without recreating session or auth ownership already established by `mobile-phoenix-foundation`.

## Scope

### In Scope
- Bootstrap minimal Expo + Expo Router runtime in `apps/mobile` under strict TDD.
- Add public `login` route and private shell with canonical `home` and `user` tab routes.
- Add authenticated drawer entries for Home, User, Settings, and Logout, with Home/User targeting the same tab routes.
- Provide reusable placeholder-quality screens, shell layout primitives, and auth-boundary adapters.

### Out of Scope
- Reworking provider auth, token refresh, secure storage, or backend session contracts.
- Feature-rich screen content, profile editing, or settings business flows.

## Capabilities

### New Capabilities
- `mobile-shell-navigation`: Expo Router public/private shell, nested drawer+tabs composition, canonical route ownership, and logout-aware navigation.

### Modified Capabilities
- `mobile-auth-foundation`: authenticated session completion now hands off into the private shell boundary instead of stopping at auth-only flows.

## Approach

Use Expo Router route groups: public `(public)/login`; private `(app)` owning a Drawer layout; Tabs nested beneath the authenticated shell for `home` and `user`; separate private `settings`; drawer `logout` as an action, not a screen. Route ownership: tabs own `home` and `user`; drawer items deep-link to those exact routes.

Module boundaries: auth/session orchestration remains in `apps/mobile/src/features/auth`; route/layout adapters live in presentation; reusable shell UI primitives and placeholder screens live in `apps/mobile/src/shared/ui`; Expo runtime/dependency wiring stays at app root. Logout clears session through existing session manager, then routes to Login and collapses private navigation history.

Next spec/design focus: specify route contracts and auth-gate scenarios first, then design header ownership, drawer-content composition, and bootstrap sequence.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/mobile/package.json` | Modified | Expo/Expo Router/navigation deps |
| `apps/mobile/app/**` | New | Route groups, layouts, canonical routes |
| `apps/mobile/src/features/auth/**` | Modified | Auth-boundary/navigation adapters |
| `apps/mobile/src/shared/ui/**` | New/Modified | Shell UI, drawer content, placeholders |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Duplicate Home/User routes | Med | Tabs are sole owners; drawer only links |
| Router leaking into app layer | Med | Keep router APIs in presentation adapters |
| Nested navigator header confusion | Med | Define one header owner in design |
| Expo bootstrap broadens scope | Low/Med | Limit to minimal runtime needed for shell |

## Rollback Plan

Revert Expo Router shell files and dependency changes while preserving existing auth/session modules; the prior foundation remains valid because auth ownership is unchanged.

## Dependencies

- Completed `mobile-phoenix-foundation`
- Expo Router and required React Navigation packages

## Success Criteria

- [ ] Login is the only public flow and authenticated users land in the private shell.
- [ ] Home and User exist once as canonical tab routes, reachable from both tabs and drawer.
- [ ] Settings is separate from User and offers logout access.
- [ ] Shell primitives are reusable as future-app foundation.
