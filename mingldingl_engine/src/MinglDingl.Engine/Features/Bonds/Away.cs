using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Profile;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Auth;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Bonds;

/// days: 1 to away.maxDays.
public sealed record AwayRequest([Range(1, 30)] int Days);

/// Away by the fire (Figma 259:2042, 259:2231): for a few days a person's bonds wait. No embers or cold
/// fall on their turn, and the silence counts again only from their return; they are out of Seek and
/// of others' threads. Once in away.everyDays. A letter or a summons brings them back early.
public sealed class AwayService(AppDb db, IClock clock, IConfig config, ILiveOutbox live)
{
    public async Task GoAsync(Guid me, int days, CancellationToken ct = default)
    {
        if (days < 1 || days > config.Int(ConfigKeys.AwayMaxDays))
            throw new DomainException(400, "away.days", "Choose how long you will be away");
        var p = await db.Set<Profile.Profile>().SingleOrDefaultAsync(x => x.AccountId == me, ct)
            ?? throw new DomainException(409, "profile.missing", "Create your character first");
        var now = clock.UtcNow;
        if (p.AwayUntil > now) throw new DomainException(409, "away.already", "You are already away by the fire");
        if (NextAt(p, now) is not null)
            throw new DomainException(409, "away.too_soon", "You can go away by the fire once in thirty days");
        (p.AwayFrom, p.AwayUntil) = (now, now.AddDays(days));
        await TellAsync(me, ct);
        await db.SaveChangesAsync(ct);
    }

    /// Back by the fire, if away (a letter, a summons, or "Come back now"). Runs in the caller's
    /// transaction; the caller saves.
    public async Task<bool> EndAsync(Guid me, CancellationToken ct = default)
    {
        var now = clock.UtcNow;
        var p = await db.Set<Profile.Profile>().SingleOrDefaultAsync(x => x.AccountId == me && x.AwayUntil > now, ct);
        if (p is null) return false;
        p.AwayUntil = now;
        await TellAsync(me, ct);
        return true;
    }

    /// When they may go away again, or null when they may now.
    public DateTimeOffset? NextAt(Profile.Profile p, DateTimeOffset now) =>
        p.AwayFrom?.AddDays(config.Int(ConfigKeys.AwayEveryDays)) is { } next && next > now ? next : null;

    /// Their devices, and everyone at their fire (the header reads "Away until …").
    private async Task TellAsync(Guid me, CancellationToken ct)
    {
        live.ToAccount(me, LiveKinds.ProfileUpdated, me);
        var bonds = await db.Set<Bond>().AsNoTracking().Where(b => (b.AId == me || b.BId == me) && b.State == BondState.Live)
            .Select(b => new { b.Id, Other = b.AId == me ? b.BId : b.AId }).ToListAsync(ct);
        foreach (var b in bonds)
        {
            live.ToAccount(me, LiveKinds.BondUpdated, b.Id);
            live.ToAccount(b.Other, LiveKinds.BondUpdated, b.Id);
        }
    }
}

public sealed class AwayEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/me/away").WithTags("Profile");
        g.MapPost("", async (AwayRequest req, ClaimsPrincipal u, AwayService away, ProfileService profiles, CancellationToken ct) =>
        {
            await away.GoAsync(u.AccountId(), req.Days, ct);
            return await profiles.MeAsync(u.AccountId(), ct);
        }).AsWrite().WithName("GoAway");
        g.MapDelete("", async (ClaimsPrincipal u, AwayService away, AppDb db, ProfileService profiles, CancellationToken ct) =>
        {
            if (await away.EndAsync(u.AccountId(), ct)) await db.SaveChangesAsync(ct);
            return await profiles.MeAsync(u.AccountId(), ct);
        }).AsWrite().WithName("ComeBack");
    }
}
