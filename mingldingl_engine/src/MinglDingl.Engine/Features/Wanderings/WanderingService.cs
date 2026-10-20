using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Venues;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Kernel.Push;
using MinglDingl.Engine.Kernel.Validation;

namespace MinglDingl.Engine.Features.Wanderings;

/// state: sealed (its road is not open yet) | open | asked (you asked; they have not answered) |
/// askedOfMe | going (agreed; lines to write) | kept (both lines written).
public sealed record WanderingRowView(string Key, string Title, string Line, string Road, string Season, string State);

/// keptMeetings: this bond's kept meetings (one opens the first roads, two the trusted ones).
/// taken: Wanderings this bond kept. fellow: Wanderings you kept with anyone, toward Fellow Traveller (at three).
public sealed record WanderingsView(int KeptMeetings, bool FirstOpen, bool TrustedOpen, int Taken, int Fellow,
    IReadOnlyList<WanderingRowView> Items);

/// myLine / theirLine: theirs only once both are written. venues: verified places of the kinds that suit it.
public sealed record WanderingView(string Key, string Title, string Line, string Body, string Where, string Road, string Season,
    string State, IReadOnlyList<VenueView> Venues, string? MyLine, bool TheirLineWritten, string? TheirLine, int Fellow);

public sealed record WanderingLineRequest([Required, StringLength(FieldLimits.WanderingLine)] string Text);

/// The keepers' view and edit of one Wandering.
public sealed record AdminWanderingRow(string Key, int Position, string Road, string Season, string TitleEn, string TitleMn,
    IReadOnlyList<string> VenueKinds, int Kept, DateTimeOffset UpdatedAt);

public sealed record AdminWandering(string Key, int Position, string Road, string Season, IReadOnlyList<string> VenueKinds,
    string TitleEn, string LineEn, string BodyEn, string WhereEn, string TitleMn, string LineMn, string BodyMn, string WhereMn);

public sealed record WanderingWriteRequest(
    [Required, StringLength(FieldLimits.CodexTitle)] string TitleEn,
    [Required, StringLength(FieldLimits.CodexSummary)] string LineEn,
    [Required, StringLength(FieldLimits.WanderingText)] string BodyEn,
    [Required, StringLength(FieldLimits.WanderingText)] string WhereEn,
    [Required, StringLength(FieldLimits.CodexTitle)] string TitleMn,
    [Required, StringLength(FieldLimits.CodexSummary)] string LineMn,
    [Required, StringLength(FieldLimits.WanderingText)] string BodyMn,
    [Required, StringLength(FieldLimits.WanderingText)] string WhereMn,
    [Required] IReadOnlyList<string> VenueKinds);

public sealed class WanderingService(AppDb db, IClock clock, ILiveOutbox live, IPushOutbox push, VenueService venues,
    Encounters.MeetingService meetings, Campaign.CampaignService campaign, Honours.HonourService honours)
{
    public async Task<WanderingsView> ListAsync(Guid me, Guid bondId, CancellationToken ct = default)
    {
        var b = await BondAsync(me, bondId, ct);
        var (kept, en) = (await meetings.KeptCountAsync(b.Id, ct), await EnglishAsync(me, ct));
        var all = await db.Set<Wandering>().AsNoTracking().OrderBy(w => w.Position).ToListAsync(ct);
        var taken = await TakenAsync(b.Id, ct);
        return new WanderingsView(kept, kept >= 1, kept >= 2, taken.Count(t => t.KeptAt is not null), await FellowAsync(me, ct),
            [.. all.Select(w => new WanderingRowView(w.Key, en ? w.TitleEn : w.TitleMn, en ? w.LineEn : w.LineMn, w.Road, w.Season,
                StateOf(w, kept, taken.FirstOrDefault(t => t.Key == w.Key), me)))]);
    }

    public async Task<WanderingView> GetAsync(Guid me, Guid bondId, string key, CancellationToken ct = default)
    {
        var b = await BondAsync(me, bondId, ct);
        var w = await db.Set<Wandering>().AsNoTracking().SingleOrDefaultAsync(x => x.Key == key, ct)
            ?? throw new DomainException(404, "wandering.not_found", "No such Wandering");
        var (kept, en) = (await meetings.KeptCountAsync(b.Id, ct), await EnglishAsync(me, ct));
        var t = (await TakenAsync(b.Id, ct)).FirstOrDefault(x => x.Key == key);
        var places = w.VenueKinds.Length == 0 ? [] : (await venues.ListForAsync(me, b.Id, ct)).Where(v => w.VenueKinds.Contains(v.Kind)).Take(3).ToList();
        var (mine, theirs) = b.AId == me ? (t?.LineA, t?.LineB) : (t?.LineB, t?.LineA);
        return new WanderingView(w.Key, en ? w.TitleEn : w.TitleMn, en ? w.LineEn : w.LineMn, en ? w.BodyEn : w.BodyMn,
            en ? w.WhereEn : w.WhereMn, w.Road, w.Season, StateOf(w, kept, t, me), places, mine, theirs is not null,
            t?.KeptAt is not null ? theirs : null, await FellowAsync(me, ct));
    }

    /// One asks; the other answers. One ask waits at a time in a bond.
    public async Task<WanderingView> AskAsync(Guid me, Guid bondId, string key, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var b = await campaign.LockLiveAsync(me, bondId, ct);
        var w = await db.Set<Wandering>().AsNoTracking().SingleOrDefaultAsync(x => x.Key == key, ct)
            ?? throw new DomainException(404, "wandering.not_found", "No such Wandering");
        var kept = await meetings.KeptCountAsync(b.Id, ct);
        if (kept < (w.Road == WanderingRoads.Trusted ? 2 : 1))
            throw new DomainException(409, "wandering.sealed", "This road opens after a kept meeting");
        var taken = await TakenAsync(b.Id, ct);
        if (taken.Any(t => t.Key == key)) throw new DomainException(409, "wandering.taken", "You have taken this road already");
        if (taken.Any(t => t.AgreedAt is null)) throw new DomainException(409, "wandering.waiting", "One Wandering waits for an answer already");
        db.Add(new WanderingTaken { Id = Guid.CreateVersion7(), BondId = b.Id, Key = key, AskedBy = me, AskedAt = clock.UtcNow });
        Tell(b);
        var name = await db.Set<Profile.Profile>().Where(p => p.AccountId == me).Select(p => p.Name).SingleAsync(ct);
        push.Send(b.Other(me), PushKinds.WanderingAsked, b.Id, name);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await GetAsync(me, bondId, key, ct);
    }

    public async Task<WanderingView> AnswerAsync(Guid me, Guid bondId, string key, bool yes, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var b = await campaign.LockLiveAsync(me, bondId, ct);
        var t = await db.Set<WanderingTaken>().SingleOrDefaultAsync(x => x.BondId == b.Id && x.Key == key && x.DeclinedAt == null, ct);
        if (t is null || t.AgreedAt is not null || t.AskedBy == me)
            throw new DomainException(409, "wandering.no_ask", "There is nothing to answer");
        if (yes) t.AgreedAt = clock.UtcNow; else t.DeclinedAt = clock.UtcNow;
        Tell(b);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await GetAsync(me, bondId, key, ct);
    }

    /// "What will you remember?" Each line is sealed until both are written; then the Wandering is kept.
    public async Task<WanderingView> LineAsync(Guid me, Guid bondId, string key, string text, CancellationToken ct = default)
    {
        text = text.Trim();
        if (text.Length == 0) throw new DomainException(400, "wandering.line_empty", "Write your line first");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var b = await campaign.LockLiveAsync(me, bondId, ct);
        var t = await db.Set<WanderingTaken>().SingleOrDefaultAsync(x => x.BondId == b.Id && x.Key == key && x.DeclinedAt == null, ct);
        if (t?.AgreedAt is null) throw new DomainException(409, "wandering.not_going", "Agree on the Wandering first");
        if ((b.AId == me ? t.LineA : t.LineB) is not null) throw new DomainException(409, "wandering.line_sealed", "Your line is already sealed");
        if (b.AId == me) t.LineA = text; else t.LineB = text;
        if (t.LineA is not null && t.LineB is not null) t.KeptAt = clock.UtcNow;
        Tell(b);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        // Fellow Traveller comes with the third kept Wandering (the honour check holds its own transaction).
        if (t.KeptAt is not null)
            foreach (var who in new[] { b.AId, b.BId }) await honours.CheckAsync(who, quietly: false, ct);
        return await GetAsync(me, bondId, key, ct);
    }

    public async Task<IReadOnlyList<AdminWanderingRow>> AdminListAsync(CancellationToken ct = default)
    {
        var kept = await db.Set<WanderingTaken>().AsNoTracking().Where(t => t.KeptAt != null).GroupBy(t => t.Key)
            .Select(g => new { g.Key, N = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.N, ct);
        return [.. (await db.Set<Wandering>().AsNoTracking().OrderBy(w => w.Position).ToListAsync(ct))
            .Select(w => new AdminWanderingRow(w.Key, w.Position, w.Road, w.Season, w.TitleEn, w.TitleMn, w.VenueKinds,
                kept.GetValueOrDefault(w.Key), w.UpdatedAt))];
    }

    public async Task<AdminWandering> AdminGetAsync(string key, CancellationToken ct = default)
    {
        var w = await db.Set<Wandering>().AsNoTracking().SingleOrDefaultAsync(x => x.Key == key, ct)
            ?? throw new DomainException(404, "wandering.not_found", "No such Wandering");
        return new AdminWandering(w.Key, w.Position, w.Road, w.Season, w.VenueKinds, w.TitleEn, w.LineEn, w.BodyEn, w.WhereEn,
            w.TitleMn, w.LineMn, w.BodyMn, w.WhereMn);
    }

    public async Task<AdminWandering> AdminSaveAsync(string key, WanderingWriteRequest req, CancellationToken ct = default)
    {
        var w = await db.Set<Wandering>().SingleOrDefaultAsync(x => x.Key == key, ct)
            ?? throw new DomainException(404, "wandering.not_found", "No such Wandering");
        if (req.VenueKinds.Any(k => !VenueKinds.All.Contains(k))) throw new DomainException(400, "venue.kind", "Choose a kind of place");
        (w.TitleEn, w.LineEn, w.BodyEn, w.WhereEn) = (req.TitleEn.Trim(), req.LineEn.Trim(), req.BodyEn.Trim(), req.WhereEn.Trim());
        (w.TitleMn, w.LineMn, w.BodyMn, w.WhereMn) = (req.TitleMn.Trim(), req.LineMn.Trim(), req.BodyMn.Trim(), req.WhereMn.Trim());
        w.VenueKinds = [.. req.VenueKinds.Distinct()];
        w.UpdatedAt = clock.UtcNow;
        live.ToAll(LiveKinds.WanderingUpdated);
        await db.SaveChangesAsync(ct);
        return await AdminGetAsync(key, ct);
    }

    private static string StateOf(Wandering w, int kept, WanderingTaken? t, Guid me) => t switch
    {
        { KeptAt: not null } => "kept",
        { AgreedAt: not null } => "going",
        { } asked => asked.AskedBy == me ? "asked" : "askedOfMe",
        null when kept < (w.Road == WanderingRoads.Trusted ? 2 : 1) => "sealed",
        _ => "open",
    };

    private void Tell(Bond b)
    {
        foreach (var who in new[] { b.AId, b.BId }) live.ToAccount(who, LiveKinds.WanderingUpdated, b.Id);
    }

    private async Task<Bond> BondAsync(Guid me, Guid bondId, CancellationToken ct)
    {
        var b = await db.Set<Bond>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == bondId, ct);
        if (b is null || !b.Has(me)) throw new DomainException(404, "bond.not_found", "That bond does not exist");
        return b;
    }

    private Task<List<WanderingTaken>> TakenAsync(Guid bondId, CancellationToken ct) =>
        db.Set<WanderingTaken>().AsNoTracking().Where(t => t.BondId == bondId && t.DeclinedAt == null).ToListAsync(ct);

    private async Task<bool> EnglishAsync(Guid me, CancellationToken ct) =>
        await db.Set<Profile.Profile>().Where(p => p.AccountId == me).Select(p => p.Locale).SingleOrDefaultAsync(ct) != "mn";

    /// Wanderings kept with anyone — Fellow Traveller comes at three.
    public Task<int> FellowAsync(Guid me, CancellationToken ct) =>
        db.Set<WanderingTaken>().CountAsync(t => t.KeptAt != null && db.Set<Bond>().Any(b => b.Id == t.BondId && (b.AId == me || b.BId == me)), ct);
}
