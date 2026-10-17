using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Features.Auth;

namespace MinglDingl.Engine.Features.Photos;

public sealed class Photo
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public int Position { get; set; }
    public string Path { get; set; } = "";
    public int Width { get; set; }
    public int Height { get; set; }
    public byte[] ThumbHash { get; set; } = [];
    /// The app's Idempotency-Key: a retried upload returns the photo it already made.
    public string ClientKey { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
}

internal sealed class PhotoMap : IEntityTypeConfiguration<Photo>
{
    public void Configure(EntityTypeBuilder<Photo> e)
    {
        e.ToTable("photos");
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
        e.Property(x => x.Path).HasMaxLength(100);
        e.Property(x => x.ClientKey).HasMaxLength(64);
        e.HasIndex(x => new { x.AccountId, x.ClientKey }).IsUnique();
        e.HasIndex(x => new { x.AccountId, x.Position });
    }
}
