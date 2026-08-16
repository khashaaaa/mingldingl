# MingldIngl — Specs & Plans

Single consolidated record of all design specs and implementation plans for this project. New feature work gets appended here, not spun into new files (see the project's standing pruning rule).

Structure: **Open** (not yet built — full spec/plan detail kept, this is active reference material) is separated from **Domain Model & Product Background** (living reference, not a task) and **Done** (shipped — pruned to outcome summaries only; the code itself is now the detailed reference, not this doc).

---

# Open — Not Yet Built

# Fated Threads — Design Spec

## Context

This is the second half of a two-part referral brainstorm; the first half,
**Recruit an Ally** (this document, above), solves generic
acquisition (bring a friend onto the app). This spec solves a different
problem: **friends already want to set up two people they know — the
obstacle is real life, not lack of opportunity.** Nobody wants to say "I
think you two should date" out loud to both people, because if one says no,
it's awkward for everyone, including the person who tried to help.

The mechanic this spec builds is a **double-blind mutual opt-in**: a
"Weaver" nominates two people privately; each one gets a low-pressure prompt
without knowing whether the other side has responded yet; only if both say
yes does anything connect. Neither nominee is ever exposed to a visible
rejection, and the Weaver never learns who said no.

Internal/code-level naming stays plain (`Ship`, `ShipService`, `ShipSlot`)
— see [Naming and tone](#naming-and-tone-user-facing-only) for what's
user-facing.

## Decisions locked in during brainstorming

- Reuses the existing progressive-reveal system rather than inventing a new
  one: a sparked thread just creates a normal `Match` (`RevealLevel = 1`),
  and the existing message-count-driven reveal
  (`RevealService.GetRevealLevel`) takes over from there. Consequence: the
  opt-in prompt itself must **not** show a photo or full profile — matches
  don't show photos until `RevealLevel 2` (5+ messages) either, so showing
  one earlier here would be a bigger reveal than a normal match gets on day
  one.
- A Weaver can nominate either an existing app user or someone brand new —
  both resolve through the same UI (enter a phone number), because this app
  has no user search/directory to pick an existing user by name any other
  way.
- **Privacy constraint, non-negotiable**: the response to "I entered this
  phone number" must never reveal whether it matched an existing account.
  Without this, Fated Threads becomes a tool for probing "is this person on
  the dating app," which is exactly the kind of leak that damages trust in
  a dating product. The client shows "Invite sent" identically on both
  paths.
- Sparked matches skip the `DailyMatchesUsed` budget — nobody spent a swipe
  on this match, a friend vouched for it.

## Data model

New table `Ship`:

```
Ship
  Id               Guid (PK)
  ShipperUserId    Guid  (FK -> User)
  Status           string   -- Pending | Sparked | Declined | Expired
  SlotAUserId      Guid?    (FK -> User, set once resolved)
  SlotAInviteCode  string?  (set only while SlotAUserId is null)
  SlotAOptIn       string   -- AwaitingUser | PendingOptIn | Accepted | Declined
  SlotBUserId      Guid?
  SlotBInviteCode  string?
  SlotBOptIn       string
  ResultMatchId    Guid?    (FK -> Match, set once Sparked)
  CreatedAt        DateTime
```

A slot starts `AwaitingUser` if the phone number didn't match an existing
account (has an `InviteCode` instead), or `PendingOptIn` if it did.

New column on `Match`:

- `ShipId` (`Guid?`, FK -> `Ship`) — tags a match as thread-originated, so
  chat can show "🏹 Woven by [Weaver name]" instead of the default header,
  and so `RequestMatch`-style budget logic can be skipped for these.

## API

### `POST /ships` — create a thread

Request: `{ SlotAPhoneNumber: string, SlotBPhoneNumber: string }`.

```
userId = CurrentUserId()
reject if either phone number belongs to userId themselves
for each slot:
    existingUser = db.Users.FirstOrDefault(u => u.PhoneNumber == phoneNumber)
    if existingUser is not null:
        // Silent no-op, not an error response — same privacy constraint as
        // the rest of this endpoint applies here too: surfacing "you're
        // blocked" would leak that the phone number resolved to a real,
        // specific account. The Weaver sees the same "Invite sent"
        // confirmation as every other outcome; the thread is just never
        // created server-side.
        if existingUser has blocked userId (BlockedUsers, BlockerId = existingUser.Id, BlockedId = userId):
            silently drop this slot's resolution, do not add the Ship row at all
        reject if a Match already exists between existingUser and the OTHER slot's
          resolved user (only checkable when both slots resolve to existing users)
        slot.UserId = existingUser.Id; slot.OptIn = "PendingOptIn"
    else:
        slot.InviteCode = GenerateCode()  // same generator as Recruit an Ally
        slot.OptIn = "AwaitingUser"
        send share-sheet invite (client-side, same pattern as referral share)
db.Ships.Add(new Ship { ... Status = "Pending" })
```

Response never distinguishes the two branches — just confirms the thread
was created. Reuses the pair-lock pattern from `MatchesController.RequestMatch`
for the existing-user-vs-existing-user collision check.

Rate limit: a daily cap on `Ship` rows created per `ShipperUserId`, mirroring
`ScoreService.DailyMatchBudget`. Value lives in `ConfigKeys.All` (admin-
tunable, e.g. `ships.daily.cap`, default `"3"`) rather than hardcoded,
following this codebase's existing pattern for tunable thresholds.

### `GET /ships/pending` — my pending opt-in prompts

Returns any `Ship` where the current user is a resolved slot (`SlotAUserId`
or `SlotBUserId` equals `CurrentUserId()`) with `OptIn = "PendingOptIn"`.
Response per item: `{ ShipId, WeaverDisplayName }` — **no fields from the
other slot at all**, not even a placeholder. The other nominee's identity is
never sent to the client before both sides accept.

### `POST /ships/{id}/respond` — accept or pass

Request: `{ Accept: bool, BlockWeaver: bool = false }`.

`BlockWeaver` closes a real gap in the original draft: the double-blind
design protects nominees from each other, but did nothing to stop a Weaver
themselves from being the problem — nothing prevented an ex, or someone
who's asked for space, from repeatedly nominating the same person into
unwanted "someone wants to set you up" prompts. When `BlockWeaver` is true
on a Pass, this reuses the existing `BlockedUser` table exactly as any
other block does (blocker = the responding nominee, blocked = `ship.ShipperUserId`)
— no new schema, and `POST /ships` already needs a blocked-user check added
(see below) so this plugs into infrastructure that has to exist anyway.

```
ship = load; slot = whichever of A/B matches CurrentUserId()
slot.OptIn = req.Accept ? "Accepted" : "Declined"
if !req.Accept && req.BlockWeaver:
    add BlockedUser { BlockerId = CurrentUserId(), BlockedId = ship.ShipperUserId }
    // idempotent if already blocked — same guard MatchesController.Block uses

if either slot is "Declined":
    ship.Status = "Declined"   // quiet close, no detail to either side about who
elif both slots are "Accepted":
    // Re-run the pair-existence check here, not just at creation: creation
    // time couldn't check it if either slot was still AwaitingUser, and
    // that slot has since resolved to a real user via onboarding.
    reject (silently expire the thread, no error surfaced to either party)
      if a Match already exists between slotA.UserId and slotB.UserId
    ship.Status = "Sparked"
    match = new Match { InitiatorId = slotA.UserId, ReceiverId = slotB.UserId,
                         Status = "Active", RevealLevel = 1, ShipId = ship.Id }
    // no DailyMatchesUsed increment — see Decisions
    ship.ResultMatchId = match.Id
    await _loot.GrantGuaranteedAsync(ship.ShipperUserId, source: "ShipSparked")
    await _score.AwardAsync(ship.ShipperUserId, "ShipSparked")
    // both matched users' and the Weaver's toasts surface via the same
    // pendingDrop/PendingReferralReward-style mechanism as Recruit an Ally —
    // see Frontend
```

### Resolving a brand-new invitee

Reuses the exact code-entry field already being added to onboarding for
Recruit an Ally (`PhotosStep`) — one field, checked against both `Referral`
codes and `Ship` invite codes server-side in `Upsert`, inside the same
`if (user.IsProfileComplete && !wasComplete)` guard, so this resolution is
naturally one-shot per user exactly like the referral case. If it matches a
`ShipSlot`'s `InviteCode`, that slot's `UserId` is set and `OptIn` flips to
`PendingOptIn`; the new user sees the same opt-in prompt as anyone else, the
first time they check `GET /ships/pending` post-onboarding.

**Code namespace**: `Referral.ReferralCode` and `Ship`'s two `InviteCode`
columns share one generator (`GenerateCode()`, 6 chars, ambiguous characters
excluded) and must be checked for collisions against *all three* columns,
not just the one being written — otherwise a referral code and a ship
invite code could coincidentally collide, and the single onboarding field
would resolve to the wrong one. Simplest fix: generate against a single
`SELECT` across `User.ReferralCode`, `Ship.SlotAInviteCode`, and
`Ship.SlotBInviteCode` before accepting a candidate code.

### Expiry

Extends the existing `DailyMaintenanceBackgroundService` sweep (no new
background service): any `Ship` still `Pending` after 14 days gets
`Status = "Expired"`. Reuses the same "batch query + single save" shape
already used there for ghosting and deletion-anonymization.

## Frontend

- **New screen, `app/ship/new.tsx`** — two phone-number fields ("Who's the
  first thread?" / "Who's the second?"), each triggering a share-sheet
  invite via the same `Share.share()` call as Recruit an Ally when the
  number doesn't resolve client-side-obviously... actually the client never
  learns which branch fired (see privacy constraint), so **both fields
  always show the same confirmation** (copy in
  [Naming and tone](#naming-and-tone-user-facing-only)) **and always offer
  the share-sheet action** — the share message is harmless to send even to an
  existing user's number (they simply won't act on it; their real prompt
  arrives via `GET /ships/pending` instead).
- **Opt-in prompt** — reuses the `QuestBanner` visual pattern (medallion +
  title + chevron) for entries in a new "🏹 Fated Threads" section, shown
  wherever quest-board content already renders, but with the `bow-arrow`
  icon and its own accent tint rather than the quest-reward gold, so it
  reads as a distinct track at a glance rather than another quest. Tapping
  opens an `AlertModal` with Accept/Pass, copy per
  [Naming and tone](#naming-and-tone-user-facing-only). Pass reveals a
  secondary, unchecked-by-default option — *"Don't let [Weaver] do this
  again"* — that sends `BlockWeaver: true` on the same request; leaving it
  unchecked passes quietly with no other consequence, exactly as before.
- **"Thread Log" card on `profile.tsx`** — mirrors `TrophyCase` visually.
  Shows counts (pending / sparked / declined-quietly-omit-detail) and
  unlocked Weaver titles.
- **Chat header** — for matches with `ShipId` set, `ScreenHeader`'s `right`
  slot (already supports arbitrary `ReactNode`) shows "🏹 Woven by [name]"
  instead of nothing.
- Reward delivery for the Weaver and both newly-matched users follows the
  exact `pendingDrop` + `GameHeader` polling pattern built for Recruit an
  Ally's `PendingReferralReward` — `ScoreDetailResponse` gains a second
  optional field, `PendingShipReward`, same read-once-and-clear shape.

## Naming and tone (user-facing only)

The app's established voice is dark-fantasy dungeon-crawler high fantasy —
Character Sheet, Guild Ranks, gem tiers, forged buttons, dungeon-wall
textures — not whimsical fairy-tale and not modern-startup ("Cupid,"
"matchmaking service," 💘 emoji). Fate, prophecy, and a Weaver-of-destiny
archetype are native to that genre (same shelf as "the Weave," oracle/fate
lore in Warcraft-style settings), so the feature doesn't need to lean on
steppe-specific imagery to belong — it draws on the *base* fantasy skin the
whole app already wears, with steppe archery folded in as flavor on top,
not as the thing doing the work of fitting in. See `AppCard`'s "riveted
metal fittings" and `GameButton`'s "forge glow" comments for the density
this copy needs to match — every line below is written to that bar, not to
explain the mechanic in plain words.

- Feature name: **Fated Threads**. Two action verbs, used at different
  moments: **weave a thread** for the act of nominating someone (the
  Weaver's side), **loose an arrow** for the moment a nominee takes their
  chance and accepts (the nominee's side) — the bow-arrow icon is the
  physical anchor for the second verb, the loom/weaving language is the
  anchor for the first. They're two views of the same event, not
  interchangeable synonyms.
- The nominating user is a **Weaver**.
- Icon: `bow-arrow` (`components/ui/Icon.tsx`, already validated elsewhere
  via `lib/festivals.ts`'s Naadam entry) — steppe archery, not a Cupid's
  arrow.
- Declined outcome copy: **"the thread frayed"** — never "declined,"
  "rejected," or anything that could read as blame toward either nominee.

### Copy per state

Every state that currently has no specified copy (waiting, sparked,
frayed-in-the-log, daily-cap-hit) gets one below — nothing is left to
placeholder text at implementation time.

| Moment | Copy |
|---|---|
| Thread created (Weaver, after submitting both numbers — identical regardless of which/whether either resolved, per the privacy constraint) | *"Two threads cast into the dark. You'll know if they catch."* (replaces the plain "Invite sent" placeholder in the original draft) |
| Opt-in prompt (nominee, `GET /ships/pending` entry) | *"🏹 [Weaver] has loosed an arrow on your behalf. Someone out there may be worth meeting — will you find out?"* |
| Accept confirmation (nominee, immediately after tapping Accept) | *"The string is drawn. Now you wait to see whose hand steadies the other end."* |
| Waiting (nominee, after accepting, before the other slot resolves) | *"Your arrow is loosed. Somewhere, another string is being drawn."* |
| Sparked — both matched users (chat header, replaces the default) | *"🏹 Woven by [Weaver name]"* (unchanged — already specified above) |
| Sparked — toast shown to both newly-matched users | *"Two threads, one knot. [Weaver]'s aim was true."* |
| Sparked — reward toast shown to the Weaver | *"Your arrow found its mark. A thread is woven."* |
| Frayed — Thread Log entry (Weaver's view; no detail on which slot declined) | *"A thread frayed in the dark — the wind carried it away."* |
| Daily cap reached (Weaver tries to weave a 4th thread) | *"Your quiver is empty for today. Return with the sunrise."* (mirrors the existing `daily_budget_title`/`The Realm Rests` pattern) |
| Two-phone-number entry screen, field labels | *"Whose fate will you weave first?"* / *"And who else deserves an arrow?"* |

### The armory (unlockables)

Titles alone under-use the existing loot system's range — `LootService.Catalog`
already pairs Titles with Frames and Emblems for other unlock tracks (see
`item_frame_*`/`item_emblem_*` in `lib/i18n.ts`), so Fated Threads gets a
matching three-piece set instead of titles only, unlocked at the same spark
thresholds:

| Threshold | Title | Frame | Emblem |
|---|---|---|---|
| 1st spark (Common) | `title_threadweaver` — "Threadweaver" | `item_frame_fletched` — "Fletched Ring" (a ring frame wrapped in bowstring/fletching, not metal studs like the existing Bronze/Ember frames — visually distinct from the video-call/quest-reward frame family) | — |
| 5th spark (Rare) | `title_fateseer` — "Fateseer" | — | `item_emblem_quiver` — "Quiver Emblem" |
| 10th spark (Epic) | `title_bondkeeper` — "Bondkeeper" | — | `item_emblem_drawn_bow` — "Drawn Bow Emblem" |

Same reward pipeline as any other item (`LootService.GrantGuaranteedAsync`),
just three new catalog entries instead of one — no new mechanism, only new
content.

## Anti-abuse

- Can't nominate yourself into either slot.
- Can't weave a thread between two people already matched to each other
  (checked when both slots resolve to existing users; unresolvable at
  creation time if either slot is still `AwaitingUser` — checked again,
  same as `RequestMatch`'s existence check, at spark time).
- Daily cap on threads created per Weaver (`ConfigKeys`-tunable, default 3).
- Phone-number resolution never leaks account existence to the client (see
  Decisions).
- Stale `Pending` threads expire after 14 days via the existing maintenance
  sweep — no indefinite dangling invites.
- **A nominee can stop a specific Weaver from ever nominating them again**
  (`BlockWeaver` on Pass, see `POST /ships/{id}/respond`) — the double-blind
  design protects nominees from each other, but the original draft left the
  Weaver themselves unaddressed: nothing stopped a person with an unwanted
  connection to someone (an ex, someone who's asked for space) from
  repeatedly pushing "someone wants to set you up" prompts at them. This
  closes that gap using the existing block relationship and its existing
  guarantee (blocked users can't match, and per `RequestMatch`'s pair-lock
  pattern this now also blocks new `Ship` creation targeting them) — no new
  privacy surface, no new mechanism.

## Testing

- Engine, `ShipServiceTests`:
  - both-accept sparks a match with `RevealLevel = 1`, `ShipId` set, no
    `DailyMatchesUsed` increment for either party
  - either-decline closes the thread without exposing which slot declined
  - self-nomination rejected
  - existing-user-pair already matched rejected at creation and (for the
    mixed resolved/unresolved case) at spark time
  - daily cap enforced per `ShipperUserId`
  - expiry sweep flips 14-day-stale `Pending` threads to `Expired`
  - Pass with `BlockWeaver: true` adds a `BlockedUser` row (blocker =
    responding nominee, blocked = Weaver); a subsequent `POST /ships`
    targeting that nominee's phone number by the same Weaver silently
    creates no `Ship` row (no error surfaced, matching the existing
    privacy constraint)
  - Pass with `BlockWeaver: false` (the default) does **not** create a
    block — confirms the new field is opt-in, not automatic on every
    decline
- Engine, `UsersController` test: onboarding `ReferralCode`/invite-code field
  correctly resolves a `Ship` slot (shared field, disambiguated server-side
  by which table the code exists in).
- Engine, `ScoresController` test: `PendingShipReward` surfaces once per
  spark, per recipient, then clears.
- App: render tests for the new opt-in prompt card and the Thread Log card;
  a test confirming `GET /ships/pending` responses never carry any field
  from the other slot; a test confirming Pass sends `BlockWeaver: false`
  when the checkbox is left unchecked and `true` only when explicitly
  checked (defaulting to a block would be a real trust regression).

## Out of scope (v1)

- In-app contact picker (`expo-contacts`) — manual phone-number entry only
  for v1; a contacts picker is a pure UX upgrade on top of the same API and
  can be added later without a data-model change.
- Group threads (more than 2 nominees) or Weaver-to-Weaver collaboration.
- Any UI surfacing *why* a thread frayed, or letting the Weaver retry with
  the same pair.

---

# Fated Threads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user ("Weaver") privately nominate two people — existing users or brand-new invites — for a double-blind mutual opt-in; if both accept, they're matched and the Weaver is rewarded.

**Architecture:** A new `Ship` table tracks two slots (each resolved to a user or a pending invite code) and their independent opt-in state. Creation and response both live in `ShipService`, called from a new `ShipsController`. A spark creates a normal `Match` (tagged `ShipId`) through the exact same shape `MatchesController.RequestMatch` already uses. The Weaver isn't in a live session at spark time, so their reward rides the next `GET /scores/me/detail` poll — the same mechanism **Recruit an Ally** (this document, above) built for its own async reward. Phone-number resolution never tells the client whether it matched an existing account.

**Tech Stack:** ASP.NET Core 8 / EF Core / PostgreSQL (engine), React Native / Expo / TanStack Query / Zustand (app), xUnit (Postgres-transaction-rollback integration tests), Jest + RNTL (app tests).

**Spec:** `docs/superpowers/specs/2026-08-14-fated-threads-design.md`

**Dependency:** This plan assumes **Recruit an Ally** (this document, above) is already implemented — it reuses `User.ReferralCode`'s code-generation alphabet/uniqueness namespace, the shared onboarding code-entry field, and `UsersController`'s post-Recruit-an-Ally constructor (`AppDbContext, ScoreService, ReferralService`), which Task 7 here extends further.

## Global Constraints

- Phone-number resolution during `POST /ships` must **never** let the client distinguish "matched an existing account" from "sent a fresh invite" — both branches return the same response shape.
- A declined slot must never reveal which side declined, to the Weaver or to the other nominee.
- Ship codes and `Referral` codes share one generation alphabet and one uniqueness check (`ABCDEFGHJKMNPQRSTUVWXYZ23456789` — excludes `0/O/1/I/L`) — see `ReferralService.GenerateCode` in the Recruit an Ally plan.
- Copy tone: **Fated Threads**, **Weaver**, "loose an arrow," "the thread frayed" — never "Cupid," "matchmaking," or generic SaaS invite copy. See the spec's "Naming and tone" section.
- A Ship-sparked match does **not** consume `DailyMatchesUsed` for either party.
- Phone numbers are validated as 8 digits (`^\d{8}$`), matching the existing `ChangePhoneRequest` validation in `UsersController`.

---

## Task 1: `Ship` entity, `Match.ShipId`, and config

**Files:**
- Create: `mingldingl_engine/src/MinglDingl.Engine/Models/Ship.cs`
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Models/Match.cs`
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Data/AppDbContext.cs`
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Services/ConfigKeys.cs`
- Create (via `dotnet ef migrations add`): `mingldingl_engine/src/MinglDingl.Engine/Data/Migrations/<timestamp>_AddShipsAndMatchShipId.cs`

**Interfaces:**
- Produces: `Ship` entity, `Match.ShipId` — consumed by every later engine task in this plan.

- [ ] **Step 1: Add the `Ship` model**

```csharp
// mingldingl_engine/src/MinglDingl.Engine/Models/Ship.cs
public class Ship
{
    public Guid Id { get; set; }
    public Guid ShipperUserId { get; set; }
    public string Status { get; set; } = "Pending"; // Pending|Sparked|Declined|Expired

    public Guid? SlotAUserId { get; set; }
    public string? SlotAInviteCode { get; set; }
    public string SlotAOptIn { get; set; } = "AwaitingUser"; // AwaitingUser|PendingOptIn|Accepted|Declined

    public Guid? SlotBUserId { get; set; }
    public string? SlotBInviteCode { get; set; }
    public string SlotBOptIn { get; set; } = "AwaitingUser";

    public Guid? ResultMatchId { get; set; }

    // Mirrors Referral's InviterRewardItemId/InviterNotifiedAt — set at
    // spark time, read once by GET /scores/me/detail, then never read again.
    public string? ShipperRewardItemId { get; set; }
    public DateTime? ShipperNotifiedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
```

- [ ] **Step 2: Add `Match.ShipId`**

In `mingldingl_engine/src/MinglDingl.Engine/Models/Match.cs`, add near `VideoRewardClaimed`:

```csharp
    // Set only for matches created by ShipService.RespondAsync when both
    // slots accept. Tags the match's origin for the chat header banner
    // ("Woven by ...") and exempts it from the DailyMatchesUsed budget —
    // see MatchesController.RequestMatch, which this bypasses entirely.
    public Guid? ShipId { get; set; }
```

- [ ] **Step 3: Register the DbSet, indexes, and config key**

In `mingldingl_engine/src/MinglDingl.Engine/Data/AppDbContext.cs`, add to the `DbSet<...>` list:

```csharp
    public DbSet<Ship> Ships => Set<Ship>();
```

In `OnModelCreating`, add (no uniqueness needed — a user can be nominated into multiple ships, and a Weaver can weave many threads, so nothing here is `.IsUnique()`):

```csharp
        b.Entity<Ship>().HasIndex(s => s.ShipperUserId);
        b.Entity<Ship>().HasIndex(s => s.SlotAUserId);
        b.Entity<Ship>().HasIndex(s => s.SlotBUserId);
```

In `mingldingl_engine/src/MinglDingl.Engine/Services/ConfigKeys.cs`, add to `All`:

```csharp
        new("ships.daily.cap", "Growth", "Number", "3",
            "Max Fated Threads a single Weaver can create per day"),
```

- [ ] **Step 4: Generate and apply the EF migration**

```bash
cd mingldingl_engine
export DOTNET_ROOT=$HOME/.dotnet
export PATH="$DOTNET_ROOT:$DOTNET_ROOT/tools:$PATH"
dotnet ef migrations add AddShipsAndMatchShipId --project src/MinglDingl.Engine
dotnet ef database update --project src/MinglDingl.Engine
```
Expected: a new migration adding the `Ships` table and `Matches.ShipId` column, applied cleanly.

- [ ] **Step 5: Build to confirm no compile errors**

Run: `cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet build`
Expected: succeeds (no tests yet — this task has no independent behavior of its own to test; Task 2 onward exercises it).

- [ ] **Step 6: Commit**

```bash
git add mingldingl_engine/src/MinglDingl.Engine/Models/Ship.cs \
        mingldingl_engine/src/MinglDingl.Engine/Models/Match.cs \
        mingldingl_engine/src/MinglDingl.Engine/Data/AppDbContext.cs \
        mingldingl_engine/src/MinglDingl.Engine/Services/ConfigKeys.cs \
        mingldingl_engine/src/MinglDingl.Engine/Data/Migrations/
git commit -m "feat(engine): add Ship entity, Match.ShipId, and ships.daily.cap config"
```

---

## Task 2: Reward primitives — `LootService.GrantSpecificAsync` and the `ShipSparked` score event

**Files:**
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Services/LootService.cs`
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Services/ScoreService.cs`
- Modify: `mingldingl_engine/tests/MinglDingl.Engine.Tests/Services/LootServiceTests.cs`
- Modify: `mingldingl_engine/tests/MinglDingl.Engine.Tests/Services/ScoreServiceTests.cs`
- Test (new): `mingldingl_engine/tests/MinglDingl.Engine.Tests/Services/LootServiceGrantSpecificTests.cs`

**Interfaces:**
- Produces: `LootService.GrantSpecificAsync(Guid userId, string itemId, string source) : Task<DroppedItem?>`, three new catalog ids (`title_threadweaver`, `title_fateseer`, `title_bondkeeper`), `ScoreService.GetDelta("ShipSparked") == 40` — all consumed by Task 3's `ShipService`.

- [ ] **Step 1: Write the failing tests**

```csharp
// mingldingl_engine/tests/MinglDingl.Engine.Tests/Services/LootServiceGrantSpecificTests.cs
namespace MinglDingl.Engine.Tests.Services;

public class LootServiceGrantSpecificTests : Integration.IntegrationTestBase
{
    private LootService BuildService() => new(Db, new ScoreService(Db, new ConfigService()));

    [Fact]
    public async Task GrantSpecificAsync_KnownItem_GrantsItAndReturnsIt()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();

        var result = await BuildService().GrantSpecificAsync(userId, "title_threadweaver", "ShipMilestone");

        Assert.NotNull(result);
        Assert.Equal("title_threadweaver", result!.Id);
        Db.ChangeTracker.Clear();
        Assert.Single(Db.UserItems.Where(i => i.UserId == userId && i.ItemId == "title_threadweaver"));
    }

    [Fact]
    public async Task GrantSpecificAsync_UnknownItemId_ReturnsNullWithoutThrowing()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();

        var result = await BuildService().GrantSpecificAsync(userId, "not_a_real_item", "ShipMilestone");

        Assert.Null(result);
    }

    [Fact]
    public async Task GrantSpecificAsync_AlreadyOwned_ReturnsNullWithoutDuplicating()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();
        var service = BuildService();
        await service.GrantSpecificAsync(userId, "title_threadweaver", "ShipMilestone");

        var second = await service.GrantSpecificAsync(userId, "title_threadweaver", "ShipMilestone");

        Assert.Null(second);
        Db.ChangeTracker.Clear();
        Assert.Single(Db.UserItems.Where(i => i.UserId == userId && i.ItemId == "title_threadweaver"));
    }
}
```

Update the existing catalog-size assertion in `LootServiceTests.cs`:

```csharp
    [Fact]
    public void Catalog_HasFifteenUniqueItems()
    {
        Assert.Equal(15, LootService.Catalog.Count);
        Assert.Equal(15, LootService.Catalog.Select(c => c.Id).Distinct().Count());
    }
```

(replaces the existing `Catalog_HasTwelveUniqueItems` — rename and update the count in place, don't leave both.)

Add one `[InlineData]` case to `ScoreServiceTests.GetDelta_KnownEventType_ReturnsExpectedDelta`:

```csharp
    [InlineData("ShipSparked", 40)]
```

(add it alongside the existing `[InlineData(...)]` lines, before the `public void` line.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter "FullyQualifiedName~LootService|FullyQualifiedName~ScoreServiceTests"`
Expected: FAIL — `GrantSpecificAsync` doesn't exist, catalog count is still 12, `"ShipSparked"` isn't a known event type (returns 0, not 40).

- [ ] **Step 3: Add the three catalog entries**

In `mingldingl_engine/src/MinglDingl.Engine/Services/LootService.cs`, add to `Catalog` (after the existing Title entries, before the Emblem entries):

```csharp
        // Fated Threads milestone titles (1st / 5th / 10th sparked thread —
        // see ShipService.GrantMilestoneTitleIfEarnedAsync). Not exclusive:
        // like every catalog item, these could in principle also be won
        // through the normal random pool (RollDropAsync/GrantGuaranteedAsync)
        // — a cosmetic title having two possible acquisition paths is an
        // accepted simplification, not a currency/economy concern.
        new("title_threadweaver", "item_title_threadweaver", "Common", "Title"),
        new("title_fateseer",     "item_title_fateseer",     "Rare",   "Title"),
        new("title_bondkeeper",   "item_title_bondkeeper",   "Epic",   "Title"),
```

- [ ] **Step 4: Add `GrantSpecificAsync`**

In `mingldingl_engine/src/MinglDingl.Engine/Services/LootService.cs`, add after `GrantGuaranteedAsync`:

```csharp
    // Deterministic grant of one specific catalog item, bypassing the
    // random rarity roll entirely — used for Fated Threads' ship-count
    // milestone titles, where the item earned is a fixed function of the
    // milestone, not a roll.
    public async Task<DroppedItem?> GrantSpecificAsync(Guid userId, string itemId, string source)
    {
        try
        {
            var def = Catalog.FirstOrDefault(c => c.Id == itemId);
            if (def is null) return null;

            bool owned = await _db.UserItems.AnyAsync(i => i.UserId == userId && i.ItemId == itemId);
            if (owned) return null;

            _db.UserItems.Add(new UserItem { UserId = userId, ItemId = itemId, Source = source });
            await _db.SaveChangesAsync();
            return new DroppedItem(def.Id, def.NameKey, def.Rarity, def.ItemType);
        }
        catch
        {
            _db.ChangeTracker.Clear();
            return null;
        }
    }
```

- [ ] **Step 5: Add the `ShipSparked` event type**

In `mingldingl_engine/src/MinglDingl.Engine/Services/ScoreService.cs`, add to `GetDelta`'s switch (between `"VideoCallDone" => 30,` and `"GhostPenalty" => -15,`):

```csharp
        "ShipSparked"     => 40,
```

In `mingldingl_engine/src/MinglDingl.Engine/Models/ScoreEvent.cs`, update the documentation comment listing valid event types to include `ShipSparked`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test`
Expected: full suite PASS (confirms the catalog-count rename didn't break anything else referencing the old test name, and every other suite still passes with 15 catalog items).

- [ ] **Step 7: Commit**

```bash
git add mingldingl_engine/src/MinglDingl.Engine/Services/LootService.cs \
        mingldingl_engine/src/MinglDingl.Engine/Services/ScoreService.cs \
        mingldingl_engine/src/MinglDingl.Engine/Models/ScoreEvent.cs \
        mingldingl_engine/tests/MinglDingl.Engine.Tests/Services/LootServiceTests.cs \
        mingldingl_engine/tests/MinglDingl.Engine.Tests/Services/LootServiceGrantSpecificTests.cs \
        mingldingl_engine/tests/MinglDingl.Engine.Tests/Services/ScoreServiceTests.cs
git commit -m "feat(engine): add GrantSpecificAsync, ship milestone titles, and ShipSparked scoring"
```

---

## Task 3: `ShipService` — creation, response, and spark logic

**Files:**
- Create: `mingldingl_engine/src/MinglDingl.Engine/Services/ShipService.cs`
- Modify: `mingldingl_engine/src/MinglDingl.Engine/ServiceCollectionExtensions.cs`
- Test: `mingldingl_engine/tests/MinglDingl.Engine.Tests/Services/ShipServiceTests.cs`

**Interfaces:**
- Consumes: `LootService.GrantGuaranteedAsync`, `LootService.GrantSpecificAsync` (Task 2), `ScoreService.AwardAsync` (existing), `ConfigService.GetNumber` (existing).
- Produces: `ShipService.CreateAsync(Guid shipperId, string slotAPhone, string slotBPhone) : Task<(bool Success, string? Error)>`, `ShipService.RespondAsync(Guid userId, Guid shipId, bool accept) : Task<bool>` (returns whether this response sparked a match), `ShipService.TryResolveInviteCodeAsync(Guid newUserId, string code) : Task` — the last one consumed by Task 4's `UsersController` wiring; the first two by Task 5's `ShipsController`.

- [ ] **Step 1: Write the failing tests**

```csharp
// mingldingl_engine/tests/MinglDingl.Engine.Tests/Services/ShipServiceTests.cs
using Microsoft.EntityFrameworkCore;

namespace MinglDingl.Engine.Tests.Services;

public class ShipServiceTests : Integration.IntegrationTestBase
{
    private ShipService BuildService()
    {
        var scoreService = new ScoreService(Db, new ConfigService());
        return new ShipService(Db, new LootService(Db, scoreService), scoreService, new ConfigService());
    }

    private User AddUser(string phone)
    {
        var user = NewCompleteUser();
        user.PhoneNumber = phone;
        Db.Users.Add(user);
        return user;
    }

    [Fact]
    public async Task CreateAsync_BothPhonesUnknown_CreatesAwaitingUserSlotsWithInviteCodes()
    {
        var weaver = AddUser("88110001");
        await Db.SaveChangesAsync();

        var (success, error) = await BuildService().CreateAsync(weaver.Id, "88110002", "88110003");

        Assert.True(success);
        Assert.Null(error);
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);
        Assert.Equal("AwaitingUser", ship.SlotAOptIn);
        Assert.Equal("AwaitingUser", ship.SlotBOptIn);
        Assert.NotNull(ship.SlotAInviteCode);
        Assert.NotNull(ship.SlotBInviteCode);
        Assert.NotEqual(ship.SlotAInviteCode, ship.SlotBInviteCode);
    }

    [Fact]
    public async Task CreateAsync_BothPhonesKnown_ResolvesToPendingOptInImmediately()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003");
        await Db.SaveChangesAsync();

        var (success, _) = await BuildService().CreateAsync(weaver.Id, "88110002", "88110003");

        Assert.True(success);
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);
        Assert.Equal(a.Id, ship.SlotAUserId);
        Assert.Equal(b.Id, ship.SlotBUserId);
        Assert.Equal("PendingOptIn", ship.SlotAOptIn);
        Assert.Equal("PendingOptIn", ship.SlotBOptIn);
        Assert.Null(ship.SlotAInviteCode);
        Assert.Null(ship.SlotBInviteCode);
    }

    [Fact]
    public async Task CreateAsync_SelfNomination_Rejected()
    {
        var weaver = AddUser("88110001");
        await Db.SaveChangesAsync();

        var (success, error) = await BuildService().CreateAsync(weaver.Id, "88110001", "88110002");

        Assert.False(success);
        Assert.NotNull(error);
        Db.ChangeTracker.Clear();
        Assert.Empty(Db.Ships);
    }

    [Fact]
    public async Task CreateAsync_PairAlreadyMatched_RejectedWhenBothSlotsResolveToExistingUsers()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003");
        Db.Matches.Add(new Match { InitiatorId = a.Id, ReceiverId = b.Id, Status = "Active", RevealLevel = 1 });
        await Db.SaveChangesAsync();

        var (success, error) = await BuildService().CreateAsync(weaver.Id, "88110002", "88110003");

        Assert.False(success);
        Assert.NotNull(error);
    }

    [Fact]
    public async Task CreateAsync_DailyCapReached_Rejected()
    {
        var weaver = AddUser("88110001");
        await Db.SaveChangesAsync();
        var service = BuildService();
        for (int i = 0; i < 3; i++)
        {
            var (success, _) = await service.CreateAsync(weaver.Id, $"8811{1000 + i}", $"8811{2000 + i}");
            Assert.True(success);
        }

        var (fourthSuccess, fourthError) = await service.CreateAsync(weaver.Id, "88113000", "88114000");

        Assert.False(fourthSuccess);
        Assert.NotNull(fourthError);
    }

    [Fact]
    public async Task RespondAsync_OneAcceptsOneDeclines_ClosesQuietlyWithoutSparking()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003");
        await Db.SaveChangesAsync();
        var service = BuildService();
        await service.CreateAsync(weaver.Id, "88110002", "88110003");
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);

        var firstResult = await service.RespondAsync(a.Id, ship.Id, accept: true);
        var secondResult = await service.RespondAsync(b.Id, ship.Id, accept: false);

        Assert.False(firstResult);
        Assert.False(secondResult);
        Db.ChangeTracker.Clear();
        var reloaded = await Db.Ships.FindAsync(ship.Id);
        Assert.Equal("Declined", reloaded!.Status);
        Assert.Empty(Db.Matches.Where(m => m.ShipId == ship.Id));
    }

    [Fact]
    public async Task RespondAsync_BothAccept_SparksAMatchAndRewardsTheWeaver()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003");
        await Db.SaveChangesAsync();
        var service = BuildService();
        await service.CreateAsync(weaver.Id, "88110002", "88110003");
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);

        var firstResult = await service.RespondAsync(a.Id, ship.Id, accept: true);
        var secondResult = await service.RespondAsync(b.Id, ship.Id, accept: true);

        Assert.False(firstResult);
        Assert.True(secondResult);
        Db.ChangeTracker.Clear();
        var reloaded = await Db.Ships.FindAsync(ship.Id);
        Assert.Equal("Sparked", reloaded!.Status);
        Assert.NotNull(reloaded.ShipperRewardItemId);
        var match = await Db.Matches.FirstAsync(m => m.ShipId == ship.Id);
        Assert.Equal(1, match.RevealLevel);
        Assert.Equal("Active", match.Status);

        var weaverAfter = await Db.Users.FindAsync(weaver.Id);
        Assert.True(weaverAfter!.TotalScore >= 40);
    }

    [Fact]
    public async Task RespondAsync_SparkDoesNotIncrementEitherPartysDailyMatchesUsed()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003");
        await Db.SaveChangesAsync();
        var service = BuildService();
        await service.CreateAsync(weaver.Id, "88110002", "88110003");
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);

        await service.RespondAsync(a.Id, ship.Id, accept: true);
        await service.RespondAsync(b.Id, ship.Id, accept: true);

        Db.ChangeTracker.Clear();
        Assert.Equal(0, (await Db.Users.FindAsync(a.Id))!.DailyMatchesUsed);
        Assert.Equal(0, (await Db.Users.FindAsync(b.Id))!.DailyMatchesUsed);
    }

    [Fact]
    public async Task RespondAsync_FirstSparkedThread_GrantsThreadweaverTitle()
    {
        var weaver = AddUser("88110001");
        var a = AddUser("88110002");
        var b = AddUser("88110003");
        await Db.SaveChangesAsync();
        var service = BuildService();
        await service.CreateAsync(weaver.Id, "88110002", "88110003");
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);

        await service.RespondAsync(a.Id, ship.Id, accept: true);
        await service.RespondAsync(b.Id, ship.Id, accept: true);

        Db.ChangeTracker.Clear();
        Assert.Single(Db.UserItems.Where(i => i.UserId == weaver.Id && i.ItemId == "title_threadweaver"));
    }

    [Fact]
    public async Task TryResolveInviteCodeAsync_MatchingCode_ResolvesTheSlotToPendingOptIn()
    {
        var weaver = AddUser("88110001");
        await Db.SaveChangesAsync();
        var service = BuildService();
        await service.CreateAsync(weaver.Id, "88119999", "88118888"); // both AwaitingUser
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);
        var code = ship.SlotAInviteCode!;
        var newUser = AddUser("88119999");
        await Db.SaveChangesAsync();

        await service.TryResolveInviteCodeAsync(newUser.Id, code);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Ships.FindAsync(ship.Id);
        Assert.Equal(newUser.Id, reloaded!.SlotAUserId);
        Assert.Null(reloaded.SlotAInviteCode);
        Assert.Equal("PendingOptIn", reloaded.SlotAOptIn);
    }

    [Fact]
    public async Task TryResolveInviteCodeAsync_UnknownCode_NoOps()
    {
        var newUser = AddUser("88119999");
        await Db.SaveChangesAsync();

        await BuildService().TryResolveInviteCodeAsync(newUser.Id, "ZZZZZZ");

        // No exception is the assertion here — nothing to look up afterward.
    }

    [Fact]
    public async Task RespondAsync_PairBecameMatchedBetweenCreationAndSpark_ExpiresInsteadOfDuplicating()
    {
        // Covers the spec's required spark-time recheck: creation-time
        // couldn't reject this pair (slot A was still AwaitingUser then),
        // so the check has to run again right before the match is created.
        var weaver = AddUser("88110001");
        var b = AddUser("88110003");
        await Db.SaveChangesAsync();
        var service = BuildService();
        await service.CreateAsync(weaver.Id, "88119999", "88110003"); // slot A starts AwaitingUser
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);
        var code = ship.SlotAInviteCode!;
        var a = AddUser("88119999");
        await Db.SaveChangesAsync();
        await service.TryResolveInviteCodeAsync(a.Id, code); // slot A resolves to a real user

        // A and B become matched through an unrelated route before either
        // responds to the ship.
        Db.Matches.Add(new Match { InitiatorId = a.Id, ReceiverId = b.Id, Status = "Active", RevealLevel = 1 });
        await Db.SaveChangesAsync();

        var firstResult = await service.RespondAsync(a.Id, ship.Id, accept: true);
        var secondResult = await service.RespondAsync(b.Id, ship.Id, accept: true);

        Assert.False(firstResult);
        Assert.False(secondResult);
        Db.ChangeTracker.Clear();
        var reloaded = await Db.Ships.FindAsync(ship.Id);
        Assert.Equal("Expired", reloaded!.Status);
        // Only the one Match that already existed — RespondAsync must not
        // have added a second one for the same pair.
        Assert.Single(Db.Matches.Where(m => m.InitiatorId == a.Id && m.ReceiverId == b.Id));
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter FullyQualifiedName~ShipServiceTests`
Expected: FAIL — `ShipService` doesn't exist yet (compile error).

- [ ] **Step 3: Implement `ShipService`**

```csharp
// mingldingl_engine/src/MinglDingl.Engine/Services/ShipService.cs
using Microsoft.EntityFrameworkCore;

public class ShipService
{
    private const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    private readonly AppDbContext _db;
    private readonly LootService _loot;
    private readonly ScoreService _score;
    private readonly ConfigService _config;

    public ShipService(AppDbContext db, LootService loot, ScoreService score, ConfigService config)
    {
        _db = db;
        _loot = loot;
        _score = score;
        _config = config;
    }

    public async Task<(bool Success, string? Error)> CreateAsync(Guid shipperId, string slotAPhone, string slotBPhone)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(slotAPhone, @"^\d{8}$") ||
            !System.Text.RegularExpressions.Regex.IsMatch(slotBPhone, @"^\d{8}$"))
            return (false, "Phone numbers must be 8 digits");

        var shipper = await _db.Users.FindAsync(shipperId);
        if (shipper is null) return (false, "User not found");
        if (shipper.PhoneNumber == slotAPhone || shipper.PhoneNumber == slotBPhone)
            return (false, "Cannot weave a thread to yourself");

        int cap = (int)_config.GetNumber("ships.daily.cap", 3);
        var today = DateTime.UtcNow.Date;
        int todayCount = await _db.Ships.CountAsync(s => s.ShipperUserId == shipperId && s.CreatedAt >= today);
        if (todayCount >= cap) return (false, "Daily thread limit reached");

        var (slotAUserId, slotACode) = await ResolveSlotAsync(slotAPhone);
        var (slotBUserId, slotBCode) = await ResolveSlotAsync(slotBPhone);

        if (slotAUserId.HasValue && slotBUserId.HasValue)
        {
            bool alreadyMatched = await _db.Matches.AnyAsync(m =>
                (m.InitiatorId == slotAUserId && m.ReceiverId == slotBUserId) ||
                (m.InitiatorId == slotBUserId && m.ReceiverId == slotAUserId));
            if (alreadyMatched) return (false, "These two are already matched");
        }

        _db.Ships.Add(new Ship
        {
            ShipperUserId = shipperId,
            SlotAUserId = slotAUserId,
            SlotAInviteCode = slotACode,
            SlotAOptIn = slotAUserId.HasValue ? "PendingOptIn" : "AwaitingUser",
            SlotBUserId = slotBUserId,
            SlotBInviteCode = slotBCode,
            SlotBOptIn = slotBUserId.HasValue ? "PendingOptIn" : "AwaitingUser",
        });
        await _db.SaveChangesAsync();
        return (true, null);
    }

    private async Task<(Guid? UserId, string? InviteCode)> ResolveSlotAsync(string phoneNumber)
    {
        var existing = await _db.Users.FirstOrDefaultAsync(u => u.PhoneNumber == phoneNumber);
        if (existing is not null) return (existing.Id, null);

        string code;
        do
        {
            code = GenerateCode();
        } while (await CodeExistsAsync(code));
        return (null, code);
    }

    private static string GenerateCode()
    {
        var chars = new char[6];
        for (int i = 0; i < 6; i++)
            chars[i] = CodeAlphabet[Random.Shared.Next(CodeAlphabet.Length)];
        return new string(chars);
    }

    // Shared code namespace with ReferralService.GetOrCreateCodeAsync — see
    // the Fated Threads spec's "Code namespace" note. A referral code and a
    // ship invite code must never collide, since onboarding's single code
    // field resolves both without knowing in advance which table it's in.
    private async Task<bool> CodeExistsAsync(string code) =>
        await _db.Users.AnyAsync(u => u.ReferralCode == code) ||
        await _db.Ships.AnyAsync(s => s.SlotAInviteCode == code || s.SlotBInviteCode == code);

    // Called from UsersController.Upsert alongside ReferralService's own
    // code check — at most one of the two will ever match a given code,
    // since the namespace above is shared and unique.
    public async Task TryResolveInviteCodeAsync(Guid newUserId, string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return;
        var normalized = code.ToUpperInvariant();
        var ship = await _db.Ships.FirstOrDefaultAsync(s =>
            s.Status == "Pending" && (s.SlotAInviteCode == normalized || s.SlotBInviteCode == normalized));
        if (ship is null) return;

        if (ship.SlotAInviteCode == normalized)
        {
            ship.SlotAUserId = newUserId;
            ship.SlotAInviteCode = null;
            ship.SlotAOptIn = "PendingOptIn";
        }
        else
        {
            ship.SlotBUserId = newUserId;
            ship.SlotBInviteCode = null;
            ship.SlotBOptIn = "PendingOptIn";
        }
        await _db.SaveChangesAsync();
    }

    // Returns true only when this specific response is the one that sparked
    // the match (both slots now Accepted) — false for every other outcome
    // (recorded but not yet complete, declined, not found, not a
    // participant, already responded). The caller (ShipsController) treats
    // all of those uniformly; see the spec's privacy constraint.
    public async Task<bool> RespondAsync(Guid userId, Guid shipId, bool accept)
    {
        var ship = await _db.Ships.FindAsync(shipId);
        if (ship is null || ship.Status != "Pending") return false;

        bool isSlotA = ship.SlotAUserId == userId;
        bool isSlotB = ship.SlotBUserId == userId;
        if (!isSlotA && !isSlotB) return false;

        if (isSlotA) ship.SlotAOptIn = accept ? "Accepted" : "Declined";
        else ship.SlotBOptIn = accept ? "Accepted" : "Declined";

        if (ship.SlotAOptIn == "Declined" || ship.SlotBOptIn == "Declined")
        {
            ship.Status = "Declined";
            await _db.SaveChangesAsync();
            return false;
        }

        if (ship.SlotAOptIn != "Accepted" || ship.SlotBOptIn != "Accepted")
        {
            await _db.SaveChangesAsync();
            return false;
        }

        // Both accepted. Re-check pair existence now, not just at creation:
        // creation time couldn't check it if either slot was still
        // AwaitingUser, and that slot may have since resolved via onboarding.
        bool alreadyMatched = await _db.Matches.AnyAsync(m =>
            (m.InitiatorId == ship.SlotAUserId && m.ReceiverId == ship.SlotBUserId) ||
            (m.InitiatorId == ship.SlotBUserId && m.ReceiverId == ship.SlotAUserId));
        if (alreadyMatched)
        {
            ship.Status = "Expired";
            await _db.SaveChangesAsync();
            return false;
        }

        var match = new Match
        {
            InitiatorId = ship.SlotAUserId!.Value,
            ReceiverId = ship.SlotBUserId!.Value,
            Status = "Active",
            RevealLevel = 1,
            ShipId = ship.Id,
        };
        _db.Matches.Add(match);
        ship.Status = "Sparked";
        await _db.SaveChangesAsync();
        ship.ResultMatchId = match.Id;

        var shipperReward = await _loot.GrantGuaranteedAsync(ship.ShipperUserId, "ShipSparked");
        ship.ShipperRewardItemId = shipperReward?.Id;
        await _db.SaveChangesAsync();

        await _score.AwardAsync(ship.ShipperUserId, "ShipSparked");
        await GrantMilestoneTitleIfEarnedAsync(ship.ShipperUserId);

        return true;
    }

    private async Task GrantMilestoneTitleIfEarnedAsync(Guid shipperId)
    {
        int sparkedCount = await _db.Ships.CountAsync(s => s.ShipperUserId == shipperId && s.Status == "Sparked");
        string? itemId = sparkedCount switch
        {
            1 => "title_threadweaver",
            5 => "title_fateseer",
            10 => "title_bondkeeper",
            _ => null,
        };
        if (itemId is not null)
            await _loot.GrantSpecificAsync(shipperId, itemId, "ShipMilestone");
    }
}
```

- [ ] **Step 4: Register the service**

In `mingldingl_engine/src/MinglDingl.Engine/ServiceCollectionExtensions.cs`, add next to `services.AddScoped<ReferralService>();`:

```csharp
        services.AddScoped<ShipService>();
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter FullyQualifiedName~ShipServiceTests`
Expected: PASS (12/12).

- [ ] **Step 6: Commit**

```bash
git add mingldingl_engine/src/MinglDingl.Engine/Services/ShipService.cs \
        mingldingl_engine/src/MinglDingl.Engine/ServiceCollectionExtensions.cs \
        mingldingl_engine/tests/MinglDingl.Engine.Tests/Services/ShipServiceTests.cs
git commit -m "feat(engine): add ShipService — creation, opt-in response, and spark logic"
```

---

## Task 4: `ShipsController`

**Files:**
- Create: `mingldingl_engine/src/MinglDingl.Engine/DTOs/ShipDto.cs`
- Create: `mingldingl_engine/src/MinglDingl.Engine/Controllers/ShipsController.cs`
- Test: `mingldingl_engine/tests/MinglDingl.Engine.Tests/Integration/ShipsControllerIntegrationTests.cs`

**Interfaces:**
- Consumes: `ShipService.CreateAsync`, `ShipService.RespondAsync` (Task 3).
- Produces: `POST /ships`, `GET /ships/pending`, `POST /ships/{id}/respond` — consumed by the app's `apiClient.ships.*` in Task 8.

- [ ] **Step 1: Write the failing tests**

```csharp
// mingldingl_engine/tests/MinglDingl.Engine.Tests/Integration/ShipsControllerIntegrationTests.cs
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MinglDingl.Engine.Tests.Integration;

public class ShipsControllerIntegrationTests : IntegrationTestBase
{
    private ShipsController BuildController(Guid userId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var scoreService = new ScoreService(Db, new ConfigService());
        var shipService = new ShipService(Db, new LootService(Db, scoreService), scoreService, new ConfigService());
        var controller = new ShipsController(shipService, Db)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    private User AddUser(string phone)
    {
        var user = NewCompleteUser();
        user.PhoneNumber = phone;
        Db.Users.Add(user);
        return user;
    }

    [Fact]
    public async Task Create_ValidPhones_ReturnsSuccess()
    {
        var weaver = AddUser("88120001");
        await Db.SaveChangesAsync();
        var controller = BuildController(weaver.Id);

        var result = await controller.Create(new CreateShipRequest("88120002", "88120003"));

        var response = Assert.IsType<CreateShipResponse>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.True(response.Success);
    }

    [Fact]
    public async Task Create_SelfNomination_ReturnsBadRequest()
    {
        var weaver = AddUser("88120001");
        await Db.SaveChangesAsync();
        var controller = BuildController(weaver.Id);

        var result = await controller.Create(new CreateShipRequest("88120001", "88120002"));

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task GetPending_ReturnsShipWeaverNameOnlyNoOtherSlotDetail()
    {
        var weaver = AddUser("88120001");
        var a = AddUser("88120002");
        var b = AddUser("88120003");
        await Db.SaveChangesAsync();
        await BuildController(weaver.Id).Create(new CreateShipRequest("88120002", "88120003"));

        var result = await BuildController(a.Id).GetPending();

        var response = Assert.IsType<List<PendingShipResponse>>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.Single(response);
        Assert.Equal(weaver.DisplayName, response[0].WeaverDisplayName);
        // PendingShipResponse only ever has ShipId + WeaverDisplayName —
        // the type itself is the guarantee here; nothing about slot B
        // could leak even if this test forgot to check for it explicitly.
    }

    [Fact]
    public async Task Respond_BothAccept_SecondResponseReportsSparked()
    {
        var weaver = AddUser("88120001");
        var a = AddUser("88120002");
        var b = AddUser("88120003");
        await Db.SaveChangesAsync();
        await BuildController(weaver.Id).Create(new CreateShipRequest("88120002", "88120003"));
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);

        var first = await BuildController(a.Id).Respond(ship.Id, new RespondToShipRequest(true));
        var second = await BuildController(b.Id).Respond(ship.Id, new RespondToShipRequest(true));

        var firstBody = Assert.IsType<RespondToShipResponse>(Assert.IsType<OkObjectResult>(first).Value);
        var secondBody = Assert.IsType<RespondToShipResponse>(Assert.IsType<OkObjectResult>(second).Value);
        Assert.False(firstBody.Sparked);
        Assert.True(secondBody.Sparked);
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter FullyQualifiedName~ShipsControllerIntegrationTests`
Expected: FAIL — `ShipsController`, `CreateShipRequest`, etc. don't exist.

- [ ] **Step 3: Add the DTOs**

```csharp
// mingldingl_engine/src/MinglDingl.Engine/DTOs/ShipDto.cs
public record CreateShipRequest(string SlotAPhoneNumber, string SlotBPhoneNumber);
public record CreateShipResponse(bool Success, string? Error);

// Deliberately carries nothing about the other slot — see the spec's
// privacy constraint. WeaverDisplayName is safe: the Weaver's identity is
// meant to be visible (it's the trust signal), only the other nominee's
// isn't.
public record PendingShipResponse(Guid ShipId, string WeaverDisplayName);

public record RespondToShipRequest(bool Accept);
public record RespondToShipResponse(bool Sparked);
```

- [ ] **Step 4: Implement `ShipsController`**

```csharp
// mingldingl_engine/src/MinglDingl.Engine/Controllers/ShipsController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("ships")]
[Authorize]
[Produces("application/json")]
public class ShipsController : ControllerBase
{
    private readonly ShipService _ships;
    private readonly AppDbContext _db;

    public ShipsController(ShipService ships, AppDbContext db)
    {
        _ships = ships;
        _db = db;
    }

    [HttpPost]
    [ProducesResponseType(typeof(CreateShipResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateShipRequest req)
    {
        var userId = this.CurrentUserId();
        var (success, error) = await _ships.CreateAsync(userId, req.SlotAPhoneNumber, req.SlotBPhoneNumber);
        if (!success) return this.BadRequestError(error ?? "Could not weave this thread");
        return Ok(new CreateShipResponse(true, null));
    }

    [HttpGet("pending")]
    [ProducesResponseType(typeof(List<PendingShipResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPending()
    {
        var userId = this.CurrentUserId();
        var pending = await _db.Ships
            .Where(s => s.Status == "Pending" &&
                ((s.SlotAUserId == userId && s.SlotAOptIn == "PendingOptIn") ||
                 (s.SlotBUserId == userId && s.SlotBOptIn == "PendingOptIn")))
            .Join(_db.Users, s => s.ShipperUserId, u => u.Id, (s, u) => new { s.Id, u.DisplayName })
            .ToListAsync();

        return Ok(pending.Select(p => new PendingShipResponse(p.Id, p.DisplayName)).ToList());
    }

    [HttpPost("{id}/respond")]
    [ProducesResponseType(typeof(RespondToShipResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Respond(Guid id, [FromBody] RespondToShipRequest req)
    {
        var userId = this.CurrentUserId();
        bool sparked = await _ships.RespondAsync(userId, id, req.Accept);
        return Ok(new RespondToShipResponse(sparked));
    }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter FullyQualifiedName~ShipsControllerIntegrationTests`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mingldingl_engine/src/MinglDingl.Engine/DTOs/ShipDto.cs \
        mingldingl_engine/src/MinglDingl.Engine/Controllers/ShipsController.cs \
        mingldingl_engine/tests/MinglDingl.Engine.Tests/Integration/ShipsControllerIntegrationTests.cs
git commit -m "feat(engine): add ShipsController (create/pending/respond)"
```

---

## Task 5: Resolve Ship invite codes during onboarding

**Files:**
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Controllers/UsersController.cs`
- Modify: `mingldingl_engine/tests/MinglDingl.Engine.Tests/Integration/UsersControllerIntegrationTests.cs`

**Interfaces:**
- Consumes: `ShipService.TryResolveInviteCodeAsync` (Task 3).

- [ ] **Step 1: Write the failing test**

Add to `mingldingl_engine/tests/MinglDingl.Engine.Tests/Integration/UsersControllerIntegrationTests.cs` — extend `BuildController` (already modified by the Recruit an Ally plan to build a `ReferralService`) to also build and pass a `ShipService`:

```csharp
    private UsersController BuildController(Guid userId, string? phone = null)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        httpContext.Items["PhoneNumber"] = phone;
        var scoreService = new ScoreService(Db, new ConfigService());
        var lootService = new LootService(Db, scoreService);
        var referralService = new ReferralService(Db, lootService);
        var shipService = new ShipService(Db, lootService, scoreService, new ConfigService());
        var controller = new UsersController(Db, scoreService, referralService, shipService)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    [Fact]
    public async Task Upsert_WithShipInviteCode_ResolvesTheWaitingSlot()
    {
        var weaverId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(weaverId));
        await Db.SaveChangesAsync();
        var scoreService = new ScoreService(Db, new ConfigService());
        var shipService = new ShipService(Db, new LootService(Db, scoreService), scoreService, new ConfigService());
        await shipService.CreateAsync(weaverId, "88130001", "88130002"); // both AwaitingUser
        Db.ChangeTracker.Clear();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaverId);
        var code = ship.SlotAInviteCode!;

        var newUserId = Guid.NewGuid();
        var controller = BuildController(newUserId, phone: "88130001");
        await controller.Upsert(new CreateUserRequest(
            "New Nominee", 24, "Female", "Ulaanbaatar", "Fresh signup",
            ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"],
            ReferralCode: code));

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Ships.FindAsync(ship.Id);
        Assert.Equal(newUserId, reloaded!.SlotAUserId);
        Assert.Equal("PendingOptIn", reloaded.SlotAOptIn);
    }
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter FullyQualifiedName~UsersControllerIntegrationTests`
Expected: FAIL — `UsersController`'s constructor doesn't take a fourth `ShipService` parameter yet.

- [ ] **Step 3: Wire `ShipService` into `UsersController`**

Constructor (currently, post-Recruit-an-Ally, `public UsersController(AppDbContext db, ScoreService score, ReferralService referral)`):

```csharp
    private readonly AppDbContext _db;
    private readonly ScoreService _score;
    private readonly ReferralService _referral;
    private readonly ShipService _ships;

    public UsersController(AppDbContext db, ScoreService score, ReferralService referral, ShipService ships)
    {
        _db = db;
        _score = score;
        _referral = referral;
        _ships = ships;
    }
```

`Upsert`'s completion block (currently, post-Recruit-an-Ally):

```csharp
        DroppedItem? referralReward = null;
        if (user.IsProfileComplete && !wasComplete)
        {
            await _score.AwardAsync(userId, "ProfileComplete");
            referralReward = await _referral.TryCompleteReferralAsync(userId, req.ReferralCode);
        }

        return Ok(ToResponse(user) with { ReferralRewardItem = referralReward });
```

becomes:

```csharp
        DroppedItem? referralReward = null;
        if (user.IsProfileComplete && !wasComplete)
        {
            await _score.AwardAsync(userId, "ProfileComplete");
            referralReward = await _referral.TryCompleteReferralAsync(userId, req.ReferralCode);
            await _ships.TryResolveInviteCodeAsync(userId, req.ReferralCode);
        }

        return Ok(ToResponse(user) with { ReferralRewardItem = referralReward });
```

(The same `req.ReferralCode` field resolves both — at most one of `TryCompleteReferralAsync`/`TryResolveInviteCodeAsync` ever matches a given code, since they check disjoint, uniquely-namespaced columns. See this plan's Global Constraints.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test`
Expected: full suite PASS. Confirm no other test file constructs `UsersController` directly without the new fourth parameter.

- [ ] **Step 5: Commit**

```bash
git add mingldingl_engine/src/MinglDingl.Engine/Controllers/UsersController.cs \
        mingldingl_engine/tests/MinglDingl.Engine.Tests/Integration/UsersControllerIntegrationTests.cs
git commit -m "feat(engine): resolve ship invite codes on onboarding submit"
```

---

## Task 6: Surface the Weaver's reward via `GET /scores/me/detail`

**Files:**
- Modify: `mingldingl_engine/src/MinglDingl.Engine/DTOs/ScoreDto.cs`
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Controllers/ScoresController.cs`
- Modify: `mingldingl_engine/tests/MinglDingl.Engine.Tests/Integration/ScoresControllerIntegrationTests.cs`

**Interfaces:**
- Produces: `ScoreDetailResponse.PendingShipReward` (`DroppedItem?`) — consumed by the app's `GameHeader` in Task 12, alongside the existing `PendingReferralReward`.

- [ ] **Step 1: Write the failing test**

Add to `mingldingl_engine/tests/MinglDingl.Engine.Tests/Integration/ScoresControllerIntegrationTests.cs`:

```csharp
    [Fact]
    public async Task GetMyScoreDetail_PendingShipReward_SurfacesOnceThenClears()
    {
        var weaverId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(weaverId));
        await Db.SaveChangesAsync();
        Db.Ships.Add(new Ship
        {
            ShipperUserId = weaverId,
            Status = "Sparked",
            SlotAUserId = Guid.NewGuid(),
            SlotBUserId = Guid.NewGuid(),
            ShipperRewardItemId = LootService.Catalog[0].Id,
        });
        await Db.SaveChangesAsync();
        var controller = BuildController(weaverId);

        var first = Assert.IsType<ScoreDetailResponse>(Assert.IsType<OkObjectResult>(await controller.GetMyScoreDetail()).Value);
        Assert.NotNull(first.PendingShipReward);
        Assert.Equal(LootService.Catalog[0].Id, first.PendingShipReward!.Id);

        var second = Assert.IsType<ScoreDetailResponse>(Assert.IsType<OkObjectResult>(await controller.GetMyScoreDetail()).Value);
        Assert.Null(second.PendingShipReward);
    }
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter FullyQualifiedName~ScoresControllerIntegrationTests`
Expected: FAIL — `ScoreDetailResponse` has no `PendingShipReward`.

- [ ] **Step 3: Extend `ScoreDetailResponse`**

In `mingldingl_engine/src/MinglDingl.Engine/DTOs/ScoreDto.cs`, add a field after `PendingReferralReward` (post-Recruit-an-Ally):

```csharp
    DroppedItem? PendingReferralReward = null,
    DroppedItem? PendingShipReward = null);
```

- [ ] **Step 4: Implement the lookup**

In `mingldingl_engine/src/MinglDingl.Engine/Controllers/ScoresController.cs`, alongside the existing `pendingReferral` block (post-Recruit-an-Ally), add:

```csharp
        var pendingShip = await _db.Ships
            .Where(s => s.ShipperUserId == userId && s.Status == "Sparked" && s.ShipperNotifiedAt == null)
            .OrderBy(s => s.CreatedAt)
            .FirstOrDefaultAsync();

        DroppedItem? pendingShipReward = null;
        if (pendingShip is not null)
        {
            var item = LootService.Catalog.FirstOrDefault(c => c.Id == pendingShip.ShipperRewardItemId);
            if (item is not null)
                pendingShipReward = new DroppedItem(item.Id, item.NameKey, item.Rarity, item.ItemType);

            pendingShip.ShipperNotifiedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
```

and pass `pendingShipReward` as the final argument to the `ScoreDetailResponse` constructor call, after `pendingReward`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test`
Expected: full suite PASS.

- [ ] **Step 6: Commit**

```bash
git add mingldingl_engine/src/MinglDingl.Engine/DTOs/ScoreDto.cs \
        mingldingl_engine/src/MinglDingl.Engine/Controllers/ScoresController.cs \
        mingldingl_engine/tests/MinglDingl.Engine.Tests/Integration/ScoresControllerIntegrationTests.cs
git commit -m "feat(engine): surface pending ship rewards via score detail"
```

---

## Task 7: Ship expiry sweep

**Files:**
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Services/DailyMaintenanceBackgroundService.cs`
- Modify: `mingldingl_engine/tests/MinglDingl.Engine.Tests/Services/DailyMaintenanceBackgroundServiceTests.cs`

**Interfaces:**
- No new interfaces — pure internal behavior of the existing sweep.

- [ ] **Step 1: Write the failing tests**

Add to `mingldingl_engine/tests/MinglDingl.Engine.Tests/Services/DailyMaintenanceBackgroundServiceTests.cs`:

```csharp
    [Fact]
    public async Task RunSweepAsync_PendingShipOlderThan14Days_ExpiresIt()
    {
        var weaverId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(weaverId));
        await Db.SaveChangesAsync();
        Db.Ships.Add(new Ship
        {
            ShipperUserId = weaverId,
            Status = "Pending",
            CreatedAt = DateTime.UtcNow.AddDays(-15),
        });
        await Db.SaveChangesAsync();

        await BuildService().RunSweepAsync(CancellationToken.None);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaverId);
        Assert.Equal("Expired", reloaded.Status);
    }

    [Fact]
    public async Task RunSweepAsync_PendingShipWithin14Days_LeftUntouched()
    {
        var weaverId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(weaverId));
        await Db.SaveChangesAsync();
        Db.Ships.Add(new Ship
        {
            ShipperUserId = weaverId,
            Status = "Pending",
            CreatedAt = DateTime.UtcNow.AddDays(-3),
        });
        await Db.SaveChangesAsync();

        await BuildService().RunSweepAsync(CancellationToken.None);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaverId);
        Assert.Equal("Pending", reloaded.Status);
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter FullyQualifiedName~DailyMaintenanceBackgroundServiceTests`
Expected: FAIL — nothing expires pending ships yet.

- [ ] **Step 3: Add the expiry pass**

In `mingldingl_engine/src/MinglDingl.Engine/Services/DailyMaintenanceBackgroundService.cs`, add a `ShipExpiryPeriod` constant next to `DeletionGracePeriod`:

```csharp
    private static readonly TimeSpan ShipExpiryPeriod = TimeSpan.FromDays(14);
```

Inside `RunSweepAsync`, before the final `if (ghostedMatches.Count > 0 || ...)` save-guard line, add:

```csharp
        var shipExpiryCutoff = DateTime.UtcNow - ShipExpiryPeriod;
        var expiredShips = await db.Ships
            .Where(s => s.Status == "Pending" && s.CreatedAt < shipExpiryCutoff)
            .ToListAsync(ct);
        foreach (var ship in expiredShips)
            ship.Status = "Expired";
```

and extend the existing save-guard condition to include it:

```csharp
        if (ghostedMatches.Count > 0 || usersNeedingReset.Count > 0 || usersToAnonymize.Count > 0
            || expiredMemberships.Count > 0 || expiredShips.Count > 0)
            await db.SaveChangesAsync(ct);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test`
Expected: full suite PASS.

- [ ] **Step 5: Commit**

```bash
git add mingldingl_engine/src/MinglDingl.Engine/Services/DailyMaintenanceBackgroundService.cs \
        mingldingl_engine/tests/MinglDingl.Engine.Tests/Services/DailyMaintenanceBackgroundServiceTests.cs
git commit -m "feat(engine): expire stale pending Fated Threads after 14 days"
```

---

## Task 8: "Woven by" — `MatchResponse.WeaverDisplayName`

**Files:**
- Modify: `mingldingl_engine/src/MinglDingl.Engine/DTOs/MatchDto.cs`
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Controllers/MatchesController.cs`
- Test: `mingldingl_engine/tests/MinglDingl.Engine.Tests/Integration/MatchesControllerIntegrationTests.cs` (check whether this file exists first — if not, create it following the `BuildController` pattern from `UsersControllerIntegrationTests`, injecting `AppDbContext, ScoreService, GhostingService, QuestService, MilestoneService, PushNotificationService` per `MatchesController`'s current constructor)

**Interfaces:**
- Produces: `MatchResponse.WeaverDisplayName` (`string?`) — consumed by the app's `models/match.ts` and the chat-header banner in Task 11.

- [ ] **Step 1: Write the failing test**

```csharp
    [Fact]
    public async Task GetMyMatches_ShipOriginatedMatch_IncludesWeaverDisplayName()
    {
        var weaver = NewCompleteUser();
        weaver.DisplayName = "Bataar";
        var a = NewCompleteUser();
        var b = NewCompleteUser();
        Db.Users.AddRange(weaver, a, b);
        await Db.SaveChangesAsync();
        Db.Ships.Add(new Ship { Id = Guid.NewGuid(), ShipperUserId = weaver.Id, Status = "Sparked", SlotAUserId = a.Id, SlotBUserId = b.Id });
        await Db.SaveChangesAsync();
        var ship = await Db.Ships.FirstAsync(s => s.ShipperUserId == weaver.Id);
        Db.Matches.Add(new Match { InitiatorId = a.Id, ReceiverId = b.Id, Status = "Active", RevealLevel = 1, ShipId = ship.Id });
        await Db.SaveChangesAsync();

        var result = await BuildController(a.Id).GetMyMatches();

        var response = Assert.IsType<PagedResponse<MatchResponse>>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.Equal("Bataar", response.Items[0].WeaverDisplayName);
    }

    [Fact]
    public async Task GetMyMatches_OrdinaryMatch_WeaverDisplayNameIsNull()
    {
        var a = NewCompleteUser();
        var b = NewCompleteUser();
        Db.Users.AddRange(a, b);
        await Db.SaveChangesAsync();
        Db.Matches.Add(new Match { InitiatorId = a.Id, ReceiverId = b.Id, Status = "Active", RevealLevel = 1 });
        await Db.SaveChangesAsync();

        var result = await BuildController(a.Id).GetMyMatches();

        var response = Assert.IsType<PagedResponse<MatchResponse>>(Assert.IsType<OkObjectResult>(result).Value);
        Assert.Null(response.Items[0].WeaverDisplayName);
    }
```

If `MatchesControllerIntegrationTests.cs` doesn't already exist, its `BuildController` should look like:

```csharp
    private MatchesController BuildController(Guid userId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var scoreService = new ScoreService(Db, new ConfigService());
        var controller = new MatchesController(
            Db, scoreService, new GhostingService(Db, scoreService),
            new QuestService(Db, scoreService), new MilestoneService(Db),
            new PushNotificationService(new HttpClient(), Db))
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter FullyQualifiedName~MatchesControllerIntegrationTests`
Expected: FAIL — `MatchResponse` has no `WeaverDisplayName`.

- [ ] **Step 3: Extend `MatchResponse`**

In `mingldingl_engine/src/MinglDingl.Engine/DTOs/MatchDto.cs`, add a field to `MatchResponse`:

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
    string? WeaverDisplayName = null);
```

- [ ] **Step 4: Batch-resolve Weaver names in `GetMyMatches`**

In `mingldingl_engine/src/MinglDingl.Engine/Controllers/MatchesController.cs`, `GetMyMatches` currently ends:

```csharp
        var items = matches.Select(m => BuildMatchResponse(m, userId, me.MembershipLevel)).ToList();
```

Change to:

```csharp
        var shipIds = matches.Where(m => m.ShipId != null).Select(m => m.ShipId!.Value).Distinct().ToList();
        var weaverNamesByShipId = shipIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _db.Ships
                .Where(s => shipIds.Contains(s.Id))
                .Join(_db.Users, s => s.ShipperUserId, u => u.Id, (s, u) => new { s.Id, u.DisplayName })
                .ToDictionaryAsync(x => x.Id, x => x.DisplayName);

        var items = matches.Select(m => BuildMatchResponse(m, userId, me.MembershipLevel, weaverNamesByShipId)).ToList();
```

Update `BuildMatchResponse`'s signature and body:

```csharp
    private static MatchResponse BuildMatchResponse(Match m, Guid viewerId, string membership, IReadOnlyDictionary<Guid, string> weaverNamesByShipId)
    {
        var other = m.InitiatorId == viewerId ? m.Receiver : m.Initiator;
        int level = RevealService.GetRevealLevel(m);

        return new MatchResponse(
            m.Id, other.Id, m.Status, level, m.MessageCount,
            m.IcebreakerComplete, m.VideoCallUnlocked,
            new PartialUserProfile(
                DisplayName: level >= 1 ? other.DisplayName : null,
                FirstPhoto:  level >= 1 ? other.PhotoUrls.ElementAtOrDefault(0) : null,
                Bio:         level >= 1 ? other.Bio : null,
                Age:         level >= 2 ? other.Age : null,
                SecondPhoto: level >= 2 ? other.PhotoUrls.ElementAtOrDefault(1) : null,
                ThirdPhoto:  level >= 3 ? other.PhotoUrls.ElementAtOrDefault(2) : null,
                District:    level >= 3 ? other.City : null,
                Deep: level >= 4 && membership is "Silver" or "Gold" or "Platinum"
                    ? new UserDeepFields(other.HasKids, other.SmokingHabit, other.DrinkingHabit, other.Religion, other.Lifestyle)
                    : null,
                EquippedFrameId: level >= 1 ? other.EquippedFrameId : null,
                EquippedTitleId: level >= 1 ? other.EquippedTitleId : null,
                IsDeleted: other.IsDeleted),
            m.ShipId.HasValue ? weaverNamesByShipId.GetValueOrDefault(m.ShipId.Value) : null);
    }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test`
Expected: full suite PASS.

- [ ] **Step 6: Commit**

```bash
git add mingldingl_engine/src/MinglDingl.Engine/DTOs/MatchDto.cs \
        mingldingl_engine/src/MinglDingl.Engine/Controllers/MatchesController.cs \
        mingldingl_engine/tests/MinglDingl.Engine.Tests/Integration/MatchesControllerIntegrationTests.cs
git commit -m "feat(engine): surface the Weaver's name on ship-originated matches"
```

---

## Task 9: Regenerate frontend API types, `models/ship.ts`, and i18n copy

**Files:**
- Modify (generated): `mingldingl_app/lib/api/api.generated.d.ts`
- Create: `mingldingl_app/models/ship.ts`
- Create: `mingldingl_app/models/__tests__/ship.test.ts`
- Modify: `mingldingl_app/models/match.ts`
- Modify: `mingldingl_app/lib/api/apiClient.ts`
- Modify: `mingldingl_app/lib/i18n.ts`
- Modify: `mingldingl_app/lib/tiers.ts`

**Interfaces:**
- Produces: `parsePendingShip`, `apiClient.ships.{create,pending,respond}`, `Match.weaverDisplayName` — consumed by every remaining frontend task.

- [ ] **Step 1: Start the engine and regenerate types**

```bash
./mingldingl_engine/scripts/start-engine.sh &
sleep 5
cd mingldingl_app && npm run generate:api
```

- [ ] **Step 2: Write the failing test**

```typescript
// mingldingl_app/models/__tests__/ship.test.ts
import { parsePendingShip } from '../ship';

describe('parsePendingShip', () => {
  it('parses shipId and weaverDisplayName', () => {
    const ship = parsePendingShip({ shipId: 's1', weaverDisplayName: 'Bataar' } as any);
    expect(ship).toEqual({ shipId: 's1', weaverDisplayName: 'Bataar' });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd mingldingl_app && npm test -- models/__tests__/ship.test.ts`
Expected: FAIL — module `../ship` doesn't exist.

- [ ] **Step 4: Create `models/ship.ts`**

```typescript
// mingldingl_app/models/ship.ts
import type { components } from '../lib/api/api.generated';

export interface PendingShip {
  shipId: string;
  weaverDisplayName: string;
}

export function parsePendingShip(d: components['schemas']['PendingShipResponse']): PendingShip {
  return {
    shipId: d.shipId ?? '',
    weaverDisplayName: d.weaverDisplayName ?? '',
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd mingldingl_app && npm test -- models/__tests__/ship.test.ts`
Expected: PASS.

- [ ] **Step 6: Extend `models/match.ts`**

Add `weaverDisplayName?: string;` to the `Match` interface, and `weaverDisplayName: d.weaverDisplayName ?? undefined,` to `parseMatch`'s return object.

- [ ] **Step 7: Extend `apiClient.ts`**

Add to `mingldingl_app/lib/api/apiClient.ts`, after the `matches: { ... }` block:

```typescript
  ships: {
    create: (slotAPhoneNumber: string, slotBPhoneNumber: string) =>
      api.post<Schemas['CreateShipResponse']>('/ships', { slotAPhoneNumber, slotBPhoneNumber }).then((r) => r.data),
    pending: () => api.get<Schemas['PendingShipResponse'][]>('/ships/pending').then((r) => r.data),
    respond: (shipId: string, accept: boolean) =>
      api.post<Schemas['RespondToShipResponse']>(`/ships/${shipId}/respond`, { accept }).then((r) => r.data),
  },
```

- [ ] **Step 8: Add item-name-key mappings**

In `mingldingl_app/lib/tiers.ts`, add to `ITEM_NAME_KEYS`:

```typescript
  title_threadweaver: 'item_title_threadweaver', title_fateseer: 'item_title_fateseer',
  title_bondkeeper: 'item_title_bondkeeper',
```

- [ ] **Step 9: Add i18n copy**

In `mingldingl_app/lib/i18n.ts`, `en` block:

```typescript
    weave_thread_title: 'Weave a Thread',
    weave_thread_hint: "Know two souls who'd suit each other? Loose an arrow on their behalf.",
    first_thread_label: 'First thread',
    second_thread_label: 'Second thread',
    weave_thread_button: 'Loose the Arrow',
    ship_create_error: "The thread wouldn't take. Try again.",
    ship_sent_confirmation: 'Your arrow is loosed — fate will answer in time.',
    share_thread_invite: 'Share the Invitation',
    ship_invite_message: 'A friend on MingldIngl has someone in mind for you — come see who.',
    fated_threads_title: 'Fated Threads',
    ship_prompt_message: '{weaver} has loosed an arrow on your behalf. Someone out there may be worth meeting — will you find out?',
    ship_accept: 'Find Out',
    ship_pass: 'Not Now',
    thread_log_title: 'Thread Log',
    thread_log_empty: 'No threads woven yet.',
    thread_log_pending: 'Pending',
    thread_log_sparked: 'Sparked',
    woven_by: 'Woven by {name}',
    item_title_threadweaver: 'Thread-Weaver',
    item_title_fateseer: 'Fate-Seer',
    item_title_bondkeeper: 'Bond-Keeper',
```

`mn` block, same relative position:

```typescript
    weave_thread_title: 'Утас нэхэх',
    weave_thread_hint: 'Хоорондоо таарах хоёр хүнийг мэдэх үү? Тэдний төлөө сум харваарай.',
    first_thread_label: 'Эхний утас',
    second_thread_label: 'Хоёр дахь утас',
    weave_thread_button: 'Сум Харвах',
    ship_create_error: 'Утас холбогдсонгүй. Дахин оролдоно уу.',
    ship_sent_confirmation: 'Сум харвагдлаа — хувь заяа удахгүй хариулна.',
    share_thread_invite: 'Урилга хуваалцах',
    ship_invite_message: 'MingldIngl дээрх найз чинь танд хэн нэгнийг санал болгож байна — үзээрэй.',
    fated_threads_title: 'Хувь Тавилангийн Утаснууд',
    ship_prompt_message: '{weaver} таны төлөө сум харвалаа. Гадаа хэн нэгэн таныг хүлээж байж магадгүй — мэдэхийг хүсэж байна уу?',
    ship_accept: 'Мэдэх',
    ship_pass: 'Одоохондоо үгүй',
    thread_log_title: 'Утасны Тэмдэглэл',
    thread_log_empty: 'Одоогоор утас нэхээгүй байна.',
    thread_log_pending: 'Хүлээгдэж буй',
    thread_log_sparked: 'Холбогдсон',
    woven_by: '{name}-ийн нэхсэн',
    item_title_threadweaver: 'Утас-Нэхэгч',
    item_title_fateseer: 'Тавилан-Үзэгч',
    item_title_bondkeeper: 'Холбоо-Хамгаалагч',
```

(Flag both `mn` blocks added in this plan and the Recruit an Ally plan for a native speaker's pass before shipping — same caveat as noted there.)

- [ ] **Step 10: Run the full app test suite**

Run: `cd mingldingl_app && npm test`
Expected: full suite PASS.

- [ ] **Step 11: Commit**

```bash
git add mingldingl_app/lib/api/api.generated.d.ts mingldingl_app/models/ship.ts \
        mingldingl_app/models/__tests__/ship.test.ts mingldingl_app/models/match.ts \
        mingldingl_app/lib/api/apiClient.ts mingldingl_app/lib/i18n.ts mingldingl_app/lib/tiers.ts
git commit -m "feat(app): regenerate API types and add Ship models/copy"
```

---

## Task 10: "Weave a Thread" creation screen

**Files:**
- Create: `mingldingl_app/app/ship/new.tsx`

**Interfaces:**
- Consumes: `apiClient.ships.create` (Task 9).

- [ ] **Step 1: Implement the screen**

```tsx
// mingldingl_app/app/ship/new.tsx
import { useState } from 'react';
import { View, Text, Share, StyleSheet } from 'react-native';
import { Input } from 'tamagui';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { GameButton } from '../../components/ui/GameButton';
import { TiledBackdrop } from '../../components/ui/TiledBackdrop';
import { apiClient } from '../../lib/api/apiClient';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS } from '../../lib/theme';

const DUNGEON_WALL_ASSET = require('../../assets/textures/dungeon_wall.png');
const PHONE_REGEX = /^\d{8}$/;

export default function NewShipScreen() {
  const router = useRouter();
  const [slotA, setSlotA] = useState('');
  const [slotB, setSlotB] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const canSubmit = PHONE_REGEX.test(slotA) && PHONE_REGEX.test(slotB);

  async function handleWeave() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.ships.create(slotA, slotB);
      if (!result.success) {
        setError(result.error ?? i18n.t('ship_create_error'));
        return;
      }
      setSent(true);
    } catch {
      setError(i18n.t('ship_create_error'));
    } finally {
      setLoading(false);
    }
  }

  function shareInvite() {
    Share.share({ message: i18n.t('ship_invite_message') });
  }

  if (sent) {
    return (
      <View style={styles.container}>
        <TiledBackdrop source={DUNGEON_WALL_ASSET} opacity={0.08} />
        <ScreenHeader title={i18n.t('weave_thread_title')} onBack={() => router.back()} />
        <View style={styles.confirmWrap}>
          <Text style={styles.confirmText}>{i18n.t('ship_sent_confirmation')}</Text>
          <GameButton variant="primary" onPress={shareInvite}>{i18n.t('share_thread_invite')}</GameButton>
          <GameButton variant="ghost" onPress={() => router.back()}>{i18n.t('back')}</GameButton>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TiledBackdrop source={DUNGEON_WALL_ASSET} opacity={0.08} />
      <ScreenHeader title={i18n.t('weave_thread_title')} onBack={() => router.back()} />
      <View style={styles.form}>
        <Text style={styles.hint}>{i18n.t('weave_thread_hint')}</Text>
        <Text style={styles.label}>{i18n.t('first_thread_label')}</Text>
        <Input
          placeholder={i18n.t('phone_placeholder')}
          value={slotA}
          onChangeText={setSlotA}
          keyboardType="phone-pad"
          maxLength={8}
          backgroundColor={COLORS.panel}
          borderColor={COLORS.bronze}
          color={COLORS.text}
        />
        <Text style={styles.label}>{i18n.t('second_thread_label')}</Text>
        <Input
          placeholder={i18n.t('phone_placeholder')}
          value={slotB}
          onChangeText={setSlotB}
          keyboardType="phone-pad"
          maxLength={8}
          backgroundColor={COLORS.panel}
          borderColor={COLORS.bronze}
          color={COLORS.text}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <GameButton
          variant="primary"
          icon="bow-arrow"
          loading={loading}
          disabled={!canSubmit || loading}
          onPress={handleWeave}
        >
          {i18n.t('weave_thread_button')}
        </GameButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  form: { padding: 20, gap: 12 },
  hint: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textDim },
  label: { fontFamily: FONTS.display, fontSize: 12, color: COLORS.gold, letterSpacing: 1, marginTop: 8 },
  error: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ember },
  confirmWrap: { padding: 20, gap: 16, alignItems: 'center' },
  confirmText: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.text, textAlign: 'center' },
});
```

- [ ] **Step 2: Manual smoke check**

Run: `cd mingldingl_app && npx expo start --web --port 8081`, navigate to `/ship/new`, confirm the screen renders, the button stays disabled until both fields hold 8 digits, and a network error path (stop the engine, submit) shows `ship_create_error` instead of crashing.

- [ ] **Step 3: Commit**

```bash
git add mingldingl_app/app/ship/new.tsx
git commit -m "feat(app): add Weave a Thread creation screen"
```

---

## Task 11: Pending opt-in prompts

**Files:**
- Create: `mingldingl_app/hooks/usePendingShips.ts`
- Create: `mingldingl_app/components/quest/FatedThreadsSection.tsx`
- Create: `mingldingl_app/components/quest/__tests__/FatedThreadsSection.test.tsx`
- Modify: `mingldingl_app/lib/api/queryKeys.ts`
- Modify: `mingldingl_app/app/(tabs)/activity.tsx`

**Interfaces:**
- Consumes: `apiClient.ships.{pending,respond}` (Task 9).
- Produces: `FatedThreadsSection` component — mounted on the Missions tab (`activity.tsx`), which already hosts `QuestBoard` and is the natural home for another quest-board-styled section.

- [ ] **Step 1: Add the query key**

In `mingldingl_app/lib/api/queryKeys.ts`, add:

```typescript
  pendingShips: ['pendingShips'] as const,
```

- [ ] **Step 2: Write the failing test**

```tsx
// mingldingl_app/components/quest/__tests__/FatedThreadsSection.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FatedThreadsSection } from '../FatedThreadsSection';
import { apiClient } from '../../../lib/api/apiClient';

jest.mock('../../../lib/api/apiClient', () => ({
  apiClient: { ships: { pending: jest.fn(), respond: jest.fn() } },
}));

const mockPending = apiClient.ships.pending as jest.Mock;
const mockRespond = apiClient.ships.respond as jest.Mock;

function renderWithClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FatedThreadsSection />
    </QueryClientProvider>,
  );
}

describe('FatedThreadsSection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when there are no pending threads', async () => {
    mockPending.mockResolvedValue([]);
    const { queryByText } = renderWithClient();
    await waitFor(() => expect(mockPending).toHaveBeenCalled());
    expect(queryByText(/Fated Threads/i)).toBeNull();
  });

  it('renders a prompt per pending thread, naming only the Weaver', async () => {
    mockPending.mockResolvedValue([{ shipId: 's1', weaverDisplayName: 'Bataar' }]);
    const { findByText } = renderWithClient();
    expect(await findByText(/Bataar/)).toBeTruthy();
  });

  it('tapping Find Out calls respond with accept=true', async () => {
    mockPending.mockResolvedValue([{ shipId: 's1', weaverDisplayName: 'Bataar' }]);
    mockRespond.mockResolvedValue({ sparked: false });
    const { findByText } = renderWithClient();
    await findByText(/Bataar/);

    fireEvent.press(await findByText('Find Out'));

    await waitFor(() => expect(mockRespond).toHaveBeenCalledWith('s1', true));
  });

  it('tapping Not Now calls respond with accept=false', async () => {
    mockPending.mockResolvedValue([{ shipId: 's1', weaverDisplayName: 'Bataar' }]);
    mockRespond.mockResolvedValue({ sparked: false });
    const { findByText } = renderWithClient();
    await findByText(/Bataar/);

    fireEvent.press(await findByText('Not Now'));

    await waitFor(() => expect(mockRespond).toHaveBeenCalledWith('s1', false));
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd mingldingl_app && npm test -- components/quest/__tests__/FatedThreadsSection.test.tsx`
Expected: FAIL — modules don't exist.

- [ ] **Step 4: Implement `usePendingShips`**

```typescript
// mingldingl_app/hooks/usePendingShips.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';
import { parsePendingShip } from '../models/ship';

export function usePendingShips() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.pendingShips,
    queryFn: async () => (await apiClient.ships.pending()).map(parsePendingShip),
  });

  const respond = useMutation({
    mutationFn: ({ shipId, accept }: { shipId: string; accept: boolean }) =>
      apiClient.ships.respond(shipId, accept),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.pendingShips }),
  });

  return { pendingShips: query.data ?? [], respond: respond.mutate };
}
```

- [ ] **Step 5: Implement `FatedThreadsSection`**

```tsx
// mingldingl_app/components/quest/FatedThreadsSection.tsx
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { usePendingShips } from '../../hooks/usePendingShips';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

export function FatedThreadsSection() {
  const { pendingShips, respond } = usePendingShips();

  if (pendingShips.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{i18n.t('fated_threads_title')}</Text>
      {pendingShips.map((ship) => (
        <View key={ship.shipId} style={styles.card}>
          <Text style={styles.medallion}>🏹</Text>
          <Text style={styles.message}>
            {i18n.t('ship_prompt_message', { weaver: ship.weaverDisplayName })}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.pass]}
              onPress={() => respond({ shipId: ship.shipId, accept: false })}
            >
              <Text style={styles.passText}>{i18n.t('ship_pass')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.accept]}
              onPress={() => respond({ shipId: ship.shipId, accept: true })}
            >
              <Text style={styles.acceptText}>{i18n.t('ship_accept')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20, gap: 10, marginBottom: 16 },
  heading: { fontFamily: FONTS.display, fontSize: 12, color: COLORS.gold, letterSpacing: 2 },
  card: {
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.bronze,
    borderRadius: RADIUS.md, padding: 16, gap: 10,
  },
  medallion: { fontSize: 22 },
  message: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: 'center', borderWidth: 1 },
  pass: { borderColor: COLORS.bronze, backgroundColor: COLORS.panelRaised },
  passText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.textDim },
  accept: { borderColor: COLORS.gold, backgroundColor: 'rgba(217,127,31,0.15)' },
  acceptText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.gold },
});
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd mingldingl_app && npm test -- components/quest/__tests__/FatedThreadsSection.test.tsx`
Expected: PASS.

- [ ] **Step 7: Mount it on the Missions tab**

In `mingldingl_app/app/(tabs)/activity.tsx`, add the import `import { FatedThreadsSection } from '../../components/quest/FatedThreadsSection';` and render `<FatedThreadsSection />` directly above `<QuestBoard />` inside the `ScrollView`.

- [ ] **Step 8: Run the full app test suite**

Run: `cd mingldingl_app && npm test`
Expected: full suite PASS.

- [ ] **Step 9: Commit**

```bash
git add mingldingl_app/hooks/usePendingShips.ts \
        mingldingl_app/components/quest/FatedThreadsSection.tsx \
        mingldingl_app/components/quest/__tests__/FatedThreadsSection.test.tsx \
        mingldingl_app/lib/api/queryKeys.ts \
        mingldingl_app/app/\(tabs\)/activity.tsx
git commit -m "feat(app): add Fated Threads pending opt-in prompts to the Missions tab"
```

---

## Task 12: Thread Log card on the profile screen

**Files:**
- Create: `mingldingl_app/components/progression/ThreadLog.tsx`
- Create: `mingldingl_app/components/progression/__tests__/ThreadLog.test.tsx`
- Modify: `mingldingl_app/app/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: `useInventory()` (existing, `mingldingl_app/hooks/useInventory.ts`) — the same hook `TrophyCase` already calls, returning `{ items, isLoading, equip, isEquipping }` where `items` is `Schemas['OwnedItemResponse'][]` (each with camelCased `itemId, nameKey, rarity, itemType, acquiredAt, equipped`), read from `queryKeys.itemsMine`/`apiClient.items.mine`. `ThreadLog` reuses this hook directly rather than adding a new endpoint or query.

- [ ] **Step 1: Write the failing test**

```tsx
// mingldingl_app/components/progression/__tests__/ThreadLog.test.tsx
import { render } from '@testing-library/react-native';
import { ThreadLog } from '../ThreadLog';

describe('ThreadLog', () => {
  it('shows the empty state when no ship-milestone titles are owned', () => {
    const { getByText } = render(<ThreadLog ownedItemIds={[]} />);
    expect(getByText(/No threads woven yet/i)).toBeTruthy();
  });

  it('shows the Thread-Weaver title once earned', () => {
    const { getByText } = render(<ThreadLog ownedItemIds={['title_threadweaver']} />);
    expect(getByText('Thread-Weaver')).toBeTruthy();
  });

  it('shows all three milestone titles once earned, in ascending order', () => {
    const { getByText } = render(
      <ThreadLog ownedItemIds={['title_bondkeeper', 'title_threadweaver', 'title_fateseer']} />,
    );
    expect(getByText('Thread-Weaver')).toBeTruthy();
    expect(getByText('Fate-Seer')).toBeTruthy();
    expect(getByText('Bond-Keeper')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mingldingl_app && npm test -- components/progression/__tests__/ThreadLog.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `ThreadLog`**

```tsx
// mingldingl_app/components/progression/ThreadLog.tsx
import { View, Text, StyleSheet } from 'react-native';
import { AppCard } from '../ui/AppCard';
import { i18n } from '../../lib/i18n';
import { ITEM_NAME_KEYS } from '../../lib/tiers';
import { COLORS, FONTS } from '../../lib/theme';

const MILESTONE_TITLE_IDS = ['title_threadweaver', 'title_fateseer', 'title_bondkeeper'] as const;

interface Props {
  ownedItemIds: string[];
}

export function ThreadLog({ ownedItemIds }: Props) {
  const earned = MILESTONE_TITLE_IDS.filter((id) => ownedItemIds.includes(id));

  return (
    <AppCard style={styles.card}>
      <Text style={styles.heading}>{i18n.t('thread_log_title')}</Text>
      {earned.length === 0 ? (
        <Text style={styles.empty}>{i18n.t('thread_log_empty')}</Text>
      ) : (
        <View style={styles.list}>
          {earned.map((id) => (
            <Text key={id} style={styles.titleRow}>{i18n.t(ITEM_NAME_KEYS[id])}</Text>
          ))}
        </View>
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginBottom: 16, padding: 16, gap: 10 },
  heading: { fontFamily: FONTS.display, fontSize: 10, color: COLORS.textDim, letterSpacing: 2 },
  empty: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textDim },
  list: { gap: 6 },
  titleRow: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.gold },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd mingldingl_app && npm test -- components/progression/__tests__/ThreadLog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Mount it on the profile screen**

In `mingldingl_app/app/(tabs)/profile.tsx`, add the import `import { ThreadLog } from '../../components/progression/ThreadLog';` and `import { useInventory } from '../../hooks/useInventory';`, call `const { items } = useInventory();` alongside the component's other hooks, and render directly after `<InviteAllyCard referralCode={profile.referralCode} />` (from the Recruit an Ally plan) and before `<TrophyCase />`:

```tsx
      <ThreadLog ownedItemIds={items.map((i) => i.itemId ?? '')} />
```

- [ ] **Step 6: Run the full app test suite**

Run: `cd mingldingl_app && npm test`
Expected: full suite PASS.

- [ ] **Step 7: Commit**

```bash
git add mingldingl_app/components/progression/ThreadLog.tsx \
        mingldingl_app/components/progression/__tests__/ThreadLog.test.tsx \
        mingldingl_app/app/\(tabs\)/profile.tsx
git commit -m "feat(app): add Thread Log card to the profile screen"
```

---

## Task 13: Chat header "Woven by" banner

**Files:**
- Modify: `mingldingl_app/app/(tabs)/matches.tsx`
- Modify: `mingldingl_app/app/chat/[matchId].tsx`

**Interfaces:**
- Consumes: `Match.weaverDisplayName` (Task 9).

- [ ] **Step 1: Pass `weaverDisplayName` through the route params**

In `mingldingl_app/app/(tabs)/matches.tsx`, find the `router.push({ pathname: `/chat/${item.matchId}` as any, params: { name: ..., ... } })` call (around line 51) and add a `wovenBy` param:

```typescript
                  wovenBy: item.weaverDisplayName ?? '',
```

- [ ] **Step 2: Render the banner in the chat screen**

In `mingldingl_app/app/chat/[matchId].tsx`, extend the params type and render the banner right after `<ScreenHeader .../>`:

```typescript
  const { matchId, name, wovenBy } = useLocalSearchParams<{ matchId: string; name?: string; wovenBy?: string }>();
```

```tsx
      <ScreenHeader
        title={name || i18n.t('chat_title')}
        right={ /* ...unchanged... */ }
      />
      {!!wovenBy && (
        <Text style={styles.wovenByBanner}>{i18n.t('woven_by', { name: wovenBy })}</Text>
      )}
```

Add the style:

```typescript
  wovenByBanner: {
    fontFamily: FONTS.body, fontSize: 12, color: COLORS.gold,
    textAlign: 'center', paddingVertical: 4,
  },
```

- [ ] **Step 3: Manual smoke check**

Run the full stack per `mingldingl:verify`, create a sparked Ship end-to-end, open the resulting match's chat from the Matches list, confirm the banner reads "Woven by [Weaver name]"; open an ordinary (non-Ship) match's chat and confirm no banner renders.

- [ ] **Step 4: Commit**

```bash
git add mingldingl_app/app/\(tabs\)/matches.tsx mingldingl_app/app/chat/\[matchId\].tsx
git commit -m "feat(app): show a Woven by banner on ship-originated match chats"
```

---

## Task 14: Surface the Weaver's async reward in `GameHeader`

**Files:**
- Modify: `mingldingl_app/components/ui/GameHeader.tsx`
- Modify: `mingldingl_app/components/ui/__tests__/GameHeader.test.tsx` (created by the Recruit an Ally plan's Task 7 — extend it, don't recreate it)

**Interfaces:**
- Consumes: `scoreDetail.pendingShipReward` (Task 6, via regenerated types).

- [ ] **Step 1: Write the failing test**

Add to `mingldingl_app/components/ui/__tests__/GameHeader.test.tsx`, inside the existing `describe('GameHeader pending referral reward', ...)` block (or rename the `describe` to `'GameHeader pending async rewards'` if renaming reads more accurately — either is fine, just don't duplicate the `beforeEach`):

```tsx
  it('sets pendingDrop when scoreDetail carries a pendingShipReward', async () => {
    mockDetail.mockResolvedValue({
      totalScore: 100, gemTier: 'Garnet',
      pendingShipReward: { nameKey: 'item_title_threadweaver', rarity: 'Common' },
    });

    renderWithClient(<GameHeader title="Seek Companions" showScore />);

    await waitFor(() => {
      expect(useAuthStore.getState().pendingDrop).toEqual({ nameKey: 'item_title_threadweaver', rarity: 'Common' });
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mingldingl_app && npm test -- components/ui/__tests__/GameHeader.test.tsx`
Expected: FAIL — nothing reads `pendingShipReward` yet.

- [ ] **Step 3: Extend the effect**

In `mingldingl_app/components/ui/GameHeader.tsx`, the effect added by the Recruit an Ally plan:

```typescript
  useEffect(() => {
    if (scoreDetail?.pendingReferralReward) {
      setPendingDrop(scoreDetail.pendingReferralReward);
    }
  }, [scoreDetail?.pendingReferralReward, setPendingDrop]);
```

becomes:

```typescript
  useEffect(() => {
    if (scoreDetail?.pendingReferralReward) {
      setPendingDrop(scoreDetail.pendingReferralReward);
    } else if (scoreDetail?.pendingShipReward) {
      setPendingDrop(scoreDetail.pendingShipReward);
    }
  }, [scoreDetail?.pendingReferralReward, scoreDetail?.pendingShipReward, setPendingDrop]);
```

(An `else if`, not two independent effects — on the vanishingly unlikely tick where both are pending simultaneously, only one `LootToast` can show at a time anyway; the referral one wins arbitrarily and the ship one surfaces on the next poll, exactly like `GameHeader`'s existing tier-up/streak/drop priority comment already documents for its other pending states.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd mingldingl_app && npm test -- components/ui/__tests__/GameHeader.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full app test suite**

Run: `cd mingldingl_app && npm test`
Expected: full suite PASS.

- [ ] **Step 6: Commit**

```bash
git add mingldingl_app/components/ui/GameHeader.tsx mingldingl_app/components/ui/__tests__/GameHeader.test.tsx
git commit -m "feat(app): surface pending ship rewards in GameHeader"
```

---

## Manual verification (after all tasks)

Per `mingldingl:verify` — run the full stack, create real test users via Supabase JWTs:
1. User A (Weaver) opens `/ship/new`, enters two 8-digit phone numbers belonging to Users B and C (already onboarded), submits.
2. As User B, confirm `GET /ships/pending` (surfaced via the Fated Threads section on the Missions tab) shows a prompt naming User A but nothing about User C.
3. User B accepts; confirm nothing sparks yet (no match, no reward).
4. As User C, accept the same prompt; confirm a match now exists between B and C, its chat shows "Woven by [A's name]," and neither B's nor C's `DailyMatchesUsed` incremented.
5. As User A, open a `showScore` screen and confirm the loot toast fires for the ship-sparked reward, and re-opening doesn't repeat it.
6. Repeat the full cycle 4 times with fresh phone numbers to confirm `title_threadweaver` is granted to User A after the first spark, and that a 5th `POST /ships` on the same day is rejected once the daily cap is reached.
7. Create a Ship where one slot is a brand-new phone number; complete onboarding for that number with the invite code entered in the referral field; confirm the prompt then appears for that new user too.

---

# No-Show Tracking — Design Spec

## Context

Gap identified in review: `GhostingService` punishes chat silence, but nothing
in the app holds anyone accountable for actual in-person date conduct — a
confirmed date (`DateConfirmation`) is just a mutual checkbox with no
follow-up, `BusinessRating` rates the venue not the person, and there is no
no-show tracking anywhere in the codebase (confirmed by direct search).

This spec closes the no-show gap specifically — not general date-behavior
rating (rudeness, catfishing, etc.), which was explicitly scoped out as a
separate, harder problem: subjective ratings are a well-documented
weaponization vector (retaliatory low ratings after a rejection), and this
project already has a locked decision against a formal in-app Report flow
("block + unmatch is sufficient"). No-show tracking stays on the safe side
of that line because "did the two of you meet up" is objective, not a
judgment call — unlike "was this person rude."

## Decisions locked in during brainstorming

- **A single mismatched self-report is never enough to penalize anyone.**
  One person claiming "we met" against the other claiming "we didn't" is an
  unresolvable he-said/she-said with no ground truth (no GPS check-in, no
  photo proof) — automatically docking the "no" side's `ReputationScore`
  off one disputed claim would recreate exactly the retaliation risk this
  spec is designed to avoid, just moved from ratings to no-show reports.
- **Only a repeated pattern is safe to act on automatically.** A single
  mismatch is recorded but inert; `ReputationScore` is only touched once a
  user accumulates enough mismatches (as the non-confirming/denying side,
  across *different* matches) to make coincidence or a one-off dispute
  implausible.
- Reuses `ScoreService`'s existing penalty mechanism (same shape as
  `GhostPenalty`, `-0.1` per event) rather than inventing a new one.
- No scheduling UI change: dates aren't given an exact date/time in the
  current model (`DateConfirmation` has no time field, just a mutual
  confirm), so the check-in prompt fires a fixed window after *mutual*
  confirmation, not at a specific appointment time. Adding a real
  date/time picker to the confirm flow is out of scope here.

## Data model

New column on `DateConfirmation`:

```
DateConfirmation
  ... (existing fields unchanged)
  CompletedAt         DateTime?   -- set once, the moment IsComplete flips true
  InitiatorAttended   bool?       -- null = not yet asked/answered
  ReceiverAttended    bool?
```

`CompletedAt` doesn't exist today — `CreatedAt` is set at *first*-side-confirm,
not both-sides-confirm, so it can't anchor "48h after we both agreed to meet."

New column on `User`:

```
User
  ... (existing fields unchanged)
  NoShowFlagCount   int   -- times this user was the non-confirming/denying
                             side of a mismatch, across distinct matches
```

## API

### `GET /activities/{matchId}/attendance-check`

Returns whether an attendance prompt is due for the current user: `CompletedAt`
is set, at least 48h have passed, and the caller's `XAttended` field is still
null. Response: `{ Due: bool, ActivityTitle: string }` (title only, so the
prompt can say "Did you meet up for [activity]?" without a second round-trip).

### `POST /activities/{matchId}/attendance-check`

Request: `{ Attended: bool }`.

```
confirmation = load by MatchId (most recent DateConfirmation, IsComplete = true)
if confirmation is null or CompletedAt is null or now - CompletedAt < 48h: reject
slot = InitiatorAttended/ReceiverAttended, whichever matches CurrentUserId()
if slot is not null: return current state (idempotent, no re-answering)
slot = req.Attended

if both InitiatorAttended and ReceiverAttended are now non-null:
    if InitiatorAttended == ReceiverAttended:
        // Both said yes, or both said no (a shared "it didn't happen,
        // that's fine") — no mismatch, no action either way.
        return
    // Mismatch: one said yes, the other said no.
    denyingUserId = whichever user answered false
    denyingUser.NoShowFlagCount++
    if denyingUser.NoShowFlagCount >= NoShowThreshold (ConfigKeys-tunable, default 3):
        await _score.AwardAsync(denyingUserId, "RepeatedNoShowPenalty")  // -0.1 ReputationScore, same shape as GhostPenalty
```

Rate/threshold value (`dating.noshow.threshold`, default `"3"`) lives in
`ConfigKeys.All`, admin-tunable — same pattern as every other tunable
threshold in this codebase, not hardcoded.

### Setting `CompletedAt`

One-line addition to `ActivityService.ConfirmAsync`'s existing
`justCompleted` branch (`ActivityService.cs:88`): set
`confirmation.CompletedAt = DateTime.UtcNow` alongside the existing
`AwardManyAsync`/`VideoCallUnlocked` side effects — no new code path, this
already has the "just now became complete" boolean it needs.

## Frontend

- **Attendance prompt** — surfaced the same way icebreaker/quiz nudges
  already are: a card in the existing "What's Next" section
  (`next_action_heading`) once `GET /activities/{matchId}/attendance-check`
  returns `Due: true`. Copy: *"Did you meet [name] for [activity]?"* with
  Yes/No buttons — no free-text field, nothing for either side to write
  about the other.
- **Date Log** (`app/date-log.tsx`) — entries that reached a mismatch show a
  neutral marker (e.g. "Unconfirmed") rather than exposing which side said
  what; this is a private view of the viewer's own history, never shared.
- No visible consequence anywhere in the UI for a single mismatch — by
  design, per the "one instance is never enough" decision above. The first
  time a user notices anything is if `NoShowFlagCount` crosses the
  threshold and their `ReputationScore` moves, exactly like an existing
  `GhostPenalty` — no separate "you've been flagged" messaging needed
  since it folds into a signal that already exists and is already
  understood.

## Anti-abuse

- No single disputed claim ever produces a penalty (see Decisions) — this
  is the core protection, not an add-on.
- Idempotent answering: once a user answers the attendance check for a
  given `DateConfirmation`, they can't re-answer (no way to "take it back"
  after seeing the other side's answer, since answers aren't revealed to
  each other at all — mirrors `Fated Threads`' opt-in-blind pattern).
- 48h cooldown before the prompt is even eligible, so it can't be used to
  pressure someone mid-date or immediately after.
- Threshold-gated (`NoShowThreshold`, default 3 *distinct matches*) rather
  than a raw mismatch counter, so one person can't be targeted repeatedly
  by the same bad-faith user to fabricate a pattern — each contributing
  mismatch must come from a different match.

## Testing

- Engine, `ActivityServiceTests`: `ConfirmAsync` sets `CompletedAt` exactly
  once, on the transition to `IsComplete`, not on every call.
- Engine, `ActivitiesControllerTests` (or a new `AttendanceServiceTests`):
  - attendance-check endpoint rejects before 48h have passed
  - both-attended and both-denied are no-ops (no `NoShowFlagCount` change
    for either party)
  - a mismatch increments `NoShowFlagCount` only for the denying side
  - `ReputationScore` is untouched below the threshold, docked exactly once
    the threshold is crossed
  - re-answering after already answering is a no-op (idempotent)
  - two mismatches from the *same* match pair don't double-count toward
    the threshold (must be distinct `MatchId`s)
- App: render test for the attendance prompt card; a test confirming no UI
  ever reveals the other party's answer.

## Out of scope (v1)

- Rating date-partner conduct beyond attendance (rudeness, catfishing,
  etc.) — flagged separately as a harder problem needing its own
  brainstorm given the weaponization risk.
- Real date/time scheduling in the confirm flow (currently just mutual
  "yes, let's do this") — the 48h-after-mutual-confirmation window is the
  v1 substitute for an actual appointment time.
- Any admin-visible pattern dashboard for no-show flags — `NoShowFlagCount`
  is tracked but not surfaced anywhere beyond the private per-user
  `ReputationScore` effect once thresholded.

---

# Domain Model & Product Background

# MingldIngl — Design Spec
**Date:** 2026-06-27 (infra/visual sections refreshed 2026-07-10)
**Author:** Solo developer + Claude
**Status:** Approved — core game design below still matches the running app; infra/visual/folder-structure sections were refreshed to match the current build (originally written pre-implementation, some details had drifted)

---

## Overview

MingldIngl is a gamified dating app targeting the Mongolian market, designed to solve the core failures of modern dating apps: ghosting, swipe fatigue, and lack of meaningful engagement. The app is open to all ages and situations (single parents, divorced adults, young adults) and replaces the disposable swipe loop with a score-based economy, gemstone tier identity, and progressive profile reveal that rewards real conversation.

---

## Repositories

| Repo | Purpose |
|---|---|
| `mingldingl_app` | React Native Expo mobile app (iOS + Android) |
| `mingldingl_engine` | ASP.NET Core API — monolithic, all business logic |

---

## Infrastructure (current, 2026-07-10)

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

## Tech Stack

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

## Visual Design — Dark-Fantasy RPG Theme (current, replaces the original "Dark Luxury" direction)

### Feel
Warcraft/tower-defense-adjacent dark fantasy, not premium-luxury minimalism as originally spec'd — the app went through a full RPG reskin (2026-07-03, see `docs/superpowers/specs/2026-07-03-rpg-ui-overhaul-design.md`) plus a palette retheme afterward. Cinzel (display) + Alegreya (body) fonts. Single source of truth: `mingldingl_app/lib/theme.ts`.

### Color Tokens (`lib/theme.ts` COLORS)

| Token | Value | Use |
|---|---|---|
| `bg` | `#0A0B10` | Night-sky page background |
| `panel` / `panelRaised` / `panelDeep` | `#12141C` / `#1A1E2A` / `#07080D` | Cards, sheets, depth layers |
| `gold` / `goldBright` | `#D97F1F` / `#F5A83C` | Primary CTA, gem highlights |
| `bronze` | `#4A5A6B` | Structural borders (stony blue-grey) |
| `ember` | `#C1461E` | Warm firelight accent |
| `text` / `textDim` | `#EDE4D3` / `#8F97A3` | Body text / muted |

### Gem Tier Palette (Garnet → Emerald, renamed from the original Pebble → Diamond)

| Tier | Color | Score threshold |
|---|---|---|
| Garnet | `#7B2431` | 0 |
| Opal | `#B2EBF2` | 100 |
| Amethyst | `#CE93D8` | 250 |
| Sapphire | `#1E88E5` | 500 |
| Ruby | `#E53935` | 1000 |
| Emerald | `#50C878` | 2500 |

The age-adaptive theme toggle in the original spec was never built — one theme ships for everyone.

---

## 1. Identity System

Every user has four identity layers:

| Layer | Description |
|---|---|
| **Profile** | Basic info (name, age, photos) and deep info (kids, habits, lifestyle) |
| **Gemstone Tier** | Visual rank calculated from cumulative score |
| **Reputation Score** | Affected by behavior — ghosting, positive tags, conversation quality |
| **Membership Level** | Free / Silver / Gold / Platinum — unlocks deeper profile fields and features |

### Gemstone Tiers (ascending)
Pebble → Opal → Amethyst → Sapphire → Ruby → Diamond

Tier is displayed visually on the user's profile card with a gem icon and animated border. Tier progression is purely score-based — no purchases can directly buy a tier.

### Profile Fields
- **Basic (free):** Name, age, gender, city, 3 photos, short bio
- **Deep (membership-gated):** Kids, habits (smoking/drinking), lifestyle, religion, income range, more photos

Full profile completion on signup grants an immediate score bonus (+100 pts).

---

## 2. Score Economy

### Earning Points
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

### Losing Points
| Activity | Penalty |
|---|---|
| Ghost a match (no reply 48h) | -15 |
| Receive a negative report | -30 |

### Daily Match Budget
- Base: 5 match requests per day
- Each 50 points above base tier minimum grants +1 match slot (cap: 20/day)
- Membership tiers also increase base match budget

---

## 3. Match Engine

### Matching Logic
- Candidates weighted by score proximity and gemstone tier (soft filter — not a hard wall)
- Location-aware (city/region in Mongolia)
- Age preference range set by user

### Progressive Profile Reveal

| Milestone | Unlocked |
|---|---|
| Match accepted | First name, 1 photo, short bio |
| 5 messages exchanged | 2nd photo, age |
| 15 messages exchanged | 3rd photo, city district |
| 30 messages exchanged | Deep profile fields (if membership allows) |

If conversation dies (48h no reply), unlock progress freezes.

### Anti-Ghosting
- 48h inactivity triggers a soft nudge notification
- Ghosting applies a score penalty
- Repeated ghosters get a "Slow Responder" tag visible to future matches

---

## 4. Engagement Engine

### Icebreakers
First interaction in a new match is a prompted question/mini-game — both users answer independently, answers revealed simultaneously. Completing unlocks chat and earns +20 pts each.

### Compatibility Quizzes
Short quizzes (5 questions) on values, lifestyle, interests. Results shown as compatibility % with each match. Earns +15 pts.

### Activity Suggestions
After 15+ messages, the app surfaces contextual activity suggestions (coffee, hiking, cinema, board game café). Both users tapping "We're doing this" confirms an activity date and earns +50 pts each. Unlocks the video call button in chat.

### Video Calls
- In-app video via **Agora SDK**
- Max call duration: 30 minutes
- Unlocked only after activity date confirmed
- Call completion earns +30 pts each
- Video call history is private, not stored

---

## 5. Business Partner System

Verified businesses (cafés, cinemas, hiking operators) appear in activity suggestions.

### Business Accounts
- Separate account type; profile includes name, category, location, photos, hours
- Verified badge shown in activity suggestion cards

### User Ratings
After confirmed activity date, both users rate the business (1–5 stars + optional review). Aggregated into a public Business Reputation Score.

### Business Monetization
| Feature | Model |
|---|---|
| Basic listing | Free |
| Featured placement in activity suggestions | Paid (monthly subscription) |
| Promoted activity packages | Paid per listing |

---

## 6. Monetization Layer

All monetization is additive — free users have a full experience.

| Feature | Model | Detail |
|---|---|---|
| **Fun Tags** | Paid (per tag or pack) | Personality labels gifted to matches, visible on their profile card |
| **Reputation Repair** | Paid (tiered pricing) | Reset/reduce reputation penalty from ghosting or reports |
| **Membership Tiers** | Subscription | Unlock deep profile, more daily matches, profile boost, see who liked you |
| **Score Boosters** | One-time purchase | Extra daily match slots, XP multiplier for 24h |
| **Profile Boost** | One-time purchase | Featured in discovery for 1–3 hours |

### Membership Tiers
| Tier | Benefits |
|---|---|
| Free | 5 matches/day, basic profile, icebreakers, quizzes |
| Silver | 10 matches/day, deep profile view, see compatibility % |
| Gold | 15 matches/day, profile boost 1x/week, fun tag pack monthly |
| Platinum | 20 matches/day, all features, priority matching, reputation repair discount |

---

## 7. Screen Inventory

| Screen | Route | Key Behavior |
|---|---|---|
| Phone input | `(auth)/phone` | +976 prefix, 8-digit Mongolian validation |
| OTP verify | `(auth)/otp` | 6-digit code, resend option |
| Onboarding wizard | `(onboarding)/index` | 3 steps: Name/Age/Gender → Bio/City → Photos (min 3); POST /users; +100 pts |
| Discover | `(tabs)/discover` | Card stack; match/pass; daily budget counter |
| Matches list | `(tabs)/matches` | Progressive reveal info per message milestone |
| Chat | `chat/[matchId]` | Supabase Realtime; icebreaker banner; video icon if unlocked |
| Icebreaker | `icebreaker/[matchId]` | Prompted question → simultaneous reveal when both answered |
| Quiz | `quiz/[matchId]` | 5 questions → compatibility % |
| Activity | `(tabs)/activity` | Business partner cards; "We're doing this" CTA |
| Profile | `(tabs)/profile` | Score, gem tier badge, photo grid, membership level |
| Membership | `membership` | Tier comparison, upgrade CTA |
| Video call | `video/[matchId]` | Agora RTC; 30-min cap; unlocked after activity confirmed |

---

## 8. Folder Structure

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
│   │   └── profile.tsx
│   ├── chat/[matchId].tsx
│   ├── icebreaker/[matchId].tsx
│   ├── quiz/[matchId].tsx
│   ├── video/[matchId].tsx
│   └── membership.tsx
├── components/        # flat, not per-feature — GameButton, AppCard, QuestTile,
│                      # CandidateCard, MessageBubble, ChestModal, vfx/, etc.
├── hooks/             # flat, one per concern — useAuth, useDiscover, useMatches,
│                      # useChat, useIcebreaker, useQuiz, useActivity, useQuests,
│                      # useMembership, useRealtimeNudges, usePushNotifications, ...
├── lib/
│   ├── apiClient.ts + api.generated.d.ts   # typed REST client to the engine
│   ├── theme.ts       # COLORS/FONTS/SPACE/RADIUS — see Visual Design above
│   ├── tiers.ts        # gem tier colors/thresholds (client-side copy — see gap note)
│   ├── i18n.ts         # EN + MN strings
│   ├── queryKeys.ts + queryClient.ts       # react-query
│   └── supabase.ts    # auth + realtime only, no DB/storage access anymore
├── models/            # TypeScript interfaces (user, match, business)
├── store/
│   └── authStore.ts   # Zustand: session, userProfile, streak, pending toasts
├── tamagui.config.ts
├── babel.config.js
├── app.json
├── tsconfig.json
└── package.json
```

(The original spec described a per-feature `features/{name}/{components,hooks}` structure; the app shipped with flat `components/`/`hooks/`/`lib/` directories instead.)

**Fixed (2026-07-10):** `lib/tiers.ts`'s `TIER_THRESHOLDS` used to disagree with the backend's authoritative `ScoreService.CalculateTier` (e.g. Amethyst at 250 client-side vs 300 server-side), so `authStore.addScore()`'s optimistic tier-up toast could fire early and then silently revert on the next profile refetch. Thresholds now match exactly (`[0, 100, 300, 600, 1000, 2000]`), and `tierForScore()` is derived from `TIER_THRESHOLDS`/`TIER_ORDER` rather than a separately-hardcoded chain, so the two can't drift apart again the way they did here. Both sides carry a comment pointing at the other.

---

## 9. Key Constraints

- **Solo developer** — monolithic engine, no microservices
- **Minimal cost** — local Postgres for dev (was Supabase free tier; Supabase is now backup-only), VPS for API in prod
- **Mongolian market** — phone login, mn + en i18n from day one
- **Expo web is actively used for dev/testing** (Playwright E2E, no device needed) — video calls are gated out on web by design, everything else works; mobile (iOS/Android) remains the real target for release
- **No real payments shipped** — membership tier upgrades are mocked, not wired to a payment gateway

---

## 10. Out of Scope (still true)

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

**What it is:** sub-project 1 of a 9-part "dashboard control expansion" roadmap to move hardcoded engine values (membership pricing, score/XP deltas, tier thresholds, quest definitions, matching weights, festivals, feature flags) into dashboard-editable config instead of requiring a deploy to change. This sub-project built the **generic foundation** the other sub-projects plug into — one typed, admin-editable config store (`ConfigEntries` table + `ConfigService` in-memory cache + `AdminConfigController` list/update/revert, audit-logged), proven end-to-end by migrating exactly one value (the Gold tier threshold) off its hardcoded constant.

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
- `CreateUserRequest.ReferralCode`'s field name is feature-specific even though the
  **Fated Threads** (this document, above) plan designs it as a shared field for ship invite
  codes too — cosmetic now (the value itself is an opaque string, server disambiguates), but a rename
  after this ships would be a breaking API change worth avoiding by deciding the shared name before
  Fated Threads' Task 5 wires into the same field.
