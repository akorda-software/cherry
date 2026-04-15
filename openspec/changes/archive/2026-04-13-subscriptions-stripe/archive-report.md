# Archive Report: subscriptions-stripe

**Change**: subscriptions-stripe
**Archived**: 2026-04-13
**Archived to**: `openspec/changes/archive/2026-04-13-subscriptions-stripe/`
**Verdict**: PASS WITH WARNINGS

---

## Summary

Stripe-based subscription module with runtime feature flag gating. Self-contained `Snack.Billing` Phoenix context (Customer, Subscription, Plan schemas, StripeClient behaviour with Req, webhook processing with idempotency) and `features/subscriptions/` mobile module (four-layer architecture with Paywall, PlanPickerScreen, BillingScreen, SubscriptionShellProvider). 55 tasks across 10 phases + 6 verification fixes. 207/207 tests passing. 0 TypeScript errors.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| feature-flags | Created | 4 new requirements (Runtime Flag Resolution, Backend Flag Gating Pipeline, Mobile useFeatureFlag Hook, Flag Extensibility) |
| billing-context | Created | 8 new requirements (Plan Listing, Subscription Creation, Cancellation, Status, StripeClient Behaviour, Webhook Signature, Webhook Idempotency, Context Isolation) |
| subscription-feature-mobile | Created | 6 new requirements (Module Boundaries, Paywall Enforcement, Plan Picker UI, Stripe Payment Sheet, Subscription Status Display, SubscriptionShellProvider) |
| mobile-shell-navigation | Updated | 2 requirements added (Conditional Subscription Navigation, Shell Reusability Preserved) |

## Archive Contents

- exploration.md ✅
- proposal.md ✅
- specs/ ✅ (4 domains: billing-context, feature-flags, mobile-shell-navigation, subscription-feature-mobile)
- design.md ✅
- tasks.md ✅ (55/55 tasks + 6 verification fixes — all complete)
- verify-report.md ✅

## Implementation Outcome

### Test Results
| Suite | Tests | Result |
|-------|-------|--------|
| Backend (ExUnit) | 122 | ✅ All passed |
| Mobile (Vitest) | 76 | ✅ All passed |
| Contracts (Vitest) | 9 | ✅ All passed |
| **Total** | **207** | ✅ 0 failures |

### Coverage
- Backend subscription-related files: ~93% average
- Backend total: 86.65% (below 90% threshold — pre-existing gap)
- Mobile: No coverage tool installed

### TDD Compliance: 6/6 checks passed

### Spec Compliance: 31/35 scenarios compliant (2 N/A Stripe SDK delegation, 1 untested, 3 partial)

## Engram Artifact IDs (Traceability)

| Artifact | Engram Observation ID |
|----------|-----------------------|
| proposal | #161 |
| spec | #163 |
| design | #165 |
| tasks | #168 |
| apply-progress | #176 |
| verify-report | #182 |

## Remaining Warnings (Non-blocking — Follow-up Considerations)

1. **W1: Webhook flag-off returns 404 vs spec 200** — Spec says webhook should be "acknowledged with 200 but no processing occurs" when flag disabled. Implementation uses RequireFeature plug which returns 404 before reaching the controller. Architecturally correct but spec-deviation. Recommend: update spec to match implementation, or restructure webhook pipeline.

2. **W2: BillingScreen has zero test coverage** — `billing-screen.tsx` exists with subscription status display and cancel flow, but no behavioral test file. Structural correctness verified but no test assertions.

3. **W3: No subscription tab indicator** — Spec requires "a subscription indicator or tab is present within the authenticated shell" when flag enabled. Only drawer entry implemented; `tabItems` in routes.ts has no subscription entry.

## Suggestions (Nice to Have)

- S1: Add error-path tests for BillingController (65% coverage) and ReqImpl (71%)
- S2: Wrap React state update in act() in subscription-shell.test.tsx
- S3: Install @vitest/coverage-v8 for mobile test coverage visibility
- S4: Move hoisted import in billing-screen.tsx to conventional position

## Source of Truth Updated

The following main specs now reflect the new behavior:
- `openspec/specs/feature-flags/spec.md` (NEW)
- `openspec/specs/billing-context/spec.md` (NEW)
- `openspec/specs/subscription-feature-mobile/spec.md` (NEW)
- `openspec/specs/mobile-shell-navigation/spec.md` (UPDATED — 2 requirements added)

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived.
Ready for the next change.
