using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Features.Bonds;

namespace MinglDingl.Engine.Features.Campaign;

/// The seven chambers of a bond's Campaign, in order; each opens by a deed the pair does together.
public static class Chambers
{
    public const string Letters = "letters";
    public const string FirstSeal = "firstSeal";
    public const string Icebreaker = "icebreaker";
    public const string Trial = "trial";
    public const string Rite = "rite";
    public const string ThirdSeal = "thirdSeal";
    /// The boss's seal: broken by a kept encounter.
    public const string Boss = "boss";

    public static readonly IReadOnlyList<string> All = [Letters, FirstSeal, Icebreaker, Trial, Rite, ThirdSeal, Boss];
}

/// A chamber cleared, and when (its points were paid then; a backfilled one paid nothing).
public sealed class ChamberCleared
{
    public Guid BondId { get; set; }
    public string Chamber { get; set; } = "";
    public DateTimeOffset ClearedAt { get; set; }
}

public enum TrialKind { Exchange, ThreeGames }

/// A bond's trial for one week (Monday–Sunday): the Exchange, or during Naadam the Three Games.
public sealed class WeeklyTrial
{
    public Guid Id { get; set; }
    public Guid BondId { get; set; }
    public DateOnly Week { get; set; }
    public TrialKind Kind { get; set; }
    /// Exchange: [prompt]. Three Games: [aim question (a Trial question), speed prompt (an icebreaker question)].
    public int[] Prompts { get; set; } = [];
    public DateTimeOffset CreatedAt { get; set; }
}

/// One side's answer to one game of a weekly trial. Game: 0 (the Exchange, or strength), 1 aim, 2 speed.
public sealed class WeeklyAnswer
{
    public Guid TrialId { get; set; }
    public int Game { get; set; }
    public Guid AccountId { get; set; }
    public string? Text { get; set; }
    public int? Choice { get; set; }
    /// Aim: the guess at the other's choice.
    public int? Guess { get; set; }
    /// Speed: when this side first opened the prompt (the hour runs from here).
    public DateTimeOffset? OpenedAt { get; set; }
    public DateTimeOffset? AnsweredAt { get; set; }
}

internal sealed class ChamberClearedMap : IEntityTypeConfiguration<ChamberCleared>
{
    public void Configure(EntityTypeBuilder<ChamberCleared> e)
    {
        e.ToTable("campaign_chambers");
        e.HasKey(x => new { x.BondId, x.Chamber });
        e.Property(x => x.Chamber).HasMaxLength(16);
        e.HasOne<Bond>().WithMany().HasForeignKey(x => x.BondId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class WeeklyTrialMap : IEntityTypeConfiguration<WeeklyTrial>
{
    public void Configure(EntityTypeBuilder<WeeklyTrial> e)
    {
        e.ToTable("weekly_trials");
        e.Property(x => x.Kind).HasConversion<string>().HasMaxLength(12);
        e.HasOne<Bond>().WithMany().HasForeignKey(x => x.BondId).OnDelete(DeleteBehavior.Cascade);
        e.HasIndex(x => new { x.BondId, x.Week }).IsUnique();
    }
}

internal sealed class WeeklyAnswerMap : IEntityTypeConfiguration<WeeklyAnswer>
{
    public void Configure(EntityTypeBuilder<WeeklyAnswer> e)
    {
        e.ToTable("weekly_answers");
        e.HasKey(x => new { x.TrialId, x.Game, x.AccountId });
        e.Property(x => x.Text).HasMaxLength(Kernel.Validation.FieldLimits.Icebreaker);
        e.HasOne<WeeklyTrial>().WithMany().HasForeignKey(x => x.TrialId).OnDelete(DeleteBehavior.Cascade);
    }
}

/// retire: none / available / askedByMe / askedByThem.
public sealed record CampaignView(IReadOnlyList<ChamberView> Chambers, int Cleared, string Retire);

public sealed record ChamberView(string Key, bool Cleared, DateTimeOffset? ClearedAt);

/// One game of the week's trial as the reader sees it. Theirs shows only once both answered.
/// open: the speed game's hour started for me (null before I opened it); late: answered after the hour.
public sealed record GameView(int Game, string Kind, string? Prompt, IReadOnlyList<string>? Choices,
    bool Answered, bool TheyAnswered, string? MyText, int? MyChoice, int? MyGuess, string? TheirText, int? TheirChoice,
    int? TheirGuess, DateTimeOffset? OpenedAt, DateTimeOffset? Due, bool Paid);

/// kind: exchange / threeGames; endsAt: Sunday midnight in Ulaanbaatar.
public sealed record WeeklyTrialView(Guid Id, string Kind, DateOnly Week, DateTimeOffset EndsAt, int Points,
    IReadOnlyList<GameView> Games);

public sealed record WeeklyAnswerRequest(
    [System.ComponentModel.DataAnnotations.StringLength(Kernel.Validation.FieldLimits.Icebreaker)] string? Text,
    int? Choice, int? Guess);
