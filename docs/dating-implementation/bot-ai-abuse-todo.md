# Bot And AI Abuse TODO

## Purpose

Track product, backend, and mobile work needed to reduce bots, fake profiles, AI-generated spam, scams, and automated abuse.

This is not required to start the first Expo implementation, but it should be addressed before beta or any public user acquisition.

## Risk Model

Snack should assume attackers can use AI to create convincing profiles, generate chat openers, rotate accounts, and adapt to simple rules.

Main risks:

- automated account creation.
- AI-generated fake bios and photos.
- scam funnels moved into chat.
- mass likes to farm matches.
- scripted harassment or spam messages.
- profile cloning from social media.
- coordinated reports against real users.
- evasion through device reinstall or session cycling.

## Product Principles

- Friction should increase with risk, not punish every normal user upfront.
- Safety controls must be visible and fast.
- Moderation should preserve enough evidence for review.
- Do not claim that AI detection is definitive.
- Avoid collecting sensitive verification data unless it has a clear retention and deletion policy.

## MVP Must-Haves Before Beta

- Rate limit auth callbacks, profile updates, swipes, reports, and chat sends.
- Add backend abuse events for signup, profile completion, swipe bursts, match bursts, message bursts, report/block actions, and suspicious failures.
- Add device/session based risk signals using existing session families and installation ids.
- Add per-profile daily swipe and message thresholds with soft throttles.
- Add report reasons that include scam, fake profile, harassment, explicit content, underage, and other.
- Add block/report entry points from discovery profile detail and chat.
- Add admin/moderation view or at least queryable backend operations for open reports.
- Store moderation/audit metadata for reports, blocks, and deleted accounts.
- Ensure deleted or blocked users cannot keep messaging through existing WebSocket joins.

## Backend TODO

### Abuse Events

Create a durable `abuse_events` or `risk_events` table.

Suggested fields:

- `user_id`.
- `profile_id`.
- `session_family_id`.
- `device_id`.
- `event_type`.
- `target_profile_id`.
- `ip_hash` if available and privacy-approved.
- `user_agent_hash` if available and privacy-approved.
- `metadata` JSONB.
- `risk_score_delta`.
- `inserted_at`.

Initial events:

- auth callback success/failure.
- refresh token reuse.
- profile completed.
- profile photo uploaded.
- location updated.
- swipe action.
- match created.
- message sent.
- report submitted.
- block submitted.
- account deleted.
- push token registered.

### Rate Limits

Add server-side limits before public testing.

Recommended v1 limits:

- auth attempts per installation and IP window.
- profile updates per profile per hour.
- photo upload intents per profile per hour.
- swipes per profile per rolling hour and day.
- likes per profile per rolling hour.
- messages per conversation per minute.
- outbound first messages per profile per day.
- reports per profile per day to prevent brigading.

Limit behavior:

- Return `429` with a stable error code and optional retry time.
- Log a risk event.
- Use soft limits first where product UX can recover.

### Risk Score

Add a lightweight profile/user risk score.

Signals to consider:

- very fast onboarding completion.
- repeated failed auth/provider callbacks.
- many likes with low profile dwell time.
- many first messages with similar text.
- many reports received.
- device used by multiple accounts.
- repeated image upload attempts rejected by content type/size.
- profile text changed repeatedly after reports.
- links, handles, phone numbers, or payment keywords in bio/chat.

Risk actions:

- require additional verification.
- lower discovery ranking.
- temporarily throttle actions.
- require moderation review.
- shadow-disable outbound discovery/chat only if policy approves.

### Content Rules

Add backend text checks for profile bio and chat.

Initial checks:

- links and URL shorteners.
- payment keywords.
- phone numbers and external handles.
- repeated identical messages.
- obvious scam phrases.
- underage indicators.

Do not block legitimate users too aggressively. Prefer review/throttle for ambiguous signals.

### Photo Safety

Add an async photo moderation pipeline after direct R2 upload.

TODO:

- Store moderation status per photo.
- Mark uploaded photos as pending until checked if needed.
- Run image moderation provider or manual review queue.
- Detect duplicate/reused images by perceptual hash if feasible.
- Detect obvious non-human, explicit, or synthetic images where provider supports it.

### Admin And Moderation

Minimum beta tooling:

- list open reports.
- view reporter and target profile summary.
- view recent messages for reported conversation where policy allows.
- mark report reviewed/actioned/dismissed.
- disable profile.
- revoke session families.
- inspect risk events for a profile.

## Mobile TODO

### UX Surfaces

- Add report entry point on discovery profile detail.
- Add report/block/unmatch entry point in conversation.
- Add clear confirmation after report/block.
- Remove blocked/reported users from visible local surfaces immediately after success.
- Add rate-limit UI for `429` responses.
- Add verification-required UI if backend introduces that state.
- Add safety education in onboarding or settings.

### Client Signals

Send useful non-sensitive context where backend contract allows:

- installation id from existing device/session foundation.
- app version.
- platform.
- locale.
- timezone.
- push permission state if relevant.

Do not collect contacts, clipboard, exact background location, or invasive device identifiers for v1.

## AI-Specific TODO

### Generated Text

AI text detection is unreliable. Use it as one risk signal only.

Better signals:

- repeated semantic patterns across accounts.
- very high outbound volume.
- same opener sent to many matches.
- links or contact transfer attempts.
- report feedback loops.

### Generated Photos

Synthetic image detection should be treated as advisory.

Better signals:

- duplicate image hashes across accounts.
- reverse image/provider signals if available.
- photo moderation provider confidence.
- account behavior after match.

### Chat Assist Policy

If Snack later adds AI-assisted replies, define clear policy first.

Open questions:

- Should users know when AI suggested a message?
- Should generated openers be limited?
- Should AI refuse scammy or manipulative content?
- Should generated content be watermarked in metadata?

## Data And Privacy TODO

- Define retention for abuse events.
- Define retention for reports after account deletion.
- Hash IP/user-agent if stored.
- Avoid storing raw exact location in abuse metadata.
- Avoid storing full message text in risk metadata unless moderation policy requires it.
- Document user-facing safety and privacy policy before beta.

## Rollout Order

1. Add report/block UX and backend event logging.
2. Add basic rate limits and `429` client handling.
3. Add moderation report operations.
4. Add risk event aggregation and simple thresholds.
5. Add photo moderation queue.
6. Add advanced duplicate/synthetic/spam detection only after real abuse patterns appear.

## Open Decisions

- Whether beta requires selfie or social verification.
- Whether profiles with pending photo moderation can enter discovery.
- Whether first message content can include links.
- Whether phone numbers and external handles are blocked or only risk-scored.
- Whether repeated AI-like messages trigger user-visible friction or silent throttling.
- Whether moderation tooling lives in Phoenix admin, separate internal app, or SQL-first ops for early beta.
