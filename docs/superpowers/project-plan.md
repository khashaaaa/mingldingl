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

**Status:** Waves 1 (the kit) and 2 (the thesis) shipped 2026-09-12 — see `shipped-log.md`.
Waves 3–4 below are open; the four decisions still stand on their defaults.
The one-page report is <https://claude.ai/code/artifact/c2542b0e-1c65-48ec-be04-e85b7caa61d3>
(Export gives the PDF); the working canvas is
<https://claude.ai/code/artifact/0697f213-d884-4ed5-b8b8-e62616403fb1> (pages: *Every screen*,
*The kit*, *Before*; 54 boards, one per screen or sheet, superseded variants removed). Sources are
in the repo under `docs/design/sealed-fire/` (`boards/*.dc.html` + `canvas.json` + `boards.txt`
for the canvas; `report/Main.dc.html` + `report/img/` for the report). Re-seed either with the
`design` skill's helper: `node <helper> --template <payload> --out x.html --title "..." $(cat
boards.txt) --image ... --canvas canvas.json`. Nothing here depends on a session's scratchpad.

**To continue:** Wave 3's task list is below ("Wave 3 — the place"). Its record follows Wave 2's into
`shipped-log.md` when it lands.

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

### Wave 3 — the place (task list, written 2026-09-12)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app a place: fires that visibly burn down and freeze in the Quest Log, the Guild House, the Hall of Names, the Ascent as a night sky, the Campaign as a cave, the keepsake poster — and frost mounted wherever silence is.

**Architecture:** One small engine addition (the thread's last letter time and sender on `MatchResponse`, the two ghosting windows on the thresholds response) feeds one pure helper, `lib/fire.ts`, that every fire surface reads. `FrostEdge` (drawn in Wave 1) is finally mounted. The four room screens are redrawn over their existing hooks and DTOs; no mechanic changes. The keepsake becomes a Wanted poster with a preview.

**Tech Stack:** React Native 0.81 / Expo 54, `react-native-svg` (in the dev build), `react-native-view-shot` + `expo-sharing` (already installed), jest + `@testing-library/react-native`; ASP.NET Core 8 + xUnit.

**Spec:** this file, "The Sealed Fire" section (moves 7, 8, 9's neighbour 11, 10, the Campaign cave, the dials — temperature and law; "Gaps found": ember-on-dark toasts, `FrostEdge` mounted, keepsake exports only the sharer's portrait). Boards: `docs/design/sealed-fire/boards/LettersFrost.dc.html`, `LettersMoments.dc.html`, `GuildHall.dc.html`, `HallOfNames.dc.html`, `AscentSky.dc.html`, `CampaignCave.dc.html`, `Keepsake.dc.html`, `BanishedFrozen.dc.html`, `Toasts.dc.html`, `RiteStates.dc.html`, `FlameRite.dc.html`, `Temperature.dc.html`.

#### Global constraints (every task's requirements include these)

- **English only.** Every new i18n key goes in `lib/i18n/en.ts` *and* `AWAITING_MN_TRANSLATION` in `lib/i18n/index.ts`, never in `mn.ts`. Changing an existing key's English value leaves `mn.ts` alone. A key no longer referenced must be deleted from **both** tables (`i18nCoverage.test.ts`; `i18n.test.ts` for parity). Template-literal key families are written directly inside `i18n.t(` so the coverage test sees them.
- **The law.** Buttons two words at most; short sentences with full stops; the app commands the world and states the law, never scolds the person. Italic (`FONTS.bodyItalic`) is the app speaking; in the chat it is also my own letters — do not change either.
- **Temperature.** Fire is what is alive, answered and kept; frost is silence, absence and what was left. `TEMPERATURE.furnace*` only in the eight allow-listed files (`lib/__tests__/furnace.test.ts` — `app/leaderboard.tsx` is on it); the frost tokens (`rime`, `ice`, `glacier`) and `components/vfx/FrostEdge.tsx` may be used anywhere silence is. The cave belongs to the Campaign only; no creature art anywhere (an illustrator's job — leave the placement, draw nothing sketch-level).
- **The kit's counts are tested:** one `AppCard hero` per file (`hero.test.ts`), one forged `GameButton` per file outside `components/modals/` (`forged.test.ts`), no raw `COLORS` outside `lib/theme.ts` (`palette.test.ts`), every route in a room (`lib/world/__tests__/world.test.ts`). Screen containers stay `backgroundColor: 'transparent'`.
- **Reduced motion:** any new animation goes through `motionAllowed(useVfxLevel())` from `lib/vfx.ts`.
- **Accessibility:** every drawn state (a frost edge, a torch, a star) is either labelled or hidden (`accessible={false}` / `importantForAccessibility="no"`); text carries the meaning.
- **No new native module** (a new EAS build would be needed). `react-native-svg`, `react-native-view-shot`, `expo-sharing`, `expo-haptics`, `expo-audio` are in the build. No `expo-media-library`.
- **No mechanic changes.** Ghosting windows, penalties, thresholds, prices, perks: read from the engine, never re-derived. `lib/fire.ts` only *describes* what the engine will judge.
- **Tests are TZ-safe:** every fixture instant is built from local components (`new Date(y, m-1, d, h)`), never a UTC literal asserted against a local string. The whole-wave review runs the suite under `TZ=UTC`.
- **Verification per task.** App: `cd mingldingl_app && npm test && npm run typecheck && npm run lint`. Engine: `dotnet test` (needs Postgres; `DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet`). Task 1 also runs `./mingldingl_engine/scripts/export-swagger.sh`, both `npm run generate:api`, and `export-swagger.sh --check`.
- **Git:** single branch `master`, no worktree. One commit per task, `git add -A && git commit`, message prefixed `Sealed Fire W3:`. Do not push.
- **Comments** explain *why*, in the repo's register (read three neighbouring files first).

---

### Task 1: The engine says when the last letter was, and by whom

`Match` already stores `LastMessageAt` and `LastMessageSenderId`; `MatchResponse` does not send them, and the app cannot know whose turn it is or how long a thread has been quiet without opening it. The two ghosting windows are admin config the app has never seen.

**Files:**
- Modify: `mingldingl_engine/src/MinglDingl.Engine/DTOs/MatchDto.cs` (`MatchResponse`), `mingldingl_engine/src/MinglDingl.Engine/DTOs/ScoreDto.cs` (`RevealThresholdsResponse`)
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Controllers/MatchesController.cs` (`BuildMatchResponse`), `Controllers/EngagementController.cs` (`GetRevealThresholds`)
- Modify: the existing list-matches integration test (the one Task 1 of Wave 2 extended — grep `CreatedAt` in `tests/MinglDingl.Engine.Tests/Integration/MatchesControllerIntegrationTests.cs`) and the existing reveal-thresholds test (grep `reveal-thresholds` under `tests/`)
- Regenerate: `mingldingl_engine/swagger.json`, `mingldingl_app/lib/api/api.generated.d.ts`, `mingldingl_control/src/lib/api/api.generated.d.ts`
- Modify: `mingldingl_app/models/match.ts`, `mingldingl_app/lib/reveal.ts` (hydrate the two windows beside the activity gate), `mingldingl_app/hooks/useRevealThresholds.ts`
- Test: `mingldingl_app/lib/__tests__/matchModel.test.ts` (extend), `mingldingl_app/lib/__tests__/reveal.test.ts` (extend)

**Interfaces:**
- Produces (engine): `MatchResponse.LastMessageAt: DateTime?`, `MatchResponse.LastMessageSenderId: Guid?` (appended, defaulted null); `RevealThresholdsResponse.GhostingStaleHours: int = 48`, `RevealThresholdsResponse.GhostingUnansweredHours: int = 168` (appended, defaulted; `GhostingService.StaleAfter` / `UnansweredAfter` are instance properties reading `_config`; add `public static TimeSpan StaleAfterFor(ConfigService config)` / `UnansweredAfterFor(ConfigService config)` beside them, make the instance properties delegate, and call the statics from `EngagementController`).
- Produces (app): `Match.lastMessageAt?: string`, `Match.lastMessageSenderId?: string`; `lib/reveal.ts` gains `ghostingWindowsSnapshot(): { staleHours: number; unansweredHours: number }` (defaults 48 / 168), hydrated by `hydrateRevealThresholds(raw, activitySuggestionMessages, ghosting?: { staleHours?: number; unansweredHours?: number })`, and a hook-side `useGhostingWindows()` exported from `hooks/useRevealThresholds.ts` that subscribes like `useRevealLadder`.

- [ ] **Step 1: Engine DTOs.** Append to `MatchResponse`:

```csharp
    DateTime? CreatedAt = null,
    /// <summary>When the last letter was sent and by whom, so the app can say whose turn it is and
    /// how long a fire has been quiet without opening the thread. Null until the first letter.</summary>
    DateTime? LastMessageAt = null,
    Guid? LastMessageSenderId = null);
```

and to `RevealThresholdsResponse`:

```csharp
    int ActivitySuggestionMessages = 15,
    /// <summary>The ghosting windows (<c>ghosting.stale_hours</c>, <c>ghosting.unanswered_hours</c>),
    /// served so the app can show a fire burning down before the engine judges it, in the engine's
    /// own numbers rather than a pinned copy.</summary>
    int GhostingStaleHours = 48,
    int GhostingUnansweredHours = 168);
```

- [ ] **Step 2: Builders.** `BuildMatchResponse` passes `m.CreatedAt, m.LastMessageAt, m.LastMessageSenderId`. `GetRevealThresholds` passes `(int)GhostingService.StaleAfterFor(_config).TotalHours, (int)GhostingService.UnansweredAfterFor(_config).TotalHours`.
- [ ] **Step 3: Tests.** In the list-matches test, after a message has been sent in the fixture (or add one), assert `dto.LastMessageAt` is not null and `dto.LastMessageSenderId` equals the sender; in the thresholds test assert both windows are present and positive. Run the two filtered tests, then `dotnet test`.
- [ ] **Step 4: Regenerate** (`export-swagger.sh`, both `generate:api`, `--check`).
- [ ] **Step 5: App model + hydration.** `models/match.ts`: add the two optional strings and parse them (`d.lastMessageAt ?? undefined`, `d.lastMessageSenderId ?? undefined`). `lib/reveal.ts`: module state `ghosting = { staleHours: 48, unansweredHours: 168 }`, hydrated when the third argument carries positive numbers, notifying listeners; export `ghostingWindowsSnapshot()`. `hooks/useRevealThresholds.ts`: pass `{ staleHours: data.ghostingStaleHours, unansweredHours: data.ghostingUnansweredHours }`; export `useGhostingWindows()` via the same `useSyncExternalStore` pattern as `useRevealLadder`. Tests: `parseMatch` carries and tolerates the two fields; `hydrateRevealThresholds` updates the windows and ignores non-positive ones; `resetRevealThresholdsForTests` resets them.
- [ ] **Step 6: Verify** (`npm test && npm run typecheck && npm run lint`; `cd mingldingl_control && npm run lint && npm run build`). **Commit** — `Sealed Fire W3: the engine says when the last letter was, and by whom`.

---

### Task 2: `lib/fire.ts` — the state of a fire

Pure: given a match, who I am, now, and the engine's windows, what state the fire is in and what the ledger should say. This is description, not judgement: the engine judges.

**Files:**
- Create: `mingldingl_app/lib/fire.ts`
- Modify: `lib/i18n/en.ts`, `lib/i18n/index.ts`
- Test: `mingldingl_app/lib/__tests__/fire.test.ts`

**Interfaces:**
- Consumes: `Match` (`status`, `createdAt`, `lastMessageAt`, `lastMessageSenderId`, `messageCount`), `threadDay`/`ordinalWord` from `lib/worldTime.ts`.
- Produces:
  ```ts
  export type FireState = 'unlit' | 'burning' | 'embers' | 'frozen';
  export interface Fire {
    state: FireState;
    /** true = mine, false = theirs, null = no letter yet */
    myTurn: boolean | null;
    /** local midnights since the last letter (or since the match, when no letter) */
    dawns: number;
    /** the dawn at which the engine judges: floor(staleHours / 24) + 1 (48h → 3) */
    judgedAtDawn: number;
    /** which day of the thread today is (1-based), null without a start */
    day: number | null;
    /** for a frozen fire: whether I am the one who let it (null when nobody ever spoke or the thread was severed, not judged) */
    iLetIt: boolean | null;
    /** 'ghosted' | 'severed' | null — why a fire is frozen */
    frozenBy: 'ghosted' | 'severed' | null;
  }
  export function fireOf(match: Pick<Match, 'status' | 'createdAt' | 'lastMessageAt' | 'lastMessageSenderId' | 'messageCount'>, myId: string | null | undefined, nowMs: number, windows: { staleHours: number; unansweredHours: number }): Fire;
  export function fireLine(fire: Fire): string;      // the one line under the name
  export function fireEyebrow(fire: Fire): string;   // BURNING / EMBERS / FROZEN / (unlit → the existing quest_new)
  ```
  Rules: `status` in `Ghosted` → `frozen`, `frozenBy: 'ghosted'`, `iLetIt = lastMessageSenderId != null && lastMessageSenderId !== myId ? true : lastMessageSenderId === myId ? false : null` (the at-fault party is whoever did *not* send the last letter — `GhostingService.GetGhostAtFaultUserId`); `Unmatched`/`Completed` → `frozen`, `frozenBy: 'severed'`, `iLetIt: null`. Otherwise: no `lastMessageAt` → `unlit`, `myTurn: null`, `dawns` counted from `createdAt`. Else `myTurn = lastMessageSenderId !== myId`; `dawns` = local midnights since `lastMessageAt` (reuse `threadDay(nowIso, lastMessageAt) - 1`); `embers` when `myTurn && dawns >= 1`; else `burning`. `judgedAtDawn = Math.floor(windows.staleHours / 24) + 1`.
  Copy (all EN, awaiting):
  ```ts
  fire_burning: 'Burning', fire_embers: 'Embers', fire_frozen: 'Frozen',
  fire_line_their_turn: '%{day} day. Their turn.',        // day = ordinalWord, capitalised: "Fourth day. Their turn."
  fire_line_my_turn: '%{day} day. Your turn.',
  fire_line_embers: 'Your turn. %{dawns} dawns. Judged at the %{judged}.',   // "Your turn. Two dawns. Judged at the third."
  fire_line_embers_one: 'Your turn. One dawn. Judged at the %{judged}.',
  fire_line_frozen: '%{dawns} dawns of silence. Judged at the %{judged}.',
  fire_line_frozen_they: 'They let it freeze. Their standing paid.',
  fire_line_frozen_you: 'You let it freeze. Your standing paid.',
  fire_line_severed: 'The bond was severed.',
  fire_law: "A fire is judged at dawn. Whoever's turn it was when it froze is the one who let it.",
  fire_embers_strip: 'The fire is down to embers. %{dawns} dawns without a word from you. At the %{judged} it is yours to have let die.',
  ```
  Numbers in words: `dawns` rendered through a small `countWord(n)` (one…twelve, else the numeral) added to `lib/worldTime.ts` (exported), and `judged` through `ordinalWord`. `fireLine` for `frozen` + `ghosted` returns the silence line; the second line (`fire_line_frozen_they/you`) is a separate export `fireVerdict(fire): string | null`.

- [ ] **Step 1: Keys** as above (+ `countWord`'s `count_1..12` keys: one, two, three, four, five, six, seven, eight, nine, ten, eleven, twelve) into `en.ts` and the awaiting list.
- [ ] **Step 2: Failing tests** — with `windows = { staleHours: 48, unansweredHours: 168 }`, local-component instants, `myId = 'me'`:
  - no letters, created 2 days ago → `unlit`, `myTurn null`, `dawns 2`; eyebrow is `quest_new`'s text.
  - last letter by them yesterday → `embers`, `myTurn true`, `dawns 1`, `judgedAtDawn 3`; line "Your turn. One dawn. Judged at the third."
  - last letter by them two days ago → line "Your turn. Two dawns. Judged at the third."
  - last letter by me today, thread started 3 days ago → `burning`, `myTurn false`, line "Fourth day. Their turn."
  - last letter by me, `Ghosted`, five dawns → `frozen`, `iLetIt false`, line "Five dawns of silence. Judged at the third.", verdict "They let it freeze. Their standing paid."
  - last letter by them, `Ghosted` → `iLetIt true`, verdict "You let it freeze. Your standing paid."
  - `Unmatched` → `frozen`, `frozenBy 'severed'`, line "The bond was severed.", verdict null.
  - `staleHours 72` → `judgedAtDawn 4`.
- [ ] **Step 3: Implement**; keep `fireOf` free of React and i18n; `fireLine`/`fireEyebrow`/`fireVerdict` are the only i18n readers.
- [ ] **Step 4: Verify; commit** — `Sealed Fire W3: the state of a fire (helpers)`.

---

### Task 3: Fires that go out — the Quest Log (move 7), frost mounted

**Files:**
- Modify: `components/quest/QuestTile.tsx`, `app/(tabs)/matches.tsx`, `components/vfx/FrostEdge.tsx` (only if a prop is missing), `lib/world/feedback.ts`, `scripts/gen-sounds.js`, `assets/sounds/` (regenerated), `lib/i18n/en.ts`, `lib/i18n/index.ts`
- Test: `components/quest/__tests__/QuestTile.test.tsx` (create or extend), `lib/world/__tests__/feedback.test.ts` (extend)

**Interfaces:** consumes `fireOf`/`fireLine`/`fireEyebrow`/`fireVerdict` (Task 2), `useGhostingWindows` (Task 1), `useMyUserId`, `FrostEdge { edge, length, opacity }`, `Glyph` (`flame`, `ice`), `TEMPERATURE.rime/ice/glacier`, `METAL.ember`.

- [ ] **Step 1: `QuestTile`.** Replace `questStatus` with the fire: the status line becomes a `CardEyebrow`-style eyebrow (`fireEyebrow`) plus the `fireLine` in `FONTS.body` `INK.dim`; `frozen` adds the verdict line in italic. Colours: burning → `ACCENT.bright` eyebrow with a small `flame` glyph; embers → `METAL.ember` eyebrow with the `ember` place mark (`Places` `ember` at `ICON_SIZES.sm`) and the row's hairline tinted `tint(METAL.ember, 0.6)`; frozen → `TEMPERATURE.glacier` eyebrow with the `ice` glyph, a `FrostEdge edge="left" length={ROW_HEIGHT}` absolutely on the row's left edge, the portrait desaturated by a `TEMPERATURE.ice` overlay at 0.35, name in `INK.dim`; unlit → the existing `quest_new` treatment. The tile takes `fire: Fire` as a prop (computed by the list from `fireOf(match, myId, now, windows)`), so the tile stays pure. A11y: the row's label is `${name}. ${eyebrow}. ${line}`; the frost edge and glyphs are hidden.
- [ ] **Step 2: The list.** `matches.tsx` computes `now` once per render (a 60 s interval — dawns change at midnight, not every second), `myId` from `useMyUserId`, `windows` from `useGhostingWindows`, and passes `fire`. Sort stays as the engine's. Below the list (as `ListFooterComponent`) the law: `fire_law` in italic, `INK.dim`, centred, `SPACE.lg` padding. Empty state unchanged.
- [ ] **Step 3: The fire dying.** `lib/world/feedback.ts`: add `fireDying: { haptic: 'soft', sound: require('../../assets/sounds/dying.wav') }` to `WorldEvent`/`SIGNALS`. `scripts/gen-sounds.js`: add `dying()` — a low crackle (lowpass noise at 240 Hz, seed of your choice) under a 90 Hz sine, 0.6 s, both decaying with `k = 7`, amplitude 0.5 — following the file's own conventions; rerun it and commit the regenerated WAVs (all of them will be byte-identical except the new one; if the script rewrites others differently, stop and report). The signal fires in Task 4, not here; the feedback test asserts the row exists and loads nothing until sound is on.
- [ ] **Step 4: Tests.** `QuestTile`: renders each of the four fires with the right eyebrow/line; the frost edge is present only when frozen (`getByTestId('frost-edge-left')`), the ember mark only when embers; the a11y label carries eyebrow and line. Fixtures with local-component instants. `matches.tsx` test if one exists: the law footer renders.
- [ ] **Step 5: Verify; commit** — `Sealed Fire W3: fires that go out — the Quest Log burns, embers, freezes`.

---

### Task 4: The thread knows its fire — embers strip, frozen ending

**Files:**
- Modify: `app/chat/[matchId].tsx`, `hooks/useFireDying.ts` (create), `lib/i18n/en.ts`, `lib/i18n/index.ts`
- Test: `app/chat/__tests__/[matchId].test.tsx` (extend), `hooks/__tests__/useFireDying.test.tsx` (create)

- [ ] **Step 1: Embers strip.** Above the composer (inside the `KeyboardAvoidingView`, after the list, before `MessageInput`), when `fire.state === 'embers'`: a one-row parchment strip — `DialogStrip` is a modal surface, so draw an inline row: 2px top rule in `tint(METAL.ember, 0.6)`, `SURFACE.panel` at 0.6, the `ember` place mark at `ICON_SIZES.sm`, and `fire_embers_strip` (`dawns` via `countWord`, `judged` via `ordinalWord`) in italic `INK.primary`. `testID="embers-strip"`.
- [ ] **Step 2: Frozen ending.** The existing `endedNotice` gains a `FrostEdge edge="top" length={width}` along its top (absolute; measure width with `onLayout`, hidden from a11y) and its text becomes: ghosted → `fireLine(fire)` + `fireVerdict(fire)` (two lines; the verdict in italic), severed → the existing `match_ended_notice`. The `AlertModal` for `endedReason === 'ghosted'` keeps its title; its message becomes `fireVerdict(fire) ?? match_quiet_body`.
- [ ] **Step 3: `useFireDying(matchId, fireState)`** — fires `signal('fireDying')` once per match when the thread is first seen at `embers` (a `useRef<Set<string>>` like `useSealedLetter`'s `opened`). Test: fires once for embers, never for burning, not again on rerender.
- [ ] **Step 4: Tests.** Chat screen: a match whose last letter is theirs from two local days ago renders the embers strip with "Two dawns"; a `Ghosted` match renders the frost edge and both lines. Both fixtures local-component instants; `staleHours` from the hydrated default.
- [ ] **Step 5: Verify; commit** — `Sealed Fire W3: the thread knows its fire`.

---

### Task 5: Frost wherever silence is — the Frozen Gate, the road out, the War Room; ember toasts checked

**Files:**
- Modify: `app/blocked-users.tsx`, `components/OfflineBanner.tsx`, `app/settings.tsx` (header only), `components/modals/LootToast.tsx`, `lib/__tests__/palette.test.ts`, `lib/i18n/en.ts`, `lib/i18n/index.ts`
- Test: `app/__tests__/blockedUsers.test.tsx` (create), `components/__tests__/OfflineBanner.test.tsx` (create or extend)

- [ ] **Step 1: The Frozen Gate.** `blocked_users_title` → `'The Frozen Gate'` (EN value change), new `frozen_gate_sub: 'Names shut out in the cold. They cannot see you, summon you, or find you in the square.'` (italic under the header), each row: name, a line `shut_out_dawn: 'Shut out on the %{day} dawn'` (`ordinalWord(threadDay(nowIso, item.blockedAt))` — `BlockedUserResponse.BlockedAt` exists and `models/blockedUser.ts` parses it as `blockedAt`), the ink button `unblock` → `'Thaw'`; a `FrostEdge edge="left"` on each row (hidden from a11y). Empty: `blocked_users_empty` → `'No one is shut out. The gate is warm.'` on the `door` place drawing (`StateBlock icon="door"`).
- [ ] **Step 2: The road out.** `OfflineBanner`: `offline_banner` → `'The road is out. What is here stays; nothing new arrives until it returns.'`; the `ice` glyph at `ICON_SIZES.sm` before the text; a `FrostEdge edge="bottom"` along its lower edge; colours `TEMPERATURE.rime` text on the existing dark strip (check ≥ 4.5:1 in the palette test below). Keep `accessibilityLiveRegion`.
- [ ] **Step 3: The War Room.** `settings.tsx`: a `FrostEdge edge="top" length={width}` under the `HeaderBar`'s divider (absolute, measured, hidden from a11y). Nothing else changes.
- [ ] **Step 4: Ember toasts.** `LootToast`: the leading mark becomes the `flame` glyph in `METAL.ember` (was whatever icon it used); `palette.test.ts` gains assertions `contrast(METAL.ember, SURFACE.panel) >= 3` (a glyph is non-text) and `contrast(TEMPERATURE.rime, <the offline strip's background token>) >= 4.5`. If either fails, choose the nearest passing rung (`furnaceBright` is not allowed in these files; `ACCENT.bright` or `INK.primary` are) and say so in the report.
- [ ] **Step 5: Tests; verify; commit** — `Sealed Fire W3: frost wherever silence is`.

---

### Task 6: The Guild House (move 8)

**Files:**
- Modify: `app/membership.tsx`, `lib/i18n/en.ts`, `lib/i18n/index.ts`
- Test: `app/__tests__/membership.test.tsx` (create; mock `useMembership` with three tiers and the engine's price options)

**Interfaces:** consumes `useMembership()` unchanged (`tiers`, `currentLevel`, `upgrade`, `isUpgrading`), `MEMBERSHIP_METALS`, `ChoiceRow`, `AppCard hero`, `GameButton`.

- [ ] **Step 1: Keys** (EN, awaiting): `guild_house: 'The Guild House'`, `guild_house_sub: 'You stand in the yard. The doors above are open to anyone who pays the keep.'` (the sub changes with the floor you stand on: `guild_house_sub_hall: 'You sit in the Hall. The High Table is one door up.'`, `guild_house_sub_high: 'You sit at the High Table. There is nothing above.'`), `floor_Free: 'The Yard'`, `floor_Silver: 'The Hall'`, `floor_Gold: 'The High Table'`, `you_are_here: 'You are here'`, `price_a_month: '₮%{price} a month'`, `perk_summons_night: '%{count} summons a night.'`, `climb_to: 'Climb to %{floor}'`, `guild_terms: 'One month, three or six. Nothing changes below you.'`. EN value changes on existing keys: `perk_deep_profile_view: 'The deep profile.'`, `perk_priority_matching: 'First seat when the pairing is drawn.'`, `perk_icebreakers_quizzes: 'The fire, icebreakers and trials.'`, `perk_basic_profile: 'Everything that matters is free.'`. Delete `guild_ranks`/`guild_ranks_sub`/`current_rank` from both tables if orphaned.
- [ ] **Step 2: The building.** One `AppCard hero` holds three floors stacked top-to-bottom: High Table, Hall, Yard — each a row with the floor name in `FONTS.display`, the price line (`price_a_month` with `monthlyPriceMnt.toLocaleString()`; the Yard has none), the perks as one sentence run (`perk_summons_night` with `dailyMatches` + the tier's `featureKeys` mapped through `perk_*`, joined with spaces), and on the floor you stand on a `you_are_here` eyebrow in the tier's `MEMBERSHIP_METALS` colour; floors above you are lit (`INK.primary`), floors below dim (`INK.dim`). Hairlines between floors; no second card. Tapping a floor above you selects it (`accessibilityRole="button"`, `accessibilityState={{ selected }}`).
- [ ] **Step 3: The climb.** Below the building: the duration `ChoiceRow` (unchanged behaviour) with `guild_terms` in italic under it, then one forged `GameButton` `climb_to` (floor name) → `upgrade(selectedTier, duration)`; when you already stand on the top floor the button is absent and the sub says so. Errors keep the existing `AlertModal`. `membership_active_until` line stays (through `formatDate`).
- [ ] **Step 4: Tests.** Renders three floors in order; the Yard shows "You are here" for a Free member; the button reads "Climb to The Hall" when the Hall is selected and calls `upgrade('Silver', 1)`; a Gold member sees no button.
- [ ] **Step 5: Verify; commit** — `Sealed Fire W3: the Guild House`.

---

### Task 7: The Hall of Names (move 11)

**Files:**
- Create: `lib/numerals.ts` (`romanNumeral(n: number): string` — 1..3999, tests for 1, 4, 9, 14, 40, 90, 400, 1994, 3999)
- Modify: `app/leaderboard.tsx`, `lib/i18n/en.ts`, `lib/i18n/index.ts`
- Test: `lib/__tests__/numerals.test.ts`, `app/__tests__/leaderboard.test.tsx` (create; mock `useLeaderboard`)

- [ ] **Step 1: Keys**: `hall_of_names: 'Hall of Names'`, `hall_sub: '%{city}. Carved, not listed. Names are hidden by the rules of the house, so the stone holds sigils.'`, `your_mark: 'Your mark'`, `hall_law: 'The wall reads highest to lowest. Yours is the only torch.'`. `leaderboard_title` (with `%{city}`) becomes unused → delete from both tables; `leaderboard_you` likewise if unused after this.
- [ ] **Step 2: The wall.** Header `hall_of_names` (blackletter, Latin); `hall_sub` italic under it. Rows are stone: `romanNumeral(rank)` in `FONTS.display` `FONT_SIZES.lg` `INK.dim`, the tier as a `GemTierBadge size={BADGE_SIZES.row}` plus the tier name in `FONTS.utility` uppercase, the score `toLocaleString()` in `FONTS.display` right-aligned; hairlines between rows, `SURFACE.raised` at 0.4 as the stone. Your row: a `TorchGlow` (`components/vfx/TorchGlow`, `strength 0.8`, `color TEMPERATURE.furnaceBright` — this file is on the furnace allowlist) behind the row and the eyebrow `RUBY · YOUR MARK` (tier name + `your_mark`, uppercase, `TEMPERATURE.furnace`). The detached own-row-beyond-50 behaviour stays. Footer: `hall_law` italic centred. A11y: each row's label is `${numeral}. ${tier}. ${score} points` and your row appends `your_mark`.
- [ ] **Step 3: Tests.** Renders numerals I, II, III for ranks 1–3; your row carries "Your mark"; the sub carries the city.
- [ ] **Step 4: Verify; commit** — `Sealed Fire W3: the Hall of Names`.

---

### Task 8: The Ascent as a night sky

**Files:**
- Create: `components/progression/AscentSky.tsx`
- Modify: `app/progression.tsx`, `lib/i18n/en.ts`, `lib/i18n/index.ts`
- Test: `components/progression/__tests__/AscentSky.test.tsx`

**Interfaces:**
- Consumes: `TIER_ORDER` and a new `export function tierThresholdsSnapshot(): readonly number[]` added to `lib/tiers.ts` (the module keeps `tierThresholds` private today; `tierProgress` reads it), `GEM_COLORS`/`GEM_SHADES`, `NIGHT` tokens, `react-native-svg`, `useVfxLevel`/`motionAllowed`.
- Produces: `AscentSky({ gemTier, totalScore, currentStreak, width }: { gemTier: GemTier; totalScore: number; currentStreak: number; width: number })`.

- [ ] **Step 1: Keys**: `ascent_sub: 'The tiers as a climb through the night sky. Each gem is a star you reach; the one you hold burns brightest.'`, `ascent_you: 'you, %{score}'`, `ascent_to_go: '%{points} to go'`, `ascent_beyond: 'the sky beyond'`, `ascent_dawns: 'dawns in a row'`.
- [ ] **Step 2: The sky.** An `Svg` `width × 420`: background gradient `NIGHT.black → NIGHT.blue`; a faint path (`LINE.edge`, dashed) climbing from bottom-left to top-right through six points; at each point a star: an `r=4` circle in the gem's `GEM_COLORS` for tiers at or below yours (reached), `r=3` in `INK.muted` for tiers above; your tier's star is `r=7` with a soft halo (a second circle at `r=14`, opacity 0.25) and, when motion is allowed, a slow opacity pulse via `Animated` (2.4 s, no native driver needed for SVG props — use `Animated.createAnimatedComponent(Circle)` or a plain `useEffect` interval at reduced cost; if that is awkward, a static halo is acceptable and say so). Labels beside each star (`SvgText`, `FONTS.utility`): `Garnet`, `Opal · 100`, … (name · threshold), yours `Ruby · you, 1,595`, the next `Emerald · 405 to go`; above the top star, `ascent_beyond` in `INK.muted` italic. Under the sky, in RN `Text`: the streak as a big numeral (`FONT_SIZES.display`) with `ascent_dawns` under it. The component is `accessible` with a label `${tierName}. ${score}. ${next ? toGo : beyond}. ${streak} dawns in a row`.
- [ ] **Step 3: The screen.** `progression.tsx`: header stays `progression_title` ("The Ascent"); the hero becomes `AppCard hero` wrapping `AscentSky` (measure width with `onLayout`); remove `XPBar` and the `GemTierBadge` hero (the sky carries both); keep `TierPerkCard` (as a plain row), `StreakSummary` is replaced by the sky's streak (delete the component if this was its only site — grep; otherwise leave it), the `view_leaderboard` button becomes ink and reads `hall_of_names`, then the chronicle as before.
- [ ] **Step 4: Tests.** Six stars render (`getAllByTestId('ascent-star')`), the held tier's star carries `testID="ascent-star-held"`, the labels for the next tier read "405 to go" for the fixture (Ruby at 1,595 with Emerald at 2,000), and the a11y label carries the streak.
- [ ] **Step 5: Verify; commit** — `Sealed Fire W3: the Ascent as a night sky`.

---

### Task 9: The Campaign as a cave

**Files:**
- Modify: `app/campaign/[matchId].tsx`, `lib/i18n/en.ts`, `lib/i18n/index.ts`
- Test: `app/campaign/__tests__/campaign.test.tsx` (create; mock `useCampaign`)

- [ ] **Step 1: Copy.** EN value changes: `campaign_room_gate: 'The Meeting Cave'`, `campaign_room_echoes: 'The Hall of Echoes'`, `campaign_room_voices: 'The Gate of Voices'`, `campaign_hint_runes: 'Both face the trial. The bats are listening.'`, `campaign_claim: 'Claim'` (the call site already appends ` +${room.bonusScore}`; tighten it to one space so it reads "Claim +5"), `campaign_room_sealed: 'sealed'`. New: `campaign_sub: 'Seven caverns. The dragon at the last threshold.'`, `campaign_dragon_sleeps: 'It sleeps until the sixth cavern is cleared.'`, `campaign_frame_owed: ''` — no: draw nothing for the frame; leave a `{/* cave frame and dragon: illustrator's job (CampaignCave board); placement is this column */}` comment instead.
- [ ] **Step 2: The caverns.** Each room row: `romanNumeral(index + 1)` (Task 7's helper) in `FONTS.display` `INK.dim` at the left, the name, and the state: cleared+unclaimed → the claim as the screen's one forged button *only on the first claimable room*, ink on any others (the rule is one forged per screen; the first claimable is the deed); cleared+claimed → `campaign_claimed` in `INK.dim`; current → the hint in italic (`FONTS.bodyItalic`); locked → ` · sealed` appended to the name in `INK.muted` (no lock icon). The boss row shows `campaign_dragon_sleeps` in italic while locked. The `TorchGlow` already in the room's light stays; add a `FogDrift` at the top of the list if not present (the room already has `vfx: 'fog'` — check `WorldFloor` draws it and do not double it).
- [ ] **Step 3: Tests.** Seven rows in order with numerals I–VII; exactly one `primary` button when two rooms are claimable; the boss row shows the sleeping line while locked.
- [ ] **Step 4: Verify** (`forged.test.ts` counts per file: if the claim button is rendered in a loop, the scanner sees one call site — the runtime rule above is what the test in Step 3 guards); **commit** — `Sealed Fire W3: the Campaign as a cave`.

---

### Task 10: The keepsake card (move 10)

**Files:**
- Modify: `components/cards/CharacterCard.tsx`, `components/cards/ShareCharacterButton.tsx`, `app/(tabs)/profile.tsx` (pass `oath`), `lib/i18n/en.ts`, `lib/i18n/index.ts`
- Test: `components/cards/__tests__/ShareCharacterButton.test.tsx` (create), `components/cards/__tests__/CharacterCard.test.tsx` (create)

**Interfaces:** `CharacterCard` gains `oath: Oath | null` and `oathProven: boolean`; `ShareCharacterButton` gains the same two props and a preview.

- [ ] **Step 1: Keys**: `wanted: 'Wanted'`, `wanted_for: 'For %{oath}, honestly kept'`, `wanted_for_none: 'For a fire, honestly kept'`, `keepsake_line: '%{dawns} dawns and burning. Never let a fire die.'`, `keepsake_line_none: 'A fire lately lit. Never let it die.'`, `post_it: 'Post it'`, `keep_it: 'Keep it'`, `keepsake_preview: 'Your keepsake'`. `share_character` stays as the button.
- [ ] **Step 2: The poster.** `CharacterCard` (360×520, captured off-screen as today): parchment ground (`SURFACE.raised` under a `LinearGradient` to `SURFACE.panel`), `wanted` in `FONTS.wordmark` at `FONT_SIZES.roomName` centred at the top, the `wanted_for` eyebrow (`oathLabel(oath)` uppercase; `wanted_for_none` without an oath), the portrait in a `RADIUS.sm` frame with the knot at its corner, the name in `FONTS.display`, `GEM · SCORE` eyebrow (tier name · `totalScore.toLocaleString()`), the streak line in italic (`keepsake_line` with `countWord(currentStreak)`, or `_none` at 0), the wordmark small at the foot, and a wax `SealDots`-style single seal (reuse `Glyph name="seal"` in `METAL.gold`) at the bottom-right. **The portrait is the sharer's own**: the component receives `photoUrl` only from the signed-in profile (`profile.tsx`) — assert in the test that `ShareCharacterButton` renders the card with exactly the `photoUrl` it was given and nothing from a match.
- [ ] **Step 3: The preview.** `ShareCharacterButton`: tapping the ink button opens an `AppModal` (full-screen ceremony scrim, `SCRIM.ceremony`) showing the live `CharacterCard` scaled to fit (`transform: [{ scale }]` from the measured width), with one forged `post_it` (capture + `Sharing.shareAsync`, errors as today) and an ink `keep_it` that closes the preview. The off-screen `ViewShot` stays the capture source (the preview is a second render of the same props). Keep `share_failed`/`share_unavailable`.
- [ ] **Step 4: Tests.** The preview opens on the button, shows "Wanted" and the oath eyebrow, "Post it" calls the mocked `Sharing.shareAsync` with the captured uri (mock `react-native-view-shot`'s `capture`), "Keep it" closes it; the portrait is the given `photoUrl`.
- [ ] **Step 5: Verify; commit** — `Sealed Fire W3: the keepsake card`.

---

### Task 11: The Flame Rite's five states, in the voice

**Files:**
- Modify: `components/FlameRiteCard.tsx`, `app/video/[matchId].tsx`, `lib/i18n/en.ts`, `lib/i18n/index.ts`
- Test: `components/__tests__/FlameRiteCard.test.tsx` (create or extend), `app/video/__tests__` (extend only if a test exists)

- [ ] **Step 1: Copy** (EN value changes on existing keys; `mn.ts` untouched): `rite_explainer: 'Five minutes by the fire before you meet. Ask, and they answer.'` (drop `%{minutes}` only if the call site can pass it unchanged — variable parity with `mn` must hold, so keep `%{minutes}` and write `'%{minutes} minutes by the fire before you meet. Ask, and they answer.'`), `rite_propose_cta: 'Ask'`, `rite_waiting: 'You have asked. A candle until they answer.'`, `rite_incoming: 'They have asked for it.'`, `rite_ready: 'The rite is open. Step in when you are both ready.'`, `start_video_call: 'Step in'`, `rite_complete: 'Flame-tested'` + new `rite_complete_sub: 'Two faces met across the glass. The seal on the likeness is gone for good.'`, `video_end_confirm_title: 'Douse the fire?'`, `video_end_confirm_body: 'Dousing ends the rite for both of you. It cannot be relit.'`, `video_end_confirm: 'Douse it'`, `video_connect_error_title: 'The way would not open.'`, `video_connect_error_body: 'We could not connect the call. Try again, or go back to the thread; nothing was lost.'`, new `rite_try_again: 'Try again'` for the video screen's retry (`rejoin` stays as the Square round's "Rejoin").
- [ ] **Step 2: The card.** Waiting state shows the `Waiting` candle (`components/ui/Waiting`) beside `rite_waiting`; the complete state shows the `flame` glyph in `METAL.ember` and the new sub in italic; the incoming state's two buttons: ink `rite_decline_cta` ("Not yet"), forged `rite_accept_cta` ("Accept") — one forged per file holds because the propose/ready/incoming states are exclusive branches — add the file to `forged.test.ts`'s `BRANCHED` set with the branches named if the scanner counts more than one.
- [ ] **Step 3: The call.** `video/[matchId].tsx`: the `candle` glyph (`Glyph name="candle"`, `ICON_SIZES.lg`, `METAL.ember`) beside the m:ss countdown; the hang-up button's confirm uses the new copy. No countdown format change.
- [ ] **Step 4: Tests; verify; commit** — `Sealed Fire W3: the Flame Rite's five states, in the voice`.

---

### Task 0 — the Wave 3 list ends here

(Sentinel heading for the brief-extraction script. After Task 11 the controller runs the final whole-wave review under `TZ=UTC`, the A51 device pass, moves this list's record into `shipped-log.md`, and pushes.)

**Deliberately left for Wave 4 (write into the shipped record):** the hearth, the plaza, the Second Bell, the Satchel, candle-lit and bell feedback rows; the cave frame and the dragon and the bats (illustrator); a Cyrillic blackletter; White Moon frost for three days (needs the festival calendar's hook — check `lib/festivals.ts` before Wave 4).


### Gaps found while writing the report (settle before the wave that touches them)

- Mongolian strings run 20–40% longer than English; chips, eyebrows and plaza labels need a
  Mongolian width pass (chips and eyebrows done in Wave 2; Wave 4 for the plaza).
- Sound and haptics: `lib/world/feedback.ts` gains seal break, candle lit, bell, fire dying
  (Wave 2 and 4). Sound stays opt-in.
- Reduced motion: the new ceremonies and the hearth's embers must respect the existing switch.
- Contrast: the blackletter face read at 44px on the A51 (Wave 1, done); ember-on-dark toasts still need the check (Wave 3).
- Accessibility labels for every glyph and seal (glyphs done in Wave 1: labelled = image role, unlabelled = hidden; seals done in Wave 2).
- The keepsake card must export only the sharer's own portrait (Wave 3).
- "Deleted User" and "Unknown" (`deleted_user`, `unknown_name`) still appear as names in threads and
  on the wall; in the voice they are "A name struck" and "A sealed one" (done in Wave 2, EN only).
- Admin panel and web build are out of scope; web renders the new screens without Skia, as today.

### Build order (waves; each ends committed, pushed, CI green, device-checked on the A51)

- **Wave 1 — the kit, no behaviour change.** Shipped 2026-09-12 (`shipped-log.md`).
- **Wave 2 — the thesis.** Shipped 2026-09-12 (`shipped-log.md`).
- **Wave 3 — the place.** Embers and frost in the Quest Log from the ghosting state the engine
  already exposes; the Guild House; the Hall of Names; the Ascent as a night sky; the Campaign as a
  cave (the cave frame and the dragon need an illustrator; placement is drawn); the keepsake card
  via the existing share button.
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
- [x] Waves 1 and 2 verified on the Galaxy A51 (2026-09-12); Wave 3 before Wave 4.

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
