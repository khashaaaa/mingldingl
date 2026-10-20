using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Kernel.Push;

namespace MinglDingl.Engine.Features.Membership;

/// A store entitlement as RevenueCat reports it.
public sealed record StoreEntitlement(Floor Floor, string ProductId, DateTimeOffset PurchasedAt, DateTimeOffset ExpiresAt,
    bool WillRenew, bool Refunded);

/// Which floor a person stands on, and every change to it. Other features ask here; none reads
/// payments. Paying never buys score, tier, reputation or forgiveness — only what the floors list.
public sealed class MembershipService(AppDb db, IClock clock, IConfig config, ILiveOutbox live, IPushOutbox push)
{
    public static readonly int[] Cycles = [1, 3, 6];

    public async Task<Floor> FloorAsync(Guid accountId, CancellationToken ct = default)
    {
        var now = clock.UtcNow;
        var floors = await Current(accountId, now).Select(g => g.Floor).ToListAsync(ct);
        return floors.Count == 0 ? Floor.Yard : floors.Max();
    }

    public async Task<MembershipView> ViewAsync(Guid accountId, CancellationToken ct = default)
    {
        var now = clock.UtcNow;
        var open = config.Bool(ConfigKeys.MembershipEnabled);
        var grants = await db.Set<MembershipGrant>().AsNoTracking()
            .Where(g => g.AccountId == accountId && g.RevokedAt == null && g.EndsAt > now).ToListAsync(ct);
        var current = grants.Where(g => g.StartsAt <= now).OrderByDescending(g => g.Floor).ThenByDescending(g => g.EndsAt).FirstOrDefault();
        if (current is null) return new MembershipView(Floors.Key(Floor.Yard), null, null, false, open);
        // The floor holds until the last stretch of it (or higher) that follows on without a gap.
        var until = current.EndsAt;
        foreach (var g in grants.Where(g => g.Floor >= current.Floor).OrderBy(g => g.StartsAt))
            if (g.StartsAt <= until && g.EndsAt > until) until = g.EndsAt;
        return new MembershipView(Floors.Key(current.Floor), until, current.Source switch { GrantSource.Store => "store", GrantSource.Keeper => "keeper", _ => "qpay" },
            current.Source == GrantSource.Store && current.Renews, open);
    }

    public FloorPerks Perks(Floor floor) => floor switch
    {
        Floor.HighTable => new(config.Int(ConfigKeys.CandlesBaseHighTable), config.Int(ConfigKeys.CandlesCapHighTable),
            config.Int(ConfigKeys.SeatsHighTableBonus), config.Int(ConfigKeys.GerRestsHighTable), true),
        Floor.Hall => new(config.Int(ConfigKeys.CandlesBaseHall), config.Int(ConfigKeys.CandlesCapHall),
            config.Int(ConfigKeys.SeatsHallBonus), config.Int(ConfigKeys.GerRestsHall), true),
        _ => new(config.Int(ConfigKeys.CandlesBase), config.Int(ConfigKeys.CandlesCap), 0, 0, false),
    };

    public async Task<FloorPerks> PerksAsync(Guid accountId, CancellationToken ct = default) => Perks(await FloorAsync(accountId, ct));

    public IReadOnlyList<FloorOffer> Offers() =>
        [.. new[] { Floor.Hall, Floor.HighTable }.SelectMany(f => Cycles.Select(m => new FloorOffer(Floors.Key(f), m, Price(f, m), Discount(m))))];

    public int Price(Floor floor, int months)
    {
        var monthly = config.Int(floor == Floor.HighTable ? ConfigKeys.PriceHighTable : ConfigKeys.PriceHall);
        return (int)Math.Round(monthly * months * (100 - Discount(months)) / 100.0);
    }

    private int Discount(int months) => months switch
    {
        3 => config.Int(ConfigKeys.Discount3),
        6 => config.Int(ConfigKeys.Discount6),
        _ => 0,
    };

    /// A credited QPay payment. Bought while an equal or higher floor runs, it starts when that ends,
    /// so nothing paid is lost; a higher floor starts now. Runs inside the caller's transaction.
    public async Task<MembershipGrant> CreditQPayAsync(Guid accountId, Floor floor, int months, Guid paymentId, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var queuedBehind = await db.Set<MembershipGrant>()
            .Where(g => g.AccountId == accountId && g.RevokedAt == null && g.EndsAt > now && g.Floor >= floor)
            .MaxAsync(g => (DateTimeOffset?)g.EndsAt, ct);
        var start = queuedBehind ?? now;
        var grant = new MembershipGrant
        {
            Id = Guid.CreateVersion7(), AccountId = accountId, Floor = floor, Source = GrantSource.QPay,
            Ref = paymentId.ToString(), StartsAt = start, EndsAt = start.AddMonths(months),
        };
        db.Add(grant);
        Changed(accountId);
        return grant;
    }

    /// A refunded QPay payment: its stretch ends now.
    public async Task RevokeQPayAsync(Guid paymentId, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var key = paymentId.ToString();
        var g = await db.Set<MembershipGrant>().SingleOrDefaultAsync(x => x.Source == GrantSource.QPay && x.Ref == key, ct);
        if (g is null || g.RevokedAt is not null) return;
        g.RevokedAt = now;
        if (g.EndsAt > now) g.EndsAt = now < g.StartsAt ? g.StartsAt : now;
        Changed(g.AccountId);
    }

    /// RevenueCat's word is the store's truth: the account's store stretches become exactly what it
    /// reports (a refunded one ends when it was refunded, which RevenueCat reports as its expiry).
    public async Task ReplaceStoreAsync(Guid accountId, IReadOnlyList<StoreEntitlement> entitlements, CancellationToken ct)
    {
        var old = await db.Set<MembershipGrant>().Where(g => g.AccountId == accountId && g.Source == GrantSource.Store).ToListAsync(ct);
        var now = clock.UtcNow;
        var changed = old.Count != entitlements.Count;
        foreach (var e in entitlements)
        {
            var g = old.FirstOrDefault(x => x.Ref == e.ProductId);
            if (g is null)
            {
                g = new MembershipGrant { Id = Guid.CreateVersion7(), AccountId = accountId, Source = GrantSource.Store, Ref = e.ProductId };
                db.Add(g);
                changed = true;
            }
            else old.Remove(g);
            if (g.Floor != e.Floor || g.StartsAt != e.PurchasedAt || g.EndsAt != e.ExpiresAt || g.Renews != e.WillRenew
                || (g.RevokedAt is null) == e.Refunded) changed = true;
            g.Floor = e.Floor;
            g.StartsAt = e.PurchasedAt;
            if (g.EndsAt != e.ExpiresAt) g.EndingNoticeAt = null;
            g.EndsAt = e.ExpiresAt;
            g.Renews = e.WillRenew && !e.Refunded;
            g.RevokedAt = e.Refunded ? g.RevokedAt ?? now : null;
        }
        db.RemoveRange(old);
        if (changed) Changed(accountId);
    }

    /// "Your floor ends soon": once per stretch that will not renew and that nothing follows.
    public async Task<int> SendEndingNoticesAsync(CancellationToken ct = default)
    {
        var now = clock.UtcNow;
        var horizon = now.AddDays(config.Int(ConfigKeys.EndingNoticeDays));
        var ending = await db.Set<MembershipGrant>()
            .Where(g => g.RevokedAt == null && !g.Renews && g.EndingNoticeAt == null && g.StartsAt <= now && g.EndsAt > now && g.EndsAt <= horizon)
            .ToListAsync(ct);
        var sent = 0;
        foreach (var g in ending)
        {
            var followed = await db.Set<MembershipGrant>().AnyAsync(x => x.AccountId == g.AccountId && x.Id != g.Id
                && x.RevokedAt == null && x.Floor >= g.Floor && x.StartsAt <= g.EndsAt && x.EndsAt > g.EndsAt, ct);
            g.EndingNoticeAt = now;
            if (followed) continue;
            var day = UbDays.DayOf(g.EndsAt);
            push.Send(g.AccountId, PushKinds.FloorEnding, null, g.Floor == Floor.HighTable ? "The High Table" : "The Hall",
                day.ToString("d MMMM", System.Globalization.CultureInfo.InvariantCulture));
            sent++;
        }
        await db.SaveChangesAsync(ct);
        return sent;
    }

    private IQueryable<MembershipGrant> Current(Guid accountId, DateTimeOffset now) =>
        db.Set<MembershipGrant>().AsNoTracking()
            .Where(g => g.AccountId == accountId && g.RevokedAt == null && g.StartsAt <= now && g.EndsAt > now);

    private void Changed(Guid accountId)
    {
        live.ToAccount(accountId, LiveKinds.MembershipUpdated, accountId);
        live.ToAdmins(LiveKinds.UserUpdated, accountId);
    }
}
