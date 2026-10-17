using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Features.Auth;

namespace MinglDingl.Engine.Features.Score;

public static class DeedKinds
{
    public const string Finished = "finished";
    public const string FirstLetter = "firstLetter";
    public const string Reply = "reply";
    public const string Dawn = "dawn";
    public const string SeventhDawn = "seventhDawn";
    public const string GoneCold = "goneCold";
    public const string Penalised = "penalised";
    public const string Icebreaker = "icebreaker";
    public const string Trial = "trial";
    public const string Rite = "rite";
    public const string Meeting = "meeting";
    public const string OathProven = "oathProven";
    public const string Quest = "quest";
    public const string Chest = "chest";
    public const string CampaignRoom = "campaignRoom";
    public const string CampaignBoss = "campaignBoss";
    public const string WeeklyTrial = "weeklyTrial";
    public const string ThreadSparked = "threadSparked";
    /// An ally's bounty: `allyCalled` to the one whose code brought them, `ally` to the newcomer.
    public const string AllyCalled = "allyCalled";
    public const string Ally = "ally";
    public const string Square = "square";
}

/// One line of the Chronicle of Deeds: a change to someone's points. Amount is what was applied
/// (points never go below 0, so a penalty at 10 points records −10).
public sealed class ScoreEvent
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public string Kind { get; set; } = "";
    public int Amount { get; set; }
    public Guid? BondId { get; set; }
    /// The Ulaanbaatar day it happened — daily caps and the once-a-day return count by it.
    public DateOnly Day { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

internal sealed class ScoreEventMap : IEntityTypeConfiguration<ScoreEvent>
{
    public void Configure(EntityTypeBuilder<ScoreEvent> e)
    {
        e.ToTable("score_events");
        e.Property(x => x.Kind).HasMaxLength(24);
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
        e.HasIndex(x => new { x.AccountId, x.CreatedAt });
        e.HasIndex(x => new { x.AccountId, x.BondId, x.Day, x.Kind });
        // Paid once ever, and once a day — enforced by the database, not by a read-then-write.
        e.HasIndex(x => new { x.AccountId, x.Kind }).IsUnique().HasFilter("\"Kind\" = 'finished'")
            .HasDatabaseName("ux_score_once");
        e.HasIndex(x => new { x.AccountId, x.Kind, x.Day }).IsUnique().HasFilter("\"Kind\" IN ('dawn', 'seventhDawn')")
            .HasDatabaseName("ux_score_daily");
    }
}
