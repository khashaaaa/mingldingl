# Backlog Clearance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every actionable item in `docs/superpowers/project-plan.md`'s Outstanding
Follow-ups, and prune the entries that are stale or were never debt.

**Architecture:** Fixes are grouped into waves by subsystem so each wave is one review surface and
one test cycle. Nothing here is a new feature; every task either repairs behaviour that is already
wrong, closes a security hole, or corrects the backlog's own record.

**Tech Stack:** ASP.NET Core 8 + EF Core + Npgsql (engine), React Native 0.81 / Expo ~54 (app),
React 19 + Vite (control).

**Spec:** none — this plan's authority is the Outstanding Follow-ups section of
`docs/superpowers/project-plan.md` as it stood on 2026-09-10. Each task quotes the entry it closes.

## Global Constraints

- **Business rules travel as `DomainException`**, never `InvalidOperationException`/
  `ArgumentException` — EF and the BCL produce those and a controller cannot tell them apart.
- **Engine services are registered in `ServiceCollectionExtensions.cs`** (`AddApplicationServices`),
  not ad hoc in `Program.cs`.
- **Request field lengths come from `DTOs/FieldLimits.cs`.** Validation attributes on record DTOs go
  on the **constructor parameter**, never `[property: ...]`.
- **Design tokens only** in the app: colours from `COLORS`/`tint()`, spacing from `SPACE`, radii from
  `RADIUS`, sizes from `ICON_SIZES`/`FONT_SIZES`, fonts from `FONTS`, leading from `LINE_HEIGHTS` —
  all `lib/theme.ts`. No raw hex, no `rgba(` literals, no numeric spacing except `0`.
- **Screen containers stay `backgroundColor: 'transparent'`** so the world floor shows through.
- **Every app effect needs a `still` form** — gate loops with `motionAllowed(useVfxLevel())`.
- **No AI-guessed Mongolian.** No task here may add a Mongolian string. New English keys go on
  `AWAITING_MN_TRANSLATION`; prefer reusing an existing translated key over adding one.
- **Push copy is per-recipient and table-driven** (`Services/PushCopy.cs`) — a new push means a new
  kind plus BOTH translations, never a string at the call site. Since Mongolian is barred here, no
  task may add a push kind.
- **Commands:** engine `dotnet test` (needs local Postgres); app `npm run typecheck` (never bare
  `npx tsc`) and `npm test`; control `npm run lint` and `npm run build`. Whole stack:
  `./scripts/check-all.sh`.

---

## Wave 1 — Engine: security and correctness

### Task 1: Refuse to boot without a phone-verification key

Closes: *"A production deploy without `VerifyMn:ApiKey` is wide open — the gate, the
metadata-phone alias and `POST /users`'s metadata fallback are all inert/live together, and nothing
refuses to boot in that state the way `Cors:AllowedOrigins` does."*

**Files:**
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Program.cs`
- Test: `mingldingl_engine/tests/MinglDingl.Engine.Tests/` (new test class alongside the existing
  configuration tests — find where `Cors:AllowedOrigins`'s startup guard is tested and follow it)

**Interfaces:**
- Consumes: `VerifyMnClient.IsConfigured` (already exists — read it before writing the guard).
- Produces: a startup exception in non-Development environments when the key is absent.

- [ ] **Step 1: Find the existing precedent**

Read how `Cors:AllowedOrigins` throws at startup outside Development in `Program.cs`, and find its
test. This task mirrors that shape exactly — same environment check, same style of message.

- [ ] **Step 2: Write the failing test**

Mirror the CORS guard's test. Two cases: outside Development with no `VerifyMn:ApiKey` the host
fails to start; in Development it starts and enforcement stays inert (which is what keeps the
existing suite green).

- [ ] **Step 3: Run it and confirm it fails**

```bash
cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter VerifyMn
```

- [ ] **Step 4: Add the guard**

In `Program.cs`, beside the CORS check, throw when the environment is not Development and
`VerifyMn:ApiKey` is missing or empty. The message must say what is unset and what it would mean to
run without it (phone ownership unproven, the metadata-phone fallback live).

- [ ] **Step 5: Run the full engine suite**

```bash
cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test
```

Expected: PASS. Existing tests run in Development or without the key, so they must be unaffected —
if any fails, the guard is too broad.

- [ ] **Step 6: Commit**

---

### Task 2: Rate-limit phone-verification starts per IP

Closes: *"No per-IP limit on `POST /auth/phone/start` and no general API rate limiting. The
per-number cap bounds abuse against one target, not provider-quota burn across many numbers."*

**Files:**
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Program.cs`,
  `Controllers/AuthController.cs`
- Test: the auth controller's existing integration test class

**Interfaces:**
- Consumes: ASP.NET Core's built-in `Microsoft.AspNetCore.RateLimiting` (no new package).
- Produces: `429` with a `DomainException`-shaped body on the start endpoint.

- [ ] **Step 1: Read the existing per-number cap**

`PhoneVerificationService` already refuses a sixth pending session with
`429 phone.too_many_attempts`. Read it — the new per-IP limit must return the same *shape* of error
so the app's error handling does not need a new branch, but a distinguishable code.

- [ ] **Step 2: Write the failing test**

Assert that repeated `POST /auth/phone/start` from one client exceeds the window and returns 429,
and that a different number from the same IP is also refused once the IP budget is spent (that is
the point — the per-number cap already covers one target).

- [ ] **Step 3: Add a fixed-window limiter**

Register `AddRateLimiter` in `Program.cs` with a named policy partitioned on the remote IP, and
apply it to the start endpoint only. Do NOT apply a global limiter — the app polls
`GET /auth/phone/status/{id}` on a timer and a global cap would break the poll.

Choose a window that allows a real person retrying a failed verification a few times but bounds
provider-quota burn. State the numbers you chose and why in your report.

- [ ] **Step 4: Confirm the poll endpoint is unaffected**

Explicitly test or verify that `GET /auth/phone/status/{id}` can still be polled at the app's
cadence without tripping the limiter.

- [ ] **Step 5: Run the full engine suite and commit**

---

### Task 3: Pay the oath milestone before flipping the flag

Closes: *"`OathService.RefreshAsync` flips `OathProven` and saves before paying the milestone; if
the award throws the reward is never paid (the `alreadyPaid` guard makes the reverse order safe)."*

**Files:**
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Services/OathService.cs`
- Test: `mingldingl_engine/tests/MinglDingl.Engine.Tests/` — the existing oath test class

**Interfaces:**
- Consumes: the existing `alreadyPaid` guard, which is what makes reordering safe.
- Produces: no API change.

- [ ] **Step 1: Read `RefreshAsync` and the `alreadyPaid` guard**

Confirm for yourself that paying first is idempotent — the guard is the whole reason the reverse
order is safe. If it is not, stop and report rather than reordering.

- [ ] **Step 2: Write the failing test**

A test where the award throws must leave `OathProven` unflipped, so a later run pays it. Today the
flag is already saved, so the reward is lost forever.

- [ ] **Step 3: Reorder, run the suite, commit**

---

### Task 4: Localise venue content

Closes: *"Venue content is structurally English-only. `BusinessPartners` stores one `Name`,
`Description`, `Category` and `District`, and the app renders `Category`/`District` verbatim, so a
Mongolian user reads 'Outdoor · Khan-Uul' and 'City viewpoint — best at sunset.' under a fully
Mongolian UI."*

**Files:**
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Models/BusinessPartner.cs`,
  the business controller and its DTOs, `Services/LocalisedContent.cs`
- Create: an EF migration
- Modify: `mingldingl_app/app/business/[id].tsx`
- Test: the engine's business test class

**Interfaces:**
- Consumes: `Services/LocalisedContent.cs` — the EXACT mechanism already used for icebreakers and
  quiz content. Read it first and follow it; do not invent a second localisation approach.
- Produces: locale-aware venue fields on the existing endpoints.

- [ ] **Step 1: Read how `LocalisedContent` localises icebreakers**

This is the precedent. Venues get the same treatment: a per-locale overlay chosen by
`User.PreferredLocale` with a Mongolian fallback.

- [ ] **Step 2: Write the failing test**

An `en` user and an `mn` user reading the same venue get different `Name`/`Description`/`Category`/
`District` strings.

- [ ] **Step 3: Add the columns and the migration**

```bash
cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet PATH=$HOME/.dotnet:$HOME/.dotnet/tools:$PATH \
  dotnet ef migrations add LocaliseBusinessPartners --project src/MinglDingl.Engine
```

`dotnet-ef` must be pinned to 8.0.x — a default install grabs 10.x and fails with
"Failed to resolve libhostfxr.so" against this net8.0 project.

- [ ] **Step 4: Serve and render the localised fields**

Engine picks by locale; `app/business/[id].tsx` renders what it is given rather than the raw column.

- [ ] **Step 5: Seed the Mongolian overlays — DO NOT WRITE THEM**

The house rule forbids AI-guessed Mongolian. Add the columns and leave the Mongolian overlay
**null**, falling back to the existing string, and record in the report that the venue overlays
need a native speaker. Adding empty columns that fall back is the visible-gap behaviour the i18n
rule already prefers.

- [ ] **Step 6: Run engine tests + app typecheck, commit**

---

## Wave 2 — App: the real-device bugs

### Task 5: Stop `AtlasOverlay` setting state during another component's render

Closes: *"`AtlasOverlay` setState-during-render. LogBox, every time Discover mounts: 'Cannot update
a component (`AtlasOverlay`) while rendering a different component (`DiscoverScreen`)'. React
tolerates it today; it is a real violation."*

**Files:**
- Modify: `mingldingl_app/components/world/AtlasOverlay.tsx` and/or `AtlasSigil.tsx`,
  `app/(tabs)/discover.tsx`
- Test: `mingldingl_app/components/world/__tests__/`

- [ ] **Step 1: Find the write**

Reproduce by reading the render path: something in Discover's render writes atlas state. Name the
exact line in your report before changing anything.

- [ ] **Step 2: Write a failing test**

Render the Discover path and assert no React warning is emitted (spy on `console.error`, which is
where React routes this).

- [ ] **Step 3: Move the write into an effect or an event handler**, run the suite, commit

---

### Task 6: Give an empty thread something to say

Closes: *"A thread with no messages yet renders as an empty screen — no prompt, no empty state,
just the reveal strip and the activities row above a blank scroll area."*

**Files:**
- Modify: `mingldingl_app/app/chat/[matchId].tsx`
- Test: `mingldingl_app/app/chat/__tests__/[matchId].test.tsx`

- [ ] **Step 1: Write the failing test** — a match with zero messages renders an empty state.

- [ ] **Step 2: Add the empty state**

Reuse an EXISTING translated i18n key if one fits (search `en.ts`/`mn.ts` for an existing
conversation-opening prompt). Only if nothing fits, add an English key and put it on
`AWAITING_MN_TRANSLATION` — and say so in your report, because it grows a list we are trying to
empty.

- [ ] **Step 3: Run the suite, commit**

---

### Task 7: Retire the lock glyph on an unstarted quest

Closes (partially stale — see below): *"`icebreakerComplete` gates the video button and nothing
else... the character sheet's `next_action_icebreaker` ('Break the ice with X to unlock chat')
promises a lock that does not exist."*

**Controller finding — verify this before you start, then act on it.** The COPY half of this entry
is already fixed. `next_action_icebreaker` currently reads *"Break the ice with %{name} — trade
answers to the same question"* in `en.ts` and its Mongolian counterpart matches. Nothing in
`lib/i18n/en.ts` promises the icebreaker unlocks chat. Confirm that yourself with
`grep -rn "unlock" mingldingl_app/lib/i18n/en.ts`.

What survives is the same false promise expressed as a **symbol**:
`mingldingl_app/components/quest/QuestTile.tsx:23` renders a `lock` icon whenever
`!match.icebreakerComplete`. A padlock states that the thread is locked. It is not — messaging is
never gated, in the app or the engine (`icebreakerComplete` is read at
`app/chat/[matchId].tsx:385` for the video button, and nowhere else; verify with
`grep -rn "icebreakerComplete"`).

**Files:**
- Modify: `mingldingl_app/components/quest/QuestTile.tsx`
- Test: `mingldingl_app/components/quest/__tests__/` if a QuestTile test exists — check first

**Interfaces:**
- Consumes: `StatusIconName` (= `Icon`'s `name` prop) — the glyph must be a real
  MaterialCommunityIcons name.
- Produces: no API change, no copy change, **no new i18n key** — which is the point of doing it
  this way rather than rewording.

- [ ] **Step 1: Confirm both halves of the finding**

Run both greps above. If the copy DOES still promise a lock somewhere, stop and report — the fix
would then be larger than this task describes.

- [ ] **Step 2: Write the failing test**

Assert that a match with `icebreakerComplete: false` does NOT render the `lock` glyph, and still
renders the `quest_new` label. If no QuestTile test file exists, create one following the
conventions in `components/progression/__tests__/`.

- [ ] **Step 3: Change the glyph**

Replace `lock` with a glyph that means "not begun" rather than "forbidden". `script-text` (an
unopened quest scroll) fits this app's world language and is confirmed present in the
MaterialCommunityIcons glyph map; `flag-outline` and `book-open-variant` are also available if you
judge one of them better. Keep the label and colour exactly as they are — only the icon changes.

- [ ] **Step 4: Run the suite, commit**

### Task 8: Fix the first-run discover card

Closes: *"The discover card's photo area is mostly plaque on first run. The card is `flex: 1` under
`GettingStartedCard`, so while the four first-steps are outstanding the photo band is ~26% of the
card and a portrait reads as a forehead."*

**Files:**
- Modify: `mingldingl_app/app/(tabs)/discover.tsx`, `components/cards/CandidateCard.tsx`,
  `components/progression/GettingStartedCard.tsx`
- Test: `mingldingl_app/components/__tests__/` or the discover screen's test

- [ ] **Step 1: Choose between the two options the backlog names**

Either the board collapses to one line once started, or the card holds a minimum photo height. Read
both components and pick; justify the choice in your report. A minimum photo height is the smaller,
more local change and does not alter the first-run guidance — prefer it unless you find a reason
not to.

- [ ] **Step 2: Write a failing test** asserting the photo band keeps a minimum height while the
      getting-started board is visible.

- [ ] **Step 3: Implement, run the suite, commit**

---

### Task 9: Raise the active photo dot to 3:1

Closes: *"The discover card's active (gold) photo dot sits at ~2.3-2.7:1 against its own scrim."*

**Files:**
- Modify: `mingldingl_app/components/cards/CandidateCard.tsx`
- Test: `mingldingl_app/lib/__tests__/palette.test.ts` if it is the right home for a contrast
  assertion — read it first; the inactive dots' 3.1:1 fix should have a precedent there or in the
  card's own test.

- [ ] **Step 1: Measure the current ratio** the same way the inactive-dot fix did, and write a
      failing assertion at 3:1.

- [ ] **Step 2: Raise it using theme tokens only**, re-measure, run the suite, commit

---

## Wave 3 — App: the two Android platform bugs

These two are the hardest in the plan and are grouped because both are Expo SDK 54 Android window
behaviour, not application logic. **Timebox each: if the cause is not found, write up what was
ruled out and leave the entry in the backlog rather than shipping a guess.**

### Task 10: The composer that never comes back down

Closes: *"The chat composer never returns to the bottom once the keyboard has been open... stays
lifted ~70dp with dead world-floor showing under it for the rest of that screen's life. Ruled out:
it is not the `KeyboardAvoidingView` `behavior` value (`height`, `padding` and `undefined` all
reproduce), and screens with a text input but no `KeyboardAvoidingView` do not show it. Next
suspect is the interaction between Expo SDK 54's edge-to-edge Android window and `adjustResize`."*

**Files:**
- Modify: `mingldingl_app/app/chat/[matchId].tsx` (and possibly `app.json`/`app.config` for the
  Android soft-input mode)

- [ ] **Step 1: Read what has already been ruled out** (above) and do not repeat it.

- [ ] **Step 2: Investigate the named suspect** — edge-to-edge + `adjustResize`. Check
      `useSafeAreaInsets` usage in the composer: an inset captured while the keyboard is open and
      then retained is the shape of this bug.

- [ ] **Step 3: If you find it, write a regression test if one is possible**, fix, and commit. If
      you cannot reproduce it in jest, say so — this may be device-only, in which case fix it and
      mark it as owed device verification.

- [ ] **Step 4: If the cause is not found within your timebox**, revert any exploratory changes,
      and report precisely what you additionally ruled out so the next attempt starts further along.

### Task 11: The modal that whitens the navigation bar

Closes: *"A modal turns the Android navigation bar white. Every `Modal` (the leave-the-square
confirm, the activities sheet, the chest) renders its own window and the system navigation bar
reverts to the light default under a dark app."*

**Files:**
- Modify: the shared modal components under `mingldingl_app/components/modals/`, or a single shared
  wrapper if one exists

- [ ] **Step 1: Find whether a shared modal wrapper exists.** If every `Modal` is hand-rolled, the
      fix belongs in a new shared wrapper rather than repeated at each site — say which you found.

- [ ] **Step 2: Set the navigation-bar style for the modal's own window** (`navigationBarColor` /
      `StatusBar` style, or `expo-navigation-bar`), and confirm it restores on dismiss.

- [ ] **Step 3: Fix, run the suite, commit.** This is device-visible only — mark it owed device
      verification.

---

## Wave 4 — Code health and backlog hygiene

### Task 12: Widen the palette guard (colour system stage 3)

Closes: *"Stage 3 — migrating the remaining raw-pigment call sites (`COLORS.gold` 178, `textDim`
123, `text` 94) and widening the `palette.test.ts` guard from 'no `COLORS.bronze`' to 'no raw
`COLORS` outside the theme' — is **not done**."*

**This is the largest task in the plan (~395 call sites).** Do it in this order and commit between:

**Files:**
- Modify: `mingldingl_app/lib/theme.ts`, `lib/__tests__/palette.test.ts`, and call sites app-wide

- [ ] **Step 1: Read `lib/theme.ts`'s role layer** (`SURFACE`/`INK`/`ACCENT`/`LINE`/`STATUS`/
      `STATUS_SOFT`) and the existing `palette.test.ts` guard.

- [ ] **Step 2: Map each raw pigment to its role** before touching call sites. `COLORS.gold` is not
      one role — it is accent, it is a tier colour, and it is a metal. Produce that mapping first
      and put it in your report; a blind find-and-replace will flatten distinctions the role layer
      exists to keep.

- [ ] **Step 3: Migrate one pigment at a time**, running `npm test` and `npm run typecheck` after
      each, committing each separately.

- [ ] **Step 4: Widen the guard last**, once the call sites are clean, so the test proves the work
      rather than blocking it.

- [ ] **Step 5: If a call site genuinely has no role**, leave it and record why — a forced role is
      worse than an honest exception. List every exception in your report.

### Task 13: Close the small code-health items

**Files:**
- Modify: `mingldingl_app/components/profile/__tests__/ProfileAvatar.test.tsx`
- Create: an engine test covering admin config write → `ScoreService` read

- [ ] **Step 1: Fix the `act()` warning** in `ProfileAvatar.test.tsx` — it "still logs 'update not
      wrapped in act' under the full parallel run". Wrap the state update properly; do not silence
      the warning.

- [ ] **Step 2: Add the missing config test.** Closes: *"No test exercises the admin config write →
      `ScoreService` read path in one process; a regression of `ConfigService` to `AddScoped` would
      go unnoticed."* Write an engine integration test that writes a config value through the admin
      path and asserts `ScoreService` reads the new value in the same process.

- [ ] **Step 3: Run both suites, commit**

### Task 14: Prune the backlog's own stale entries

Two entries describe work that is already done. Leaving them makes the backlog lie about itself.

**Files:**
- Modify: `docs/superpowers/project-plan.md`

- [ ] **Step 1: Delete the stale `ConfigField` claim.** Under "Known gaps", the entry
      *"Admin panel — `ConfigField` ignores `Min`/`Max` (server error shows in the toast)"* is
      false: `mingldingl_control/src/components/ConfigField.tsx` has `rangeLabel` and `outOfRange`
      and refuses out-of-range values inline with Save disabled. The QA-pass section already says
      this entry is stale. Remove the claim, keep the two `admin.*`/`apiError` claims beside it
      (verify those separately before touching them).

- [ ] **Step 2: Delete the icebreaker/quiz localisation entry** from "Found on the second real-device
      sweep" — `Services/LocalisedContent.cs` exists and the QA pass records it as fixed.

- [ ] **Step 3: Move every entry this plan closed** out of Outstanding Follow-ups and into
      `docs/superpowers/shipped-log.md`, pruned to outcome summaries, per the repo's CLAUDE.md.

- [ ] **Step 4: Leave a single honest note** listing what remains open and why, specifically: the
      37 English-only strings awaiting a native Mongolian speaker (9 waiting-vocabulary + 11
      world/atlas + 17 report-sheet), the owed device passes, `POST /video/complete`'s dependency on
      Agora webhooks, `LoginThrottleService`'s dependency on shared state, and the deliberately
      unbuilt features (§6 paid extras, a third gender, Town Square's `Male × Female` pairing).

- [ ] **Step 5: Commit**

---

## Explicitly out of scope

Named here so nobody re-derives them:

- **All Mongolian translation.** 37 English-only keys need a native speaker. No task may guess.
- **`POST /video/complete` corroboration** — needs Agora webhooks.
- **`LoginThrottleService` shared state** — only matters if the engine scales out; an infra call.
- **`AuthAliases (Sub → UserId)` table** — a schema change to remove the alias's dependency on the
  proven phone. Real, but it is an optimisation of a working path, not a defect.
- **Message pagination's composite cursor** — a public API change for a same-instant tie.
- **Device verification passes** — needs the Galaxy A51.
- **Unbuilt features:** §6 paid extras, a third gender, Town Square's gender pairing and overflow
  handling, milestone-based reveal, `WORLD_ENABLED` as admin config, Ulzii shimmer deferrals,
  leaderboard names, discovery's materialise-everything query.

## Final verification

- [ ] `./scripts/check-all.sh` from the repo root
- [ ] Outstanding Follow-ups contains no entry this plan closed
- [ ] No new Mongolian string was invented anywhere in the diff
