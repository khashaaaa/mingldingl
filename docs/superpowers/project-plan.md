# MingldIngl — Specs & Plans

Single consolidated record of all design specs and implementation plans for this project. New feature work gets appended here, not spun into new files (see the project's standing pruning rule).

Structure: **Open** (not yet built — full spec/plan detail kept, this is active reference material) is separated from **Domain Model & Product Background** (living reference, not a task) and **Done** (shipped — pruned to outcome summaries only; the code itself is now the detailed reference, not this doc).

---

# Open — Not Yet Built

Nothing open right now — see Outstanding Follow-ups (end of the Done section) for the live backlog.

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
| UI + theming | `tamagui` + `@tamagui/config` |
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
│   ├── _layout.tsx             # Root: Tamagui provider, auth gate
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
│   ├── ship/new.tsx            # Fated Threads — weave a thread
│   ├── townsquare-round/[sessionId].tsx
│   └── membership.tsx
├── components/        # flat, not per-feature — GameButton, AppCard, QuestTile,
│   │                  # CandidateCard, MessageBubble, ChestModal, vfx/, etc.
│   ├── onboarding/    # NameAgeStep, AboutStep, PhotosStep, OathStep
│   ├── townsquare/    # SessionStatusCard, RoundPrompt
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
│   ├── i18n.ts         # EN + MN strings
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
├── tamagui.config.ts
├── babel.config.js
├── app.json
├── tsconfig.json
└── package.json
```

(The original spec described a per-feature `features/{name}/{components,hooks}` structure; the app shipped with flat `components/`/`hooks/`/`lib/` directories instead.)

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

# Done — Shipped

Pruned to outcome summaries — the original step-by-step plans and full spec detail are dropped now that the code exists and is the authoritative reference. What's kept below is what a future reader actually needs: what shipped, what deviated, what was found and fixed in review, what was deliberately left open.

## Membership Billing Cycles — Shipped

**Status: shipped**, confirmed directly against the live engine code (no formal Execution Outcome was recorded when this was built, so this is a brief honest note rather than a fabricated detailed history).

What shipped, per the original plan's goals: duration-based membership pricing (1/3/6 months, 10%/20% discount for longer commitments), computed from each tier's existing monthly price with no separate pricing table to maintain; `User.MembershipExpiresAt` tracks live expiry; the pre-existing but previously-unused `Membership` table became the append-only purchase log; `DailyMaintenanceBackgroundService` gained an auto-downgrade sweep pass for lapsed memberships (confirmed live in `DailyMaintenanceBackgroundService.cs`, alongside ghosting/reset/anonymization). App-side: a duration `ChoiceRow` on the membership screen, `duration_1_month`/`duration_3_months`/`duration_6_months`/`save_percent`/`membership_active_until`/`billing_cycle` i18n keys all present and wired.

No real payment gateway — upgrades are mocked, not wired to real billing (a known, separately-tracked gap, see Payment Provider Research memory).

---

## RPG Atmosphere Consistency Pass — Shipped (2026-07-28)

## Execution Outcome

Executed via superpowers:subagent-driven-development, adapted for this repo's no-git policy: no worktree/commits, review packages built from before/after file snapshots + plain `diff -u` instead of `git diff`. Scratch workspace (task briefs, reports, review packages, ledger) has been pruned after completion — this section is the retained record.

**All 11 tasks completed, review-clean, 3 fix rounds total:**
- Task 1 (`components/ScreenHeader.tsx`): 1 fix round — added test coverage for the default `router.back()` path.
- Task 3 (`app/blocked-users.tsx`): 1 fix round — removed dead `router`/`useRouter` left over after the header swap.
- Tasks 2, 4–11: clean on first review.
- Tasks 4 and 5 also risked the same dead-`router` mistake as Task 3; the controller pre-checked each remaining file with `grep` before dispatch and warned the implementer explicitly, avoiding a repeat.

**Final whole-branch review (opus) found real cross-screen issues no single task-scoped review could see, all fixed in one wave:**
- `ScreenHeader`'s `paddingTop: 56` double-counted the app's global `SafeAreaView` inset (~100pt of dead space on 5 screens) and its tokens didn't match `GameHeader` (the established reference). Fixed: aligned to `GameHeader` exactly (`paddingTop:16`, `paddingHorizontal:20`, title `fontSize:24`/`letterSpacing:1.5`, divider `tint: COLORS.gold`); added `accessibilityLabel="Go back"` to the back button while in there.
- `app/business/[id].tsx` and `app/edit-profile.tsx` had `<ScreenHeader />` rendered *inside* their `ScrollView`, so it scrolled away with content — defeating Task 8's point (edit-profile's new back button would vanish exactly when scrolled to the form). Fixed: moved to a fixed sibling before `ScrollView` in both.
- `app/business/[id].tsx` had also lost `flex: 1` on its `ScrollView` and had broken indentation from the Task 5 restructure. Both fixed.
- `app/chat/[matchId].tsx` had a dead `Platform` import left over from Task 6. Removed.

Re-review of the fix wave: all 4 findings ADDRESSED, no new breakage. `npx tsc --noEmit` clean and the full jest suite (4 suites/12 tests) green throughout every round.

**Deliberately not done — surfaced to the user, not fixed unilaterally:**
- Copy consistency *within* a screen was never checked — e.g. `unblock: 'Lift the Ban'` now sits under Blocked Users' unchanged plain title/empty-state. The 8-key rewrite list (see Task 10) was scoped key-by-key, not screen-by-screen; whether siblings should match is a product call.
- `translations.mn` was never touched (correct per this plan's Global Constraints — no AI-guessed Mongolian), so `en`/`mn` now diverge in voice. Known, intentional gap pending a human Mongolian speaker.
- No live e2e visual pass was run (would require booting the engine + local Postgres + seeded match data to reach chat/quiz/icebreaker/activities/business-detail). Verification rested on 3 layers of diff-level code review + `tsc` + the jest suite instead. Settings, Blocked Users, Membership, Leaderboard, Progression, Date Log, and Onboarding are reachable without seeded data if a cheap real screenshot pass is ever wanted.
- `DUNGEON_WALL_ASSET = require(...)` is now duplicated across 15 files (grew from the pre-existing 3). Flagged as a good candidate for a shared module or a `ScreenBackdrop` wrapper, not forced into this pass.

### Follow-up: copy-consistency pass + live visual verification (2026-07-28, same day)

Closed the two gaps flagged above as "surfaced to the user, not fixed unilaterally":

**Copy consistency:** Audited every i18n key used on the 8 retheme'd screens for sibling strings still reading generic next to the Task 10 rewrites. Most were already fine or deliberately left plain (form field labels, demographic fields like religion/smoking/drinking — flavoring those risks reading tone-deaf; account-security fields per the original policy). Chat's "Block" menu item sitting next to "Cast Them Out?" was judged consistent with this app's pre-existing convention (plain trigger, flavorful confirm — same pattern as the untouched `unmatch`/`unmatch_confirm_title`), not a new inconsistency, so left alone. Two genuine clashes fixed (`en` only, `mn` still deliberately deferred to a human speaker):
- `delete_account_requested_title`: `'Deletion Scheduled'` → `'Character Abandoned'` (now reads as one coherent moment with the `'Abandon This Character?'` confirm that precedes it).
- `blocked_users_empty`: `"You haven't blocked anyone"` → `'No one banished yet'` (matches `unblock: 'Lift the Ban'` vocabulary; screen title `'Blocked Users'` deliberately left plain — moderation/safety UI needs unambiguous identification, same reasoning as leaving `phone_number` plain).

`mn` still diverges from `en` in voice — unresolved, same as before.

**Live visual pass:** Booted the engine + local Postgres + Expo web per this repo's `verify` skill, created two real Supabase test users, and screenshotted all 7 screens reachable without seeded match data (Settings, Blocked Users, Membership, Leaderboard, Progression, Date Log, Onboarding). All confirmed genuinely clean: backdrop renders as intended, header alignment/weight is now consistent across `ScreenHeader` and `GameHeader` screens (confirming the final-review padding/token fix actually worked visually, not just on paper), no double padding, no illegible text, no truncation. Onboarding's `opacity={0.08}` backdrop is real but very faint — text inputs stay perfectly legible, but it's closer to "no visible texture" than "subtle texture," which is a defensible but worth-knowing tradeoff for that one screen.

Chat, Quiz, Icebreaker, Activities, and Business Detail still weren't visually verified (need a seeded match/partner to reach) — that gap remains open if a full pass is ever wanted.

Incidental, unrelated finding from the live pass (not investigated, not part of this plan's scope): the Character tab's avatar placeholder renders a bare numeral (e.g. "1") instead of the expected camera icon when a user has no photos — looks like an icon-font glyph fallback issue, pre-existing and unrelated to this plan's changes.

### Follow-up: avatar upload UX fixes (2026-07-28, same day)

User asked whether profile avatar replace/upload was "simple and comfortable." Assessment: the flow itself (tap → picker → native crop → optimistic preview → background upload → clear error/loading states) was already solid, but two real gaps existed at the entry point:

1. **Broken placeholder icon** — the empty-avatar camera icon (`app/(tabs)/profile.tsx`, `Icon name="camera"`) intermittently rendered as a bare "1" instead of the icon glyph on web. Root-caused via a live Playwright diagnostic (not guessed): `app/_layout.tsx`'s `useFonts()` gate only waited for the Cinzel/Alegreya text fonts before allowing first paint — it never included the MaterialCommunityIcons web font that `components/Icon.tsx` depends on, which `@expo/vector-icons` loads separately and asynchronously. On a fast/cold load, icon-using components could paint before that font arrived, showing the browser's PUA-codepoint fallback glyph instead. **Fix:** `app/_layout.tsx` now spreads `MaterialCommunityIcons.font` (the standard `@expo/vector-icons` + `expo-font` pattern) into the same `useFonts()` call, so the existing `fontsReady` gate blocks first paint on the icon font too — closing the race structurally rather than papering over one symptom. Re-verified live with a screenshot taken 300ms after navigation (deliberately tight timing to try to reproduce the race) — camera icon rendered correctly.
2. **Weak discoverability + library-only** — tapping the avatar went straight to the OS library picker with no camera option and no visual cue that the avatar was even tappable. **Fix:** reused `components/PhotoGrid.tsx`'s existing choose-source `Modal` pattern (already used by onboarding/edit-profile) instead of inventing a new one — tapping the avatar now opens a "Choose from Library" / "Take a Photo" (native only, matching `PhotoGrid`'s `Platform.OS !== 'web'` gate) / "Back" sheet, and a small gold pencil badge now sits permanently on the avatar ring as a persistent edit affordance. Added one new i18n key (`change_avatar`, accessibility label) in both `en` and `mn` — plain functional copy, not fantasy voice, so translated directly rather than deferred.

Both re-verified live (not just by diff): icon renders correctly under tight timing, avatar tap opens the sheet, edit badge is visible in both empty and (by construction, same code path) populated avatar states. `npx tsc --noEmit` clean, full suite (4 suites/12 tests) green throughout.

### Follow-up: interaction-comfort audit + fixes (2026-07-28, same day)

User asked where else the app "lacks comfort" (same lens as the avatar fixes above). Audited the whole app for silent failures, dead ends, and missing feedback — 9 real findings, all fixed:

1. **Icebreaker/Quiz answer submission** (`hooks/useIcebreaker.ts`, `hooks/useQuiz.ts`, both screens) — the tapped option locked in optimistically before the network call resolved; on failure it stayed locked forever with no error. Added `submitError`/`clearSubmitError` to both hooks, reset selection + show a failure alert on error. **Caught in my own review, not the implementer's**: for quiz specifically, the local `answers` record wasn't cleared on failure, so `answeredCount` stayed at the "complete" count and `currentQuestion` stayed `undefined` — the screen fell through to `if (!q) return null`, a blank screen, *before* ever reaching the new alert. Fixed by reverting the failed answer out of local state in `useQuiz.ts`'s `submitAnswer` via the mutation's per-call `onError`.
2. **Onboarding AboutStep** (`components/AboutStep.tsx`) — a `nearestCity` failure after GPS succeeded left the screen blank with no fallback. Now shares the existing permission-denied recovery UI (manual city picker) for both cases.
3. **Discover match request** (`app/(tabs)/discover.tsx`) — success toast fired before the mutation resolved. Now gated on `onSuccess`/`onError` per-call callbacks.
4. **Chat unmatch/block** (`app/chat/[matchId].tsx`) — failure looked identical to cancel. Now shows a distinct failure alert. Also added `accessibilityLabel` to the options and video-call header buttons.
5. **Settings/Edit-profile saves** — notifications toggle, pause toggle, age range save (`app/settings.tsx`) and location refresh/manual city pick (`app/edit-profile.tsx`) had no try/catch at all. Edit-profile's city picker also updated the displayed city *before* the save confirmed, so a failed save left a phantom city — fixed by reverting on failure. Also widened the error message's visibility: it was only rendered in the bio card, invisible if the failure came from the location section further down — now shown in both.
6. **PhotoGrid delete** (`components/PhotoGrid.tsx`) — deleted on a single tap, unlike every other destructive action in the app (Unmatch/Block/Delete Account all confirm). Added the same confirm-modal pattern.
7. **Activities "memorable moment" photo** (`app/activities/[matchId].tsx`) — same upload hook `profile.tsx` already wraps in a failure alert, just wasn't wrapped here. Now reuses the identical existing `photo_upload_failed_title/body` pattern.
8. **Blocked-users unblock spinner** (`hooks/useBlockedUsers.ts`, `app/blocked-users.tsx`) — one shared `isPending` flag lit up every row's spinner. Now scoped per-row via the mutation's `.variables`.

New i18n keys added (en + mn, parity verified): `action_failed_title`/`action_failed_body` (generic reusable failure alert), `delete_photo_confirm_title`/`delete_photo_confirm_body`, `start_video_call`. All functional/generic copy, not deep fantasy flavor — mn translated directly rather than deferred.

Executed as 8 parallel background subagents (independent, non-overlapping file sets — verified upfront) plus one small manual correction (the quiz retry bug above) found during my own consolidated review of all 8 diffs, not a separate reviewer dispatch. `npx tsc --noEmit` clean and the full suite (4 suites/12 tests) green throughout, both before and after the manual correction. Not live-tested against real induced failures (would require deliberately breaking the backend mid-request) — verification for this batch rests on code-level review, not a browser pass.

### Follow-up: live-verified the comfort fixes, found and fixed a systemic gap (2026-07-28, same day)

Actually booted the app and induced real failures (Playwright route interception returning 500s) against the fixes from the previous entry, instead of trusting code review alone.

**Settings toggle failure**: confirmed live — induced a 500 on `PUT /users/me`, tapped the notification toggle, "The Attempt Faltered" alert appeared correctly.

**Discover match-request failure**: induced a 500 on `POST /matches`, tapped "Send Summons" — got the success toast ("Match Requested! +15 XP") instead of the failure alert. Traced it to `lib/api.ts`'s axios response interceptor: it has an "offline mock-fallback" (`lib/mockData.ts`'s `getMockResponse`) that catches **every** error indiscriminately — network failure or real HTTP error response alike — and silently swaps in fake mock success data whenever the URL+method has mock coverage. `POST /matches` is one of the mocked endpoints (returns `{ matchId: 'mock-...' }`), so a genuine backend 500 was being invisibly converted into a fake success before ever reaching the mutation's `onError`.

Cross-referenced which of today's 9 comfort fixes target endpoints with mock coverage: **Discover match-request, Icebreaker respond, and Quiz respond** all do (`lib/mockData.ts` lines ~281-287) — meaning those 3 fixes' error-handling code, while individually correct, would never actually fire against a real backend failure; only Settings/Edit-profile/Chat/PhotoGrid/Activities/Blocked-users (endpoints with no mock coverage) would.

**Fix**: `lib/api.ts`'s interceptor now only falls back to mock data when `!error.response` (a true network-level failure — offline, DNS, timeout, CORS) — matching its own stated intent ("offline mock-fallback," per the existing code comment). A real HTTP error response now always rejects and reaches the caller, regardless of mock coverage. Re-ran the induced Discover failure after this fix — "The Attempt Faltered" now appears correctly.

This is a one-line, narrowly-scoped condition change (`if (error.response) return Promise.reject(error);` before the existing mock lookup) that makes the interceptor's behavior match what its own comment already claimed it did. `npx tsc --noEmit` clean, full suite green, and both the Settings and Discover failure paths independently confirmed live afterward.

Not further live-tested: Icebreaker/Quiz respond failures (same interceptor fix should apply equally, same mechanism just confirmed for Discover, but not independently re-verified against those two specific endpoints — would need a seeded match to reach); PhotoGrid/Blocked-users/Activities/Chat unmatch-block failure paths (client-side-only or need seeded state to reach).

---

## Admin Config Foundation — Shipped (sub-project 1 of 9)

**What it is:** sub-project 1 of a 9-part "dashboard control expansion" roadmap to move hardcoded engine values (membership pricing, score/XP deltas, tier thresholds, quest definitions, matching weights, festivals, feature flags) into dashboard-editable config instead of requiring a deploy to change. This sub-project built the **generic foundation** the other sub-projects plug into — one typed, admin-editable config store (`AdminConfigs` table + `ConfigService` in-memory cache + `AdminConfigController` list/update/revert, audit-logged), proven end-to-end by migrating exactly one value (the Sapphire tier threshold, `tier.sapphire.threshold`) off its hardcoded constant.

**Full outcome below.** The remaining 8 sub-projects — membership pricing (now separately shipped, see Membership Billing Cycles above), the rest of the score/XP tier thresholds, quest definitions, matching weights, festivals/seasonal events, a rich-text content editor, analytics expansion, and a reusable-component cleanup pass — are **not started**; they plug into this foundation when picked up, no separate config storage needed for them.

## Execution Outcome (2026-07-29)

All 6 tasks shipped via subagent-driven development (fresh implementer + independent reviewer per task, then a final whole-plan review). No git in this repo — no worktree, no commits; task reviews used file snapshots instead of diffs.

**What shipped:** `ConfigService` (singleton in-memory cache), `AdminConfig` DB model + migration, `ConfigKeys` registry + startup seed/load, `AdminConfigController` (list/update/revert with validation + audit logging), the Sapphire gem-tier threshold migrated off its hardcoded constant as the proof, and the dashboard's new Config page. Full engine suite: 221/222 (one pre-existing, unrelated failure — see below). Frontend: `tsc`/build clean.

**Deviations from the plan (all verified reasonable, not scope creep):**
- Task 4: brief's test file was missing 2 `using` lines — added.
- Task 5: the constructor signature change rippled into 17 test files that constructed `ScoreService` directly (`new ScoreService(Db)` → `new ScoreService(Db, new ConfigService())`) — necessary for the project to compile, behavior-preserving (empty `ConfigService` falls back to the same hardcoded defaults).
- Task 6: regenerated `AdminConfigDto` fields are nullable/optional (Swashbuckle convention, matches existing `AuditLog.tsx` pattern) rather than the plain strings the brief assumed — handled with the same `?? ''` fallback style already used elsewhere.

**Bugs found and fixed by the final whole-plan review** (would not have surfaced from any single task's review):
1. `Revert_NoPriorChange_ReturnsConflict` had gone permanently red — Task 6's manual curl smoke test left committed `AdminAuditLog` rows in the shared dev DB that the test's rolled-back transaction couldn't see past. Fixed by deleting those rows within the test's own transaction before asserting.
2. `Revert` was a toggle, not idempotent — it matched the most recent audit row regardless of whether that row was itself a prior revert, so a second click un-reverted the first. Fixed by filtering to `Action == "UpdateConfig"` only. Added `Revert_CalledTwice_StaysAtOriginalValue` to cover it.

**Deferred, not fixed (parked with rulings, non-blocking):**
- No committed test exercises the controller-write → `ScoreService`-read path in one process (each half is tested separately). A regression of `ConfigService` from `AddSingleton` to `AddScoped` would go undetected by the current suite. Worth a follow-up test if this area gets touched again.
- Minor culture-sensitive `double.TryParse` (no `InvariantCulture`), no range/monotonicity validation on tier thresholds, `ConfigField` ignores `valueType` (always renders a number input — fine while only one Number-typed key exists), non-atomic write+audit (matches existing house pattern elsewhere).

**Found, out of scope, needs its own ticket:** `EngagementControllerIntegrationTests.RespondQuiz_SubmittedTwiceWithSameAnswers_DoesNotDuplicateRowOrDoubleAwardScore` fails deterministically — `RespondQuiz` appears to insert no `QuizResponse` row at all on the duplicate-submission path (`EngagementController.RespondQuiz`'s unique-violation catch, `ChangeTracker.Clear()`). Confirmed zero coupling to this plan's changes.

**Next in the roadmap** (per the original sequencing agreed with the user): membership pricing & tiers, score/XP values & tier thresholds (the rest of them), quest definitions, matching weights, festivals/events — each plugs into this foundation. Then rich text editor for content pages and analytics expansion, which don't depend on it.

---

## Recruit an Ally — Shipped (2026-08-14)

## Execution Outcome (2026-08-14)

Implemented via Subagent-Driven Development, adapted for this repo's no-`.git` environment (no
worktree, no commits — every "Commit" step in the plan was skipped; review packages were built from
direct file reads instead of diffs). All 7 tasks complete, each independently task-reviewed and
approved, followed by a final whole-branch review and one fix wave.

**Shipped as designed** — data model, code generation/uniqueness, the `Upsert`/`GetMe` wiring, the
async reward surfacing via `GET /scores/me/detail`, and the frontend (onboarding field, profile card,
`GameHeader` toast) all match the spec's locked-in decisions (mutual chest, onboarding-submit trigger,
manual code sharing, no daily cap).

**Two pre-flight rulings** (made before implementation, based on gaps the plan text itself missed):
1. Task 2's `UsersController` constructor change (2→3 params) would have broken the whole engine test
   project — two more test files (`AccountDeletionIntegrationTests.cs`, `UserAccountManagementIntegrationTests.cs`)
   construct it directly and weren't in the plan's file list. Fixed as part of Task 2, same pattern as
   the file the plan did name.
2. (Implementer-initiated during Task 5, independently verified by that task's reviewer.) The plan's
   literal code for surfacing a reward via `setPendingDrop(x.someReward)` doesn't type-check — the
   generated `DroppedItem` type has nullable fields, `setPendingDrop` requires non-null. Fixed by
   routing through the pre-existing `toDroppedItem` helper (`lib/tiers.ts`), already used identically
   elsewhere in the app. The same fix recurred in Task 7 for the same reason.

**Bugs found and fixed during implementation** (all independently verified by that task's reviewer,
several re-verified empirically — reverted, reproduced the failure, restored):
- Task 1: two test-code compile fixes (missing `using`, an ambiguous xUnit assertion overload).
- Task 6 (the largest cluster): the plan's i18n interpolation syntax was wrong (`{code}` vs. the
  project's actual `%{code}` convention); a `jest.mock('react-native', ...)` spread crashed via eager
  evaluation of RN's lazy-getter module exports; a plain assignment to a getter-only mocked property
  silently no-op'd (needed `Object.defineProperty`); a reused i18n key made two RNTL queries
  ambiguous; and a TypeScript generic-inference gap in `i18n.t()` feeding a discriminated union.
- Task 7: a pre-existing Jest infra gap (`@shopify/react-native-skia`/`react-native-reanimated` not in
  `transformIgnorePatterns`) that no test had ever exercised before this was the first test to render
  `GameHeader`. Worked around locally in the new test file; **not fixed at the config level** — see
  Follow-ups below.

**Fixed in the final whole-branch review's one fix wave** (both genuinely cross-task — invisible to
any single task's review since neither task's file list included the other side of the interaction):
1. `GameHeader`'s referral-reward toast could replay from the React Query cache after dismissal
   (server-side read-once wasn't mirrored client-side; `GameHeader` mounts fresh on 7 screens within
   the cache's `staleTime` window). Fixed by clearing the cached field the moment the effect consumes
   it, mirroring the existing cache-mutation pattern in `useOptimisticScoreBump.ts`.
2. Account anonymization (`DailyMaintenanceBackgroundService`) scrubbed `PhoneNumber` on deletion but
   not `ReferralCode`, leaving a deleted user's invite code live and redeemable forever. Fixed by
   nulling the field during anonymization and rejecting redemption when the resolved inviter is
   already `IsDeleted`.

**Final state**: engine 239/239 tests passing, app 182/182 tests passing (23 suites), `tsc --noEmit`
clean. Manual verification (above) was not run in this session — do that before considering this
launch-ready.

**Follow-ups deliberately left open, not part of this plan's scope:**
- The Skia/Reanimated Jest transform gap (found in Task 7) is real, pre-existing infra debt separate
  from this feature — wire `@shopify/react-native-skia`'s `jestSetup.js` into `package.json`'s
  `setupFiles` and extend `transformIgnorePatterns` for `react-native-reanimated`.
- Mongolian copy across all new i18n keys is unproofread by a native speaker.
- A completionist inviter (owns the full loot catalog) currently gets zero toast feedback on a
  successful referral (silently receives +10 XP instead of an item) — low-priority, they are still
  compensated.
- `CreateUserRequest.ReferralCode`'s field name is feature-specific even though **Fated Threads**
  (shipped, see below) reuses it for ship invite codes too. Fated Threads wired into the field as-is,
  so the name is now settled: cosmetic only, the value is an opaque string the server disambiguates.

---

## Fated Threads — Shipped (2026-08-14)

**What it is.** A double-blind mutual opt-in for friends who want to set two people up. A "Weaver" privately nominates two people by phone number; each nominee gets a low-pressure prompt without knowing whether the other has answered; only if both accept does anything connect — as an ordinary `Match` tagged `ShipId`, so the existing progressive reveal takes over. Neither nominee ever sees a visible rejection and the Weaver never learns who passed. Internal naming is plain (`Ship`, `ShipService`); user-facing copy is Fated Threads / Weaver / "loose an arrow" / "the thread frayed". The original spec and 14-task plan lived here until 2026-08-31; the code is now the authority.

**Shipped:** engine `Services/ShipService.cs`, `Controllers/ShipsController.cs`, `Controllers/AdminShipsController.cs`, the `/public/ship` + `/public/ship-invite` pair in `PublicController.cs`, model `Ship`, `Match.ShipId`, migration `20260814143217_AddShipsAndMatchShipId`, `Services/InviteCode.cs` (shared code alphabet, from the 2026-08-19 audit). App: `app/ship/new.tsx`, `components/quest/FatedThreadsSection.tsx` + `hooks/usePendingShips.ts` on the Missions/Activity tab with the "Weave a New Thread" CTA, `components/progression/ThreadLog.tsx` on the profile, `lib/shipInvite.ts`, the "Woven by" banner in `app/chat/[matchId].tsx` and on `(tabs)/matches`. Admin: `mingldingl_control/src/pages/Ships.tsx` (status-filtered list). Tests: `ShipServiceTests`, `LootServiceGrantSpecificTests`, `ShipsController` / `AdminShipsController` / `ScoresController` / `UsersController` integration tests; app `FatedThreadsSection.test.tsx`, `ThreadLog.test.tsx`, `shipInvite.test.ts`.

**Mechanics (code is authoritative — `ShipService.cs`):**
- `POST /ships` `{ slotAPhoneNumber, slotBPhoneNumber }` — 8-digit validation, rejects the same number twice and self-nomination, enforces `ships.daily.cap` (`ConfigKeys`, default 3, counted by `CreatedAt >= today UTC`). Each slot resolves by `PhoneNumber` to an existing user (`PendingOptIn`) or to a fresh 6-char invite code (`AwaitingUser`); a code is generated and returned for **both** branches, so the response never reveals whether the number matched an account. If either resolved nominee has blocked the Weaver, or the two are already matched, the response is the identical success shape and no `Ship` row is written.
- `GET /ships/pending` → `[{ shipId, weaverDisplayName }]` — nothing about the other slot, ever.
- `POST /ships/{id}/respond` `{ accept }` → `{ sparked }`. The caller's slot is written with `UPDATE … RETURNING`; any `Declined` closes the thread as `Declined`; both `Accepted` re-checks `MatchPairing.PairAlreadyMatchedAsync` / `IsPairBlockedAsync` (either → quiet `Expired`), then `MatchPairing.NewMatch(a, b, shipId)` — `RevealLevel 1`, no `DailyMatchesUsed` increment — sets `Status = Sparked` and `ResultMatchId`.
- Spark payout: the Weaver gets `LootService.GrantGuaranteedAsync(…, "ShipSparked")` (item id kept in `Ship.ShipperRewardItemId`), `ShipSparked` +40, and milestone titles at 1/5/10 sparks (`title_threadweaver` Common / `title_fateseer` Rare / `title_bondkeeper` Epic via `GrantSpecificAsync`). Both nominees get `first_match`, a push notification ("Thread Sparked!"), and a `match_created` broadcast on `app-nudges` (`{ matchId, userIds, source: "ship" }`, added 2026-08-31 so the Matches list refreshes without a pull).
- The Weaver's async reward rides `GET /scores/me/detail` as `pendingShipReward` (first `Sparked` ship with `ShipperNotifiedAt == null`) and is cleared by `POST /scores/me/notifications/ack { kind: "ship" }`.
- Invite codes: `UsersController.Upsert` calls `ShipService.TryResolveInviteCodeAsync(userId, req.ReferralCode)` on profile completion — one onboarding field shared with Recruit an Ally, disambiguated server-side; `CodeExistsAsync` checks `Users.ReferralCode` plus both `Ships` code columns (and `ReferralService` checks `Ships` too). `/public/ship?code=` serves a static landing page that validates the code via `/public/ship-invite` and deep-links `mingldingl://`.
- Expiry: `DailyMaintenanceBackgroundService` flips `Pending` ships older than `ShipExpiryPeriod` (14 days, hardcoded) to `Expired`.
- `MatchResponse.weaverDisplayName` drives "Woven by %{name}". Admin: `GET /admin/ships?status=&page=&pageSize=` — Weaver + slot names, opt-in states, `resultMatchId` (rendered as a copyable id in the control panel since 2026-08-31).

**Deviations from the spec/plan:**
- **`BlockWeaver` on Pass was never built** — `RespondToShipRequest` is `{ accept }` only; the only block logic is the check on `POST /ships`. Still open (Follow-ups).
- The armory shrank to titles: `item_frame_fletched`, `item_emblem_quiver`, `item_emblem_drawn_bow` are not in `LootService.Catalog`.
- The opt-in prompt lives only on the Missions/Activity tab (`FatedThreadsSection`); Thread Log shows the milestone titles owned, not pending/sparked/frayed counts.
- Reward surfacing uses an explicit ack endpoint and two extra `Ship` columns (`ShipperRewardItemId`, `ShipperNotifiedAt`) rather than the spec's read-once-and-clear field.
- Same number in both slots is a hard 400 (spec was silent); "already matched" returns the silent success shape instead of the spec's error.
- Server error strings are mapped client-side in `app/ship/new.tsx` to `ship_error_*` i18n keys as a stopgap for `getApiErrorMessage`.

**Fix wave 1 (after the final whole-plan review, 2026-08-14):** two separate share buttons carrying *different* codes on the confirmation screen; the blocked-Weaver path returns the same success + two-codes shape with no row; same phone in both slots rejected; push notifications + list refresh on spark; "Weave a New Thread" CTA on the Missions tab (previously reachable only by typing the URL).

**Later fixes:** 2026-08-19 audit — nominees were checked against the Weaver but never against each other; `RespondAsync` now routes through `MatchPairing.IsPairBlockedAsync` and closes quietly as `Expired`; invite-code alphabet single-sourced. 2026-08-31 — the share text gained the `/public/ship?code=` URL (`lib/shipInvite.ts`); until then the landing page existed but nothing pointed at it; `match_created` broadcast on spark; admin list shows `resultMatchId`.

**Still owed — the manual pass (never run):** Weaver A weaves B+C → B's `GET /ships/pending` names A and nothing about C → B accepts, nothing sparks → C accepts: match exists, chat shows "Woven by A", neither `DailyMatchesUsed` moved → A's loot toast fires once and does not replay → repeated cycles grant `title_threadweaver` on the first spark and the weave past `ships.daily.cap` is rejected → a brand-new number resolves via the onboarding code field; plus the fix-wave rechecks (two distinct codes, blocked-Weaver silent no-op, same-number rejection, push + list refresh on spark, Missions-tab CTA). Tracked under Outstanding Follow-ups.

---

## Duplication & Round-Trip Audit — Shipped (2026-08-19)

A sweep for duplicated logic, overlapping payloads, and redundant round-trips
across all three repos. Findings and what was done:

**Fixed — a real defect.** Only one of the three code paths that can create a
`Match` checked `BlockedUsers`. `MatchesController.RequestMatch` did;
`ShipService.SparkAsync` checked each nominee against the *Weaver* but never
the two nominees against each other; `TownSquareService` had no block check at
all. Two people who had blocked each other could therefore be woven together by
a Weaver, or auto-paired into a Town Square round-robin — where pairing is
assigned by the circle method, so a blocked pair on opposite sides of the
roster would meet with certainty, not by chance. New `Services/MatchPairing.cs`
owns `IsPairBlockedAsync` / `PairAlreadyMatchedAsync` / `PairLockKey` /
`NewMatch`, and all three paths route through it. Both new paths fail the
pairing quietly (Ships closes as `Expired`, Town Square returns no match) so
neither side can infer a block exists. Four regression tests.

**Fixed — duplication.**
- The load-match-then-check-participant guard was character-identical at 20
  action sites across 6 controllers. Extracted to
  `MatchAccessExtensions.LoadParticipantMatchAsync`, mirroring the earlier
  `CurrentUserExtensions` extraction. Participation is still checked before any
  feature-specific state, so an error can't fingerprint a match for a
  non-participant.
- `PairLockKey` was byte-identical in `MatchesController` and
  `TownSquareService`, where the two copies staying identical was load-bearing
  (same advisory-lock namespace) but unenforced. Now single-sourced.
- The invite-code alphabet was duplicated between `ReferralService` and
  `ShipService`, which share one keyspace. Now `Services/InviteCode.cs`.
- Three `new Match { … }` sites with drifting field sets → `MatchPairing.NewMatch`.
- `TotalScore` / `GemTier` / `ReputationScore` were on **both** `UserResponse`
  and `ScoreDetailResponse`, and the app's `applyScoreBump` only ever refreshes
  `scoreDetail` — so `/users/me` served a second copy that no mutation
  invalidated. Removed from `UserResponse` and from the app's `UserProfile`.
  Admin surfaces keep theirs via `AdminUserDetailDto`. Discover candidates need
  the *other* user's tier, so they got their own `Candidate` type.
- `ScreenHeader` and `GameHeader` each carried their own copy of the
  back-arrow/title/divider bar and its styles, drifted 4px apart on the gap
  between arrow and title. Extracted `components/ui/HeaderBar.tsx`; both now
  compose it. They were **not** merged — `GameHeader` also owns the score HUD
  and reward-toast stack, which the ~11 sub-screens using `ScreenHeader` should
  not have to mount.

**Investigated, deliberately not changed.** The four `refetchInterval` sites
(`useIcebreaker` 15s, `useQuiz` 15s, `useTownSquareSession` 15s,
`useTownSquareRound` 30s) initially looked like an unfinished polling→Broadcast
migration. They are not. `SupabaseBroadcastService` is explicitly best-effort
(its POST failure is swallowed), so each interval is a documented safety net
behind the broadcast, already slowed from the original 3–5s to 15–30s, and each
stops once its terminal state arrives. `useTownSquareSession` has no broadcast
covering it at all (nothing is pushed on the Locked/InProgress transitions).
Removing them would strand a user on a waiting screen whenever a broadcast POST
drops.

**Verified clean, no action.** Query keys are fully centralized in
`lib/api/queryKeys.ts`. i18n is at 389/389 EN/MN parity. App styles route
through `COLORS` (5 hex literals total remain, in `GameButton` and
`membership.tsx`). All 6 config keys are registered in `ConfigKeys.All` with
inline fallbacks matching declared defaults exactly. Engine DTO mapping has a
single construction site per response type; tier calculation lives only in
`ScoreService`. `mingldingl_control` is proportionately factored for its 2.1k
lines.

Engine 452 → 456 tests, app 276, `tsc` clean, control builds and lints.

---

## Town Square — Shipped (2026-08-14)

**What it is.** Scheduled speed-dating sessions over video. Users RSVP to an upcoming session; at the RSVP deadline the roster is locked and turned into a round-robin of short one-to-one Agora calls, each seeded with an icebreaker question; after each round both people privately answer Yes/No, and a mutual Yes creates an ordinary `Match`. No design spec or plan was ever recorded in this document (it shipped alongside Recruit an Ally / Fated Threads in the 2026-08-14 wave), so this summary was written from the code on 2026-08-31 and the code remains the authority.

## Execution Outcome (recorded retroactively, 2026-08-31)

**Shipped:** engine `Services/TownSquareService.cs`, `Services/TownSquareSchedulerBackgroundService.cs`, `Controllers/TownSquareController.cs`, `Controllers/AdminTownSquareController.cs`, models `TownSquareSession` / `TownSquareRsvp` / `TownSquareRound` / `TownSquarePairing` / `TownSquareIcebreakerResponse`, migration `20260814094851_AddTownSquare`. App: the fifth (middle) tab `app/(tabs)/townsquare.tsx` (`components/townsquare/SessionStatusCard.tsx` — countdowns, RSVP / cancel), `app/townsquare-round/[sessionId].tsx` (`AgoraVideoCall` + `components/townsquare/RoundPrompt.tsx` + `VideoControls`), hooks `useTownSquareSession` / `useTownSquareRound`, `lib/townSquareTime.ts`. Admin: `mingldingl_control/src/pages/TownSquare.tsx` (read-only sessions list with expandable pairings). Tests: `TownSquareServiceTests`, `TownSquareSchedulerBackgroundServiceTests`, `TownSquareService` / `TownSquareController` / `AdminTownSquareController` integration tests; app hook tests under `components/townsquare/__tests__/`.

**Mechanics (code is authoritative):**
- **Session lifecycle** — `TownSquareSession.Status`: `Open` → `Locked` → `InProgress` → `Completed`, or `Cancelled`. Timestamps `RsvpOpensAt` / `RsvpClosesAt` / `ScheduledStartAt`; `CurrentRoundNumber` advances during play.
- **RSVP** — `POST /townsquare/rsvp` and `DELETE /townsquare/rsvp?sessionId=` only while `Open` (400 otherwise); idempotent; unique index on `(SessionId, UserId)`. `GET /townsquare/next-session` returns the earliest non-terminal session plus `isRsvpd`.
- **Scheduler** — `TownSquareSchedulerBackgroundService` sweeps every 10 s: `Open` past `RsvpClosesAt` → `LockRosterAsync`; `Locked` past `ScheduledStartAt` → `StartSessionAsync`; `InProgress` with the current round elapsed → `AdvanceRoundAsync`. Registered as singleton + hosted service, the same pattern as `DailyMaintenanceBackgroundService`.
- **Roster lock** — RSVPs ordered by `RsvpAt`, split by `User.Gender` into `Male` / `Female`, each side capped at `MaxPerSide = 5` and truncated to the smaller side. Zero pairs → `Cancelled` + broadcast. Otherwise `GenerateRoundRobin` (circle method) yields n rounds of n pairings; each round is `RoundDurationSeconds = 240`, starts at `ScheduledStartAt + r × 240 s`, and takes the r-th active `Icebreaker`, cycling. Both constants are hardcoded, not `ConfigKeys` entries.
- **Rounds** — `GET /townsquare/session/{id}/current-round` (400 unless `InProgress`) returns the caller's pairing, an Agora token whose channel is the pairing id, the icebreaker text/options, and `roundEndsAt`. `POST /townsquare/pairing/{id}/joined` stamps `UserAJoinedAt` / `UserBJoinedAt`. `POST /townsquare/pairing/{id}/respond` with `{ response: "Yes" | "No" }` writes the caller's slot in one `UPDATE … RETURNING`; when both slots read `Yes` it checks `MatchPairing.IsPairBlockedAsync` (a blocked pair quietly yields no match, so neither side can infer the block) and then `CreateOrReuseMatchAsync` under the shared `MatchPairing.PairLockKey` advisory lock, storing `ResultingMatchId`. The response carries `matchId`, so the round screen shows "it's a match" without a refetch; the hook also invalidates the Matches list. Since 2026-08-31 the mutual-yes path also sends both users a push notification ("New Match!") and a `match_created` broadcast on `app-nudges` (`{ matchId, userIds, source }`), the same shape Fated Threads and `RequestMatch` emit.
- **Realtime** — topic `townsquare:{sessionId}`, events `session-started`, `session-cancelled`, `round-advanced`, payload `{ sessionId, roundNumber, status }`. Nothing is broadcast on the `Open → Locked` transition. Hooks subscribe through `lib/realtime/subscribeWithRetry.ts` and keep 15 s (session) / 30 s (round) `refetchInterval` safety nets because `SupabaseBroadcastService` is best-effort — see the 2026-08-19 audit above for why those were kept rather than removed.
- **Admin** — `GET /admin/townsquare/sessions` (paged, with RSVP counts) and `GET /admin/townsquare/sessions/{id}/pairings` (per-round responses, join times, resulting match). Added 2026-08-31: `POST /admin/townsquare/sessions` `{ rsvpOpensAt, rsvpClosesAt, scheduledStartAt }` (201; validates opens < closes ≤ start, start in the future; creates `Open`, audit `CreateTownSquareSession`) and `POST /admin/townsquare/sessions/{id}/cancel` (only `Open` / `Locked`, else 409; routes through `TownSquareService.CancelSessionAsync`, audit `CancelTownSquareSession`), with a Schedule / Cancel UI on the control panel's Town Square page. All under the `AdminBearer` scheme.

**Found and fixed in later audits:** the 2026-08-19 duplication audit added the missing `BlockedUsers` check to the pairing path (the circle method makes a blocked pair on opposite sides of the roster meet with certainty, not by chance) and single-sourced `PairLockKey`, which had been byte-identical in `MatchesController` and `TownSquareService` with nothing enforcing that.

**Closed 2026-08-31:** the session-creation gap. Until then nothing but the integration tests wrote `TownSquareSessions` rows and the admin page was read-only; the admin create/cancel endpoints and Schedule/Cancel UI above close it. No scheduler rule or recurring seed exists — sessions are scheduled one at a time by an admin.

**Known gaps — not built, recorded here so nobody assumes otherwise:**
- Pairing is strictly `Male` × `Female`; any other `Gender` value RSVPs successfully but is silently never rostered. Overflow RSVPs beyond 5-a-side, or on the larger side, are likewise dropped at lock time with no notification.
- No score event, quest hook, or loot is attached to attending or matching in a round. `TownSquareIcebreakerResponse` exists as a table but nothing writes to it — the icebreaker is shown as a prompt only.
- No manual end-to-end pass has been run (two browsers, a hand-inserted session, real Agora tokens through a full round-robin).

---

## No-Show Tracking — Shipped (2026-08-18)

**What it is.** Objective attendance accountability for pledged encounters. 48 h after both sides confirm a date, each is privately asked "Did you meet up for [activity]?"; a single mismatch is recorded but inert, and only a pattern of mismatches across distinct matches docks `ReputationScore`. Deliberately *not* a conduct-rating system — subjective ratings are a retaliation vector, and the project's standing decision is "block + unmatch is sufficient, no Report flow". The original spec lived here until 2026-08-31; the code is the authority.

**Shipped:** engine `ActivityService.GetAttendanceCheckStatusAsync` / `SubmitAttendanceAsync`, `ActivitiesController` `GET|POST /activities/{matchId}/attendance-check`, `ScoreService.ApplyReputationPenaltyAsync`, migration `20260818070722_AddNoShowTracking` (`DateConfirmation.CompletedAt` / `InitiatorAttended` / `ReceiverAttended` / `PenaltyApplied`, `User.NoShowFlagCount`), config key `dating.noshow.threshold` (Safety, default 3). App: `hooks/useAttendanceCheck.ts`, `components/modals/AttendanceCheckModal.tsx` mounted in `app/chat/[matchId].tsx`, `date_log_unconfirmed` marker in `app/date-log.tsx`. Tests: `ActivityServiceIntegrationTests`, `ActivitiesControllerIntegrationTests`, `ScoreServiceIntegrationTests`; app `AttendanceCheckModal.test.tsx`, `useAttendanceCheck.test.tsx`.

**Mechanics (code is authoritative — `ActivityService.cs`):**
- `ConfirmAsync` stamps `CompletedAt = now` inside its existing `justCompleted` branch (next to the `DateConfirmed` awards, pledge quest, `first_pledged_encounter`, Oath refresh).
- `GET …/attendance-check` → `{ due, activityTitle }`: due when the match's latest completed confirmation is ≥ 48 h old (hardcoded) and the caller's slot is still null.
- `POST …/attendance-check { attended }` → `{ attended }`: participant-only; idempotent — an already-answered slot returns the stored answer, no re-answering. When both slots are set and differ, the `false` side's `NoShowFlagCount` is incremented via `UPDATE … RETURNING`, guarded by `DateConfirmation.PenaltyApplied` so one match pair contributes at most once; at `>= dating.noshow.threshold` it calls `ApplyReputationPenaltyAsync(user, "RepeatedNoShowPenalty")` — `ReputationScore = GREATEST(0, rep − 0.1)` plus a `Delta = 0` `ScoreEvent` row for the audit trail. Both-yes and both-no are no-ops.
- Neither answer is ever sent to the other party; `GET /activities/mine` exposes only a boolean `mismatched` per trophy, which the Date Log renders as "Unconfirmed" in place of stars.
- Nothing is pushed or broadcast for the check — it surfaces when the chat screen mounts and `due` is true.

**Deviations from the spec:**
- The prompt is a modal on the match's chat screen, not a card in the "What's Next" (`next_action_heading`) section.
- Per-match once-only accounting uses a `PenaltyApplied` column (not in the spec) rather than counting distinct `MatchId`s at threshold time; same effect — repeat mismatches with the same partner do not stack.
- The penalty fires on every mismatch at or above the threshold (3rd, 4th, 5th …), not only "once when crossed".
- Admin visibility, scoped out in the spec, arrived 2026-08-31: `noShowFlagCount` on the admin `UserDetail`, `POST /admin/users/{id}/reset-noshow` (audited as `ResetNoShow`), and a "No-show flagged" analytics tile.

**Open:** no manual two-account walk has been run (confirm → back-date `CompletedAt` in Postgres → answer both sides → observe `NoShowFlagCount` and `ReputationScore`); the 48 h window is hardcoded rather than a `ConfigKeys` entry; no real date/time scheduling (unchanged from the spec's out-of-scope list).

---

## The Oath & The Flame Rite — Shipped (2026-08-19)

**What it is.** Two independent subsystems from the 2026-08-19 strategy pass that re-aimed the app at the 25–33, high-intent, time-poor Ulaanbaatar user. **The Oath** is a public, behavior-backed statement of intent — *Sworn* on selection, *Proven* only after real encounters with no ghosting — that outranks proximity in city-scale matching. **The Flame Rite** moves the video call from *after* the date pledge to a required, mutually-consented five-minute call *before* it, so screening a stranger is something everyone does rather than an accusation one person has to make. The original spec and 11-task plan lived here until 2026-08-31; they were pruned once the code became the authority.

## Execution Outcome (2026-08-19)

All 11 tasks shipped (Group A — Oath, Tasks 1–6; Group B — Flame Rite, Tasks 7–11). Engine: `Services/OathService.cs`, `UsersController` `POST /users/me/oath`, `VideoController` `POST /video/rite/propose|accept|decline`, migrations `20260818191351_AddOath` and `20260818210254_AddFlameRite` (the latter backfills `FlameRiteCompletedAt` for matches that already had a completed `DateConfirmation` or `VideoRewardClaimed`, so in-flight couples were not locked out of pledging on deploy). App: `components/onboarding/OathStep.tsx` (onboarding step 4 of 4), `components/OathSigil.tsx`, `components/FlameRiteCard.tsx`, `hooks/useOath.ts`, Oath card + re-swear sheet on `(tabs)/profile.tsx`, sigils on Discover and Matches. Tests: `OathAffinityTests`, `OathServiceIntegrationTests`, `OathPersistence`/`OathEndpoint`/`OathRanking`/`OathReward` integration tests, `FlameRitePersistence`/`FlameRiteHandshake`/`FlameRiteToken`/`FlameRitePledgeGate` integration tests; app `OathSigil.test.tsx`, `FlameRiteCard.test.tsx`.

**Mechanics a future reader needs** (code is authoritative — `OathService.cs`, `MatchesController.cs`, `VideoController.cs`, `ActivityService.cs`, `EngagementService.cs`):
- Oath values are exactly `Bond` / `Fate` / `Kinship` (`OathService.ValidOaths`); `null` = never sworn, sorts last in ranking but is never excluded. `SwearAsync` sets `OathSwornAt = now` and `OathProven = false` — **re-swearing costs Proven status and that is the entire stake**: no cooldown, no penalty, no visible "changed their oath", and swearing itself pays nothing.
- **Proven rule** (`RefreshAsync`, event-driven from encounter completion and from the ghosting path — no sweep): at least `oath.proven.encounters` (default 2) distinct matches with a `DateConfirmation.CompletedAt` since `OathSwornAt`, **and** zero `GhostPenalty` score events in that window. One ghost demotes Proven → Sworn and makes the current window unprovable; only re-swearing opens a fresh one. The first Proven ever pays `OathProven` +40, milestone `oath_proven`, and the Rare title `title_oathkeeper`; the milestone row is the once-per-user idempotency guard, so a demoted-then-re-proven user is not paid twice. `OathProven` is server-owned, never read from a request body.
- **Matching**: `OathService.Affinity` — same oath 2, adjacent (Bond↔Fate, Fate↔Kinship) 1, opposite (Bond↔Kinship) 0, either side null → null. In `MatchesController.GetCandidates` it sits ahead of the pre-existing chain inside a 25 km band (`OathAffinityBandKm`) that applies to **every** membership level: affinity desc, then both-Proven, then Gold's `PriorityCompatibilityBandKm` / compatibility / distance / score chain unchanged. The single largest behavioral change of the pass.
- **Rite handshake**: all three endpoints require match participation and `IcebreakerComplete`; `propose` returns 409 while a proposal is open and sends a push notification; `accept` sets `FlameRiteAcceptedAt`; `decline` clears the proposal and does nothing else — no score event, no penalty, and either side may propose again. `Match.VideoCallUnlocked` is now set when the icebreaker completes (`EngagementService.CompleteIcebreakerAsync`), not on pledge.
- **Video token**: `POST /video/token` requires `FlameRiteAcceptedAt`; TTL is `dating.flamerite.duration_minutes` (default 5) while `FlameRiteCompletedAt` is null, the normal long-call token afterwards — one endpoint, two TTLs, chosen by state. `POST /video/complete` sets `FlameRiteCompletedAt` once; `VideoRewardClaimed` remains the one-shot payout gate.
- **Pledge gate**: `ActivityService.ConfirmAsync` returns `ConfirmRejection.FlameRiteIncomplete` while `dating.flamerite.required` (default `true`) is on and the rite is not complete. Flipping the key in the admin Config page restores the pre-rite pledge flow with no deploy and no migration — the retreat shipped with the advance.
- Config keys (`ConfigKeys.cs`): `oath.proven.encounters`, `dating.flamerite.duration_minutes`, `dating.flamerite.required`. DTOs: `oath` / `oathProven` on user, candidate and match-profile payloads (public, so visible from reveal level 1); `oathEncountersHeld` / `oathEncountersNeeded` on `GET /users/me`; the four rite timestamps plus `flameRiteRequired` / `flameRiteDurationMinutes` on `MatchResponse`.

**Deviations from the plan:**
- `OathStep` lives in `components/onboarding/OathStep.tsx` beside `NameAgeStep`/`AboutStep`/`PhotosStep`; the plan pointed at `app/(onboarding)/OathStep.tsx`, but that directory only holds expo-router route files.
- Realtime: the plan described a single `flame_rite` event on the match channel. The engine emits four distinct events on the shared `app-nudges` topic — `flame_rite_proposed` / `flame_rite_accepted` / `flame_rite_declined` / `flame_rite_completed` — and `hooks/useRealtimeNudges.ts` subscribes to each.
- The locked pledge CTA (`pledge_locked`) is on `app/activities/[matchId].tsx`, the per-match activity screen, not the `(tabs)/activity` tab, and honours `flameRiteRequired` from the server rather than assuming the rite is always on.

**Known deferral (from the spec, still true):** `RevealService` still gates the second photo behind 5 messages, so immediately after the rite two people who have seen each other on video may still have a blurred photo between them — incoherent, not broken; milestone-based reveal would fix it and was explicitly deferred, as was un-paywalling `HasKids`.

**Still owed / open:** the Task 11 Step 9 two-account ladder walk (match → icebreaker → propose → accept → 5-minute call → complete → pledge → attendance check, plus flipping `dating.flamerite.required` off and back) has never been run, and the video-screen countdown is decorative — both tracked under Outstanding Follow-ups below.

---

## Phone Verification via verify.mn — Shipped (2026-08-31)

### What shipped

Replaced the stubbed OTP flow (`sendOtp` was a no-op returning `true`, `verifyOtp`
accepted any 6 digits and did an anonymous Supabase signup — i.e. anyone could claim
any number) with real phone-ownership proof via **verify.mn**.

verify.mn is **Mobile-Originated**: the user texts *our* code *to* shortcode 144773.
There is no outbound SMS and no code to type in, which reshaped the second auth screen
entirely — it now shows verify.mn's Mongolian `displayInstruction` verbatim, a one-tap
`sms:` button, a live TTL countdown, and a 3s poll, with an explicit expired state.

**Engine** — `VerifyMnClient` (HTTP), `PhoneVerificationService` (session lifecycle +
single-use claim), `AuthController` (`/auth/phone/start|status|callback|claim`),
`PhoneVerification` entity + `AddPhoneVerifications` migration.
**App** — `useAuth` rewritten around start/poll/complete, `(auth)/otp.tsx` rewritten,
`PhoneChangeModal` for the settings phone-change path.

### Decisions worth keeping

- **The engine owns the proof, not the client.** `POST /users` refuses to create a new
  account without a claimed verification and reads `PhoneNumber` from it. The JWT's
  phone claim is client-set (`user_metadata.phone`) and is no longer trusted anywhere.
  `PUT /users/me/phone` requires the same proof, so a number can't be swapped freely.
- **A claim is single-use and cannot be replayed** onto a second account, has a 30-minute
  window after verification, and is refused if the number already belongs to someone else
  (`Users.PhoneNumber` is uniquely indexed, so this is belt-and-braces).
- **Session reuse is deliberate.** Each SMS costs the *user* 150₮, so `StartAsync` returns
  the in-flight session for the same number instead of minting a second code.
- **Unset key = inert enforcement.** With no `VerifyMn:ApiKey`, `IsConfigured` is false and
  the old behaviour stands. That is what lets the pre-existing engine tests pass unchanged,
  and it is also the deploy hazard: **production must set the key or the gate is off.**
- **The callback is a hint, never evidence.** No body, no signature; it only triggers a
  re-read of `GET /sessions/{id}`. `CallbackBaseUrl` is left empty unless the engine is
  publicly reachable, because verify.mn retries failed callbacks.

### Verified

560 engine tests (19 new), 379 app tests, app typecheck, control build. Live smoke test
against the real API: session created, Mongolian instruction returned, status polled,
duplicate start reused the same session and code, 7-digit/letters rejected 400,
`claim` and `POST /users` return 401 unauthenticated, callback answered 200 in 144ms.

### Open

- **Account recovery on reinstall is not built.** A reinstall yields a new Supabase
  anonymous identity; claiming the same number then hits `PhoneInUse` and the user is
  stuck rather than being returned to their account. This is the main gap — it needs a
  deliberate "this number already has an account, sign back into it" path.
- **No rate limit on `POST /auth/phone/start`.** It is anonymous and creates provider
  sessions. Sessions are free and reuse caps per-number growth, but a wide spray across
  many numbers is currently uncapped.
- The old `verify_button` / `otp_invalid_code` i18n keys were removed; `verify_title` was
  repurposed from "Enter the code" to "Prove your number".

## Security & Data-Hygiene Hardening — Shipped (2026-08-31)

Found by an engine-focused audit after the verify.mn work; three of the items were
introduced by that work and are self-corrections.

### What changed

- **Admin login brute-force protection.** `POST /admin/auth/login` guards the only admin
  account and was anonymous and unlimited. `LoginThrottleService` locks a
  username+IP pair for 15 minutes after 5 failures in a 15-minute window and returns
  429 with `Retry-After`. In-memory and per-instance — **a multi-instance deploy needs
  this moved to shared state.**
- **Deletion now deletes.** Anonymisation cleared `PhotoUrls` but `/uploads` is public
  and unauthenticated and `LocalFileStorageService` had no delete method at all, so every
  photo stayed fetchable forever by anyone holding an old URL. Added
  `DeleteByPublicUrl`, called from the anonymisation sweep and when `PUT /users/me`
  drops a photo. Also purges `PhoneVerifications` rows for anonymised users (they hold
  the number in plaintext) and stale unclaimed rows after 24h.
- **Input length caps.** There was not one `[MaxLength]` in the codebase: every string
  was bounded only by Kestrel's 30MB default. `DTOs/FieldLimits.cs` now centralises the
  caps and every free-text request field carries one. The app's composer caps at the
  same 2000 chars so a long message is stopped locally rather than by a 400.
- **CORS allowlist.** `SetIsOriginAllowed(_ => true) + AllowCredentials()` reflected any
  origin with credentials, unconditionally including Production. Now `Cors:AllowedOrigins`
  from config; Development without it stays permissive **but drops credentials**, and
  Production **refuses to boot** without it rather than failing open.
- **Phone-verification races (self-correction).** `ClaimAsync` was read-then-write, so
  the "single use" guarantee did not survive concurrency — now a conditional
  `UPDATE … WHERE "ClaimedByUserId" IS NULL`. `StartAsync` could open two provider
  sessions for one number, leaving the user holding two codes — now serialised on a
  `pg_advisory_xact_lock` keyed by phone, joining an ambient transaction rather than
  nesting one.
- **Sweep no longer loads whole tables.** The hourly pass pulled every active match,
  every user (daily), and every paid user into memory to filter in C#. Staleness now
  goes into SQL via `GhostingService.StaleAfter`, and the budget reset and membership
  expiry are single `ExecuteUpdateAsync` statements.
- **Reveal level on a fresh match.** `NewMatch` stored `RevealLevel = 1` but
  `GetRevealLevel` recomputed from `MessageCount`, where 0 messages meant level 0 — so a
  just-accepted match returned a nameless, photoless, bio-less profile, contradicting
  "Match accepted → first name, 1 photo, short bio". The stored column is now the floor
  (`Math.Max`), which also makes the Ghosted freeze a case of one rule instead of a
  second source of truth.
- **Path-traversal guard** on `LocalFileStorageService` (latent — no caller passed user
  input, but the service accepted arbitrary strings).

### Worth knowing

- Validation attributes on record primary-constructor parameters must **not** use the
  `[property: ...]` target — ASP.NET throws `InvalidOperationException` at model-binding
  time. Caught by a live smoke test, not by the unit tests, which never exercise binding.
- Verified: 582 engine tests (22 new), 379 app tests, app typecheck, control build. Live:
  oversized phone → 400, five bad admin logins → 401 then 429 with `Retry-After: 900`,
  hostile origin gets `Allow-Origin` but no `Allow-Credentials`.

### Deliberately not done

- **No general API rate limiting.** Only the admin login is throttled. `POST
  /auth/phone/start` is still anonymous and uncapped across distinct numbers (per-number
  growth is capped by session reuse).

## Error-Handling Consolidation — Shipped (2026-08-31)

Prompted by an audit of how centralized error handling actually was. The mutation and
crash paths were already solid; reads and domain-vs-fault classification were not.

- **`DomainException`** now carries business rules (status code + caller-facing message)
  and `ExceptionHandlingMiddleware` maps it centrally. Previously `TownSquareService`
  threw `InvalidOperationException`/`ArgumentException` and `TownSquareController` caught
  those types and echoed `ex.Message` — so an EF-thrown `InvalidOperationException` would
  have been reported as a **400 containing internal text** instead of a logged 500. Four
  try/catch blocks deleted from the controller. Internal preconditions
  (`GenerateRoundRobin`'s count check, missing config) stay as framework exceptions and
  correctly become 500s.
- **`QueryCache.onError` in the app.** There was no global handler for reads at all, and
  12 of 27 query-consuming screens had no error state — so a failed read fell through to
  the screen's *empty* state and looked like "no matches"/"no quests". The handler
  surfaces the server's message via `getApiErrorMessage`, with a 10s cooldown so one
  dropped connection does not fire an alert per mounted query. Screens that already
  render their own error + retry opt out with `meta.silentError` (8 hooks).
- **`serverError` promoted** from a private function inside `TownSquare.tsx` to
  `control/src/lib/apiError.ts` and wired into every page's `onError`. The admin panel
  now shows what the engine actually said rather than "Save failed - try again."
- **`notifyUser()` throttled** — an error loop used to stack one modal per rejection.

**Verified:** 588 engine tests (6 new), 383 app tests (4 new), typecheck, control build.
Live: a domain rule returns its own status with the message verbatim; the fault path is
covered by unit tests asserting the internal text does *not* appear in the body.

## Dev Database Reseed + Behavioural Pass — 2026-08-31

Wiped and reseeded the local dev database (`mingldingl_engine/scripts/reseed-dev-db.sql`,
now the standard way to do this) and drove the API with real Supabase JWTs. The old
database held 511 mostly load-test users, **zero icebreakers and zero quizzes**, which was
hiding two real bugs.

### Bugs found and fixed

- **P0 — the icebreaker could almost never complete.** `GET /engagement/icebreaker/{matchId}`
  drew a *random* active question per request, but `BothRespondedAsync` requires both users to
  answer the **same** `IcebreakerId`. With 7 active questions the two participants got the same
  one ~14% of the time; otherwise both answered, `bothResponded` stayed false, `IcebreakerComplete`
  never flipped, neither saw the reveal, and no score was awarded — the core loop dead-ended.
  Invisible before the reseed because there were no icebreakers at all (the endpoint just 404'd).
  The quiz had the identical bug (`FindCompatibilityAsync` matches on `quizId`).
  Both now pick deterministically from the match id (`StableIndex`, SHA-256 over the Guid — not
  `GetHashCode`, which is per-process randomised and would differ between the two users).
  `GET /engagement/quiz` gained an optional `matchId`; the app passes it and its cache key is
  now scoped per match.
- **Photo deletion silently skipped most files.** `DeleteByPublicUrl` prefix-matched the whole
  configured `Storage:PublicBaseUrl`. That value is the LAN IP for on-device testing while stored
  URLs said `localhost`, so nothing matched and the files survived account deletion — the exact
  bug the delete was added to fix. Now matches on the path beneath the uploads root, so a photo
  stored under any earlier origin (localhost / LAN IP / prod domain) is still deletable.
- **Seven tests only passed on an empty database.** `Assert.Single(page.Items)` /
  `Assert.Empty(Db.Ships)` / a global `first_icebreaker` milestone check, all unscoped. The
  integration suite shares this database, so realistic data broke them. Scoped to their own
  fixtures.

### Verified against the reseeded data

Reveal ladder walks exactly per the design table (0 msgs → name+photo+bio, 5 → +age+photo2,
15 → +photo3+district, 30 → deep fields, and deep stays null on Free). Phone-verification gate
returns 403 without a claim. Ghosting sweep, deletion sweep and photo deletion all fire.
598 engine tests, 383 app tests, control build.

### Note

The first reseed replaced `ContentPages` with placeholders, destroying the real authored guides
copy (2.5k chars). Restored from a pre-reseed `pg_dump`; the script no longer truncates that
table, on the same reasoning that already exempted `AdminConfigs`.

## The Campaign (Dungeon Crawl) — Spec (2026-09-01)

**What it is.** A per-match "dungeon map" that renders the existing engagement ladder
(match → icebreaker → quiz → 15 messages → Flame Rite → date pledge → real date) as seven
rooms a pair clears together. The June 2026 dungeon-crawler design did not survive the
ledger prune; this is a fresh, smaller design with one governing rule:

**The anti-annoyance rule (structural, not aspirational).** The campaign is a *lens over
the ladder, never a gate on it*. Room state is **purely derived** from existing match
state — there is no campaign progression state machine, nothing to advance, nothing that
can desync. No existing flow gains a new precondition; chat is untouched except one added
entry banner. The only interaction is optional loot claiming; ignoring the feature
entirely costs a dater nothing. No new push notifications or nudges.

### Rooms (ids are wire-stable string constants, in order)

| # | RoomId | Name | Cleared when (derived) |
|---|---|---|---|
| 1 | `gate` | The Meeting Gate | always (the match exists) |
| 2 | `echoes` | Hall of Echoes | `Match.IcebreakerComplete` |
| 3 | `runes` | The Rune Chamber | two distinct `QuizResponses.UserId` rows share this `MatchId` + `QuizId` |
| 4 | `voices` | Gate of Voices | `Match.MessageCount >= 15` |
| 5 | `flame` | The Flame Altar | `FlameRiteCompletedAt != null \|\| VideoRewardClaimed` (same equivalence the `AddFlameRite` backfill used) |
| 6 | `bridge` | The Pledge Bridge | any `DateConfirmation` for the match with `CompletedAt != null` |
| 7 | `threshold` | The Dragon's Threshold (boss) | a completed `DateConfirmation` with `InitiatorAttended == true && ReceiverAttended == true` |

Rooms are independent (no sequential lock): a pair that skips the quiz still clears
`voices` by chatting. "Current room" in the UI is simply the first uncleared room.

### Engine

- **Entity `CampaignRoomClaim`** — `Id, MatchId, UserId, RoomId (string), ClaimedAt`.
  Unique index `(MatchId, UserId, RoomId)`; claims are per-user (each partner opens their
  own chest). Migration `AddCampaignRoomClaims` also adds the deferred `Memberships.UserId`
  index (Outstanding Follow-ups said to fold it into the next migration).
- **`CampaignService`** (registered in `AddApplicationServices`): room definitions,
  `GetStateAsync(match)` derivation, `ClaimAsync(match, userId, roomId)`. Claim of an
  uncleared room → `DomainException.Conflict`; double claim → unique-index catch → 409.
  Rewards via `AwardWithDeltaAsync` (event types `CampaignRoomBonus` / `CampaignBossBonus`
  — not in `GetDelta`, so no economy-table edit), plus `LootService.RollDropAsync(userId,
  "campaign")` on normal rooms (daily 3-drop cap applies) and `GrantGuaranteedAsync` on
  the boss. Reward machinery keeps its never-fail-the-request convention.
- **`CampaignController`** — `[Route("matches/{matchId}/campaign")]`, `LoadParticipantMatchAsync`
  (requireActive: false — a ghosted match shows its frozen map, claims still allowed for
  already-cleared rooms), `GET` → `CampaignResponse(Rooms[], ClearedCount, BossCleared)`
  with per-room `RoomId, Cleared, Claimed, BonusScore`; `POST rooms/{roomId}/claim` →
  `ClaimCampaignRoomResponse(Awarded, DroppedItem?)`.
- **Config keys**: `campaign.enabled` (Bool, true, Growth), `campaign.room.bonus`
  (Number, 5, Scoring), `campaign.boss.bonus` (Number, 25, Scoring). Disabled ⇒ both
  endpoints 404, app hides its entry banner on 404.
- **No new broadcast events.** Every room-clearing action already broadcasts
  (`icebreaker`, `quiz`, `message`, `flame_rite_completed`, `date_confirmed`); the app
  adds `queryKeys.campaign(matchId)` invalidation to those existing handlers.

### App

- `app/campaign/[matchId].tsx` — vertical dungeon path: `TiledBackdrop` + `ScreenHeader`,
  room nodes (medallion icon, name, state) joined by a path line; cleared-unclaimed rooms
  show a chest CTA; the first uncleared room is highlighted with a `QuestBanner` deep link
  to the screen that clears it (icebreaker/quiz/chat/video/activities); boss room
  ember-tinted. Claim feedback via inline `LootToast` + `awardedSelector` score bump +
  `setPendingDrop` for items.
- `hooks/useCampaign.ts` (house style: parse function, `enabled: !!matchId`,
  `meta.invalidates` + `awardedSelector` on the claim mutation), `queryKeys.campaign`,
  `apiClient.matches.campaign/claimCampaignRoom`.
- Entry point: one `QuestBanner icon="map"` in `chat/[matchId].tsx` above the existing
  ladder banners, hidden while the campaign query 404s.
- i18n `campaign_*` keys, EN + MN, `%{}` interpolation; locale-store subscription line.

### Testing

Engine integration tests (real Postgres, `IntegrationTestBase`): per-room derivation,
claim pays once (asserted through the `ScoreEvents` ledger), uncleared claim 409, double
claim 409 with no double award, disabled-config 404, boss guaranteed loot. App: hook test
with `createAppQueryClient`, screen test with mocked hooks asserting literal EN copy.

### Deliberately out of scope

Milestone-based reveal (the known Flame Rite deferral), campaign push notifications,
partner-visible claim state, admin analytics tiles, QuestTile progress pips.

### Execution Outcome (2026-09-01)

Shipped as specced, TDD throughout (tests written and watched fail before each unit).
**Engine**: `Models/CampaignRoomClaim.cs`, `Services/CampaignService.cs`,
`Controllers/CampaignController.cs`, `DTOs/CampaignDto.cs`, migration
`20260831163301_AddCampaignRoomClaims` (includes the deferred `Memberships.UserId`
index — that follow-up is closed), three `campaign.*` config keys. 17 new integration
tests (`CampaignServiceIntegrationTests`, `CampaignControllerIntegrationTests`); full
suite 615/615. **App**: `hooks/useCampaign.ts`, `app/campaign/[matchId].tsx` (vertical
dungeon path, chest claims via `GameButton` + `setPendingDrop`, current-room
`QuestBanner` deep links), entry banner in `chat/[matchId].tsx` (hidden while the
campaign GET 404s), `campaign(matchId)`/`campaignAll` query keys, `campaign_*` i18n
EN+MN, campaign invalidation added to the five relevant realtime handlers (after the
self-guards — own actions invalidate via their mutations' `meta.invalidates`, which
gained `campaignAll` in useIcebreaker/useQuiz/useChat/useActivitySuggestions and a
direct invalidate in the video screen). 8 new app tests; 403/403, typecheck clean.
Control types regenerated; lint + build pass.

**Notes for a future reader:**
- The claim endpoint intentionally works on ghosted matches (`requireActive: false`) —
  already-cleared rooms stay claimable; a frozen map punishes nothing beyond what
  ghosting already did.
- `flame_rite_completed`'s realtime handler has no self-guard (the completer's own
  screen invalidates directly, and the payload's `userId` is the completer) — the
  campaign invalidation there fires for both participants, which is harmless.
- Room claim loot uses source `"campaign"`; boss claims use `GrantGuaranteedAsync`, so
  `Assert.NotNull(DroppedItem)` in the boss test is safe only because the test user owns
  no items (a fully-collected user gets `DuplicateLoot` +10 and null instead).

**Manual two-account walk — RUN and PASSED (2026-09-01, same day).** API-level against the
real stack (two `e2e-campaign-*@mingldingl.test` Supabase users, real JWTs, live engine,
local Postgres): fresh match showed gate-only cleared; double gate claim 409; sealed-room
claim 409; unknown room 404; icebreaker both-responded cleared `echoes`; quiz
both-responded cleared `runes` (compatibility 100 returned to the second responder); 16
alternating messages cleared `voices`; rite propose→accept→`/video/complete` cleared
`flame` (self-accept correctly 403); both-confirm pledge cleared `bridge`; after
backdating `CompletedAt` 49 h, both attendance submissions cleared `threshold` with
`bossCleared: true`. Ledger verified in Postgres: user A had exactly 6×`CampaignRoomBonus`
(+30) + 1×`CampaignBossBonus` (+25), two `UserItems` with source `campaign` (boss claim
paid its guaranteed drop), 8 `CampaignRoomClaims` rows total. Kill-switch verified by
flipping the `AdminConfigs` row + engine restart: both endpoints 404 while off, full state
intact when re-enabled. Not exercised: the admin Config *page* path for the flip
(`PUT /admin/config/{key}` + in-process `Set`) — the dev admin password is only stored
hashed; the DB-value + seeder path is what was proven. The two e2e users and their match
remain in the dev DB under the `e2e-campaign-` prefix.

## Ulzii Design Language — Spec (2026-09-01)

**What it is.** Replaces the app's generic-fantasy ornament layer (L-bracket corners,
rivets, plain dividers) with Mongolian ornament rendered from geometry: **өлзий** (the
endless knot, a billiard-path interlace woven over/under by crossing parity) and
**алхан хээ** (the walking fret, an integer-lattice meander). Approved from the live
design probe published as the "Ulzii Design Language" artifact, which is the visual
reference for this work; its "doctrine" section is normative:

1. **Edges and thresholds only** — corners, frames, dividers, seals, meter fills; never
   behind text, never over photos, never as background texture.
2. **Three metals, three meanings** — gold default; ember for stakes (boss, Rite, Oath);
   brass for utility. No fourth metal.
3. **Density ladder** — 2×2 knots at corners, 3×4-ish for sigils, 5×5 only for set
   pieces; at most one grand knot per screen.
4. **Static by default** — PNG assets everywhere (works at vfx=off); Skia motion only
   where a moment earns it, only at vfx=full (deferred, see below).

**Generator, not illustration.** `mingldingl_app/scripts/gen-ornaments.js` — pure Node
(zlib PNG encoder, same pattern as `gen-parchment.js`; no node-canvas): traces knot
strands, flattens the boundary-loop beziers, rasterizes capsule strokes with analytic
AA in the app's palette (5-layer gild: shadow/dark/main/bright + crossing punch-outs
rendered as alpha erase so assets sit on any ground), writes `assets/ornaments/*.png`
at 3x. Rerunnable any time; assets are checked in.

**Assets**: `knot_gold` / `knot_dim` / `knot_ember` (2×2), `knot_boss_ember` (5×5),
`sigil_bond` (3×3 gold) / `sigil_fate` (3×4 ember) / `sigil_kinship` (4×3 brass),
`fret_gold` + `fret_dark` (long meander strips).

**Component changes** (shared components carry the spread):
- `AppCard` — corner brackets + rivets → one knot asset in 4 flip orientations.
- `SectionDivider` — center ◆ → mini knot; gradient lines stay.
- `XPBar` — dim gold fret on the empty track; dark fret engraved over the tier-gradient
  fill; shimmer/ticks/flash untouched.
- `QuestBanner` — optional `medallion="knot"` (default stays the meaningful icon);
  the campaign entry banner in chat uses it.
- `CharacterCard` — woven frame: fret strips on four edges (two rotated) + knot-locked
  corners, inside the tier-colored border; tier still controls the light.
- `OathSigil` — glyph char → per-oath sigil image (gold/ember/brass), text unchanged.
- `app/campaign/[matchId].tsx` — room medallions become knots: gold cleared, dim
  sealed, ember 5×5 for the boss; current-room glow ring stays.
- Type: `Alegreya SC` added as `FONTS.utility` for small-caps labels in the changed
  components (app-wide small-label sweep is a follow-up).

**Deferred**: Skia shimmer tracing the Oath sigil / boss seal (vfx=full set piece);
empty-state unlit knots; festival-tinted ornament variants.

### Execution Outcome (2026-09-01)

Shipped as specced, tests-first. **Generator**: `scripts/gen-ornaments.js` — billiard
trace + bezier-flattened wall loops + analytic-AA capsule rasterizer + RGBA PNG encoder,
~250 lines, no dependencies; wrote all 9 assets to `assets/ornaments/` (checked in;
2×2 knots 127px, boss 169px, fret strips 1610×50 — sizes are 3× display points).
**Components**: `AppCard` (4 knot corners via one asset + flips; brackets and rivets
gone), `SectionDivider` (knot replaces ◆), `XPBar` (fret at 0.15 on the track,
`fret_dark` engraved at 0.5 on the fill; `pointerEvents` note: RN `Image` takes it in
style, not as a prop), `QuestBanner` (`medallion="knot"` opt-in; default icon behavior
covered by a test), `CharacterCard` (fret frame: two horizontal strips + two 452-long
strips rotated about their centers, 4 corner knots), `OathSigil` + `OathStep` + the
profile re-swear sheet (glyph chars → `OATH_SIGILS` images; `OATH_GLYPHS` still exported
but unused), campaign screen (knot medallions: gold cleared/current, dim sealed, ember
5×5 boss). `lib/ornaments.ts` is the asset registry; `FONTS.utility` =
`AlegreyaSC_700Bold` (new dep `@expo-google-fonts/alegreya-sc`), applied in the campaign
screen labels.

**Verified**: 7 new jest tests (`ulziiOrnaments.test.tsx`), suites 51/51 (410 tests),
typecheck clean — and a **live Playwright walk of the real web app against the real
engine** (real Supabase session for `e2e-campaign-a`; engine phone endpoints
route-stubbed: `verificationId` is the field `useAuth` needs, not `id`): screenshots
confirmed knot corners + divider knots on the Character Sheet, the fret walking through
the XP bar, the knot campaign banner in chat, and the full campaign map — six gold rooms
and the ember boss seal. RN-web + Playwright gotchas worth keeping: `fill()` and
`pressSequentially` do NOT reach RN's controlled TextInput (focus + `page.keyboard.type`
works), and RN-web `button` presses need `element.click()` in `evaluate` — added here to
supplement the verify skill's list.

**Follow-ups**: the deferred items above, plus a device pass for density/brightness
tuning (web pass looked right at first review). The app-wide `FONTS.utility` sweep that
was open here is done — see "Design Token Consolidation" below.

## Design Token Consolidation — Shipped (2026-09-01)

An aesthetics audit of `mingldingl_app` (113 screens/components) found colour well
tokenised (647 `COLORS.*` references, zero raw `fontFamily` strings) but the type and
space scales declared in `lib/theme.ts` almost entirely unused: `FONT_SIZES` was exported
and imported by **nothing** while 241 raw `fontSize` literals spread across 19 distinct
values, and `SPACE` had 11 references against 453 spacing literals. The visible symptom
was on `app/progression.tsx`, where four stacked cards rendered eyebrow labels at 10/11/12
and body copy at 13/14, and two adjacent stat cards showed their headline numeral at 18
and 20.

**What changed**

- `lib/theme.ts` is now the single source of every colour, size and space value.
  `FONT_SIZES` gained a `wordmark` step (the CloisterBlack logo, a real role, not drift);
  `SPACE` became a strict 4px grid with `hair`/`gutter`/`scrollTail` named for the layout
  roles they always play; `RADIUS` gained `pill`. New: `FILL` (one alpha per affordance
  role), `circle(size)`, and `BUTTON_METALS` — GameButton's hand-tuned variant table,
  hoisted out of the component unchanged so no button shifted a pixel.
- Every `fontSize`, spacing and `borderRadius` literal in `app/` and `components/` was
  snapped to those scales by codemod (nearest step; 13→14, 15→16, 17→18, 20→22). Ten
  geometric radii became `circle()` calls. All 25 raw `rgba()` literals now route through
  `tint()`/`overlay()`/`FILL`, which also collapsed the gold "selected" fill from four
  drifting alphas (0.1/0.15/0.2/0.22) to one.
- New `components/ui/CardEyebrow.tsx` replaces the tracked card/section label that had
  been copy-pasted ten times with drifting size, tracking and margin. It uppercases its
  own label (six call sites were doing `.toUpperCase()` by hand) and sets it in
  `FONTS.utility` — closing the Ulzii follow-up. Verified `AlegreyaSC_700Bold` carries
  Cyrillic including Ө/Ү/ө/ү before adopting it for Mongolian copy.
- `FatedThreadsSection` was re-implementing AppCard's exact shell (panel + bronze +
  `RADIUS.md`) minus the corner knots, gold hairline and texture, so it read flatter than
  its neighbours on the quest screen; it now uses `AppCard`. `DailyBudgetMeter` is an
  inline pill, not a card — it just took `RADIUS.pill`.
- `lib/tiers.ts` had restated five palette hexes verbatim in `RARITY_COLORS` and
  `FRAME_COLORS`, so a palette edit would not have reached rarity or frame colours; those
  now reference `COLORS`. Membership's Silver badge hexes moved into the palette. The gem
  and gem-shade tables in `tiers.ts` stay literal — they are a deliberate second palette.

**Remaining literals, by design**: the twelve gem/shade hexes in `lib/tiers.ts`, and
`'#00000000'` in `TorchGlow.tsx` (a transparent Skia gradient stop, not a colour).

**Verification**: `npm run typecheck` clean, 54 suites / 427 tests pass (`CardEyebrow`
adds 4, including a Mongolian-uppercase case), and `npx expo export --platform web`
bundles. Not yet checked on a device — the size changes are at most ±2px per step but
Mongolian strings are longer than English, so button and tab labels deserve a real
look before this is called done.

## Outstanding Follow-ups

Salvaged from the per-feature SDD execution ledgers before those were pruned
(2026-08-19). These are the items that were consciously deferred during
execution rather than fixed, and that no Shipped record above captures. Purely
cosmetic and test-quality minors were dropped with the ledgers; what follows is
what still has a real consequence.

### Manual verification still owed

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

### Behavioral

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
- **`AdminConfigControllerIntegrationTests.Update_TierThreshold_BackfillsStoredGemTiers`
  deadlocks intermittently under the parallel test run** (Postgres 40P01: its
  `RecomputeAllGemTiersAsync` bulk-updates every Users row while reward tests hold row
  locks in their open transactions). Passes alone and on re-run; seen twice on
  2026-09-01. Pre-existing structural flake, not tied to any one feature — fix is test
  isolation (serialize that test class or scope the backfill), not code.
- **Phone-verification account recovery + start-endpoint rate limiting.** See the
  "Open" list under the verify.mn entry above. Recovery-on-reinstall is the one with a
  real user-facing consequence.
- **`LoginThrottleService` is per-instance.** Fine for the current single-container
  deploy; a second instance halves the effective lockout. Needs shared state if the
  engine is ever scaled out.
- **`Cors:AllowedOrigins` must be set before any non-Development deploy** — the engine
  now throws at startup without it. Deliberate (fail closed), but it will stop a deploy
  that has not been updated.

### Known gaps, deliberately not built

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
- **No-Show Tracking's 48 h window and Fated Threads' 14-day expiry are hardcoded**
  (`ActivityService`, `DailyMaintenanceBackgroundService.ShipExpiryPeriod`) — the
  only two tunables in this area not in `ConfigKeys`.
- **Same-ship invite-code collision inside a single `CreateAsync`** would
  silently misroute slot B. Vanishingly unlikely, unguarded.

### Closed 2026-08-31 — audit fixes

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

### Codebase-wide, larger than any one feature

- ~~**`getApiErrorMessage` surfaces raw English server error strings.**~~ CLOSED
  2026-09-01. Every error response now carries a stable `code` beside its English
  `message` (`ErrorResponse(Error, Code)`); `DomainException` and the
  `ApiErrorExtensions` helpers all require one, so the compiler refuses a new error
  without a code. The app maps `code` -> `err_<code>` i18n keys (74 codes, EN + MN)
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
