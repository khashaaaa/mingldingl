# MingldIngl — Plan

The live plan. New feature work is written into **Open**; when it ships, its record moves to
[`shipped-log.md`](shipped-log.md) (check there before assuming a feature doesn't exist) and
anything left over goes to **Outstanding Follow-ups**. Code structure, stack and infrastructure
are in `CLAUDE.md` and the code itself, not here.

---

# Open — Not Yet Built

Nothing is specified and unbuilt right now.

---

# Domain Model & Product Background

A gamified dating app for the Mongolian market, built against ghosting, swipe fatigue and shallow
engagement, open to all ages and situations. It replaces the swipe loop with a score economy,
gemstone tiers and progressive profile reveal that rewards real conversation. Every number below
is a default; the live values are admin config (`ConfigKeys.All`) and the named service is
authoritative.

### Identity

- **Profile** — basic (name, age, gender, city, photos, bio; free) and deep (kids, habits,
  lifestyle, religion; membership-gated). Max 6 photos for everyone. A complete profile at
  sign-up pays +100.
- **Gemstone tier** from total score, never purchasable: Garnet 0 → Opal 100 → Amethyst 300 →
  Sapphire 600 → Ruby 1000 → Emerald 2000 (`tier.<name>.threshold`, strictly increasing,
  `ScoreService.CalculateTier`; the app hydrates the ladder via `useTierThresholds`).
- **Reputation** — docked by ghosting, no-shows and admin-resolved reports.
- **Membership** — Free / Silver / Gold, shown as the Guild House floors Yard / Hall / High Table.
  Platinum retired 2026-08-18. Billing is mocked (see the payment memory).
- **The Oath** — Bond / Fate / Kinship; Sworn, then Proven by real encounters.

### Score economy (`ScoreService.DefaultDeltas`, `score.event.<Type>`)

Earn: daily login +5 × streak (cap 7) and +50 on the seventh day; first message +10; icebreaker
+20; quiz +15; reply +10 (capped 10 per match per day); date confirmed +50; video call +30; Fated
Thread sparked +40; Oath proven +40; campaign room +5 / boss +25; quests per `quest.<id>.xp`,
chest +30. Lose: ghosting −15; a report an admin resolves as `Penalised` −30 (never automatic).

**Daily match budget** (`ScoreService.DailyMatchBudget`, `budget.*`): base Free 5 / Silver 12 /
Gold 20, +1 per 50 score and +1 per tier index, capped at Free 12 / Silver 25 / Gold 40 plus the
tier index (`Math.Min(base + bonus + tierBonus, cap + tierBonus)`).

### Matching and reveal

- Candidates: Oath affinity leads inside a 25 km band, then both-Proven, then score/tier
  proximity, location and the user's age range. `MatchEligibility` is the one rule discovery and
  `POST /matches` share; blocks are checked on every match-creation path (`MatchPairing`).
- **Progressive reveal** (`reveal.levelN.messages`, served by `GET /engagement/reveal-thresholds`):
  match → first name, one sealed photo, bio; 5 mutual messages → 2nd photo, age; 15 → 3rd photo,
  district; 30 → deep fields if membership allows. "Mutual" is `2·min(a,b)+1`, so a monologue
  cannot climb. A candidate only ever receives the sealed (blurred) first photo.
- **Ghosting** after `ghosting.stale_hours` (48) of silence on your turn: score penalty and a
  reputation dock, pushes to both sides; reveal freezes. Someone who never sent a message is never
  at fault. Accountability is the product's thesis, not a burnout risk to soften.

### Engagement

- **Icebreaker** — both answer independently, revealed together; unlocks video. Chat is not gated
  on it (see Product decisions).
- **Quiz** — five questions, compatibility %.
- **Activity suggestions** after `activity.suggestions.messages` (15); both pledging confirms a
  date (+50). The pledge needs a completed **Flame Rite** (a consented 5-minute video call) while
  `dating.flamerite.required` is on; `video.enabled=false` lifts it.
- **No-show check** 48 h after a date; repeated mismatches dock reputation.
- **Fated Threads** (a Weaver pairs two numbers, double-blind), **Recruit an Ally** (referrals),
  **Town Square** (scheduled speed-dating rounds over video), **the Campaign** (a per-match map
  derived from progress), daily quests, streaks and nine honours.
- Video is Agora; call history is not stored.

### Business partners

Verified venues (`Cafe/Restaurant/Bar/Entertainment/Outdoor/Culture`) appear in activity
suggestions; after a confirmed date both users rate the venue 1–5. Mongolian overlays
`NameMn`/`CategoryMn`/`DistrictMn`/`DescriptionMn` exist, all NULL. Paid featured placement and
promoted packages are design intent only.

### Monetization

Only membership exists (1/3/6-month cycles at 0/10/20 % off, admin-tunable prices). Designed and
never built: Fun Tags, Reputation Repair, Score Boosters, Profile Boost. Free users get the full
game; membership changes reach and depth, not the rules.

### Constraints and out of scope

Solo developer, monolithic engine, minimal cost; mn + en from day one; Expo web is for dev and
Playwright only (no video there). Out of scope: AI matching, a partner self-service dashboard,
the paid extras above, the "Slow Responder" tag and pre-ghost nudge.

---

# Outstanding Follow-ups

The live backlog: deferred items that still have a real consequence. When one closes, delete it
here and record it in [`shipped-log.md`](shipped-log.md).

## Waiting on the user

- **Mongolian copy — the single largest thing between the app and a Mongolian market.** 263
  keys on `AWAITING_MN_TRANSLATION` (`lib/i18n/index.ts`), rendered in English for `mn` via
  `enableFallback`. Plus thirteen already-translated keys whose English was rewritten and whose
  Mongolian is now stale (not on the list, or the parity test would fail): `mystery_match_name`,
  `round_over_matches`, `round_over_no_matches`, `round_over_title`, `town_square_cancel_rsvp`,
  `town_square_empty_sub`, `town_square_in_progress`, `town_square_its_a_match`, `town_square_no`,
  `town_square_rejoin`, `town_square_rsvp`, `town_square_waiting_for_round`, `deep_profile_hint`.
  And the four NULL `BusinessPartners.*Mn` columns. A native speaker only — never guessed, the
  report sheet least of all. Until then `mn` keeps the exact clock (`worldTimeSpoken()`) while
  the ledger's day headings fall back to English, a known asymmetry.
- **Four Sealed Fire decisions, running on their defaults:** level-zero reveal (the level-0
  photo blurred under the seal); embers in the open (the Quest Log shows the ghosting judgement
  before it lands); the hearth replacing navigation (`HEARTH_ENABLED` on, tab bar stays, a hearth
  glyph in every header); blackletter only for Latin titles (Mongolian stays in Yeseva until a
  Cyrillic cut is commissioned).
- **Art:** the hearth, plaza and Hold scenes, the cave frame, dragon and bats as final assets.
- **Payment provider** (QPay vs HiPay); membership upgrades are mocked.

## Small open items

- `AscentSky` draws "the sky beyond" above the top star for every tier; the campaign's "Boss"
  chip may be redundant beside the dragon's line.
- **Italic means two things in the chat:** `FONTS.bodyItalic` + `ACCENT.base` is both my own
  letters and the app's voice. Undecided.
- `app/icebreaker/[matchId].tsx` narrates a partner-wait with a static `Waiting` where the quiz
  uses `LongWait` (a fifth `WaitKind` was deferred to avoid more untranslated strings).
- Deferred Wave 4 cleanups: move `QuestTile`'s fire-colour map and name rule into `lib/fire.ts`
  (the duplication already caused one bug); export `localDayIndex`; rename the Satchel `%{count}`
  placeholders; run the palette/forged/hero/furnace scanners through `blankComments`.
- **A session lost its refresh token** (A51, 2026-09-29, `refresh_token_not_found`). The app's
  401 path signs out locally only, so the cause is outside it (a global sign-out, the device
  sign-in script rewriting the test user's password, or a session timeout). Check Supabase
  Auth → Sessions before assuming an app bug.

## Dev data

- `Users.City` holds a GPS district for real sign-ups and "Ulaanbaatar" for the seeded cast; the
  leaderboard collapses them via `MongoliaGeo.CohortCityNames`, anything else grouping by the raw
  string will fragment.
- Seeded venues have no photos. Cast portraits (`gen-cast-photos.py`, `seed/c2/`) must exist on
  the machine serving the engine.
- No dev account holds the test SIM `88583269` since the 2026-09-15 reseed; the cast is
  `a0000000-…-00NN` on `8800xxxx`. Device sessions sign into a seeded character (usually
  Мөнхболд, `…0009`) via the login script and the Hermes inspector, not verify.mn.

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
- **From the 2026-10-01 A51 UI pass (copy and emphasis, left for a call):** the Codex body
  (`ContentPages` "guides") still describes Silver/Gold membership, while the app sells The Hall /
  The High Table; "sigil" means three things (phone number in Settings, the oath in the Satchel, the
  gem on the Hall of Names); Settings' one forged button is "Abandon this character", which makes
  account deletion the loudest thing on the screen; the Guild House "Climb" button doesn't name the
  tier or price it buys; "3/3 minimum" reads oddly at or above three photos; the Encounter Log's
  empty state is a bare headline with no way forward; the Hold map marks no "you are here".

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
