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
Warcraft/tower-defense-adjacent dark fantasy, not premium-luxury minimalism as originally spec'd — the app went through a full RPG reskin (2026-07-03; that overhaul's design spec was folded into this section and the code — `lib/theme.ts` is the reference) plus a palette retheme afterward. Yeseva One (display) + Alegreya (body) + Alegreya SC (small-caps utility labels) fonts — the original Cinzel choice was replaced during the Ulzii pass. Single source of truth: `mingldingl_app/lib/theme.ts`.

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

| Tier | Gem (`GEM_COLORS`) | Shade (`GEM_SHADES`) | Score threshold |
|---|---|---|---|
| Garnet | `#C23B54` | `#5C0F22` | 0 |
| Opal | `#3DEFDB` | `#0E6E68` | 100 |
| Amethyst | `#A855F7` | `#4C1D82` | 300 |
| Sapphire | `#2D6CDF` | `#0A2F6E` | 600 |
| Ruby | `#E0115F` | `#6E0630` | 1000 |
| Emerald | `#2ECC71` | `#0B5A32` | 2000 |

Every threshold above Garnet is admin-tunable (`tier.<name>.threshold`). Thresholds are `ScoreService.TierDefaults` (`mingldingl_engine/src/MinglDingl.Engine/Services/ScoreService.cs`); the client hydrates them via `useTierThresholds`, see the note under Folder Structure.

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
- **Deep (membership-gated):** Kids, habits (smoking/drinking), lifestyle, religion. (Income range and membership-gated extra photos from the original spec were not built: `User` has no income field and `FieldLimits.MaxPhotos` = 6 applies to everyone.)

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
| Activity date confirmed | +50 |
| Video call completed | +30 |
| A Fated Thread you wove sparks | +40 (`ShipSparked`) |
| Your Oath is proven | +40 (`OathProven`) |
| Campaign room / boss room claimed | +5 / +25 (`campaign.room.bonus`, `campaign.boss.bonus`) |
| Daily quest complete / all quests' chest | per quest `quest.<id>.xp` / +30 (`score.quest_chest`) |
| Seventh consecutive daily login | +50 extra (`score.streak.weekly_bonus`) |

Daily login is `DailyLogin` × the current streak (capped at 7), not a flat +5. Every delta is
`ScoreService.DefaultDeltas`, overridable per event through `score.event.<Type>`. The original
"+25 for a positive fun tag" has no counterpart: fun tags were never built (see §6).

#### Losing Points
| Activity | Penalty |
|---|---|
| Ghost a match (no reply 48h) | -15 |
| Receive a negative report | -30 (`ReportPenalty` — reserved; no report endpoint exists yet, see Outstanding Follow-ups) |

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

The four thresholds are `reveal.levelN.messages` (admin-tunable, strictly increasing); the app
hydrates them via `GET /engagement/reveal-thresholds` (`lib/reveal.ts`, `useRevealThresholds`) so
the chat's reveal strip and the deep-profile hint never pin their own counts. If conversation
dies (`ghosting.stale_hours`, default 48), unlock progress freezes at the level reached.

#### Anti-Ghosting
- Ghosting applies a score penalty and docks reputation; both sides get a `match_ghosted` push
- **Not built:** the pre-ghost "soft nudge" at 48h and the "Slow Responder" tag on repeat
  ghosters. Neither has a code counterpart; the ghost record and reputation dock are the only
  visible consequences today.

---

### 4. Engagement Engine

#### Icebreakers
First interaction in a new match is a prompted question/mini-game — both users answer independently, answers revealed simultaneously. Completing earns +20 pts each and unlocks video (`Match.VideoCallUnlocked`). Chat itself is **not** gated on it — messaging is open from match acceptance, the icebreaker banner sits above it; the original "unlocks chat" rule was never enforced on either side and is recorded as a design decision under Outstanding Follow-ups.

#### Compatibility Quizzes
Short quizzes (5 questions) on values, lifestyle, interests. Results shown as compatibility % with each match. Earns +15 pts.

#### Activity Suggestions
After `activity.suggestions.messages` messages (default 15, admin-tunable), the app surfaces contextual activity suggestions (coffee, hiking, cinema, board game café). Both users tapping "We're doing this" confirms an activity date and earns +50 pts each. Since the Flame Rite shipped, the pledge itself is refused until the rite is complete while `dating.flamerite.required` is on (`ActivityService.ConfirmAsync`).

#### Video Calls
- In-app video via **Agora SDK**
- `Match.VideoCallUnlocked` flips when the icebreaker completes (`EngagementService.CompleteIcebreakerAsync`), no longer on pledge
- A token is only minted once the Flame Rite has been accepted (`VideoController`, `POST /video/token`); TTL is `dating.flamerite.duration_minutes` (default 5) until the rite is completed, then the normal long call
- No post-rite duration cap is enforced: the long token is 24 h (`VideoTokenService.TokenExpireSeconds`) and the video screen's countdown is decorative (Outstanding Follow-ups). The original spec's 30-minute cap was never implemented.
- Call completion earns +30 pts each — to both participants, claimed per side
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

| Feature | Model | Detail | Status |
|---|---|---|---|
| **Membership Tiers** | Subscription | Unlock deep profile, more daily matches | Built (mocked billing; prices/discounts admin-tunable) |
| **Fun Tags** | Paid (per tag or pack) | Personality labels gifted to matches, visible on their profile card | **Not built** |
| **Reputation Repair** | Paid (tiered pricing) | Reset/reduce reputation penalty from ghosting or reports | **Not built** |
| **Score Boosters** | One-time purchase | Extra daily match slots, XP multiplier for 24h | **Not built** |
| **Profile Boost** | One-time purchase | Featured in discovery for 1–3 hours | **Not built** |

Only membership exists in code. The other four rows are the original design intent, kept here so
the table stays the reference for what a payments integration would unlock; none has a model,
endpoint, or screen.

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
| Prove your number | `(auth)/otp` | verify.mn Mobile-Originated flow: shows the engine-minted code and shortcode `144773` with a one-tap `sms:` link, polls `GET /auth/phone/status/{id}`; nothing is typed in |
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
| Campaign | `campaign/[matchId]` | The per-match dungeon map; rooms clear from real progress, claims pay `campaign.room.bonus` |
| Activities (per match) | `activities/[matchId]` | Suggestions once `activity.suggestions.messages` is reached; pledge + attendance check |
| Business | `business/[id]` | Partner detail + ratings |
| Progression / Leaderboard / Date log | `progression`, `leaderboard`, `date-log` | Score history and tier ladder; city leaderboard; confirmed encounters |
| Edit profile / Settings / Blocked | `edit-profile`, `settings`, `blocked-users` | Deep fields; language, notifications, age range, pause, phone change, deletion; unblock |
| Guides / Privacy / Terms | `guides`, `privacy`, `terms` | Admin-editable content pages (`GET /content/{slug}`) |

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
├── components/        # one shallow directory per surface, plus a few loose
│   │                  # top-level ones — ContentPageScreen, ErrorBoundary,
│   │                  # NextActionCard, OfflineBanner, PhotoGrid
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
│   ├── reveal.ts       # reveal ladder, same pattern (useRevealThresholds)
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
- The paid extras in §6 (Fun Tags, Reputation Repair, Score Boosters, Profile Boost) and the
  §3 "Slow Responder" tag / pre-ghost soft nudge — designed, never built, not scheduled

Shipped since the original MVP spec (no longer out of scope): push notifications (Expo push, `PushNotificationService`), a full gamification layer (daily quests, streaks, milestones, and named honours — the random loot drops that preceded them were retired 2026-09-05, see the shipped log), realtime nudges, multi-select photo onboarding, and the dark-fantasy RPG visual overhaul.

---

# Outstanding Follow-ups

The live backlog: items consciously deferred that still have a real consequence. Closed items
are not struck through here — their record moves to [`shipped-log.md`](shipped-log.md).

## Found on the first real-device run (2026-09-06, Redmi/Expo Go SDK 54)

Three bugs found here were fixed the same session (see `shipped-log.md`). These are what the run
turned up and left open:

- **`AtlasOverlay` setState-during-render.** LogBox, every time Discover mounts: "Cannot update a
  component (`AtlasOverlay`) while rendering a different component (`DiscoverScreen`)". React
  tolerates it today; it is a real violation and the fix belongs in whichever Discover render path
  writes atlas state.
- **World-layer strings are still English for `mn` users.** The eleven keys in
  `AWAITING_MN_TRANSLATION` — the Hold/atlas overlay, the seven room names, and the Settings
  `sound` label — render in English on a Mongolian device. They need a native speaker, not a
  guess; `sound` in particular sits between two translated rows in The War Room.
- **Seeded profile photos are missing on this machine**, so every candidate card, thread avatar and
  the character sheet shows a placeholder. Not a code bug: `python3
  mingldingl_engine/scripts/gen-seed-photos.py` has not been run since the last reseed.
- **The seeded phone numbers (`810000xx`) cannot reach verify.mn** — `POST /auth/phone/start`
  answers 503 because `81` is not a valid Mongolian mobile prefix. Any device sign-in test needs a
  real prefix; the dev DB currently has Undram (`091eadb0…`) pointed at the test SIM `88583269`
  (and the throwaway `Khashaa` row's number nulled) so a rich character can be signed into.

## Found on the second real-device sweep (2026-09-06, Galaxy A51/Expo Go SDK 54)

A pass over Town Square, the Mission Board, venues, the character sheet and the per-match
activities. Eleven fixes from it shipped the same session (see `shipped-log.md`); these are what
it turned up and left open:

- **The chat composer never returns to the bottom once the keyboard has been open.** Open a
  thread, focus the message box, dismiss the keyboard (Back or by tapping the list) — the composer
  stays lifted ~70dp with dead world-floor showing under it for the rest of that screen's life;
  re-entering the thread clears it. Ruled out: it is not the `KeyboardAvoidingView` `behavior`
  value (`height`, `padding` and `undefined` all reproduce), and screens with a text input but no
  `KeyboardAvoidingView` (the icebreaker's answer box) do not show it. Next suspect is the
  interaction between Expo SDK 54's edge-to-edge Android window and `adjustResize`.
- **Icebreaker and quiz content is single-language by schema.** `Icebreakers.QuestionText` and the
  quiz tables hold one string, seeded in Mongolian, so an English-locale user reads the Town Square
  round prompt and every icebreaker in Mongolian. Localising it means a column per locale (or a
  translations table), not an i18n key.
- **A modal turns the Android navigation bar white.** Every `Modal` (the leave-the-square confirm,
  the activities sheet, the chest) renders its own window and the system navigation bar reverts to
  the light default under a dark app.
- **`icebreakerComplete` gates the video button and nothing else.** Neither the app nor the engine
  stops you messaging before the icebreaker, so the character sheet's `next_action_icebreaker`
  ("Break the ice with X to unlock chat") promises a lock that does not exist. Either gate
  `POST /matches/{id}/messages` on it or reword the card.
- **A thread with no messages yet renders as an empty screen** — no prompt, no empty state, just
  the reveal strip and the activities row above a blank scroll area.
- **The leaderboard is anonymous by design** (`LeaderboardEntryDto` carries rank/tier/score only),
  so every row reads `#N ◆ 3,724 pts` with nothing to recognise. Worth confirming that is still
  the intent — it is currently a ranking of strangers.
- **Seeded venues have no photos** (`PhotoUrls` is `'[]'::jsonb` for every `BusinessPartner`), so
  the venue hero and the Encounter Log thumbnail always fall back to the placeholder. The
  placeholders now carry a glyph, but `gen-seed-photos.py` never has venue URLs to fill.

## Manual verification still owed

All need the `verify` skill (real Supabase JWTs, full stack running).

- **Fated Threads — the full pass, never run.** Weaver A weaves B + C → B's `GET /ships/pending`
  names A and nothing about C → B accepts, nothing sparks → C accepts: match exists, chat shows
  "Woven by A", neither `DailyMatchesUsed` moved → A's honour toast fires once and does not replay
  → the weave past `ships.daily.cap` is rejected → a brand-new number resolves via the onboarding
  code field; plus two distinct codes on the confirmation screen, the blocked-Weaver silent no-op,
  same-number rejection, push + list refresh on spark, and the Missions-tab CTA.
- **Town Square — no two-browser end-to-end run** (a scheduled session, real Agora tokens,
  a full round-robin).
- **Flame Rite — the app screens** (jest-covered only) and the 5-minute vs long token TTL (the
  Agora token is opaque; would need decoding its privilege expiry). The API-level ladder passed
  2026-09-01.
- **No-Show — the threshold-crossing `RepeatedNoShowPenalty` leg** is integration-test-only
  (needs three distinct-match mismatches). The mismatch → flag walk passed 2026-09-01.
- **Membership — the duration `ChoiceRow`'s rendered layout** (MN label length, chip wrapping)
  and one real end-to-end upgrade call.
- **The world pass below the Gate — never seen.** Only `(auth)` renders without a backend, so the
  Long Road, Tavern, Hearth, Forge, Hall and Deep have had their light judged by nobody: the six
  signatures, the per-room state ramps, the floor showing through each migrated screen, the atlas
  over a real profile, and the descend/rise transitions. Needs the `verify` skill.
- **The six sounds have never been heard, and no haptic has fired on hardware.** Both were written
  and unit-tested against mocks. The WAVs are synthesised, so their voicing is a guess until
  somebody plays them on a phone speaker; the silent-switch behaviour is likewise untested on a
  real device.
- **A device pass for the design-token snap and the Ulzii ornaments** — sizes moved at most
  ±2 px per step, but Mongolian labels are longer than English; knot density/brightness looked
  right on web only.

## Security & identity

- **A production deploy without `VerifyMn:ApiKey` is wide open** — the gate, the metadata-phone
  alias and `POST /users`'s metadata fallback are all inert/live together, and nothing refuses to
  boot in that state the way `Cors:AllowedOrigins` does.
- **The returning-user alias is keyed on the phone the identity proved.** If an aliased user
  later changes their number from that device, the alias stops resolving and the device behaves as
  a fresh identity. An `AuthAliases (Sub → UserId)` table would remove the dependency and save a
  query per request; needs a schema change.
- **No per-IP limit on `POST /auth/phone/start`** and no general API rate limiting. The
  per-number cap bounds abuse against one target, not provider-quota burn across many numbers.
- **`LoginThrottleService` is per-instance** — a second engine instance halves the effective
  lockout. Needs shared state if the engine is ever scaled out.
- **`POST /video/complete` is a client assertion** — any participant can claim the score,
  honour and milestone without a call connecting. Corroborating it needs Agora webhooks; the
  never-built 30-minute post-rite call cap is parked with the same dependency.

## Product decisions pending

- **Chat is not gated on the icebreaker.** The spec says completing it "unlocks chat"; nothing
  ever enforced it, and gating now would strand every active match that skipped it. If wanted:
  `MessagesController.SendMessage` behind a config key, banner becomes a wall.
- **The video-screen countdown is decorative** — resets on remount, not anchored to token issue
  or `FlameRiteAcceptedAt`, and 0:00 does nothing. Reads as an enforced limit that isn't.
- **`MatchReply` (+10) has no cap.** Two accounts alternating one-character messages farm score
  without limit — 200 messages to Emerald. Options: per-match/per-day cap, minimum length, decay.
- **A match where nobody ever messages can never be ghosted** — both the sweep and
  `GhostingService.IsStale` require `LastMessageAt != null`. Falling back to `CreatedAt` closes it
  but leaves no single party to penalise (`LastMessageSenderId` is also null).
- **`ReportPenalty` (−30) has no award path** — no report endpoint exists. Closing it means a
  report flow: endpoint, moderation surface in `mingldingl_control`, award call site.
  `ScoreHistoryList.ENGINE_EVENT_TYPES` deliberately omits it.
- **Second and later recruits produce no toast** since Ally-Caller is earned once. Whether a
  repeat recruit deserves acknowledgement is a product call.
- **Kill switches show copy rather than hiding entry points** (`ships.enabled`,
  `townsquare.enabled`). Hiding the tab / weave CTA on a 404 is a follow-up if used in anger.

## Known gaps, deliberately not built

- **Fated Threads' Pass-side blocking** (`BlockWeaver`) — only the `BlockedUsers` check on
  `POST /ships` exists. A same-ship invite-code collision inside one `CreateAsync` would silently
  misroute slot B (vanishingly unlikely, unguarded).
- **Town Square** pairs strictly `Male × Female` (other genders RSVP but are never rostered),
  drops overflow RSVPs silently at lock time, and attaches no score, quest or honour to attending.
- **Reveal after the rite** — the second photo still unblurs at 5 messages; milestone-based
  reveal and un-paywalling `HasKids` were deferred.
- **The world lights only what some screen has already fetched.** `useWorldState` subscribes to
  the query cache and never fetches, on purpose — so a room whose data nobody has asked for yet
  sits at its base light rather than its true one (the Tavern is unlit until the Town Square tab
  has been opened once this session). Correct by the "no data is not darkness" rule, but it means
  first-run light is systematically dimmer than steady-state light.
- **`WORLD_ENABLED` is a build-time constant, not admin config.** Flipping the world off is a
  release. The app has no generic config-read path — tier and reveal thresholds each got their own
  endpoint — and a cosmetic layer did not justify inventing one.
- **The atlas ships English-only.** `AWAITING_MN_TRANSLATION` lists the eleven keys (the hold
  title, seven room names, the two map labels, the Sound row); `enableFallback` renders them in
  English for an `mn` user, which is a visible gap rather than a wrong translation. The parity
  test fails if one is translated and left on the list.
- **Ulzii deferrals** — Skia shimmer on the Oath sigil / boss seal, unlit empty-state knots,
  festival-tinted ornament variants.
- **Admin panel** — `ConfigField` ignores `Min`/`Max` (server error shows in the toast);
  `admin.*` error codes are English-only on purpose; `lib/apiError.ts` reads `error`, not `code`.
- **Mongolian copy is unproofread by a native speaker**, and `en`/`mn` diverge in voice where
  the 2026-07-28 rewrite deliberately left `mn` alone.
- **§6 paid extras** (Fun Tags, Reputation Repair, Score Boosters, Profile Boost) and the
  "Slow Responder" tag / pre-ghost nudge — designed, never built, not scheduled.

## Code health

- **Colour system, stage 2 of 3 (2026-09-06).** `lib/theme.ts` now carries a semantic role layer
  (`SURFACE`/`INK`/`ACCENT`/`LINE`/`STATUS`/`STATUS_SOFT`) over the raw `COLORS` pigments, and
  `COLORS.bronze` is fully migrated off (36 borders → `LINE.edge`, 12 empty-state icons and the
  locked/inactive states → `INK.muted`, 5 structural fills → `LINE.edge`). Stage 3 — migrating the
  remaining raw-pigment call sites (`COLORS.gold` 178, `textDim` 123, `text` 94) and widening the
  `palette.test.ts` guard from "no `COLORS.bronze`" to "no raw `COLORS` outside the theme" — is
  **not done**. The guard only covers `bronze` today, so `gold` can still be reached for directly.
- Two palette seams are known and documented in `lib/theme.ts` rather than solved: `STATUS.warning`
  sits 15.9° from `ACCENT.base` in hue (unavoidable while the accent is orange — it separates on
  lightness and must always render as a filled banner with an icon), and `STATUS.success` is
  deliberately the same value as the Emerald jewel. Both are resolved by moving the accent off
  orange, which is the deferred "approach B" repalette.
- `TIER_PRESENCE` (ring weight + glow per tier) is defined and tested as the new carrier of rank,
  but **no component reads it yet** — the gem badges still render without the ramp, so rank is
  currently not visually encoded anywhere now that the jewels are luminance-matched.

- `OathService.RefreshAsync` flips `OathProven` and saves before paying the milestone; if the
  award throws the reward is never paid (the `alreadyPaid` guard makes the reverse order safe).
- Message pagination's `before` cursor is `CreatedAt`-only; a same-instant tie across a page
  boundary would need a composite cursor (public API change). `SendMessage` has no happy-path
  integration test because it opens its own transaction inside `IntegrationTestBase`'s rollback.
- No test exercises the admin config write → `ScoreService` read path in one process; a
  regression of `ConfigService` to `AddScoped` would go unnoticed.
- `components/profile/__tests__/ProfileAvatar.test.tsx` still logs "update not wrapped in act"
  under the full parallel run. The Skia/reanimated `transformIgnorePatterns` half of this item was
  closed by the world pass (`jest.setup.js` registers Skia's own mock and an `expo-audio` mock
  once, and the hand-written `TorchGlow` mock is gone).
- Historic `DuplicateLoot` score rows keep their label (`event_duplicate_loot`) so old chronicle
  entries render; the event is no longer emitted.
