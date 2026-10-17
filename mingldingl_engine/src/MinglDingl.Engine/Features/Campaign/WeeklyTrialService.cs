using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Encounters;
using MinglDingl.Engine.Features.Festivals;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Campaign;

/// The week's shared trial for a bond past its first seal: the Exchange (one prompt, both answer,
/// answers open together), or during the Naadam the Three Games. It opens when either side first
/// looks this week and lapses quietly at Sunday's end.
public sealed class WeeklyTrialService(AppDb db, IClock clock, IConfig config, ILiveOutbox live, ScoreService score,
    FestivalService festivals, CampaignService campaign)
{
    public const int Strength = 0;
    public const int Aim = 1;
    public const int Speed = 2;

    public static readonly IReadOnlyList<string> Exchanges =
    [
        "Tell the other one thing you have never told anyone here.",
        "Tell the other the moment this year you felt most like yourself.",
        "Tell the other a place you want to see before you are old.",
        "Tell the other something you were wrong about, and how you found out.",
        "Tell the other what a perfect ordinary Tuesday looks like.",
        "Tell the other a fear you have outgrown.",
        "Tell the other who taught you the most, and what.",
        "Tell the other one thing they said that stayed with you.",
    ];

    public async Task<WeeklyTrialView?> GetAsync(Guid me, Guid bondId, CancellationToken ct = default)
    {
        var b = await db.Set<Bond>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == bondId, ct);
        if (b is null || !b.Has(me)) throw new DomainException(404, "bond.not_found", "That bond does not exist");
        var week = UbDays.WeekStart(clock.TodayUb);
        var t = await db.Set<WeeklyTrial>().AsNoTracking().SingleOrDefaultAsync(x => x.BondId == bondId && x.Week == week, ct);
        if (t is null)
        {
            if (b.State != BondState.Live || b.Seals < 1) return null;
            t = await OpenAsync(b, week, ct);
        }
        return await ViewAsync(t, me, ct);
    }

    private async Task<WeeklyTrial> OpenAsync(Bond b, DateOnly week, CancellationToken ct)
    {
        var naadam = (await festivals.SeasonAsync(ct)).Now?.Key == FestivalKeys.Naadam;
        var rng = new Random(HashCode.Combine(b.Id, week.DayNumber));
        int[] prompts;
        if (naadam)
        {
            var aims = await db.Set<TrialQuestion>().Select(q => q.Id).OrderBy(i => i).ToListAsync(ct);
            var speeds = await db.Set<IcebreakerQuestion>().Select(q => q.Id).OrderBy(i => i).ToListAsync(ct);
            prompts = [aims.Count > 0 ? aims[rng.Next(aims.Count)] : 0, speeds.Count > 0 ? speeds[rng.Next(speeds.Count)] : 0];
        }
        else prompts = [rng.Next(Exchanges.Count)];
        var t = new WeeklyTrial
        {
            Id = Guid.CreateVersion7(), BondId = b.Id, Week = week, Kind = naadam ? TrialKind.ThreeGames : TrialKind.Exchange,
            Prompts = prompts, CreatedAt = clock.UtcNow,
        };
        // Two first looks at once: one row wins, the other reads it.
        var n = await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO weekly_trials ("Id", "BondId", "Week", "Kind", "Prompts", "CreatedAt")
            VALUES ({t.Id}, {t.BondId}, {t.Week}, {t.Kind.ToString()}, {t.Prompts}, {t.CreatedAt})
            ON CONFLICT ("BondId", "Week") DO NOTHING
            """, ct);
        if (n == 0) return await db.Set<WeeklyTrial>().AsNoTracking().SingleAsync(x => x.BondId == b.Id && x.Week == week, ct);
        return t;
    }

    /// The speed game's hour starts when this side opens it.
    public async Task<WeeklyTrialView> OpenSpeedAsync(Guid me, Guid bondId, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var (b, t) = await LockAsync(me, bondId, ct);
        if (t.Kind != TrialKind.ThreeGames) throw new DomainException(409, "weekly.no_game", "This week's trial has no such game");
        var a = await AnswerRowAsync(t.Id, Speed, me, ct);
        a.OpenedAt ??= clock.UtcNow;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await ViewAsync(t, me, ct);
    }

    public async Task<WeeklyTrialView> AnswerAsync(Guid me, Guid bondId, int game, WeeklyAnswerRequest req, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var (b, t) = await LockAsync(me, bondId, ct);
        var games = t.Kind == TrialKind.Exchange ? 1 : 3;
        if (game < 0 || game >= games) throw new DomainException(409, "weekly.no_game", "This week's trial has no such game");
        var a = await AnswerRowAsync(t.Id, game, me, ct);
        if (a.AnsweredAt is not null) throw new DomainException(409, "weekly.answered", "Your answer is already sealed");
        var now = clock.UtcNow;
        switch (t.Kind, game)
        {
            case (TrialKind.Exchange, _) or (TrialKind.ThreeGames, Speed):
                var text = req.Text?.Trim();
                if (string.IsNullOrEmpty(text)) throw new DomainException(400, "icebreaker.empty", "Write your answer first");
                if (game == Speed && a.OpenedAt is null) a.OpenedAt = now;
                a.Text = text;
                break;
            case (TrialKind.ThreeGames, Strength):
                if (req.Choice is not (0 or 1)) throw new DomainException(400, "weekly.choice", "Choose one");
                a.Choice = req.Choice;
                break;
            default:
                if (req.Choice is not (>= 0 and <= 3) || req.Guess is not (>= 0 and <= 3))
                    throw new DomainException(400, "weekly.choice", "Choose one of the four");
                a.Choice = req.Choice;
                a.Guess = req.Guess;
                break;
        }
        a.AnsweredAt = now;
        await db.SaveChangesAsync(ct);

        var theirs = await db.Set<WeeklyAnswer>().AsNoTracking()
            .SingleOrDefaultAsync(x => x.TrialId == t.Id && x.Game == game && x.AccountId == b.Other(me), ct);
        if (theirs?.AnsweredAt is not null && Counts(t, game, a) && Counts(t, game, theirs))
            foreach (var who in new[] { b.AId, b.BId })
                await score.AwardAsync(who, DeedKinds.WeeklyTrial, config.Int(ConfigKeys.ScoreWeeklyTrial), b.Id, ct);
        foreach (var who in new[] { b.AId, b.BId }) live.ToAccount(who, LiveKinds.TrialUpdated, b.Id);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await ViewAsync(t, me, ct);
    }

    /// A speed answer counts only inside its hour.
    private bool Counts(WeeklyTrial t, int game, WeeklyAnswer a) =>
        !(t.Kind == TrialKind.ThreeGames && game == Speed)
        || (a.OpenedAt is { } o && a.AnsweredAt <= o.AddMinutes(config.Int(ConfigKeys.SpeedGameMinutes)));

    private async Task<WeeklyAnswer> AnswerRowAsync(Guid trial, int game, Guid me, CancellationToken ct)
    {
        var a = await db.Set<WeeklyAnswer>().SingleOrDefaultAsync(x => x.TrialId == trial && x.Game == game && x.AccountId == me, ct);
        if (a is not null) return a;
        a = new WeeklyAnswer { TrialId = trial, Game = game, AccountId = me };
        db.Add(a);
        return a;
    }

    private async Task<(Bond, WeeklyTrial)> LockAsync(Guid me, Guid bondId, CancellationToken ct)
    {
        var b = await campaign.LockLiveAsync(me, bondId, ct);
        var week = UbDays.WeekStart(clock.TodayUb);
        var t = await db.Set<WeeklyTrial>().AsNoTracking().SingleOrDefaultAsync(x => x.BondId == bondId && x.Week == week, ct)
            ?? throw new DomainException(409, "weekly.closed", "This week's trial has not opened");
        return (b, t);
    }

    private async Task<WeeklyTrialView> ViewAsync(WeeklyTrial t, Guid me, CancellationToken ct)
    {
        var answers = await db.Set<WeeklyAnswer>().AsNoTracking().Where(x => x.TrialId == t.Id).ToListAsync(ct);
        var minutes = config.Int(ConfigKeys.SpeedGameMinutes);
        var games = new List<GameView>();
        var count = t.Kind == TrialKind.Exchange ? 1 : 3;
        var locale = await QuestionsMn.LocaleAsync(db, me, ct);
        TrialQuestion? aim = null;
        string? speed = null;
        if (t.Kind == TrialKind.ThreeGames)
        {
            aim = await db.Set<TrialQuestion>().AsNoTracking().SingleOrDefaultAsync(q => q.Id == t.Prompts[0], ct);
            speed = await db.Set<IcebreakerQuestion>().AsNoTracking().Where(q => q.Id == t.Prompts[1]).Select(q => q.Text)
                .SingleOrDefaultAsync(ct);
        }
        for (var g = 0; g < count; g++)
        {
            var mine = answers.FirstOrDefault(a => a.Game == g && a.AccountId == me);
            var theirs = answers.FirstOrDefault(a => a.Game == g && a.AccountId != me);
            var both = mine?.AnsweredAt is not null && theirs?.AnsweredAt is not null;
            var (kind, prompt, choices) = (t.Kind, g) switch
            {
                (TrialKind.Exchange, _) => ("exchange", QuestionsMn.In(Exchanges[t.Prompts[0] % Exchanges.Count], locale),
                    (IReadOnlyList<string>?)null),
                (_, Strength) => ("strength", (string?)null, null),
                (_, Aim) => ("aim", aim is null ? null : QuestionsMn.In(aim.Text, locale),
                    aim is null ? null : QuestionsMn.In(aim.Choices, locale)),
                _ => ("speed", speed is null ? null : QuestionsMn.In(speed, locale), null),
            };
            var due = g == Speed && t.Kind == TrialKind.ThreeGames && mine?.OpenedAt is { } o ? o.AddMinutes(minutes) : (DateTimeOffset?)null;
            games.Add(new GameView(g, kind, prompt, choices, mine?.AnsweredAt is not null, theirs?.AnsweredAt is not null,
                mine?.Text, mine?.Choice, mine?.Guess,
                both ? theirs!.Text : null, both ? theirs!.Choice : null, both ? theirs!.Guess : null,
                mine?.OpenedAt, due, both && Counts(t, g, mine!) && Counts(t, g, theirs!)));
        }
        return new WeeklyTrialView(t.Id, t.Kind == TrialKind.Exchange ? "exchange" : "threeGames", t.Week,
            UbDays.Start(t.Week.AddDays(7)), config.Int(ConfigKeys.ScoreWeeklyTrial), games);
    }
}
