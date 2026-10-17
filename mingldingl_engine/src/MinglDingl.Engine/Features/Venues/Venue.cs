using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Features.Auth;

namespace MinglDingl.Engine.Features.Venues;

/// A partner place verified by the keepers, offered for a first meeting. Removing one keeps the
/// row (meetings point at it) and hides it from new meetings.
public sealed class Venue
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    /// The Mongolian name, written by a native speaker; null until then.
    public string? NameMn { get; set; }
    public string Kind { get; set; } = "";
    /// A city key from MongoliaGeo (a district of the capital, or an aimag centre).
    public string District { get; set; } = "";
    public string Address { get; set; } = "";
    public string? Hours { get; set; }
    public string? Description { get; set; }
    public bool Verified { get; set; }
    public DateTimeOffset? RemovedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public sealed class VenuePhoto
{
    public Guid Id { get; set; }
    public Guid VenueId { get; set; }
    public int Position { get; set; }
    public string Path { get; set; } = "";
    public int Width { get; set; }
    public int Height { get; set; }
    public byte[] ThumbHash { get; set; } = [];
    public DateTimeOffset CreatedAt { get; set; }
}

/// One person's stars for a place, after a kept meeting there: once per person per meeting.
public sealed class VenueRating
{
    public Guid Id { get; set; }
    public Guid VenueId { get; set; }
    public Guid MeetingId { get; set; }
    public Guid AccountId { get; set; }
    public int Stars { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public static class VenueKinds
{
    public static readonly IReadOnlyList<string> All = ["Cafe", "Restaurant", "Bar", "Entertainment", "Outdoor", "Culture"];
}

internal sealed class VenueMap : IEntityTypeConfiguration<Venue>
{
    public void Configure(EntityTypeBuilder<Venue> e)
    {
        e.ToTable("venues");
        e.Property(x => x.Name).HasMaxLength(Kernel.Validation.FieldLimits.VenueName);
        e.Property(x => x.NameMn).HasMaxLength(Kernel.Validation.FieldLimits.VenueName);
        e.Property(x => x.Kind).HasMaxLength(20);
        e.Property(x => x.District).HasMaxLength(40);
        e.Property(x => x.Address).HasMaxLength(Kernel.Validation.FieldLimits.VenueAddress);
        e.Property(x => x.Hours).HasMaxLength(Kernel.Validation.FieldLimits.VenueHours);
        e.Property(x => x.Description).HasMaxLength(Kernel.Validation.FieldLimits.VenueDescription);
        e.HasIndex(x => new { x.Verified, x.RemovedAt });
    }
}

internal sealed class VenuePhotoMap : IEntityTypeConfiguration<VenuePhoto>
{
    public void Configure(EntityTypeBuilder<VenuePhoto> e)
    {
        e.ToTable("venue_photos");
        e.Property(x => x.Path).HasMaxLength(100);
        e.HasOne<Venue>().WithMany().HasForeignKey(x => x.VenueId).OnDelete(DeleteBehavior.Cascade);
        e.HasIndex(x => new { x.VenueId, x.Position });
    }
}

internal sealed class VenueRatingMap : IEntityTypeConfiguration<VenueRating>
{
    public void Configure(EntityTypeBuilder<VenueRating> e)
    {
        e.ToTable("venue_ratings");
        e.HasOne<Venue>().WithMany().HasForeignKey(x => x.VenueId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
        e.HasIndex(x => new { x.MeetingId, x.AccountId }).IsUnique();
        e.HasIndex(x => x.VenueId);
    }
}
