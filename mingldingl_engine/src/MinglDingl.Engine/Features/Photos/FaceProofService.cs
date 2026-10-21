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
    AppDb db, PhotoService photos, ProfileService profiles, Score.ScoreService score, IClock clock, IConfig config)
{
    /// The turned selfie's nose must move this many eye spans to one side. Either side counts: some
    /// phones save a front-camera photo mirrored, so the side asked cannot be told from the photo.
    private const float MinTurn = 0.15f;
    /// The two selfies must be one face at least this much (a turned head scores lower than a straight one).
    private const float SameSelfie = 0.30f;

    public async Task<FaceProofView> StatusAsync(Guid me, CancellationToken ct = default) =>
        View(await db.Set<Profile.Profile>().AsNoTracking().SingleAsync(p => p.AccountId == me, ct));

    public async Task<FaceProofResult> CheckAsync(Guid me, byte[] straight, byte[] turned, CancellationToken ct = default)
    {
        if (!config.Bool(ConfigKeys.FaceCheck)) throw new DomainException(409, "face.closed", "The face check is closed");
        if (straight.Length == 0 || turned.Length == 0) throw new DomainException(400, "photos.not_image", "Attach both selfies");

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

    private async Task<string> JudgeAsync(Guid me, byte[] straightBytes, byte[] turnedBytes, CancellationToken ct)
    {
        var straight = Read(straightBytes);
        var turned = Read(turnedBytes);
        if (straight is null || turned is null) return "noFace";
        if (Math.Abs(turned.Turn - straight.Turn) < MinTurn) return "turn";
        if (FaceMatcher.Similarity(straight.Embedding, turned.Embedding) < SameSelfie) return "notYou";

        // The middle portrait score must clear the line: one look-alike portrait is not enough, and
        // one odd photo (a hat, a far-off shot) does not sink an honest face.
        var scores = (await photos.PortraitFilesAsync(me, ct))
            .Select(bytes => Read(bytes) is { } face ? FaceMatcher.Similarity(straight.Embedding, face.Embedding) : 0f)
            .Order().ToList();
        if (scores.Count == 0) return "notYou";
        var middle = scores.Count % 2 == 1 ? scores[scores.Count / 2] : (scores[scores.Count / 2 - 1] + scores[scores.Count / 2]) / 2;
        return middle >= config.Int(ConfigKeys.FaceMatch) / 100f ? "proven" : "notYou";
    }

    private static FaceMatcher.Face? Read(byte[] bytes)
    {
        using var bitmap = ImagePipeline.DecodeUpright(bytes);
        return FaceMatcher.Read(bitmap);
    }

    private int TriesToday(Profile.Profile p) => p.FaceTriesDay == clock.TodayUb ? p.FaceTries : 0;

    /// Which way the next try asks: from the person, the day and the try, so it varies between tries.
    private string Turn(Profile.Profile p)
    {
        var seed = SHA256.HashData(Encoding.UTF8.GetBytes($"face:{p.AccountId}:{clock.TodayUb:yyyy-MM-dd}:{TriesToday(p)}"));
        return seed[0] % 2 == 0 ? "left" : "right";
    }

    private FaceProofView View(Profile.Profile p) => new(config.Bool(ConfigKeys.FaceCheck), p.FaceProvenAt is not null, Turn(p),
        Math.Max(0, config.Int(ConfigKeys.FaceTriesPerDay) - TriesToday(p)), config.Int(ConfigKeys.FaceTriesPerDay));
}
