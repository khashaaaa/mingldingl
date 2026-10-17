using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Features.Auth;

namespace MinglDingl.Engine.Features.Score;

/// A missed dawn a member's ger rest kept: the streak went on as if they had come.
public sealed class GerRest
{
    public Guid AccountId { get; set; }
    public DateOnly Day { get; set; }
}

internal sealed class GerRestMap : IEntityTypeConfiguration<GerRest>
{
    public void Configure(EntityTypeBuilder<GerRest> e)
    {
        e.ToTable("ger_rests");
        e.HasKey(x => new { x.AccountId, x.Day });
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
    }
}

/// left: ger rests still to spend this moon (0 on the Yard). keptOn: the last missed dawn one kept.
public sealed record GerRestView(int Left, int PerMoon, DateOnly? KeptOn);
