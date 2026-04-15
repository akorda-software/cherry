## Exploration: Reusable authenticated app shell UI for the existing Expo + Phoenix mobile foundation

### Current State
The foundation already defines the mobile layering, backend-owned auth/session lifecycle, secure session persistence, and auth use cases in `apps/mobile/src/features/auth`. The mobile workspace does **not** yet contain an Expo runtime, Expo Router route tree, or authenticated shell screens, so this change is the first place where app navigation and reusable mobile UI composition will be formalized.

The current auth contracts already support the requested shell: provider adapters normalize Google/Apple credentials, `createCompleteAuthCallback` persists backend-issued sessions, `createSessionManager` handles bootstrap/refresh/logout redirects, and `SessionBundle.user` exposes enough profile data for an initial User screen.

### Affected Areas
- `openspec/changes/auth-shell-navigation/exploration.md` — exploration artifact for this change.
- `apps/mobile/package.json` — will need Expo/Expo Router/navigation dependencies once implementation starts.
- `apps/mobile/src/features/auth/application/complete-auth-callback.ts` — login CTA flow should hand off to authenticated navigation after session persistence.
- `apps/mobile/src/features/auth/application/session-manager.ts` — existing signed-out redirect port should become the shell/auth boundary adapter.
- `apps/mobile/src/features/auth/presentation/` — natural home for login screen and auth-boundary presenters.
- `apps/mobile/src/shared/ui/` — reusable shell UI primitives, headers, drawer content, and placeholder screen components belong here.
- `packages/contracts/src/session.ts` — current authenticated user payload supports the initial User screen without new backend work.

### Approaches
1. **Single route ownership with tabs nested inside the authenticated drawer** — one authenticated route group owns the shell, tabs define canonical `home` and `user` screens, and drawer items deep-link to those same tab routes plus separate `settings` and `logout` actions.
   - Pros: Avoids duplicate screens, matches the accepted product IA, keeps URL/route ownership clear, and lets Home/User appear in both tabs and drawer without forking components.
   - Cons: Requires deliberate drawer customization because default drawer registration can tempt teams to create duplicate route files.
   - Effort: Medium

2. **Separate drawer screens and separate tab screens that reuse shared screen components** — create one route per drawer item and one route per tab, then share presentational components under the hood.
   - Pros: Straightforward mental model for teams new to nested navigation.
   - Cons: Duplicate route state, duplicate analytics/deep-link targets, higher risk of Home/User drifting apart, and more test surface for no product value.
   - Effort: Medium/High

### Recommendation
Recommend **Approach 1**: make the authenticated shell a **single private route group** with a **Drawer as the outer authenticated container** and **Tabs nested inside it**. The canonical content routes should be the tab routes (`home`, `user`), while drawer entries for Home and User should navigate to those exact tab URLs instead of registering second copies.

That composition cleanly separates responsibilities:
- **Public shell**: login route only.
- **Private shell**: auth gate + session bootstrap + drawer container.
- **Primary destinations**: tabs for Home and User.
- **Secondary actions**: drawer-only Settings and Logout.

This is the reusable base because future apps can swap placeholder screen content without replacing the auth boundary, shell layout, or session-aware navigation wiring.

### Risks
- **Route duplication risk**: If Home/User are declared once for tabs and again for drawer, navigation state and deep links will diverge. Avoid this by treating tab routes as canonical and making drawer items imperative links to them.
- **Navigator coupling risk**: If session bootstrap logic directly imports router APIs, application-layer auth code will leak presentation concerns. Keep router calls behind presentation/navigation adapters.
- **Drawer + tabs complexity**: Nested navigators increase test/setup cost and can create confusing headers/back behavior. Proposal/design should define one header ownership strategy and one source of truth for route names.
- **Foundation gap risk**: `apps/mobile` is currently a TypeScript/Vitest workspace, not a configured Expo app. Proposal must explicitly cover the minimal runtime/dependency bootstrap required for Expo Router without reopening auth foundation scope.

### Ready for Proposal
Yes — the proposal should formalize: the public/private route-group structure, canonical authenticated route names, drawer item behavior for shared tab destinations, auth-gate/session-bootstrap flow, initial screen/component boundaries, required Expo/Expo Router/navigation dependencies, and the TDD-first slice order for implementing shell navigation without duplicating routes.
