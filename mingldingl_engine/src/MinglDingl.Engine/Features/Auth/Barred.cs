using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MinglDingl.Engine.Features.Auth;

/// The number of a character the keepers removed (or that left with reports still open). It
/// outlives the account, so the same number cannot make a new character; a keeper can lift it.
public sealed class BarredNumber
{
    public string Phone { get; set; } = "";
    public string Why { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
}

/// A device such a character signed in on, as its key's SHA-256. It never refuses anyone (phones
/// are shared and sold): a new sign-in on it is only flagged for the keepers.
public sealed class BarredDevice
{
    public string Key { get; set; } = "";
    public string Why { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
}

public static class DeviceKeys
{
    /// The app's install id is never stored as sent.
    public static string? Hash(string? raw) =>
        string.IsNullOrWhiteSpace(raw) ? null
            : Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes("device:" + raw.Trim())));
}

internal sealed class BarredNumberMap : IEntityTypeConfiguration<BarredNumber>
{
    public void Configure(EntityTypeBuilder<BarredNumber> e)
    {
        e.ToTable("barred_numbers");
        e.HasKey(x => x.Phone);
        e.Property(x => x.Phone).HasMaxLength(8);
        e.Property(x => x.Why).HasMaxLength(Kernel.Validation.FieldLimits.KeeperReason);
    }
}

internal sealed class BarredDeviceMap : IEntityTypeConfiguration<BarredDevice>
{
    public void Configure(EntityTypeBuilder<BarredDevice> e)
    {
        e.ToTable("barred_devices");
        e.HasKey(x => x.Key);
        e.Property(x => x.Key).HasMaxLength(64);
        e.Property(x => x.Why).HasMaxLength(Kernel.Validation.FieldLimits.KeeperReason);
    }
}
