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

Nothing is specified and unbuilt right now. New feature work starts here; the Sealed Fire spec
moved to `shipped-log.md` once its fourth wave shipped.

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
    ↓ REST                          ↘ Supabase Auth (JWT) + Realtime (Broadcast)
ASP.NET Core API (:5150)  ←→  local PostgreSQL 16
                                    ↓ nightly pg_dump
                              Supabase Storage (backups bucket)
```

- **Primary datastore is local Postgres**, not Supabase — outbound port 5432 to Supabase's host is blocked from this dev network, so the engine runs against `127.0.0.1:5432/mingldingl`. Supabase's direct-Postgres wire protocol is what's blocked; its HTTPS/WSS-based services (Auth, Realtime) are unaffected and still used.
- Supabase serves two roles: **Auth** (phone/OTP → JWT, validated by the engine via JWKS) and a **nightly backup destination** (cron pg_dump → private Storage bucket). It is no longer the primary database or the photo storage backend.
- **Realtime is Supabase Broadcast, not `postgres_changes`** (fixed 2026-07-10): `useChat.ts`/`useRealtimeNudges.ts` subscribe via `.on('broadcast', ...)` and the engine's `SupabaseBroadcastService` pushes an event after each relevant write. `postgres_changes` only observes Supabase's own hosted Postgres and broke silently with the local-Postgres pivot.
- **Photo storage is local disk**, served by the engine at `/uploads` — not Supabase Storage.
- The app talks to `mingldingl_engine` via REST for all business actions/data, and directly to Supabase for auth and realtime delivery.

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
Warcraft/tower-defense-adjacent dark fantasy, not premium-luxury minimalism as originally spec'd — the app went through a full RPG reskin (2026-07-03) plus a palette retheme afterward. Yeseva One (display) + Alegreya (body) + Alegreya SC (small-caps utility labels) fonts — the original Cinzel choice was replaced during the Ulzii pass. Single source of truth: `mingldingl_app/lib/theme.ts`; components reach colour only through its roles (`INK`, `ACCENT`, `METAL`, `LINE`, `STATUS`, …), never `COLORS` directly.

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

Every threshold above Garnet is admin-tunable (`tier.<name>.threshold`, e.g. `tier.sapphire.threshold`). Defaults are `ScoreService.TierDefaults` and `ScoreService.CalculateTier` is authoritative (`mingldingl_engine/src/MinglDingl.Engine/Services/ScoreService.cs`); the client hydrates the live ladder via `useTierThresholds`, derives `tierForScore()` from it, and keeps `DEFAULT_TIER_THRESHOLDS` in `lib/tiers.ts` only as a pre-fetch fallback, so the two cannot drift (they once did — Amethyst at 250 client-side vs 300 server-side made the optimistic tier-up toast fire early).

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
`ScoreService.DefaultDeltas`, overridable per event through `score.event.<Type>`. `MatchReply` is
capped per match per day (`score.match_reply.daily_cap_per_match`, default 10). The original
"+25 for a positive fun tag" has no counterpart: fun tags were never built (see §6).

#### Losing Points
| Activity | Penalty |
|---|---|
| Ghost a match (no reply 48h) | -15 |
| Receive a negative report | -30 (`ReportPenalty`) — applied only when an admin resolves a report as `Penalised`, never automatically on being reported |

#### Daily Match Budget
Per `ScoreService.DailyMatchBudget` (`Services/ScoreService.cs`), all admin-tunable under `budget.*`:
- Base by membership: Free 5 / Silver 12 / Gold 20 requests per day
- +1 slot per 50 total score, plus +1 per gem-tier index (Garnet 0 … Emerald 5)
- Cap by membership: Free 12 / Silver 25 / Gold 40, plus the same gem-tier index (the cap is not a hard ceiling — `Math.Min(base + bonus + tierBonus, cap + tierBonus)`, as the admin description says)

---

### 3. Match Engine

#### Matching Logic
- Candidates weighted by score proximity and gemstone tier (soft filter — not a hard wall); Oath `Affinity` leads the sort inside a 25 km band (see the shipped log)
- Location-aware (city/region in Mongolia)
- Age preference range set by user
- `MatchEligibility` holds the one rule discovery and `POST /matches` share; blocking is symmetric and only reachable from an existing match or a report

#### Progressive Profile Reveal

| Milestone | Unlocked |
|---|---|
| Match accepted | First name, 1 photo, short bio |
| 5 messages exchanged | 2nd photo, age |
| 15 messages exchanged | 3rd photo, city district |
| 30 messages exchanged | Deep profile fields (if membership allows) |

The four thresholds are `reveal.levelN.messages` (admin-tunable, strictly increasing); the app
hydrates them via `GET /engagement/reveal-thresholds` (`lib/reveal.ts`, `useRevealThresholds`) so
the chat's reveal strip and the deep-profile hint never pin their own counts. "Messages exchanged"
is mutual: `RevealService.MutualMessageCount` allows a lead of one message (`2*min(a,b)+1`), so a
monologue cannot climb the ladder. If conversation dies (`ghosting.stale_hours`, default 48),
unlock progress freezes at the level reached.

#### Anti-Ghosting
- Ghosting applies a score penalty and docks reputation; both sides get a push (`match_ghosted`,
  and `MatchGhostedByYou` for the at-fault side). A recipient who never sent a message into the
  match is never at fault (`GhostingService.GetPenalisableGhostAsync`).
- **Not built:** the pre-ghost "soft nudge" at 48h and the "Slow Responder" tag on repeat
  ghosters. The Deep's cooling hearth light is the only pre-ghost signal.

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

Verified businesses (cafés, cinemas, hiking operators) appear in activity suggestions. Categories are `Cafe/Restaurant/Bar/Entertainment/Outdoor/Culture`.

#### Business Accounts
- Separate account type; profile includes name, category, location, photos, hours (with nullable Mongolian overlays `NameMn`/`CategoryMn`/`DistrictMn`/`DescriptionMn`)
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
| Prove your number | `(auth)/otp` | verify.mn Mobile-Originated flow: shows the engine-minted code and shortcode `144773` with a one-tap `sms:` link, polls `GET /auth/phone/status/{id}`; nothing is typed in. Rendered as the Gate (`GateScene`) |
| Onboarding wizard | `(onboarding)/index` | 4 steps: Name/Age/Gender → Bio/City → Photos (min 3) → Oath (`components/onboarding/OathStep.tsx`); POST /users + POST /users/me/oath; +100 pts |
| Discover | `(tabs)/discover` | Card stack; match/pass; daily budget counter |
| Matches list | `(tabs)/matches` | Progressive reveal info per message milestone |
| Chat | `chat/[matchId]` | Supabase Realtime; icebreaker banner; `FlameRiteCard` once the icebreaker is done; video icon once the rite is accepted; report sheet in options |
| Icebreaker | `icebreaker/[matchId]` | Prompted question → simultaneous reveal when both answered |
| Quiz | `quiz/[matchId]` | 5 questions → compatibility % |
| Activity | `(tabs)/activity` | Business partner cards; "We're doing this" CTA |
| Profile | `(tabs)/profile` | Score, gem tier badge, photo grid, membership level, honours trophy hall |
| Membership | `membership` | Tier comparison, duration `ChoiceRow`, upgrade CTA |
| Video call | `video/[matchId]` | Agora RTC; 5-min Flame Rite framing before `flameRiteCompletedAt`; decorative countdown after |
| Town Square | `(tabs)/townsquare` | Next session countdown, RSVP / cancel |
| Town Square round | `townsquare-round/[sessionId]` | Agora call + icebreaker prompt + Yes/No; mutual Yes → match; report sheet |
| Weave a Thread | `ship/new` | Fated Threads: two phone numbers → double-blind Ship |
| Campaign | `campaign/[matchId]` | The per-match dungeon map; rooms clear from real progress, claims pay `campaign.room.bonus` |
| Activities (per match) | `activities/[matchId]` | Suggestions once `activity.suggestions.messages` is reached; pledge + attendance check |
| Business | `business/[id]` | Partner detail + ratings |
| Progression / Leaderboard / Date log | `progression`, `leaderboard`, `date-log` | Score chronicle and tier ladder; city leaderboard (anonymous); confirmed encounters |
| Edit profile / Settings / Blocked | `edit-profile`, `settings`, `blocked-users` | Deep fields; language, notifications, sound, age range, pause, phone change, deletion; unblock |
| Guides / Privacy / Terms | `guides`, `privacy`, `terms` | Admin-editable content pages (`GET /content/{slug}`) |

Every route also belongs to a room of the world layer (`lib/world/rooms.ts`) — see CLAUDE.md.

---

### 8. Folder Structure

```
mingldingl_app/
├── app/
│   ├── _layout.tsx             # Root: providers, auth gate, ScreenGround + world layer
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
│   ├── ui/            # the design system — GameButton, AppCard, CardEyebrow, StateBlock,
│   │                  # DialogSurface, Tap, CountText, HeaderBar, Icon, ...
│   ├── modals/        # AlertModal, SheetModal (the shared action sheet), AppModal,
│   │                  # ChestModal, ReportUserSheet, toasts
│   ├── onboarding/    # NameAgeStep, AboutStep, PhotosStep, OathStep
│   ├── profile/       # ProfileAvatar, OathCard — the character sheet's own pieces
│   ├── progression/   # XPBar, GemTierBadge, TrophyCase, ScoreHistoryList, Lantern, ...
│   ├── world/         # WorldFloor, WorldCanopy, AtlasOverlay, feedback — see lib/world
│   ├── chat/, quest/, settings/, townsquare/, video/, cards/, vfx/
│   ├── FlameRiteCard.tsx, OathSigil.tsx
│   └── RewardToastHost.tsx   # global reward toast layer
├── hooks/             # flat, one per concern — useAuth, useDiscover, useMatches,
│                      # useChat, useIcebreaker, useQuiz, useActivity, useQuests,
│                      # useMembership, useRealtimeNudges, usePushNotifications, ...
├── lib/
│   ├── api/apiClient.ts + api/api.generated.d.ts  # typed REST client to the engine
│   ├── theme.ts       # COLORS/roles/FONTS/SPACE/RADIUS + ladders — see Visual Design above
│   ├── tiers.ts        # gem tier colors, HONOUR_IDS, fallback thresholds; the live
│                      # values are hydrated from the engine (see useTierThresholds)
│   ├── reveal.ts       # reveal ladder, same pattern (useRevealThresholds)
│   ├── world/          # rooms.ts, light.ts, feedback.ts, session.ts — the world layer
│   ├── i18n/           # index.ts (i18n-js setup, tKey, AWAITING_MN_TRANSLATION) + en/mn
│                      # tables + errors.{en,mn}.ts (err_<code> copy)
│   ├── realtime/subscribeWithRetry.ts  # Supabase Broadcast subscription with reconnect
│   ├── appFocus.ts     # foreground/background focus events
│   ├── api/queryKeys.ts + api/queryClient.ts  # react-query; queryClient owns the
│                      # MutationCache meta.invalidates/awardedSelector convention
│   ├── testing/sourceTree.ts  # the one source walker the guard tests share
│   └── supabase.ts    # auth + realtime only, no DB/storage access anymore
├── models/            # TypeScript interfaces (user, match, business)
├── scripts/           # gen-ornaments.js, gen-parchment.js, gen-sounds.js — generated assets
├── store/
│   └── authStore.ts   # Zustand: session + pending toasts only. The profile is
│                      # react-query state (useProfile); it used to be mirrored
│                      # here and the two copies drifted.
├── .oxlintrc.json, .oxlintrc.README.md
├── babel.config.js
├── app.json
├── tsconfig.json
└── package.json
```

(The original spec described a per-feature `features/{name}/{components,hooks}` structure; the app shipped with flat `hooks/`/`lib/` directories and a `components/` tree grouped by surface rather than by feature.)

---

### 9. Key Constraints

- **Solo developer** — monolithic engine, no microservices
- **Minimal cost** — local Postgres for dev (was Supabase free tier; Supabase is now backup-only), VPS for API in prod
- **Mongolian market** — phone login, mn + en i18n from day one
- **Expo web is actively used for dev/testing** (Playwright E2E, no device needed) — video calls are gated out on web by design, everything else works; mobile (iOS/Android) remains the real target for release, through the development build (Expo Go cannot run the native modules — see CLAUDE.md)
- **No real payments shipped** — membership tier upgrades are mocked, not wired to a payment gateway

---

### 10. Out of Scope (still true)

- AI-powered matching
- Real payment gateway integration
- Business partner admin dashboard
- The paid extras in §6 (Fun Tags, Reputation Repair, Score Boosters, Profile Boost) and the
  §3 "Slow Responder" tag / pre-ghost soft nudge — designed, never built, not scheduled

Shipped since the original MVP spec (no longer out of scope): push notifications (Expo push, `PushNotificationService`), a full gamification layer (daily quests, streaks, milestones, and named honours — the random loot drops that preceded them were retired 2026-09-05), user reporting with an admin queue, realtime nudges, multi-select photo onboarding, the dark-fantasy RPG visual overhaul, the Ulzii ornament language and the world layer.

---

# Outstanding Follow-ups

The live backlog: items consciously deferred that still have a real consequence. Closed items
are not struck through here — their record moves to [`shipped-log.md`](shipped-log.md).

- **Sealed Fire Wave 3 leftovers (2026-09-13):** `AscentSky` draws "the sky beyond" above the
  top star for every tier; the campaign's "Boss" chip may be redundant beside the dragon's line.
  (The Frozen Gate's ticker, the stale `share_failed`, the Town Square shared-DB test and the
  i18n coverage scan's comment stripping were fixed since.)

## What is actually open, in one place

- **Sealed Seek is a client-side blur.** `GET /discover` still ships every candidate photo URL and
  the card blurs `[0]` on the device; anyone with the network tab has the unblurred face and the
  other two photos. "Faces are earned" is true of the UI, not the wire. An engine-side crop or blur
  (and sending one photo, not the list) is the only version of the feature that is actually true.
  (Wave 2 review, 2026-09-12.)
- **Two Mongolian gates.** The clocks refuse to speak the world in `mn` (`worldTimeSpoken()`) while
  the ledger's `thread_day`, `ordinal_*` and `seal_*` lines fall back to English the ordinary way, so
  an `mn` user sees "THE THIRD DAY" over Mongolian chrome beside a countdown that stays Mongolian on
  purpose. The translator's Wave 2 batch (48 keys) settles both; until then it is a known asymmetry.
- **Italic means two things in the chat.** `FONTS.bodyItalic` + `ACCENT.base` is both my own
  letters and the app's voice (seal rows, the sheet's law, the Seek hint). Still undecided;
  Waves 3 and 4 shipped around it.

This is the whole of it, as of 2026-09-30; the sections below add the detail:

- **The Sealed Fire redesign** shipped in four waves (Waves 1–2 on 2026-09-12, Waves 3–4 on
  2026-09-13); its spec and records are in `shipped-log.md`. Still open: the four product
  decisions below, which stand on their defaults; the hearth, plaza and Hold scenes as final
  art or Skia scenes; Mongolian for every new string; and the rest of the Wave 4 device pass
  (under "Manual verification still owed"). The four decisions and their defaults:
  **level-zero reveal** — blur the level-0 photo under the seal; **embers in the open** — show the
  ghosting judgement in the Quest Log before it lands; **the hearth replaces navigation** — behind
  `HEARTH_ENABLED` (on) with a hearth glyph in every header, the tab bar stays; **blackletter and
  Cyrillic** — Latin titles in blackletter, Mongolian titles stay in Yeseva.
- **Mongolian copy for 263 keys, plus four venue columns.** `AWAITING_MN_TRANSLATION` in
  `lib/i18n/index.ts` holds the Sealed Fire Wave 2 batch (48: the seals, the ledger's day headings
  and ordinals, the clocks' world phrases, the sealed Seek's eyebrow and hint), Wave 3's 52 (the
  fires, the Guild House, the Hall, the Ascent, the cave, the keepsake, the rite), Wave 4's 95 (the
  hearth, the sky, the plaza, the bell, the Satchel, `ordinal_13`…`ordinal_31`, `chronicle_dawn`,
  `go_home`, `candles_left`), 11 world/atlas keys, the report sheet's 17 (`report_*`), the 9
  narrated long-wait lines, the 2 empty-thread lines, and smaller batches since (263 counted in
  the array on 2026-09-30; the per-batch figures above are as recorded at the time). **Twelve keys already translated had their
  English rewritten in Wave 4 and carry stale Mongolian** — `mystery_match_name`,
  `round_over_matches`, `round_over_no_matches`, `round_over_title`, `town_square_cancel_rsvp`,
  `town_square_empty_sub`, `town_square_in_progress`, `town_square_its_a_match`, `town_square_no`,
  `town_square_rejoin`, `town_square_rsvp`, `town_square_waiting_for_round` — and, since the
  2026-09-29 design pass, `deep_profile_hint` (the floors are the Hall and the High Table now, not
  Silver and Gold) — they are not on the list (the parity test would fail) so the translator needs
  this sentence. That pass also retired `rank_free/silver/gold`: the Character sheet's guild rank
  now reads the `floor_*` names, so it shows English to an `mn` user until those are translated. `BusinessPartners` has
  `NameMn`/`CategoryMn`/`DistrictMn`/`DescriptionMn`, all NULL. All of it needs a native speaker;
  none of it may be guessed, and the report sheet least of all. `enableFallback` renders the keys in
  English for an `mn` user; the parity test fails if one is translated and left on the list. This
  is the single largest thing between the app and a Mongolian market.
- **A signed-in session was gone after its access token expired** (A51, 2026-09-29). Supabase
  answered the refresh token with `refresh_token_not_found` (deleted server-side, not "already
  used"). The app's own 401 path signs out with `scope: 'local'`, which never touches the server,
  so the cause is outside it: a global sign-out, a password change on that test user (the device
  sign-in script rewrites it), or a project session timeout. Check Auth → Sessions in the Supabase
  dashboard before assuming an app bug.
- **Device verification passes**, listed under "Manual verification still owed" — they need the
  Galaxy A51 and the development build rather than Expo Go (see `mingldingl_app/AGENTS.md`).
- **Three items blocked on something outside the code.** `POST /video/complete` is a client
  assertion until Agora webhooks corroborate it; `LoginThrottleService` is per-instance until the
  engine has shared state to scale out with; `AuthAliases (Sub → UserId)` is a schema change that
  would only optimise a path that already works.
- **Deliberate non-features**, listed under "Known gaps": §6 paid extras, a third gender, Town
  Square's gender pairing and overflow handling, milestone-based reveal, `WORLD_ENABLED` as admin
  config, the Ulzii shimmer deferrals, leaderboard names, and discovery's materialise-everything
  query. None is scheduled; each is a decision, not an oversight.

## Open findings from device sweeps

- **`Users.City` holds a GPS district for real sign-ups and "Ulaanbaatar" for the seeded cast.**
  The leaderboard collapses these via `MongoliaGeo.CohortCityNames`; anything else grouping by the
  raw string will fragment the same way.
- **Seeded venues have no photos** (`PhotoUrls` is `'[]'::jsonb` for every `BusinessPartner`);
  `mingldingl_engine/scripts/gen-seed-photos.py` never has venue URLs to fill. Cast portraits come
  from `gen-cast-photos.py` under `seed/c2/` and must exist on the machine serving the engine.
- **No dev account holds the test SIM `88583269`** since the 2026-09-15 reseed: the cast is
  `a0000000-…-00NN` on `8800xxxx` numbers, and Undram and the earlier SIM-verified account are gone.
  Device sessions sign into a seeded character (usually Мөнхболд, `…0009`) through the scratchpad
  login script and the Hermes inspector, not verify.mn; a real SMS sign-in would create a new,
  empty account.
- **`app/icebreaker/[matchId].tsx` narrates a partner-wait with a static `Waiting` line** where
  `app/quiz/[matchId].tsx` uses `LongWait`; a fifth `WaitKind` was deferred rather than add two more
  untranslated strings.

## Manual verification still owed

All need the `verify` skill (real Supabase JWTs, full stack running) or the Galaxy A51.

- **Fated Threads — the full pass, never run.** Weaver A weaves B + C → B's `GET /ships/pending`
  names A and nothing about C → B accepts, nothing sparks → C accepts: match exists, "Woven by A" in
  chat, neither `DailyMatchesUsed` moved → A's honour toast fires once and does not replay → the
  weave past `ships.daily.cap` is rejected → a brand-new number resolves via the onboarding code
  field; plus the blocked-Weaver silent no-op, same-number rejection, push + list refresh on spark.
- **Town Square — no two-browser end-to-end run** (real Agora tokens, a full round-robin); the
  API-level round-robin and mutual-Yes were driven 2026-09-10.
- **Flame Rite — the app screens** (jest only) and the 5-minute vs long token TTL (the Agora token
  is opaque). **No-Show — the threshold-crossing `RepeatedNoShowPenalty` leg** (needs three
  distinct-match mismatches). **Referral guards** (self-referral, one per invitee, deleted inviter)
  are only reachable from `POST /users`; a live pass costs an SMS. **Membership — the duration
  `ChoiceRow`'s layout** (MN label length) and one real upgrade call.
- **The world below the Gate, on hardware.** The rooms have rendered on the A51 in the 2026-09-15
  and 2026-09-29 passes, but the six light signatures, per-room state ramps, the atlas over a real
  profile and the descend/rise transitions have not been judged against their spec there. **The eight sounds have never been heard and no haptic
  has fired on hardware**; the WAVs are synthesised, so their voicing is a guess, and the
  silent-switch behaviour is untested.
- **Sealed Fire Wave 4 — the rest of the device pass.** Seen on the A51 (2026-09-15, 09-29): all
  five tabs, the hearth in the phase of the day, a sealed candidate card, the Quest Log's sealed and
  revealed portraits, the plaza's quiet state, the Satchel, and the way-home glyph (the navigation
  fixes were found through it). Still unseen: the hearth in the other day phases and on White Moon
  (two stacked eyebrows), the sky's stars under TalkBack, the candle row, the plaza open and
  locked, the bell header and strip, the Satchel empty, `candle.wav` and `bell.wav`.
- **Never seen on hardware:** the collapsed
  getting-started board, the brighter photo dot, the empty-thread state, the design-system wave
  (shared state/dialog surfaces, the five ladders), the waiting vocabulary (narrated waits reaching
  their 8 s/25 s lines, skeletons against the world floor, the knot in a compact button, the
  tab-switch ignite, the row stagger not re-firing on pull-to-refresh), the design-token snap and
  Ulzii ornaments under longer Mongolian labels, and from the creative-effects wave the Gate scene
  (needs a sign-out and a SIM), festival tint and time-of-day light offsets.

## Security & identity

- **The returning-user alias is keyed on the phone the identity proved.** A phone change now binds
  the new proof to the changing session and deletes the old number's claimed verifications, so every
  *other* session on the old number is signed out (2026-09-15). An `AuthAliases (Sub → UserId)`
  table would keep them and save a query per request; needs a schema change.
- **Realtime channels are public.** Topics are per user (`user:{id}`) since 2026-09-15, but anyone
  holding the anon key and a user id can subscribe. Supabase private channels with RLS close it.
- **Old sealed URLs still name their originals.** Sealed photos are keyed-hash named since
  2026-09-15, but a `-sealed.jpg` URL handed out before then still reveals its original's filename;
  closing that means renaming originals and rewriting stored URLs.
- **Push tokens can be re-registered by another account.** Legitimate (same device, new account)
  and hostile reassignment look identical to the server; needs a device-side proof. The attacker
  needs the victim's Expo token, which no endpoint returns.
- **Photo upload is per identity, not per IP.** Uploads now need an account or a claimed
  verification, which bounds anonymous abuse, but there is still no IP throttle.
- **No general API rate limiting.** `POST /auth/phone/start` is bounded per IP (30 per 15 minutes)
  and per number, `POST /photos/upload` per user; every other endpoint is unlimited.
- **`LoginThrottleService` is per-instance** — a second engine instance halves the effective
  lockout. Needs shared state if the engine is ever scaled out.
- **`POST /video/complete` is a client assertion** — any participant can claim the score, honour
  and milestone without a call connecting. Corroborating it needs Agora webhooks; the never-built
  30-minute post-rite call cap is parked with the same dependency.

## Product decisions pending

- **Chat is not gated on the icebreaker.** The spec says completing it "unlocks chat"; nothing
  ever enforced it, and gating now would strand every active match that skipped it. If wanted:
  `MessagesController.SendMessage` behind a config key, banner becomes a wall.
- **The video-screen countdown is decorative** — resets on remount, not anchored to token issue
  or `FlameRiteAcceptedAt`, and 0:00 does nothing.
- **`MatchReply` (+10) is capped but still farmable at a slower rate.** With
  `score.match_reply.daily_cap_per_match` (10) one conversation is worth at most +100/day; two
  colluding accounts can spread the farm across their daily budget (~500/day, Emerald in ~4 days).
  Tightening further (minimum length, decay) is a tuning call.
- **A match where nobody ever messages can never be ghosted** — the sweep and
  `GhostingService.IsStale` require `LastMessageAt != null`. Falling back to `CreatedAt` leaves no
  single party to penalise (`LastMessageSenderId` is also null).
- **"The seal is broken"** is what `bossCleared` reports (the boss fell; other rooms unlock on
  their own terms). Change the copy if beating the boss should end the campaign outright.
- **Second and later recruits produce no toast** since Ally-Caller is earned once.
- **Kill switches show copy rather than hiding entry points** (`ships.enabled`,
  `townsquare.enabled`). Hiding the tab / weave CTA on a 404 is a follow-up if used in anger.
- **The leaderboard is anonymous by design** (`LeaderboardEntryDto` carries rank/tier/score only),
  so every row reads `#N ◆ 3,724 pts`. Worth confirming that is still the intent.
- **Every "today" is the UTC day** (2026-09-15 audit) — daily login, quests, match budget, ship cap,
  reply cap and `ix_score_events_once_per_day` all roll over at 08:00 in Ulaanbaatar, so 07:00 and
  09:00 local count as two days. Moving to Asia/Ulaanbaatar is a product call plus an index change.
- **Summoning reveals the target's first photo before they answer** — `POST /matches` creates the
  match at reveal level 1. Confirm against "faces are earned".
- **The blocked list still shows the blocked person's display name** (photo is now reveal-gated);
  the discover feed already shows names, so it was kept.
- **`reputation.penalty_dock` minimum is 0.01**, so the dock can no longer be switched off with 0.
- **Mission cards lost their point badges** — the numbers were hardcoded while the deltas are admin
  config the app cannot read. An engine read path would bring them back truthfully.

## Known gaps, deliberately not built

- **Fated Threads' Pass-side blocking** (`BlockWeaver`) — only the `BlockedUsers` check on
  `POST /ships` exists. A same-ship invite-code collision inside one `CreateAsync` would silently
  misroute slot B (vanishingly unlikely, unguarded).
- **Town Square** pairs strictly `Male × Female` (other genders RSVP but are never rostered),
  drops overflow RSVPs silently at lock time, and attaches no score, quest or honour to attending.
- **More than two genders.** Validation is tightened to the pair the app offers. Supporting a
  third is a feature with matching semantics to design — `MatchEligibility.OppositeGenderOf` and
  Town Square's pairing would both need rethinking.
- **Reveal after the rite** — the second photo still unblurs at 5 messages; milestone-based
  reveal and un-paywalling `HasKids` were deferred.
- **The world lights only what some screen has already fetched.** `useWorldState` never fetches,
  so a room whose data nobody has asked for sits at its base light (the Tavern is unlit until the
  Town Square tab has been opened once this session). Correct by the "no data is not darkness"
  rule; first-run light is systematically dimmer than steady-state.
- **`WORLD_ENABLED` is a build-time constant, not admin config.** The app has no generic
  config-read path — tier and reveal thresholds each got their own endpoint — and a cosmetic layer
  did not justify inventing one.
- **Ulzii deferrals** — Skia shimmer on the Oath sigil / boss seal, unlit empty-state knots,
  festival-tinted ornament variants. **Creative-effects wave 2** — the personal sigil, the knot of
  two, the encounter scroll — not started.
- **Candidate discovery materialises every eligible user** to sort on compatibility and distance,
  which SQL cannot express. Fine at ~40 users; a real wall before launch.
- **Admin panel** — `admin.*` error codes are English-only on purpose; `lib/apiError.ts` reads
  `error`, not `code`; `ConfigField` ignores `Min`/`Max` (the server error shows in the toast).
- **`en`/`mn` diverge in voice** where the 2026-07-28 rewrite deliberately left `mn` alone, and no
  Mongolian copy has been proofread by a native speaker.
- **§6 paid extras** (Fun Tags, Reputation Repair, Score Boosters, Profile Boost) and the
  "Slow Responder" tag / pre-ghost nudge — designed, never built, not scheduled.
- **Two leftovers from the 2026-09-06 E2E pass** (low): `MongoliaGeo.IsValidCoordinate` only
  checks earth bounds, not a Mongolia bbox, so `(0,0)` snaps to Ölgii; and the dev reseed sets
  `BusinessPartners.AverageRating`/`RatingCount` without matching `BusinessRatings` rows, so the
  first real rating collapses e.g. 4.8 (67) to 5.0 (1). Seed data, not code, for the second.

## Code health

- **Two palette seams** are documented in `lib/theme.ts` rather than solved: `STATUS.warning` sits
  15.9° from `ACCENT.base` in hue (it separates on lightness and must always render as a filled
  banner with an icon), and `STATUS.success` is deliberately the same value as the Emerald jewel.
  Both are resolved by moving the accent off orange — the deferred "approach B" repalette.
- Message pagination's `before` cursor is `CreatedAt`-only; a same-instant tie across a page
  boundary would need a composite cursor (public API change). `SendMessage` has no happy-path
  integration test because it opens its own transaction inside `IntegrationTestBase`'s rollback.
- Historic `DuplicateLoot` score rows keep their label (`event_duplicate_loot`) so old chronicle
  entries render; the event is no longer emitted. `ScoreHistoryList.ENGINE_EVENT_TYPES` still
  omits `ReportPenalty` (its icon and label keys exist) although `ReportService` can award it now.
- `ConfigService` caches on boot: a key changed by direct SQL takes effect only after a restart, so
  live tuning must go through the admin API.
