using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Features.Auth;

namespace MinglDingl.Engine.Features.Membership;

/// The Guild House floors, lowest first (the order is the comparison).
public enum Floor { Yard, Hall, HighTable }

/// Where a stretch of membership came from: the store (Google Play through RevenueCat) or QPay on the web.
public enum GrantSource { Store, QPay }

/// One stretch of a floor: from, until, and what paid for it. A person's floor at any moment is the
/// highest floor among the stretches that cover it. Store stretches mirror RevenueCat; a QPay stretch
/// is one credited payment.
public sealed class MembershipGrant
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public Floor Floor { get; set; }
    public GrantSource Source { get; set; }
    /// Store: the entitlement's product id. QPay: the payment's id.
    public string Ref { get; set; } = "";
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }
    /// Store only: the subscription will renew on its own.
    public bool Renews { get; set; }
    /// A refunded stretch ends at once.
    public DateTimeOffset? RevokedAt { get; set; }
    /// When "your floor ends in three days" was sent for this stretch.
    public DateTimeOffset? EndingNoticeAt { get; set; }
}

internal sealed class MembershipGrantMap : IEntityTypeConfiguration<MembershipGrant>
{
    public void Configure(EntityTypeBuilder<MembershipGrant> e)
    {
        e.ToTable("membership_grants");
        e.Property(x => x.Floor).HasConversion<string>().HasMaxLength(10);
        e.Property(x => x.Source).HasConversion<string>().HasMaxLength(6);
        e.Property(x => x.Ref).HasMaxLength(100);
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
        e.HasIndex(x => new { x.AccountId, x.EndsAt });
        e.HasIndex(x => new { x.Source, x.Ref });
    }
}

/// floor: yard / hall / highTable. until: when the current floor ends (null on the Yard).
/// source: store / qpay. renews: a store subscription that will renew.
public sealed record MembershipView(string Floor, DateTimeOffset? Until, string? Source, bool Renews, bool Open);

/// One choice on the Guild House: a floor for 1, 3 or 6 moons and its price in tögrög.
public sealed record FloorOffer(string Floor, int Months, int Amount, int DiscountPercent);

/// What a floor gives. Reach and depth only: never score, tier, reputation or forgiveness.
public sealed record FloorPerks(int CandlesBase, int CandlesCap, int SeatsBonus, int GerRests, bool Paid);

public static class Floors
{
    public static string Key(Floor f) => f switch { Floor.Hall => "hall", Floor.HighTable => "highTable", _ => "yard" };

    public static Floor? Parse(string? key) => key switch { "hall" => Floor.Hall, "highTable" => Floor.HighTable, _ => null };
}
