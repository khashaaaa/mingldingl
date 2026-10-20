using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Features.Auth;

namespace MinglDingl.Engine.Features.Honours;

/// The 22 marks of the honour case, in the case's order: 15 honours (hammered gold) and 7 feats
/// (verdigris bronze). A yearly one is earned once per year (the festival honours).
public sealed record HonourDefinition(string Key, string Kind, bool Yearly = false);

public static class HonourKeys
{
    public const string SealBreaker = "sealBreaker";
    public const string Flamekeeper = "flamekeeper";
    public const string SevenDawns = "sevenDawns";
    public const string AllyCaller = "allyCaller";
    public const string TrueToWord = "trueToWord";
    public const string ThreadWeaver = "threadWeaver";
    public const string Mended = "mended";
    public const string Cartographer = "cartographer";
    public const string BondKeeper = "bondKeeper";
    public const string OathKeeper = "oathKeeper";
    public const string FateSeer = "fateSeer";
    public const string Hearthbound = "hearthbound";
    public const string FellowTraveller = "fellowTraveller";
    public const string Naadam = "naadam";
    public const string TsagaanSar = "tsagaanSar";
    public const string FirstBond = "firstBond";
    public const string IceBroken = "iceBroken";
    public const string FirstTrial = "firstTrial";
    public const string TenWords = "tenWords";
    public const string FirstPledge = "firstPledge";
    public const string FaceToFlame = "faceToFlame";
    public const string OathFulfilled = "oathFulfilled";

    public static readonly IReadOnlyList<HonourDefinition> All =
    [
        new(SealBreaker, "honour"), new(Flamekeeper, "honour"), new(SevenDawns, "honour"),
        new(AllyCaller, "honour"), new(TrueToWord, "honour"), new(ThreadWeaver, "honour"),
        new(Mended, "honour"), new(Cartographer, "honour"), new(BondKeeper, "honour"),
        new(OathKeeper, "honour"), new(FateSeer, "honour"), new(Hearthbound, "honour"), new(FellowTraveller, "honour"),
        new(Naadam, "honour", Yearly: true), new(TsagaanSar, "honour", Yearly: true),
        new(FirstBond, "feat"), new(IceBroken, "feat"), new(FirstTrial, "feat"), new(TenWords, "feat"),
        new(FirstPledge, "feat"), new(FaceToFlame, "feat"), new(OathFulfilled, "feat"),
    ];
}

/// One honour someone holds. Year is 0 except for a yearly honour. SeenAt is null until the
/// honour-earned ceremony has played on one of their devices.
public sealed class HonourEarned
{
    public Guid AccountId { get; set; }
    public string Key { get; set; } = "";
    public int Year { get; set; }
    public DateTimeOffset EarnedAt { get; set; }
    public DateTimeOffset? SeenAt { get; set; }
}

internal sealed class HonourEarnedMap : IEntityTypeConfiguration<HonourEarned>
{
    public void Configure(EntityTypeBuilder<HonourEarned> e)
    {
        e.ToTable("honours");
        e.HasKey(x => new { x.AccountId, x.Key, x.Year });
        e.Property(x => x.Key).HasMaxLength(16);
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
    }
}

/// earnedAt: the first time; times: how many years a yearly honour was earned (1 otherwise).
public sealed record HonourView(string Key, string Kind, bool Earned, DateTimeOffset? EarnedAt, int Times, bool Unseen);

/// word: kept of (kept + no-shows against you); scars: open, closed; districts: charted, in order.
public sealed record StandingView(int Kept, int Counted, int OpenScars, int ClosedScars, IReadOnlyList<string> Districts);

/// One closed meeting in the Encounter Log. outcome: kept / noShow (theirs) / missed (yours) /
/// disputed / excused / unanswered. charted: the district it charted for the first time, if any.
public sealed record EncounterLogRow(Guid MeetingId, Guid BondId, string Name, string Venue, string? VenueMn, DateTimeOffset At,
    string Outcome, string? Charted);

public sealed record EncounterLogView(StandingView Standing, IReadOnlyList<EncounterLogRow> Encounters);
