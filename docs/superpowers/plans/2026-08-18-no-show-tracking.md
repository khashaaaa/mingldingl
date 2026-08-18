# No-Show Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 48h-after-confirmation "Did you meet up?" attendance check to confirmed dates, with an anti-abuse-hardened reputation penalty for users who repeatedly deny a match's claim of meeting up.

**Architecture:** Two new columns on `DateConfirmation` (`CompletedAt`, `InitiatorAttended`, `ReceiverAttended`) plus a `PenaltyApplied` guard column, one new column on `User` (`NoShowFlagCount`), a new atomic reputation-penalty primitive on `ScoreService`, two new methods on `ActivityService`, two new endpoints on `ActivitiesController`, and app-side: a hook, a small Yes/No modal, a conditional chat banner, and a neutral marker on the Date Log for mismatched entries.

**Tech Stack:** ASP.NET Core 8 / EF Core / PostgreSQL (engine), React Native / Expo / TanStack Query (app) — no new libraries.

**Spec:** `docs/superpowers/project-plan.md`, "No-Show Tracking — Design Spec" section (search for that heading — it's under "Open — Not Yet Built").

## Global Constraints

- A single mismatched self-report must never penalize anyone — only a pattern (default 3 mismatches, admin-tunable) across **distinct matches** triggers a reputation penalty.
- The penalty is `-0.1 ReputationScore` only — it must NOT touch `TotalScore` (unlike `GhostPenalty`, which docks both). This is a deliberate deviation from literally reusing `ScoreService.AwardAsync("GhostPenalty")`'s code path — see Task 3 for why a new method is needed.
- Neither participant ever sees the other's attendance answer — idempotent, one answer per user per `DateConfirmation`, no reveal.
- 48h cooldown after `CompletedAt` (the moment `IsComplete` first flips true) before the prompt is eligible at all.
- Threshold value lives in `ConfigKeys` (`dating.noshow.threshold`, default `"3"`), not hardcoded — same pattern as every other admin-tunable threshold in this codebase.
- **Deviation from the spec's literal UI placement:** the spec says "a card in the existing 'What's Next' section (`next_action_heading`)." Investigation found that section (`NextActionCard`/`useNextAction`) is a global, single-priority-slot reducer that explicitly avoids new network calls, sourcing everything from hooks already fetched elsewhere (`useProfile`, `useMatches`, `useQuests`, `useScoreDetail`) — it has no per-match fetch mechanism, and the attendance-check endpoint is inherently per-match (`GET /activities/{matchId}/attendance-check`). Forcing this in would mean adding an `AttendanceCheckDue` field to the global `MatchResponse` DTO and joining `DateConfirmations` on every `GET /matches` call for every user, which is a much bigger, unrelated change. Instead this plan surfaces the prompt as a fourth conditional `QuestBanner` on the chat screen (`app/chat/[matchId].tsx`), alongside the existing icebreaker/quiz/plan-encounter banners already rendered there — same "quick action nudge" visual language, correctly scoped per-match, one new fetch on a screen that's already match-scoped.

---

### Task 1: Data model — `DateConfirmation`/`User` columns and migration

**Files:**
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Models/DateConfirmation.cs`
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Models/User.cs:29` (after the `ReputationScore` line)
- Create: EF migration (generated file, name `AddNoShowTracking`)

**Interfaces:**
- Produces: `DateConfirmation.CompletedAt` (`DateTime?`), `DateConfirmation.InitiatorAttended` (`bool?`), `DateConfirmation.ReceiverAttended` (`bool?`), `DateConfirmation.PenaltyApplied` (`bool`, default `false`), `User.NoShowFlagCount` (`int`, default `0`) — all later tasks depend on these exact names.

- [ ] **Step 1: Add the new columns to `DateConfirmation.cs`**

Current file:
```csharp
public class DateConfirmation
{
    public Guid Id { get; set; }
    public Guid MatchId { get; set; }
    public Guid ActivitySuggestionId { get; set; }
    public bool InitiatorConfirmed { get; set; }
    public bool ReceiverConfirmed { get; set; }
    public bool IsComplete => InitiatorConfirmed && ReceiverConfirmed;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
```

Replace with:
```csharp
public class DateConfirmation
{
    public Guid Id { get; set; }
    public Guid MatchId { get; set; }
    public Guid ActivitySuggestionId { get; set; }
    public bool InitiatorConfirmed { get; set; }
    public bool ReceiverConfirmed { get; set; }
    public bool IsComplete => InitiatorConfirmed && ReceiverConfirmed;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Set once, the moment IsComplete first flips true (ActivityService.ConfirmAsync's
    // justCompleted branch) — CreatedAt is set at *first*-side-confirm, not
    // both-sides-confirm, so it can't anchor "48h after we both agreed to meet."
    public DateTime? CompletedAt { get; set; }

    // Attendance-check answers. Null = not yet asked/answered. Never revealed
    // to the other participant — see ActivityService.SubmitAttendanceAsync.
    public bool? InitiatorAttended { get; set; }
    public bool? ReceiverAttended { get; set; }

    // Set true the moment a mismatch on THIS row increments the denying
    // user's NoShowFlagCount. A single match can accumulate more than one
    // completed DateConfirmation (a user could confirm a second suggestion
    // after the first already completed — nothing in ActivityService.ConfirmAsync
    // blocks it server-side, even though the app's own UI never surfaces
    // that path). Without this guard, two mismatches on two different
    // suggestions for the *same* match pair could double-count toward the
    // NoShowThreshold, violating the "must be distinct matches" anti-abuse
    // guarantee. Checked in SubmitAttendanceAsync before incrementing.
    public bool PenaltyApplied { get; set; }
}
```

- [ ] **Step 2: Add `NoShowFlagCount` to `User.cs`**

Find this block (around line 27-29):
```csharp
    public int TotalScore { get; set; }
    public string GemTier { get; set; } = "Garnet"; // Garnet|Opal|Amethyst|Sapphire|Ruby|Emerald
    public decimal ReputationScore { get; set; } = 1.0m;
```

Add immediately after the `ReputationScore` line:
```csharp
    // Times this user was the non-confirming/denying side of an attendance
    // mismatch, across *distinct* matches (DateConfirmation.PenaltyApplied
    // enforces the distinctness) — see ActivityService.SubmitAttendanceAsync.
    // Only crossing NoShowThreshold (ConfigKeys "dating.noshow.threshold")
    // actually docks ReputationScore; this raw count is tracked unconditionally.
    public int NoShowFlagCount { get; set; }
```

- [ ] **Step 3: Generate the EF migration**

Run:
```bash
cd mingldingl_engine
DOTNET_ROOT=$HOME/.dotnet PATH="$HOME/.dotnet:$HOME/.dotnet/tools:$PATH" dotnet ef migrations add AddNoShowTracking --project src/MinglDingl.Engine
```

Expected: a new pair of files under `src/MinglDingl.Engine/Data/Migrations/` (`<timestamp>_AddNoShowTracking.cs` and `.Designer.cs`), plus an updated `AppDbContextModelSnapshot.cs`. Open the generated `Up()` method and confirm it contains exactly 5 `AddColumn` calls: `CompletedAt`, `InitiatorAttended`, `ReceiverAttended`, `PenaltyApplied` on `DateConfirmations`, and `NoShowFlagCount` on `Users`.

- [ ] **Step 4: Apply the migration**

Run:
```bash
DOTNET_ROOT=$HOME/.dotnet PATH="$HOME/.dotnet:$HOME/.dotnet/tools:$PATH" dotnet ef database update --project src/MinglDingl.Engine
```

Expected: `Done.` with no errors. Verify with:
```bash
PGPASSWORD=1234 psql -U postgres -h 127.0.0.1 -p 5432 -d mingldingl -c '\d "DateConfirmations"' -c '\d "Users"' | grep -E "CompletedAt|InitiatorAttended|ReceiverAttended|PenaltyApplied|NoShowFlagCount"
```
Expected: all 5 columns listed.

- [ ] **Step 5: Build to confirm the model compiles**

Run: `DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet build`
Expected: `Build succeeded. 0 Warning(s) 0 Error(s)`

- [ ] **Step 6: Commit**

```bash
cd mingldingl_engine
git add src/MinglDingl.Engine/Models/DateConfirmation.cs src/MinglDingl.Engine/Models/User.cs src/MinglDingl.Engine/Data/Migrations/
git commit -m "Add DateConfirmation attendance columns and User.NoShowFlagCount"
```

---

### Task 2: `ConfigKeys` — admin-tunable no-show threshold

**Files:**
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Services/ConfigKeys.cs`

**Interfaces:**
- Produces: config key `"dating.noshow.threshold"`, default `"3"` — Task 5 reads this via `ConfigService.GetNumber("dating.noshow.threshold", 3)`.

- [ ] **Step 1: Add the key**

Current file body:
```csharp
    public static readonly IReadOnlyList<ConfigKeyDefinition> All =
    [
        new("tier.sapphire.threshold", "Scoring", "Number", "600",
            "Minimum total score for the Sapphire gem tier"),
        new("ships.daily.cap", "Growth", "Number", "3",
            "Max Fated Threads a single Weaver can create per day"),
    ];
```

Replace with:
```csharp
    public static readonly IReadOnlyList<ConfigKeyDefinition> All =
    [
        new("tier.sapphire.threshold", "Scoring", "Number", "600",
            "Minimum total score for the Sapphire gem tier"),
        new("ships.daily.cap", "Growth", "Number", "3",
            "Max Fated Threads a single Weaver can create per day"),
        new("dating.noshow.threshold", "Safety", "Number", "3",
            "Distinct-match attendance mismatches before ReputationScore is docked"),
    ];
```

- [ ] **Step 2: Build to confirm it compiles**

Run: `DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet build`
Expected: `Build succeeded. 0 Warning(s) 0 Error(s)`

- [ ] **Step 3: Commit**

```bash
git add src/MinglDingl.Engine/Services/ConfigKeys.cs
git commit -m "Add dating.noshow.threshold admin-tunable config key"
```

(Program.cs's startup seed-if-missing loop picks up the new key automatically on next engine start — no migration or manual seed needed, per `ConfigKeys.cs`'s own header comment.)

---

### Task 3: `ScoreService` — reputation-only penalty primitive

**Files:**
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Services/ScoreService.cs`
- Create: `mingldingl_engine/tests/MinglDingl.Engine.Tests/Integration/ScoreServiceIntegrationTests.cs` (a plain `Services/ScoreServiceTests.cs` already exists but is a DB-less unit-test file — `CreateService()` there constructs `ScoreService` with `null!` for the `AppDbContext` since it only tests pure methods like `CalculateTier`/`GetDelta`. The new method needs a real Postgres connection for its atomic `UPDATE ... RETURNING`, so it belongs in a new `Integration/` file, matching every other DB-backed test in this suite.)

**Interfaces:**
- Consumes: nothing new — same `_db`/`_config` fields the class already has.
- Produces: `Task<decimal?> ApplyReputationPenaltyAsync(Guid userId, string eventType)` — returns the user's new `ReputationScore` (or `null` if the user doesn't exist). Task 5 calls this with `eventType = "RepeatedNoShowPenalty"`.

**Why a new method instead of `AwardAsync("GhostPenalty")`'s existing path:** `ApplyScoreDeltaAsync`'s `isGhostPenalty` branch docks *both* `TotalScore` (`GetDelta("GhostPenalty") == -15`) and `ReputationScore` (`-0.1`) together in one call — there's no existing path to touch only `ReputationScore`. Worse, `AwardAsync` early-returns before touching the DB at all when `GetDelta(eventType) == 0` (`if (delta == 0) return;`), so giving a new event type a zero `TotalScore` delta wouldn't even reach `ApplyScoreDeltaAsync`. The spec is explicit this penalty is `-0.1 ReputationScore` only, no `TotalScore` change — hence a small dedicated method, following the same atomic-`UPDATE ... RETURNING` pattern as `ApplyScoreDeltaAsync`'s `isGhostPenalty` branch (to avoid the same lost-update race class that pattern was built to close), but touching only `ReputationScore`.

- [ ] **Step 1: Write the failing test**

Create `mingldingl_engine/tests/MinglDingl.Engine.Tests/Integration/ScoreServiceIntegrationTests.cs`:

```csharp
namespace MinglDingl.Engine.Tests.Integration;

public class ScoreServiceIntegrationTests : IntegrationTestBase
{
    [Fact]
    public async Task ApplyReputationPenaltyAsync_DocksReputationOnly_LeavesTotalScoreUnchanged()
    {
        var user = NewCompleteUser();
        user.TotalScore = 100;
        user.ReputationScore = 1.0m;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var service = new ScoreService(Db, new ConfigService());
        var newReputation = await service.ApplyReputationPenaltyAsync(user.Id, "RepeatedNoShowPenalty");

        Assert.Equal(0.9m, newReputation);

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.FindAsync(user.Id);
        Assert.Equal(0.9m, reloaded!.ReputationScore);
        Assert.Equal(100, reloaded.TotalScore); // unchanged — this is the whole point of the new method

        var events = Db.ScoreEvents.Where(e => e.UserId == user.Id && e.EventType == "RepeatedNoShowPenalty").ToList();
        Assert.Single(events);
        Assert.Equal(0, events[0].Delta); // no TotalScore delta — the audit row still exists for the stats/history views
    }

    [Fact]
    public async Task ApplyReputationPenaltyAsync_NeverGoesBelowZero()
    {
        var user = NewCompleteUser();
        user.ReputationScore = 0.05m;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var service = new ScoreService(Db, new ConfigService());
        var newReputation = await service.ApplyReputationPenaltyAsync(user.Id, "RepeatedNoShowPenalty");

        Assert.Equal(0m, newReputation);
    }
}
```

- [ ] **Step 2: Run to verify it fails**

```bash
DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter "FullyQualifiedName~ApplyReputationPenaltyAsync"
```
Expected: build error — `ApplyReputationPenaltyAsync` doesn't exist yet on `ScoreService`.

- [ ] **Step 3: Implement `ApplyReputationPenaltyAsync`**

In `Services/ScoreService.cs`, add this new public method right after `AwardManyAsync` (before the `ApplyScoreDeltaAsync` private method):

```csharp
    // Reputation-only penalty — see this task's plan comment for why this
    // can't reuse AwardAsync/ApplyScoreDeltaAsync's isGhostPenalty branch.
    // Same atomic UPDATE ... RETURNING shape as that branch, to close the
    // identical lost-update race under concurrent penalties to the same user.
    public async Task<decimal?> ApplyReputationPenaltyAsync(Guid userId, string eventType)
    {
        var repResult = await _db.Database.SqlQuery<decimal>(
            $"""
            UPDATE "Users" SET "ReputationScore" = GREATEST(0, "ReputationScore" - 0.1)
            WHERE "Id" = {userId}
            RETURNING "ReputationScore"
            """).ToListAsync();
        if (repResult.Count == 0) return null; // user not found

        decimal newReputation = repResult[0];
        var tracked = _db.ChangeTracker.Entries<User>().FirstOrDefault(e => e.Entity.Id == userId)?.Entity;
        if (tracked is not null) tracked.ReputationScore = newReputation;

        _db.ScoreEvents.Add(new ScoreEvent { UserId = userId, EventType = eventType, Delta = 0 });
        await _db.SaveChangesAsync();

        return newReputation;
    }
```

- [ ] **Step 4: Run to verify it passes**

```bash
DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter "FullyQualifiedName~ApplyReputationPenaltyAsync"
```
Expected: `Passed! - Failed: 0, Passed: 2, Skipped: 0, Total: 2`

- [ ] **Step 5: Commit**

```bash
git add src/MinglDingl.Engine/Services/ScoreService.cs tests/MinglDingl.Engine.Tests/Integration/ScoreServiceIntegrationTests.cs
git commit -m "Add ScoreService.ApplyReputationPenaltyAsync for reputation-only penalties"
```

---

### Task 4: `ActivityService.ConfirmAsync` — set `CompletedAt`

**Files:**
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Services/ActivityService.cs:92-96`
- Test: `mingldingl_engine/tests/MinglDingl.Engine.Tests/Integration/ActivityServiceIntegrationTests.cs`

**Interfaces:**
- Consumes: `DateConfirmation.CompletedAt` from Task 1.
- Produces: `ConfirmAsync` now sets `CompletedAt` exactly once, on the transition to `IsComplete`. Task 5's attendance-check logic reads this field to compute the 48h window.

- [ ] **Step 1: Write the failing test**

Add to `ActivityServiceIntegrationTests.cs` (it already has `BuildService()` and `SeedMatchWithSuggestionAsync()` helpers — reuse them):

```csharp
    [Fact]
    public async Task ConfirmAsync_BothConfirm_SetsCompletedAtOnceOnTheCompletingCall()
    {
        var (match, suggestionId) = await SeedMatchWithSuggestionAsync();
        var service = BuildService();

        await service.ConfirmAsync(match, match.InitiatorId, suggestionId);

        Db.ChangeTracker.Clear();
        var afterFirst = await Db.DateConfirmations.FirstAsync(c => c.MatchId == match.Id);
        Assert.Null(afterFirst.CompletedAt);

        await service.ConfirmAsync(match, match.ReceiverId, suggestionId); // completes here

        Db.ChangeTracker.Clear();
        var afterSecond = await Db.DateConfirmations.FirstAsync(c => c.MatchId == match.Id);
        Assert.NotNull(afterSecond.CompletedAt);
        var completedAt = afterSecond.CompletedAt!.Value;

        // A repeat confirm after completion must not move CompletedAt forward.
        await Task.Delay(50);
        await service.ConfirmAsync(match, match.InitiatorId, suggestionId);

        Db.ChangeTracker.Clear();
        var afterRepeat = await Db.DateConfirmations.FirstAsync(c => c.MatchId == match.Id);
        Assert.Equal(completedAt, afterRepeat.CompletedAt);
    }
```

- [ ] **Step 2: Run to verify it fails**

```bash
DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter "FullyQualifiedName~ConfirmAsync_BothConfirm_SetsCompletedAtOnceOnTheCompletingCall"
```
Expected: FAIL — `afterSecond.CompletedAt` is `Null`, `Assert.NotNull` fails.

- [ ] **Step 3: Implement**

In `Services/ActivityService.cs`, find (around line 92-96):
```csharp
        if (justCompleted)
        {
            await _score.AwardManyAsync([(match.InitiatorId, "DateConfirmed"), (match.ReceiverId, "DateConfirmed")]);
            match.VideoCallUnlocked = true;
        }
```

Replace with:
```csharp
        if (justCompleted)
        {
            await _score.AwardManyAsync([(match.InitiatorId, "DateConfirmed"), (match.ReceiverId, "DateConfirmed")]);
            match.VideoCallUnlocked = true;
            confirmation.CompletedAt = DateTime.UtcNow;
        }
```

- [ ] **Step 4: Run to verify it passes**

```bash
DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter "FullyQualifiedName~ActivityServiceIntegrationTests"
```
Expected: all tests in this file pass, including the new one.

- [ ] **Step 5: Commit**

```bash
git add src/MinglDingl.Engine/Services/ActivityService.cs tests/MinglDingl.Engine.Tests/Integration/ActivityServiceIntegrationTests.cs
git commit -m "Set DateConfirmation.CompletedAt on the confirming-completion transition"
```

---

### Task 5: `ActivityService` — attendance-check status and submit

**Files:**
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Services/ActivityService.cs` (constructor + two new methods)
- Modify (test-only call sites): `mingldingl_engine/tests/MinglDingl.Engine.Tests/Integration/ActivityServiceIntegrationTests.cs:9` (`BuildService()`), `mingldingl_engine/tests/MinglDingl.Engine.Tests/Integration/ActivitiesControllerIntegrationTests.cs:9-24` (`BuildController()`)
- Test: `mingldingl_engine/tests/MinglDingl.Engine.Tests/Integration/ActivityServiceIntegrationTests.cs`

**Interfaces:**
- Consumes: `ConfigService` (new constructor dependency — DI already registers it as a Singleton, no registration change needed), `ScoreService.ApplyReputationPenaltyAsync` (Task 3), `DateConfirmation.CompletedAt/InitiatorAttended/ReceiverAttended/PenaltyApplied` (Task 1), `ConfigKeys` key `"dating.noshow.threshold"` (Task 2).
- Produces:
  - `Task<(bool Due, string? ActivityTitle)> GetAttendanceCheckStatusAsync(Guid matchId, Guid userId)`
  - `Task<bool?> SubmitAttendanceAsync(Guid matchId, Guid userId, bool attended)` — returns the caller's own recorded answer (`true`/`false`), or `null` if there's no eligible `DateConfirmation` for this match/user. Idempotent: a second call for an already-answered row returns the previously recorded answer without re-processing.
  - Task 6 (`ActivitiesController`) calls both of these directly.

- [ ] **Step 1: Write the failing tests**

Add to `ActivityServiceIntegrationTests.cs`. These use a new seed helper — add it alongside the existing `SeedMatchWithSuggestionAsync`:

```csharp
    // Seeds a match with a suggestion whose DateConfirmation is already
    // IsComplete, with CompletedAt backdated by `hoursAgo` — lets tests put
    // the attendance check inside or outside its 48h eligibility window
    // without waiting real time.
    private async Task<(Match match, DateConfirmation confirmation)> SeedCompletedDateAsync(double hoursAgo)
    {
        var (match, suggestionId) = await SeedMatchWithSuggestionAsync();
        var confirmation = new DateConfirmation
        {
            MatchId = match.Id,
            ActivitySuggestionId = suggestionId,
            InitiatorConfirmed = true,
            ReceiverConfirmed = true,
            CompletedAt = DateTime.UtcNow.AddHours(-hoursAgo),
        };
        Db.DateConfirmations.Add(confirmation);
        await Db.SaveChangesAsync();
        return (match, confirmation);
    }

    [Fact]
    public async Task GetAttendanceCheckStatusAsync_Before48Hours_NotDue()
    {
        var (match, _) = await SeedCompletedDateAsync(hoursAgo: 10);
        var service = BuildService();

        var (due, title) = await service.GetAttendanceCheckStatusAsync(match.Id, match.InitiatorId);

        Assert.False(due);
    }

    [Fact]
    public async Task GetAttendanceCheckStatusAsync_After48Hours_Due()
    {
        var (match, _) = await SeedCompletedDateAsync(hoursAgo: 49);
        var service = BuildService();

        var (due, title) = await service.GetAttendanceCheckStatusAsync(match.Id, match.InitiatorId);

        Assert.True(due);
        Assert.Equal("Coffee Date", title); // SeedMatchWithSuggestionAsync's suggestion Title
    }

    [Fact]
    public async Task GetAttendanceCheckStatusAsync_NoCompletedDate_NotDue()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var service = BuildService();
        var (due, _) = await service.GetAttendanceCheckStatusAsync(match.Id, initiator.Id);

        Assert.False(due);
    }

    [Fact]
    public async Task GetAttendanceCheckStatusAsync_AlreadyAnsweredByThisUser_NotDue()
    {
        var (match, confirmation) = await SeedCompletedDateAsync(hoursAgo: 49);
        confirmation.InitiatorAttended = true;
        await Db.SaveChangesAsync();

        var service = BuildService();
        var (due, _) = await service.GetAttendanceCheckStatusAsync(match.Id, match.InitiatorId);

        Assert.False(due);
    }

    [Fact]
    public async Task SubmitAttendanceAsync_BothSayYes_NoNoShowFlagIncrementEitherSide()
    {
        var (match, _) = await SeedCompletedDateAsync(hoursAgo: 49);
        var service = BuildService();

        await service.SubmitAttendanceAsync(match.Id, match.InitiatorId, attended: true);
        await service.SubmitAttendanceAsync(match.Id, match.ReceiverId, attended: true);

        Db.ChangeTracker.Clear();
        var initiator = await Db.Users.FindAsync(match.InitiatorId);
        var receiver = await Db.Users.FindAsync(match.ReceiverId);
        Assert.Equal(0, initiator!.NoShowFlagCount);
        Assert.Equal(0, receiver!.NoShowFlagCount);
    }

    [Fact]
    public async Task SubmitAttendanceAsync_BothSayNo_NoNoShowFlagIncrementEitherSide()
    {
        var (match, _) = await SeedCompletedDateAsync(hoursAgo: 49);
        var service = BuildService();

        await service.SubmitAttendanceAsync(match.Id, match.InitiatorId, attended: false);
        await service.SubmitAttendanceAsync(match.Id, match.ReceiverId, attended: false);

        Db.ChangeTracker.Clear();
        var initiator = await Db.Users.FindAsync(match.InitiatorId);
        var receiver = await Db.Users.FindAsync(match.ReceiverId);
        Assert.Equal(0, initiator!.NoShowFlagCount);
        Assert.Equal(0, receiver!.NoShowFlagCount);
    }

    [Fact]
    public async Task SubmitAttendanceAsync_Mismatch_IncrementsOnlyTheDenyingSidesFlagCount()
    {
        var (match, _) = await SeedCompletedDateAsync(hoursAgo: 49);
        var service = BuildService();

        await service.SubmitAttendanceAsync(match.Id, match.InitiatorId, attended: true);
        await service.SubmitAttendanceAsync(match.Id, match.ReceiverId, attended: false);

        Db.ChangeTracker.Clear();
        var initiator = await Db.Users.FindAsync(match.InitiatorId);
        var receiver = await Db.Users.FindAsync(match.ReceiverId);
        Assert.Equal(0, initiator!.NoShowFlagCount);
        Assert.Equal(1, receiver!.NoShowFlagCount);
    }

    [Fact]
    public async Task SubmitAttendanceAsync_ReAnswering_IsIdempotentAndReturnsThePreviousAnswer()
    {
        var (match, _) = await SeedCompletedDateAsync(hoursAgo: 49);
        var service = BuildService();

        var first = await service.SubmitAttendanceAsync(match.Id, match.InitiatorId, attended: true);
        var second = await service.SubmitAttendanceAsync(match.Id, match.InitiatorId, attended: false); // attempted flip

        Assert.Equal(true, first);
        Assert.Equal(true, second); // still the original answer — the flip was ignored

        Db.ChangeTracker.Clear();
        var confirmation = await Db.DateConfirmations.FirstAsync(c => c.MatchId == match.Id);
        Assert.True(confirmation.InitiatorAttended);
    }

    [Fact]
    public async Task SubmitAttendanceAsync_MismatchBelowThreshold_DoesNotDockReputation()
    {
        var (match, _) = await SeedCompletedDateAsync(hoursAgo: 49);
        var service = BuildService();

        await service.SubmitAttendanceAsync(match.Id, match.InitiatorId, attended: true);
        await service.SubmitAttendanceAsync(match.Id, match.ReceiverId, attended: false);

        Db.ChangeTracker.Clear();
        var receiver = await Db.Users.FindAsync(match.ReceiverId);
        Assert.Equal(1.0m, receiver!.ReputationScore); // default NewCompleteUser reputation, untouched below threshold 3
    }

    [Fact]
    public async Task SubmitAttendanceAsync_SameDenyingUserAcrossThreeDistinctMatches_DocksReputationOnceAtThreshold()
    {
        var denyingUser = NewCompleteUser();
        Db.Users.Add(denyingUser);
        await Db.SaveChangesAsync();
        var service = BuildService();

        for (int i = 0; i < 3; i++)
        {
            var initiator = NewCompleteUser();
            Db.Users.Add(initiator);
            var match = new Match { InitiatorId = initiator.Id, ReceiverId = denyingUser.Id, MessageCount = 20 };
            Db.Matches.Add(match);
            var suggestion = new ActivitySuggestion { MatchId = match.Id, ActivityType = "Coffee", Title = $"Coffee Date {i}" };
            Db.ActivitySuggestions.Add(suggestion);
            var confirmation = new DateConfirmation
            {
                MatchId = match.Id,
                ActivitySuggestionId = suggestion.Id,
                InitiatorConfirmed = true,
                ReceiverConfirmed = true,
                CompletedAt = DateTime.UtcNow.AddHours(-49),
            };
            Db.DateConfirmations.Add(confirmation);
            await Db.SaveChangesAsync();

            await service.SubmitAttendanceAsync(match.Id, initiator.Id, attended: true);
            await service.SubmitAttendanceAsync(match.Id, denyingUser.Id, attended: false);
        }

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.FindAsync(denyingUser.Id);
        Assert.Equal(3, reloaded!.NoShowFlagCount);
        Assert.Equal(0.9m, reloaded.ReputationScore); // docked exactly once, at the 3rd (threshold) mismatch

        var penaltyEvents = Db.ScoreEvents.Where(e => e.UserId == denyingUser.Id && e.EventType == "RepeatedNoShowPenalty").ToList();
        Assert.Single(penaltyEvents);
    }

    [Fact]
    public async Task SubmitAttendanceAsync_TwoMismatchesFromTheSameMatch_OnlyCountsOnceTowardThreshold()
    {
        // A single match can accumulate two completed DateConfirmations (two
        // different confirmed suggestions, confirmed at different times) —
        // PenaltyApplied must prevent a second mismatch on the same match
        // from incrementing NoShowFlagCount a second time, per the "distinct
        // matches only" anti-abuse guarantee. LoadLatestCompletedConfirmationAsync
        // always resolves to the newest completed row, so this drives BOTH
        // mismatches through the real SubmitAttendanceAsync path in the same
        // order a real user would hit them: confirmationA (older) is fully
        // answered first, then confirmationB (newer) becomes the one the
        // matchId-scoped endpoint resolves to.
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, MessageCount = 20 };
        Db.Matches.Add(match);

        var suggestionA = new ActivitySuggestion { MatchId = match.Id, ActivityType = "Coffee", Title = "Coffee Date" };
        Db.ActivitySuggestions.Add(suggestionA);
        var confirmationA = new DateConfirmation { MatchId = match.Id, ActivitySuggestionId = suggestionA.Id, InitiatorConfirmed = true, ReceiverConfirmed = true, CompletedAt = DateTime.UtcNow.AddHours(-50) };
        Db.DateConfirmations.Add(confirmationA);
        await Db.SaveChangesAsync();

        var service = BuildService();
        await service.SubmitAttendanceAsync(match.Id, initiator.Id, attended: true);
        await service.SubmitAttendanceAsync(match.Id, receiver.Id, attended: false); // mismatch #1 — increments once

        Db.ChangeTracker.Clear();
        var afterFirst = await Db.Users.FindAsync(receiver.Id);
        Assert.Equal(1, afterFirst!.NoShowFlagCount);

        // A second confirmed suggestion for the same match, completed more
        // recently — LoadLatestCompletedConfirmationAsync now resolves to
        // this one instead of confirmationA.
        var suggestionB = new ActivitySuggestion { MatchId = match.Id, ActivityType = "Cinema", Title = "Cinema Date" };
        Db.ActivitySuggestions.Add(suggestionB);
        var confirmationB = new DateConfirmation { MatchId = match.Id, ActivitySuggestionId = suggestionB.Id, InitiatorConfirmed = true, ReceiverConfirmed = true, CompletedAt = DateTime.UtcNow.AddHours(-49) };
        Db.DateConfirmations.Add(confirmationB);
        await Db.SaveChangesAsync();

        await service.SubmitAttendanceAsync(match.Id, initiator.Id, attended: true);
        await service.SubmitAttendanceAsync(match.Id, receiver.Id, attended: false); // mismatch #2 on the SAME match — must not increment again

        Db.ChangeTracker.Clear();
        var afterSecond = await Db.Users.FindAsync(receiver.Id);
        Assert.Equal(1, afterSecond!.NoShowFlagCount); // still 1, not 2

        var confirmationBReloaded = await Db.DateConfirmations.FirstAsync(c => c.Id == confirmationB.Id);
        Assert.False(confirmationBReloaded.PenaltyApplied); // its own mismatch was recorded but never separately penalized
    }
```

- [ ] **Step 2: Run to verify they fail**

```bash
DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter "FullyQualifiedName~GetAttendanceCheckStatusAsync|FullyQualifiedName~SubmitAttendanceAsync"
```
Expected: build errors — `GetAttendanceCheckStatusAsync`/`SubmitAttendanceAsync` don't exist yet.

- [ ] **Step 3: Add `ConfigService` to `ActivityService`'s constructor**

In `Services/ActivityService.cs`, change:
```csharp
public class ActivityService
{
    private readonly AppDbContext _db;
    private readonly ScoreService _score;
    private readonly QuestService _quests;
    private readonly MilestoneService _milestones;
    private readonly SupabaseBroadcastService _broadcast;

    public ActivityService(AppDbContext db, ScoreService score, QuestService quests, MilestoneService milestones, SupabaseBroadcastService broadcast)
    {
        _db = db;
        _score = score;
        _quests = quests;
        _milestones = milestones;
        _broadcast = broadcast;
    }
```

to:
```csharp
public class ActivityService
{
    private readonly AppDbContext _db;
    private readonly ScoreService _score;
    private readonly QuestService _quests;
    private readonly MilestoneService _milestones;
    private readonly SupabaseBroadcastService _broadcast;
    private readonly ConfigService _config;

    public ActivityService(AppDbContext db, ScoreService score, QuestService quests, MilestoneService milestones, SupabaseBroadcastService broadcast, ConfigService config)
    {
        _db = db;
        _score = score;
        _quests = quests;
        _milestones = milestones;
        _broadcast = broadcast;
        _config = config;
    }
```

- [ ] **Step 4: Update the two test-file call sites**

In `tests/MinglDingl.Engine.Tests/Integration/ActivityServiceIntegrationTests.cs`, `BuildService()`:
```csharp
    private ActivityService BuildService()
    {
        var score = new ScoreService(Db, new ConfigService());
        var quests = new QuestService(Db, score);
        var milestones = new MilestoneService(Db);
        var httpClient = new HttpClient();
        var mockConfig = new Moq.Mock<IConfiguration>();
        mockConfig.Setup(c => c["Supabase:ProjectUrl"]).Returns("https://test.supabase.co");
        mockConfig.Setup(c => c["Supabase:SecretKey"]).Returns("test-key");
        var broadcast = new SupabaseBroadcastService(httpClient, mockConfig.Object);
        return new ActivityService(Db, score, quests, milestones, broadcast, new ConfigService());
    }
```
(only the final `return` line changes — appends `, new ConfigService()`.)

In `tests/MinglDingl.Engine.Tests/Integration/ActivitiesControllerIntegrationTests.cs`, `BuildController()`, the line:
```csharp
        var activities = new ActivityService(Db, score, quests, milestones, broadcast);
```
becomes:
```csharp
        var activities = new ActivityService(Db, score, quests, milestones, broadcast, new ConfigService());
```

- [ ] **Step 5: Implement `GetAttendanceCheckStatusAsync` and `SubmitAttendanceAsync`**

Add these two public methods to `Services/ActivityService.cs`, after `ConfirmAsync`:

```csharp
    // "Most recent completed DateConfirmation for this match" — a match can
    // in principle have more than one (see PenaltyApplied's comment on
    // DateConfirmation), so this always resolves to the newest one by
    // CompletedAt, matching the spec's pseudocode exactly.
    private async Task<DateConfirmation?> LoadLatestCompletedConfirmationAsync(Guid matchId) =>
        await _db.DateConfirmations
            .Where(c => c.MatchId == matchId && c.CompletedAt != null)
            .OrderByDescending(c => c.CompletedAt)
            .FirstOrDefaultAsync();

    public async Task<(bool Due, string? ActivityTitle)> GetAttendanceCheckStatusAsync(Guid matchId, Guid userId)
    {
        var confirmation = await LoadLatestCompletedConfirmationAsync(matchId);
        if (confirmation is null) return (false, null);
        if (DateTime.UtcNow - confirmation.CompletedAt!.Value < TimeSpan.FromHours(48)) return (false, null);

        var match = await _db.Matches.FindAsync(matchId);
        if (match is null) return (false, null);
        bool isInitiator = match.InitiatorId == userId;
        bool alreadyAnswered = isInitiator ? confirmation.InitiatorAttended.HasValue : confirmation.ReceiverAttended.HasValue;
        if (alreadyAnswered) return (false, null);

        var suggestion = await _db.ActivitySuggestions.FindAsync(confirmation.ActivitySuggestionId);
        return (true, suggestion?.Title);
    }

    // Returns the caller's own recorded answer (true/false), or null if
    // there's no eligible confirmation for this match. Idempotent: once a
    // user has answered, a second call returns that original answer without
    // reprocessing — no way to "take it back" after learning nothing about
    // the other side's answer, since answers are never revealed to each other.
    public async Task<bool?> SubmitAttendanceAsync(Guid matchId, Guid userId, bool attended)
    {
        var confirmation = await LoadLatestCompletedConfirmationAsync(matchId);
        if (confirmation is null) return null;

        var match = await _db.Matches.FindAsync(matchId);
        if (match is null || !match.IsParticipant(userId)) return null;
        bool isInitiator = match.InitiatorId == userId;

        bool alreadyAnswered = isInitiator ? confirmation.InitiatorAttended.HasValue : confirmation.ReceiverAttended.HasValue;
        if (alreadyAnswered) return isInitiator ? confirmation.InitiatorAttended : confirmation.ReceiverAttended;

        if (isInitiator) confirmation.InitiatorAttended = attended;
        else confirmation.ReceiverAttended = attended;
        await _db.SaveChangesAsync();

        if (confirmation.InitiatorAttended.HasValue && confirmation.ReceiverAttended.HasValue
            && confirmation.InitiatorAttended != confirmation.ReceiverAttended)
        {
            // Checked across EVERY DateConfirmation for this match, not just
            // this row — a match can accumulate more than one completed
            // DateConfirmation (see PenaltyApplied's comment on the model),
            // and the "distinct matches only" anti-abuse guarantee requires
            // this to be a per-MATCH gate, not a per-row one. A per-row-only
            // check here would let two mismatched suggestions on the same
            // match pair double-count toward the threshold.
            bool alreadyPenalizedForThisMatch = await _db.DateConfirmations
                .AnyAsync(c => c.MatchId == matchId && c.PenaltyApplied);

            if (!alreadyPenalizedForThisMatch)
            {
                var denyingUserId = confirmation.InitiatorAttended == false ? match.InitiatorId : match.ReceiverId;
                confirmation.PenaltyApplied = true;
                await _db.SaveChangesAsync();

                var updated = await _db.Database.SqlQuery<int>(
                    $"""
                    UPDATE "Users" SET "NoShowFlagCount" = "NoShowFlagCount" + 1
                    WHERE "Id" = {denyingUserId}
                    RETURNING "NoShowFlagCount"
                    """).ToListAsync();

                if (updated.Count > 0)
                {
                    var trackedUser = _db.ChangeTracker.Entries<User>().FirstOrDefault(e => e.Entity.Id == denyingUserId)?.Entity;
                    if (trackedUser is not null) trackedUser.NoShowFlagCount = updated[0];

                    int threshold = (int)_config.GetNumber("dating.noshow.threshold", 3);
                    if (updated[0] >= threshold)
                        await _score.ApplyReputationPenaltyAsync(denyingUserId, "RepeatedNoShowPenalty");
                }
            }
        }

        return attended;
    }
```

- [ ] **Step 6: Run to verify tests pass**

```bash
DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter "FullyQualifiedName~GetAttendanceCheckStatusAsync|FullyQualifiedName~SubmitAttendanceAsync"
```
Expected: all pass.

- [ ] **Step 7: Run the full engine suite**

```bash
DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test
```
Expected: all pass (this catches anything else affected by the constructor signature change).

- [ ] **Step 8: Commit**

```bash
git add src/MinglDingl.Engine/Services/ActivityService.cs tests/MinglDingl.Engine.Tests/Integration/ActivityServiceIntegrationTests.cs tests/MinglDingl.Engine.Tests/Integration/ActivitiesControllerIntegrationTests.cs
git commit -m "Add ActivityService attendance-check status/submit with anti-abuse guards"
```

---

### Task 6: `ActivitiesController` — attendance-check endpoints

**Files:**
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Controllers/ActivitiesController.cs`
- Modify: `mingldingl_engine/src/MinglDingl.Engine/DTOs/ActivityDto.cs`
- Test: `mingldingl_engine/tests/MinglDingl.Engine.Tests/Integration/ActivitiesControllerIntegrationTests.cs`

**Interfaces:**
- Consumes: `ActivityService.GetAttendanceCheckStatusAsync`/`SubmitAttendanceAsync` (Task 5).
- Produces: `GET /activities/{matchId}/attendance-check` → `AttendanceCheckStatusResponse(bool Due, string? ActivityTitle)`; `POST /activities/{matchId}/attendance-check` with body `AttendanceCheckRequestDto(bool Attended)` → `AttendanceCheckResponse(bool Attended)` (the caller's own recorded value — named to match the request DTO, not "did I respond," which would always be true after a successful POST). App's `apiClient.activities.attendanceCheckStatus`/`attendanceCheckSubmit` (Task 8) call these exact routes/shapes.

- [ ] **Step 1: Write the failing tests**

Add to `ActivitiesControllerIntegrationTests.cs`:

```csharp
    [Fact]
    public async Task GetAttendanceCheck_CallerNotAMatchParticipant_ReturnsForbidden()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id };
        Db.Matches.Add(match);

        var strangerId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(strangerId));
        await Db.SaveChangesAsync();

        var controller = BuildController(strangerId);
        var result = Assert.IsType<ObjectResult>(await controller.GetAttendanceCheck(match.Id));
        Assert.Equal(403, result.StatusCode);
    }

    [Fact]
    public async Task GetAttendanceCheck_NotYetDue_ReturnsDueFalse()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, MessageCount = 20 };
        Db.Matches.Add(match);
        var suggestion = new ActivitySuggestion { MatchId = match.Id, ActivityType = "Coffee", Title = "Coffee Date" };
        Db.ActivitySuggestions.Add(suggestion);
        Db.DateConfirmations.Add(new DateConfirmation
        {
            MatchId = match.Id, ActivitySuggestionId = suggestion.Id,
            InitiatorConfirmed = true, ReceiverConfirmed = true,
            CompletedAt = DateTime.UtcNow.AddHours(-1),
        });
        await Db.SaveChangesAsync();

        var controller = BuildController(initiator.Id);
        var result = Assert.IsType<OkObjectResult>(await controller.GetAttendanceCheck(match.Id));
        var body = Assert.IsType<AttendanceCheckStatusResponse>(result.Value);
        Assert.False(body.Due);
    }

    [Fact]
    public async Task PostAttendanceCheck_ReturnsMyOwnRecordedAttendedValue()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, MessageCount = 20 };
        Db.Matches.Add(match);
        var suggestion = new ActivitySuggestion { MatchId = match.Id, ActivityType = "Coffee", Title = "Coffee Date" };
        Db.ActivitySuggestions.Add(suggestion);
        Db.DateConfirmations.Add(new DateConfirmation
        {
            MatchId = match.Id, ActivitySuggestionId = suggestion.Id,
            InitiatorConfirmed = true, ReceiverConfirmed = true,
            CompletedAt = DateTime.UtcNow.AddHours(-49),
        });
        await Db.SaveChangesAsync();

        var controller = BuildController(receiver.Id);
        var result = Assert.IsType<OkObjectResult>(await controller.PostAttendanceCheck(match.Id, new AttendanceCheckRequestDto(false)));
        var body = Assert.IsType<AttendanceCheckResponse>(result.Value);
        Assert.False(body.Attended); // reflects the value just submitted, not "did they respond" (which would always be true)
    }

    [Fact]
    public async Task PostAttendanceCheck_NoEligibleConfirmation_ReturnsNotFound()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id };
        Db.Matches.Add(match);
        await Db.SaveChangesAsync();

        var controller = BuildController(initiator.Id);
        var result = Assert.IsType<ObjectResult>(await controller.PostAttendanceCheck(match.Id, new AttendanceCheckRequestDto(true)));
        Assert.Equal(404, result.StatusCode);
    }
```

- [ ] **Step 2: Run to verify they fail**

```bash
DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter "FullyQualifiedName~AttendanceCheck"
```
Expected: build errors — `GetAttendanceCheck`/`PostAttendanceCheck`/`AttendanceCheckStatusResponse`/`AttendanceCheckRequestDto`/`AttendanceCheckResponse` don't exist yet.

- [ ] **Step 3: Add the DTOs**

Append to `DTOs/ActivityDto.cs`:
```csharp
public record AttendanceCheckStatusResponse(bool Due, string? ActivityTitle);

public record AttendanceCheckRequestDto(bool Attended);

// Attended is the caller's own recorded attendance value — never the other
// participant's, and never whether a mismatch/penalty resulted (that's
// deliberately invisible client-side, see the spec's anti-abuse section).
public record AttendanceCheckResponse(bool Attended);
```

- [ ] **Step 4: Add the controller actions**

In `Controllers/ActivitiesController.cs`, add these two actions after `ConfirmDate`:

```csharp
    [HttpGet("{matchId}/attendance-check")]
    [ProducesResponseType(typeof(AttendanceCheckStatusResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAttendanceCheck(Guid matchId)
    {
        var userId = this.CurrentUserId();
        var match = await _db.Matches.FindAsync(matchId);
        if (match is null) return this.NotFoundError("Match not found");
        if (!match.IsParticipant(userId))
            return this.ForbiddenError("You are not a participant in this match");

        var (due, activityTitle) = await _activities.GetAttendanceCheckStatusAsync(matchId, userId);
        return Ok(new AttendanceCheckStatusResponse(due, activityTitle));
    }

    [HttpPost("{matchId}/attendance-check")]
    [ProducesResponseType(typeof(AttendanceCheckResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> PostAttendanceCheck(Guid matchId, [FromBody] AttendanceCheckRequestDto req)
    {
        var userId = this.CurrentUserId();
        var match = await _db.Matches.FindAsync(matchId);
        if (match is null) return this.NotFoundError("Match not found");
        if (!match.IsParticipant(userId))
            return this.ForbiddenError("You are not a participant in this match");

        var answered = await _activities.SubmitAttendanceAsync(matchId, userId, req.Attended);
        if (answered is null) return this.NotFoundError("No confirmed date eligible for an attendance check on this match");

        return Ok(new AttendanceCheckResponse(answered.Value));
    }
```

- [ ] **Step 5: Run to verify tests pass**

```bash
DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter "FullyQualifiedName~AttendanceCheck"
```
Expected: all pass.

- [ ] **Step 6: Run the full engine suite**

```bash
DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test
```
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/MinglDingl.Engine/Controllers/ActivitiesController.cs src/MinglDingl.Engine/DTOs/ActivityDto.cs tests/MinglDingl.Engine.Tests/Integration/ActivitiesControllerIntegrationTests.cs
git commit -m "Add GET/POST /activities/{matchId}/attendance-check endpoints"
```

---

### Task 7: `TrophyResponse` — neutral "Mismatched" marker

**Files:**
- Modify: `mingldingl_engine/src/MinglDingl.Engine/DTOs/ActivityDto.cs`
- Modify: `mingldingl_engine/src/MinglDingl.Engine/Controllers/ActivitiesController.cs` (`GetMyTrophies`)
- Test: `mingldingl_engine/tests/MinglDingl.Engine.Tests/Integration/ActivitiesControllerIntegrationTests.cs`

**Interfaces:**
- Produces: `TrophyResponse.Mismatched` (`bool`) — Task 11 (app `date-log.tsx`) reads this to show a neutral "Unconfirmed" marker instead of exposing which side said what.

- [ ] **Step 1: Write the failing test**

Find the existing `GetMyTrophies` test(s) in `ActivitiesControllerIntegrationTests.cs` for the exact seeding pattern (search `GetMyTrophies` in that file), then add:

```csharp
    [Fact]
    public async Task GetMyTrophies_MismatchedAttendance_MarksEntryAsMismatchedWithoutExposingEitherAnswer()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, MessageCount = 20 };
        Db.Matches.Add(match);
        var suggestion = new ActivitySuggestion { MatchId = match.Id, ActivityType = "Coffee", Title = "Coffee Date" };
        Db.ActivitySuggestions.Add(suggestion);
        Db.DateConfirmations.Add(new DateConfirmation
        {
            MatchId = match.Id, ActivitySuggestionId = suggestion.Id,
            InitiatorConfirmed = true, ReceiverConfirmed = true,
            CompletedAt = DateTime.UtcNow.AddHours(-49),
            InitiatorAttended = true, ReceiverAttended = false,
        });
        await Db.SaveChangesAsync();

        var controller = BuildController(initiator.Id);
        var result = Assert.IsType<OkObjectResult>(await controller.GetMyTrophies());
        var body = Assert.IsType<List<TrophyResponse>>(result.Value);

        var entry = Assert.Single(body);
        Assert.True(entry.Mismatched);
    }

    [Fact]
    public async Task GetMyTrophies_BothConfirmedAttendance_NotMismatched()
    {
        var initiator = NewCompleteUser();
        var receiver = NewCompleteUser();
        Db.Users.AddRange(initiator, receiver);
        var match = new Match { InitiatorId = initiator.Id, ReceiverId = receiver.Id, MessageCount = 20 };
        Db.Matches.Add(match);
        var suggestion = new ActivitySuggestion { MatchId = match.Id, ActivityType = "Coffee", Title = "Coffee Date" };
        Db.ActivitySuggestions.Add(suggestion);
        Db.DateConfirmations.Add(new DateConfirmation
        {
            MatchId = match.Id, ActivitySuggestionId = suggestion.Id,
            InitiatorConfirmed = true, ReceiverConfirmed = true,
            CompletedAt = DateTime.UtcNow.AddHours(-49),
            InitiatorAttended = true, ReceiverAttended = true,
        });
        await Db.SaveChangesAsync();

        var controller = BuildController(initiator.Id);
        var result = Assert.IsType<OkObjectResult>(await controller.GetMyTrophies());
        var body = Assert.IsType<List<TrophyResponse>>(result.Value);

        var entry = Assert.Single(body);
        Assert.False(entry.Mismatched);
    }
```

- [ ] **Step 2: Run to verify they fail**

```bash
DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter "FullyQualifiedName~GetMyTrophies_Mismatched|FullyQualifiedName~GetMyTrophies_BothConfirmedAttendance"
```
Expected: build error — `TrophyResponse.Mismatched` doesn't exist yet.

- [ ] **Step 3: Add `Mismatched` to `TrophyResponse`**

In `DTOs/ActivityDto.cs`, change:
```csharp
public record TrophyResponse(
    Guid MatchId,
    string ActivityTitle,
    string? BusinessName,
    string? BusinessPhoto,
    DateTime ConfirmedAt,
    int? MyStars,
    string? MyMomentPhotoUrl);
```
to:
```csharp
public record TrophyResponse(
    Guid MatchId,
    string ActivityTitle,
    string? BusinessName,
    string? BusinessPhoto,
    DateTime ConfirmedAt,
    int? MyStars,
    string? MyMomentPhotoUrl,
    bool Mismatched = false);
```

- [ ] **Step 4: Compute `Mismatched` in `GetMyTrophies`**

In `Controllers/ActivitiesController.cs`, find the `GetMyTrophies` method's `.Select(c => {...})` block:
```csharp
        var trophies = confirmations
            .Select(c =>
            {
                suggestions.TryGetValue(c.ActivitySuggestionId, out var s);
                var myRating = myRatings.FirstOrDefault(r => r.MatchId == c.MatchId);
                return new TrophyResponse(
                    c.MatchId,
                    s?.Title ?? "",
                    s?.BusinessPartner?.Name,
                    s?.BusinessPartner?.PhotoUrls.FirstOrDefault(),
                    c.CreatedAt,
                    myRating?.Stars,
                    myRating?.PhotoUrl);
            })
```

Replace with:
```csharp
        var trophies = confirmations
            .Select(c =>
            {
                suggestions.TryGetValue(c.ActivitySuggestionId, out var s);
                var myRating = myRatings.FirstOrDefault(r => r.MatchId == c.MatchId);
                bool mismatched = c.InitiatorAttended.HasValue && c.ReceiverAttended.HasValue
                    && c.InitiatorAttended != c.ReceiverAttended;
                return new TrophyResponse(
                    c.MatchId,
                    s?.Title ?? "",
                    s?.BusinessPartner?.Name,
                    s?.BusinessPartner?.PhotoUrls.FirstOrDefault(),
                    c.CreatedAt,
                    myRating?.Stars,
                    myRating?.PhotoUrl,
                    mismatched);
            })
```

- [ ] **Step 5: Run to verify tests pass**

```bash
DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test --filter "FullyQualifiedName~GetMyTrophies"
```
Expected: all pass.

- [ ] **Step 6: Run the full engine suite**

```bash
DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test
```
Expected: all pass. This is the last engine-side task — the whole backend is now complete and independently testable via `curl` before moving to the app.

- [ ] **Step 7: Commit**

```bash
git add src/MinglDingl.Engine/DTOs/ActivityDto.cs src/MinglDingl.Engine/Controllers/ActivitiesController.cs tests/MinglDingl.Engine.Tests/Integration/ActivitiesControllerIntegrationTests.cs
git commit -m "Add Mismatched marker to TrophyResponse without exposing either answer"
```

---

### Task 8: App — regenerate API types, `apiClient`, `queryKeys`, `useAttendanceCheck` hook

**Files:**
- Modify (generated): `mingldingl_app/lib/api/api.generated.d.ts`
- Modify: `mingldingl_app/lib/api/apiClient.ts`
- Modify: `mingldingl_app/lib/api/queryKeys.ts`
- Create: `mingldingl_app/hooks/useAttendanceCheck.ts`
- Test: `mingldingl_app/hooks/__tests__/useAttendanceCheck.test.tsx`

**Interfaces:**
- Consumes: `GET/POST /activities/{matchId}/attendance-check` (Task 6).
- Produces: `useAttendanceCheck(matchId: string)` returning `{ due: boolean; activityTitle: string | null; isLoading: boolean; submit: (attended: boolean) => void; isSubmitting: boolean }`. Task 9 (modal) and Task 10 (chat banner) consume this.

- [ ] **Step 1: Start the engine and regenerate API types**

```bash
cd mingldingl_engine && ./scripts/start-engine.sh &
# wait for "Now listening on: http://0.0.0.0:5150", then in mingldingl_app:
cd mingldingl_app && npm run generate:api
```
Expected: `lib/api/api.generated.d.ts` is rewritten with new schema entries `AttendanceCheckStatusResponse`, `AttendanceCheckRequestDto`, `AttendanceCheckResponse`, and `TrophyResponse` now includes a `mismatched` field. Confirm with:
```bash
grep -n "AttendanceCheck\|mismatched" lib/api/api.generated.d.ts
```

- [ ] **Step 2: Add `apiClient.activities.attendanceCheckStatus`/`attendanceCheckSubmit`**

In `lib/api/apiClient.ts`, find the `activities:` block:
```typescript
  activities: {
    suggestions: (matchId: string) =>
      api.get<Schemas['ActivitySuggestionResponse'][]>(`/activities/${matchId}/suggestions`).then((r) => r.data),
    confirm: (matchId: string, body: Schemas['ConfirmDateDto']) =>
      api.post<Schemas['ConfirmDateResponse']>(`/activities/${matchId}/confirm`, body).then((r) => r.data),
    mine: () => api.get<Schemas['TrophyResponse'][]>('/activities/mine').then((r) => r.data),
  },
```
Replace with:
```typescript
  activities: {
    suggestions: (matchId: string) =>
      api.get<Schemas['ActivitySuggestionResponse'][]>(`/activities/${matchId}/suggestions`).then((r) => r.data),
    confirm: (matchId: string, body: Schemas['ConfirmDateDto']) =>
      api.post<Schemas['ConfirmDateResponse']>(`/activities/${matchId}/confirm`, body).then((r) => r.data),
    mine: () => api.get<Schemas['TrophyResponse'][]>('/activities/mine').then((r) => r.data),
    attendanceCheckStatus: (matchId: string) =>
      api.get<Schemas['AttendanceCheckStatusResponse']>(`/activities/${matchId}/attendance-check`).then((r) => r.data),
    attendanceCheckSubmit: (matchId: string, body: Schemas['AttendanceCheckRequestDto']) =>
      api.post<Schemas['AttendanceCheckResponse']>(`/activities/${matchId}/attendance-check`, body).then((r) => r.data),
  },
```

- [ ] **Step 3: Add `queryKeys.attendanceCheck`**

In `lib/api/queryKeys.ts`, add this line alongside `activitySuggestions`:
```typescript
  attendanceCheck: (matchId: string) => ['attendanceCheck', matchId] as const,
```

- [ ] **Step 4: Write the failing hook test**

Create `hooks/__tests__/useAttendanceCheck.test.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAttendanceCheck } from '../useAttendanceCheck';
import { apiClient } from '../../lib/api/apiClient';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: {
    activities: {
      attendanceCheckStatus: jest.fn(),
      attendanceCheckSubmit: jest.fn(),
    },
  },
}));

const mockApi = apiClient as unknown as {
  activities: {
    attendanceCheckStatus: jest.Mock;
    attendanceCheckSubmit: jest.Mock;
  };
};

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useAttendanceCheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reflects due=false and null activityTitle when not due', async () => {
    mockApi.activities.attendanceCheckStatus.mockResolvedValue({ due: false, activityTitle: null });

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useAttendanceCheck('m1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.due).toBe(false);
    expect(result.current.activityTitle).toBeNull();
  });

  it('reflects due=true with the activity title', async () => {
    mockApi.activities.attendanceCheckStatus.mockResolvedValue({ due: true, activityTitle: 'Coffee Date' });

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useAttendanceCheck('m1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.due).toBe(true));
    expect(result.current.activityTitle).toBe('Coffee Date');
  });

  it('submit calls the API with the given answer', async () => {
    mockApi.activities.attendanceCheckStatus.mockResolvedValue({ due: true, activityTitle: 'Coffee Date' });
    mockApi.activities.attendanceCheckSubmit.mockResolvedValue({ attended: true });

    const queryClient = makeQueryClient();
    const { result } = renderHook(() => useAttendanceCheck('m1'), { wrapper: makeWrapper(queryClient) });

    await waitFor(() => expect(result.current.due).toBe(true));

    await act(async () => {
      result.current.submit(true);
    });

    expect(mockApi.activities.attendanceCheckSubmit).toHaveBeenCalledWith('m1', { attended: true });
  });
});
```

- [ ] **Step 5: Run to verify it fails**

```bash
cd mingldingl_app && npm test -- --testPathPattern="useAttendanceCheck"
```
Expected: FAIL — `Cannot find module '../useAttendanceCheck'`.

- [ ] **Step 6: Implement the hook**

Create `hooks/useAttendanceCheck.ts`:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/apiClient';
import { queryKeys } from '../lib/api/queryKeys';

export function useAttendanceCheck(matchId: string) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.attendanceCheck(matchId),
    queryFn: async () => {
      const res = await apiClient.activities.attendanceCheckStatus(matchId);
      return { due: res.due ?? false, activityTitle: res.activityTitle ?? null };
    },
    enabled: !!matchId,
    staleTime: 1000 * 60,
  });

  const submitMutation = useMutation({
    mutationFn: (attended: boolean) => apiClient.activities.attendanceCheckSubmit(matchId, { attended }),
    onSuccess: () => {
      // Regardless of the answer, this match's attendance check is now
      // resolved for this user — clear the "due" state locally instead of
      // waiting out staleTime, so the banner/modal disappear immediately.
      qc.setQueryData(queryKeys.attendanceCheck(matchId), { due: false, activityTitle: null });
    },
  });

  return {
    due: data?.due ?? false,
    activityTitle: data?.activityTitle ?? null,
    isLoading,
    submit: (attended: boolean) => submitMutation.mutate(attended),
    isSubmitting: submitMutation.isPending,
  };
}
```

- [ ] **Step 7: Run to verify it passes**

```bash
npm test -- --testPathPattern="useAttendanceCheck"
```
Expected: `Tests: 3 passed, 3 total`

- [ ] **Step 8: Typecheck**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add lib/api/api.generated.d.ts lib/api/apiClient.ts lib/api/queryKeys.ts hooks/useAttendanceCheck.ts hooks/__tests__/useAttendanceCheck.test.tsx
git commit -m "Add useAttendanceCheck hook and regenerate API types"
```

---

### Task 9: App — `AttendanceCheckModal` component

**Files:**
- Create: `mingldingl_app/components/modals/AttendanceCheckModal.tsx`
- Test: `mingldingl_app/components/modals/__tests__/AttendanceCheckModal.test.tsx`
- Modify: `mingldingl_app/lib/i18n.ts`

**Interfaces:**
- Consumes: nothing new — pure presentational component (props only, same pattern as `AlertModal`/`InviteAllyCard`).
- Produces: `<AttendanceCheckModal visible activityTitle onYes onNo isSubmitting onDismiss />`. Task 10 renders this.

- [ ] **Step 1: Add i18n keys**

In `lib/i18n.ts`, find the `en` block's `both_in` line (search `both_in: "You're both in!"`) and add immediately after it:
```typescript
    attendance_check_title: 'Did You Meet Up?',
    attendance_check_question: 'Did you meet up for %{activity}?',
    attendance_check_yes: "Yes, we met",
    attendance_check_no: "No, we didn't",
```

Find the `mn` block's `both_in: 'Хоёулаа зөвшөөрлөө!',` line and add immediately after it:
```typescript
    attendance_check_title: 'Уулзсан уу?',
    attendance_check_question: '%{activity}-р уулзсан уу?',
    attendance_check_yes: 'Тийм, уулзсан',
    attendance_check_no: 'Үгүй, уулзаагүй',
```

- [ ] **Step 2: Write the failing test**

Create `components/modals/__tests__/AttendanceCheckModal.test.tsx`:
```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { AttendanceCheckModal } from '../AttendanceCheckModal';

describe('AttendanceCheckModal', () => {
  it('renders the question with the activity title interpolated', () => {
    const { getByText } = render(
      <AttendanceCheckModal
        visible
        activityTitle="Coffee Date"
        onYes={() => {}}
        onNo={() => {}}
        isSubmitting={false}
        onDismiss={() => {}}
      />,
    );
    expect(getByText('Did you meet up for Coffee Date?')).toBeTruthy();
  });

  it('calls onYes when the yes button is pressed', () => {
    const onYes = jest.fn();
    const { getByText } = render(
      <AttendanceCheckModal
        visible
        activityTitle="Coffee Date"
        onYes={onYes}
        onNo={() => {}}
        isSubmitting={false}
        onDismiss={() => {}}
      />,
    );
    fireEvent.press(getByText('Yes, we met'));
    expect(onYes).toHaveBeenCalledTimes(1);
  });

  it('calls onNo when the no button is pressed', () => {
    const onNo = jest.fn();
    const { getByText } = render(
      <AttendanceCheckModal
        visible
        activityTitle="Coffee Date"
        onYes={() => {}}
        onNo={onNo}
        isSubmitting={false}
        onDismiss={() => {}}
      />,
    );
    fireEvent.press(getByText("No, we didn't"));
    expect(onNo).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when not visible', () => {
    const { queryByText } = render(
      <AttendanceCheckModal
        visible={false}
        activityTitle="Coffee Date"
        onYes={() => {}}
        onNo={() => {}}
        isSubmitting={false}
        onDismiss={() => {}}
      />,
    );
    expect(queryByText('Did You Meet Up?')).toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

```bash
npm test -- --testPathPattern="AttendanceCheckModal"
```
Expected: FAIL — `Cannot find module '../AttendanceCheckModal'`.

- [ ] **Step 4: Implement the component**

Create `components/modals/AttendanceCheckModal.tsx`:
```tsx
import { Modal, Text, View, StyleSheet } from 'react-native';
import { GameButton } from '../ui/GameButton';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

interface Props {
  visible: boolean;
  activityTitle: string | null;
  onYes: () => void;
  onNo: () => void;
  isSubmitting: boolean;
  onDismiss: () => void;
}

// A neutral Yes/No prompt, deliberately not built on AlertModal — that
// component's confirm/cancel pair is styled as "danger action vs cancel"
// (see AlertModal's own comments), which misrepresents "No, we didn't meet"
// as a destructive choice rather than a plain, equally-valid answer. No
// free-text field anywhere — nothing for either side to write about the
// other, per the spec's anti-abuse design.
export function AttendanceCheckModal({ visible, activityTitle, onYes, onNo, isSubmitting, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.sigil}>📍</Text>
          <Text style={styles.title}>{i18n.t('attendance_check_title')}</Text>
          <Text style={styles.question}>
            {i18n.t('attendance_check_question', { activity: activityTitle ?? '' })}
          </Text>
          <View style={styles.btnRow}>
            <GameButton variant="ghost" disabled={isSubmitting} onPress={onNo}>
              {i18n.t('attendance_check_no')}
            </GameButton>
            <GameButton variant="primary" loading={isSubmitting} onPress={onYes}>
              {i18n.t('attendance_check_yes')}
            </GameButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10,11,16,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.panel,
    borderWidth: 2,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    paddingHorizontal: 28,
    paddingVertical: 26,
    alignItems: 'center',
    gap: 8,
    maxWidth: 340,
    width: '100%',
  },
  sigil: { fontSize: 26, marginBottom: 2 },
  title: { fontFamily: FONTS.display, fontSize: 17, color: COLORS.text, textAlign: 'center' },
  question: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textDim, textAlign: 'center', lineHeight: 20 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 10, alignSelf: 'stretch' },
});
```

- [ ] **Step 5: Run to verify it passes**

```bash
npm test -- --testPathPattern="AttendanceCheckModal"
```
Expected: `Tests: 4 passed, 4 total`

- [ ] **Step 6: Run the i18n key-parity test**

```bash
npm test -- --testPathPattern="i18n"
```
Expected: pass (confirms the EN/MN keys added in Step 1 match).

- [ ] **Step 7: Typecheck**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add components/modals/AttendanceCheckModal.tsx components/modals/__tests__/AttendanceCheckModal.test.tsx lib/i18n.ts
git commit -m "Add AttendanceCheckModal component"
```

---

### Task 10: App — wire the attendance-check banner into the chat screen

**Files:**
- Modify: `mingldingl_app/app/chat/[matchId].tsx`

**Interfaces:**
- Consumes: `useAttendanceCheck` (Task 8), `AttendanceCheckModal` (Task 9), `QuestBanner` (existing component, already imported in this file).

- [ ] **Step 1: Add the import and hook call**

In `app/chat/[matchId].tsx`, add to the imports (alongside the other hook imports near the top):
```typescript
import { useAttendanceCheck } from '../../hooks/useAttendanceCheck';
import { AttendanceCheckModal } from '../../components/modals/AttendanceCheckModal';
```

Find the line:
```typescript
  const { messages, loading, isError, refetch, sendMessage, retryMessage, myId } = useChat(matchId);
```
Add immediately after it:
```typescript
  const { due: attendanceDue, activityTitle, submit: submitAttendance, isSubmitting: submittingAttendance } = useAttendanceCheck(matchId);
  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
```

- [ ] **Step 2: Add the conditional banner**

Find the three existing `QuestBanner` calls (search `plan_encounter`):
```tsx
        <QuestBanner icon="🎯" title={i18n.t('break_ice')}
          onPress={() => router.push(`/icebreaker/${matchId}`)} />
        <QuestBanner icon="🧠" title={i18n.t('trial_compat')}
          onPress={() => router.push(`/quiz/${matchId}`)} />
        <QuestBanner icon="📍" title={i18n.t('plan_encounter')}
          onPress={() => router.push(`/activities/${matchId}`)} />
```
Add a fourth conditional banner immediately after them:
```tsx
        <QuestBanner icon="🎯" title={i18n.t('break_ice')}
          onPress={() => router.push(`/icebreaker/${matchId}`)} />
        <QuestBanner icon="🧠" title={i18n.t('trial_compat')}
          onPress={() => router.push(`/quiz/${matchId}`)} />
        <QuestBanner icon="📍" title={i18n.t('plan_encounter')}
          onPress={() => router.push(`/activities/${matchId}`)} />
        {attendanceDue && (
          <QuestBanner icon="📍" title={i18n.t('attendance_check_title')}
            onPress={() => setAttendanceModalVisible(true)} />
        )}
```

- [ ] **Step 3: Render the modal**

Find where `AlertModal` is rendered near the bottom of this component's JSX (search `<AlertModal` — there are existing ones for unmatch/block confirmation) and add the new modal right before the closing of the component's outermost element, alongside them:
```tsx
        <AttendanceCheckModal
          visible={attendanceModalVisible}
          activityTitle={activityTitle}
          isSubmitting={submittingAttendance}
          onYes={() => { submitAttendance(true); setAttendanceModalVisible(false); }}
          onNo={() => { submitAttendance(false); setAttendanceModalVisible(false); }}
          onDismiss={() => setAttendanceModalVisible(false)}
        />
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Run the full app test suite**

```bash
npm test
```
Expected: all existing tests still pass (this screen has no dedicated test file today, matching the rest of the `app/` route files — see Task 12 for live verification instead).

- [ ] **Step 6: Commit**

```bash
git add app/chat/\[matchId\].tsx
git commit -m "Surface the attendance-check banner and modal on the chat screen"
```

---

### Task 11: App — "Unconfirmed" marker on the Date Log

**Files:**
- Modify: `mingldingl_app/models/trophy.ts`
- Modify: `mingldingl_app/app/date-log.tsx`
- Modify: `mingldingl_app/lib/i18n.ts`

**Interfaces:**
- Consumes: `TrophyResponse.mismatched` (Task 7, already present in `api.generated.d.ts` after Task 8's regeneration).
- Produces: `Trophy.mismatched: boolean` — read by `date-log.tsx`'s `TrophyRow`.

- [ ] **Step 1: Add the field to the `Trophy` model**

In `models/trophy.ts`, change:
```typescript
export interface Trophy {
  matchId: string;
  activityTitle: string;
  businessName?: string;
  businessPhoto?: string;
  confirmedAt: string;
  myStars?: number;
  myMomentPhotoUrl?: string;
}

export function parseTrophy(d: components['schemas']['TrophyResponse']): Trophy {
  return {
    matchId: d.matchId ?? '',
    activityTitle: d.activityTitle ?? '',
    businessName: d.businessName ?? undefined,
    businessPhoto: d.businessPhoto ?? undefined,
    confirmedAt: d.confirmedAt ?? '',
    myStars: d.myStars ?? undefined,
    myMomentPhotoUrl: d.myMomentPhotoUrl ?? undefined,
  };
}
```
to:
```typescript
export interface Trophy {
  matchId: string;
  activityTitle: string;
  businessName?: string;
  businessPhoto?: string;
  confirmedAt: string;
  myStars?: number;
  myMomentPhotoUrl?: string;
  mismatched: boolean;
}

export function parseTrophy(d: components['schemas']['TrophyResponse']): Trophy {
  return {
    matchId: d.matchId ?? '',
    activityTitle: d.activityTitle ?? '',
    businessName: d.businessName ?? undefined,
    businessPhoto: d.businessPhoto ?? undefined,
    confirmedAt: d.confirmedAt ?? '',
    myStars: d.myStars ?? undefined,
    myMomentPhotoUrl: d.myMomentPhotoUrl ?? undefined,
    mismatched: d.mismatched ?? false,
  };
}
```

- [ ] **Step 2: Add the i18n key**

In `lib/i18n.ts`, `en` block, find `date_log_unrated: '...'` (search for it) and add immediately after:
```typescript
    date_log_unconfirmed: 'Unconfirmed',
```
In the `mn` block, find `date_log_unrated: '...'` and add immediately after:
```typescript
    date_log_unconfirmed: 'Баталгаагүй',
```

- [ ] **Step 3: Show the marker in `TrophyRow`**

In `app/date-log.tsx`, find:
```tsx
          {trophy.myStars ? (
            <Text style={styles.stars}>{'⭐'.repeat(trophy.myStars)}</Text>
          ) : (
            <Text style={styles.unrated}>{i18n.t('date_log_unrated')}</Text>
          )}
```
Replace with:
```tsx
          {trophy.mismatched ? (
            <Text style={styles.unrated}>{i18n.t('date_log_unconfirmed')}</Text>
          ) : trophy.myStars ? (
            <Text style={styles.stars}>{'⭐'.repeat(trophy.myStars)}</Text>
          ) : (
            <Text style={styles.unrated}>{i18n.t('date_log_unrated')}</Text>
          )}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Run the full app test suite**

```bash
npm test
```
Expected: all pass, including the i18n key-parity test.

- [ ] **Step 6: Commit**

```bash
git add models/trophy.ts app/date-log.tsx lib/i18n.ts
git commit -m "Show a neutral Unconfirmed marker for mismatched attendance in the Date Log"
```

---

### Task 12: Manual end-to-end verification

**Files:** none (verification only — no code changes)

- [ ] **Step 1: Load the `mingldingl:verify` skill**

This project has a dedicated skill documenting how to create real Supabase test users/JWTs without SMS and drive the engine end-to-end. Load it before starting.

- [ ] **Step 2: Restart the engine with all of this plan's changes**

```bash
cd mingldingl_engine && ./scripts/start-engine.sh
```

- [ ] **Step 3: Seed two matched users, confirm a date, backdate `CompletedAt`, verify the full flow via curl**

Follow the `mingldingl:verify` skill's pattern (create two Supabase test users, upsert engine profiles, match them, exchange 15+ messages, fetch suggestions, confirm the same suggestion for both). Then directly backdate the resulting `DateConfirmation.CompletedAt` via `psql` to `now() - interval '49 hours'` (the API itself sets it to `now()` on completion — there's no way to fast-forward 48 real hours in a live verification pass).

Then:
```bash
curl -s "http://localhost:5150/activities/{matchId}/attendance-check" -H "Authorization: Bearer <userA token>"
```
Expected: `{"due":true,"activityTitle":"..."}`.

Submit a mismatch:
```bash
curl -s -X POST "http://localhost:5150/activities/{matchId}/attendance-check" -H "Authorization: Bearer <userA token>" -H "Content-Type: application/json" -d '{"attended":true}'
curl -s -X POST "http://localhost:5150/activities/{matchId}/attendance-check" -H "Authorization: Bearer <userB token>" -H "Content-Type: application/json" -d '{"attended":false}'
```
Expected: userB's response is `{"attended":false}`. Confirm via `psql` that userB's `NoShowFlagCount` is now `1` and `ReputationScore` is unchanged (still `1.0`, below the default threshold of 3).

- [ ] **Step 4: Verify the Date Log marker**

```bash
curl -s "http://localhost:5150/activities/mine" -H "Authorization: Bearer <userA token>"
```
Expected: the entry for this match has `"mismatched":true`.

- [ ] **Step 5: Verify the app screens in a browser**

Start the web app (`npx expo start --web --port 8081`), log in as userA via the `mingldingl:verify` skill's stubbed anonymous-signin trick, navigate to the chat screen for this match. Expected: a fourth banner reading "Did You Meet Up?" is visible (since userA already answered in Step 3 for this specific match, seed a *second* fresh matched pair for this visual check, or log in as a fresh third user with their own eligible-but-unanswered confirmation). Tap it — the `AttendanceCheckModal` should appear with Yes/No buttons and no free-text field. Tap an answer — the modal closes and the banner disappears without a page reload.

Navigate to the Date Log screen (`/date-log`) for a user with a mismatched entry from Step 3 — expected: "Unconfirmed" shown instead of a star rating or "not yet rated," with no indication of which side answered which way.

- [ ] **Step 6: Clean up all verification data**

Delete every row created in this task (`DateConfirmations`, `ActivitySuggestions`, `messages`, `ScoreEvents`, `UserDailyQuests`, `UserMilestones`, `Matches`, `Users`) via `psql`, in FK-dependency order (children before parents), matching the cleanup pattern used throughout this session. Confirm with:
```bash
cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test
```
Expected: still all passing (proves no leftover verification data broke any before/after-delta assertions elsewhere in the suite).

- [ ] **Step 7: Final full-suite run, both projects**

```bash
cd mingldingl_engine && DOTNET_ROOT=$HOME/.dotnet $HOME/.dotnet/dotnet test
cd ../mingldingl_app && npm test && npx tsc --noEmit
```
Expected: everything green. No commit for this task — it's verification only.
