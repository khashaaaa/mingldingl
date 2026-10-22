using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Kernel.Config;

namespace MinglDingl.Engine.Features.Quests;

/// A quest kind: how many of what, and the config key holding its points.
public sealed record QuestDefinition(string Kind, string Period, int Target, string PointsKey);

public static class QuestKinds
{
    public const string LightHearth = "lightHearth";
    public const string AnswerLetters = "answerLetters";
    public const string FirstLetter = "firstLetter";
    public const string Summon = "summon";
    public const string BreakIce = "breakIce";
    public const string TakeTrial = "takeTrial";
    public const string KeepEncounter = "keepEncounter";
    public const string LightRite = "lightRite";
    public const string BreakSeal = "breakSeal";

    public const string Daily = "daily";
    public const string Weekly = "weekly";

    /// Light the hearth is always the first of the day; two more are drawn from the rest.
    public static readonly QuestDefinition Hearth = new(LightHearth, Daily, 1, ConfigKeys.QuestLightHearth);

    public static readonly IReadOnlyList<QuestDefinition> DailyPool =
    [
        new(AnswerLetters, Daily, 3, ConfigKeys.QuestAnswerLetters),
        new(FirstLetter, Daily, 1, ConfigKeys.QuestFirstLetter),
        new(Summon, Daily, 1, ConfigKeys.QuestSummon),
        new(BreakIce, Daily, 1, ConfigKeys.QuestBreakIce),
        new(TakeTrial, Daily, 1, ConfigKeys.QuestTakeTrial),
    ];

    public static readonly IReadOnlyList<QuestDefinition> WeeklyPool =
    [
        new(KeepEncounter, Weekly, 1, ConfigKeys.QuestKeepEncounter),
        new(LightRite, Weekly, 1, ConfigKeys.QuestLightRite),
        new(BreakSeal, Weekly, 1, ConfigKeys.QuestBreakSeal),
    ];
}

/// A claimed quest: its bounty was paid. Period is the day (daily) or the week's Monday (weekly).
public sealed class QuestClaim
{
    public Guid AccountId { get; set; }
    public string Kind { get; set; } = "";
    public DateOnly Period { get; set; }
    public int Points { get; set; }
    public DateTimeOffset ClaimedAt { get; set; }
}

/// A bounty chest in the Satchel, earned by claiming the last of a day's quests. Shown before it
/// opens (no gamble); opening pays what it shows.
public sealed class Chest
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    /// The quest whose claim filled the day.
    public string FromQuest { get; set; } = "";
    public DateOnly Day { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? OpenedAt { get; set; }
}

internal sealed class QuestClaimMap : IEntityTypeConfiguration<QuestClaim>
{
    public void Configure(EntityTypeBuilder<QuestClaim> e)
    {
        e.ToTable("quest_claims");
        e.HasKey(x => new { x.AccountId, x.Kind, x.Period });
        e.Property(x => x.Kind).HasMaxLength(16);
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class ChestMap : IEntityTypeConfiguration<Chest>
{
    public void Configure(EntityTypeBuilder<Chest> e)
    {
        e.ToTable("chests");
        e.Property(x => x.FromQuest).HasMaxLength(16);
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
        // One chest a day at most, enforced by the database.
        e.HasIndex(x => new { x.AccountId, x.Day }).IsUnique();
    }
}

/// done: progress reached the target; claimed: its bounty was paid.
public sealed record QuestView(string Kind, string Period, int Progress, int Target, int Points, bool Done, bool Claimed);

/// dawns: days returned in a row; lit: dots lit on the seven-dawn row (dawns wrap at the cap).
/// gerRests: a member's missed dawns kept this moon and how many are left.
/// chests: unopened chests in the satchel; districtsCharted: districts with a kept encounter (the character sheet).
public sealed record QuestBoard(IReadOnlyList<QuestView> Daily, IReadOnlyList<QuestView> Weekly, int Dawns, int Lit, int StreakCap,
    DateOnly Day, DateOnly WeekEnds, Score.GerRestView GerRests, int Chests, int DistrictsCharted);

public sealed record ChestView(Guid Id, string FromQuest, int Points, DateTimeOffset CreatedAt);

public sealed record ClaimResult(int Earned, ChestView? Chest);
