using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Features.Bonds;

namespace MinglDingl.Engine.Features.Video;

/// One attempt at the Flame Rite: an Agora channel and who is in it. Nothing of the call itself is
/// stored — only when each side was in, and how long they were in together.
public sealed class Call
{
    public Guid Id { get; set; }
    public Guid BondId { get; set; }
    public string Channel { get; set; } = "";
    public DateTimeOffset IssuedAt { get; set; }
    /// When each side last joined (null while out).
    public DateTimeOffset? AIn { get; set; }
    public DateTimeOffset? BIn { get; set; }
    /// When both were first in together: the five minutes run from here.
    public DateTimeOffset? BothAt { get; set; }
    public int TogetherSeconds { get; set; }
    public DateTimeOffset? EndedAt { get; set; }
    public bool Completed { get; set; }
}

internal sealed class CallMap : IEntityTypeConfiguration<Call>
{
    public void Configure(EntityTypeBuilder<Call> e)
    {
        e.ToTable("calls");
        e.Property(x => x.Channel).HasMaxLength(64);
        e.HasOne<Bond>().WithMany().HasForeignKey(x => x.BondId).OnDelete(DeleteBehavior.Cascade);
        e.HasIndex(x => x.Channel).IsUnique();
        e.HasIndex(x => new { x.BondId, x.IssuedAt });
    }
}
