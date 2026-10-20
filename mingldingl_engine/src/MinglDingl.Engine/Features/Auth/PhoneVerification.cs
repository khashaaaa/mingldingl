using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MinglDingl.Engine.Features.Auth;

public enum VerificationState { Pending, Verified, Expired, Superseded }

public sealed class PhoneVerification
{
    public Guid Id { get; set; }
    public string Phone { get; set; } = "";
    /// WeSend's verification id; the code itself lives only at WeSend (hashed).
    public string ProviderId { get; set; } = "";
    public VerificationState State { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? VerifiedAt { get; set; }
    public DateTimeOffset? ClaimedAt { get; set; }
    public Guid? ClaimedByAccountId { get; set; }
}

internal sealed class PhoneVerificationMap : IEntityTypeConfiguration<PhoneVerification>
{
    public void Configure(EntityTypeBuilder<PhoneVerification> e)
    {
        e.ToTable("phone_verifications");
        e.Property(x => x.Phone).HasMaxLength(8);
        e.Property(x => x.ProviderId).HasMaxLength(100);
        e.Property(x => x.State).HasConversion<string>().HasMaxLength(12);
        e.HasIndex(x => new { x.Phone, x.State });
    }
}
