using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Features.Venues;
using MinglDingl.Engine.Features.Video;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Encounters;

/// The icebreaker, the Trial, and the one view of everything a bond can do beyond letters. Steps
/// open as seals break (BondService calls OnSealAsync in the letter's transaction).
public sealed class EncounterService(AppDb db, IClock clock, IConfig config, ILiveOutbox live, ScoreService score, VenueService venues,
    Campaign.CampaignService campaign)
{
    public const int TrialLength = 5;

    /// Opens whatever the bond's seals now reach. Runs inside the caller's transaction; the caller saves.
    public async Task OnSealAsync(Bond b, CancellationToken ct = default)
    {
        var e = await db.Set<Encounter>().SingleOrDefaultAsync(x => x.BondId == b.Id, ct);
        if (e is null)
        {
            e = new Encounter { BondId = b.Id };
            db.Add(e);
        }
        var now = clock.UtcNow;
        var changed = false;
        if (e.IcebreakerOpenAt is null && b.Seals >= config.Int(ConfigKeys.IcebreakerSeal))
        {
            var ids = await db.Set<IcebreakerQuestion>().Select(q => q.Id).ToListAsync(ct);
            if (ids.Count > 0)
            {
                e.IcebreakerId = ids[Random.Shared.Next(ids.Count)];
                e.IcebreakerOpenAt = now;
                changed = true;
            }
        }
        if (e.TrialOpenAt is null && b.Seals >= config.Int(ConfigKeys.TrialSeal))
        {
            var ids = await db.Set<TrialQuestion>().Select(q => q.Id).ToListAsync(ct);
            if (ids.Count >= TrialLength)
            {
                e.TrialIds = ids.OrderBy(_ => Random.Shared.Next()).Take(TrialLength).ToArray();
                e.TrialOpenAt = now;
                changed = true;
            }
        }
        if (e.MeetingOpenAt is null && b.Seals >= config.Int(ConfigKeys.MeetingSeal))
        {
            e.MeetingOpenAt = now;
            changed = true;
        }
        if (changed) Announce(b);
    }

    public async Task<EncounterView> GetAsync(Guid me, Guid bondId, CancellationToken ct = default)
    {
        var b = await db.Set<Bond>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == bondId, ct);
        if (b is null || !b.Has(me)) throw new DomainException(404, "bond.not_found", "That bond does not exist");
        var e = await db.Set<Encounter>().AsNoTracking().SingleOrDefaultAsync(x => x.BondId == bondId, ct);
        if (b.State == BondState.Live && Behind(b, e))
        {
            // A bond whose seals broke before its steps existed (or before a threshold was lowered).
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var (locked, _) = await LockAsync(me, bondId, ct);
            await OnSealAsync(locked, ct);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            db.ChangeTracker.Clear();
            e = await db.Set<Encounter>().AsNoTracking().SingleOrDefaultAsync(x => x.BondId == bondId, ct);
        }
        return await ViewAsync(b, e, me, ct);
    }

    private bool Behind(Bond b, Encounter? e) =>
        (e?.IcebreakerOpenAt is null && b.Seals >= config.Int(ConfigKeys.IcebreakerSeal))
        || (e?.TrialOpenAt is null && b.Seals >= config.Int(ConfigKeys.TrialSeal))
        || (e?.MeetingOpenAt is null && b.Seals >= config.Int(ConfigKeys.MeetingSeal));

    public async Task<EncounterView> AnswerIcebreakerAsync(Guid me, Guid bondId, string text, CancellationToken ct = default)
    {
        text = text.Trim();
        if (text.Length == 0) throw new DomainException(400, "icebreaker.empty", "Write your answer first");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var (b, e) = await LockAsync(me, bondId, ct);
        if (e?.IcebreakerOpenAt is null) throw new DomainException(409, "icebreaker.closed", "The icebreaker has not opened yet");
        var isA = b.AId == me;
        if ((isA ? e.IcebreakerA : e.IcebreakerB) is not null)
            throw new DomainException(409, "icebreaker.answered", "Your answer is already sealed");
        if (isA) e.IcebreakerA = text; else e.IcebreakerB = text;
        if (e.IcebreakerA is not null && e.IcebreakerB is not null)
        {
            e.IcebreakerRevealedAt = clock.UtcNow;
            await db.SaveChangesAsync(ct);
            foreach (var who in new[] { b.AId, b.BId })
                await score.AwardAsync(who, DeedKinds.Icebreaker, config.Int(ConfigKeys.ScoreIcebreaker), b.Id, ct);
            await campaign.SyncAsync(b, ct);
        }
        Announce(b);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await ViewAsync(b, e, me, ct);
    }

    public async Task<EncounterView> AnswerTrialAsync(Guid me, Guid bondId, int index, int choice, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var (b, e) = await LockAsync(me, bondId, ct);
        if (e?.TrialOpenAt is null || e.TrialIds is null) throw new DomainException(409, "trial.closed", "The Trial has not opened yet");
        var isA = b.AId == me;
        var mine = isA ? e.TrialA : e.TrialB;
        if (mine.Length >= TrialLength) throw new DomainException(409, "trial.answered", "You have answered every question");
        if (index != mine.Length) throw new DomainException(409, "trial.order", "Answer the questions in order");
        if (choice is < 0 or > 3) throw new DomainException(400, "trial.choice", "Choose one of the four");
        var next = mine.Append(choice).ToArray();
        if (isA) e.TrialA = next; else e.TrialB = next;
        if (e.TrialA.Length == TrialLength && e.TrialB.Length == TrialLength)
        {
            e.TrialDoneAt = clock.UtcNow;
            await db.SaveChangesAsync(ct);
            foreach (var who in new[] { b.AId, b.BId })
                await score.AwardAsync(who, DeedKinds.Trial, config.Int(ConfigKeys.ScoreTrial), b.Id, ct);
            await campaign.SyncAsync(b, ct);
        }
        Announce(b);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await ViewAsync(b, e, me, ct);
    }

    /// The bond and its encounter row, both locked; the bond must be live and mine.
    public async Task<(Bond Bond, Encounter? Encounter)> LockAsync(Guid me, Guid bondId, CancellationToken ct)
    {
        var b = await db.Set<Bond>().FromSqlInterpolated($"SELECT * FROM bonds WHERE \"Id\" = {bondId} FOR UPDATE").SingleOrDefaultAsync(ct);
        if (b is null || !b.Has(me)) throw new DomainException(404, "bond.not_found", "That bond does not exist");
        if (b.State != BondState.Live) throw new DomainException(409, "bond.closed", "The letters are closed");
        var e = await db.Set<Encounter>().FromSqlInterpolated($"SELECT * FROM encounters WHERE \"BondId\" = {bondId} FOR UPDATE")
            .SingleOrDefaultAsync(ct);
        return (b, e);
    }

    /// A deed done together (a Rite completed, a meeting kept): its Campaign chamber, if any, clears.
    /// Runs in the caller's transaction.
    public Task ClearChambersAsync(Bond b, CancellationToken ct) => campaign.SyncAsync(b, ct);

    public void Announce(Bond b)
    {
        live.ToAccount(b.AId, LiveKinds.EncounterUpdated, b.Id);
        live.ToAccount(b.BId, LiveKinds.EncounterUpdated, b.Id);
    }

    public bool RiteGates => config.Bool(ConfigKeys.VideoEnabled) && config.Bool(ConfigKeys.VideoRequired);

    /// Whether a meeting may be chosen now, or what still stands in the way (seal | rite).
    public string? MeetingBlocked(Bond b, Encounter? e) =>
        b.Seals < config.Int(ConfigKeys.MeetingSeal) ? "seal"
        : RiteGates && e?.RiteDoneAt is null ? "rite"
        : null;

    public async Task<EncounterView> ViewAsync(Bond b, Encounter? e, Guid me, CancellationToken ct = default)
    {
        var isA = b.AId == me;
        var live = b.State == BondState.Live;

        var locale = e is null ? "en" : await QuestionsMn.LocaleAsync(db, me, ct);
        IcebreakerView? icebreaker = null;
        if (e?.IcebreakerId is { } qid)
        {
            var q = QuestionsMn.In(
                await db.Set<IcebreakerQuestion>().AsNoTracking().Where(x => x.Id == qid).Select(x => x.Text).SingleAsync(ct), locale);
            var revealed = e.IcebreakerRevealedAt is not null;
            icebreaker = new IcebreakerView(q, isA ? e.IcebreakerA : e.IcebreakerB, revealed ? (isA ? e.IcebreakerB : e.IcebreakerA) : null, revealed);
        }

        TrialView? trial = null;
        if (e?.TrialIds is { } tids)
        {
            var rows = await db.Set<TrialQuestion>().AsNoTracking().Where(x => tids.Contains(x.Id)).ToListAsync(ct);
            var qs = tids.Select(id => rows.Single(r => r.Id == id)).ToList();
            var mine = isA ? e.TrialA : e.TrialB;
            var theirs = isA ? e.TrialB : e.TrialA;
            TrialResultView? result = null;
            if (e.TrialDoneAt is not null)
            {
                var same = qs.Where((_, i) => mine[i] == theirs[i]).Select(q => QuestionsMn.In(q.Topic, locale)).ToList();
                var differ = qs.Where((_, i) => mine[i] != theirs[i]).Select(q => QuestionsMn.In(q.Topic, locale)).ToList();
                result = new TrialResultView(same.Count, same.Count * 100 / TrialLength, same, differ, theirs);
            }
            trial = new TrialView(qs.Select(q => new TrialQuestionView(QuestionsMn.In(q.Text, locale),
                    QuestionsMn.In(q.Choices, locale), QuestionsMn.In(q.Hints, locale))).ToList(), mine,
                theirs.Length == TrialLength, result);
        }

        RiteView? rite = null;
        if (config.Bool(ConfigKeys.VideoEnabled) && e?.IcebreakerRevealedAt is not null)
        {
            var call = await db.Set<Call>().AsNoTracking().Where(c => c.BondId == b.Id && c.EndedAt == null)
                .OrderByDescending(c => c.IssuedAt).FirstOrDefaultAsync(ct);
            var minutes = config.Int(ConfigKeys.VideoMinutes);
            var state = e.RiteDoneAt is not null ? "done"
                : e.RiteAcceptedAt is not null ? "accepted"
                : e.RiteBy is { } by && e.RiteDeclinedAt is null ? (by == me ? "proposedByMe" : "proposedByThem")
                : "open";
            DateTimeOffset? wait = state == "open" && e.RiteBy == me && e.RiteDeclinedAt is { } declined
                ? declined.AddHours(config.Int(ConfigKeys.VideoReproposeHours)) : null;
            if (wait <= clock.UtcNow) wait = null;
            rite = new RiteView(state, wait, config.Bool(ConfigKeys.VideoRequired),
                call is null ? null : new CallView(call.Id, call.IssuedAt, call.BothAt?.AddMinutes(minutes), false, call.Completed));
        }

        MeetingStepView? meeting = null;
        var kept = false;
        if (e?.MeetingOpenAt is not null)
        {
            // The one under way, else the last one closed (it may still be owed a rating); never one called off.
            var current = await db.Set<Meeting>().AsNoTracking()
                .Where(m => m.BondId == b.Id && m.State != MeetingState.CalledOff)
                .OrderBy(m => m.State == MeetingState.Closed).ThenByDescending(m => m.CreatedAt).FirstOrDefaultAsync(ct);
            kept = await db.Set<Meeting>().AnyAsync(m => m.BondId == b.Id && m.Outcome == MeetingOutcome.Kept, ct);
            MeetingView? view = null;
            if (current is not null)
            {
                var canRate = current.Outcome == MeetingOutcome.Kept && !await venues.RatedAsync(current.Id, me, ct);
                if (current.State != MeetingState.Closed || canRate) view = await MeetingViewAsync(current, b, me, canRate, ct);
            }
            var blocked = live ? MeetingBlocked(b, e) : "closed";
            meeting = new MeetingStepView(blocked is null, blocked, view);
        }

        // What the other person asked of me comes first, then my own steps in order.
        string? next = null;
        if (meeting?.Current is { State: "Checking", MyAnswer: null }) next = "attendance";
        else if (!live) next = null;
        else if (rite is { State: "proposedByThem" }) next = "rite";
        else if (meeting?.Current is { State: "Proposed", MyPledge: false }) next = "meeting";
        else if (icebreaker is { Revealed: false }) next = "icebreaker";
        else if (trial is { Result: null }) next = "trial";
        else if (rite is { } r && r.State != "done") next = "rite";
        else if (meeting is { Open: true } m && !kept && m.Current?.State is null or "Proposed" or "Sworn") next = "meeting";
        else if (meeting?.Current is { CanRate: true }) next = "rate";
        return new EncounterView(next, icebreaker, trial, rite, meeting, new EncounterRewards(
            config.Int(ConfigKeys.ScoreIcebreaker), config.Int(ConfigKeys.ScoreTrial), config.Int(ConfigKeys.ScoreRite),
            config.Int(ConfigKeys.ScoreMeeting), config.Int(ConfigKeys.ScoreOathProven)));
    }

    public async Task<MeetingView> MeetingViewAsync(Meeting m, Bond b, Guid me, bool canRate, CancellationToken ct)
    {
        var isA = b.AId == me;
        var venue = await venues.GetAsync(m.VenueId, ct);
        return new MeetingView(m.Id, venue, m.At, m.ProposedBy == me, isA ? m.PledgeA : m.PledgeB, isA ? m.PledgeB : m.PledgeA,
            m.State.ToString(), m.CheckUntil, (isA ? m.AnswerA : m.AnswerB)?.ToString(), m.Outcome?.ToString(), canRate);
    }
}
