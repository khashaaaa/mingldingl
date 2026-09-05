# MingldIngl — Specs & Plans

The live record of design specs and implementation plans for this project. New feature work
gets appended here, not spun into new files (see the project's standing pruning rule).

Structure: **Open** (not yet built — full spec/plan detail kept, this is active reference
material), **Domain Model & Product Background** (living reference, not a task), and
**Outstanding Follow-ups** (the live backlog).

Shipped features are archived in [`shipped-log.md`](shipped-log.md), pruned to outcome
summaries. Check there before assuming a feature doesn't exist yet — when something here
ships, move its record over rather than leaving it in this file.

---

# Open — Not Yet Built

Nothing open right now — see [Outstanding Follow-ups](#outstanding-follow-ups) for the live
backlog.

---

# Domain Model & Product Background

## MingldIngl — Design Spec
**Date:** 2026-06-27 (infra/visual sections refreshed 2026-07-10)
**Author:** Solo developer + Claude
**Status:** Approved — core game design below still matches the running app; infra/visual/folder-structure sections were refreshed to match the current build (originally written pre-implementation, some details had drifted)

---

### Overview

MingldIngl is a gamified dating app targeting the Mongolian market, designed to solve the core failures of modern dating apps: ghosting, swipe fatigue, and lack of meaningful engagement. The app is open to all ages and situations (single parents, divorced adults, young adults) and replaces the disposable swipe loop with a score-based economy, gemstone tier identity, and progressive profile reveal that rewards real conversation.

---

### Repositories

| Repo | Purpose |
|---|---|
| `mingldingl_app` | React Native Expo mobile app (iOS + Android) |
| `mingldingl_engine` | ASP.NET Core API — monolithic, all business logic |
| `mingldingl_control` | React 19 + Vite internal admin panel (users, moderation, partners, config, Town Square, analytics); authenticates with the separate `AdminBearer` scheme |

---

### Infrastructure (current, 2026-07-10)

```
React Native Expo (iOS + Android + web)
    ↓ REST                          ↘ Supabase Auth (JWT) + Realtime (subscribed, but see gap below)
ASP.NET Core API (:5150)  ←→  local PostgreSQL 16
                                    ↓ nightly pg_dump
                              Supabase Storage (backups bucket)
```

- **Primary datastore is local Postgres**, not Supabase — outbound port 5432 to Supabase's host is blocked from this dev network, so the engine runs against `127.0.0.1:5432/mingldingl`. Supabase's direct-Postgres wire protocol is what's blocked; its HTTPS/WSS-based services (Auth, Realtime) are unaffected and still used.
- Supabase now serves two roles: **Auth** (phone/OTP → JWT, validated by the engine via JWKS) and a **nightly backup destination** (cron pg_dump → private Storage bucket). It is no longer the primary database or the photo storage backend.
- **Fixed (2026-07-10):** `useChat.ts`/`useRealtimeNudges.ts` used to subscribe to Supabase Realtime's `postgres_changes`, which only observes Supabase's *own* hosted Postgres — broken silently by the local-Postgres pivot (data saved fine, just never pushed live). Switched to Supabase Realtime's **Broadcast** API instead: the engine (`SupabaseBroadcastService`) explicitly pushes an event after each relevant write (new message, icebreaker/quiz response, date confirmed) to a topic the client is already subscribed to via `.on('broadcast', ...)`. Works regardless of where the underlying data lives. Verified live via two simultaneous browser sessions — a message sent by one appears in the other's open chat and as a nudge toast elsewhere in the app within ~1s, no refresh.
- **Photo storage is local disk**, served by the engine at `/uploads` — not Supabase Storage.
- **React Native Expo** talks to `mingldingl_engine` via REST for all business actions/data, and directly to Supabase for auth and realtime chat/nudge delivery.

---

### Tech Stack

| Purpose | Package |
|---|---|
| UI + theming | plain React Native `StyleSheet` over `lib/theme.ts` tokens (Tamagui removed 2026-09-03) |
| Navigation | `expo-router` |
| Auth/Realtime | `@supabase/supabase-js` (DB access removed — engine owns all data via REST now) |
| Server state | `@tanstack/react-query` |
| Client state | `zustand` |
| HTTP | `axios` |
| Image picker | `expo-image-picker` |
| Video calls | `react-native-agora` |
| Secure storage | `expo-secure-store` |
| i18n | `expo-localization` + `i18n-js` |

---

### Visual Design — Dark-Fantasy RPG Theme (current, replaces the original "Dark Luxury" direction)

#### Feel
Warcraft/tower-defense-adjacent dark fantasy, not premium-luxury minimalism as originally spec'd — the app went through a full RPG reskin (2026-07-03; that overhaul's design spec was folded into this section and the code — `lib/theme.ts` is the reference) plus a palette retheme afterward. Cinzel (display) + Alegreya (body) fonts. Single source of truth: `mingldingl_app/lib/theme.ts`.

#### Color Tokens (`lib/theme.ts` COLORS)

| Token | Value | Use |
|---|---|---|
| `bg` | `#0A0B10` | Night-sky page background |
| `panel` / `panelRaised` / `panelDeep` | `#12141C` / `#1A1E2A` / `#07080D` | Cards, sheets, depth layers |
| `gold` / `goldBright` | `#D97F1F` / `#F5A83C` | Primary CTA, gem highlights |
| `bronze` | `#4A5A6B` | Structural borders (stony blue-grey) |
| `ember` | `#C1461E` | Warm firelight accent |
| `text` / `textDim` | `#EDE4D3` / `#8F97A3` | Body text / muted |

#### Gem Tier Palette (Garnet → Emerald, renamed from the original Pebble → Diamond)

| Tier | Color | Score threshold |
|---|---|---|
| Garnet | `#7B2431` | 0 |
| Opal | `#B2EBF2` | 100 |
| Amethyst | `#CE93D8` | 300 |
| Sapphire | `#1E88E5` | 600 (admin-tunable: `tier.sapphire.threshold`) |
| Ruby | `#E53935` | 1000 |
| Emerald | `#50C878` | 2000 |

Thresholds are `ScoreService.TierDefaults` (`mingldingl_engine/src/MinglDingl.Engine/Services/ScoreService.cs`); the client hydrates them via `useTierThresholds`, see the note under Folder Structure.

The age-adaptive theme toggle in the original spec was never built — one theme ships for everyone.

---

### 1. Identity System

Every user has four identity layers:

| Layer | Description |
|---|---|
| **Profile** | Basic info (name, age, photos) and deep info (kids, habits, lifestyle) |
| **Gemstone Tier** | Visual rank calculated from cumulative score |
| **Reputation Score** | Affected by behavior — ghosting, positive tags, conversation quality |
| **Membership Level** | Free / Silver / Gold — unlocks deeper profile fields and features. (Platinum was retired 2026-08-18 by migration `RetirePlatinumTier`, which merged existing Platinum members into Gold; `MembershipController` accepts only these three.) |

#### Gemstone Tiers (ascending)
Garnet → Opal → Amethyst → Sapphire → Ruby → Emerald (thresholds in the palette table above; the original Pebble/Diamond names were renamed in the RPG reskin)

Tier is displayed visually on the user's profile card with a gem icon and animated border. Tier progression is purely score-based — no purchases can directly buy a tier.

#### Profile Fields
- **Basic (free):** Name, age, gender, city, 3 photos, short bio
- **Deep (membership-gated):** Kids, habits (smoking/drinking), lifestyle, religion, income range, more photos

Full profile completion on signup grants an immediate score bonus (+100 pts).

---

### 2. Score Economy

#### Earning Points
| Activity | Points |
|---|---|
| Complete full profile on signup | +100 |
| Daily login | +5 |
| Send first message in a match | +10 |
| Complete an icebreaker game | +20 |
| Complete a compatibility quiz | +15 |
| Match replies back (no ghost) | +10 |
| Receive a positive fun tag | +25 |
| Activity date confirmed | +50 |
| Video call completed | +30 |

#### Losing Points
| Activity | Penalty |
|---|---|
| Ghost a match (no reply 48h) | -15 |
| Receive a negative report | -30 |

#### Daily Match Budget
Per `ScoreService.DailyMatchBudget` (`Services/ScoreService.cs`):
- Base by membership: Free 5 / Silver 12 / Gold 20 requests per day
- +1 slot per 50 total score, plus +1 per gem-tier index (Garnet 0 … Emerald 5)
- Cap by membership: Free 12 / Silver 25 / Gold 40, plus the same gem-tier index

---

### 3. Match Engine

#### Matching Logic
- Candidates weighted by score proximity and gemstone tier (soft filter — not a hard wall)
- Location-aware (city/region in Mongolia)
- Age preference range set by user

#### Progressive Profile Reveal

| Milestone | Unlocked |
|---|---|
| Match accepted | First name, 1 photo, short bio |
| 5 messages exchanged | 2nd photo, age |
| 15 messages exchanged | 3rd photo, city district |
| 30 messages exchanged | Deep profile fields (if membership allows) |

If conversation dies (48h no reply), unlock progress freezes.

#### Anti-Ghosting
- 48h inactivity triggers a soft nudge notification
- Ghosting applies a score penalty
- Repeated ghosters get a "Slow Responder" tag visible to future matches

---

### 4. Engagement Engine

#### Icebreakers
First interaction in a new match is a prompted question/mini-game — both users answer independently, answers revealed simultaneously. Completing unlocks chat and earns +20 pts each.

#### Compatibility Quizzes
Short quizzes (5 questions) on values, lifestyle, interests. Results shown as compatibility % with each match. Earns +15 pts.

#### Activity Suggestions
After 15+ messages, the app surfaces contextual activity suggestions (coffee, hiking, cinema, board game café). Both users tapping "We're doing this" confirms an activity date and earns +50 pts each. Since the Flame Rite shipped, the pledge itself is refused until the rite is complete while `dating.flamerite.required` is on (`ActivityService.ConfirmAsync`).

#### Video Calls
- In-app video via **Agora SDK**
- `Match.VideoCallUnlocked` flips when the icebreaker completes (`EngagementService.CompleteIcebreakerAsync`), no longer on pledge
- A token is only minted once the Flame Rite has been accepted (`VideoController`, `POST /video/token`); TTL is `dating.flamerite.duration_minutes` (default 5) until the rite is completed, then the normal long call
- Max post-rite call duration: 30 minutes
- Call completion earns +30 pts each
- Video call history is private, not stored

---

### 5. Business Partner System

Verified businesses (cafés, cinemas, hiking operators) appear in activity suggestions.

#### Business Accounts
- Separate account type; profile includes name, category, location, photos, hours
- Verified badge shown in activity suggestion cards

#### User Ratings
After confirmed activity date, both users rate the business (1–5 stars + optional review). Aggregated into a public Business Reputation Score.

#### Business Monetization
| Feature | Model |
|---|---|
| Basic listing | Free |
| Featured placement in activity suggestions | Paid (monthly subscription) |
| Promoted activity packages | Paid per listing |

---

### 6. Monetization Layer

All monetization is additive — free users have a full experience.

| Feature | Model | Detail |
|---|---|---|
| **Fun Tags** | Paid (per tag or pack) | Personality labels gifted to matches, visible on their profile card |
| **Reputation Repair** | Paid (tiered pricing) | Reset/reduce reputation penalty from ghosting or reports |
| **Membership Tiers** | Subscription | Unlock deep profile, more daily matches, profile boost, see who liked you |
| **Score Boosters** | One-time purchase | Extra daily match slots, XP multiplier for 24h |
| **Profile Boost** | One-time purchase | Featured in discovery for 1–3 hours |

#### Membership Tiers
| Tier | Benefits |
|---|---|
| Free | 5 matches/day base (cap 12), basic profile, icebreakers, quizzes |
| Silver | 12 matches/day base (cap 25), deep profile view, see compatibility % |
| Gold | 20 matches/day base (cap 40), priority matching (`MatchesController` compatibility band), profile boost 1x/week, fun tag pack monthly |

Platinum was retired (2026-08-18, migration `RetirePlatinumTier` merged it into Gold). Match numbers are `ScoreService.DailyMatchBudget`; the other perks are the original spec's intent, not all of them wired.

---

### 7. Screen Inventory

| Screen | Route | Key Behavior |
|---|---|---|
| Phone input | `(auth)/phone` | +976 prefix, 8-digit Mongolian validation |
| OTP verify | `(auth)/otp` | 6-digit code, resend option |
| Onboarding wizard | `(onboarding)/index` | 4 steps: Name/Age/Gender → Bio/City → Photos (min 3) → Oath (`components/onboarding/OathStep.tsx`); POST /users + POST /users/me/oath; +100 pts |
| Discover | `(tabs)/discover` | Card stack; match/pass; daily budget counter |
| Matches list | `(tabs)/matches` | Progressive reveal info per message milestone |
| Chat | `chat/[matchId]` | Supabase Realtime; icebreaker banner; `FlameRiteCard` once the icebreaker is done; video icon once the rite is accepted |
| Icebreaker | `icebreaker/[matchId]` | Prompted question → simultaneous reveal when both answered |
| Quiz | `quiz/[matchId]` | 5 questions → compatibility % |
| Activity | `(tabs)/activity` | Business partner cards; "We're doing this" CTA |
| Profile | `(tabs)/profile` | Score, gem tier badge, photo grid, membership level |
| Membership | `membership` | Tier comparison, upgrade CTA |
| Video call | `video/[matchId]` | Agora RTC; 5-min Flame Rite framing before `flameRiteCompletedAt`, 30-min cap after |
| Town Square | `(tabs)/townsquare` | Next session countdown, RSVP / cancel (see Town Square under Done) |
| Town Square round | `townsquare-round/[sessionId]` | Agora call + icebreaker prompt + Yes/No; mutual Yes → match |
| Weave a Thread | `ship/new` | Fated Threads: two phone numbers → double-blind Ship |

---

### 8. Folder Structure

```
mingldingl_app/
├── app/
│   ├── _layout.tsx             # Root: providers, auth gate
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── phone.tsx
│   │   └── otp.tsx
│   ├── (onboarding)/
│   │   ├── _layout.tsx
│   │   └── index.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── discover.tsx
│   │   ├── matches.tsx
│   │   ├── activity.tsx
│   │   ├── townsquare.tsx      # 5th tab (middle) — Town Square
│   │   └── profile.tsx
│   ├── chat/[matchId].tsx
│   ├── icebreaker/[matchId].tsx
│   ├── quiz/[matchId].tsx
│   ├── video/[matchId].tsx
│   ├── activities/[matchId].tsx
│   ├── campaign/[matchId].tsx  # the dungeon map for one match
│   ├── ship/new.tsx            # Fated Threads — weave a thread
│   ├── townsquare-round/[sessionId].tsx
│   ├── business/[id].tsx
│   ├── membership.tsx
│   ├── progression.tsx, leaderboard.tsx, date-log.tsx
│   ├── edit-profile.tsx, settings.tsx, blocked-users.tsx
│   └── guides.tsx, privacy.tsx, terms.tsx
├── components/        # one shallow directory per surface, plus loose top-level
│   │                  # components — GameButton, AppCard, CandidateCard,
│   │                  # MessageBubble, ChestModal, etc.
│   ├── ui/            # the design system — GameButton, AppCard, CardEyebrow, Icon, ...
│   ├── modals/        # AlertModal, SheetModal (the shared action sheet), ChestModal, toasts
│   ├── onboarding/    # NameAgeStep, AboutStep, PhotosStep, OathStep
│   ├── profile/       # ProfileAvatar, OathCard — the character sheet's own pieces
│   ├── progression/   # XPBar, GemTierBadge, TrophyCase, ScoreHistoryList, ...
│   ├── chat/, quest/, settings/, townsquare/, video/, cards/, vfx/
│   ├── FlameRiteCard.tsx, OathSigil.tsx
│   └── RewardToastHost.tsx   # global reward/loot toast layer
├── hooks/             # flat, one per concern — useAuth, useDiscover, useMatches,
│                      # useChat, useIcebreaker, useQuiz, useActivity, useQuests,
│                      # useMembership, useRealtimeNudges, usePushNotifications, ...
├── lib/
│   ├── api/apiClient.ts + api/api.generated.d.ts  # typed REST client to the engine
│   ├── theme.ts       # COLORS/FONTS/SPACE/RADIUS — see Visual Design above
│   ├── tiers.ts        # gem tier colors + fallback thresholds; the live values
│                      # are hydrated from the engine (see useTierThresholds)
│   ├── i18n/           # index.ts (i18n-js setup, tKey) + en/mn tables + errors.{en,mn}.ts (err_<code> copy)
│   ├── realtime/subscribeWithRetry.ts  # Supabase Broadcast subscription with reconnect
│   ├── appFocus.ts     # foreground/background focus events
│   ├── api/queryKeys.ts + api/queryClient.ts  # react-query; queryClient owns the
│                      # MutationCache meta.invalidates/awardedSelector convention
│   └── supabase.ts    # auth + realtime only, no DB/storage access anymore
├── models/            # TypeScript interfaces (user, match, business)
├── store/
│   └── authStore.ts   # Zustand: session + pending toasts only. The profile is
│                      # react-query state (useProfile); it used to be mirrored
│                      # here and the two copies drifted.
├── babel.config.js
├── app.json
├── tsconfig.json
└── package.json
```

(The original spec described a per-feature `features/{name}/{components,hooks}` structure; the app shipped with flat `hooks/`/`lib/` directories and a `components/` tree grouped by surface rather than by feature.)

**Fixed (2026-07-10):** `lib/tiers.ts`'s `TIER_THRESHOLDS` used to disagree with the backend's authoritative `ScoreService.CalculateTier` (e.g. Amethyst at 250 client-side vs 300 server-side), so `authStore.addScore()`'s optimistic tier-up toast could fire early and then silently revert on the next profile refetch. Thresholds now match exactly (`[0, 100, 300, 600, 1000, 2000]`), and `tierForScore()` is derived from `TIER_THRESHOLDS`/`TIER_ORDER` rather than a separately-hardcoded chain, so the two can't drift apart again the way they did here. Both sides carry a comment pointing at the other.

**Superseded (2026-08-19):** the client no longer keeps a pinned copy at all — `lib/tiers.ts` holds `DEFAULT_TIER_THRESHOLDS` purely as a pre-fetch fallback, and `useTierThresholds` hydrates the live values from the engine, which is authoritative. Divergence is now structurally impossible rather than merely pinned.

---

### 9. Key Constraints

- **Solo developer** — monolithic engine, no microservices
- **Minimal cost** — local Postgres for dev (was Supabase free tier; Supabase is now backup-only), VPS for API in prod
- **Mongolian market** — phone login, mn + en i18n from day one
- **Expo web is actively used for dev/testing** (Playwright E2E, no device needed) — video calls are gated out on web by design, everything else works; mobile (iOS/Android) remains the real target for release
- **No real payments shipped** — membership tier upgrades are mocked, not wired to a payment gateway

---

### 10. Out of Scope (still true)

- AI-powered matching
- Real payment gateway integration
- Business partner admin dashboard

Shipped since the original MVP spec (no longer out of scope): push notifications (Expo push, `PushNotificationService`), a full gamification layer (daily quests, streaks, loot drops, milestones), realtime nudges, multi-select photo onboarding, and the dark-fantasy RPG visual overhaul.

---

# Outstanding Follow-ups

Salvaged from the per-feature SDD execution ledgers before those were pruned
(2026-08-19). These are the items that were consciously deferred during
execution rather than fixed, and that no Shipped record above captures. Purely
cosmetic and test-quality minors were dropped with the ledgers; what follows is
what still has a real consequence.

## Manual verification still owed

Three features shipped without the manual pass their own plans called for. All
three need the `verify` skill (real Supabase JWTs, full stack running):

- ~~**The Flame Rite — Task 11, Step 9: the two-account ladder walk.**~~ RUN and
  PASSED 2026-09-01, API-level with two real Supabase users (`e2e-rite-c/d`):
  token before any proposal 403 → pledge before rite 403 (`FlameRiteIncomplete`) →
  propose → decline clears the proposal and re-propose succeeds → duplicate propose
  while open 409 → self-accept 403 → token before acceptance 403, after acceptance
  200 → `/video/complete` → pledge 200 → attendance mismatch (see No-Show below).
  Flag retreat also verified with a second pair (`e2e-rite-e/f`):
  `dating.flamerite.required=false` (DB value + restart) let a rite-less pledge
  through 200; restoring the flag re-engaged the 403 on the same match. Not
  verified: the 5-minute vs long token TTL difference (the Agora token is opaque —
  would need decoding its privilege expiry) and the app UI screens themselves
  (jest-covered only); the decorative video countdown remains open below.
- **Fated Threads — the full 12-step pass**, summarised under "Still owed" in the
  Fated Threads entry above, including the five rechecks added after fix wave 1.
- **No-Show Tracking — a two-account attendance walk.** Mismatch → flag path RUN and
  PASSED 2026-09-01 (same `e2e-rite-c/d` pair): initiator answered attended=true,
  receiver attended=false → the denier's `NoShowFlagCount` went 0→1, `PenaltyApplied`
  latched on the confirmation, and `ReputationScore` correctly untouched below the
  threshold of 3. The threshold-crossing `RepeatedNoShowPenalty` leg was not walked
  live (needs three distinct-match mismatches) — that remains integration-test-only.
- **Membership billing cycles — the duration ChoiceRow's rendered layout** (MN
  label length, chip wrapping) and one real end-to-end upgrade call. Never
  visually verified; only `tsc` + bundle build + reading the JSX.

## Behavioral

- **`ShipService.RespondAsync` has no lock against two simultaneous responses.**
  A lost-update race can persist both slots as `Accepted` while `Status` stays
  `Pending` forever — a stuck thread that never sparks, never rewards, and needs
  manual DB cleanup. Fails safe (no corruption, no duplicate match, no privacy
  leak) and the 14-day expiry sweep eventually clears it, which is why it was
  parked. Note that `MatchPairing.PairLockKey` (added by the 2026-08-19
  duplication audit) is now exactly the tool this needs — the advisory-lock
  pattern is already proven on the other match-creation paths.
- **The video-screen countdown is decorative.** It resets on remount, is not
  anchored to token issue time or `FlameRiteAcceptedAt`, and reaching 0:00 does
  nothing. A user can read it as an enforced limit that isn't enforced.
- ~~**`Memberships.UserId` has no index.**~~ Closed 2026-09-01 — folded into the
  `AddCampaignRoomClaims` migration as planned.
- ~~**`AdminConfigControllerIntegrationTests.Update_TierThreshold_BackfillsStoredGemTiers`
  deadlocks intermittently under the parallel test run**~~ Closed 2026-09-03 after it
  turned CI red on an unchanged engine — the class now runs in the parallel-disabled
  `SerialCollection` (`tests/.../Integration/SerialCollection.cs`). Any future test
  that runs table-wide statements should join that collection.
- **Phone-verification account recovery + start-endpoint rate limiting.** See the
  "Open" list under the verify.mn entry above. Recovery-on-reinstall is the one with a
  real user-facing consequence.
- **`LoginThrottleService` is per-instance.** Fine for the current single-container
  deploy; a second instance halves the effective lockout. Needs shared state if the
  engine is ever scaled out.
- **`Cors:AllowedOrigins` must be set before any non-Development deploy** — the engine
  now throws at startup without it. Deliberate (fail closed), but it will stop a deploy
  that has not been updated.

## Known gaps, deliberately not built

- **Fated Threads' Pass-side blocking flow.** The design spec describes it; no
  task brief's reference code ever included it. Only the `BlockedUsers` *check*
  on `POST /ships` was implemented, never the secondary-checkbox UI.
- **`CreateAsync`'s "already matched" path** — as of 2026-08-31 it returns the same
  success + two-codes shape as every other outcome (no row written), so the
  earlier concern that it was distinguishable from ordinary success appears
  closed; the only residual signal is that neither nominee ever sees a prompt,
  identical to the blocked-Weaver case. Confirm during the manual pass.
- **Fated Threads' `/public/ship` landing page was unreachable until 2026-08-31** —
  the share text never carried the URL, so every invite before that date was
  code-only. Fixed in `lib/shipInvite.ts`; anyone holding an old share message
  still has a working code, just no link.
- ~~**No-Show Tracking's 48 h window and Fated Threads' 14-day expiry are hardcoded**~~
  Closed by the 2026-09-04 admin-config expansion: both are `ConfigKeys` entries now
  (`dating.attendance_check.delay_hours`, `ships.expiry_days`), read through
  `ActivityService` and `DailyMaintenanceBackgroundService.ShipExpiryFor(config)`.
- **Same-ship invite-code collision inside a single `CreateAsync`** would
  silently misroute slot B. Vanishingly unlikely, unguarded.

## Closed 2026-08-31 — audit fixes

One pass across the shipped features above, recorded here rather than
scattered: `date_confirmed` broadcast now carries `userId` alongside `matchId` /
`isComplete`; chat history pages via `GET /matches/{id}/messages?before=&limit=`
with a "load earlier" control in `app/chat/[matchId].tsx` (`useChat.loadEarlier`);
progressive-reveal fields and the daily-match-budget counter are now actually
rendered (Matches list reveal-level gating, `DailyBudgetMeter` on Discover);
admin `UserDetail` shows Oath / Oath sworn / Oath proven, `noShowFlagCount`,
ban state and membership expiry, with a `POST /admin/users/{id}/reset-noshow`
action; admin analytics gained Oath sworn / Oath proven / No-show flagged /
Flame Rites completed / Ships sparked / Town Square sessions tiles; `match_created`
broadcast + push on both the Fated Threads spark and the Town Square mutual-yes
paths; admin Ships list shows `resultMatchId`; admin Town Square create/cancel
(see the Town Square entry).

## Codebase-wide, larger than any one feature

- ~~**`getApiErrorMessage` surfaces raw English server error strings.**~~ CLOSED
  2026-09-01. Every error response now carries a stable `code` beside its English
  `message` (`ErrorResponse(Error, Code)`); `DomainException` and the
  `ApiErrorExtensions` helpers all require one, so the compiler refuses a new error
  without a code. The app maps `code` -> `err_<code>` i18n keys (75 codes, EN + MN)
  and, crucially, an *unmapped* code now falls back to the caller's localised message
  rather than the server's English. The two stopgap tables keyed on English prose
  (`SHIP_ERROR_I18N_KEYS` in `app/ship/new.tsx`, `VIDEO_ERROR_I18N_KEYS` in
  `hooks/useVideoCall.ts`) are deleted — the latter was already stale, keyed on two
  messages the engine had stopped returning. Verified live: a duplicate-nominee weave
  in Mongolian renders "Хоёр өөр хүнийг сонгоно уу." with no English leak.
  Covered by `lib/api/__tests__/errors.test.ts`.
- ~~**Swagger `ProducesResponseType(ErrorResponse)` doesn't match the actual
  `{ error }` shape**~~ CLOSED 2026-09-01 — fixed by the same change; `ErrorResponse`
  is now the type actually returned on every error path, so the generated client
  types are correct. Both frontends' `api.generated.d.ts` regenerated.

  **Still open here:** the four `admin.*` codes are deliberately English-only (the
  control panel is an internal tool); `mingldingl_control/src/lib/apiError.ts` was
  left reading `error` and has not been moved onto codes.

## Score-economy gaps left open by the 2026-09-04 bug-fix wave

Two findings from the same audit were judged design questions rather than defects
and were deliberately not changed. Both are score-economy holes:

- **`MatchReply` (+10) has no cap.** `MessagesController.SendMessage` awards it every
  time the sender is not the previous sender, so two accounts can alternate
  one-character messages and farm score without limit. The daily quest counter caps
  its own bonus; the base award does not. The tier ladder tops out at 2000, so this is
  200 alternating messages to Emerald. Options: a per-match or per-day cap on
  `MatchReply`, a minimum content length, or a decay after the first few replies.
- **A match where nobody ever messages can never be ghosted.** Both the sweep's SQL
  filter in `DailyMaintenanceBackgroundService` and `GhostingService.IsStale` require
  `LastMessageAt != null`, so the "matched and then total silence" case — arguably the
  purest form of ghosting — stays `Active` forever and costs the silent party nothing.
  Falling back to `Match.CreatedAt` when `LastMessageAt` is null would close it, but it
  changes who is at fault: `GetGhostAtFaultUserId` reads `LastMessageSenderId`, which is
  also null, so a no-message ghost has no single party to penalise.

## Left open by the 2026-09-04 missing-link audit

- **`ReportPenalty` (-30) has no award path.** The scoring table above specifies it for a
  negative report, and `ScoreService.GetDelta` carries the value, but no reporting endpoint
  exists — nothing can ever write the event. The value and its app-side label/icon were kept
  (a report feature is specified, and the app map is designed to carry types it may not yet
  see) and `GetDelta` now says so in a comment. Closing this means building the report flow:
  an endpoint, a moderation surface in `mingldingl_control`, and the award call site.
  `ScoreHistoryList.ENGINE_EVENT_TYPES` deliberately omits it, so the coverage test stays
  honest about what the engine can actually emit.
