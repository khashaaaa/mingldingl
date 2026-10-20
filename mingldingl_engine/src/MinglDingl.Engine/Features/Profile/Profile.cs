using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Features.Auth;

namespace MinglDingl.Engine.Features.Profile;

/// The character. Fields stay null until their onboarding step fills them, which is how the
/// step is derived — the app never stores "where I was".
public sealed class Profile
{
    public Guid AccountId { get; set; }
    public string Name { get; set; } = "";
    public DateOnly BirthDate { get; set; }
    public string? Gender { get; set; }
    public string? Bio { get; set; }
    public string? City { get; set; }
    public string? Oath { get; set; }
    public DateTimeOffset? OathSwornAt { get; set; }
    /// When kept meetings proved the oath (oath.provenEncounters of them).
    public DateTimeOffset? OathProvenAt { get; set; }
    public string Locale { get; set; } = "en";
    public DateTimeOffset? WelcomedAt { get; set; }
    /// Hidden from Seek while set; bonds go on.
    public DateTimeOffset? PausedAt { get; set; }
    /// Away by the fire: from when, and until when (moved to the return when they come back early).
    public DateTimeOffset? AwayFrom { get; set; }
    public DateTimeOffset? AwayUntil { get; set; }
    /// Retired together with someone (the hall no longer lists them; Pause can bring them back to Seek).
    public DateTimeOffset? RetiredAt { get; set; }
    public int Points { get; set; }
    public string Tier { get; set; } = "Garnet";
    /// Set when the tier rises; the app shows the ceremony once and clears it.
    public string? TierUpPending { get; set; }
    /// 0–100. Never shown; it orders Seek.
    public int Reputation { get; set; } = 100;
    // The deep profile (members fill it; members read another's after the fourth seal) — except
    // HasChildren, which anyone sets, and ShowChildren, which shows it in Seek and every bond at once.
    public string? HasChildren { get; set; }
    public bool ShowChildren { get; set; }
    public string? WantsChildren { get; set; }
    public string? PartnerChildren { get; set; }
    public string? Smoking { get; set; }
    public string? Drinking { get; set; }
    public string? Faith { get; set; }
    public string? Lifestyle { get; set; }
    public int Streak { get; set; }
    public DateOnly? LastDawn { get; set; }
    public DateTimeOffset LastSeenAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

internal sealed class ProfileMap : IEntityTypeConfiguration<Profile>
{
    public void Configure(EntityTypeBuilder<Profile> e)
    {
        e.ToTable("profiles");
        e.HasKey(x => x.AccountId);
        e.HasOne<Account>().WithOne().HasForeignKey<Profile>(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
        e.Property(x => x.Name).HasMaxLength(40);
        e.Property(x => x.Gender).HasMaxLength(10);
        e.Property(x => x.Bio).HasMaxLength(Kernel.Validation.FieldLimits.Bio);
        e.Property(x => x.City).HasMaxLength(40);
        e.Property(x => x.Oath).HasMaxLength(10);
        e.Property(x => x.Locale).HasMaxLength(2);
        e.Property(x => x.Tier).HasMaxLength(12);
        e.Property(x => x.TierUpPending).HasMaxLength(12);
        e.Property(x => x.Reputation).HasDefaultValue(100);
        foreach (var deep in new[] { nameof(Profile.HasChildren), nameof(Profile.WantsChildren), nameof(Profile.PartnerChildren), nameof(Profile.Smoking), nameof(Profile.Drinking), nameof(Profile.Faith), nameof(Profile.Lifestyle) })
            e.Property(deep).HasMaxLength(16);
        e.Property(x => x.Streak).HasDefaultValue(0);
        e.Property(x => x.LastSeenAt).HasDefaultValueSql("now()");
        // Seek's filter: finished characters by gender, then place.
        e.HasIndex(x => new { x.Gender, x.City });
    }
}
