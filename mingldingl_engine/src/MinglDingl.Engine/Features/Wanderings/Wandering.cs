using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Features.Bonds;

namespace MinglDingl.Engine.Features.Wanderings;

/// A Wandering (Figma 260:2809–262:3214): a side road for two, off a bond's Campaign. Offrail: never
/// required, never expiring, no points and nothing lost. First roads open after the pair's first
/// kept meeting, trusted roads after the second. Seeded once; the keepers edit the words and the
/// kinds of place that suit it.
public sealed class Wandering
{
    public string Key { get; set; } = "";
    public int Position { get; set; }
    /// first | trusted
    public string Road { get; set; } = WanderingRoads.First;
    /// A hint, never a lock: any | winter | nineNines | naadam | tsagaanSar | summer | warm (spring–autumn) | juneSept.
    public string Season { get; set; } = "any";
    /// The venue kinds that suit it (VenueKinds); empty when it needs no place.
    public string[] VenueKinds { get; set; } = [];
    public string TitleEn { get; set; } = "";
    public string LineEn { get; set; } = "";
    public string BodyEn { get; set; } = "";
    public string WhereEn { get; set; } = "";
    public string TitleMn { get; set; } = "";
    public string LineMn { get; set; } = "";
    public string BodyMn { get; set; } = "";
    public string WhereMn { get; set; } = "";
    public DateTimeOffset UpdatedAt { get; set; }
}

public static class WanderingRoads
{
    public const string First = "first";
    public const string Trusted = "trusted";
}

/// One Wandering a bond took: asked by one, agreed by the other, then a line each that opens only
/// when both are written. A "not this one" closes the ask (it may be asked again).
public sealed class WanderingTaken
{
    public Guid Id { get; set; }
    public Guid BondId { get; set; }
    public string Key { get; set; } = "";
    public Guid AskedBy { get; set; }
    public DateTimeOffset AskedAt { get; set; }
    public DateTimeOffset? AgreedAt { get; set; }
    public DateTimeOffset? DeclinedAt { get; set; }
    public string? LineA { get; set; }
    public string? LineB { get; set; }
    /// Both lines written: the Wandering is kept.
    public DateTimeOffset? KeptAt { get; set; }
}

internal sealed class WanderingMap : IEntityTypeConfiguration<Wandering>
{
    public void Configure(EntityTypeBuilder<Wandering> e)
    {
        e.ToTable("wanderings");
        e.HasKey(x => x.Key);
        e.Property(x => x.Key).HasMaxLength(24);
        e.Property(x => x.Road).HasMaxLength(8);
        e.Property(x => x.Season).HasMaxLength(12);
        foreach (var p in new[] { nameof(Wandering.TitleEn), nameof(Wandering.TitleMn) }) e.Property(p).HasMaxLength(Kernel.Validation.FieldLimits.CodexTitle);
        foreach (var p in new[] { nameof(Wandering.LineEn), nameof(Wandering.LineMn) }) e.Property(p).HasMaxLength(Kernel.Validation.FieldLimits.CodexSummary);
        foreach (var p in new[] { nameof(Wandering.BodyEn), nameof(Wandering.BodyMn), nameof(Wandering.WhereEn), nameof(Wandering.WhereMn) })
            e.Property(p).HasMaxLength(Kernel.Validation.FieldLimits.WanderingText);
    }
}

internal sealed class WanderingTakenMap : IEntityTypeConfiguration<WanderingTaken>
{
    public void Configure(EntityTypeBuilder<WanderingTaken> e)
    {
        e.ToTable("wanderings_taken");
        e.Property(x => x.Key).HasMaxLength(24);
        e.Property(x => x.LineA).HasMaxLength(Kernel.Validation.FieldLimits.WanderingLine);
        e.Property(x => x.LineB).HasMaxLength(Kernel.Validation.FieldLimits.WanderingLine);
        e.HasOne<Bond>().WithMany().HasForeignKey(x => x.BondId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne<Wandering>().WithMany().HasForeignKey(x => x.Key).OnDelete(DeleteBehavior.Cascade);
        // One open ask or agreed road per bond and Wandering; a declined one may be asked again.
        e.HasIndex(x => new { x.BondId, x.Key }).IsUnique().HasFilter("\"DeclinedAt\" IS NULL");
    }
}
