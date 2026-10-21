using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Profile;

/// How many portraits an account holds — owned by the Photos feature.
public interface IPhotoCount
{
    Task<int> CountAsync(Guid accountId, CancellationToken ct = default);
}

public sealed class ProfileService(AppDb db, IClock clock, IConfig config, ILiveOutbox live, IPhotoCount photos, ScoreService score)
{
    public static readonly IReadOnlySet<string> Genders = new HashSet<string>(StringComparer.Ordinal) { "Male", "Female" };
    public static readonly IReadOnlySet<string> Oaths = new HashSet<string>(StringComparer.Ordinal) { "Bond", "Fate", "Kinship" };
    public static readonly IReadOnlySet<string> Locales = new HashSet<string>(StringComparer.Ordinal) { "en", "mn" };

    public static int OnboardingStep(Profile? p, int photoCount, int photosMin) => p switch
    {
        null => 1,
        { Gender: null } => 2,
        _ when photoCount < photosMin => 3,
        { Bio: null } or { City: null } => 4,
        { Oath: null } => 5,
        { WelcomedAt: null } => 6,
        _ => 7,
    };

    public async Task<MeView> MeAsync(Guid accountId, CancellationToken ct = default)
    {
        var account = await db.Set<Account>().AsNoTracking().SingleAsync(a => a.Id == accountId, ct);
        var profile = await db.Set<Profile>().AsNoTracking().SingleOrDefaultAsync(p => p.AccountId == accountId, ct);
        var count = profile is null ? 0 : await photos.CountAsync(accountId, ct);
        return new MeView(account.Id, account.Status.ToString(), profile is null ? null : View(profile),
            OnboardingStep(profile, count, config.Int(ConfigKeys.PhotosMin)), account.Phone[..4], account.DeleteAt);
    }

    public async Task<MeView> CreateAsync(Guid accountId, CreateProfileRequest req, CancellationToken ct = default)
    {
        if (await db.Set<Profile>().AnyAsync(p => p.AccountId == accountId, ct))
            throw new DomainException(409, "profile.exists", "Your character already exists");
        var now = clock.UtcNow;
        db.Add(new Profile
        {
            AccountId = accountId,
            Name = CleanName(req.Name),
            BirthDate = CheckAge(req.BirthDate),
            Locale = CheckLocale(req.Locale),
            CreatedAt = now,
            UpdatedAt = now,
        });
        Announce(accountId);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e) when (e.InnerException is Npgsql.PostgresException { SqlState: "23505" })
        {
            throw new DomainException(409, "profile.exists", "Your character already exists");
        }
        return await MeAsync(accountId, ct);
    }

    public async Task<MeView> UpdateAsync(Guid accountId, UpdateProfileRequest req, CancellationToken ct = default)
    {
        var p = await db.Set<Profile>().SingleOrDefaultAsync(x => x.AccountId == accountId, ct)
            ?? throw new DomainException(409, "profile.missing", "Create your character first");
        var now = clock.UtcNow;

        if (req.Name is not null) p.Name = CleanName(req.Name);
        if (req.Gender is not null)
        {
            if (!Genders.Contains(req.Gender)) throw new DomainException(400, "profile.gender", "Choose one of the offered options");
            if (p.Gender is not null && p.Gender != req.Gender)
                throw new DomainException(409, "profile.gender_locked", "Gender is set once");
            p.Gender = req.Gender;
        }
        if (req.Bio is not null) p.Bio = req.Bio.Trim();
        if (req.City is not null)
        {
            if (!MongoliaGeo.IsKnown(req.City)) throw new DomainException(400, "profile.city", "Pick a place from the list");
            p.City = req.City;
        }
        if (req.Oath is not null)
        {
            if (!Oaths.Contains(req.Oath)) throw new DomainException(400, "profile.oath", "Choose one of the three oaths");
            if (p.Oath is not null && p.Oath != req.Oath)
                throw new DomainException(409, "profile.oath_locked", "An oath is sworn once");
            if (p.Oath is null) p.OathSwornAt = now;
            p.Oath = req.Oath;
        }
        if (req.Locale is not null) p.Locale = CheckLocale(req.Locale);
        // Someone already showing this person in Seek is refused at summon ("seek.gone"); no broadcast.
        if (req.Paused is bool paused) p.PausedAt = paused ? p.PausedAt ?? now : null;
        var finishing = req.Welcomed == true && p.WelcomedAt is null;
        if (req.Welcomed == true) p.WelcomedAt ??= now;

        p.UpdatedAt = now;
        p.LastSeenAt = now;
        Announce(accountId);
        if (finishing)
        {
            // The finished-character points land with the welcome, or neither does.
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await db.SaveChangesAsync(ct);
            await score.AwardFinishedAsync(accountId, ct);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        else await db.SaveChangesAsync(ct);
        return await MeAsync(accountId, ct);
    }

    /// Something visible about this person changed: their devices refetch, the admin list refreshes the row.
    public void Announce(Guid accountId)
    {
        live.ToAccount(accountId, LiveKinds.ProfileUpdated, accountId);
        live.ToAdmins(LiveKinds.UserUpdated, accountId);
    }

    public ProfileView View(Profile p) => new(
        p.Name, p.BirthDate, AgeOn(p.BirthDate, clock.TodayUb), p.Gender, p.Bio, p.City, p.Oath, p.OathSwornAt, p.OathProvenAt,
        p.Locale, p.Points, p.Tier, p.TierUpPending, p.CreatedAt, p.PausedAt is not null,
        p.AwayUntil > clock.UtcNow ? p.AwayUntil : null,
        p.AwayFrom?.AddDays(config.Int(ConfigKeys.AwayEveryDays)) is { } next && next > clock.UtcNow ? next : null,
        p.FaceProvenAt);

    public static int AgeOn(DateOnly birth, DateOnly today)
    {
        var age = today.Year - birth.Year;
        return birth > today.AddYears(-age) ? age - 1 : age;
    }

    private DateOnly CheckAge(DateOnly birth)
    {
        var age = AgeOn(birth, clock.TodayUb);
        if (age < 18) throw new DomainException(400, "profile.age", "You must be 18 or older");
        if (age > 99) throw new DomainException(400, "profile.born", "Enter your real birth date");
        return birth;
    }

    private static string CleanName(string name)
    {
        var n = name.Trim();
        if (n.Length == 0 || n.Any(char.IsControl)) throw new DomainException(400, "profile.name", "Enter your name");
        return n;
    }

    private static string CheckLocale(string locale) =>
        Locales.Contains(locale) ? locale : throw new DomainException(400, "profile.locale", "Language must be en or mn");
}
