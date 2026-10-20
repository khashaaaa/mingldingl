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
    /// While suspended: when, and the keepers' reason (or that a report cast them out).
    public DateTimeOffset? SuspendedAt { get; set; }
    public string? SuspendedWhy { get; set; }
    /// This person's call to allies (MNKH-4821), made the first time they open Allies.
    public string? AllyCode { get; set; }
    /// Whose call brought them through the Gate (an ally code at sign-up).
    public Guid? CalledBy { get; set; }
    /// Set when they sign in on a device a removed or suspended character used; a keeper clears it.
    public DateTimeOffset? FlaggedAt { get; set; }
    public string? FlaggedWhy { get; set; }
}

/// One signed-in device. Revoking it ends every token it holds.
public sealed class DeviceSession
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public string DeviceName { get; set; } = "";
    /// SHA-256 of the app's install id (Android ID / iOS vendor id), if the app sent one.
    public string? DeviceKey { get; set; }
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
        e.Property(x => x.SuspendedWhy).HasMaxLength(Kernel.Validation.FieldLimits.KeeperReason);
        e.Property(x => x.FlaggedWhy).HasMaxLength(Kernel.Validation.FieldLimits.KeeperReason);
        e.HasIndex(x => x.FlaggedAt).HasFilter("\"FlaggedAt\" IS NOT NULL");
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
        e.Property(x => x.DeviceKey).HasMaxLength(64);
        e.HasIndex(x => x.DeviceKey).HasFilter("\"DeviceKey\" IS NOT NULL");
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
