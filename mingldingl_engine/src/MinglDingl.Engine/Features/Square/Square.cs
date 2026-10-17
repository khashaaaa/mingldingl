using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Features.Auth;

namespace MinglDingl.Engine.Features.Square;

/// A Town Square gathering the keepers ring: rounds of speed meetings over video, one stranger per
/// round, a man and a woman at each table. Its timeline is arithmetic from StartsAt (see Night).
public sealed class Gathering
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    /// A festival's bell (its art and words), or null for an ordinary one.
    public string? Festival { get; set; }
    /// Voices only until the bell.
    public bool Masked { get; set; }
    public DateTimeOffset StartsAt { get; set; }
    public int Rounds { get; set; }
    public int RoundMinutes { get; set; }
    public int Seats { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }
    /// The "a minute before" call went out.
    public DateTimeOffset? CalledAt { get; set; }
}

public sealed class Seat
{
    public Guid GatheringId { get; set; }
    public Guid AccountId { get; set; }
    public string Gender { get; set; } = "";
    public DateTimeOffset TakenAt { get; set; }
    /// Stepped into the square tonight; LeftAt: gave up the remaining rounds.
    public DateTimeOffset? JoinedAt { get; set; }
    public DateTimeOffset? LeftAt { get; set; }
    /// The attendance points were paid (once per gathering, after a first round).
    public bool AttendPaid { get; set; }
}

/// One round's pairing was made (so it is made once, whichever engine instance gets there first).
public sealed class SquareRound
{
    public Guid GatheringId { get; set; }
    public int Index { get; set; }
    public DateTimeOffset PairedAt { get; set; }
    public DateTimeOffset? SettledAt { get; set; }
}

/// A table for one round: a man, a woman, the question at the bell, and what each decided.
public sealed class SquarePair
{
    public Guid Id { get; set; }
    public Guid GatheringId { get; set; }
    public int Round { get; set; }
    public Guid ManId { get; set; }
    public Guid WomanId { get; set; }
    public string Question { get; set; } = "";
    public bool? ManYes { get; set; }
    public bool? WomanYes { get; set; }
    public Guid? BondId { get; set; }
    /// match / apart, once settled.
    public string? Outcome { get; set; }

    public bool Has(Guid id) => ManId == id || WomanId == id;
    public Guid Other(Guid me) => ManId == me ? WomanId : ManId;
}

internal sealed class GatheringMap : IEntityTypeConfiguration<Gathering>
{
    public void Configure(EntityTypeBuilder<Gathering> e)
    {
        e.ToTable("gatherings");
        e.Property(x => x.Name).HasMaxLength(Kernel.Validation.FieldLimits.GatheringName);
        e.Property(x => x.Festival).HasMaxLength(16);
        e.HasIndex(x => x.StartsAt);
    }
}

internal sealed class SeatMap : IEntityTypeConfiguration<Seat>
{
    public void Configure(EntityTypeBuilder<Seat> e)
    {
        e.ToTable("square_seats");
        e.HasKey(x => new { x.GatheringId, x.AccountId });
        e.Property(x => x.Gender).HasMaxLength(10);
        e.HasOne<Gathering>().WithMany().HasForeignKey(x => x.GatheringId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class SquareRoundMap : IEntityTypeConfiguration<SquareRound>
{
    public void Configure(EntityTypeBuilder<SquareRound> e)
    {
        e.ToTable("square_rounds");
        e.HasKey(x => new { x.GatheringId, x.Index });
        e.HasOne<Gathering>().WithMany().HasForeignKey(x => x.GatheringId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class SquarePairMap : IEntityTypeConfiguration<SquarePair>
{
    public void Configure(EntityTypeBuilder<SquarePair> e)
    {
        e.ToTable("square_pairs");
        e.Property(x => x.Question).HasMaxLength(300);
        e.Property(x => x.Outcome).HasMaxLength(8);
        e.HasOne<Gathering>().WithMany().HasForeignKey(x => x.GatheringId).OnDelete(DeleteBehavior.Cascade);
        e.HasIndex(x => new { x.GatheringId, x.Round });
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.ManId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.WomanId).OnDelete(DeleteBehavior.Cascade);
    }
}

/// state: open (seats can be taken) / running / closed / cancelled. side: seats for my side, taken.
/// doorsAt: from when the seated may step in (before the first bell).
/// seatsOpenAt: when anyone may sit; before it only the High Table (its first seat at the bells).
public sealed record GatheringView(Guid Id, string Name, string? Festival, bool Masked, DateTimeOffset StartsAt, int Rounds,
    int RoundMinutes, int Seats, int Taken, int SideSeats, int SideTaken, bool Seated, string State, DateTimeOffset EndsAt,
    DateTimeOffset DoorsAt, DateTimeOffset SeatsOpenAt);

/// The square tab: the next gathering (or the one running), or none.
public sealed record SquareView(GatheringView? Next);

/// My night at the square, read from the clock. phase: filling (before the first bell or sitting a
/// round out) / live / bell / decided / result / closed / left / notSeated. phaseEndsAt: when it
/// changes next. partner, call: the table this round (call only while live). outcome: match / apart.
public sealed record NightView(Guid GatheringId, string Name, string? Festival, bool Masked, string Phase, int Round,
    int Rounds, DateTimeOffset PhaseEndsAt, NightPartner? Partner, NightCall? Call, string? Question, bool? MyYes,
    string? Outcome, Guid? BondId, int BondsTonight);

public sealed record NightPartner(Guid AccountId, string Name, int Age, uint Uid);

public sealed record NightCall(string AppId, string Channel, string Token, uint Uid);

public sealed record DecideRequest(bool Yes);

public sealed record GatheringWriteRequest(
    [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(Kernel.Validation.FieldLimits.GatheringName)] string Name,
    DateTimeOffset StartsAt,
    [System.ComponentModel.DataAnnotations.Range(1, 12)] int Rounds,
    [System.ComponentModel.DataAnnotations.Range(1, 30)] int RoundMinutes,
    [System.ComponentModel.DataAnnotations.Range(2, 200)] int Seats,
    [System.ComponentModel.DataAnnotations.StringLength(16)] string? Festival,
    bool Masked);

/// The keepers' row: bell, when, seats taken of total, rounds, status and bonds made.
public sealed record AdminGatheringRow(Guid Id, string Name, DateTimeOffset StartsAt, int Taken, int Seats, int Rounds,
    int RoundMinutes, string State, int Bonds, string? Festival, bool Masked);
