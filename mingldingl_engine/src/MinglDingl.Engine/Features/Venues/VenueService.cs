using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Features.Profile;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Kernel.Storage;

namespace MinglDingl.Engine.Features.Venues;

public sealed class VenueService(
    AppDb db, IClock clock, ILiveOutbox live, IPhotoStore store, SignedUrlCache urls, ILogger<VenueService> log)
{
    public const int MaxPhotos = 4;

    /// Verified places still on the list, nearest the pair first: either person's district, then
    /// their province (or the capital), then the rest; inside each, the best rated.
    public async Task<IReadOnlyList<VenueView>> ListForAsync(Guid me, Guid? bondId, CancellationToken ct = default)
    {
        var people = new List<Guid> { me };
        if (bondId is { } id)
        {
            var bond = await db.Set<Bond>().AsNoTracking().SingleOrDefaultAsync(b => b.Id == id, ct);
            if (bond is null || !bond.Has(me)) throw new DomainException(404, "bond.not_found", "That bond does not exist");
            people.Add(bond.Other(me));
        }
        var cities = await db.Set<Profile.Profile>().AsNoTracking().Where(p => people.Contains(p.AccountId) && p.City != null)
            .Select(p => p.City!).ToListAsync(ct);
        var regions = cities.Select(c => MongoliaGeo.All.FirstOrDefault(g => g.Name == c)?.Region ?? c).ToHashSet();

        var venues = await db.Set<Venue>().AsNoTracking().Where(v => v.Verified && v.RemovedAt == null).ToListAsync(ct);
        var ratings = await RatingsAsync(venues.Select(v => v.Id).ToList(), ct);
        var ordered = venues
            .OrderBy(v => cities.Contains(v.District) ? 0 : regions.Contains(RegionOf(v.District)) ? 1 : 2)
            .ThenByDescending(v => ratings.GetValueOrDefault(v.Id).Mean ?? 0)
            .ThenBy(v => v.Name)
            .Take(50).ToList();
        var photos = await PhotosAsync(ordered.Select(v => v.Id).ToList(), ct);
        return ordered.Select(v => View(v, ratings.GetValueOrDefault(v.Id), photos.GetValueOrDefault(v.Id) ?? [])).ToList();
    }

    public async Task<VenueView> GetAsync(Guid id, CancellationToken ct = default)
    {
        var v = await db.Set<Venue>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException(404, "venue.not_found", "That place does not exist");
        var ratings = await RatingsAsync([v.Id], ct);
        var photos = await PhotosAsync([v.Id], ct);
        return View(v, ratings.GetValueOrDefault(v.Id), photos.GetValueOrDefault(v.Id) ?? []);
    }

    /// Whether a meeting may be set here now.
    public Task<bool> OpenAsync(Guid id, CancellationToken ct = default) =>
        db.Set<Venue>().AnyAsync(v => v.Id == id && v.Verified && v.RemovedAt == null, ct);

    public Task<Venue?> FindAsync(Guid id, CancellationToken ct = default) =>
        db.Set<Venue>().AsNoTracking().SingleOrDefaultAsync(v => v.Id == id, ct);

    /// Stars from a kept meeting (0: skipped — asked no more, counted nowhere); the caller
    /// (Encounters) has checked the meeting was kept and that this person was in it.
    public async Task RateAsync(Guid venueId, Guid meetingId, Guid accountId, int stars, CancellationToken ct = default)
    {
        if (stars is < 0 or > 5) throw new DomainException(400, "venue.stars", "Choose one to five stars");
        if (await db.Set<VenueRating>().AnyAsync(r => r.MeetingId == meetingId && r.AccountId == accountId, ct))
            throw new DomainException(409, "venue.rated", "You already rated this place");
        db.Add(new VenueRating { VenueId = venueId, MeetingId = meetingId, AccountId = accountId, Stars = stars, CreatedAt = clock.UtcNow });
        Announce(venueId);
        await db.SaveChangesAsync(ct);
    }

    public Task<bool> RatedAsync(Guid meetingId, Guid accountId, CancellationToken ct = default) =>
        db.Set<VenueRating>().AnyAsync(r => r.MeetingId == meetingId && r.AccountId == accountId, ct);

    // --- the keepers ---

    public async Task<IReadOnlyList<AdminVenueView>> AdminListAsync(CancellationToken ct = default)
    {
        var venues = await db.Set<Venue>().AsNoTracking().OrderBy(v => v.RemovedAt != null).ThenBy(v => v.Name).ToListAsync(ct);
        var ids = venues.Select(v => v.Id).ToList();
        var ratings = await RatingsAsync(ids, ct);
        var photos = await PhotosAsync(ids, ct);
        return venues.Select(v => AdminView(v, ratings.GetValueOrDefault(v.Id), photos.GetValueOrDefault(v.Id) ?? [])).ToList();
    }

    public async Task<AdminVenueView> AdminGetAsync(Guid id, CancellationToken ct = default)
    {
        var v = await db.Set<Venue>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException(404, "venue.not_found", "That place does not exist");
        var ratings = await RatingsAsync([id], ct);
        var photos = await PhotosAsync([id], ct);
        return AdminView(v, ratings.GetValueOrDefault(id), photos.GetValueOrDefault(id) ?? []);
    }

    public async Task<AdminVenueView> CreateAsync(VenueWriteRequest req, CancellationToken ct = default)
    {
        var v = new Venue { CreatedAt = clock.UtcNow };
        Apply(v, req);
        db.Add(v);
        Announce(v.Id);
        await db.SaveChangesAsync(ct);
        return await AdminGetAsync(v.Id, ct);
    }

    public async Task<AdminVenueView> UpdateAsync(Guid id, VenueWriteRequest req, CancellationToken ct = default)
    {
        var v = await Tracked(id, ct);
        Apply(v, req);
        Announce(v.Id);
        await db.SaveChangesAsync(ct);
        return await AdminGetAsync(id, ct);
    }

    /// Off the list for new meetings; meetings already set there are told it is gone.
    public async Task RemoveAsync(Guid id, CancellationToken ct = default)
    {
        var v = await Tracked(id, ct);
        v.RemovedAt ??= clock.UtcNow;
        Announce(v.Id);
        await db.SaveChangesAsync(ct);
    }

    public async Task<AdminVenueView> AddPhotoAsync(Guid id, byte[] bytes, CancellationToken ct = default)
    {
        await Tracked(id, ct);
        if (bytes.Length == 0 || bytes.Length > PhotoService.MaxUploadBytes)
            throw new DomainException(400, "photos.too_large", "That photo is too large");
        var count = await db.Set<VenuePhoto>().CountAsync(p => p.VenueId == id, ct);
        if (count >= MaxPhotos) throw new DomainException(409, "venue.photos_full", "A place keeps at most four photos");
        var image = ImagePipeline.Process(bytes);
        var photo = new VenuePhoto
        {
            Id = Guid.CreateVersion7(), VenueId = id, Position = count, Width = image.Width, Height = image.Height,
            ThumbHash = image.ThumbHash, CreatedAt = clock.UtcNow,
        };
        photo.Path = $"venues/{id}/{photo.Id}.jpg";
        await store.PutAsync(photo.Path, new MemoryStream(image.Jpeg), ct);
        db.Add(photo);
        Announce(id);
        await db.SaveChangesAsync(ct);
        return await AdminGetAsync(id, ct);
    }

    public async Task<AdminVenueView> RemovePhotoAsync(Guid id, Guid photoId, CancellationToken ct = default)
    {
        var photos = await db.Set<VenuePhoto>().Where(p => p.VenueId == id).OrderBy(p => p.Position).ToListAsync(ct);
        var target = photos.SingleOrDefault(p => p.Id == photoId)
            ?? throw new DomainException(404, "venue.photo_not_found", "That photo does not exist");
        db.Remove(target);
        var i = 0;
        foreach (var p in photos.Where(p => p.Id != photoId)) p.Position = i++;
        Announce(id);
        await db.SaveChangesAsync(ct);
        urls.Forget(photoId);
        try { await store.DeleteAsync(target.Path, ct); }
        catch (Exception e) { log.LogWarning(e, "Could not delete venue photo {Path}", target.Path); }
        return await AdminGetAsync(id, ct);
    }

    private void Apply(Venue v, VenueWriteRequest req)
    {
        if (!VenueKinds.All.Contains(req.Kind)) throw new DomainException(400, "venue.kind", "Choose a kind of place");
        if (MongoliaGeo.All.All(c => c.Name != req.District)) throw new DomainException(400, "venue.district", "Choose a district");
        v.Name = req.Name.Trim();
        v.NameMn = string.IsNullOrWhiteSpace(req.NameMn) ? null : req.NameMn.Trim();
        v.Kind = req.Kind;
        v.District = req.District;
        v.Address = req.Address.Trim();
        v.Hours = string.IsNullOrWhiteSpace(req.Hours) ? null : req.Hours.Trim();
        v.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();
        v.AddressMn = string.IsNullOrWhiteSpace(req.AddressMn) ? null : req.AddressMn.Trim();
        v.HoursMn = string.IsNullOrWhiteSpace(req.HoursMn) ? null : req.HoursMn.Trim();
        v.DescriptionMn = string.IsNullOrWhiteSpace(req.DescriptionMn) ? null : req.DescriptionMn.Trim();
        v.Verified = req.Verified;
    }

    private async Task<Venue> Tracked(Guid id, CancellationToken ct) =>
        await db.Set<Venue>().SingleOrDefaultAsync(v => v.Id == id, ct)
        ?? throw new DomainException(404, "venue.not_found", "That place does not exist");

    private void Announce(Guid id)
    {
        live.ToAll(LiveKinds.VenueUpdated);
        live.ToAdmins(LiveKinds.VenueUpdated, id);
    }

    private static string RegionOf(string district) => MongoliaGeo.All.FirstOrDefault(c => c.Name == district)?.Region ?? district;

    private async Task<Dictionary<Guid, (double? Mean, int Count)>> RatingsAsync(List<Guid> ids, CancellationToken ct) =>
        (await db.Set<VenueRating>().AsNoTracking().Where(r => ids.Contains(r.VenueId) && r.Stars > 0)
            .GroupBy(r => r.VenueId).Select(g => new { g.Key, Mean = g.Average(r => (double)r.Stars), Count = g.Count() })
            .ToListAsync(ct))
        .ToDictionary(x => x.Key, x => ((double?)Math.Round(x.Mean, 1), x.Count));

    private async Task<Dictionary<Guid, List<VenuePhotoView>>> PhotosAsync(List<Guid> ids, CancellationToken ct)
    {
        var rows = await db.Set<VenuePhoto>().AsNoTracking().Where(p => ids.Contains(p.VenueId)).OrderBy(p => p.Position).ToListAsync(ct);
        var signed = await urls.GetManyAsync(rows.Select(p => (p.Id, p.Path)), ct);
        var result = new Dictionary<Guid, List<VenuePhotoView>>();
        foreach (var p in rows)
        {
            var (url, expires) = signed[p.Id];
            if (!result.TryGetValue(p.VenueId, out var list)) result[p.VenueId] = list = [];
            list.Add(new VenuePhotoView(p.Id, url, expires, Convert.ToBase64String(p.ThumbHash), p.Width, p.Height));
        }
        return result;
    }

    private static VenueView View(Venue v, (double? Mean, int Count) r, IReadOnlyList<VenuePhotoView> photos) =>
        new(v.Id, v.Name, v.NameMn, v.Kind, v.District, v.Address, v.Hours, v.Description, v.AddressMn, v.HoursMn, v.DescriptionMn,
            r.Mean, r.Count, photos,
            v.RemovedAt is not null || !v.Verified);

    private static AdminVenueView AdminView(Venue v, (double? Mean, int Count) r, IReadOnlyList<VenuePhotoView> photos) =>
        new(v.Id, v.Name, v.NameMn, v.Kind, v.District, v.Address, v.Hours, v.Description, v.AddressMn, v.HoursMn, v.DescriptionMn,
            v.Verified, v.RemovedAt is not null,
            r.Mean, r.Count, photos, v.CreatedAt);
}
