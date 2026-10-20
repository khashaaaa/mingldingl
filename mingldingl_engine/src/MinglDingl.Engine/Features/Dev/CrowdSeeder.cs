using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Dev;

/// One person in Seed/crowd/crowd.json. Ages and dates are relative to today, so the crowd never
/// ages out; step is the onboarding step (1–6) for state "Onboarding", 7 otherwise.
public sealed record CrowdPerson(
    string Id, string Phone, string Name, string Gender, int Age, int BirthdayOffsetDays, string State, int Step,
    string City, string Oath, string Locale, string Bio, int Photos, int CreatedDaysAgo,
    IReadOnlyList<CrowdDevice> Devices, string? Edge);

public sealed record CrowdDevice(string Name, int CreatedDaysAgo, int SeenDaysAgo, int? RevokedDaysAgo);

/// Development only. Forty-eight fictional people (painted by FLUX, see ~/ComfyUI-models/people.py) in
/// every account state, with devices, sign-up dates spread over five months, and the edge cases
/// (18 today, longest name, 300-character bio, most photos). Absolute: rerunning puts every crowd
/// account back exactly; photos are keyed per person, so a rerun uploads nothing it already has.
public sealed class CrowdSeeder(AppDb db, PhotoService photos, IClock clock)
{
    private static readonly string Dir = Path.Combine(AppContext.BaseDirectory, "Seed", "crowd");
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static IReadOnlyList<CrowdPerson> Load() =>
        JsonSerializer.Deserialize<List<CrowdPerson>>(File.ReadAllText(Path.Combine(Dir, "crowd.json")), Json)!;

    public async Task<IReadOnlyList<CrowdPerson>> ApplyAsync(CancellationToken ct = default)
    {
        var crowd = Load();
        foreach (var person in crowd) await ApplyAsync(person, ct);
        await SeedVerificationsAsync(ct);
        return crowd;
    }

    private async Task ApplyAsync(CrowdPerson c, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var account = await db.Set<Account>().SingleOrDefaultAsync(a => a.Phone == c.Phone, ct);
        if (account is null)
        {
            account = new Account { Phone = c.Phone };
            db.Add(account);
        }
        account.CreatedAt = now.AddDays(-c.CreatedDaysAgo).AddMinutes(-int.Parse(c.Phone[^2..]) * 7);
        account.Status = c.State switch
        {
            "Suspended" => AccountStatus.Suspended,
            "Deleted" => AccountStatus.Deleted,
            _ => AccountStatus.Active,
        };
        await db.SaveChangesAsync(ct);

        await PhotosAsync(account.Id, c, ct);

        var profile = await db.Set<Profile.Profile>().SingleOrDefaultAsync(p => p.AccountId == account.Id, ct);
        if (c.Step == 1)
        {
            if (profile is not null) db.Remove(profile);
        }
        else
        {
            if (profile is null)
            {
                profile = new Profile.Profile { AccountId = account.Id };
                db.Add(profile);
            }
            profile.CreatedAt = account.CreatedAt.AddMinutes(3);
            profile.UpdatedAt = account.CreatedAt.AddMinutes(20);
            profile.Name = c.Name;
            profile.BirthDate = c.Edge == "turns18today"
                ? clock.TodayUb.AddYears(-18)
                : clock.TodayUb.AddYears(-c.Age).AddDays(-c.BirthdayOffsetDays);
            profile.Locale = c.Locale;
            profile.Gender = c.Step >= 3 ? c.Gender : null;
            profile.Bio = c.Step >= 5 ? c.Bio : null;
            profile.City = c.Step >= 5 ? c.City : null;
            profile.Oath = c.Step >= 6 ? c.Oath : null;
            profile.OathSwornAt = profile.Oath is null ? null : account.CreatedAt.AddMinutes(15);
            profile.WelcomedAt = c.Step >= 7 ? account.CreatedAt.AddMinutes(16) : null;
        }

        await db.Set<DeviceSession>().Where(d => d.AccountId == account.Id).ExecuteDeleteAsync(ct);
        foreach (var d in c.Devices)
            db.Add(new DeviceSession
            {
                AccountId = account.Id,
                DeviceName = d.Name,
                CreatedAt = now.AddDays(-Math.Min(d.CreatedDaysAgo, c.CreatedDaysAgo)),
                LastSeenAt = now.AddDays(-Math.Min(d.SeenDaysAgo, c.CreatedDaysAgo)).AddHours(-d.Name.Length),
                RevokedAt = d.RevokedDaysAgo is { } r ? now.AddDays(-r) : null,
            });
        await db.SaveChangesAsync(ct);
    }

    /// The person's own shots, in order (people.py paints six per person who keeps five or six).
    private async Task PhotosAsync(Guid accountId, CrowdPerson c, CancellationToken ct)
    {
        var keys = Enumerable.Range(0, c.Photos).Select(i => $"crowd-{c.Id}-{i}").ToList();
        foreach (var p in await db.Set<Photo>().AsNoTracking().Where(p => p.AccountId == accountId).ToListAsync(ct))
            if (!keys.Contains(p.ClientKey)) await photos.DeleteAsync(accountId, p.Id, ct);
        for (var i = 0; i < keys.Count; i++)
        {
            var file = Path.Combine(Dir, $"{c.Id}_{i}.jpg");
            await photos.UploadAsync(accountId, await File.ReadAllBytesAsync(file, ct), keys[i], ct, checkFace: false);
        }
    }

    /// Sign-ins caught mid-way, for the sweep: one live, one expired, one superseded.
    private async Task SeedVerificationsAsync(CancellationToken ct)
    {
        var now = clock.UtcNow;
        await db.Set<PhoneVerification>().Where(v => v.Phone.StartsWith("99109")).ExecuteDeleteAsync(ct);
        db.AddRange(
            Verification("99109001", VerificationState.Pending, now, now.AddMinutes(10)),
            Verification("99109002", VerificationState.Pending, now.AddHours(-2), now.AddHours(-1)),
            Verification("99109003", VerificationState.Superseded, now.AddMinutes(-5), now.AddMinutes(5)));
        await db.SaveChangesAsync(ct);
    }

    private static PhoneVerification Verification(string phone, VerificationState state, DateTimeOffset at, DateTimeOffset expires) => new()
    {
        Id = Guid.CreateVersion7(),
        Phone = phone,
        ProviderId = $"crowd-{phone}",
        State = state,
        CreatedAt = at,
        ExpiresAt = expires,
    };
}
