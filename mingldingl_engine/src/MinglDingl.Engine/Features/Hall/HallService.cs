using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Profile;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Hall;

/// One carved row: names are hidden by the rules of the house; only the gem and points show.
public sealed record HallRow(int Rank, string Tier, int Points);

/// cohort: Ulaanbaatar or the aimag; you: your torch (null while you are not listed — paused,
/// departing or retired); retiredPairs: pairs who retired together from this cohort.
public sealed record HallView(string Cohort, IReadOnlyList<HallRow> Top, HallRow? You, int RetiredPairs);

/// The Hall of Names: the top of your cohort by points. The top rows are cached a minute per
/// cohort (they are the same for everyone there); your own rank is read fresh.
public sealed class HallService(AppDb db, IMemoryCache cache)
{
    private const int TopCount = 5;

    public async Task<HallView> GetAsync(Guid me, CancellationToken ct = default)
    {
        var p = await db.Set<Profile.Profile>().AsNoTracking().SingleOrDefaultAsync(x => x.AccountId == me, ct)
            ?? throw new DomainException(409, "profile.missing", "Create your character first");
        var cohort = MongoliaGeo.All.FirstOrDefault(c => c.Name == p.City)?.Region ?? MongoliaGeo.Capital;
        var cities = MongoliaGeo.All.Where(c => c.Region == cohort).Select(c => c.Name).ToList();

        var top = await cache.GetOrCreateAsync("hall:" + cohort, async e =>
        {
            e.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1);
            var rows = await Listed(cities).OrderByDescending(x => x.Points).ThenBy(x => x.AccountId).Take(TopCount)
                .Select(x => new { x.Tier, x.Points }).ToListAsync(ct);
            return rows.Select((r, i) => new HallRow(i + 1, r.Tier, r.Points)).ToList();
        }) ?? [];

        HallRow? you = null;
        if (await Listed(cities).AnyAsync(x => x.AccountId == me, ct))
        {
            // Equal points share a rank.
            var above = await Listed(cities).CountAsync(x => x.Points > p.Points, ct);
            you = new HallRow(above + 1, p.Tier, p.Points);
        }
        var retired = await db.Set<Bonds.Bond>().AsNoTracking().CountAsync(b => b.State == Bonds.BondState.Retired
            && db.Set<Profile.Profile>().Any(x => x.AccountId == b.AId && x.City != null && cities.Contains(x.City)), ct);
        return new HallView(cohort, top, you, retired);
    }

    /// Who the Hall lists: finished, active, not paused, not retired, not leaving.
    private IQueryable<Profile.Profile> Listed(List<string> cities) =>
        db.Set<Profile.Profile>().AsNoTracking().Where(x => x.WelcomedAt != null && x.PausedAt == null && x.RetiredAt == null
            && x.City != null && cities.Contains(x.City)
            && db.Set<Account>().Any(a => a.Id == x.AccountId && a.Status == AccountStatus.Active && a.DeleteAt == null));
}
