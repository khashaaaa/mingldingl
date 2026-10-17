using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Features.Auth;

namespace MinglDingl.Engine.Features.Safety;

/// Cast out: neither ever sees the other again (Seek, bonds). Letting them in removes the row,
/// but a pair never bonds twice either way.
public sealed class Block
{
    public Guid BlockerId { get; set; }
    public Guid BlockedId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public enum ReportStatus { Open, Dismissed, Penalised, CastOut }

public sealed class Report
{
    public Guid Id { get; set; }
    public Guid ReporterId { get; set; }
    public Guid TargetId { get; set; }
    public Guid? BondId { get; set; }
    public string Reason { get; set; } = "";
    public string? Note { get; set; }
    public ReportStatus Status { get; set; }
    public string? Resolution { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
}

internal sealed class BlockMap : IEntityTypeConfiguration<Block>
{
    public void Configure(EntityTypeBuilder<Block> e)
    {
        e.ToTable("blocks");
        e.HasKey(x => new { x.BlockerId, x.BlockedId });
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.BlockerId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.BlockedId).OnDelete(DeleteBehavior.Cascade);
        e.HasIndex(x => x.BlockedId);
    }
}

internal sealed class ReportMap : IEntityTypeConfiguration<Report>
{
    public void Configure(EntityTypeBuilder<Report> e)
    {
        e.ToTable("reports");
        e.Property(x => x.Reason).HasMaxLength(20);
        e.Property(x => x.Note).HasMaxLength(Kernel.Validation.FieldLimits.ReportNote);
        e.Property(x => x.Resolution).HasMaxLength(Kernel.Validation.FieldLimits.ReportNote);
        e.Property(x => x.Status).HasConversion<string>().HasMaxLength(12);
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.ReporterId).OnDelete(DeleteBehavior.Cascade);
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.TargetId).OnDelete(DeleteBehavior.Cascade);
        e.HasIndex(x => new { x.Status, x.CreatedAt });
        e.HasIndex(x => x.TargetId);
    }
}
