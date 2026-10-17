using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Features.Auth;

namespace MinglDingl.Engine.Features.Push;

/// One Expo push token per signed-in device. Goes with the device session.
public sealed class PushToken
{
    public Guid DeviceSessionId { get; set; }
    public Guid AccountId { get; set; }
    public string Token { get; set; } = "";
    public DateTimeOffset UpdatedAt { get; set; }
}

internal sealed class PushTokenMap : IEntityTypeConfiguration<PushToken>
{
    public void Configure(EntityTypeBuilder<PushToken> e)
    {
        e.ToTable("push_tokens");
        e.HasKey(x => x.DeviceSessionId);
        e.Property(x => x.Token).HasMaxLength(Kernel.Validation.FieldLimits.PushToken);
        e.HasOne<DeviceSession>().WithOne().HasForeignKey<PushToken>(x => x.DeviceSessionId).OnDelete(DeleteBehavior.Cascade);
        e.HasIndex(x => x.AccountId);
        // A device that changes hands keeps its token; only its newest session may hold it.
        e.HasIndex(x => x.Token).IsUnique();
    }
}
