using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Features.Profile;
using MinglDingl.Engine.Features.Safety;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Admin;

public sealed class AdminUsers(AppDb db, ProfileService profiles, PhotoService photos, BondService bonds, ScoreService score, SafetyService safety,
    Encounters.MeetingService meetings)
{
    /// Newest first, keyset-paged on (CreatedAt, Id) so a sign-up arriving mid-scroll never shifts a page.
    public async Task<AdminUserPage> ListAsync(string? search, string? cursor, int limit, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 100);
        var q = from a in db.Set<Account>().AsNoTracking()
                join p in db.Set<Profile.Profile>().AsNoTracking() on a.Id equals p.AccountId into ps
                from p in ps.DefaultIfEmpty()
                select new { a, Name = p == null ? null : p.Name, Tier = p == null ? null : p.Tier,
                    Points = p == null ? (int?)null : p.Points, Reputation = p == null ? (int?)null : p.Reputation };

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = Guid.TryParse(s, out var byId)
                ? q.Where(x => x.a.Id == byId)
                : q.Where(x => x.a.Phone.StartsWith(s) || (x.Name != null && EF.Functions.ILike(x.Name, "%" + s + "%")));
        }
        if (Decode(cursor) is var (at, id) && id != Guid.Empty)
            q = q.Where(x => x.a.CreatedAt < at || (x.a.CreatedAt == at && x.a.Id.CompareTo(id) < 0));

        var rows = await q.OrderByDescending(x => x.a.CreatedAt).ThenByDescending(x => x.a.Id)
            .Take(limit + 1)
            .Select(x => new AdminUserRow(x.a.Id, x.a.Phone, x.Name, x.a.Status.ToString(),
                db.Set<Photo>().Count(ph => ph.AccountId == x.a.Id), x.a.CreatedAt, x.Tier, x.Points, x.Reputation))
            .ToListAsync(ct);

        var next = rows.Count > limit ? Encode(rows[limit - 1]) : null;
        return new AdminUserPage(rows.Take(limit).ToList(), next);
    }

    public async Task<AdminUserDetail> DetailAsync(Guid accountId, CancellationToken ct = default)
    {
        var a = await db.Set<Account>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == accountId, ct)
            ?? throw new DomainException(404, "admin.user_not_found", "No such user");
        var me = await profiles.MeAsync(accountId, ct);
        var devices = await db.Set<DeviceSession>().AsNoTracking().Where(d => d.AccountId == accountId)
            .OrderByDescending(d => d.LastSeenAt)
            .Select(d => new AdminDevice(d.Id, d.DeviceName, d.CreatedAt, d.LastSeenAt, d.RevokedAt))
            .ToListAsync(ct);
        // Reputation is never shown to the person; the keepers see it beside points and tier.
        var reputation = await db.Set<Profile.Profile>().AsNoTracking().Where(p => p.AccountId == accountId)
            .Select(p => (int?)p.Reputation).SingleOrDefaultAsync(ct);
        var deeds = await score.DeedsAsync(accountId, null, 30, ct);
        return new AdminUserDetail(a.Id, a.Phone, a.Status.ToString(), a.CreatedAt, me.OnboardingStep, me.Profile,
            await photos.ListAsync(accountId, ct), devices, reputation,
            await safety.ReportsAgainstAsync(accountId, ct), await bonds.AdminListAsync(accountId, ct), deeds.Items,
            await meetings.AdminStatsAsync(accountId, ct));
    }

    private static string Encode(AdminUserRow r) =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes($"{r.CreatedAt.UtcTicks}|{r.AccountId}"));

    private static (DateTimeOffset At, Guid Id) Decode(string? cursor)
    {
        if (string.IsNullOrEmpty(cursor)) return default;
        try
        {
            var parts = Encoding.UTF8.GetString(Convert.FromBase64String(cursor)).Split('|');
            return (new DateTimeOffset(long.Parse(parts[0], CultureInfo.InvariantCulture), TimeSpan.Zero), Guid.Parse(parts[1]));
        }
        catch (Exception e) when (e is FormatException or IndexOutOfRangeException or ArgumentException)
        {
            throw new DomainException(400, "admin.bad_cursor", "Bad cursor");
        }
    }
}
