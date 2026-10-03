# MingldIngl — Shipped Log

What has shipped, newest first, pruned to what is not obvious from the code: the mechanics worth
not re-deriving, deviations from the design, and decisions. Open items live in
[`project-plan.md`](project-plan.md) under Outstanding Follow-ups, never here. Check this file
before assuming a feature doesn't exist yet. Pruned hard on 2026-09-30; git history has the
long versions.

---

## 2026-10-03 — The road, smoothness, navigation, round trips and floods

**The road** — six mechanics that turn the accountability rules into play; every number is admin
config under **Game**, each with an off switch. Honours went from nine to fourteen.

- **Party seats** (`PartyService`): at most `party.seats.base` (4) + `per_tier` (1) × tier active
  matches. A summons past it is refused (`party.full`); a full target is refused
  (`party.target_full`) and dropped from discovery after the pool is drawn. Fated Threads and Town
  Square still land past the limit — events the user chose. A fast-path check, like the budget's
  (two summons at once can land one seat over).
- **Scars** (`KeptEncounterService`): every ghost penalty opens one in the same UPDATE that docks
  reputation (`Users.OpenScars`); `scars.heal.encounters` (2) *kept* encounters close the oldest,
  hand the dock back and grant **Mended** on the first. Old ghostings were not back-filled.
- **Waypoints**: kept encounters chart their venue's district; `waypoints.cartographer.districts`
  (3) earns **Cartographer**.
- **Seasons** (`SeasonService`): Naadam 11–13 July and Tsagaan Sar from a 2027–29 table — the same
  windows as the app's `lib/festivals.ts`; add a year to both. An encounter *sworn* in season and
  kept later earns **Of the Naadam** / **Of the White Moon**.
- **Weekly trial** (`BondTrialService`): `exchange` (each side sends `trial.exchange.messages`, 5)
  or `rite`, fixed by a hash of match + week. Either side claims; both get `BondTrialDone` (+25)
  once — the `BondTrialClaims` (match, week) key is the lock.
- **Retiring together** (`RetireService`): only after a completed encounter; on acceptance the match
  ends `Completed`, both accounts pause out of discovery with `RetiredAt`, both earn **Hearthbound**.
- `GET /engagement/standing` feeds the Standing card; `GET /engagement/season` exists but the app
  reads its own festival table.

**Smoothness** (A51, production bundle, `dumpsys gfxinfo` + Perfetto). Jank was Android's UI and
render threads — first-time native view builds, CPU-drawn SVG, full-window ember/fog redraws — not
JS. Frames late / worst frame: first tab visit 34% / 400ms → 10% / 150ms; first chat 72% / 500ms →
28% / 150ms; Hearth 80% / 450ms → 7% / 53ms.

- `router.prefetch` builds the other tabs after launch; `components/ui/Deferred` mounts
  below-the-fold sections a few frames late; the canopy holds embers/fog still for 700ms after a
  route change, and fog banks are pre-blurred images.
- Glyphs are baked PNGs (`scripts/gen-glyphs.js`); the Hearth sky is native views; the Ascent halo
  and `GlowText` breathe on the native driver; reduce-motion is read once for the app.
- Tried and dropped: `detachInactiveScreens={false}`, `removeClippedSubviews` on the Character Sheet.
  Embers and fog still repaint the whole window while visible — the price of the effect.

**Navigation, design, translation**

- In-app links go through `hooks/useGoTo` → `goTo`: an open screen is returned to (`dismissTo`),
  the top one left alone, anything else pushed. A source test forbids bare `router.push` (phone →
  OTP excepted). `HeaderBar` steps a title down when Android wraps it into a taller box than its line.
- `ContentPageScreen` sets display-face headings and opens long pages (4+ sections) on a chapter
  list; a disabled forged button is cold ghost metal at full opacity.
- `lineLocale(...keys)` keeps a composed line in one language; `ordinalWord` keeps English suffixes
  while a locale has no `ordinal_N`. MN terms unified — keys listed for proofreading in the plan.

**Round trips, floods, costly work**

- Auth middleware reads account + standing in one query (two for an aliased returning user, was
  four); `PhoneVerificationService.AliasedAccounts` is the shared alias query.
- A message send makes one Supabase broadcast POST (`BroadcastManyAsync`); message pushes coalesce
  to one per conversation per minute (`PushCoalescer`).
- `UserWriteRateLimit` (per account, burst 30, 30/min) on message send, match request, reports,
  ship create and rite propose → `429 rate.too_many_writes`; `UseRateLimiter` runs after
  `CurrentUserMiddleware`. The push queue is bounded (10k, drops with a throttled warning) and
  goes to Expo in batches of up to 100.
- Indexes on `PushTokens.UserId` and `ActivitySuggestions.MatchId`; discover pages after the first
  reuse page one's ranking for 5 min (`CandidatePoolCache`, slices re-read through live
  eligibility); Town Square `current-round` is three queries; the photo sweep is daily and skips
  originals that failed to seal; CSV exports project their columns; dev logs omit per-SQL lines.
- App: a device's own `match_created` echo refetches nothing; per-match mutations invalidate
  `campaign(matchId)`; Town Square session polling runs only on a focused screen; chat drops a
  thread's cache 30 min after leaving it.

## 2026-09-29 → 30 — A51 passes, navigation, nav bar, in-app notices

- **Navigation** (`lib/navigation.ts`, guarded by `lib/__tests__/navigation.test.ts`):
  `router.push('/(tabs)/…')` from above the tabs pushes a whole second tab navigator, so every tab
  link goes through `goTo` (`dismissTo` a tab route). `goHome` returns to an open hearth instead of
  pushing another; `stackHas` searches nested state because expo-router wraps everything in
  `__root`. A bare `router.back()` is dead on a cold deep link; use `goBack` (falls back to the
  tabs). `useBackToChat` goes back only when the chat or campaign is underneath. The shared
  `expo-router` test mock is `lib/testing/expoRouterMock.ts`.
- **Dark Android navigation bar.** The `expo-navigation-bar` plugin colour does nothing under
  edge-to-edge: each window's bar scrim follows light/dark mode. `app/_layout.tsx` forces dark with
  `Appearance.setColorScheme` (covers later windows, including modals) and
  `NavigationBar.setButtonStyleAsync` for the main window. Needs a native build (`589e5f1b`).
- **No system dialogs.** Query/mutation failure notices go through `store/noticeStore` and the
  root `AlertModal`, not `Alert.alert`. The fatal-crash alert stays native on purpose (the React
  tree may be what broke). The activity page's suggestions query is `meta.silentError`, and the
  engine's `activity.locked` shows the page's keep-talking state.
- **Design fixes from the A51:** membership floors are named the Yard / the Hall / the High Table
  everywhere (`rank_*` keys removed); "What's next" counts the whole quest board; XPBar is one gem
  hue lit toward its end; `ascent_dawns` is the first `{ one, other }` plural key; settings links
  are rows of their section; ledger minus signs; a quiet chat's strip is frost, not warning;
  `fontStyle="italic"` on SVG text already in an italic face makes Android drop the font.
- **Tooling:** `expo-doctor` 18/18 (`@types/jest` pinned via `expo.install.exclude`); control pages
  are lazy chunks; `jest.setup.js` unrefs TanStack Query's gc timers so Jest exits; control pages
  load/fail through `components/QueryState`.
- Supabase had paused the project (took down sign-in); restoring it from the dashboard fixed it.

## 2026-09-15 — Design sweep + bug hunt

Six audits, ~150 findings, ~130 fixed by seven worktree agents.
- **Realtime is per user** (`user:{Users.Id}`, `BroadcastToUsersAsync`); the shared `app-nudges`
  topic delivered everyone's events to everyone. One ref-counted channel per topic
  (`subscribeToBroadcast`) — see CLAUDE.md.
- **Counters never write stale values back:** `Data/TrackedColumns.cs` mirrors atomic `RETURNING`
  results onto tracked entities without marking them modified. Double-pays closed by conditional
  claims (icebreaker, quest upsert, `OathProven` via `ix_score_events_once_ever`, date completion
  unique index, attendance penalty, one open report per pair, ship spark + match in one
  transaction, match budget via conditional `UPDATE`). `AmbientTransaction` replays a failed commit.
- The quiz farm was closed by 404ing unknown quiz ids; QuizDone still pays once per (quiz, match) —
  an agent's once-per-user rule was reverted as a product change.
- **Sweeps:** deletion re-checks `FOR UPDATE`; ghost + penalty is one transaction per match; Town
  Square status writes are conditional so an admin cancel sticks.
- **Identity/files:** phone change releases the old number's claims; sealed photos are keyed-hash
  named (`Storage:SealedPhotoKey`, else derived from `Admin:JwtSigningKey`); a sixth pending
  verification supersedes the oldest; `UseForwardedHeaders` trusts only configured proxies.
- **App:** 401 refreshes once and replays; Android keyboard padding on five screens; one forge per
  screen across imported components; reduce-motion on every loop; mission point badges removed
  (deltas are admin config the app cannot read).

## 2026-09-11 → 13 — Sealed Fire, the redesign (four waves)

The user asked for the app to be "weird, stand out from other apps". The direction keeps every
token, font, knot and mechanic and spends them differently: the app is a place (a hearth, a fire
where sealed travellers wait, letters instead of chat, a square with lanterns, a forge, a mirror);
faces are earned; fires that go quiet visibly burn down; time reads in candles, bells and dawns.
Report: <https://claude.ai/code/artifact/c2542b0e-1c65-48ec-be04-e85b7caa61d3>; canvas (54
boards): <https://claude.ai/code/artifact/0697f213-d884-4ed5-b8b8-e62616403fb1>; sources in
`docs/design/sealed-fire/`.

**Rules that still govern new UI:** one knotted hero panel per screen (`hero.test.ts`); one
forged button per screen, secondaries are ink links (`forged.test.ts`); chips are states, never
deeds; the wax seal means "binds"; three type voices — blackletter room name once per screen,
Latin only; Yeseva for names/numbers/eyebrows; Alegreya for reading, italic = the app speaking;
waiting = candle, empty = a drawn place, wrong = ember; ceremonies full-screen, questions as
bottom parchment strips. Temperature: fire is what is alive, frost is silence (`TEMPERATURE`
tokens; furnace only on the Fire, Oath, Ascension, bell, Hall of Names). Law in the voice: two
words per button, short sentences with full stops, the app states the law and never scolds. Every
object has one material (`MATERIAL`: wax consumed, wood/iron used, bronze stamped, gold rewards,
parchment written). The cave belongs to the Campaign only. **Dropped on purpose:** inventory as a
system (loot, shop, stacking, stats), monsters and bats outside the Campaign, iron as a dial,
traditional Mongolian script. Every mechanic (deltas, thresholds, ladder, ghosting, prices) is
unchanged. EN strings only; new MN keys go on `AWAITING_MN_TRANSLATION`.

- **Wave 1, the kit (09-12):** woodcut SVG `Glyph` set (`react-native-svg`, native — needed a new
  dev build); `AppCard hero`; `GameButton ink`; `DialogStrip` bottom sheets; blackletter
  `HeaderBar` titles for Latin; room light recipes pushed apart (distinctness test).
- **Wave 2, the thesis (09-12):** sealed Seek card (level-0 photo under blur, `SealDots`, Summon /
  Dismiss); chat as letters (`LetterRow`, `DayHeading`, `SealBreakRow`, `WaxSealButton`,
  `SealsSheet`); `lib/letters.ts` places seal rows from the engine's `min(total, 2·min(mine,
  theirs) + 1)`, only once the whole thread is loaded; `lib/worldTime.ts` + `WorldClock` (tap for
  the exact clock; `mn` keeps the exact clock until translated); `PushCopy` EN rewritten with a
  law test. Timezone lesson: run the suite under `TZ=UTC`.
- **Wave 3, the place (09-13):** `MatchResponse.LastMessageAt/SenderId` + ghosting windows on the
  thresholds response; `lib/fire.ts` describes (unlit / burning / embers / frozen), the engine
  judges; `judgedAtDawn = ceil(staleHours/24)` (the plan's `floor + 1` was a day too generous);
  `FrostEdge` mounted (for a top/bottom edge `length` is depth); the Guild House, Hall of Names
  (`lib/numerals.ts`), the Ascent as a night sky, the Campaign as a cave, the keepsake Wanted
  poster (only ever the signed-in portrait — tested), the Flame Rite's five states. A grouped
  `Tap` with an `accessibilityLabel` silences its children's text.
- **Wave 4, the hearth and the square (09-13):** candidates never receive full photos —
  `PhotoCompressionService.SealAsync` writes `<name>-sealed.jpg` at upload (320px, blur 18, q60),
  the daily sweep backfills, `CandidateResponse.SealedPhotoUrl` replaces `PhotoUrls`; `/hearth`
  (sky from `dayPhase`, dawn count from `joinedAt`, `CandleRow`, destinations, `DawnFires`) and
  `/satchel` behind `HEARTH_ENABLED` (true; tab bar stays); every header has a way-home tap, and a
  live-call screen passes `chrome={false}` so it can't push away from the call; the plaza and the
  Second Bell; `ordinal_13`…`ordinal_31` (never compose English ordinals); `candle.wav`/`bell.wav`.
  Deferred cleanups are in the plan.

## 2026-09-10 → 11 — Design system, world layer, device passes

- **No component knows a pigment:** raw `COLORS` only inside `lib/theme.ts` (`palette.test.ts`,
  no allowlist); roles `INK`/`ACCENT`/`METAL`; ladders `LEADING`, `TRACKING`, `SCRIM`, `PRESS`,
  `BADGE_SIZES` (tested monotonic and used). Shared `StateBlock`, `DialogSurface`, `Tap`,
  `Vignette`; `lib/testing/sourceTree.ts` is the one source walker for guard tests. The app is
  linted with oxlint (`.oxlintrc.README.md` explains the four rules left off).
- **Screens stand on their own ground:** transparent screens drew through each other during a
  push; `ScreenGround` in `app/_layout.tsx` wraps each screen in an opaque view with its own
  `WorldFloor`. `animationFor`: lateral none, into a delve `slide_from_bottom`, fade under
  reduce-motion.
- **World layer:** `VfxLevel` full / plain / still / off (the old `reduced` conflated "no Skia" with
  "less motion"); the room tone moved to `WorldFloor` as a bottom gradient; the Unsealing ceremony
  on a reveal rung (`useUnsealing` reports only a climb seen live).
- **Creative effects:** `GameButton` press feedback, `CountText`, `TierUpCeremony`, `dayPhase()`
  light offsets, festival tint, near-miss honour hints, the Gate scene on the verify screen.
  Deliberately not built: parallax, ambient soundscapes, continuous shimmer; wave 2 (personal
  sigil, knot of two, encounter scroll) not started.
- **Honours as a trophy hall:** tier frames retired (`RetireTierFrames`); nine honours in catalogue
  order, lit with date or dark with the deed as hint.
- **Waiting vocabulary:** `Waiting`, `Skeleton`, `LongWait` (8 s / 25 s lines) replace ~30 spinners.
- **Backlog clearance:** `StartupGuards` refuses to boot outside Development without
  `VerifyMn:ApiKey`; `phone/start` per-IP window (30 / 15 min); Oath milestone paid before the flag
  flips, one `alreadyPaid` gate per payment; `BusinessPartners.*Mn` columns + `LocalisedContent.Pick`.
- **Authored cast reseed** (`reseed-dev-db.sql`): 19 people across every tier/oath/membership state,
  nine matches with authored Mongolian conversations; per-side message counters are seeded
  (`RevealService` reads them). Portraits are StyleGAN (`gen-cast-photos.py`), served under
  `seed/c2/` (versioned because expo-image caches by URL). `budget.cap.*` is not a hard ceiling:
  `Math.Min(base + bonus + tierBonus, cap + tierBonus)`.
- **Android keyboard:** `KeyboardAvoidingView` is wrong on Android under edge-to-edge in every mode;
  `hooks/useAndroidKeyboardHeight.ts` pads by the keyboard height, iOS keeps the avoider.
- **Web aesthetic pass:** `ChoiceRow` is chips, not forged buttons; quests carry their own rune.
  CI lesson: a step inserted between `dotnet test` and its `env:` block silently moves the
  connection string.

## 2026-09-08 — Moderation, image safety, notification delivery

- **Reporting:** `UserReport` + `ReportService`, `POST /reports` (seven reasons, one open per
  pair), report sheet in chat and Town Square, `/admin/reports` with four outcomes. Penalty and ban
  are admin decisions, never automatic. Filing a report blocks and ends the conversation.
- **Photo ownership** scoped to `photos/profiles/{ownerId}/` (origin-only let anyone wear, then
  delete, another's photo). Header read before decode (`MaxPixels` ~60 MP); per-user upload rate
  limit; the daily sweep deletes unreferenced files older than 24 h. HEIC left the allowlist.
- **Push:** truncated to a byte budget on a rune boundary (Expo's 4 KiB); `POST /push/unregister`
  scoped to the caller (was an IDOR); 10 tokens per user; Android channel. Bans end conversations
  and stop pushes; the app renders a suspension screen.

## 2026-09-05 → 06 — World Pass, honours, identity fixes, QA

- **The World Pass:** every screen is a room (`lib/world/rooms.ts` is the one table: routes, light,
  floor, vfx, depth, atlas coordinate); `matchRoom` is strict (the route-coverage test uses it);
  `video/*` is the one `UNLIT` route. Light rules: no data is not darkness, light never eases down
  for a refetch, one speed (600 ms), a room change is a cut. `HOLD_THEME` makes React Navigation's
  background transparent (its #F2F2F2 turned the app white). Feedback table in
  `lib/world/feedback.ts`; sound is opt-in and silent-switch aware.
- **Honours replace loot:** nine named honours granted once for a deed (Oath-Keeper, Flamekeeper,
  Seal-Breaker, Thread-Weaver / Fate-Seer / Bond-Keeper at 1/5/10 sparks, Ally-Caller, True to
  Word, Seven Dawns); `rarity` carries the Ulzii metal. `Program.cs` does not auto-migrate.
- **Identity (security):** anyone could become any user via the client-writable
  `user_metadata.phone`; aliasing now requires a claimed verify.mn proof. A pending verification
  could be hijacked; sessions resume only by id. See CLAUDE.md.
- **QA pass:** a recipient who never sent a message is never at fault for ghosting — fixed in
  `GhostingService` *and* the batched copy in `DailyMaintenanceBackgroundService` (the production
  path). `MatchEligibility` is the one rule discovery and `POST /matches` share. The reveal ladder
  needs mutual messages (`2·min(a,b)+1`). `ProfileValidation` checks closed sets; existing photos
  are grandfathered so changing `Storage:PublicBaseUrl` can't lock accounts out.
- **Bug sweeps:** `VideoRewardClaimed` per participant; message pages order by `(CreatedAt, Id)`;
  the reveal ladder is served by `GET /engagement/reveal-thresholds`; push copy localised per
  recipient (`PushCopy`, `PushKind`); `RsvpOpensAt` enforced; dev sessions must be seeded `Open`.
- The traditional-Mongolian-script seal layer was built and removed the same evening at the
  user's request — do not propose it again.

## 2026-09-04 — Admin Control Expansion

`ConfigKeys.All` 9 → 61 keys: every score delta, tier thresholds, reputation dock, daily budgets,
membership prices/discounts, quest XP/targets, ghosting/attendance/deletion/ship timings, Town
Square sizing, kill switches. `Min`/`Max` enforced on write and re-checked on boot (out-of-bounds
or non-increasing ladders reset to defaults). `MembershipCatalog` serves app, admin and analytics
from the same keys. Config edits never rewrite `ScoreEvents` (delta stored per event).
`video.enabled=false` also lifts the Flame Rite pledge gate. `score.event.GhostPenalty = 0` still
writes the event the Oath logic reads. Deliberately hardcoded: login throttle, password hashing,
verification windows, upload limits, page sizes, sweep intervals, reputation floor, streak halving.

## 2026-09-01 — Campaign, Ulzii ornament, design tokens, error codes

- **The Campaign** is a lens, never a gate: seven rooms (gate, echoes, runes, voices, flame,
  bridge, threshold/boss) derived from match state; the only interaction is chest claiming
  (`CampaignRoomClaim`, +5 / +25, boss grants Seal-Breaker). Claims work on ghosted matches on
  purpose. `bossCleared` means the boss fell, not every room.
- **Ulzii ornament:** өлзий knot and алхан хээ fret from geometry, edges and thresholds only, three
  metals (gold default, ember for stakes, brass for utility), at most one grand knot per screen;
  `scripts/gen-ornaments.js` rasterises them.
- **Tokens:** `lib/theme.ts` is the single source; `SPACE` is a strict 4 px grid.
- **Errors:** every response carries a stable `code`; the app maps `code` → `err_<code>` and never
  shows the server's English; `admin.*` codes are English-only on purpose.

## 2026-08-31 — verify.mn, hardening, reseed

- **verify.mn phone verification** (flow and trust model in CLAUDE.md): a claim is single-use by
  conditional `UPDATE … WHERE "ClaimedByUserId" IS NULL`, 30-minute window; the callback only
  triggers a re-read.
- **Hardening:** admin login lockout (5 failures / 15 min per username+IP, in-memory); deletion
  deletes files (`DeleteByPublicUrl`, path-based because `PublicBaseUrl` differs per environment);
  `FieldLimits.cs`; CORS allowlist; stored `RevealLevel` is a floor over the message-count level.
- **Reseed:** `reseed-dev-db.sql` exempts `AdminConfigs` and `ContentPages`. The icebreaker and
  quiz now pick deterministically from the match id (`StableIndex`, SHA-256, not `GetHashCode`).
- **Audit fixes:** paged chat history; admin shows Oath/no-show/ban/expiry; analytics tiles.

## 2026-08-14 → 19 — Social mechanics

- **Fated Threads** (`ShipService`): a Weaver nominates two numbers; both accept blind → a normal
  `Match` with `ShipId`, no budget spent. The response shape never reveals whether a number has an
  account, a block, or an existing match. Spark is claimed with a conditional status `UPDATE`.
  `ships.daily.cap` 3, expiry 14 days. Not built: `BlockWeaver` on Pass.
- **Recruit an Ally:** referral codes via onboarding `ReferralCode` (shared field with ship
  invite codes, the server disambiguates); the inviter gets Ally-Caller once.
- **Town Square** (`TownSquareService`): Open → Locked → InProgress → Completed/Cancelled; roster
  split Male/Female, capped at `max_per_side` and truncated to the smaller side; round-robin of
  `round_seconds`; blocked pairs sit out; mutual Yes → `CreateOrReuseMatchAsync` under the shared
  advisory lock. Not built: other genders, overflow notice, attendance rewards.
- **No-show tracking:** 48 h after a confirmed date each side privately says whether they met; a
  single mismatch is inert, `>= dating.noshow.threshold` (3) docks reputation on every further
  mismatch. Deliberately not a conduct rating.
- **The Oath** (Bond / Fate / Kinship): Proven after 2 completed dates with no ghosting since
  sworn; a ghost demotes it; Affinity leads the candidate sort within 25 km. **The Flame Rite:** a
  consented 5-minute call required before the date pledge (`video.enabled=false` lifts the gate).
- **Duplication audit:** `Services/MatchPairing.cs` owns block/already-matched checks for all three
  match-creation paths, failing quietly so a block can't be inferred. The 15–30 s refetch intervals
  behind broadcasts are deliberate (broadcast is best-effort).

## 2026-07-28 → 29 and earlier — Foundations

- **Admin config foundation:** `AdminConfigs`, cached `ConfigService`, `ConfigKeys` seeded on boot,
  revert filters to `UpdateConfig` rows.
- **Membership billing cycles:** 1/3/6 months at 0/10/20 % off the monthly price;
  `MembershipExpiresAt`; `Membership` is an append-only purchase log; the daily sweep downgrades.
  Platinum was retired 2026-08-18. Payment is mocked (no gateway yet).
- **RPG voice pass:** `mn` untouched by the voice rewrite (no guessed Mongolian); destructive
  actions use a plain trigger and a flavourful confirm; optimistic mutations revert on failure;
  the offline mock fallback fires only on a true network failure.
