using System.Globalization;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Features.Venues;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Kernel.Push;

namespace MinglDingl.Engine.Features.Encounters;

/// Meetings: proposing a place and time, pledging, calling off, "Did they come?", and what a kept
/// meeting earns (a rating, and the Oath proven).
public sealed class MeetingService(
    AppDb db, IClock clock, IConfig config, ILiveOutbox live, IPushOutbox push, ScoreService score,
    EncounterService encounters, VenueService venues)
{
    public static readonly TimeSpan Earliest = TimeSpan.FromHours(2);
    public static readonly TimeSpan Latest = TimeSpan.FromDays(30);
    private static readonly TimeSpan UbOffset = TimeSpan.FromHours(8);

    private static readonly MeetingState[] Underway = [MeetingState.Proposed, MeetingState.Sworn, MeetingState.Checking];

    /// A new proposal is the proposer's pledge. One that answers an open proposal replaces it
    /// ("suggest another time"); a sworn meeting must be called off first.
    public async Task<EncounterView> ProposeAsync(Guid me, Guid bondId, Guid venueId, DateTimeOffset at, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var (b, e) = await encounters.LockAsync(me, bondId, ct);
        switch (e?.MeetingOpenAt is null ? "seal" : encounters.MeetingBlocked(b, e))
        {
            case "seal": throw new DomainException(409, "meeting.seal", "Write more letters before you choose a meeting");
            case "rite": throw new DomainException(409, "meeting.rite", "Complete the Flame Rite before you pledge to meet");
        }
        if (!await venues.OpenAsync(venueId, ct)) throw new DomainException(409, "meeting.venue_gone", "This place is gone — choose another");
        var now = clock.UtcNow;
        if (at < now + Earliest || at > now + Latest)
            throw new DomainException(400, "meeting.time", "Choose a time from two hours to thirty days from now");

        var current = await CurrentAsync(b.Id, ct);
        if (current is { State: MeetingState.Sworn or MeetingState.Checking })
            throw new DomainException(409, "meeting.sworn", "A meeting is already sworn — call it off first");
        if (current is not null)
        {
            current.State = MeetingState.CalledOff;
            current.CalledOffAt = now;
            current.CalledOffBy = me;
        }
        var isA = b.AId == me;
        var m = new Meeting
        {
            BondId = b.Id, VenueId = venueId, At = at, ProposedBy = me, PledgeA = isA, PledgeB = !isA,
            State = MeetingState.Proposed, CreatedAt = now,
        };
        db.Add(m);
        encounters.Announce(b);
        push.Send(b.Other(me), PushKinds.MeetingProposed, b.Id, await NameAsync(me, ct), await WhereWhenAsync(m, ct));
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await encounters.ViewAsync(b, e, me, ct);
    }

    /// The other side's pledge swears the meeting: points to both, told live and by push.
    public async Task<EncounterView> PledgeAsync(Guid me, Guid bondId, Guid meetingId, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var (b, e) = await encounters.LockAsync(me, bondId, ct);
        var m = await MeetingAsync(b, meetingId, ct);
        if (m.State != MeetingState.Proposed) throw new DomainException(409, "meeting.not_open", "That meeting is no longer open");
        if (!await venues.OpenAsync(m.VenueId, ct)) throw new DomainException(409, "meeting.venue_gone", "This place is gone — choose another");
        if (m.At <= clock.UtcNow) throw new DomainException(409, "meeting.started", "That time has passed");
        if (b.AId == me) m.PledgeA = true; else m.PledgeB = true;
        if (m.PledgeA && m.PledgeB)
        {
            m.State = MeetingState.Sworn;
            m.SwornAt = clock.UtcNow;
            await db.SaveChangesAsync(ct);
            foreach (var who in new[] { b.AId, b.BId })
                await score.AwardAsync(who, DeedKinds.Meeting, config.Int(ConfigKeys.ScoreMeeting), b.Id, ct);
            push.Send(b.Other(me), PushKinds.MeetingSworn, b.Id, await NameAsync(me, ct), await WhereWhenAsync(m, ct));
        }
        encounters.Announce(b);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await encounters.ViewAsync(b, e, me, ct);
    }

    /// Withdraw a proposal, or call off a sworn meeting before it starts — no penalty either way.
    public async Task<EncounterView> CallOffAsync(Guid me, Guid bondId, Guid meetingId, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var (b, e) = await encounters.LockAsync(me, bondId, ct);
        var m = await MeetingAsync(b, meetingId, ct);
        if (m.State is not (MeetingState.Proposed or MeetingState.Sworn))
            throw new DomainException(409, "meeting.not_open", "That meeting is no longer open");
        if (m.State == MeetingState.Sworn && m.At <= clock.UtcNow)
            throw new DomainException(409, "meeting.started", "The meeting has already begun");
        var sworn = m.State == MeetingState.Sworn;
        m.State = MeetingState.CalledOff;
        m.CalledOffAt = clock.UtcNow;
        m.CalledOffBy = me;
        if (sworn) push.Send(b.Other(me), PushKinds.MeetingCalledOff, b.Id, await NameAsync(me, ct), await WhereWhenAsync(m, ct));
        encounters.Announce(b);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await encounters.ViewAsync(b, e, me, ct);
    }

    /// "Did they come?" Private to each side; settled once both answered (or the window closes).
    public async Task<EncounterView> AnswerAsync(Guid me, Guid bondId, Guid meetingId, string answer, CancellationToken ct = default)
    {
        if (!Enum.TryParse<AttendanceAnswer>(answer, ignoreCase: false, out var a) || !Enum.IsDefined(a))
            throw new DomainException(400, "attendance.answer", "Choose one answer");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var (b, e) = await LockAnyAsync(me, bondId, ct);
        var m = await MeetingAsync(b, meetingId, ct);
        if (m.State != MeetingState.Checking) throw new DomainException(409, "attendance.closed", "That question is closed");
        var isA = b.AId == me;
        if ((isA ? m.AnswerA : m.AnswerB) is not null) throw new DomainException(409, "attendance.answered", "You already answered");
        if (isA) m.AnswerA = a; else m.AnswerB = a;
        if (m.AnswerA is not null && m.AnswerB is not null) await ResolveAsync(m, b, ct);
        encounters.Announce(b);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await encounters.ViewAsync(b, e, me, ct);
    }

    public async Task<EncounterView> RateAsync(Guid me, Guid bondId, Guid meetingId, int stars, CancellationToken ct = default)
    {
        var b = await db.Set<Bond>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == bondId, ct);
        if (b is null || !b.Has(me)) throw new DomainException(404, "bond.not_found", "That bond does not exist");
        var m = await db.Set<Meeting>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == meetingId && x.BondId == bondId, ct)
            ?? throw new DomainException(404, "meeting.not_found", "That meeting does not exist");
        if (m.Outcome != MeetingOutcome.Kept) throw new DomainException(409, "venue.not_kept", "Only a kept meeting can rate its place");
        encounters.Announce(b); // flushed when the rating saves
        await venues.RateAsync(m.VenueId, m.Id, me, stars, ct);
        var e = await db.Set<Encounter>().AsNoTracking().SingleOrDefaultAsync(x => x.BondId == bondId, ct);
        return await encounters.ViewAsync(b, e, me, ct);
    }

    /// The sweep's turn: sworn meetings past their time are asked about; asked ones past their
    /// window are settled; proposals no one pledged to lapse. Returns how many changed.
    public async Task<int> SweepOneAsync(Guid meetingId, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var m = await db.Set<Meeting>().FromSqlInterpolated($"SELECT * FROM meetings WHERE \"Id\" = {meetingId} FOR UPDATE SKIP LOCKED")
            .SingleOrDefaultAsync(ct);
        if (m is null) return 0;
        var b = await db.Set<Bond>().SingleAsync(x => x.Id == m.BondId, ct);
        var now = clock.UtcNow;
        switch (m.State)
        {
            case MeetingState.Proposed when m.At <= now:
                m.State = MeetingState.CalledOff;
                m.CalledOffAt = now;
                break;
            case MeetingState.Sworn when b.State != BondState.Live:
                m.State = MeetingState.CalledOff;
                m.CalledOffAt = now;
                break;
            case MeetingState.Sworn when m.At.AddHours(config.Int(ConfigKeys.AttendanceAfterHours)) <= now:
                m.State = MeetingState.Checking;
                m.CheckUntil = now.AddHours(config.Int(ConfigKeys.AttendanceWindowHours));
                var names = await db.Set<Profile.Profile>().Where(p => p.AccountId == b.AId || p.AccountId == b.BId)
                    .ToDictionaryAsync(p => p.AccountId, p => p.Name, ct);
                push.Send(b.AId, PushKinds.Attendance, b.Id, names.GetValueOrDefault(b.BId));
                push.Send(b.BId, PushKinds.Attendance, b.Id, names.GetValueOrDefault(b.AId));
                break;
            case MeetingState.Checking when m.CheckUntil <= now:
                await ResolveAsync(m, b, ct);
                break;
            default:
                return 0;
        }
        encounters.Announce(b);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return 1;
    }

    /// Meetings the sweep should look at now.
    public async Task<List<Guid>> DueAsync(CancellationToken ct = default)
    {
        var now = clock.UtcNow;
        var asked = now.AddHours(-config.Int(ConfigKeys.AttendanceAfterHours));
        return await db.Set<Meeting>().AsNoTracking()
            .Where(m => (m.State == MeetingState.Proposed && m.At <= now)
                || (m.State == MeetingState.Sworn && m.At <= asked)
                || (m.State == MeetingState.Checking && m.CheckUntil <= now))
            .Select(m => m.Id).Take(500).ToListAsync(ct);
    }

    /// The outcome table (stage 4 spec): both met → kept; "they did not come" against silence →
    /// a no-show; against any other answer but "I could not go" → disputed; "I could not go" →
    /// excused; anything else → unanswered. No one is penalised for a disagreement.
    private async Task ResolveAsync(Meeting m, Bond b, CancellationToken ct)
    {
        var now = clock.UtcNow;
        (m.Outcome, m.NoShowOf) = (m.AnswerA, m.AnswerB) switch
        {
            (AttendanceAnswer.Met, AttendanceAnswer.Met) => (MeetingOutcome.Kept, (Guid?)null),
            (AttendanceAnswer.NoShow, null) => (MeetingOutcome.NoShow, b.BId),
            (null, AttendanceAnswer.NoShow) => (MeetingOutcome.NoShow, b.AId),
            (AttendanceAnswer.NoShow, AttendanceAnswer.CouldNotGo) or (AttendanceAnswer.CouldNotGo, AttendanceAnswer.NoShow) => (MeetingOutcome.Excused, null),
            (AttendanceAnswer.NoShow, _) or (_, AttendanceAnswer.NoShow) => (MeetingOutcome.Disputed, null),
            (AttendanceAnswer.CouldNotGo, _) or (_, AttendanceAnswer.CouldNotGo) => (MeetingOutcome.Excused, null),
            _ => (MeetingOutcome.Unanswered, null),
        };
        m.State = MeetingState.Closed;
        m.ClosedAt = now;
        await db.SaveChangesAsync(ct);

        if (m.NoShowOf is { } absent)
        {
            var since = now.AddDays(-config.Int(ConfigKeys.AttendanceNoShowDays));
            var count = await db.Set<Meeting>().CountAsync(x => x.NoShowOf == absent && x.ClosedAt >= since, ct);
            if (count >= config.Int(ConfigKeys.AttendanceNoShowsToDock))
                await score.DockAsync(absent, config.Int(ConfigKeys.ReputationNoShow), ct);
            live.ToAdmins(LiveKinds.UserUpdated, absent);
        }
        if (m.Outcome == MeetingOutcome.Kept)
        {
            foreach (var who in new[] { b.AId, b.BId }) await ProveOathAsync(who, ct);
            await encounters.ClearChambersAsync(b, ct);
        }
    }

    private async Task ProveOathAsync(Guid who, CancellationToken ct)
    {
        var p = await db.Set<Profile.Profile>().SingleAsync(x => x.AccountId == who, ct);
        if (p.Oath is null || p.OathProvenAt is not null) return;
        var kept = await db.Set<Meeting>().CountAsync(m => m.Outcome == MeetingOutcome.Kept
            && db.Set<Bond>().Any(b => b.Id == m.BondId && (b.AId == who || b.BId == who)), ct);
        if (kept < config.Int(ConfigKeys.OathProvenEncounters)) return;
        p.OathProvenAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        await score.AwardAsync(who, DeedKinds.OathProven, config.Int(ConfigKeys.ScoreOathProven), null, ct);
        live.ToAccount(who, LiveKinds.ProfileUpdated, who);
    }

    public async Task<Admin.AdminEncounters> AdminStatsAsync(Guid accountId, CancellationToken ct = default)
    {
        var mine = db.Set<Meeting>().AsNoTracking()
            .Where(m => db.Set<Bond>().Any(b => b.Id == m.BondId && (b.AId == accountId || b.BId == accountId)));
        var since = clock.UtcNow.AddDays(-config.Int(ConfigKeys.AttendanceNoShowDays));
        return new Admin.AdminEncounters(
            await mine.CountAsync(m => m.Outcome == MeetingOutcome.Kept, ct),
            await mine.CountAsync(m => m.NoShowOf == accountId, ct),
            await mine.CountAsync(m => m.NoShowOf == accountId && m.ClosedAt >= since, ct),
            await mine.CountAsync(m => m.Outcome == MeetingOutcome.Disputed, ct));
    }

    /// The bond, locked, whatever its state: "Did they come?" may outlive the bond's letters.
    private async Task<(Bond, Encounter?)> LockAnyAsync(Guid me, Guid bondId, CancellationToken ct)
    {
        var b = await db.Set<Bond>().FromSqlInterpolated($"SELECT * FROM bonds WHERE \"Id\" = {bondId} FOR UPDATE").SingleOrDefaultAsync(ct);
        if (b is null || !b.Has(me)) throw new DomainException(404, "bond.not_found", "That bond does not exist");
        var e = await db.Set<Encounter>().SingleOrDefaultAsync(x => x.BondId == bondId, ct);
        return (b, e);
    }

    private Task<Meeting?> CurrentAsync(Guid bondId, CancellationToken ct) =>
        db.Set<Meeting>().Where(m => m.BondId == bondId && Underway.Contains(m.State)).OrderByDescending(m => m.CreatedAt)
            .FirstOrDefaultAsync(ct);

    private async Task<Meeting> MeetingAsync(Bond b, Guid meetingId, CancellationToken ct) =>
        await db.Set<Meeting>().FromSqlInterpolated($"SELECT * FROM meetings WHERE \"Id\" = {meetingId} FOR UPDATE")
            .SingleOrDefaultAsync(x => x.BondId == b.Id, ct)
        ?? throw new DomainException(404, "meeting.not_found", "That meeting does not exist");

    private async Task<string> WhereWhenAsync(Meeting m, CancellationToken ct)
    {
        var venue = await venues.FindAsync(m.VenueId, ct);
        var when = m.At.ToOffset(UbOffset).ToString("ddd d MMM, HH:mm", CultureInfo.InvariantCulture);
        return $"{venue?.Name}, {when}";
    }

    private Task<string> NameAsync(Guid id, CancellationToken ct) =>
        db.Set<Profile.Profile>().Where(p => p.AccountId == id).Select(p => p.Name).SingleAsync(ct);
}
