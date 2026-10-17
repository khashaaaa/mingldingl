using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MinglDingl.Engine.Features.Auth;

public enum AccountStatus { Active, Suspended, Deleted }

/// A proven phone number. The character (profile) hangs off it once created.
public sealed class Account
{
    public Guid Id { get; set; }
    public string Phone { get; set; } = "";
    public AccountStatus Status { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    /// Abandoned: the day the sweep burns it. Signing in, or "Keep my character", clears it.
    public DateTimeOffset? DeleteAt { get; set; }
    /// This person's call to allies (MNKH-4821), made the first time they open Allies.
    public string? AllyCode { get; set; }
    /// Whose call brought them through the Gate (an ally code at sign-up).
    public Guid? CalledBy { get; set; }
}

/// One signed-in device. Revoking it ends every token it holds.
public sealed class DeviceSession
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public string DeviceName { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset LastSeenAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
}

/// A refresh token, stored only as its SHA-256. Used once; the 30 s grace keeps the pair it was
/// rotated into (encrypted) so a duplicate refresh in a race gets the same answer.
public sealed class RefreshToken
{
    public Guid Id { get; set; }
    public Guid DeviceSessionId { get; set; }
    public DeviceSession Device { get; set; } = null!;
    public string Hash { get; set; } = "";
    public DateTimeOffset IssuedAt { get; set; }
    public DateTimeOffset? UsedAt { get; set; }
    public DateTimeOffset? GraceUntil { get; set; }
    public string? GracePayload { get; set; }
}

internal sealed class AccountMap : IEntityTypeConfiguration<Account>
{
    public void Configure(EntityTypeBuilder<Account> e)
    {
        e.ToTable("accounts");
        e.Property(x => x.Phone).HasMaxLength(8);
        e.HasIndex(x => x.Phone).IsUnique();
        e.HasIndex(x => x.DeleteAt).HasFilter("\"DeleteAt\" IS NOT NULL");
        e.Property(x => x.AllyCode).HasMaxLength(9);
        e.HasIndex(x => x.AllyCode).IsUnique();
        e.Property(x => x.Status).HasConversion<string>().HasMaxLength(12);
    }
}

internal sealed class DeviceSessionMap : IEntityTypeConfiguration<DeviceSession>
{
    public void Configure(EntityTypeBuilder<DeviceSession> e)
    {
        e.ToTable("device_sessions");
        e.Property(x => x.DeviceName).HasMaxLength(80);
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
        e.HasIndex(x => x.AccountId);
    }
}

internal sealed class RefreshTokenMap : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> e)
    {
        e.ToTable("refresh_tokens");
        e.Property(x => x.Hash).HasMaxLength(64);
        e.HasIndex(x => x.Hash).IsUnique();
        e.HasOne(x => x.Device).WithMany().HasForeignKey(x => x.DeviceSessionId).OnDelete(DeleteBehavior.Cascade);
    }
}
