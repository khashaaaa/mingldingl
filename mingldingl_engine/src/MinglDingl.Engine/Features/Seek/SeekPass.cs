using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Features.Auth;

namespace MinglDingl.Engine.Features.Seek;

/// "Pass for tonight": hidden from that person's Seek for the rest of the Ulaanbaatar day.
public sealed class SeekPass
{
    public Guid AccountId { get; set; }
    public Guid TargetId { get; set; }
    public DateOnly Day { get; set; }
    /// When — a second look brings back the last one passed tonight.
    public DateTimeOffset PassedAt { get; set; }
}

/// A member's Seek filters. They narrow who comes and never reorder: nobody is shown first for
/// paying. Kept when a floor lapses, applied only while the person is a member.
public sealed class SeekFilter
{
    public Guid AccountId { get; set; }
    public int? AgeMin { get; set; }
    public int? AgeMax { get; set; }
    /// A district (a city picker key), or null for anywhere.
    public string? City { get; set; }
    public string? Oath { get; set; }
    public string? Children { get; set; }
    public string? Smoking { get; set; }
    public string? Drinking { get; set; }
    /// Only companions whose face is proven (true), or anyone (null).
    public bool? FaceProven { get; set; }
}

/// A member's one second look a night: whom it brought back.
public sealed class SecondLook
{
    public Guid AccountId { get; set; }
    public DateOnly Day { get; set; }
    public Guid TargetId { get; set; }
}

internal sealed class SeekFilterMap : IEntityTypeConfiguration<SeekFilter>
{
    public void Configure(EntityTypeBuilder<SeekFilter> e)
    {
        e.ToTable("seek_filters");
        e.HasKey(x => x.AccountId);
        e.HasOne<Account>().WithOne().HasForeignKey<SeekFilter>(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
        e.Property(x => x.City).HasMaxLength(40);
        e.Property(x => x.Oath).HasMaxLength(10);
        e.Property(x => x.Children).HasMaxLength(16);
        e.Property(x => x.Smoking).HasMaxLength(16);
        e.Property(x => x.Drinking).HasMaxLength(16);
    }
}

internal sealed class SecondLookMap : IEntityTypeConfiguration<SecondLook>
{
    public void Configure(EntityTypeBuilder<SecondLook> e)
    {
        e.ToTable("seek_second_looks");
        e.HasKey(x => new { x.AccountId, x.Day });
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.TargetId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class SeekPassMap : IEntityTypeConfiguration<SeekPass>
{
    public void Configure(EntityTypeBuilder<SeekPass> e)
    {
        e.ToTable("seek_passes");
        e.HasKey(x => new { x.AccountId, x.Day, x.TargetId });
        e.Property(x => x.PassedAt).HasDefaultValueSql("now()");
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.TargetId).OnDelete(DeleteBehavior.Cascade);
    }
}
