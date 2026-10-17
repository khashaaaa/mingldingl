using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Venues;

namespace MinglDingl.Engine.Features.Encounters;

/// What a bond has done beyond its letters (one row per bond, made when its first step opens).
/// A/B follow the bond's A/B (A has the lower id).
public sealed class Encounter
{
    public Guid BondId { get; set; }

    public int? IcebreakerId { get; set; }
    public DateTimeOffset? IcebreakerOpenAt { get; set; }
    public string? IcebreakerA { get; set; }
    public string? IcebreakerB { get; set; }
    public DateTimeOffset? IcebreakerRevealedAt { get; set; }

    public int[]? TrialIds { get; set; }
    public DateTimeOffset? TrialOpenAt { get; set; }
    public int[] TrialA { get; set; } = [];
    public int[] TrialB { get; set; } = [];
    public DateTimeOffset? TrialDoneAt { get; set; }

    /// The Flame Rite: who proposed and when; accepted; declined (the proposer waits); done.
    public Guid? RiteBy { get; set; }
    public DateTimeOffset? RiteAt { get; set; }
    public DateTimeOffset? RiteAcceptedAt { get; set; }
    public DateTimeOffset? RiteDeclinedAt { get; set; }
    public DateTimeOffset? RiteDoneAt { get; set; }

    public DateTimeOffset? MeetingOpenAt { get; set; }
}

public sealed class IcebreakerQuestion
{
    public int Id { get; set; }
    public string Text { get; set; } = "";
}

/// A Trial question: four choices with a line of colour each, and its topic — what the result
/// says the pair agree or differ on ("how a free Saturday begins").
public sealed class TrialQuestion
{
    public int Id { get; set; }
    public string Text { get; set; } = "";
    public string[] Choices { get; set; } = [];
    public string[] Hints { get; set; } = [];
    public string Topic { get; set; } = "";
}

public enum MeetingState { Proposed, Sworn, CalledOff, Checking, Closed }
public enum MeetingOutcome { Kept, NoShow, Disputed, Excused, Unanswered }
public enum AttendanceAnswer { Met, NoShow, CouldNotGo }

/// A meeting a bond pledged to. A proposal is the proposer's pledge; the other's pledge swears it.
public sealed class Meeting
{
    public Guid Id { get; set; }
    public Guid BondId { get; set; }
    public Guid VenueId { get; set; }
    public DateTimeOffset At { get; set; }
    public Guid ProposedBy { get; set; }
    public bool PledgeA { get; set; }
    public bool PledgeB { get; set; }
    public MeetingState State { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? SwornAt { get; set; }
    public DateTimeOffset? CalledOffAt { get; set; }
    public Guid? CalledOffBy { get; set; }
    public DateTimeOffset? CheckUntil { get; set; }
    public AttendanceAnswer? AnswerA { get; set; }
    public AttendanceAnswer? AnswerB { get; set; }
    public MeetingOutcome? Outcome { get; set; }
    /// NoShow: who did not come.
    public Guid? NoShowOf { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }
}

internal sealed class EncounterMap : IEntityTypeConfiguration<Encounter>
{
    public void Configure(EntityTypeBuilder<Encounter> e)
    {
        e.ToTable("encounters");
        e.HasKey(x => x.BondId);
        e.HasOne<Bond>().WithOne().HasForeignKey<Encounter>(x => x.BondId).OnDelete(DeleteBehavior.Cascade);
        e.Property(x => x.IcebreakerA).HasMaxLength(Kernel.Validation.FieldLimits.Icebreaker);
        e.Property(x => x.IcebreakerB).HasMaxLength(Kernel.Validation.FieldLimits.Icebreaker);
    }
}

internal sealed class IcebreakerQuestionMap : IEntityTypeConfiguration<IcebreakerQuestion>
{
    public void Configure(EntityTypeBuilder<IcebreakerQuestion> e)
    {
        e.ToTable("icebreaker_questions");
        e.Property(x => x.Id).ValueGeneratedNever();
        e.Property(x => x.Text).HasMaxLength(300);
    }
}

internal sealed class TrialQuestionMap : IEntityTypeConfiguration<TrialQuestion>
{
    public void Configure(EntityTypeBuilder<TrialQuestion> e)
    {
        e.ToTable("trial_questions");
        e.Property(x => x.Id).ValueGeneratedNever();
        e.Property(x => x.Text).HasMaxLength(200);
        e.Property(x => x.Topic).HasMaxLength(120);
    }
}

internal sealed class MeetingMap : IEntityTypeConfiguration<Meeting>
{
    public void Configure(EntityTypeBuilder<Meeting> e)
    {
        e.ToTable("meetings");
        e.Property(x => x.State).HasConversion<string>().HasMaxLength(12);
        e.Property(x => x.Outcome).HasConversion<string>().HasMaxLength(12);
        e.Property(x => x.AnswerA).HasConversion<string>().HasMaxLength(12);
        e.Property(x => x.AnswerB).HasConversion<string>().HasMaxLength(12);
        e.HasOne<Bond>().WithMany().HasForeignKey(x => x.BondId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne<Venue>().WithMany().HasForeignKey(x => x.VenueId).OnDelete(DeleteBehavior.Restrict);
        e.HasIndex(x => new { x.BondId, x.State });
        e.HasIndex(x => new { x.State, x.At });
        e.HasIndex(x => new { x.NoShowOf, x.ClosedAt });
    }
}
