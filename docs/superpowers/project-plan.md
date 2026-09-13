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

## The Sealed Fire: a redesign that makes the app strange on purpose (2026-09-11)

**Status:** Waves 1 (the kit) and 2 (the thesis) shipped 2026-09-12, Wave 3 (the place) 2026-09-13 —
see `shipped-log.md`. Wave 4 below is open; the four decisions still stand on their defaults.
The one-page report is <https://claude.ai/code/artifact/c2542b0e-1c65-48ec-be04-e85b7caa61d3>
(Export gives the PDF); the working canvas is
<https://claude.ai/code/artifact/0697f213-d884-4ed5-b8b8-e62616403fb1> (pages: *Every screen*,
*The kit*, *Before*; 54 boards, one per screen or sheet, superseded variants removed). Sources are
in the repo under `docs/design/sealed-fire/` (`boards/*.dc.html` + `canvas.json` + `boards.txt`
for the canvas; `report/Main.dc.html` + `report/img/` for the report). Re-seed either with the
`design` skill's helper: `node <helper> --template <payload> --out x.html --title "..." $(cat
boards.txt) --image ... --canvas canvas.json`. Nothing here depends on a session's scratchpad.

**To continue:** write Wave 4's task list under "Wave 4 — the hearth and the square" below (with a
`### Task 0` sentinel), then run it the same way; its record follows Wave 3's into `shipped-log.md`.

### Why

The user's brief: "I want it to be weird, stand out from other apps." The audit that day found the
app's oddness lives in nouns and borders on top of a generic dating-app skeleton (five tabs, a photo
card with Skip/Send, messenger bubbles, a settings form, three pricing cards), while the actual
differentiators (progressive reveal, accountability, gem tiers) are explained in Guides rather than
felt. The direction keeps every token, font, knot and mechanic and spends them differently.

### The direction in one paragraph

The app is a place: a hearth you return to, a fire where sealed travellers wait, letters instead of
a chat, a square with lanterns, a forge, a mirror. Faces are earned, not shown. Fires that go quiet
visibly burn down. Every screen has one knotted hero and one forged button; everything else is rows
on the floor. Time reads in candles, bells and dawns. The app speaks in its own voice everywhere,
including the lock screen.

### The fourteen moves (report page, in order)

1. **Seek, sealed.** The candidate arrives as a silhouette under a wax seal with three seal-dots;
   first name, age, gem, oath, district and the one-line bio show; the likeness does not. Seals break
   with the existing reveal ladder. One forged "Send summons", an ink "Let them pass". The three chrome
   strips (First Steps, summons budget, Gathering pill) leave the top of the screen.
2. **Chat as letters.** No bubbles. A dashed thread, initials as sigils, day headings ("The third
   day"), my lines italic gold, theirs roman silver, "A seal broke here" rows inline, a wax-seal send
   button, "Write your line…".
3. **Woodcut glyphs.** One hand-cut icon set (stroke 2.4, square caps, mitre joins) for the five
   destinations and the six quests, replacing MaterialCommunityIcons where the icon is identity.
4. **Room colours.** The six light signatures pushed until rooms are unmistakable: Fire ember,
   Letters ink-blue, Square lantern amber, Forge soot-and-ember, Mirror the user's gem colour, War
   Room cold steel.
5. **Restraint.** Knots on one hero panel per screen; the forged button on one action per screen;
   all other content as hairline rows; ink links for secondary actions.
6. **The hearth.** A home scene replaces the tab bar: mirror, lantern, letters, fire, anvil as
   destinations; the summons budget as candle stubs that burn down.
7. **Fires that go out.** The Quest Log shows each thread's fire: burning / embers / cold hearth,
   with plain copy on whose turn it is and who let it die. Ghosting becomes visible.
8. **The Guild House.** Membership as a building you climb: Yard (Free) → Hall (Silver) → High
   Table (Gold). Same prices, same perks.
9. **The Square as a plaza.** Town Square as a top-down cobbled square: lit lanterns are RSVPs,
   the bell is the round clock, gates are the RSVP window.
10. **The keepsake card.** "Share my character" exports a Wanted-poster card with gem, score,
    streak line and seal.
11. **Hall of Names.** Leaderboard as carved stone: numerals, gem sigils, points, one torch at your
    row. Names stay hidden (existing rule).
12. **Blackletter titles.** Room names in a blackletter face at one size, once per screen, Latin
    only; Mongolian titles stay in Yeseva until a Cyrillic blackletter is commissioned.
13. **Time in the world's units.** Countdowns become candles, bells and dawns; exact times one tap
    away.
14. **Notifications in the voice.** Rewrite `PushCopy` EN lines in the app's register.

### The dials, adopted after the first review (2026-09-11, late)

The user asked "what if more fierce" and chose three dials: **law** up, **furnace** a little,
**frost** as a second pole; then asked for cave, creatures and the night sky. Adopted:

- **Temperature.** Fire is what is alive, answered and kept; frost is silence, absence and what
  was left. Five tokens in `lib/theme.ts`: `furnace` #FF7A1A, `furnaceBright` #FFB347, `rime`
  #E8F4FA, `ice` #BFE3F2, `glacier` #7FB6D6. One frost drawing reused as an edge overlay wherever
  silence is: a frozen thread in Letters, the Frozen Gate (Banished), the War Room, the offline
  strip, a meeting not kept, White Moon for three days. Break the Ice is literal.
- **Furnace, a little.** The two hot tokens only on the Fire, the Oath, the Ascension, the Square's
  bell and the Hall of Names; glows bleed further there and corners square off. Elsewhere gold and
  rounded stay.
- **Law.** Two words per button, short sentences with full stops; the app commands the world and
  states the law, never scolds the person. EN rewrites: Summon / Dismiss / Choose / Decide; oaths
  become A Bond / Fate / Kin; "Your turn. Two dawns. Judged at the third."
- **The sky belongs to time.** The hearth's window shows the real sky from the existing day phases
  (`lib/world/light.ts` `DayPhase`); the Ascent is drawn as a climb through the night sky with the
  gems as stars. No new mechanic.
- **The cave belongs to the Campaign.** Torchlight, caverns, the dragon at the threshold. Nowhere
  else.

- **The Satchel and materials** (adopted 23:00). One screen reached from the hearth showing what
  the rules gave you today: candles (daily budget), arrows (Fated Threads), the lantern (RSVP), the
  oath sigil and its proof, the key (membership), the ally's word (referral code), the worn honour,
  seals held across threads, your card; each taps through to where it is used. Every object has one
  material, drawn the same way everywhere: wax (consumed), wood and iron (used), bronze (stamped
  once), gold (opens or rewards), parchment (written). Three new tokens: `wax`, `wood`,
  `parchment`; the metals exist. Nothing is found, bought, dropped, crafted or stacked; no stats,
  no shop; the Hall of Honours is the only armory.

Dropped: **inventory as a system** (loot, drops, a shop, stackable items, stats, combat: a bag
that grows turns a dating app into hoarding); **monsters and bats** as a category (sketch-level creature art is worse than none, and
creatures outside the Campaign make the other person read as one); **iron** as a dial (shapes stay
soft except where furnace is). Boards: the adopted versions are the only ones kept on the canvas and in the report.

### Every screen (screens page), grouped by flow

Arrival: The Gate (phone + OTP under one arch), The Naming (steps 1–3 as candles), The Oath (step 4,
long-press the wax to swear). Home and the fire: The Hearth, The Fire, the keepsake card. Letters:
Letters (Quest Log), a thread, Things to do together (one sheet, rows, sever/cast out/report at its
foot), Break the Ice, The Rune Chamber (quiz, tap chooses and advances), The Flame Rite (call with a
candle clock and an ember hang-up), The Campaign (a map that is a map), Under Open Sky (plan an
encounter, seals as pledges). The Square: the plaza, The Second Bell (a round, "Light it / Let them
pass"). The Forge: Missions, a venue page, Meetings Sworn (date log with kept/unkept), Weave a
Thread. The Mirror: the character sheet, editing as three seals, The Ascent, The Hall of Honours (3×3
hooks), Hall of Names, The Guild House. The War Room: settings as steel, The Banished, The Codex
(guides + privacy + terms as one book).

Also drawn after a coverage audit of every route in `app/` and every modal, sheet, toast and
banner in `components/`: Your Likeness (onboarding step 3 with the ally's word), The Hold (the
existing atlas overlay, redrawn), festival days and the First Dawns (the First Steps card moved to
the hearth's mantel), the Square's closed / under-way / quiet states, Leaving the realm (deletion
confirm and the pending banner), the sealed first letter with embers and a severed ending, The
Seals (the reveal strip expanded, with locked chips and the deep seal for Hall and High Table),
The Unsealing ceremony, a thread arriving (Fated Threads accept/pass) with threads woven and the
ally invite, the toasts (reward, honour, streak, nudges), the offline strip and the crash screen,
and the four small sheets (honour story, report, city picker, change number). A final sweep by
copy-key family added: After the meeting (both seals on it, send word to a friend, rate the place,
leave a memory), the Flame Rite card's five states with the camera-refused and could-not-connect
strips, and a plain sign-out row in the War Room beside deletion.

The kit page: three voices of type (blackletter / Yeseva / Alegreya), one forged button + ink links
+ chips + seals, one hero panel then rows; the three states (waiting = candle, empty = a place,
wrong = ember); the five interruptions (chest and ascension as full-screen ceremonies; reckoning,
warning and faltering as bottom parchment strips, never a floating card).

### Decisions (product, not paint) and the default used if none is given

- **Level-zero reveal.** Sealed Seek hides the likeness at level 0; today level 0 grants one photo.
  *Default:* blur the level-0 photo under the seal. No engine change; the Unsealing ceremony fits.
- **Embers in the open.** The Quest Log shows the ghosting judgement before it lands. *Default:*
  show it, with the report's copy ("Your turn, two dawns unanswered. One more and the fire is judged
  yours to have let die."). Accountability is the thesis.
- **The hearth replaces navigation.** *Default:* build it behind a kill switch (`HEARTH_ENABLED`,
  like `WORLD_ENABLED`) with a small hearth glyph in every header as the way home; the tab bar stays
  until the switch flips. Waves 1–3 do not depend on it.
- **Blackletter and Cyrillic.** *Default:* Latin titles in blackletter, Mongolian titles stay in
  Yeseva; revisit if a Cyrillic cut is commissioned.

### Wave 1 — shipped 2026-09-12

The task list lived here; its outcome is in `shipped-log.md` ("Sealed Fire — Wave 1"). What it
left for later waves: header room icons in the glyph set (Wave 2), `SheetModal`'s entrance to match
`AlertModal`'s slide, a shared parchment layer for `AppCard` and `DialogStrip`, per-route (not
per-file) hero/forged rules, `FrostEdge` mounted (Wave 3), the pill and First Steps card onto the
hearth (Wave 4).

### Wave 2 — shipped 2026-09-12

The task list lived here; its outcome is in `shipped-log.md` ("Sealed Fire — Wave 2"). What it
left for later waves: `feedback.ts` rows for candle lit, bell and fire dying (added by the wave that
first fires them); the chronicle's "thirteenth dawn" (needs a joining date on the profile); the
Flame Rite's candle clock (Wave 3, with the rite card's five states); `mystery_match_name` in
blackletter; an engine-side crop or blur for the sealed Seek photo (the client-side blur ships the
full URLs); and, from Wave 1, `SheetModal`'s entrance, the shared parchment layer, per-route rules,
`FrostEdge` (Wave 3), the pill and First Steps card onto the hearth (Wave 4).

### Wave 3 — shipped 2026-09-13

The task list lived here; its outcome is in `shipped-log.md` ("Sealed Fire — Wave 3"). What it
left for Wave 4: the hearth, the plaza, the Second Bell, the Satchel, candle-lit and bell feedback
rows; the cave frame, the dragon and the bats (illustrator); a Cyrillic blackletter; White Moon
frost for three days (check `lib/festivals.ts` first); the Flame Rite card and the ember toast
still unseen on a device. Wave 4's task list follows.

### Wave 4 — the hearth and the square (task list, written 2026-09-13)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app a home and a square: the hearth (behind a switch) with the real sky in its window, the day counted in dawns, the budget as candle stubs and the fires judged at this dawn; Town Square as a plaza of lanterns and the round as The Second Bell; the Satchel with its materials; the sealed Seek photo blurred on the server; and every carry-over the first three waves left (feedback rows, the sheet's entrance, the shared parchment, the chronicle's dawns, the leftovers list).

**Architecture:** Two engine additions (an RSVP count and round count on the next-session response, the joining date on the user response) and one engine feature (a blurred "sealed" variant of each profile photo, generated at upload and by the daily sweep, served to candidates instead of the full photo list) feed the app. The hearth is a new route `app/hearth.tsx` reached from a hearth glyph in every header while `HEARTH_ENABLED` is on; the tab bar stays. The plaza and the bell are redraws of `SessionStatusCard`, the tab and the round screen over unchanged hooks. The Satchel is a view over existing queries. Materials are three theme tokens and one small mark component.

**Tech Stack:** React Native 0.81 / Expo 54, `react-native-svg` (in the dev build), jest + `@testing-library/react-native`; ASP.NET Core 8 + xUnit, `SixLabors.ImageSharp` 3.1 (already referenced).

**Spec:** this file, "The Sealed Fire" section (moves 6, 9, 13; the dials — the sky belongs to time, the Satchel and materials; the decision "The hearth replaces navigation" on its default). Boards: `docs/design/sealed-fire/boards/DawnHearth.dc.html`, `WhiteMoonHearth.dc.html`, `Hold.dc.html`, `Plaza.dc.html`, `SquareLaw.dc.html` (The Second Bell), `SquareAfter.dc.html`, `Satchel.dc.html`, `Materials.dc.html`, `WorldTime.dc.html`, `Sheets.dc.html`.

#### Global constraints (every task's requirements include these)

- **English only.** Every new i18n key goes in `lib/i18n/en.ts` *and* `AWAITING_MN_TRANSLATION` in `lib/i18n/index.ts`, never in `mn.ts`. Changing an existing key's English value leaves `mn.ts` alone and must keep placeholder parity with it. A key no longer referenced must be deleted from **both** tables (`i18nCoverage.test.ts`; `i18n.test.ts`). Template-literal key families are written directly inside `i18n.t(` so the coverage test sees them.
- **The law.** Buttons two words at most; short sentences with full stops; the app commands the world and states the law, never scolds the person. Italic (`FONTS.bodyItalic`) is the app speaking; in the chat it is also my own letters.
- **Temperature.** `TEMPERATURE.furnace*` only in the eight allow-listed files (`lib/__tests__/furnace.test.ts` — `app/(tabs)/townsquare.tsx` and `app/townsquare-round/[sessionId].tsx` are on it; `components/townsquare/*` are not). Frost tokens and `FrostEdge` anywhere silence is; rims use `FROST_RIM_REACH`. No creature art.
- **The kit's counts are tested per file:** one `AppCard hero` (`hero.test.ts`), one forged `GameButton` outside `components/modals/` (`forged.test.ts`, `BRANCHED` for exclusive branches), no raw `COLORS` outside `lib/theme.ts` (`palette.test.ts`), every route in a room or `UNLIT` (`lib/world/__tests__/world.test.ts`). Screen containers stay `backgroundColor: 'transparent'`. **Ruling:** the rules stay per file — "per route" was a Wave 1 carry-over and the per-file rule has held for three waves; a screen assembled from components keeps one hero and one forged *on the screen* by the reviewer's eye, the scanner guards the files.
- **Reduced motion:** any new animation goes through `motionAllowed(useVfxLevel())` from `lib/vfx.ts`.
- **Accessibility:** every drawn state (a sky, a lantern, a candle stub, a cobble) is either labelled or hidden (`accessible={false}` / `importantForAccessibility="no"`); text carries the meaning. A grouped `Tap`/`View` with an `accessibilityLabel` silences its children — put every fact in the label.
- **No new native module.** `react-native-svg`, `react-native-view-shot`, `expo-sharing`, `expo-haptics`, `expo-audio`, `expo-linear-gradient` are in the build.
- **No mechanic changes.** Budgets, RSVP windows, round durations, reveal levels, prices: read from the engine, never re-derived. The Satchel is a view. Nothing is found, bought, dropped, crafted or stacked.
- **Tests are TZ-safe:** every fixture instant is built from local components (`new Date(y, m-1, d, h)`), never a UTC literal asserted against a local string. The whole-wave review runs the suite under `TZ=UTC`.
- **Verification per task.** App: `cd mingldingl_app && npm test && npm run typecheck && npm run lint`. Engine: `DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test` (Postgres up). Tasks 1 and 2 also run `./mingldingl_engine/scripts/export-swagger.sh`, both `npm run generate:api`, and `export-swagger.sh --check`.
- **Git:** single branch `master`, no worktree. One commit per task, `git add -A && git commit`, message prefixed `Sealed Fire W4:`. Do not push.
- **Comments** explain *why*, in the repo's register (read three neighbouring files first).

---

### Task 1: The engine counts lanterns and remembers the day you came

`NextSessionResponse` has no RSVP count (the plaza says "Seven lanterns lit so far") and no round count ("Four, a bell each"); `UserResponse` has no joining date (the hearth's "THE FOURTEENTH DAWN", the chronicle's dawns).

**Files:**
- Modify: `mingldingl_engine/src/MinglDingl.Engine/DTOs/TownSquareDto.cs` (or wherever `NextSessionResponse` lives — grep), `DTOs/UserDto.cs` (`UserResponse`), `Controllers/TownSquareController.cs` (`GetNextSession`), the builder of `UserResponse` (grep `new UserResponse(`)
- Modify: `tests/MinglDingl.Engine.Tests/Integration/TownSquareControllerIntegrationTests.cs` (extend `GetNextSession_UpcomingOpenSession_ReturnsItWithRsvpFlag` — and give it the same shared-DB workaround its neighbour `GetNextSession_NoUpcomingSession_ReturnsNullSessionId` has: clear live sessions inside the test's transaction before adding the fixture), `tests/.../UsersControllerIntegrationTests.cs` (the `GET /users/me` test — assert `CreatedAt` is served)
- Regenerate: `mingldingl_engine/swagger.json`, `mingldingl_app/lib/api/api.generated.d.ts`, `mingldingl_control/src/lib/api/api.generated.d.ts`
- Modify: `mingldingl_app/hooks/useTownSquareSession.ts` (`TownSquareNextSession` gains `rsvpCount: number`, `roundCount: number`), `mingldingl_app/models/user.ts` (`UserProfile.joinedAt?: string`, parsed from `d.createdAt ?? undefined`)
- Test: `mingldingl_app/lib/__tests__/userModel.test.ts` (extend or create beside the existing model tests), `hooks/__tests__/useTownSquareSession.test.tsx` (extend if present, else a parse test)

**Interfaces:**
- Produces (engine): `NextSessionResponse(..., bool IsRsvpd, int RsvpCount = 0, int RoundCount = 0)` — `RsvpCount` = `Db.TownSquareRsvps.CountAsync(r => r.SessionId == session.Id)`; `RoundCount` = the configured rounds per session (grep `TownSquareService` for the config key that sizes a session — the plan says "Town Square sizing" is admin config — and read it through `ConfigService`; if no such key exists, the number of `TownSquareRound` rows once started, else the engine's constant, and say which in the report). `UserResponse.CreatedAt: DateTime` appended, from `User.CreatedAt`.
- Produces (app): `TownSquareNextSession.rsvpCount`, `.roundCount` (default 0 when absent); `UserProfile.joinedAt?: string`.

- [ ] **Step 1: DTOs and builders** as above (appended, defaulted, so no caller breaks).
- [ ] **Step 2: Tests.** The next-session test asserts `RsvpCount == 1` and `RoundCount > 0` after RSVP; the users test asserts `CreatedAt` within a minute of now (UTC kind, as the file's other instants).
- [ ] **Step 3: Regenerate** (`export-swagger.sh`, both `generate:api`, `--check`).
- [ ] **Step 4: App models + tests.** Parse tolerantly (`d.rsvpCount ?? 0`).
- [ ] **Step 5: Verify; commit** — `Sealed Fire W4: the engine counts lanterns and remembers the day you came`.

---

### Task 2: The likeness stays sealed on the wire

`GET /matches/candidates` serves every photo URL of a candidate; the app blurs the first one on the client. A candidate the user has not earned should never receive the full photo.

**Files:**
- Create: `mingldingl_engine/src/MinglDingl.Engine/Services/SealedPhotoService.cs`
- Modify: `Services/PhotoCompressionService.cs` (a `SealAsync(byte[] jpeg): Task<byte[]>` — ImageSharp: resize to `MaxDimension = 320` (`ResizeMode.Max`), `GaussianBlur(18)`, JPEG quality 60), `Services/LocalFileStorageService.cs` (`SealedPathOf(relativePath)` → same directory, `<name>-sealed.jpg`; `SealedPublicUrlOf(url)`), the photo upload action (grep `UploadAsync(` in `Controllers/UsersController.cs` or `PhotosController.cs`): after storing the original, store the sealed variant beside it; `DailyMaintenanceBackgroundService`: a sweep step that walks `EnumerateProfilePhotos()` and creates any missing sealed variant (bounded to 200 per sweep); `DTOs/MatchDto.cs` `CandidateResponse`: **replace** `IReadOnlyList<string> PhotoUrls` with `string? SealedPhotoUrl` (the first photo's sealed variant, or null when it does not exist yet); `Controllers/MatchesController.cs` `GetCandidates`; `ServiceCollectionExtensions.cs` (register the service); the photo deletion paths (`DeleteByPublicUrl` also removes the sealed sibling)
- Test: `tests/MinglDingl.Engine.Tests/Services/SealedPhotoServiceTests.cs` (create: a 64×64 red PNG in → a JPEG out, smaller than the input's dimensions, decodable), the candidates integration test (grep `candidates` under `tests/Integration`: assert the response has no `PhotoUrls` and `SealedPhotoUrl` ends with `-sealed.jpg` for a candidate with a photo on disk, null for one without), the maintenance test (a photo without a sealed sibling gets one after the sweep)
- Regenerate: swagger + both generated files
- Modify (app): `mingldingl_app/models/candidate.ts` (`sealedPhotoUrl?: string`; delete `photoUrls`), `components/cards/CandidateCard.tsx` (`const photo = candidate.sealedPhotoUrl`; keep `blurRadius` as a veil over an already-blurred image and the seal stack unchanged; when null, the seal stands alone on the ground), every reader of `candidate.photoUrls` (grep — `hooks/useDiscover.ts`, tests), `lib/__tests__/candidateModel.test.ts` or the card's test
- Verify: engine `dotnet test`; app suite; `export-swagger.sh --check`

- [ ] **Step 1: Failing engine tests** (service, candidates, maintenance).
- [ ] **Step 2: Implement** the service, the upload hook, the sweep, the DTO. The sweep's per-photo failures are logged and skipped (a corrupt file must not stop the sweep). Deleting a user (anonymisation) already deletes their files by public url — extend `DeleteByPublicUrl` to remove `-sealed.jpg` too and assert it in the existing deletion test.
- [ ] **Step 3: Regenerate; app model + card + tests.** The card's contrast test (Wave 2) keeps asserting against the veil alpha; the sealed-likeness `testID` stays.
- [ ] **Step 4: Backfill note for the report:** the dev database's seed photos gain sealed siblings on the first sweep (`POST /dev/run-maintenance-sweep`); say so and run it once locally so the device pass sees sealed candidates.
- [ ] **Step 5: Verify; commit** — `Sealed Fire W4: the likeness stays sealed on the wire`.

---

### Task 3: Materials, the shared parchment, the sheet's entrance

**Files:**
- Modify: `mingldingl_app/lib/theme.ts` (`export const MATERIAL = { wax: '#E4D6B4', wood: '#6B4A28', iron: '#5C6470', bronze: METAL.brass, gold: METAL.gold, parchment: '#DCD0B4' } as const` with a doc comment quoting the Materials board — one material per object, the metals already exist), `components/ui/AppCard.tsx`, `components/modals/DialogSurface.tsx` (`DialogStrip`), `components/modals/SheetModal.tsx`
- Create: `components/ui/ParchmentFill.tsx` (`ParchmentFill({ opacity = 0.06 })` — the `LinearGradient` `SURFACE.raised → SURFACE.panel` plus the `assets/textures/parchment.png` image, absolutely filled, `pointerEvents="none"`, hidden from a11y; `AppCard`'s hero branch and `DialogStrip` both render it instead of their own copies), `components/ui/MaterialMark.tsx` (`MaterialMark({ material: Material, glyph: GlyphName, size = ICON_SIZES.lg, label? })` — a `Glyph` in the material's colour on a small rounded swatch tinted `tint(MATERIAL[material], 0.18)`; `Material = keyof typeof MATERIAL`; `testID="material-<material>"`; labelled = image role, unlabelled = hidden)
- Test: `components/ui/__tests__/MaterialMark.test.tsx` (six materials render their testID; a label makes it accessible), `components/ui/__tests__/ParchmentFill.test.tsx` (renders the texture once; `AppCard hero` and `DialogStrip` each contain exactly one `parchment-texture`), `lib/__tests__/palette.test.ts` (extend: `MATERIAL` colours are not raw `COLORS` re-exports — the existing scan passes as long as they are defined in `theme.ts`)

- [ ] **Step 1: Tokens + `MaterialMark`** (tests first).
- [ ] **Step 2: `ParchmentFill`**; `AppCard` and `DialogStrip` lose their duplicate gradient+texture. Existing tests that look for `parchment-texture` keep passing.
- [ ] **Step 3: `SheetModal`** `animationType="slide"` (matches `AlertModal`); one test asserts the prop.
- [ ] **Step 4: Verify; commit** — `Sealed Fire W4: materials, the shared parchment, the sheet's entrance`.

---

### Task 4: The hearth's scaffolding — the switch, the way home, candle stubs, two signals

**Files:**
- Modify: `lib/world/index.ts` (`export const HEARTH_ENABLED = true;` doc: the decision's default — the tab bar stays until the switch flips), `lib/world/rooms.ts` (`hearth` room's `match` gains `'hearth'` and `'satchel'`), `components/ui/HeaderBar.tsx` (when `HEARTH_ENABLED` and the current route is not `/hearth`, a `Tap` with `Glyph name="hearth"` `ICON_SIZES.lg` `ACCENT.base` at the head of the tail row, `accessibilityRole="button"`, `accessibilityLabel={i18n.t('go_home')}`, `router.push('/hearth')`; `testID="header-hearth"`), `lib/world/feedback.ts` (`candleLit: { haptic: 'light', sound: require('../../assets/sounds/candle.wav') }`, `bell: { haptic: 'medium', sound: require('../../assets/sounds/bell.wav') }`), `scripts/gen-sounds.js` (`candle()`: a soft 0.35 s "whoomf" — lowpass noise at 600 Hz seed of your choice decaying with `k = 9` under a 220 Hz sine decaying `k = 6`, amplitude 0.45; `bell()`: 1.4 s, partials 520 Hz ×1.0, 1040 Hz ×0.5, 1560 Hz ×0.25 each decaying `k = 3`, amplitude 0.7; add to `SOUNDS`; rerun — every existing WAV byte-identical or stop and report), `lib/i18n/en.ts` + `index.ts`
- Create: `components/hearth/CandleRow.tsx` (`CandleRow({ remaining, budget }: { remaining: number; budget: number })` — `budget` stubs in a row (cap the drawing at 16, then "+N"), the first `remaining` lit (a `Glyph name="candle"` in `MATERIAL.wax` with a small `ACCENT.bright` flame dot), the rest spent (the glyph in `INK.muted`, shorter); the row is one accessible node with label `candles_left` ("%{remaining} of %{budget} candles left"); `testID="candle-row"`, lit stubs `testID="candle-lit"`)
- Test: `components/hearth/__tests__/CandleRow.test.tsx` (3 of 5 → three lit, two spent, the label; 0 of 5 → none lit), `lib/world/__tests__/feedback.test.ts` (extend: the two rows exist, load nothing until sound is on), `components/ui/__tests__/HeaderBar.test.tsx` (extend or create: the hearth tap is present when enabled and routes to `/hearth`; absent on the hearth itself)

**Interfaces:** produces `HEARTH_ENABLED`, `CandleRow`, `WorldEvent` `'candleLit' | 'bell'`, keys `go_home: 'Home'` (the label only; no visible text), `candles_left: '%{remaining} of %{budget} candles left'`.

- [ ] **Step 1: Keys, switch, room entries.** Add a placeholder `app/hearth.tsx` and `app/satchel.tsx` that render a `HeaderBar` with the room name only (Task 5 and Task 9 fill them) so `world.test.ts`'s route coverage passes from this commit.
- [ ] **Step 2: `CandleRow`** (tests first), the header glyph, the feedback rows and sounds.
- [ ] **Step 3: Verify; commit** — `Sealed Fire W4: the hearth's scaffolding`.

---

### Task 5: The hearth (move 6)

**Files:**
- Create: `components/hearth/SkyWindow.tsx`, `components/hearth/Destinations.tsx`, `components/hearth/DawnFires.tsx`
- Modify: `app/hearth.tsx`, `app/(tabs)/profile.tsx` (remove `GettingStartedCard` and `DailyBudgetMeter` — they move to the hearth; delete `DailyBudgetMeter` if the hearth's `CandleRow` is now the only budget display — grep), `app/(tabs)/matches.tsx` (remove `NextGatheringPill` from the top — it moves to the hearth; Task 7 removes it from the Square tab), `lib/i18n/en.ts` + `index.ts`
- Test: `components/hearth/__tests__/SkyWindow.test.tsx`, `DawnFires.test.tsx`, `app/__tests__/hearth.test.tsx`

**Interfaces:**
- Consumes: `dayPhase(new Date(now))` / `PHASE_EDGE` from `lib/world/light.ts`, `useActiveFestival()` (`key` starting `tsagaan-sar` = White Moon), `useProfile()` (`joinedAt`, `isProfileComplete`), `useMatches()` + `fireOf/fireLine/fireEyebrow` (Wave 3) + `useGhostingWindows` + `useMyUserId` + `useNowTicker`, `useDailyMatchBudget()`, `useTownSquareSession()`, `useMilestones` (whatever `GettingStartedCard` needs today — read `profile.tsx`), `threadDay`/`ordinalWord` from `lib/worldTime.ts`, `FrostEdge`/`FROST_RIM_REACH`, `CandleRow`, `Glyph`.
- Produces:
  ```ts
  SkyWindow({ phase, width, whiteMoon }: { phase: DayPhase; width: number; whiteMoon: boolean })
  Destinations()   // five rows: fire → /(tabs)/discover, letters → /(tabs)/matches, lantern → /(tabs)/townsquare, forge → /(tabs)/activity, gem → /(tabs)/profile; plus one ink row "The Satchel" → /satchel
  DawnFires({ fires }: { fires: { name: string; fire: Fire }[] })
  ```
  Copy (EN, awaiting): `hearth_title: 'The Hearth'`, `hearth_dawn: 'The %{dawn} dawn'` (eyebrow, uppercase via `CardEyebrow`; `dawn` = `ordinalWord(threadDay(nowIso, joinedAt))`; when `joinedAt` is absent the eyebrow is `hearth_dawn_unknown: 'A new dawn'`), `hearth_sky: 'The sky over the hearth is the real sky. Night while you sleep, dawn when the fires are judged, day, dusk. Your streak is counted in the dawns you were here for.'` (italic, once), `hearth_judged: 'Judged at this dawn'`, `hearth_fire_burns: "%{name}'s fire burns. %{turn}"` (`turn` = `fire_line_their_turn`/`fire_line_my_turn`'s own text is too long — use `their_turn: 'Their turn.'` / `your_turn: 'Your turn.'`), `hearth_fire_embers: "%{name}'s fire is down to embers. %{turn}"`, `hearth_fire_froze: "%{name}'s froze. %{verdict}"` (verdict = `fireVerdict`), `hearth_no_fires: 'No fires yet. The road is where they start.'`, `hearth_white_moon: 'White Moon'`, `hearth_white_moon_sub: 'Frost on the window, snow past the door. The fire is hotter for it. Three days; the knots turn white.'`, `hearth_candles: 'Each summons burns one. The frost takes nothing; only silence does.'` (under the candle row, italic), `dest_fire: 'The Fire'`, `dest_letters: 'Letters'`, `dest_square: 'The Square'`, `dest_forge: 'The Forge'`, `dest_mirror: 'The Mirror'`, `dest_satchel: 'The Satchel'`, `hearth_law: 'A map, never a hallway. Nothing is reachable only from here.'` (footer, italic).

- [ ] **Step 1: `SkyWindow`.** An `Svg` `width × 160` with `RADIUS.md` clip: a vertical gradient per phase — night `NIGHT.black → NIGHT.blue`, dawn `NIGHT.blue → tint(ACCENT.bright, 0.5)`, day `NIGHT.blue → tint(INK.primary, 0.25)`, dusk `NIGHT.brown → NIGHT.black` — twelve fixed stars (`r` 1–2, `INK.muted`) visible at night and dawn only, a horizon glow ellipse (`ACCENT.bright` at 0.25) at dawn and dusk; `whiteMoon` adds a `FrostEdge edge="top" length={FROST_RIM_REACH}` and `edge="bottom"` over the window. `accessible` with label `sky_<phase>` (`sky_night: 'Night.'`, `sky_dawn: 'Dawn.'`, `sky_day: 'Day.'`, `sky_dusk: 'Dusk.'`) — four keys. No animation.
- [ ] **Step 2: `DawnFires`.** For each match with a fire (unlit excluded), one hairline row: the `flame`/`ember`/`ice` mark exactly as `QuestTile` chooses it, and one sentence from the three `hearth_fire_*` keys; tap → `/chat/<id>`; row label = the sentence. Ordered frozen first, then embers, then burning (the judged ones lead). Empty → `hearth_no_fires` in italic.
- [ ] **Step 3: The screen.** `HeaderBar title={hearth_title}` (no hearth glyph on itself); the one `AppCard hero` holds `SkyWindow` (measured width), the dawn eyebrow, the sky sentence (or, on White Moon, the `hearth_white_moon` eyebrow and its sub), and `CandleRow` with `hearth_candles` under it; then `GettingStartedCard` (moved, unchanged behaviour, only while it has steps) and `NextGatheringPill` (moved); then `Destinations` (hairline rows, glyph + name, `accessibilityRole="button"`); then `DawnFires` under the `hearth_judged` eyebrow; then `hearth_law`. No forged button on this screen.
- [ ] **Step 4: Tests.** Sky: night renders stars, day does not, White Moon renders both frost rims, the label per phase. DawnFires: order and sentences for one of each state (local-component instants). Screen: mocked hooks — the eyebrow reads "The fourteenth dawn" for a `joinedAt` thirteen local days ago, five destinations route to their tabs, the candle row shows 3 of 5, the pill and First Steps render here and no longer on the profile/matches (extend `app/__tests__/settings.test.tsx`-style tests for those two screens if they exist; else assert by grep in the report).
- [ ] **Step 5: Verify; commit** — `Sealed Fire W4: the hearth`.

---

### Task 6: The chronicle counts dawns; the sealed name

**Files:**
- Modify: `components/progression/ScoreHistoryList.tsx` (a `SectionList` grouped by local day: heading `chronicle_dawn: 'The %{dawn} dawn'` uppercase eyebrow, `dawn` = `ordinalWord(threadDay(item.createdAt, joinedAt))`; when `joinedAt` is absent, headings are `formatDate(day)` as today; the list takes `joinedAt?: string` as a prop from `app/progression.tsx`, which reads it from `useProfile()`), `lib/i18n/en.ts` (`mystery_match_name` → `'A sealed one'` — placeholder parity: none), `index.ts`
- Test: `components/progression/__tests__/ScoreHistoryList.test.tsx` (extend: three events over two local days from a `joinedAt` twelve days ago → headings "THE THIRTEENTH DAWN" and "THE TWELFTH DAWN" in order; without `joinedAt` the date headings)

- [ ] **Step 1: Failing test; implement; verify; commit** — `Sealed Fire W4: the chronicle counts dawns`.

---

### Task 7: The Square as a plaza (move 9)

**Files:**
- Create: `components/townsquare/Plaza.tsx`
- Modify: `components/townsquare/SessionStatusCard.tsx`, `app/(tabs)/townsquare.tsx` (remove `NextGatheringPill`; the plaza carries it), `app/townsquare-round/[sessionId].tsx` (the round-over block only — lantern copy), `hooks/useTownSquareSession.ts` (`signal('candleLit')` in `rsvpMutation.onSuccess`), `lib/i18n/en.ts` + `index.ts`
- Test: `components/townsquare/__tests__/Plaza.test.tsx`, `SessionStatusCard.test.tsx` (extend), `app/townsquare-round/__tests__/[sessionId].test.tsx` (the round-over copy)

**Interfaces:** consumes `TownSquareNextSession.rsvpCount/roundCount` (Task 1), `WorldClock`, `Glyph` (`lantern`, `bell`), `MATERIAL` (Task 3), `useActiveFestival`.
- Produces `Plaza({ width, lanterns, mine, open }: { width: number; lanterns: number; mine: boolean; open: boolean })`: an `Svg` `width × 220` — a dashed `LINE.edge` rectangle inset by 12 (the square), a cobble pattern (`Pattern` of `r=1.2` dots in `tint(INK.muted, 0.35)`, 10 px pitch), "NORTH GATE" / "SOUTH GATE" `SvgText` in `FONTS.utility` `INK.dim` at the top and bottom edges (open → `INK.dim`, closed → `INK.muted` with a short line across each gate), the `bell` glyph drawn as a `Circle r=14` in `tint(ACCENT.bright, 0.35)` with a `Path` bell at the centre and "THE BELL" under it, and `min(lanterns, 24)` lantern glows at deterministic positions (a seeded pseudo-random walk from index, kept inside the square, never on the bell) — each a radial `<RadialGradient>` disc `r=9` in `MATERIAL.bronze` fading to transparent; when `mine`, the last one is `ACCENT.bright` (this file is not on the furnace allow-list) with a "YOU" `SvgText` under it. The whole drawing is one accessible image with label `plaza_label` ("%{count} lanterns lit. Yours among them." / "%{count} lanterns lit." / "No lantern lit yet.").
  Copy (EN, awaiting): `plaza_sub_open: 'Gates close at the lantern-lighting. %{count} lanterns lit so far, yours among them.'`, `plaza_sub_open_not_mine: 'Gates close at the lantern-lighting. %{count} lanterns lit so far.'`, `plaza_sub_locked: 'The gates are shut. %{count} lanterns lit. The first bell is near.'`, `plaza_first_bell: 'First bell'`, `plaza_rounds: 'Rounds'`, `plaza_rounds_value: '%{count}, a bell each'`, `plaza_closed_lit: '%{count} lanterns were lit from both sides. They wait in your letters.'`, `plaza_closed_lit_one: 'One lantern was lit from both sides. It waits in your letters.'` (the round-over block, above the lit rows). EN value changes on existing keys (buttons two words — the law): `town_square_rsvp` → `'Light it'` (the forged RSVP), `town_square_cancel_rsvp` → `'Put out'` (ink cancel), `town_square_rejoin` → `'Return'` (ink, only when RSVP'd), `town_square_empty_title` → `'The square stands quiet'`, `town_square_empty_sub` → `'No gathering is called yet. Return when the horn sounds.'`, `town_square_in_progress` → `'The bells are ringing without you.'`, `round_over_title` → `'The square has closed'`, `round_over_body` unchanged, `round_over_matches` → `'Lanterns lit from both sides:'`, `round_over_no_matches` → `'No lantern lit from both sides this time. The next gathering will be along.'`. Rule: reuse an existing key when its English can change; add a new key only for a new sentence. The `gathering_*` keys stay (the hearth mounts the pill).

- [ ] **Step 1: `Plaza`** (tests: 7 lanterns → 7 glows, `mine` → the YOU label, closed gates render the bars, the label text).
- [ ] **Step 2: `SessionStatusCard`.** Open/Locked branch: the card becomes the screen's one `AppCard hero` holding `Plaza` (measured width), the sub line in italic, two stat rows (`plaza_first_bell` → the existing `WorldClock` `first_bell`; `plaza_rounds` → `plaza_rounds_value` with `roundCount`), the gates clock only while open (existing `WorldClock gates_close`), then forged `Light it` / ink `Put out`. In-progress branch: `plaza_under_way` + ink `Return` when `isRsvpd`. Quiet branch: `StateBlock icon="door"` with the two lines. Mongolian width: stat labels `flexShrink: 1`, the sub `numberOfLines` unbounded.
- [ ] **Step 3: The tab** loses the pill; the round-over block on the round screen uses the lantern copy and the `lantern` glyph per lit row; `candleLit` fires once on a successful RSVP (test: the mock `signal` is called once).
- [ ] **Step 4: Verify; commit** — `Sealed Fire W4: the Square as a plaza`.

---

### Task 8: The Second Bell

**Files:**
- Modify: `app/townsquare-round/[sessionId].tsx` (the header: blackletter `bell_title` = "The %{ordinal} Bell" via `ordinalWord(roundNumber)` capitalised, Latin only — through `HeaderBar`'s title; the countdown in `TEMPERATURE.furnaceBright` `FONTS.display` `FONT_SIZES.xl` beside a `bell` glyph in `TEMPERATURE.furnace` — this file is allow-listed), `components/townsquare/RoundPrompt.tsx` (a strip: 2px top rule `tint(METAL.ember, 0.8)`, `ParchmentFill`, eyebrow `bell_question: 'The question at the bell'`, the icebreaker text in `FONTS.body` `INK.primary`, the helper `bell_decide: 'Then the bell. Decide.'` in italic, and two `GameButton`s — ink `town_square_no` ("Let pass"), forged `town_square_yes` ("Light it"); after answering: `bell_lit: 'Lantern lit from both sides.'` + `town_square_match_after` or `bell_waiting: 'Your answer is kept until the bell.'`; corners square (`borderRadius: 0`) — the board's "nothing rounded"), `hooks/useTownSquareRound.ts` (`signal('bell')` when `round.roundNumber` increases — a `useRef` of the last number; test with a rerendered query result), `lib/i18n/en.ts` + `index.ts`
- Test: `components/townsquare/__tests__/RoundPrompt.test.tsx` (extend: eyebrow, helper, the two buttons, the after-answer lines), `app/townsquare-round/__tests__/[sessionId].test.tsx` (extend: "The First Bell" for round 1, "The Second Bell" for round 2), `hooks/__tests__/useTownSquareRound.test.tsx` (create or extend: the bell fires on advance, not on first load)

EN value changes: `town_square_no` → `'Let pass'`, `town_square_waiting_for_round` → `'Your answer is kept until the bell.'`, `town_square_its_a_match` → `'Lantern lit from both sides.'`, `town_square_round_label` stays for the a11y label. `forged.test.ts`: `RoundPrompt.tsx` gains its one forged button; the round screen keeps its one (the retry).

- [ ] **Step 1: Tests first; implement; verify; commit** — `Sealed Fire W4: the Second Bell`.

---

### Task 9: The Satchel

**Files:**
- Create: `components/satchel/SatchelRow.tsx`, `app/satchel.tsx` (replace the Task 4 placeholder)
- Modify: `app/(tabs)/profile.tsx` (an ink link row `dest_satchel` → `/satchel` beside "Encounter Log"), `lib/i18n/en.ts` + `index.ts`
- Test: `components/satchel/__tests__/SatchelRow.test.tsx`, `app/__tests__/satchel.test.tsx`

**Interfaces:** consumes `useDailyMatchBudget`, `usePendingShips` (`pendingShips.length`), `useTownSquareSession` (`session.isRsvpd`, `status`), `useProfile` (`oath`, `oathProven`, `oathEncountersHeld/Needed`, `referralCode`, `equippedTitleId`, `membershipLevel`), `useMembership` (`currentLevel`), `useMatches` + `revealLadderSnapshot()` (seals held = for each active match, `ladder.length - revealLevel` unbroken; sum and the count of threads), `useInventory` (the worn honour's name via the existing honour name key family — read `HonourCase.tsx`), `MaterialMark` (Task 3), `oathLabel` (`components/OathSigil.tsx`'s `OATH_NAME_KEYS` mechanism as `CharacterCard` uses it).
- Produces `SatchelRow({ material, glyph, name, line, to, testID })` — a hairline row: `MaterialMark` at the left, `name` in `FONTS.display`, `line` in `FONTS.body` `INK.dim`, chevron; `accessibilityRole="button"`, label `${name}. ${line}`; `router.push(to)`.
  Rows, in the board's order, with material / glyph / name key / line keys / route:
  1. wax / `candle` / `satchel_candles: 'Candles'` / `satchel_candles_line: '%{remaining} of %{budget} left'` / `/(tabs)/discover`
  2. wood / `pledge` / `satchel_arrows: 'Arrows'` / `satchel_arrows_line: '%{count} await your answer'`, `satchel_arrows_one: 'One awaits your answer'`, `satchel_arrows_none: 'None in flight'` / `/(tabs)/matches`
  3. bronze / `lantern` / `satchel_lantern: 'Lantern'` / `satchel_lantern_lit: 'Lit for the next gathering'`, `satchel_lantern_unlit: 'Unlit'`, `satchel_lantern_none: 'No gathering called'` / `/(tabs)/townsquare`
  4. bronze / `seal` / `satchel_oath: 'Oath sigil'` / `satchel_oath_line: '%{oath} · %{held} of %{needed} kept'`, `satchel_oath_proven: '%{oath} · proven'`, `satchel_oath_none: 'No oath sworn'` / `/(tabs)/profile`
  5. gold / `knot` / `satchel_key: 'The key'` / `satchel_key_held: 'Held · %{floor}'` (floor = `floor_Silver`/`floor_Gold` from Wave 3), `satchel_key_none: 'Not held · the Hall opens the deep seal'` / `/membership`
  6. bronze / `letters` / `satchel_word: "Ally's word"` / the code itself as the line (`referralCode`, or `satchel_word_none: 'Not yet given'`) / `/(tabs)/profile`
  7. gold / `flame` / `satchel_honour: 'Worn honour'` / the honour's name or `satchel_honour_none: 'None worn'` / `/(tabs)/profile`
  8. wax / `seals` / `satchel_seals: 'Seals held'` / `satchel_seals_line: '%{seals} unbroken on you, across %{threads} threads'`, `satchel_seals_one_thread: '%{seals} unbroken on you, across one thread'`, `satchel_seals_none: 'No thread open'` / `/(tabs)/matches`
  9. parchment / `gem` / `satchel_card: 'Your card'` / `satchel_card_line: 'Wanted, honestly kept'` / `/(tabs)/profile`
  Header `satchel_title: 'The Satchel'`, sub `satchel_sub: 'What you carry tonight. Every object here already exists as a rule; this is the first time they sit together. Tap one to go where it is used.'` (italic), summary under the rows in italic `satchel_summary` built from the first three rows' short forms (`satchel_sum_candles: '%{count} candles.'`, `satchel_sum_candles_one: 'One candle.'`, `satchel_sum_arrows: '%{count} arrows.'`, `satchel_sum_arrows_one: 'One arrow.'`, `satchel_sum_lantern: 'Your lantern is lit.'`), joined with spaces; footer `satchel_law: 'Nothing here can be bought, found or stacked. What you carry is what the rules gave you. The bag never grows; it only fills and empties with the day.'` (italic). No hero, no forged button on this screen; the numbers are words through `countWord` where the copy is a sentence.

- [ ] **Step 1: `SatchelRow`** (test: material mark, name, line, label, press routes).
- [ ] **Step 2: The screen** with all nine rows computed from mocked hooks; tests cover a full satchel and an empty one (Free, no oath, no code, no honour, no matches, no session).
- [ ] **Step 3: Verify; commit** — `Sealed Fire W4: the Satchel`.

---

### Task 10: The leftovers

**Files:**
- Modify: `app/blocked-users.tsx` (`useNowTicker()` for `now`), `components/cards/ShareCharacterButton.tsx` (clear `error` when the preview opens), `lib/__tests__/i18nCoverage.test.ts` (strip `//…` line comments and `/* … */` block comments from each file's text before the literal scan — a small `stripComments(text)` helper in `lib/testing/sourceTree.ts` with its own test: a key that appears only in a comment is an orphan), `lib/i18n/en.ts` (any key the stricter scan now finds orphaned — delete from both tables; if a key is genuinely read through a construct the scanner cannot see, add its literal reader rather than a comment)
- Test: `app/__tests__/blockedUsers.test.tsx` (the dawn line uses the ticker's `now` — mock `useNowTicker`), `components/cards/__tests__/ShareCharacterButton.test.tsx` (a failed share, close, reopen → no error text), `lib/testing/__tests__/sourceTree.test.ts` (create: `stripComments`)

- [ ] **Step 1: Tests first; implement; run the whole suite** (the coverage test may surface orphans — fix them here); **commit** — `Sealed Fire W4: the leftovers`.

---

### Task 0 — the Wave 4 list ends here

(Sentinel heading for the brief-extraction script. After Task 10 the controller runs the final whole-wave review under `TZ=UTC`, the A51 device pass — including the owed Flame Rite card (seed a thread with `IcebreakerComplete = true`), the ember toast, the OTP gatekeeper line, the Chest and Ascension ceremonies, LongWait and the `dark` room floor where they can be reached — moves this list's record into `shipped-log.md`, and pushes.)

**Deliberately left after Wave 4 (write into the shipped record):** a Cyrillic blackletter (a commissioned cut); the cave frame, dragon and bats and the hearth/plaza scenes as final art (illustrator); flipping `HEARTH_ENABLED` to replace the tab bar (a product decision); the translator's list; QPay/HiPay.


### Gaps found while writing the report (settle before the wave that touches them)

- Mongolian strings run 20–40% longer than English; chips, eyebrows and plaza labels need a
  Mongolian width pass (chips and eyebrows done in Wave 2; Wave 4 for the plaza).
- Sound and haptics: `lib/world/feedback.ts` has seal break (Wave 2) and fire dying (Wave 3); candle
  lit and bell come with Wave 4. Sound stays opt-in.
- Reduced motion: the new ceremonies and the hearth's embers must respect the existing switch.
- Contrast: the blackletter face read at 44px on the A51 (Wave 1, done); ember-on-dark toasts asserted in the palette test (Wave 3, done).
- Accessibility labels for every glyph and seal (glyphs done in Wave 1: labelled = image role, unlabelled = hidden; seals done in Wave 2).
- The keepsake card exports only the sharer's own portrait (Wave 3, done — a test asserts it).
- "Deleted User" and "Unknown" (`deleted_user`, `unknown_name`) still appear as names in threads and
  on the wall; in the voice they are "A name struck" and "A sealed one" (done in Wave 2, EN only).
- Admin panel and web build are out of scope; web renders the new screens without Skia, as today.

### Build order (waves; each ends committed, pushed, CI green, device-checked on the A51)

- **Wave 1 — the kit, no behaviour change.** Shipped 2026-09-12 (`shipped-log.md`).
- **Wave 2 — the thesis.** Shipped 2026-09-12 (`shipped-log.md`).
- **Wave 3 — the place.** Shipped 2026-09-13 (`shipped-log.md`).
- **Wave 4 — the hearth and the square.** The hearth home (behind a kill switch like
  `WORLD_ENABLED`) with the real sky in its window from the day phases, candle-stub budget, the
  plaza with lantern RSVPs, the round as The Second Bell, the Satchel (`app/satchel.tsx`, a view
  over existing queries: budget, ships, town-square session, profile oath, membership, referral
  code, equipped item, reveal levels) with the three material tokens.
- **Every wave** adds its EN strings only; every new MN string goes on `AWAITING_MN_TRANSLATION`.
  The translator's list grows by roughly 120 lines across the four waves.

### Readiness checklist (what "ready to build" means here)

- [x] Every route, every modal/sheet/toast/banner, and every copy-key family has a board (54 boards, one per screen or sheet, including the adopted dials and the Satchel,
      audited 2026-09-11 from three angles: `app/`, `components/`, `lib/i18n/en.ts`).
- [x] Every board uses only existing tokens (`lib/theme.ts`), the two shipped faces, and the
      Ulzii knot asset; the blackletter face is the one addition and is decided separately.
- [x] Every state a screen has today (waiting, empty, wrong, completed, ended) has a drawn form.
- [x] Every mechanic is unchanged: score deltas, tier thresholds, reveal ladder, ghosting rules,
      budgets, prices. The four product decisions above are the only behaviour questions.
- [ ] The four decisions answered by the user.
- [x] The glyph set drawn as final SVGs (`components/ui/Glyph.tsx`, Wave 1).
- [ ] The hearth, plaza and Hold scenes drawn as final assets or Skia scenes.
- [ ] Mongolian for every new string, from the translator, before any wave is called done for
      an `mn` user (EN ships first; keys go on `AWAITING_MN_TRANSLATION`).
- [x] Waves 1–3 verified on the Galaxy A51 (2026-09-12, 2026-09-13); Wave 4 last.

### Out of scope

Traditional Mongolian script (removed on purpose 2026-09-05); monsters, bats and any creature
outside the Campaign; iron as a dial; a new icon library dependency; any change to score deltas,
thresholds or ghosting rules; the admin panel.

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

- **Sealed Fire Wave 3 leftovers (2026-09-13):** the Frozen Gate's "Shut out on the … dawn" line does
  not tick past midnight while the screen is open (`app/blocked-users.tsx` reads `now` once; the
  Quest Log and the thread use `useNowTicker`); `ShareCharacterButton` shows a stale `share_failed`
  when the preview is reopened without a new attempt; `AscentSky` draws "the sky beyond" above the
  top star for every tier; the campaign's "Boss" chip may be redundant beside the dragon's line;
  `TownSquareControllerIntegrationTests.GetNextSession_UpcomingOpenSession_ReturnsItWithRsvpFlag`
  needs the shared-DB workaround its neighbour has (a seeded Open session sorts before its fixture on
  the dev database; CI is green); `lib/__tests__/i18nCoverage.test.ts` should strip comments from the
  source blob before scanning for key literals (a JSDoc mention currently counts as a reader).

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
  letters and the app's voice (seal rows, the sheet's law, the Seek hint). Decide before Wave 3
  touches either.

This is the whole of it, as of 2026-09-12; the sections below add the detail:

- **The Sealed Fire redesign**, specified under "Open — Not Yet Built" above with a build order in
  four waves. Waves 1 (the kit) and 2 (the thesis) shipped 2026-09-12; Waves 3 (the place) and 4
  (the hearth and the square) are open, and the four product decisions still stand on their
  defaults.
- **Mongolian copy for 87 keys, plus four venue columns.** `AWAITING_MN_TRANSLATION` in
  `lib/i18n/index.ts` holds the Sealed Fire Wave 2 batch (48 keys: the seals, the ledger's day
  headings and ordinals, the clocks' world phrases, the sealed Seek's eyebrow and hint), 11
  world/atlas keys (the hold title, seven room names, the Sound row),
  the report sheet's 17 (`report_*` in `lib/i18n/en.ts`), the 9 narrated long-wait lines
  (`wait_verify_still`, `wait_verify_long`, `wait_quiz_still`, `wait_quiz_long`, `wait_video_still`,
  `wait_video_long`, `wait_square_still`, `wait_square_long`, `quiz_answers_in`), and the 2
  empty-thread lines (`chat_empty_*`). `BusinessPartners` has
  `NameMn`/`CategoryMn`/`DistrictMn`/`DescriptionMn`, all NULL. All of it needs a native speaker;
  none of it may be guessed, and the report sheet least of all. `enableFallback` renders the keys in
  English for an `mn` user; the parity test fails if one is translated and left on the list. This
  is the single largest thing between the app and a Mongolian market.
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
- **The seeded phone numbers (`810000xx`) cannot reach verify.mn** (`POST /auth/phone/start` → 503,
  `81` is not a Mongolian mobile prefix). The dev DB has Undram (`091eadb0…`) on the test SIM
  `88583269` (the throwaway `Khashaa` row's number nulled) so a rich character can be signed into.
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
- **The world below the Gate, on hardware.** Only `(auth)` renders without a backend, so the six
  light signatures, per-room state ramps, the atlas over a real profile and the descend/rise
  transitions have been judged on web only. **The eight sounds have never been heard and no haptic
  has fired on hardware**; the WAVs are synthesised, so their voicing is a guess, and the
  silent-switch behaviour is untested.
- **Never seen on hardware:** the white navigation bar fix (`AppModal`), the collapsed
  getting-started board, the brighter photo dot, the empty-thread state, the design-system wave
  (shared state/dialog surfaces, the five ladders), the waiting vocabulary (narrated waits reaching
  their 8 s/25 s lines, skeletons against the world floor, the knot in a compact button, the
  tab-switch ignite, the row stagger not re-firing on pull-to-refresh), the design-token snap and
  Ulzii ornaments under longer Mongolian labels, and from the creative-effects wave the Gate scene
  (needs a sign-out and a SIM), festival tint and time-of-day light offsets.

## Security & identity

- **The returning-user alias is keyed on the phone the identity proved.** If an aliased user
  later changes their number from that device, the alias stops resolving and the device behaves as
  a fresh identity. An `AuthAliases (Sub → UserId)` table would remove the dependency and save a
  query per request; needs a schema change.
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
