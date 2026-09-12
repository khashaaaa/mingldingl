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

**Status:** Wave 1 (the kit) shipped 2026-09-12 — see `shipped-log.md`. Waves 2–4 below are
open; the four decisions still stand on their defaults.
The one-page report is <https://claude.ai/code/artifact/c2542b0e-1c65-48ec-be04-e85b7caa61d3>
(Export gives the PDF); the working canvas is
<https://claude.ai/code/artifact/0697f213-d884-4ed5-b8b8-e62616403fb1> (pages: *Every screen*,
*The kit*, *Before*; 54 boards, one per screen or sheet, superseded variants removed). Sources are
in the repo under `docs/design/sealed-fire/` (`boards/*.dc.html` + `canvas.json` + `boards.txt`
for the canvas; `report/Main.dc.html` + `report/img/` for the report). Re-seed either with the
`design` skill's helper: `node <helper> --template <payload> --out x.html --title "..." $(cat
boards.txt) --image ... --canvas canvas.json`. Nothing here depends on a session's scratchpad.

**To continue:** Wave 2's task list is below ("Wave 2 — the thesis"). Its record follows Wave 1's into
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

### Wave 2 — the thesis (task list, written 2026-09-12)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the three differentiators *felt*: the candidate arrives sealed, the chat is a ledger of letters with seal-break rows, the lock screen and the clocks speak in the app's voice.

**Architecture:** Pure helpers first (`lib/worldTime.ts`, `lib/letters.ts`) so every rendering task is a thin view over tested functions. The chat's reveal strip becomes a seal-dots row in the header plus a parchment sheet; the bubble becomes a ledger row; the send button becomes a wax seal. The engine changes twice, both small: `MatchResponse.CreatedAt` (day headings) and the English `PushCopy` table. Nothing about score, thresholds, the ladder, budgets or ghosting changes.

**Tech Stack:** React Native 0.81 / Expo 54, `react-native-svg` (already in the dev build), jest + `@testing-library/react-native`; ASP.NET Core 8 + xUnit.

**Spec:** this file, "The Sealed Fire" section above (the fourteen moves 1, 2, 13, 14; the dials; "Gaps found"; "Build order — Wave 2"). Boards: `docs/design/sealed-fire/boards/FireFurnace.dc.html`, `ChatLedger.dc.html`, `LettersMoments.dc.html`, `Seals.dc.html`, `Unsealing.dc.html`, `Voice.dc.html`, `WorldTime.dc.html`, `Glyphs.dc.html`, `Components.dc.html`.

#### Global constraints (every task's requirements include these)

- **English only.** Every new i18n key is added to `lib/i18n/en.ts` *and* to `AWAITING_MN_TRANSLATION` in `lib/i18n/index.ts`, never to `mn.ts`. Changing the English *value* of an existing key is allowed and leaves `mn.ts` alone. Never write a Mongolian string. A key no longer referenced anywhere must be deleted from **both** `en.ts` and `mn.ts` (`lib/__tests__/i18nCoverage.test.ts` fails on orphans; `lib/__tests__/i18n.test.ts` enforces parity and that awaiting keys are absent from `mn`).
- **The law.** Buttons two words at most; sentences short, with full stops; the app commands the world and states the law, never scolds the person. Italic is the app speaking (`FONTS.bodyItalic`, added in Task 6); roman is the person.
- **The kit's counts are tested.** One `AppCard hero` per file (`lib/__tests__/hero.test.ts`), one forged `GameButton` (`primary` / no variant) per file outside `components/modals/` (`lib/__tests__/forged.test.ts`), no raw `COLORS` outside `lib/theme.ts` (`palette.test.ts`), `TEMPERATURE.furnace*` only in the eight allow-listed files (`furnace.test.ts` — `CandidateCard.tsx` and `discover.tsx` are on it; `components/chat/**` is not).
- **Screens are transparent** (`backgroundColor: 'transparent'` on containers — the world floor paints). Every route already exists; no new route in this wave.
- **Reduced motion:** any new animation goes through `motionAllowed(useVfxLevel())` from `lib/vfx.ts`, as `SealedLetter` does.
- **Accessibility:** every seal drawn has an `accessibilityLabel`; a decorative glyph has none (the `Glyph` component hides an unlabelled one).
- **No new native module.** `react-native-svg`, `expo-image`, `expo-linear-gradient`, `expo-haptics`, `expo-audio` are already in the dev build. A new one would force a new EAS build — do not add one.
- **No mechanic changes.** Reveal ladder, mutual-count formula, score deltas, budgets, ghosting: untouched.
- **Verification per task.** App tasks: `cd mingldingl_app && npm test && npm run typecheck && npm run lint` all clean. Engine tasks: `cd mingldingl_engine && dotnet test` green (needs local Postgres on 5432; `DOTNET_ROOT=$HOME/.dotnet`, `$HOME/.dotnet/dotnet`). Task 1 also runs `./mingldingl_engine/scripts/export-swagger.sh` and both frontends' `npm run generate:api` and commits all three.
- **Git:** single branch `master`, no worktree, no branches. Each task ends in one commit (`git add -A && git commit`), message prefixed `Sealed Fire W2:`. Do not push; the controller pushes at the end of the wave.
- **Comments in code** explain *why*, in the repo's existing register (read three neighbouring files before writing one).

---

### Task 1: `MatchResponse.CreatedAt` — the thread knows its first day

The chat's day headings ("The third day") count from the day the match was made. The app has no such date today.

**Files:**
- Modify: `mingldingl_engine/src/MinglDingl.Engine/DTOs/MatchDto.cs` (`MatchResponse` record)
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Controllers/MatchesController.cs` (`BuildMatchResponse`)
- Modify: the existing integration test that lists matches (grep `tests/MinglDingl.Engine.Tests/Integration` for `/matches` and `MatchResponse`; add the assertion there — do not create a new test class)
- Regenerate: `mingldingl_engine/swagger.json`, `mingldingl_app/lib/api/api.generated.d.ts`, `mingldingl_control/src/lib/api/api.generated.d.ts`
- Modify: `mingldingl_app/models/match.ts` (`Match.createdAt`, `parseMatch`)
- Test: `mingldingl_app/lib/__tests__/matchModel.test.ts` (create)

**Interfaces:**
- Produces: `Match.createdAt: string | undefined` (ISO, UTC from the engine) — read by Task 4 (`letterMarks`) and Task 7 (chat screen).

- [ ] **Step 1: Add the field at the end of the record, defaulted, so no positional caller breaks**

```csharp
public record MatchResponse(
    Guid MatchId,
    Guid OtherUserId,
    string Status,
    int RevealLevel,
    int MessageCount,
    bool IcebreakerComplete,
    bool VideoCallUnlocked,
    PartialUserProfile OtherUser,
    string? WeaverDisplayName = null,
    Guid? FlameRiteProposedById = null,
    DateTime? FlameRiteProposedAt = null,
    DateTime? FlameRiteAcceptedAt = null,
    DateTime? FlameRiteCompletedAt = null,
    int FlameRiteDurationMinutes = 5,
    bool FlameRiteRequired = true,
    bool VideoEnabled = true,
    /// <summary>
    /// When the match was made. The app's letters count their days from it ("The third day"), so
    /// a thread's first heading is the day of the summons, not the day of the first word.
    /// </summary>
    DateTime? CreatedAt = null);
```

- [ ] **Step 2: Pass it in `BuildMatchResponse`** — append `, m.CreatedAt` as the last argument after `_config.GetBool("video.enabled", true)`.

- [ ] **Step 3: Assert it in the existing list-matches integration test** — after the response is deserialised, add:

```csharp
Assert.NotNull(dto.CreatedAt);
```

(`dto` being whatever that test already calls the parsed `MatchResponse`; if the test reads raw JSON, assert the `createdAt` property is present and non-null.)

- [ ] **Step 4: Run engine tests**

Run: `cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter FullyQualifiedName~Matches`
Expected: PASS.

- [ ] **Step 5: Regenerate the contract**

```bash
./mingldingl_engine/scripts/export-swagger.sh
(cd mingldingl_app && npm run generate:api)
(cd mingldingl_control && npm run generate:api)
./mingldingl_engine/scripts/export-swagger.sh --check
```

- [ ] **Step 6: Write the failing app test**

`mingldingl_app/lib/__tests__/matchModel.test.ts`:

```ts
import { parseMatch } from '../../models/match';

describe('parseMatch', () => {
  it('carries the day the match was made, and tolerates its absence', () => {
    const base = { matchId: 'm', otherUserId: 'u', status: 'Active', otherUser: {} };
    expect(parseMatch({ ...base, createdAt: '2026-09-10T02:00:00Z' } as never).createdAt).toBe('2026-09-10T02:00:00Z');
    expect(parseMatch(base as never).createdAt).toBeUndefined();
  });
});
```

Run: `cd mingldingl_app && npx jest lib/__tests__/matchModel.test.ts` — Expected: FAIL (`createdAt` is not a known property / undefined).

- [ ] **Step 7: Add the field to the model**

In `models/match.ts`, inside `interface Match` after `videoEnabled`:

```ts
  /** ISO time the match was made; the letters count their days from it. Absent from older caches. */
  createdAt?: string;
```

and in `parseMatch`, after `videoEnabled: d.videoEnabled ?? true,`:

```ts
    createdAt: d.createdAt ?? undefined,
```

- [ ] **Step 8: Verify** — `cd mingldingl_app && npm test && npm run typecheck && npm run lint`; `cd mingldingl_control && npm run lint && npm run build`.

- [ ] **Step 9: Commit** — `git add -A && git commit -m "Sealed Fire W2: MatchResponse.CreatedAt, the thread knows its first day"`.

---

### Task 2: `PushCopy` English in the voice (move 14)

**Files:**
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Services/PushCopy.cs` (`English(...)` only)
- Modify: `mingldingl_engine/tests/MinglDingl.Engine.Tests/Integration/PushNotificationServiceIntegrationTests.cs` (three literal assertions: lines asserting `"New Match!"` and `"Bat sent you a summons."`)
- Modify: `mingldingl_engine/tests/MinglDingl.Engine.Tests/Services/PushCopyTests.cs` (add the law test)

**Interfaces:** none new. Wire types, placeholders (`{0}` sender name for `NewMatch`; `{0}` name / `{1}` body for `NewMessage`) and the Mongolian table are unchanged.

- [ ] **Step 1: Write the failing law test** in `PushCopyTests.cs`:

```csharp
    /// <summary>
    /// The lock screen is the one place the app speaks outside its own walls, so it speaks the
    /// way it does inside: short sentences that end, no exclamation, the world commanded and the
    /// law stated. NewMessage is the sender's own words and is exempt.
    /// </summary>
    [Fact]
    public void EnglishCopy_SpeaksInTheVoice()
    {
        foreach (PushKind kind in Enum.GetValues<PushKind>())
        {
            if (kind == PushKind.NewMessage) continue;
            var (title, body) = PushCopy.For(kind, "en", "Bat");
            Assert.DoesNotContain("!", title);
            Assert.DoesNotContain("!", body);
            Assert.EndsWith(".", title);
            Assert.EndsWith(".", body);
            Assert.True(title.Split(' ').Length <= 4, $"{kind} title is not short: \"{title}\"");
        }
    }
```

Run: `dotnet test --filter EnglishCopy_SpeaksInTheVoice` — Expected: FAIL on `"New Match!"`.

- [ ] **Step 2: Replace the `English` table verbatim**

```csharp
    private static (string, string) English(PushKind kind) => kind switch
    {
        PushKind.NewMatch => ("A summons.", "{0} has summoned you. A new fire is lit."),
        PushKind.NewMessage => ("{0}", "{1}"),
        PushKind.ThreadSparked => ("A thread took.", "A thread woven for you has caught. A new fire is lit."),
        PushKind.TownSquareMatch => ("A lantern answered.", "You both said yes in the square. A new fire is lit."),
        PushKind.FlameRiteProposed => ("The Flame Rite.", "Your match asks to meet across the glass before swearing to meet."),
        PushKind.FlameRiteAccepted => ("The rite is accepted.", "Your match will meet you across the glass. Light the call when you are ready."),
        PushKind.DateConfirmed => ("A meeting sworn.", "You both swore to meet under open sky. The place and hour are in the thread."),
        PushKind.MatchGhosted => ("A fire went out.", "A thread fell silent too long. It is closed."),
        PushKind.MatchGhostedByYou => ("A fire went out.", "You let a thread fall silent. It is closed, and your score and standing paid for it."),
        PushKind.TownSquareStarting => ("The bell rings.", "The square is open and your round has begun. Step in."),
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, null),
    };
```

- [ ] **Step 3: Fix the integration test literals** — `"New Match!"` → `"A summons."`, `"Bat sent you a summons."` → `"Bat has summoned you. A new fire is lit."`.

- [ ] **Step 4: Run** `dotnet test --filter "FullyQualifiedName~PushCopy|FullyQualifiedName~PushNotification"` — Expected: PASS. Then the full `dotnet test`.

- [ ] **Step 5: Commit** — `Sealed Fire W2: the lock screen speaks in the voice (PushCopy EN)`.

---

### Task 3: `lib/worldTime.ts` — time in the world's units (move 13, helpers)

Pure functions; no component yet (Task 10 mounts them). Countdowns become "tomorrow at 13:00", "in 3 dawns", "before this candle burns down"; ordinals and thread days feed the chat's day headings.

**Files:**
- Create: `mingldingl_app/lib/worldTime.ts`
- Modify: `mingldingl_app/lib/i18n/en.ts`, `mingldingl_app/lib/i18n/index.ts` (`AWAITING_MN_TRANSLATION`)
- Test: `mingldingl_app/lib/__tests__/worldTime.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type WorldWhen =
    | { kind: 'passed' }
    | { kind: 'candle'; minutes: number }   // under an hour away
    | { kind: 'today'; time: string }       // same local calendar day, an hour or more away
    | { kind: 'tomorrow'; time: string }
    | { kind: 'dawns'; dawns: number };     // two or more local midnights away
  export function worldWhen(targetIso: string | null, nowMs: number): WorldWhen;
  export function worldWhenText(when: WorldWhen): string;          // the i18n phrase
  export function worldTimeSpoken(): boolean;                      // i18n.locale === 'en'
  export function ordinalWord(n: number): string;                  // 'first' … 'twelfth', then '13th', '21st', '22nd', '23rd', '111th'
  export function threadDay(iso: string, threadStartIso: string): number; // 1 on the start's local calendar day, 2 the next, …; never below 1
  ```

- [ ] **Step 1: Add the keys** to `en.ts` (a new block after the `countdown_*` keys):

```ts
  // Time in the world's units (Sealed Fire move 13). English-only until the translator's lines
  // land; `worldTimeSpoken()` keeps Mongolian on the exact clock rather than mixing languages.
  when_candle: 'before this candle burns down',
  when_today: 'today at %{time}',
  when_tomorrow: 'tomorrow at %{time}',
  when_dawns: 'in %{count} dawns',
  ordinal_1: 'first', ordinal_2: 'second', ordinal_3: 'third', ordinal_4: 'fourth',
  ordinal_5: 'fifth', ordinal_6: 'sixth', ordinal_7: 'seventh', ordinal_8: 'eighth',
  ordinal_9: 'ninth', ordinal_10: 'tenth', ordinal_11: 'eleventh', ordinal_12: 'twelfth',
```

and to `AWAITING_MN_TRANSLATION`:

```ts
  // Time in the world's units (Wave 2). Until these are translated, `mn` keeps the exact clock.
  'when_candle', 'when_today', 'when_tomorrow', 'when_dawns',
  'ordinal_1', 'ordinal_2', 'ordinal_3', 'ordinal_4', 'ordinal_5', 'ordinal_6',
  'ordinal_7', 'ordinal_8', 'ordinal_9', 'ordinal_10', 'ordinal_11', 'ordinal_12',
```

- [ ] **Step 2: Write the failing tests** — `lib/__tests__/worldTime.test.ts`. Build every instant from *local* components so the machine's zone cannot move a midnight.

```ts
import { i18n } from '../i18n';
import { ordinalWord, threadDay, worldWhen, worldWhenText, worldTimeSpoken } from '../worldTime';

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const iso = (ms: number) => new Date(ms).toISOString();

describe('worldWhen', () => {
  const now = at(2026, 9, 12, 9, 0);
  it('is passed at or before now', () => {
    expect(worldWhen(iso(now), now)).toEqual({ kind: 'passed' });
    expect(worldWhen(null, now)).toEqual({ kind: 'passed' });
  });
  it('is a candle under an hour away', () => {
    expect(worldWhen(iso(at(2026, 9, 12, 9, 40)), now)).toEqual({ kind: 'candle', minutes: 40 });
  });
  it('is today at a clock time an hour or more away on the same local day', () => {
    expect(worldWhen(iso(at(2026, 9, 12, 21, 5)), now)).toEqual({ kind: 'today', time: '21:05' });
  });
  it('is tomorrow across one local midnight, however few hours away', () => {
    expect(worldWhen(iso(at(2026, 9, 13, 1, 0)), at(2026, 9, 12, 23, 30))).toEqual({ kind: 'tomorrow', time: '01:00' });
  });
  it('counts dawns across two or more midnights', () => {
    expect(worldWhen(iso(at(2026, 9, 15, 20, 0)), now)).toEqual({ kind: 'dawns', dawns: 3 });
  });
});

describe('worldWhenText', () => {
  const originalLocale = i18n.locale;
  afterEach(() => { i18n.locale = originalLocale; });
  it('speaks each rung', () => {
    i18n.locale = 'en';
    expect(worldWhenText({ kind: 'passed' })).toBe('Any moment');
    expect(worldWhenText({ kind: 'candle', minutes: 7 })).toBe('before this candle burns down');
    expect(worldWhenText({ kind: 'today', time: '21:05' })).toBe('today at 21:05');
    expect(worldWhenText({ kind: 'tomorrow', time: '01:00' })).toBe('tomorrow at 01:00');
    expect(worldWhenText({ kind: 'dawns', dawns: 3 })).toBe('in 3 dawns');
  });
  it('is only spoken in English until the translator delivers', () => {
    i18n.locale = 'en';
    expect(worldTimeSpoken()).toBe(true);
    i18n.locale = 'mn';
    expect(worldTimeSpoken()).toBe(false);
  });
});

describe('ordinalWord', () => {
  it('uses words to twelve and suffixed numerals beyond', () => {
    expect(ordinalWord(1)).toBe('first');
    expect(ordinalWord(3)).toBe('third');
    expect(ordinalWord(12)).toBe('twelfth');
    expect(ordinalWord(13)).toBe('13th');
    expect(ordinalWord(21)).toBe('21st');
    expect(ordinalWord(22)).toBe('22nd');
    expect(ordinalWord(23)).toBe('23rd');
    expect(ordinalWord(111)).toBe('111th');
    expect(ordinalWord(112)).toBe('112th');
  });
});

describe('threadDay', () => {
  const start = iso(at(2026, 9, 10, 23, 50));
  it('is day one on the start day, day two after the first local midnight', () => {
    expect(threadDay(iso(at(2026, 9, 10, 23, 55)), start)).toBe(1);
    expect(threadDay(iso(at(2026, 9, 11, 0, 5)), start)).toBe(2);
    expect(threadDay(iso(at(2026, 9, 12, 12, 0)), start)).toBe(3);
  });
  it('never goes below one for a message that predates the start by clock skew', () => {
    expect(threadDay(iso(at(2026, 9, 10, 23, 40)), start)).toBe(1);
  });
});
```

Run: `npx jest lib/__tests__/worldTime.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/worldTime.ts`**

```ts
import { i18n } from './i18n';

/**
 * Time in the world's units (Sealed Fire move 13).
 *
 * A countdown is the most modern thing on every screen. These helpers turn "in 19h 6m" into
 * "tomorrow at 13:00" and "in 3 dawns", the way the streak already counts in dawns and the
 * festivals already run on a calendar. The exact clock is never removed — `WorldClock` shows it
 * on a tap — and Mongolian keeps the exact clock outright until the translator's lines land.
 */
export type WorldWhen =
  | { kind: 'passed' }
  | { kind: 'candle'; minutes: number }
  | { kind: 'today'; time: string }
  | { kind: 'tomorrow'; time: string }
  | { kind: 'dawns'; dawns: number };

const HOUR_MS = 60 * 60 * 1000;

/** Local calendar day as a whole number, so two instants compare by the midnights between them. */
function localDayIndex(ms: number): number {
  const d = new Date(ms);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / (24 * HOUR_MS));
}

function clockTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function worldWhen(targetIso: string | null, nowMs: number): WorldWhen {
  if (!targetIso) return { kind: 'passed' };
  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target) || target <= nowMs) return { kind: 'passed' };
  const diff = target - nowMs;
  if (diff < HOUR_MS) return { kind: 'candle', minutes: Math.max(1, Math.floor(diff / 60000)) };
  const dawns = localDayIndex(target) - localDayIndex(nowMs);
  if (dawns <= 0) return { kind: 'today', time: clockTime(target) };
  if (dawns === 1) return { kind: 'tomorrow', time: clockTime(target) };
  return { kind: 'dawns', dawns };
}

export function worldWhenText(when: WorldWhen): string {
  switch (when.kind) {
    case 'passed': return i18n.t('countdown_any_moment');
    case 'candle': return i18n.t('when_candle');
    case 'today': return i18n.t('when_today', { time: when.time });
    case 'tomorrow': return i18n.t('when_tomorrow', { time: when.time });
    case 'dawns': return i18n.t('when_dawns', { count: when.dawns });
  }
}

/**
 * The world's phrases exist in English only for now. Rendering them inside a Mongolian sentence
 * would mix languages mid-line, so `mn` keeps the exact countdown it already has.
 */
export function worldTimeSpoken(): boolean {
  return i18n.locale === 'en';
}

export function ordinalWord(n: number): string {
  if (n >= 1 && n <= 12) return i18n.t(`ordinal_${n}`);
  const rem100 = n % 100;
  const rem10 = n % 10;
  const suffix = rem100 >= 11 && rem100 <= 13 ? 'th' : rem10 === 1 ? 'st' : rem10 === 2 ? 'nd' : rem10 === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

/** Which day of a thread an instant falls on, counting local midnights since the thread began. */
export function threadDay(iso: string, threadStartIso: string): number {
  const day = localDayIndex(new Date(iso).getTime()) - localDayIndex(new Date(threadStartIso).getTime()) + 1;
  return Math.max(1, day);
}
```

- [ ] **Step 4: Run the tests** — Expected: PASS. Then `npm test && npm run typecheck && npm run lint`. (The `ordinal_${n}` template is matched by `i18nCoverage.test.ts`'s dynamic-prefix rule because it is inside `i18n.t(`; keep that exact call shape.)

- [ ] **Step 5: Commit** — `Sealed Fire W2: time in the world's units (helpers)`.

---

### Task 4: `lib/letters.ts` — where the days turn and the seals broke

Pure: given a thread, which message starts a new day, and after which message a seal broke. Uses the engine's own mutual-count formula (`RevealService.MutualMessageCount`: `min(total, 2·min(mine, theirs) + 1)`) walked forward over the loaded history, and the hydrated ladder.

**Files:**
- Create: `mingldingl_app/lib/letters.ts`
- Test: `mingldingl_app/lib/__tests__/letters.test.ts`

**Interfaces:**
- Consumes: `threadDay` from Task 3; `Message` from `hooks/useChat.ts`.
- Produces:
  ```ts
  export interface DayStart { day: number | null; iso: string }   // day null → the caller shows the date instead
  export interface LetterMarks {
    dayStarts: Map<string, DayStart>;   // message id → this message opens that day
    sealBreaks: Map<string, number>;    // message id → the reveal level reached right after it (2, 3 or 4)
  }
  export function letterMarks(
    messages: readonly Message[],
    myId: string | null | undefined,
    opts: { threadStartIso?: string; ladder: readonly number[]; complete: boolean },
  ): LetterMarks;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
import { letterMarks } from '../letters';
import type { Message } from '../../hooks/useChat';

const LADDER = [1, 5, 15, 30];
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
let n = 0;
const msg = (senderId: string, createdAt: string): Message => ({ id: `m${++n}`, matchId: 'x', senderId, content: 'hi', createdAt });

describe('letterMarks · days', () => {
  beforeEach(() => { n = 0; });
  it('marks the first message and each message that opens a new local day, counted from the thread start', () => {
    const start = at(2026, 9, 10, 8);
    const ms = [msg('a', at(2026, 9, 10, 9)), msg('b', at(2026, 9, 10, 20)), msg('a', at(2026, 9, 12, 7))];
    const { dayStarts } = letterMarks(ms, 'a', { threadStartIso: start, ladder: LADDER, complete: true });
    expect([...dayStarts.entries()]).toEqual([
      ['m1', { day: 1, iso: ms[0].createdAt }],
      ['m3', { day: 3, iso: ms[2].createdAt }],
    ]);
  });
  it('still turns the day without a thread start, with no ordinal to give', () => {
    const ms = [msg('a', at(2026, 9, 10)), msg('b', at(2026, 9, 11))];
    const { dayStarts } = letterMarks(ms, 'a', { ladder: LADDER, complete: true });
    expect(dayStarts.get('m1')).toEqual({ day: null, iso: ms[0].createdAt });
    expect(dayStarts.get('m2')).toEqual({ day: null, iso: ms[1].createdAt });
  });
});

describe('letterMarks · seals', () => {
  beforeEach(() => { n = 0; });
  const alternating = (count: number) => Array.from({ length: count }, (_, i) => msg(i % 2 === 0 ? 'me' : 'them', at(2026, 9, 10, 1 + i)));
  it('breaks the first seal on the fifth mutual letter of a balanced exchange', () => {
    const { sealBreaks } = letterMarks(alternating(6), 'me', { ladder: LADDER, complete: true });
    expect([...sealBreaks.entries()]).toEqual([['m5', 2]]);
  });
  it('never breaks a seal for a monologue', () => {
    const ms = Array.from({ length: 12 }, (_, i) => msg('me', at(2026, 9, 10, 1 + i)));
    expect(letterMarks(ms, 'me', { ladder: LADDER, complete: true }).sealBreaks.size).toBe(0);
  });
  it('counts an optimistic "me" sender as mine', () => {
    const ms = [msg('me', at(2026, 9, 10, 1)), msg('them', at(2026, 9, 10, 2)), msg('me', at(2026, 9, 10, 3)), msg('them', at(2026, 9, 10, 4)), msg('me', at(2026, 9, 10, 5))];
    ms[4].senderId = 'me';
    expect(letterMarks(ms, 'user-1', { ladder: LADDER, complete: true }).sealBreaks.get('m5')).toBe(2);
  });
  it('places nothing while earlier history is still unloaded', () => {
    expect(letterMarks(alternating(6), 'me', { ladder: LADDER, complete: false }).sealBreaks.size).toBe(0);
  });
  it('reads the hydrated ladder, not a literal', () => {
    const { sealBreaks } = letterMarks(alternating(4), 'me', { ladder: [1, 3, 15, 30], complete: true });
    expect([...sealBreaks.entries()]).toEqual([['m3', 2]]);
  });
});
```

Run: `npx jest lib/__tests__/letters.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement `lib/letters.ts`**

```ts
import type { Message } from '../hooks/useChat';
import { threadDay } from './worldTime';

export interface DayStart { day: number | null; iso: string }

export interface LetterMarks {
  dayStarts: Map<string, DayStart>;
  sealBreaks: Map<string, number>;
}

/** The engine's `RevealService.MutualMessageCount`: one ahead of the quieter side, never more. */
function mutualCount(total: number, mine: number, theirs: number): number {
  return Math.min(total, 2 * Math.min(mine, theirs) + 1);
}

/** Rungs of the ladder reached by a mutual count: the ladder's first rung is level 1. */
function levelFor(mutual: number, ladder: readonly number[]): number {
  let level = 0;
  ladder.forEach((needed, i) => { if (mutual >= needed) level = i + 1; });
  return level;
}

/**
 * Where the ledger draws a day heading and where it draws "a seal broke here".
 *
 * Seal rows are only placed on a fully loaded thread: the count that breaks a seal is the whole
 * history's, and a page that begins mid-conversation cannot know how many letters came before
 * it. Once the last page is in, the rows appear where the rungs were crossed. A match born above
 * the first rung (a floor set at creation) still shows its rows at the crossings — they mark
 * where the letters earned the level, which is what the ledger records.
 */
export function letterMarks(
  messages: readonly Message[],
  myId: string | null | undefined,
  opts: { threadStartIso?: string; ladder: readonly number[]; complete: boolean },
): LetterMarks {
  const dayStarts = new Map<string, DayStart>();
  const sealBreaks = new Map<string, number>();

  let lastDayKey: string | null = null;
  let total = 0, mine = 0, theirs = 0;
  let level = 0;

  for (const m of messages) {
    const d = new Date(m.createdAt);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (dayKey !== lastDayKey) {
      dayStarts.set(m.id, {
        day: opts.threadStartIso ? threadDay(m.createdAt, opts.threadStartIso) : null,
        iso: m.createdAt,
      });
      lastDayKey = dayKey;
    }

    if (!opts.complete) continue;
    total += 1;
    if (m.senderId === 'me' || (!!myId && m.senderId === myId)) mine += 1; else theirs += 1;
    const next = levelFor(mutualCount(total, mine, theirs), opts.ladder);
    if (next > level) {
      if (next >= 2) sealBreaks.set(m.id, next);
      level = next;
    }
  }

  return { dayStarts, sealBreaks };
}
```

- [ ] **Step 3: Run the tests** — PASS; then the full app check.
- [ ] **Step 4: Commit** — `Sealed Fire W2: where the days turn and the seals broke (helpers)`.

---

### Task 5: `SealDots` and `SealsSheet` replace the reveal strip

The three seal-dots sit under the name in the chat header; tapping them opens a parchment sheet (the Seals board). `RevealStrip` and its test go away; its logic (chips, the membership gate) moves into the sheet.

**Files:**
- Create: `components/chat/SealDots.tsx`, `components/chat/SealsSheet.tsx`
- Delete: `components/chat/RevealStrip.tsx`, `components/chat/__tests__/RevealStrip.test.tsx`
- Modify: `app/chat/[matchId].tsx` (header children + the sheet; the `Unsealing` headline/subline)
- Modify: `lib/i18n/en.ts`, `lib/i18n/mn.ts` (delete orphans only), `lib/i18n/index.ts`
- Test: `components/chat/__tests__/SealDots.test.tsx`, `components/chat/__tests__/SealsSheet.test.tsx`

**Interfaces:**
- Consumes: `deepRevealLevel`, `nextRevealThreshold` from `lib/reveal.ts`; `useRevealLadder` from `hooks/useRevealThresholds.ts`; `SheetModal` from `components/modals/SheetModal.tsx`; `OathSigil`; `Glyph name="seal"`.
- Produces:
  ```ts
  // SealDots
  interface Props { broken: number; color?: string; size?: number; style?: StyleProp<ViewStyle> }
  export const SEAL_COUNT = 3;
  export function sealsBroken(revealLevel: number | undefined): number; // clamp(level - 1, 0, 3)
  export function SealDots(props: Props): JSX.Element;   // accessibilityRole="image", label from seals_broken_N; testIDs seal-dot-broken / seal-dot-intact
  // SealsSheet
  interface Props { visible: boolean; onClose: () => void; otherUser: PartialUser; messageCount: number; revealLevel: number }
  export function SealsSheet(props: Props): JSX.Element;
  ```

- [ ] **Step 1: Keys.** Add to `en.ts`:

```ts
  // The seals (Sealed Fire move 1/2): the reveal ladder as three wax seals.
  seals_title: 'The seals',
  seals_broken_0: 'Three seals, all intact',
  seals_broken_1: 'One of three seals broken',
  seals_broken_2: 'Two of three seals broken',
  seals_broken_3: 'All three seals broken',
  seals_left_0: 'nothing left under wax',
  seals_left_1: 'one seal left',
  seals_left_2: 'two seals left',
  seals_left_3: 'three seals left',
  seals_next_at: 'the next at %{count} letters',
  seal_under_wax: 'Under wax',
  age_winters: '%{age} winters',
  seals_deep_membership: 'The deep seal opens for the Hall and the High Table.',
  seals_climb: 'Climb',
  seals_law: 'Only letters you both send count toward the seals. Talking into silence never opens anyone.',
  seal_breaks_2: 'The first seal breaks',
  seal_breaks_3: 'The second seal breaks',
  seal_breaks_4: 'The deep seal breaks',
  seal_broke_2: 'A seal broke here. Their age and second likeness are yours now.',
  seal_broke_3: 'A seal broke here. Their district and third likeness are yours now.',
  seal_broke_4: 'The deep seal broke here. What they keep and believe is yours now.',
```

All of them to `AWAITING_MN_TRANSLATION` under a `// The seals (Wave 2).` comment. Then delete from **both** `en.ts` and `mn.ts` every `reveal_*` key that has no remaining reference after this task (expected: `reveal_title`, `reveal_locked`, `reveal_summary`, `reveal_next_at`, `reveal_complete`; keep `reveal_age`, `reveal_district`, `reveal_deep_profile`, `reveal_deep_membership` only if the sheet still uses them — run the coverage test and follow it).

- [ ] **Step 2: Write the failing `SealDots` test**

```tsx
import { render } from '@testing-library/react-native';
import { SealDots, sealsBroken } from '../SealDots';

describe('SealDots', () => {
  it('maps the reveal level to broken seals: level 1 breaks none, level 4 breaks all', () => {
    expect(sealsBroken(undefined)).toBe(0);
    expect(sealsBroken(1)).toBe(0);
    expect(sealsBroken(2)).toBe(1);
    expect(sealsBroken(4)).toBe(3);
    expect(sealsBroken(9)).toBe(3);
  });
  it('draws three seals, the broken ones first, and says how many are broken', () => {
    const { getAllByTestId, getByLabelText } = render(<SealDots broken={2} />);
    expect(getAllByTestId('seal-dot-broken')).toHaveLength(2);
    expect(getAllByTestId('seal-dot-intact')).toHaveLength(1);
    expect(getByLabelText('Two of three seals broken')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Implement `SealDots.tsx`**

```tsx
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { i18n } from '../../lib/i18n';
import { METAL, SPACE, SURFACE, tint } from '../../lib/theme';

export const SEAL_COUNT = 3;

/** Level 1 is the floor every match is born with; the three seals are rungs 2, 3 and 4. */
export function sealsBroken(revealLevel: number | undefined): number {
  return Math.max(0, Math.min(SEAL_COUNT, (revealLevel ?? 1) - 1));
}

interface Props {
  broken: number;
  /** The wax. Gold everywhere but the Fire, which passes the furnace. */
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The reveal ladder as three wax seals. An intact seal is a filled disc of wax; a broken one is
 * the ring the wax left. One image for accessibility — three dots read aloud one by one say
 * nothing — with the count as its label.
 */
export function SealDots({ broken, color = METAL.gold, size = 10, style }: Props) {
  return (
    <View
      style={[styles.row, style]}
      accessibilityRole="image"
      accessibilityLabel={i18n.t(`seals_broken_${broken}`)}
    >
      {Array.from({ length: SEAL_COUNT }, (_, i) => {
        const isBroken = i < broken;
        return (
          <View
            key={i}
            testID={isBroken ? 'seal-dot-broken' : 'seal-dot-intact'}
            style={[
              { width: size, height: size, borderRadius: size / 2 },
              isBroken
                ? { borderWidth: 1.5, borderColor: tint(color, 0.7), backgroundColor: 'transparent' }
                : { backgroundColor: color, borderWidth: 1, borderColor: tint(SURFACE.sunken, 0.35) },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
});
```

(`i18n.t(\`seals_broken_${broken}\`)` — keep the template inside the `i18n.t(` call so the coverage test sees the family.)

- [ ] **Step 4: Port the reveal-strip tests to `SealsSheet.test.tsx`** — same fixtures and the same seven behaviours as the deleted file (ladder hydration, fresh match, mid stage, deep fields, membership upsell → `/membership`, plain padlock while unearned, no upsell once deep arrived), rendered with `visible` and read by text/testID. New assertions to add: the eyebrow reads `Two of three seals broken` at `revealLevel={3}`; the progress line reads `the next at 15 letters` at `messageCount={7}`; every unrevealed photo tile and every unrevealed chip carries `accessibilityLabel="Under wax"`; the age chip reads `33 winters`; the law line is present. Mock `expo-router` as the old test did. Run: FAIL (module not found).

- [ ] **Step 5: Implement `SealsSheet.tsx`.** Structure (reuse the chip-building code from `RevealStrip.tsx`, moved here verbatim except for the copy):

```tsx
<SheetModal visible={visible} onClose={onClose}>
  <CardEyebrow>{i18n.t(`seals_broken_${broken}`)}</CardEyebrow>
  <Text style={styles.next}>{nextAt !== null ? i18n.t('seals_next_at', { count: nextAt }) : i18n.t('seals_left_0')}</Text>
  <View style={styles.row}>{/* photo tiles: revealed → <Image testID={`seal-photo-${i}`}/>; else a wax tile: <View accessibilityLabel={i18n.t('seal_under_wax')} testID={`seal-photo-wax-${i}`}><Glyph name="seal" size={ICON_SIZES.sm} /></View> */}</View>
  <View style={styles.chips}>{/* chips as before; a locked chip: accessibilityLabel={i18n.t('seal_under_wax')}, the label alone in INK.dim with a small seal glyph; the age chip renders i18n.t('age_winters', { age }) */}</View>
  {otherUser.oath && <OathSigil oath={otherUser.oath} proven={!!otherUser.oathProven} size="sm" />}
  {deepGatedByMembership && (
    <View style={styles.climbRow}>
      <Text style={styles.law}>{i18n.t('seals_deep_membership')}</Text>
      <GameButton variant="ink" size="compact" onPress={() => { onClose(); router.push('/membership'); }} testID="seals-climb">{i18n.t('seals_climb')}</GameButton>
    </View>
  )}
  <Text style={styles.law}>{i18n.t('seals_law')}</Text>
</SheetModal>
```

`styles.law` is `FONTS.bodyItalic` once Task 6 lands; until then use `FONTS.body` and leave a `// italic: the app speaking (Task 6 adds FONTS.bodyItalic)` note — the Task 7 implementer switches it. `GameButton` does not take `testID`; use a wrapping `View testID` or find by text. Keep the `deepGatedByMembership` derivation and comment from the old strip.

- [ ] **Step 6: Wire the chat header.** In `app/chat/[matchId].tsx`: remove the `RevealStrip` import and element; add `const [sealsVisible, setSealsVisible] = useState(false);` and `const broken = sealsBroken(match?.revealLevel);`. Give `HeaderBar` children:

```tsx
{match && (
  <Tap onPress={() => setSealsVisible(true)} accessibilityRole="button" accessibilityLabel={i18n.t('seals_title')} style={styles.sealsRow} testID="seals-toggle">
    <SealDots broken={broken} />
    <Text style={styles.sealsLeft}>{i18n.t(`seals_left_${SEAL_COUNT - broken}`)}</Text>
  </Tap>
)}
```

(`sealsRow`: row, centred, gap `SPACE.sm`, `paddingVertical: SPACE.xs`; `sealsLeft`: `FONTS.utility`, `FONT_SIZES.sm`, `INK.dim`, `TRACKING.wide`.) Mount `<SealsSheet visible={sealsVisible} onClose={() => setSealsVisible(false)} otherUser={match.otherUser} messageCount={match.messageCount} revealLevel={match.revealLevel} />` beside the other modals. Change the `Unsealing` props: `headline` becomes `i18n.t(\`seal_breaks_${level}\`)` and `subline` becomes the matching `seal_broke_${level}` line followed by a space and either `seals_next_at` (with `count: unsealedNextAt`) or `seals_left_0` when the ladder is complete — where `level` is `match.revealLevel` clamped to 2–4 (only those rungs reach the ceremony). Keep both template literals inside `i18n.t(` calls. Delete `RevealStrip.tsx` and its test.

- [ ] **Step 7: Verify** — `npm test && npm run typecheck && npm run lint` (the coverage test tells you which `reveal_*` keys to delete from both tables).
- [ ] **Step 8: Commit** — `Sealed Fire W2: the seals — dots in the header, a parchment sheet`.

---

### Task 6: The ledger's pieces — `LetterRow`, `DayHeading`, `SealBreakRow`, `WaxSealButton`, the italic

Components only; Task 7 mounts them. Adds the italic body face ("italic is the app speaking").

**Files:**
- Modify: `lib/theme.ts` (`FONTS.bodyItalic`), `app/_layout.tsx` (load `Alegreya_400Regular_Italic` from `@expo-google-fonts/alegreya/400Regular_Italic` — confirm the file exists under `node_modules/@expo-google-fonts/alegreya/`; it ships with the package already installed)
- Create: `components/chat/LetterRow.tsx`, `components/chat/DayHeading.tsx`, `components/chat/SealBreakRow.tsx`, `components/chat/WaxSealButton.tsx`
- Modify: `lib/i18n/en.ts`, `lib/i18n/index.ts`; `components/chat/SealsSheet.tsx` (`styles.law` → `FONTS.bodyItalic`)
- Test: `components/chat/__tests__/LetterRow.test.tsx`, `DayHeading.test.tsx`, `SealBreakRow.test.tsx`, `WaxSealButton.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  // LetterRow — one line of the ledger. `initial`: the sigil letter for this sender.
  interface Props { message: Message; myId: string | undefined; initial: string; onRetry?: (id: string) => void }
  // DayHeading — "THE THIRD DAY", or the date when `day` is null.
  interface Props { day: number | null; iso: string }
  // SealBreakRow — italic, level 2 | 3 | 4.
  interface Props { level: number }
  // WaxSealButton — the send seal.
  interface Props { onPress: () => void; disabled?: boolean }
  ```

- [ ] **Step 1: Keys** (`en.ts` + `AWAITING_MN_TRANSLATION`):

```ts
  thread_day: 'The %{ordinal} day',
  letter_seal: 'Seal and send',
```

Change existing English values (leave `mn.ts`): `type_message: 'Write your line…'`, `deleted_user: 'A name struck'`, `unknown_name: 'A sealed one'`, `match_ended_notice: 'The bond was severed. This thread is kept as it was; no more letters can be written on it.'`, `match_quiet_body: 'The fire went out. Silence ran too long, and this thread is judged cold.'`.

- [ ] **Step 2: Failing tests.** One file each; the assertions that matter:

```tsx
// LetterRow.test.tsx
const base: Message = { id: 'm1', matchId: 'x', senderId: 'me', content: 'A line', createdAt: new Date().toISOString() };
it('sets my line in italic gold and theirs in roman', () => {
  const mine = render(<LetterRow message={base} myId="me" initial="Х" />);
  expect(StyleSheet.flatten(mine.getByText('A line').props.style)).toEqual(expect.objectContaining({ fontFamily: FONTS.bodyItalic, color: ACCENT.base }));
  const theirs = render(<LetterRow message={{ ...base, senderId: 'other' }} myId="me" initial="С" />);
  expect(StyleSheet.flatten(theirs.getByText('A line').props.style)).toEqual(expect.objectContaining({ fontFamily: FONTS.body, color: INK.primary }));
});
it('shows the sigil initial', () => { expect(render(<LetterRow message={base} myId="me" initial="Х" />).getByText('Х')).toBeTruthy(); });
it('dims a sending line and offers retry on a failed one', () => {
  expect(StyleSheet.flatten(render(<LetterRow message={{ ...base, status: 'sending' }} myId="me" initial="Х" />).getByTestId('letter').props.style)).toEqual(expect.objectContaining({ opacity: 0.8 }));
  const onRetry = jest.fn();
  const { getByLabelText } = render(<LetterRow message={{ ...base, status: 'failed' }} myId="me" initial="Х" onRetry={onRetry} />);
  fireEvent.press(getByLabelText('Tap to retry'));   // use the existing message_tap_to_retry English value verbatim
  expect(onRetry).toHaveBeenCalledWith('m1');
});

// DayHeading.test.tsx
it('names the day in words, uppercased, and falls back to the date', () => {
  expect(render(<DayHeading day={3} iso="2026-09-12T00:00:00Z" />).getByText('THE THIRD DAY')).toBeTruthy();
  const { getByText } = render(<DayHeading day={null} iso="2026-09-12T00:00:00Z" />);
  expect(getByText(formatDate('2026-09-12T00:00:00Z').toUpperCase())).toBeTruthy();
});

// SealBreakRow.test.tsx
it('speaks in italic, per level', () => {
  const { getByText } = render(<SealBreakRow level={3} />);
  const t = getByText('A seal broke here. Their district and third likeness are yours now.');
  expect(StyleSheet.flatten(t.props.style).fontFamily).toBe(FONTS.bodyItalic);
});

// WaxSealButton.test.tsx
it('is a labelled button that ticks and fires, and is inert when disabled', () => {
  const onPress = jest.fn();
  const { getByLabelText } = render(<WaxSealButton onPress={onPress} />);
  fireEvent(getByLabelText('Seal and send'), 'pressIn');
  fireEvent.press(getByLabelText('Seal and send'));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(Haptics.impactAsync).toHaveBeenCalled();   // jest.mock('expo-haptics') as components/ui/__tests__/GameButton.test.tsx does
  const off = render(<WaxSealButton onPress={onPress} disabled />);
  expect(off.getByLabelText('Seal and send').props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
});
```

Run: FAIL (modules not found).

- [ ] **Step 3: The italic.** `lib/theme.ts` `FONTS`: add `bodyItalic: 'Alegreya_400Regular_Italic',` with the comment `// Italic is the app speaking; roman is the person (Sealed Fire, three voices).` `app/_layout.tsx`: import `{ Alegreya_400Regular_Italic } from '@expo-google-fonts/alegreya/400Regular_Italic'` and add it to `useFonts`.

- [ ] **Step 4: `LetterRow.tsx`** — layout: a row; left a 28px ring (`borderWidth: 1`, `borderColor: LINE.edge`, `borderRadius: 14`) holding `initial` in `FONTS.display` `FONT_SIZES.sm` (`ACCENT.base` for mine, `INK.dim` for theirs); right the text, `flex: 1`. Mine: `fontFamily: FONTS.bodyItalic, color: ACCENT.base`; theirs: `FONTS.body, INK.primary`; both `FONT_SIZES.lg`, `lineHeight: LEADING.lg`. `testID="letter"` on the row; `status === 'sending'` → `opacity: 0.8`; `failed` → `opacity: PRESS.dimmed` and, under the text, the same retry row `MessageBubble` had (`Pressable` with `accessibilityLabel={i18n.t('message_tap_to_retry')}`, `Icon alert-circle`, `FieldError`). No bubble, no fill, no border on the row: the ledger is text on the floor. Row `marginBottom: SPACE.md`, `gap: SPACE.sm`, `alignItems: 'flex-start'`.

- [ ] **Step 5: `DayHeading.tsx`** — centred row: hairline, text, hairline (`View` `height: 1`, `flex: 1`, `backgroundColor: LINE.edge`); text `FONTS.utility`, `FONT_SIZES.xs`, `TRACKING.eyebrow`, `INK.dim`, uppercased: `day !== null ? i18n.t('thread_day', { ordinal: ordinalWord(day) }) : formatDate(iso)`. `marginVertical: SPACE.lg`.

- [ ] **Step 6: `SealBreakRow.tsx`** — centred, `Glyph name="seal" size={ICON_SIZES.sm}` then text `i18n.t(\`seal_broke_${level}\`)` in `FONTS.bodyItalic`, `FONT_SIZES.sm`, `ACCENT.base`, `textAlign: 'center'`, `flexShrink: 1`. `marginBottom: SPACE.md`, `paddingHorizontal: SPACE.lg`.

- [ ] **Step 7: `WaxSealButton.tsx`** — a 48px disc: `Pressable` with `accessibilityRole="button"`, `accessibilityLabel={i18n.t('letter_seal')}`, `accessibilityState={{ disabled: !!disabled }}`, `testID="wax-seal-send"`; `onPressIn` → `if (!disabled) signal('press')` and a scale-to-0.94 `Animated.timing` (60 ms, native driver) as `GameButton` does, spring back on out; `disabled` → `opacity: PRESS.disabled`. Fill `METAL.gold`, `borderWidth: 2`, `borderColor: tint(SURFACE.sunken, 0.35)`, inside `<Glyph name="seal" size={ICON_SIZES.md} color={tint(SURFACE.sunken, 0.75)} />`. No furnace tokens (this file is not on the allowlist).

- [ ] **Step 8: `SealsSheet.styles.law`** → `FONTS.bodyItalic`; remove the placeholder note.
- [ ] **Step 9: Verify** — tests PASS; full app check.
- [ ] **Step 10: Commit** — `Sealed Fire W2: the ledger's pieces, and the italic voice`.

---

### Task 7: Chat as letters (move 2) — the screen

**Files:**
- Modify: `app/chat/[matchId].tsx`, `components/chat/MessageInput.tsx`
- Delete: `components/chat/MessageBubble.tsx`, `components/chat/__tests__/MessageBubble.test.tsx`
- Test: `app/__tests__/chatLedger.test.tsx` (create; render the pieces through a small harness rather than the whole screen if the screen's hooks are too heavy to mount — see Step 4)

**Interfaces:**
- Consumes: `letterMarks` (Task 4), `LetterRow`/`DayHeading`/`SealBreakRow`/`WaxSealButton` (Task 6), `Match.createdAt` (Task 1), `useRevealLadder`.

- [ ] **Step 1: `MessageInput`** — replace the `GameButton variant="primary"` with `<WaxSealButton onPress={handleSend} disabled={!text.trim()} />`; drop the `GameButton` import. Bar background becomes `'transparent'` with the top hairline kept (the ledger sits on the floor). The placeholder key is unchanged (`type_message`, now "Write your line…").

- [ ] **Step 2: The screen.** Imports: drop `MessageBubble`; add `LetterRow`, `DayHeading`, `SealBreakRow`, `letterMarks`. Compute:

```tsx
const marks = useMemo(
  () => letterMarks(messages, myId, { threadStartIso: match?.createdAt, ladder: revealLadder, complete: !hasMore }),
  [messages, myId, match?.createdAt, revealLadder, hasMore],
);
const theirInitial = (revealedName ?? name ?? '?').trim().charAt(0).toUpperCase() || '?';
const myInitial = (myProfile?.displayName ?? '').trim().charAt(0).toUpperCase() || '·';
```

(`myProfile` from whatever hook `app/(tabs)/profile.tsx` reads the signed-in user's profile with — grep it; do not add a new query.) `renderItem`:

```tsx
renderItem={({ item }) => {
  const day = marks.dayStarts.get(item.id);
  const broke = marks.sealBreaks.get(item.id);
  const mine = item.senderId === 'me' || (!!myId && item.senderId === myId);
  return (
    <>
      {day && <DayHeading day={day.day} iso={day.iso} />}
      {item.id === sealedMessageId
        ? <SealedLetter onOpen={unseal} sealColor={METAL.gold} />
        : <LetterRow message={item} myId={myId ?? undefined} initial={mine ? myInitial : theirInitial} onRetry={retryMessage} />}
      {broke != null && <SealBreakRow level={broke} />}
    </>
  );
}}
```

- [ ] **Step 3: The dashed thread.** Wrap the `FlatList` in a `View style={styles.ledger}` (`flex: 1`) with, before the list, `<View pointerEvents="none" style={styles.thread} />` — `position: 'absolute', top: 0, bottom: 0, left: SPACE.gutter + 14, width: 1, borderWidth: 1, borderStyle: 'dashed', borderColor: LINE.edge, borderRadius: 1` (Android draws a dashed border only when every side has a width, hence a 1px-wide box rather than `borderLeftWidth`). The `messageList` content keeps `paddingHorizontal: SPACE.gutter`. `endedNotice` text: keep the element, its copy changed in Task 6; set its background transparent.

- [ ] **Step 4: Test.** If `app/chat/[matchId].tsx` cannot be rendered under jest without mocking a dozen hooks, test the composition instead: a harness component in the test file that takes `messages`, `myId`, `createdAt`, `ladder`, `hasMore` and renders the same `renderItem` body over a `FlatList`. Assert: the first message is preceded by `THE FIRST DAY`; the fifth message of an alternating six-message thread is followed by the level-2 seal row; with `hasMore` true no seal row renders; my lines are italic. (Extract the `renderItem` body into `components/chat/LedgerItem.tsx` if that makes the harness honest — then the screen and the test render the same component.)

- [ ] **Step 5: Verify** — full app check; `lib/__tests__/forged.test.ts` must still pass (the chat file no longer holds a forged button; the retry button in `StateBlock` error branch stays `primary` — that is now the file's one).
- [ ] **Step 6: Commit** — `Sealed Fire W2: chat as letters — the ledger, the dashed thread, the wax seal`.

---

### Task 8: Seek, sealed (move 1) — `CandidateCard`

**Files:**
- Modify: `components/cards/CandidateCard.tsx`, `components/cards/__tests__/CandidateCard.test.tsx` (rewrite), `lib/i18n/en.ts`, `lib/i18n/index.ts`
- Read first: `lib/tiers.ts` (the tier-name helper and its keys), `components/OathSigil.tsx` (`oathLabel`), `lib/ornaments.ts` (`ORNAMENTS.knotGold`), `lib/theme.ts` (`TEMPERATURE`, `SCRIM`, `overlay`, `tint`).

**Interfaces:** props unchanged (`candidate`, `onRequest`, `onSkip`, `requesting`, `requestDisabled`). Consumes `SealDots` (Task 5).

- [ ] **Step 1: Keys** (`en.ts` + awaiting):

```ts
  seek_sealed_hint: 'Three seals. Earn the face.',
  seek_sealed_a11y: 'Their likeness, under wax',
  oath_sworn_to: 'Sworn to %{oath}',
  oath_seeking: 'Seeking %{oath}',
```

Delete `previous_photo` / `next_photo` from both tables if nothing else references them (the coverage test will say).

- [ ] **Step 2: Rewrite the test.** Keep the `WorldProvider` mock; drop the contrast helpers and the dot tests. New cases:

```tsx
const candidate: Candidate = { ...fields the model needs..., displayName: 'Эрдэнэбат', age: 33, city: 'Songinokhairkhan', gemTier: 'Ruby', oath: 'Bond', oathProven: true, bio: 'Vet.', photoUrls: ['https://x/1.jpg', 'https://x/2.jpg'] };
it('blurs the likeness under a labelled seal and offers no way to page the photos', () => {
  const { getByTestId, getByLabelText, queryByLabelText } = render(<CandidateCard candidate={candidate} onRequest={jest.fn()} onSkip={jest.fn()} />);
  expect(getByTestId('sealed-likeness').props.blurRadius).toBe(26);
  expect(getByLabelText('Their likeness, under wax')).toBeTruthy();
  expect(getByLabelText('Three seals, all intact')).toBeTruthy();
  expect(queryByLabelText('Next photo')).toBeNull();
});
it('says the name, the age, and one eyebrow of gem · district · oath', () => {
  const { getByText } = render(<CandidateCard candidate={candidate} onRequest={jest.fn()} onSkip={jest.fn()} />);
  expect(getByText('Эрдэнэбат, 33')).toBeTruthy();
  expect(getByText(/RUBY · SONGINOKHAIRKHAN · SWORN TO A BOND/)).toBeTruthy();
  expect(getByText('Three seals. Earn the face.')).toBeTruthy();
});
it('keeps one forged Summon and an ink Dismiss', () => {
  const onRequest = jest.fn(); const onSkip = jest.fn();
  const { getByText } = render(<CandidateCard candidate={candidate} onRequest={onRequest} onSkip={onSkip} />);
  fireEvent.press(getByText('SUMMON')); fireEvent.press(getByText('Dismiss'));
  expect(onRequest).toHaveBeenCalled(); expect(onSkip).toHaveBeenCalled();
});
```

(The forged button uppercases its label; the ink one does not. Use the tier label exactly as `lib/tiers.ts` renders "Ruby" in English — check the key before asserting.)

- [ ] **Step 3: Rewrite the card.** Remove: `photoIndex`, `advancePhoto`, the dots, their scrim, both tap targets, `placeholderIcon` sizing. Keep: `cardHeight`/`infoHeight` measurement and the plaque gradient. Render:

```tsx
<View style={styles.card} onLayout=…>
  {showPhoto
    ? <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" blurRadius={26} onError={() => setFailedUrl(photo)} testID="sealed-likeness" />
    : <View style={styles.photoPlaceholder} />}
  <View style={StyleSheet.absoluteFill} pointerEvents="none"><LinearGradient colors={[overlay(SCRIM.veil), overlay(SCRIM.veilStrong)]} style={StyleSheet.absoluteFill} /></View>
  <View style={[styles.sealArea, { paddingBottom: infoHeight }]} pointerEvents="none">
    <Image source={ORNAMENTS.knotGold} style={styles.seal} contentFit="contain" accessibilityRole="image" accessibilityLabel={i18n.t('seek_sealed_a11y')} />
    <SealDots broken={0} color={TEMPERATURE.furnace} size={12} />
    <Text style={styles.sealHint}>{i18n.t('seek_sealed_hint')}</Text>
  </View>
  <LinearGradient … the existing plaque gradient … />
  <RoomLight />
  <View style={styles.info} onLayout=…>
    <View style={styles.plaqueRule} />
    <View style={styles.nameRow}><Text style={styles.name}>{candidate.displayName}, {candidate.age}</Text><GemTierBadge tier={candidate.gemTier} size={BADGE_SIZES.row} /></View>
    <CardEyebrow color={ACCENT.base} style={styles.eyebrow}>{eyebrow}</CardEyebrow>
    {candidate.equippedTitleId && <Text style={styles.equippedTitle}>{itemLabel(candidate.equippedTitleId)}</Text>}
    {candidate.bio ? <Text style={styles.bio} numberOfLines={2}>{candidate.bio}</Text> : null}
    <View style={styles.actions}>…unchanged…</View>
  </View>
</View>
```

`eyebrow = [tierName, candidate.city, oathPhrase].filter(Boolean).join(' · ')` where `oathPhrase = candidate.oath ? i18n.t(candidate.oathProven ? 'oath_sworn_to' : 'oath_seeking', { oath: oathLabel(candidate.oath) }) : null`. `SCRIM.veil` — use whichever two rungs of `SCRIM` exist below `ceremony` (read the ladder; do not add a rung). Styles: `sealArea` absolute-fill, centred, `gap: SPACE.sm`; `seal` 120×120; `sealHint` `FONTS.bodyItalic`, `FONT_SIZES.sm`, `INK.dim`; `plaqueRule` `tint(TEMPERATURE.furnace, 0.6)` (furnace: the Fire is on the allowlist); `card.borderRadius: RADIUS.sm` (corners square off at the furnace); `eyebrow` `marginBottom: 0`. `OathSigil` is no longer rendered on this card — the eyebrow carries the oath; remove the import.

- [ ] **Step 4: Verify** — full app check (`furnace.test.ts` allows this file; `palette.test.ts` must stay clean).
- [ ] **Step 5: Commit** — `Sealed Fire W2: Seek, sealed — the likeness under wax`.

---

### Task 9: Header room glyphs (Wave 1's carry-over)

**Files:**
- Modify: `components/ui/HeaderBar.tsx`, `components/ui/GameHeader.tsx`, `app/(tabs)/discover.tsx`, `app/(tabs)/matches.tsx`, `app/(tabs)/townsquare.tsx`, `app/(tabs)/activity.tsx`, `app/(tabs)/profile.tsx`
- Test: `components/ui/__tests__/HeaderBar.test.tsx` (add a case)

- [ ] **Step 1: Failing test** — `it('draws a room glyph beside the title when given one', () => { const { UNSAFE_getByType } = render(<HeaderBar title="The Fire" glyph="fire" showBack={false} />); expect(UNSAFE_getByType(Glyph).props.name).toBe('fire'); });` (import `Glyph` from `../Glyph`).
- [ ] **Step 2: `HeaderBar`** — add `glyph?: GlyphName` to `Props`; render `{glyph && <Glyph name={glyph} size={ICON_SIZES.lg} color={ACCENT.base} style={styles.titleIcon} />}` where the `icon` renders (an unlabelled glyph is hidden from accessibility; the title carries the name). `GameHeader` passes `glyph` through.
- [ ] **Step 3: The five tabs** — replace `icon="sword-cross"` with `glyph="fire"` (both sites in `discover.tsx`), `icon="script-text"` → `glyph="letters"`, `icon="account-group"` → `glyph="lantern"`, `icon="anvil"` → `glyph="forge"`, `icon="shield-sword"` → `glyph="gem"`. Other screens keep `icon`.
- [ ] **Step 4: Verify; commit** — `Sealed Fire W2: room glyphs in the five headers`.

---

### Task 10: `WorldClock` and the three clocks (move 13, on screen)

**Files:**
- Create: `components/ui/WorldClock.tsx`
- Modify: `components/townsquare/SessionStatusCard.tsx`, `components/townsquare/NextGatheringPill.tsx`, `app/(auth)/otp.tsx`, `lib/i18n/en.ts`, `lib/i18n/index.ts`
- Test: `components/ui/__tests__/WorldClock.test.tsx`; update any existing tests of the pill/card/otp that assert the old countdown sentences (grep `RSVP closes in`, `Starts in`, `Code expires`).

**Interfaces:**
- Consumes: `worldWhen`, `worldWhenText`, `worldTimeSpoken` (Task 3), `formatCountdown` (`lib/townSquareTime.ts`).
- Produces:
  ```ts
  interface Props { targetIso: string | null; nowMs: number; worldKey: string; exactKey: string; style?: StyleProp<TextStyle>; testID?: string }
  export function WorldClock(props: Props): JSX.Element;
  ```

- [ ] **Step 1: Keys** (`en.ts` + awaiting): `gates_close: 'Gates close %{when}.'`, `first_bell: 'The first bell rings %{when}.'`, `verify_match_burns: 'The gatekeeper waits while this match burns.'`.

- [ ] **Step 2: Failing test**

```tsx
it('speaks the world in English and shows the clock itself on a tap, then returns', () => {
  jest.useFakeTimers();
  i18n.locale = 'en';
  const now = new Date(2026, 8, 12, 9, 0).getTime();
  const target = new Date(2026, 8, 13, 13, 0).toISOString();
  const { getByText, getByRole } = render(<WorldClock targetIso={target} nowMs={now} worldKey="first_bell" exactKey="town_square_starts_in" />);
  expect(getByText('The first bell rings tomorrow at 13:00.')).toBeTruthy();
  fireEvent.press(getByRole('button'));
  expect(getByText('Starts in 1d 4h')).toBeTruthy();
  act(() => { jest.advanceTimersByTime(4000); });
  expect(getByText('The first bell rings tomorrow at 13:00.')).toBeTruthy();
});
it('keeps the exact clock for Mongolian', () => {
  i18n.locale = 'mn';
  const { queryByText } = render(<WorldClock targetIso={target} nowMs={now} worldKey="first_bell" exactKey="town_square_starts_in" />);
  expect(queryByText(/first bell/)).toBeNull();
});
```

- [ ] **Step 3: Implement** — state `showExact`; `Pressable accessibilityRole="button"` whose label is `${world} ${exact}`; on press set `showExact` and a 4000 ms timeout back (cleared on unmount); text = `showExact || !worldTimeSpoken() ? i18n.t(exactKey, { time: formatCountdown(targetIso, nowMs) }) : i18n.t(worldKey, { when: worldWhenText(worldWhen(targetIso, nowMs)) })`. Style passthrough.

- [ ] **Step 4: Sites.** `SessionStatusCard`: the RSVP hint → `<WorldClock targetIso={session.rsvpClosesAt} nowMs={now} worldKey="gates_close" exactKey="town_square_rsvp_closes_in" style={styles.hint} />`; the starts line → `worldKey="first_bell" exactKey="town_square_starts_in" style={styles.countdown}`. `NextGatheringPill`: the whole pill navigates, so no toggle — when `worldTimeSpoken()`, `label = i18n.t(session.status === 'Open' ? 'gates_close' : 'first_bell', { when: worldWhenText(worldWhen(…)) })`, else the existing sentences; `accessibilityLabel` = label plus the exact countdown. `otp.tsx`: when `worldTimeSpoken()`, render `<Text style={styles.meta}>{i18n.t('verify_match_burns')}</Text>` followed by `<Text style={styles.metaSmall}>{mmss}</Text>` (`metaSmall`: `FONTS.utility`, `FONT_SIZES.xs`, `INK.dim`, `TRACKING.wide`); otherwise the existing `verify_expires_in` line.

- [ ] **Step 5: Verify; commit** — `Sealed Fire W2: the clocks speak — candles, bells and dawns`.

---

### Task 11: Mongolian width pass for chips and eyebrows (Wave 1's carry-over)

Mongolian runs 20–40% longer. A chip or eyebrow must shrink and wrap rather than clip.

**Files:**
- Modify: `components/ui/CardEyebrow.tsx`, `components/ui/ChoiceRow.tsx`, `components/chat/SealsSheet.tsx`
- Test: `components/ui/__tests__/primitives.test.tsx` (add cases)

- [ ] **Step 1: Failing tests** — render `CardEyebrow` and assert the flattened style has `flexShrink: 1`; render `ChoiceRow` with `i18n.locale = 'mn'` and the real `mn.ts` labels for `habit_*` (import `translations.mn`), assert every chip text's flattened style has `flexShrink: 1` and no `numberOfLines`, and the options container has `flexWrap: 'wrap'`.
- [ ] **Step 2: Fix** — `CardEyebrow.styles.eyebrow`: add `flexShrink: 1`. `ChoiceRow`: `chip` gets `maxWidth: '100%'`; `chipText` gets `flexShrink: 1`. `SealsSheet`: every chip `maxWidth: '100%'`, chip text `flexShrink: 1` (already the pattern from the old strip — confirm).
- [ ] **Step 3: Verify; commit** — `Sealed Fire W2: Mongolian width pass for chips and eyebrows`.

---

### Task 0 — the Wave 2 list ends here

(Sentinel heading for the brief-extraction script. After Task 11 the controller runs the final whole-wave review, the A51 device pass, moves this list's record into `shipped-log.md`, and pushes.)

**Deliberately left for later waves (write into the shipped record):** `feedback.ts` rows for candle lit, bell and fire dying — added in the wave that first fires them (3 and 4), a row with no caller being dead code; the chronicle's "thirteenth dawn" — the profile carries no joining date; the Flame Rite's candle clock (`app/video/[matchId].tsx`) — Wave 3 with the rite card's five states; `mystery_match_name` wording; `SheetModal`'s entrance, the shared parchment layer, per-route rules — unchanged from Wave 1's list.


### Gaps found while writing the report (settle before the wave that touches them)

- Mongolian strings run 20–40% longer than English; chips, eyebrows and plaza labels need a
  Mongolian width pass (chips and eyebrows carried from Wave 1 to Wave 2; Wave 4 for the plaza).
- Sound and haptics: `lib/world/feedback.ts` gains seal break, candle lit, bell, fire dying
  (Wave 2 and 4). Sound stays opt-in.
- Reduced motion: the new ceremonies and the hearth's embers must respect the existing switch.
- Contrast: the blackletter face read at 44px on the A51 (Wave 1, done); ember-on-dark toasts still need the check (Wave 3).
- Accessibility labels for every glyph and seal (glyphs done in Wave 1: labelled = image role, unlabelled = hidden; Wave 2 for seals).
- The keepsake card must export only the sharer's own portrait (Wave 3).
- "Deleted User" and "Unknown" (`deleted_user`, `unknown_name`) still appear as names in threads and
  on the wall; in the voice they become "A name struck" and "A sealed one" (Wave 2, EN only).
- Admin panel and web build are out of scope; web renders the new screens without Skia, as today.

### Build order (waves; each ends committed, pushed, CI green, device-checked on the A51)

- **Wave 1 — the kit, no behaviour change.** Shipped 2026-09-12 (`shipped-log.md`).
- **Wave 2 — the thesis.** Sealed `CandidateCard`; chat as letters (`MessageBubble` → ledger rows,
  seal-break rows from the reveal ladder, wax-seal send); `PushCopy` EN rewrite; time-in-world
  formatting helpers with exact time on tap. Verify on device with a seeded match across a reveal
  threshold.
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
- [x] Wave 1 verified on the Galaxy A51 (2026-09-12); Wave 2 before Wave 3, and so on.

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

This is the whole of it, as of 2026-09-11; the sections below add the detail:

- **The Sealed Fire redesign**, fully specified under "Open — Not Yet Built" above with a build
  order in four waves. Not started; four product decisions are listed there for the user first.
- **Mongolian copy for 39 keys, plus four venue columns.** `AWAITING_MN_TRANSLATION` in
  `lib/i18n/index.ts` holds 11 world/atlas keys (the hold title, seven room names, the Sound row),
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
