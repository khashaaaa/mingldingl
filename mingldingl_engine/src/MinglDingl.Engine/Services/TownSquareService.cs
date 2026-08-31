using Microsoft.EntityFrameworkCore;

public class TownSquareService
{
    public const int MaxPerSide = 5;
    public const int RoundDurationSeconds = 240;

    private readonly AppDbContext _db;
    private readonly SupabaseBroadcastService _broadcast;
    private readonly PushNotificationService _push;

    public TownSquareService(AppDbContext db, SupabaseBroadcastService broadcast, PushNotificationService push)
    {
        _db = db;
        _broadcast = broadcast;
        _push = push;
    }

    public async Task RsvpAsync(Guid sessionId, Guid userId)
    {
        var session = await _db.TownSquareSessions.FindAsync(sessionId);
        if (session is null || session.Status != "Open")
            throw new InvalidOperationException("Session is not open for RSVP");

        bool exists = await _db.TownSquareRsvps.AnyAsync(r => r.SessionId == sessionId && r.UserId == userId);
        if (exists) return;

        _db.TownSquareRsvps.Add(new TownSquareRsvp { SessionId = sessionId, UserId = userId });
        await _db.SaveChangesAsync();
    }

    public async Task CancelRsvpAsync(Guid sessionId, Guid userId)
    {
        var session = await _db.TownSquareSessions.FindAsync(sessionId);
        if (session is null || session.Status != "Open")
            throw new InvalidOperationException("Session is not open for RSVP changes");

        var rsvp = await _db.TownSquareRsvps.FirstOrDefaultAsync(r => r.SessionId == sessionId && r.UserId == userId);
        if (rsvp is null) return;

        _db.TownSquareRsvps.Remove(rsvp);
        await _db.SaveChangesAsync();
    }

    public async Task LockRosterAsync(Guid sessionId)
    {
        var session = await _db.TownSquareSessions.FindAsync(sessionId);
        if (session is null || session.Status != "Open") return;

        var rsvps = await (
            from r in _db.TownSquareRsvps
            join u in _db.Users on r.UserId equals u.Id
            where r.SessionId == sessionId
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
        var rounds = GenerateRoundRobin(men, women);

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
            throw new ArgumentException("Response must be Yes or No", nameof(response));

        var lookup = await _db.TownSquarePairings.AsNoTracking().FirstOrDefaultAsync(p => p.Id == pairingId);
        if (lookup is null || !lookup.IsParticipant(userId))
            throw new InvalidOperationException("Not a participant in this pairing");

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
        var row = updated[0];

        if (row.UserAResponse != "Yes" || row.UserBResponse != "Yes" || row.ResultingMatchId is not null)
            return row.ResultingMatchId;

        if (await MatchPairing.IsPairBlockedAsync(_db, row.UserAId, row.UserBId))
            return null;

        var (matchId, created) = await CreateOrReuseMatchAsync(row.UserAId, row.UserBId);
        await _db.Database.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "TownSquarePairings" SET "ResultingMatchId" = {matchId} WHERE "Id" = {pairingId} AND "ResultingMatchId" IS NULL""");

        if (created)
        {
            var pushData = new Dictionary<string, object> { ["matchId"] = matchId.ToString(), ["type"] = "match" };
            await _push.NotifyUserAsync(row.UserAId, "New Match!", "You both said yes in the Town Square.", pushData);
            await _push.NotifyUserAsync(row.UserBId, "New Match!", "You both said yes in the Town Square.", pushData);
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

        return await _db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync();
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock({MatchPairing.PairLockKey(userAId, userBId)})");

            var lockedExisting = await _db.Matches.FirstOrDefaultAsync(m =>
                (m.InitiatorId == userAId && m.ReceiverId == userBId) ||
                (m.InitiatorId == userBId && m.ReceiverId == userAId));
            if (lockedExisting is not null)
            {
                await tx.CommitAsync();
                return (lockedExisting.Id, false);
            }

            var match = MatchPairing.NewMatch(userAId, userBId);
            _db.Matches.Add(match);
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
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
