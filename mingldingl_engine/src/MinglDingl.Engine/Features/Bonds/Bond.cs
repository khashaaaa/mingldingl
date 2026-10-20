using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Features.Auth;

namespace MinglDingl.Engine.Features.Bonds;

public enum BondState { Live, Cold, Severed, Faded, Retired }

/// Two people (A < B by id), at most one live bond at a time; a severed or faded pair may bond again
/// after seek.remeetDays. Letter counts are per side so the seals can use
/// min(A, B): a monologue never breaks one.
public sealed class Bond
{
    public Guid Id { get; set; }
    public Guid AId { get; set; }
    public Guid BId { get; set; }
    /// Who made it: the summoner (Seek), or the weaver of a Fated Thread (then neither side summoned).
    public Guid SummonerId { get; set; }
    /// How it was made: seek / thread / square. Only a Seek summons spends a candle.
    public string Origin { get; set; } = BondOrigins.Seek;
    /// The Ulaanbaatar day of the summons — the summoner's candles count by it.
    public DateOnly SummonDay { get; set; }
    public BondState State { get; set; }
    public int LettersA { get; set; }
    public int LettersB { get; set; }
    public int Seals { get; set; }
    public DateTimeOffset? LastLetterAt { get; set; }
    public Guid? LastLetterBy { get; set; }
    /// The Quest Log's preview line (first 140 characters of the last letter).
    public string? LastLetterText { get; set; }
    /// When the silent side was warned that the fire is dying (cleared by their reply).
    public DateTimeOffset? EmbersAt { get; set; }
    public DateTimeOffset? ReadA { get; set; }
    public DateTimeOffset? ReadB { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }
    /// Severed: who severed (or cast out). Cold: who fell silent. Faded: null. Retired: who accepted.
    public Guid? ClosedBy { get; set; }
    /// Why a bond closed when it was not the two of them: "retired" (one of them retired with someone else).
    public string? ClosedWhy { get; set; }
    /// A Sever gives the severed side back a candle spent that Ulaanbaatar day (never a cast-out).
    public Guid? CandleBackTo { get; set; }
    public DateOnly? CandleBackDay { get; set; }
    /// Retire together: who asked and when; a "not now" (the asker may ask again later).
    public Guid? RetireBy { get; set; }
    public DateTimeOffset? RetireAt { get; set; }
    public DateTimeOffset? RetireDeclinedAt { get; set; }

    public bool Has(Guid id) => AId == id || BId == id;
    public Guid Other(Guid me) => AId == me ? BId : AId;
    public int Mutual => Math.Min(LettersA, LettersB);
    public static (Guid A, Guid B) Pair(Guid x, Guid y) => x.CompareTo(y) < 0 ? (x, y) : (y, x);
}

public static class BondOrigins
{
    public const string Seek = "seek";
    public const string Thread = "thread";
    public const string Square = "square";
}

/// A letter. sealBroken: the seal (1–4) this letter broke, shown as its ceremony row.
public sealed class Letter
{
    public Guid Id { get; set; }
    public Guid BondId { get; set; }
    public Guid AuthorId { get; set; }
    public string Text { get; set; } = "";
    public int? SealBroken { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

internal sealed class BondMap : IEntityTypeConfiguration<Bond>
{
    public void Configure(EntityTypeBuilder<Bond> e)
    {
        e.ToTable("bonds");
        e.Property(x => x.State).HasConversion<string>().HasMaxLength(10);
        e.Property(x => x.LastLetterText).HasMaxLength(140);
        e.Property(x => x.ClosedWhy).HasMaxLength(16);
        e.Property(x => x.Origin).HasMaxLength(8).HasDefaultValue(BondOrigins.Seek);
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.AId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.BId).OnDelete(DeleteBehavior.Cascade);
        e.HasIndex(x => new { x.AId, x.BId }).IsUnique().HasFilter("\"State\" = 'Live'");
        e.HasIndex(x => new { x.CandleBackTo, x.CandleBackDay });
        e.HasIndex(x => new { x.BId, x.State });
        e.HasIndex(x => new { x.AId, x.State });
        e.HasIndex(x => new { x.SummonerId, x.SummonDay });
        e.HasIndex(x => new { x.State, x.LastLetterAt });
    }
}

internal sealed class LetterMap : IEntityTypeConfiguration<Letter>
{
    public void Configure(EntityTypeBuilder<Letter> e)
    {
        e.ToTable("letters");
        e.Property(x => x.Text).HasMaxLength(Kernel.Validation.FieldLimits.Letter);
        e.HasOne<Bond>().WithMany().HasForeignKey(x => x.BondId).OnDelete(DeleteBehavior.Cascade);
        e.HasIndex(x => new { x.BondId, x.CreatedAt });
    }
}
