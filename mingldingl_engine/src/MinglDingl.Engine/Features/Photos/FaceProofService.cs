using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Profile;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Persistence;
using SkiaSharp;

namespace MinglDingl.Engine.Features.Photos;

/// open: the face check is on. proven: the mark is on the card. turn: which way the app asks the second
/// selfie to turn — left | right, the person's own (it changes with every try; either way passes).
/// triesLeft: today's.
public sealed record FaceProofView(bool Open, bool Proven, string Turn, int TriesLeft, int TriesPerDay);

/// outcome: proven | noFace (a selfie shows no clear face) | turn (the second is not turned) | notYou (the two selfies, or the selfie and the portraits, are not one face).
public sealed record FaceProofResult(string Outcome, FaceProofView Status);

/// The face check: two camera selfies — straight, then turned (so one old photo is not enough) —
/// against the stored portraits. Only the outcome is kept: the selfies, and
/// the numbers read from every face, are gone when the request ends.
public sealed class FaceProofService(
    AppDb db, PhotoService photos, ProfileService profiles, Score.ScoreService score, IClock clock, IConfig config,
    ILogger<FaceProofService> log)
{
    /// The turned selfie's nose must move this many eye spans to one side. Either side counts: some
    /// phones save a front-camera photo mirrored, so the side asked cannot be told from the photo.
    /// Two straight photos of one person differ by 0.04 at the median and 0.11 at the 90th percentile
    /// (the crowd's portraits); 0.15 refused an honest "a little" turn on the A51.
    private const float MinTurn = 0.10f;
    /// The two selfies must be one face at least this much (a turned head scores lower than a straight one).
    private const float SameSelfie = 0.30f;
    /// The most turned selfies one check may send.
    public const int MaxTurned = 4;

    public async Task<FaceProofView> StatusAsync(Guid me, CancellationToken ct = default) =>
        View(await db.Set<Profile.Profile>().AsNoTracking().SingleAsync(p => p.AccountId == me, ct));

    public async Task<FaceProofResult> CheckAsync(Guid me, byte[] straight, IReadOnlyList<byte[]> turned, CancellationToken ct = default)
    {
        if (!config.Bool(ConfigKeys.FaceCheck)) throw new DomainException(409, "face.closed", "The face check is closed");
        if (straight.Length == 0 || turned.Count == 0 || turned.Any(t => t.Length == 0)) throw new DomainException(400, "photos.not_image", "Attach both selfies");

        // The try is counted before the faces are read, under a row lock, so racing requests cannot
        // take more than the day's tries.
        await using (var tx = await db.Database.BeginTransactionAsync(ct))
        {
            var p = await db.Set<Profile.Profile>().FromSql($"""SELECT * FROM profiles WHERE "AccountId" = {me} FOR UPDATE""")
                .SingleOrDefaultAsync(ct) ?? throw new DomainException(404, "profile.missing", "Create your character first");
            if (p.WelcomedAt is null) throw new DomainException(409, "face.not_ready", "Finish your character first");
            if (p.FaceProvenAt is not null) return new FaceProofResult("proven", View(p));
            if (TriesToday(p) >= config.Int(ConfigKeys.FaceTriesPerDay))
                throw new DomainException(409, "face.tries", "No face checks left today — try again tomorrow");
            (p.FaceTries, p.FaceTriesDay) = (TriesToday(p) + 1, clock.TodayUb);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }

        var outcome = await JudgeAsync(me, straight, turned, ct);
        // A selfie with no face or no turn never reached the portraits, so it tells nothing and costs nothing.
        if (outcome is "noFace" or "turn")
            await db.Set<Profile.Profile>().Where(p => p.AccountId == me && p.FaceTriesDay == clock.TodayUb && p.FaceTries > 0)
                .ExecuteUpdateAsync(u => u.SetProperty(p => p.FaceTries, p => p.FaceTries - 1), ct);
        if (outcome == "proven")
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await db.Set<Profile.Profile>().Where(p => p.AccountId == me)
                .ExecuteUpdateAsync(u => u.SetProperty(p => p.FaceProvenAt, clock.UtcNow), ct);
            // The points come once a lifetime: a mark lost to a new portrait and proven again pays nothing.
            if (!await db.Set<Score.ScoreEvent>().AnyAsync(e => e.AccountId == me && e.Kind == Score.DeedKinds.FaceProven, ct))
                await score.AwardAsync(me, Score.DeedKinds.FaceProven, config.Int(ConfigKeys.ScoreFaceProven), null, ct);
            profiles.Announce(me);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        return new FaceProofResult(outcome, View(await db.Set<Profile.Profile>().AsNoTracking().SingleAsync(p => p.AccountId == me, ct)));
    }

    private async Task<string> JudgeAsync(Guid me, byte[] straightBytes, IReadOnlyList<byte[]> turnedBytes, CancellationToken ct)
    {
        var straight = Read(straightBytes);
        // The most turned of the shots taken through the turn: one taken before the head moved, or
        // after it came back, does not sink the check.
        var shots = straight is null ? [] : turnedBytes.Select(Read).OfType<FaceMatcher.Face>().ToList();
        var turned = shots.MaxBy(t => Math.Abs(t.Turn - straight!.Turn));
        // Only the numbers, never the faces: what the bars are tuned from.
        log.LogInformation("Face check turn: straight {Straight:F3}, turned [{Turned}] of {Sent}", straight?.Turn,
            string.Join(", ", shots.Select(t => t.Turn.ToString("F3"))), turnedBytes.Count);
        if (straight is null || turned is null) return "noFace";
        if (Math.Abs(turned.Turn - straight.Turn) < MinTurn) return "turn";
        var pair = FaceMatcher.Similarity(straight.Embedding, turned.Embedding);
        log.LogInformation("Face check selfies: one face {Pair:F3}, bar {Bar}", pair, SameSelfie);
        if (pair < SameSelfie) return "notYou";

        // The middle portrait score must clear the line: one look-alike portrait is not enough, and
        // one odd photo (a hat, a far-off shot) does not sink an honest face.
        var scores = (await photos.PortraitFilesAsync(me, ct))
            .Select(bytes => Read(bytes) is { } face ? FaceMatcher.Similarity(straight.Embedding, face.Embedding) : 0f)
            .Order().ToList();
        if (scores.Count == 0) return "notYou";
        var middle = scores.Count % 2 == 1 ? scores[scores.Count / 2] : (scores[scores.Count / 2 - 1] + scores[scores.Count / 2]) / 2;
        log.LogInformation("Face check portraits: [{Scores}], middle {Middle:F3}, bar {Bar}",
            string.Join(", ", scores.Select(x => x.ToString("F3"))), middle, config.Int(ConfigKeys.FaceMatch));
        return middle >= config.Int(ConfigKeys.FaceMatch) / 100f ? "proven" : "notYou";
    }

    private static FaceMatcher.Face? Read(byte[] bytes)
    {
        using var bitmap = ImagePipeline.DecodeUpright(bytes);
        return FaceMatcher.Read(bitmap);
    }

    private int TriesToday(Profile.Profile p) => p.FaceTriesDay == clock.TodayUb ? p.FaceTries : 0;

    /// Which way the next try asks: from the person and the second, so it varies between tries (a miss
    /// that is handed back leaves the count of tries as it was).
    private string Turn(Profile.Profile p)
    {
        var seed = SHA256.HashData(Encoding.UTF8.GetBytes($"face:{p.AccountId}:{clock.UtcNow.ToUnixTimeSeconds()}"));
        return seed[0] % 2 == 0 ? "left" : "right";
    }

    private FaceProofView View(Profile.Profile p) => new(config.Bool(ConfigKeys.FaceCheck), p.FaceProvenAt is not null, Turn(p),
        Math.Max(0, config.Int(ConfigKeys.FaceTriesPerDay) - TriesToday(p)), config.Int(ConfigKeys.FaceTriesPerDay));
}
