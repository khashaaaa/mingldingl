using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Features.Profile;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Dev;

/// Absolute states (not steps forward): applying one makes the account look exactly like it.
public enum SeedState { Step1, Step2, Step3, Step4, Step5, Step6, Finished, Suspended, Deleted }

/// Development only. Puts an account into any state in seconds, so any screen is reachable.
public sealed class DevSeeder(AppDb db, PhotoService photos, ProfileService profiles, ScoreService score, IClock clock, IConfig config)
{
    private static readonly string PhotoDir = Path.Combine(AppContext.BaseDirectory, "Seed", "photos");

    public async Task<Guid> EnsureAccountAsync(string phone, CancellationToken ct = default)
    {
        var a = await db.Set<Account>().SingleOrDefaultAsync(x => x.Phone == phone, ct);
        if (a is not null) return a.Id;
        a = new Account { Phone = phone, Status = AccountStatus.Active, CreatedAt = clock.UtcNow };
        db.Add(a);
        await db.SaveChangesAsync(ct);
        return a.Id;
    }

    public async Task ApplyAsync(Guid accountId, SeedState state, CancellationToken ct = default)
    {
        foreach (var p in await photos.ListAsync(accountId, ct)) await photos.DeleteAsync(accountId, p.Id, ct, keepMinimum: false);

        // A seeded state starts its score afresh, then earns what that state has earned.
        await db.Set<ScoreEvent>().Where(e => e.AccountId == accountId).ExecuteDeleteAsync(ct);
        var account = await db.Set<Account>().SingleAsync(a => a.Id == accountId, ct);
        account.Status = state switch
        {
            SeedState.Suspended => AccountStatus.Suspended,
            SeedState.Deleted => AccountStatus.Deleted,
            _ => AccountStatus.Active,
        };

        var profile = await db.Set<Profile.Profile>().SingleOrDefaultAsync(p => p.AccountId == accountId, ct);
        var rank = state switch { SeedState.Suspended or SeedState.Deleted => (int)SeedState.Finished, _ => (int)state };
        if (rank == (int)SeedState.Step1)
        {
            if (profile is not null) db.Remove(profile);
        }
        else
        {
            var now = clock.UtcNow;
            if (profile is null)
            {
                profile = new Profile.Profile { AccountId = accountId, CreatedAt = now };
                db.Add(profile);
            }
            profile.Points = 0;
            profile.Tier = "Garnet";
            profile.TierUpPending = null;
            profile.Name = "Saruul";
            profile.BirthDate = new DateOnly(1997, 4, 12);
            profile.Locale = profile.Locale is "mn" ? "mn" : "en";
            profile.Gender = rank >= (int)SeedState.Step3 ? "Female" : null;
            profile.Bio = rank >= (int)SeedState.Step5 ? "Rides out at dawn; tea after." : null;
            profile.City = rank >= (int)SeedState.Step5 ? "Khan-Uul" : null;
            profile.Oath = rank >= (int)SeedState.Step6 ? "Bond" : null;
            profile.OathSwornAt = profile.Oath is null ? null : now;
            profile.WelcomedAt = rank >= (int)SeedState.Finished ? now : null;
            profile.UpdatedAt = now;
        }
        profiles.Announce(accountId);
        await db.SaveChangesAsync(ct);
        if (rank >= (int)SeedState.Finished)
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await score.AwardFinishedAsync(accountId, ct);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }

        if (rank >= (int)SeedState.Step4)
        {
            var count = rank >= (int)SeedState.Finished
                ? Math.Min(config.Int(ConfigKeys.PhotosMin) + 1, config.Int(ConfigKeys.PhotosMax))
                : config.Int(ConfigKeys.PhotosMin);
            var files = Directory.GetFiles(PhotoDir, "*.jpg").Order().ToArray();
            for (var i = 0; i < count; i++)
                await photos.UploadAsync(accountId, await File.ReadAllBytesAsync(files[i % files.Length], ct), $"seed-{state}-{i}-{Guid.NewGuid():N}", ct, checkFace: false);
        }
    }
}
