using Microsoft.EntityFrameworkCore;

public class TownSquareService
{
    // v1 cap: a session only ever runs a complete round-robin (every man meets
    // every woman exactly once), so roster size per side is capped at the round
    // count rather than letting a bigger balanced roster force a partial/random
    // subset of partners per person. Demand beyond this runs as a second parallel
    // session, not a bigger one.
    public const int MaxPerSide = 5;
    public const int RoundDurationSeconds = 240;

    private readonly AppDbContext _db;

    public TownSquareService(AppDbContext db)
    {
        _db = db;
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

    // Called once RsvpClosesAt passes. Caps each side at MaxPerSide (first-come
    // by RsvpAt), builds the full round-robin, and materializes every round +
    // pairing up front so round advance is just a status/counter flip, not more
    // roster logic. A session with nobody on one side cancels outright rather
    // than running a zero-round session.
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
            session.Status = "Cancelled";
            await _db.SaveChangesAsync();
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

    public async Task StartSessionAsync(Guid sessionId)
    {
        var session = await _db.TownSquareSessions.FindAsync(sessionId);
        if (session is null || session.Status != "Locked") return;

        session.Status = "InProgress";
        session.CurrentRoundNumber = 1;
        await _db.SaveChangesAsync();
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

    // Records one side's Yes/No; on mutual Yes, creates (or reuses, if these two
    // already matched some other way) a real Match through the same path as any
    // other match — same table, same downstream chat/video/scoring/ghosting
    // behavior. Returns the resulting MatchId if one exists after this call.
    public async Task<Guid?> RespondToPairingAsync(Guid pairingId, Guid userId, string response)
    {
        if (response != "Yes" && response != "No")
            throw new ArgumentException("Response must be Yes or No", nameof(response));

        var pairing = await _db.TownSquarePairings.FindAsync(pairingId);
        if (pairing is null || !pairing.IsParticipant(userId))
            throw new InvalidOperationException("Not a participant in this pairing");

        if (pairing.UserAId == userId)
            pairing.UserAResponse = response;
        else
            pairing.UserBResponse = response;

        if (pairing.UserAResponse == "Yes" && pairing.UserBResponse == "Yes" && pairing.ResultingMatchId is null)
            pairing.ResultingMatchId = await CreateOrReuseMatchAsync(pairing.UserAId, pairing.UserBId);

        await _db.SaveChangesAsync();
        return pairing.ResultingMatchId;
    }

    private async Task<Guid> CreateOrReuseMatchAsync(Guid userAId, Guid userBId)
    {
        // Unlocked fast path: most pairings between two users who already have a
        // Match (from Discover, or an earlier Town Square session) never need the
        // lock/transaction below at all.
        var existing = await _db.Matches.FirstOrDefaultAsync(m =>
            (m.InitiatorId == userAId && m.ReceiverId == userBId) ||
            (m.InitiatorId == userBId && m.ReceiverId == userAId));
        if (existing is not null) return existing.Id;

        // Same advisory-lock-around-check-then-insert shape as
        // MatchesController.RequestMatch's PairLockKey pattern, to close the
        // identical concurrent-duplicate-Match race — the two round-robin
        // partners can only submit their Yes within the same ~4 min round, but
        // nothing rules out both requests landing at once. Re-check after taking
        // the lock in case a concurrent insert won the race between the
        // unlocked check above and here.
        await using var tx = await _db.Database.BeginTransactionAsync();
        await _db.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock({PairLockKey(userAId, userBId)})");

        existing = await _db.Matches.FirstOrDefaultAsync(m =>
            (m.InitiatorId == userAId && m.ReceiverId == userBId) ||
            (m.InitiatorId == userBId && m.ReceiverId == userAId));
        if (existing is not null)
        {
            await tx.CommitAsync();
            return existing.Id;
        }

        var match = new Match
        {
            InitiatorId = userAId,
            ReceiverId = userBId,
            Status = "Active",
            RevealLevel = 1,
        };
        _db.Matches.Add(match);
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        return match.Id;
    }

    private static long PairLockKey(Guid a, Guid b)
    {
        var (lo, hi) = string.CompareOrdinal(a.ToString(), b.ToString()) <= 0 ? (a, b) : (b, a);
        var hash = System.Security.Cryptography.SHA256.HashData([.. lo.ToByteArray(), .. hi.ToByteArray()]);
        return BitConverter.ToInt64(hash, 0);
    }

    // Circle method for bipartite round-robin: fixing the men's order and
    // rotating the women's order by round index guarantees every man meets
    // every woman exactly once across N rounds, with N = men.Count.
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
