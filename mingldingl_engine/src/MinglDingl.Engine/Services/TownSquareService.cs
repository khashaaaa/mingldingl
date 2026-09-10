using Microsoft.EntityFrameworkCore;

public class TownSquareService
{
    private readonly AppDbContext _db;
    private readonly SupabaseBroadcastService _broadcast;
    private readonly PushNotificationService _push;
    private readonly ILogger<TownSquareService> _logger;
    private readonly ConfigService _config;

    public TownSquareService(AppDbContext db, SupabaseBroadcastService broadcast, PushNotificationService push, ILogger<TownSquareService> logger, ConfigService config)
    {
        _db = db;
        _broadcast = broadcast;
        _push = push;
        _logger = logger;
        _config = config;
    }

    /// <summary>Town Square is live video, so it is closed whenever video is: nothing may mint an Agora token while <c>video.enabled</c> is off.</summary>
    public bool IsEnabled => _config.GetBool("townsquare.enabled", true) && _config.GetBool("video.enabled", true);
    public int MaxPerSide => Math.Max(1, (int)_config.GetNumber("townsquare.max_per_side", 5));
    public int RoundDurationSeconds => Math.Max(30, (int)_config.GetNumber("townsquare.round_seconds", 240));

    public async Task RsvpAsync(Guid sessionId, Guid userId)
    {
        var session = await _db.TownSquareSessions.FindAsync(sessionId);
        if (session is null || session.Status != "Open")
            throw new DomainException("Session is not open for RSVP", "square.rsvp_closed");

        // A session is created Open, so without this the admin's RSVP-opens date did nothing at
        // all and the roster could fill days before the window it advertises.
        if (session.RsvpOpensAt > DateTime.UtcNow)
            throw new DomainException("RSVP has not opened for this session yet", "square.rsvp_not_open");

        bool exists = await _db.TownSquareRsvps.AnyAsync(r => r.SessionId == sessionId && r.UserId == userId);
        if (exists) return;

        _db.TownSquareRsvps.Add(new TownSquareRsvp { SessionId = sessionId, UserId = userId });
        await _db.SaveChangesAsync();
    }

    public async Task CancelRsvpAsync(Guid sessionId, Guid userId)
    {
        var session = await _db.TownSquareSessions.FindAsync(sessionId);
        if (session is null || session.Status != "Open")
            throw new DomainException("Session is not open for RSVP changes", "square.rsvp_locked");

        var rsvp = await _db.TownSquareRsvps.FirstOrDefaultAsync(r => r.SessionId == sessionId && r.UserId == userId);
        if (rsvp is null) return;

        _db.TownSquareRsvps.Remove(rsvp);
        await _db.SaveChangesAsync();
    }

    public async Task LockRosterAsync(Guid sessionId)
    {
        var session = await _db.TownSquareSessions.FindAsync(sessionId);
        if (session is null || session.Status != "Open") return;

        // An RSVP is only as good as the account behind it at lock time. Someone banned, paused or
        // pending deletion since they signed up would otherwise hold a seat nobody can sit in — and
        // seats are the scarce thing here, capped at MaxPerSide a side.
        var rsvps = await (
            from r in _db.TownSquareRsvps
            join u in _db.Users on r.UserId equals u.Id
            where r.SessionId == sessionId
                && u.DeletionRequestedAt == null && !u.IsBanned && !u.IsPaused
            orderby r.RsvpAt
            select new { u.Id, u.Gender }
        ).ToListAsync();

        var men = rsvps.Where(u => u.Gender == "Male").Select(u => u.Id).Take(MaxPerSide).ToList();
        var women = rsvps.Where(u => u.Gender == "Female").Select(u => u.Id).Take(MaxPerSide).ToList();
        int n = Math.Min(men.Count, women.Count);

        if (n == 0)
        {
            await CancelAsync(session);
            return;
        }

        men = men.Take(n).ToList();
        women = women.Take(n).ToList();

        var icebreakers = await _db.Icebreakers.Where(i => i.IsActive).ToListAsync();
        if (icebreakers.Count == 0)
        {
            // Nothing to talk about, so the session cannot run. Cancelling tells the roster;
            // leaving it Open would hand the scheduler a session it retries — and crashes on —
            // every sweep, taking every other session on the instance down with it.
            _logger.LogError(
                "Town Square session {SessionId} cancelled: no active icebreakers exist", sessionId);
            await CancelAsync(session);
            return;
        }

        var rounds = GenerateRoundRobin(men, women);

        // A block has to mean "never in front of me again". The round-robin sits every man opposite
        // every woman, so without this the person someone blocked was seated across from them for a
        // whole round — the pair check further down only refused the *match* afterwards, long after
        // the encounter it was supposed to prevent. The pairing is dropped rather than reshuffled:
        // both sit that one round out, and every other pairing keeps the meet-everyone-once
        // property the rotation exists for.
        var rosterIds = men.Concat(women).ToList();
        var blockedPairs = await _db.BlockedUsers.AsNoTracking()
            .Where(bl => rosterIds.Contains(bl.BlockerId) && rosterIds.Contains(bl.BlockedId))
            .Select(bl => new { bl.BlockerId, bl.BlockedId })
            .ToListAsync();
        if (blockedPairs.Count > 0)
        {
            var blocked = new HashSet<(Guid, Guid)>();
            foreach (var pair in blockedPairs)
            {
                blocked.Add((pair.BlockerId, pair.BlockedId));
                blocked.Add((pair.BlockedId, pair.BlockerId));
            }
            for (int r = 0; r < rounds.Count; r++)
                rounds[r] = rounds[r].Where(p => !blocked.Contains((p.UserAId, p.UserBId))).ToList();
        }

        for (int r = 0; r < rounds.Count; r++)
        {
            var round = new TownSquareRound
            {
                SessionId = sessionId,
                RoundNumber = r + 1,
                IcebreakerId = icebreakers[r % icebreakers.Count].Id,
                StartsAt = session.ScheduledStartAt.AddSeconds(r * RoundDurationSeconds),
                DurationSeconds = RoundDurationSeconds,
            };
            _db.TownSquareRounds.Add(round);

            foreach (var (userAId, userBId) in rounds[r])
            {
                _db.TownSquarePairings.Add(new TownSquarePairing
                {
                    Round = round,
                    UserAId = userAId,
                    UserBId = userBId,
                });
            }
        }

        session.Status = "Locked";
        await _db.SaveChangesAsync();
    }

    public async Task<bool> CancelSessionAsync(Guid sessionId)
    {
        var session = await _db.TownSquareSessions.FindAsync(sessionId);
        if (session is null || session.Status is not ("Open" or "Locked")) return false;

        await CancelAsync(session);
        return true;
    }

    private async Task CancelAsync(TownSquareSession session)
    {
        session.Status = "Cancelled";
        await _db.SaveChangesAsync();

        await _broadcast.BroadcastAsync($"townsquare:{session.Id}", "session-cancelled", new { sessionId = session.Id, roundNumber = session.CurrentRoundNumber, status = session.Status });
    }

    public async Task StartSessionAsync(Guid sessionId)
    {
        var session = await _db.TownSquareSessions.FindAsync(sessionId);
        if (session is null || session.Status != "Locked") return;

        session.Status = "InProgress";
        session.CurrentRoundNumber = 1;
        await _db.SaveChangesAsync();

        // The roster is whoever LockRosterAsync paired into this session; RSVPs it turned away are
        // not on it. Read across every round, not just the first: a pairing dropped because the two
        // have blocked each other leaves both of them unpaired in that one round, and reading round
        // one alone then never told them the gathering had started.
        var rostered = await (
            from p in _db.TownSquarePairings
            join r in _db.TownSquareRounds on p.RoundId equals r.Id
            where r.SessionId == sessionId
            select new[] { p.UserAId, p.UserBId }
        ).ToListAsync();
        var startData = new Dictionary<string, object> { ["sessionId"] = sessionId.ToString() };
        foreach (var userId in rostered.SelectMany(pair => pair).Distinct())
            await _push.NotifyUserAsync(userId, PushKind.TownSquareStarting, startData);

        await _broadcast.BroadcastAsync($"townsquare:{sessionId}", "session-started", new { sessionId, roundNumber = session.CurrentRoundNumber, status = session.Status });
    }

    public async Task AdvanceRoundAsync(Guid sessionId)
    {
        var session = await _db.TownSquareSessions.FindAsync(sessionId);
        if (session is null || session.Status != "InProgress") return;

        int roundCount = await _db.TownSquareRounds.CountAsync(r => r.SessionId == sessionId);
        if (session.CurrentRoundNumber >= roundCount)
            session.Status = "Completed";
        else
            session.CurrentRoundNumber++;

        await _db.SaveChangesAsync();

        await _broadcast.BroadcastAsync($"townsquare:{sessionId}", "round-advanced", new { sessionId, roundNumber = session.CurrentRoundNumber, status = session.Status });
    }

    public async Task MarkJoinedAsync(Guid pairingId, Guid userId)
    {
        var pairing = await _db.TownSquarePairings.FindAsync(pairingId);
        if (pairing is null || !pairing.IsParticipant(userId)) return;

        if (pairing.UserAId == userId)
            pairing.UserAJoinedAt = DateTime.UtcNow;
        else
            pairing.UserBJoinedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
    }

    public async Task<Guid?> RespondToPairingAsync(Guid pairingId, Guid userId, string response)
    {
        if (response != "Yes" && response != "No")
            throw new DomainException("Response must be Yes or No", "square.response_invalid");

        // The session comes along for the ride because a pairing outlives its session's status. An
        // admin may cancel a *Locked* session, and a Locked session already has its pairings — so
        // without this check both sides of a gathering that never ran could still answer Yes and
        // walk away with a real match.
        var lookup = await (
            from p in _db.TownSquarePairings.AsNoTracking()
            join r in _db.TownSquareRounds on p.RoundId equals r.Id
            join sess in _db.TownSquareSessions on r.SessionId equals sess.Id
            where p.Id == pairingId
            select new { p.UserAId, p.UserBId, SessionStatus = sess.Status }
        ).FirstOrDefaultAsync();
        if (lookup is null || (lookup.UserAId != userId && lookup.UserBId != userId))
            throw DomainException.Forbidden("Not a participant in this pairing", "square.not_participant");

        // A late answer is fine — people decide in their own time, and a locked session is simply
        // one that has not started yet. A cancelled one is different: it never ran, so nothing that
        // happened in it may become a match.
        if (lookup.SessionStatus == "Cancelled")
            throw new DomainException("Session is not in progress", "square.not_in_progress");

        bool isUserA = lookup.UserAId == userId;

        var updated = isUserA
            ? await _db.Database.SqlQuery<PairingResponseRow>(
                $"""
                UPDATE "TownSquarePairings" SET "UserAResponse" = {response}
                WHERE "Id" = {pairingId}
                RETURNING "UserAResponse", "UserBResponse", "UserAId", "UserBId", "ResultingMatchId"
                """).ToListAsync()
            : await _db.Database.SqlQuery<PairingResponseRow>(
                $"""
                UPDATE "TownSquarePairings" SET "UserBResponse" = {response}
                WHERE "Id" = {pairingId}
                RETURNING "UserAResponse", "UserBResponse", "UserAId", "UserBId", "ResultingMatchId"
                """).ToListAsync();
        // The row can be gone by now. Both sibling RETURNING call sites check this; indexing
        // straight into an empty list turned a vanished pairing into a logged 500.
        if (updated.Count == 0)
            throw DomainException.Forbidden("Not a participant in this pairing", "square.not_participant");
        var row = updated[0];

        if (row.UserAResponse != "Yes" || row.UserBResponse != "Yes" || row.ResultingMatchId is not null)
            return row.ResultingMatchId;

        if (await MatchPairing.IsPairBlockedAsync(_db, row.UserAId, row.UserBId))
            return null;

        // Weeks can separate the gathering from the answer, and this was the one remaining path
        // that went straight from "both said yes" to a Match without re-reading the rule discovery,
        // POST /matches and a woven thread all obey. Someone banned, paused or pending deletion
        // since the round still walked away with a live conversation.
        if (!await MatchPairing.AreBothEligibleAsync(_db, row.UserAId, row.UserBId))
            return null;

        var (matchId, created) = await CreateOrReuseMatchAsync(row.UserAId, row.UserBId);
        await _db.Database.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "TownSquarePairings" SET "ResultingMatchId" = {matchId} WHERE "Id" = {pairingId} AND "ResultingMatchId" IS NULL""");

        if (created)
        {
            var pushData = new Dictionary<string, object> { ["matchId"] = matchId.ToString() };
            await _push.NotifyUserAsync(row.UserAId, PushKind.TownSquareMatch, pushData);
            await _push.NotifyUserAsync(row.UserBId, PushKind.TownSquareMatch, pushData);
            await _broadcast.BroadcastAsync("app-nudges", "match_created",
                new { matchId, userIds = new[] { row.UserAId, row.UserBId }, source = "townsquare" });
        }

        return matchId;
    }

    private sealed class PairingResponseRow
    {
        public string? UserAResponse { get; set; }
        public string? UserBResponse { get; set; }
        public Guid UserAId { get; set; }
        public Guid UserBId { get; set; }
        public Guid? ResultingMatchId { get; set; }
    }

    private async Task<(Guid MatchId, bool Created)> CreateOrReuseMatchAsync(Guid userAId, Guid userBId)
    {
        var existing = await _db.Matches.FirstOrDefaultAsync(m =>
            (m.InitiatorId == userAId && m.ReceiverId == userBId) ||
            (m.InitiatorId == userBId && m.ReceiverId == userAId));
        if (existing is not null) return (existing.Id, false);

        return await _db.InTransactionAsync(async () =>
        {
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock({MatchPairing.PairLockKey(userAId, userBId)})");

            var lockedExisting = await _db.Matches.FirstOrDefaultAsync(m =>
                (m.InitiatorId == userAId && m.ReceiverId == userBId) ||
                (m.InitiatorId == userBId && m.ReceiverId == userAId));
            if (lockedExisting is not null) return (lockedExisting.Id, false);

            var match = MatchPairing.NewMatch(userAId, userBId);
            _db.Matches.Add(match);
            await _db.SaveChangesAsync();
            return (match.Id, true);
        });
    }

    public static List<List<(Guid UserAId, Guid UserBId)>> GenerateRoundRobin(List<Guid> men, List<Guid> women)
    {
        if (men.Count != women.Count)
            throw new ArgumentException("Men and women counts must match for a full round-robin.");

        int n = men.Count;
        var rounds = new List<List<(Guid UserAId, Guid UserBId)>>();
        for (int round = 0; round < n; round++)
        {
            var pairs = new List<(Guid UserAId, Guid UserBId)>();
            for (int i = 0; i < n; i++)
                pairs.Add((men[i], women[(i + round) % n]));
            rounds.Add(pairs);
        }
        return rounds;
    }
}
