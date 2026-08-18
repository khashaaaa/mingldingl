using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("matches")]
[Authorize]
[Produces("application/json")]
public class MatchesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ScoreService _score;
    private readonly GhostingService _ghosting;
    private readonly QuestService _quests;
    private readonly MilestoneService _milestones;
    private readonly PushNotificationService _push;

    public MatchesController(AppDbContext db, ScoreService score, GhostingService ghosting, QuestService quests, MilestoneService milestones, PushNotificationService push)
    {
        _db = db;
        _score = score;
        _ghosting = ghosting;
        _quests = quests;
        _milestones = milestones;
        _push = push;
    }

    [HttpGet("candidates")]
    [ProducesResponseType(typeof(PagedResponse<CandidateResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCandidates([FromQuery] int page = 1, [FromQuery] int pageSize = 0)
    {
        var userId = this.CurrentUserId();
        var me = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        if (me is null) return this.NotFoundError("User not found");

        var (safePage, safePageSize, skip) = PagingDefaults.Normalize(page, pageSize);

        // Opposite-sex only (2026-07-28 brainstorm — "Other" was removed as a
        // gender option entirely rather than left as an unhandled edge case).
        // Legacy rows from before that change fall through to null, which
        // deliberately means "no gender filter" rather than "show nobody" —
        // failing open is the safer default for stale data we don't control.
        string? oppositeGender = me.Gender switch
        {
            "Male" => "Female",
            "Female" => "Male",
            _ => null,
        };

        // A NOT EXISTS correlated subquery does this in one round trip instead of
        // pulling every matched-partner id into app memory first and shipping it
        // back as a query parameter array — cheaper, and scales with users who
        // have many matches instead of with the size of that array.
        var unmatched = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id != userId
                && u.DeletionRequestedAt == null // pending or completed deletion — hidden either way
                && !u.IsPaused
                && u.Age >= me.AgeMin && u.Age <= me.AgeMax
                && (oppositeGender == null || u.Gender == oppositeGender)
                && !_db.Matches.Any(m =>
                    (m.InitiatorId == userId && m.ReceiverId == u.Id) ||
                    (m.InitiatorId == u.Id && m.ReceiverId == userId))
                && !_db.BlockedUsers.Any(bl =>
                    (bl.BlockerId == userId && bl.BlockedId == u.Id) ||
                    (bl.BlockerId == u.Id && bl.BlockedId == userId)))
            .ToListAsync();

        // Distance ranking needs Haversine (sin/cos/atan2), which EF Core can't
        // translate to SQL, hence ranking in memory over the already-filtered
        // (unmatched) set above rather than in the query itself. Fine at this
        // app's current scale — if the user base grows large enough for this to
        // matter, that's a later optimization (PostGIS/raw SQL), not a day-one
        // concern.
        //
        // Distance is the primary signal, score proximity the next tiebreaker
        // (see 2026-07-27 brainstorm), and deep-field compatibility the last —
        // it only ever separates candidates who are already equally close and
        // equally scored. Like distance, it's a soft signal: candidates with
        // no comparable deep fields on either side sort after everyone who
        // has some overlap, but are never excluded.
        //
        // Priority matching (Gold/Platinum membership perk, 2026-07-28): for
        // paying members, candidates within the same ~15km band count as
        // equally near, so compatibility decides order *within* that band
        // instead of only ever breaking an exact distance+score tie. This is
        // what makes deep-profile compatibility a real, paid-for ranking
        // factor rather than a mostly-theoretical one everyone gets for free.
        const double PriorityCompatibilityBandKm = 15;
        // Day-0 activation: within the same ~10km band, a candidate with zero
        // matches anywhere (not just with the viewer) is boosted ahead of one
        // who's already matched — so a brand-new user surfaces sooner in
        // other people's decks instead of sitting unseen behind everyone
        // who's already been discovered. Self-expiring: the moment they get
        // one match, this stops applying to them. Deliberately its own
        // (narrower) band rather than reusing PriorityCompatibilityBandKm —
        // that one is a paid perk; this applies to every membership level.
        const double NewUserBoostBandKm = 10;
        bool priorityMatching = me.MembershipLevel is "Gold" or "Platinum";
        bool myLocationKnown = me.Latitude.HasValue && me.Longitude.HasValue;
        var totalCount = unmatched.Count;

        var matchedUserIds = new HashSet<Guid>(
            await _db.Matches.Select(m => m.InitiatorId).Union(_db.Matches.Select(m => m.ReceiverId)).ToListAsync());

        var projected = unmatched
            .Select(u => new
            {
                User = u,
                DistanceKm = myLocationKnown && u.Latitude.HasValue && u.Longitude.HasValue
                    ? MongoliaGeo.DistanceKm(me.Latitude!.Value, me.Longitude!.Value, u.Latitude.Value, u.Longitude.Value)
                    : (double?)null,
                ScoreDiff = Math.Abs(u.TotalScore - me.TotalScore),
                Compatibility = CompatibilityScorer.Score(me, u),
                IsUnmatchedElsewhere = !matchedUserIds.Contains(u.Id),
            });

        var ordered = priorityMatching
            ? projected
                .OrderBy(x => x.DistanceKm.HasValue ? 0 : 1)
                .ThenBy(x => x.DistanceKm.HasValue ? Math.Floor(x.DistanceKm.Value / PriorityCompatibilityBandKm) : 0)
                .ThenBy(x => x.Compatibility.HasValue ? 0 : 1)
                .ThenByDescending(x => x.Compatibility ?? 0)
                .ThenBy(x => x.DistanceKm.HasValue ? Math.Floor(x.DistanceKm.Value / NewUserBoostBandKm) : 0)
                .ThenByDescending(x => x.IsUnmatchedElsewhere)
                .ThenBy(x => x.DistanceKm ?? double.MaxValue)
                .ThenBy(x => x.ScoreDiff)
            : projected
                .OrderBy(x => x.DistanceKm.HasValue ? 0 : 1)
                .ThenBy(x => x.DistanceKm.HasValue ? Math.Floor(x.DistanceKm.Value / NewUserBoostBandKm) : 0)
                .ThenByDescending(x => x.IsUnmatchedElsewhere)
                .ThenBy(x => x.DistanceKm ?? double.MaxValue)
                .ThenBy(x => x.ScoreDiff)
                .ThenBy(x => x.Compatibility.HasValue ? 0 : 1)
                .ThenByDescending(x => x.Compatibility ?? 0);

        var candidates = ordered
            .Select(x => x.User)
            .Skip(skip)
            .Take(safePageSize)
            .ToList();

        var items = candidates.Select(c => new CandidateResponse(
            c.Id, c.DisplayName, c.Age, c.City, c.GemTier, c.ReputationScore,
            c.PhotoUrls, c.Bio, c.EquippedFrameId, c.EquippedTitleId)).ToList();

        return Ok(new PagedResponse<CandidateResponse>(items, safePage, safePageSize, totalCount, skip + items.Count < totalCount));
    }

    [HttpPost]
    [ProducesResponseType(typeof(CreateMatchResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RequestMatch([FromBody] RequestMatchDto req)
    {
        var userId = this.CurrentUserId();
        var me = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        if (me is null) return this.NotFoundError("User not found");

        if (me.DailyMatchesUsed >= ScoreService.DailyMatchBudget(me))
            return this.BadRequestError("Daily match budget exhausted");

        // Matches has no unique constraint on the unordered (InitiatorId, ReceiverId)
        // pair, so two concurrent requests between the same two users can both pass
        // the existence check below before either commits (confirmed via stress test:
        // 20 concurrent requests produced 18 duplicate Match rows). An advisory xact
        // lock keyed on the sorted pair serializes concurrent requests for the same
        // two users without requiring a schema change.
        //
        // Wrapped in the execution strategy so EnableRetryOnFailure (Program.cs)
        // can retry this on a transient DB failure — EF Core forbids a
        // manually-opened BeginTransactionAsync outside of one. DailyMatchesUsed
        // is incremented via a raw atomic UPDATE (not `me.DailyMatchesUsed++` on
        // a tracked entity captured from outside) specifically so a retry is
        // safe: the increment only ever takes effect if this transaction
        // actually commits, so re-running it on a rolled-back retry can't
        // double-count the way mutating an outer in-memory counter would.
        var (outcome, matchId) = await _db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync();
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock({PairLockKey(userId, req.TargetUserId)})");

            var existing = await _db.Matches.FirstOrDefaultAsync(m =>
                (m.InitiatorId == userId && m.ReceiverId == req.TargetUserId) ||
                (m.InitiatorId == req.TargetUserId && m.ReceiverId == userId));
            if (existing is not null) return ("conflict", (Guid?)null);

            // Defense in depth: GetCandidates already excludes blocked pairs from
            // the list a client would request from, but a direct call here (or a
            // block that landed after the candidate list was fetched) should
            // still be rejected server-side.
            bool blocked = await _db.BlockedUsers.AnyAsync(bl =>
                (bl.BlockerId == userId && bl.BlockedId == req.TargetUserId) ||
                (bl.BlockerId == req.TargetUserId && bl.BlockedId == userId));
            if (blocked) return ("blocked", (Guid?)null);

            var match = new Match
            {
                InitiatorId = userId,
                ReceiverId = req.TargetUserId,
                Status = "Active",
                RevealLevel = 1
            };
            _db.Matches.Add(match);
            await _db.SaveChangesAsync();
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"""UPDATE "Users" SET "DailyMatchesUsed" = "DailyMatchesUsed" + 1 WHERE "Id" = {userId}""");
            await tx.CommitAsync();
            return ("created", (Guid?)match.Id);
        });

        if (outcome == "conflict") return this.ConflictError("Match already exists");
        if (outcome == "blocked") return this.ForbiddenError("Cannot match with this user");

        int awarded = await _quests.IncrementAsync(userId, "summons");
        await _milestones.AchieveAsync(userId, "first_match");
        await _milestones.AchieveAsync(req.TargetUserId, "first_match");

        await _push.NotifyUserAsync(
            req.TargetUserId,
            "New Match!",
            $"{me.DisplayName} sent you a summons.",
            new Dictionary<string, object> { ["matchId"] = matchId!.Value.ToString(), ["type"] = "match" });

        return Ok(new CreateMatchResponse(matchId!.Value, awarded));
    }

    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<MatchResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMyMatches([FromQuery] int page = 1, [FromQuery] int pageSize = 0)
    {
        var userId = this.CurrentUserId();
        var me = await _db.Users.FindAsync(userId);
        if (me is null) return this.NotFoundError("Profile not found. Please complete onboarding.");

        var (safePage, safePageSize, skip) = PagingDefaults.Normalize(page, pageSize);

        var query = _db.Matches
            .AsNoTracking()
            .Include(m => m.Initiator)
            .Include(m => m.Receiver)
            .Where(m => (m.InitiatorId == userId || m.ReceiverId == userId) && m.Status != "Unmatched")
            .OrderByDescending(m => m.LastMessageAt ?? m.CreatedAt);

        var totalCount = await query.CountAsync();
        var matches = await query.Skip(skip).Take(safePageSize).ToListAsync();

        var shipIds = matches.Where(m => m.ShipId != null).Select(m => m.ShipId!.Value).Distinct().ToList();
        var weaverNamesByShipId = shipIds.Count == 0
            ? new Dictionary<Guid, string>()
            : await _db.Ships
                .Where(s => shipIds.Contains(s.Id))
                .Join(_db.Users, s => s.ShipperUserId, u => u.Id, (s, u) => new { s.Id, u.DisplayName })
                .ToDictionaryAsync(x => x.Id, x => x.DisplayName);

        var items = matches.Select(m => BuildMatchResponse(m, userId, me.MembershipLevel, weaverNamesByShipId)).ToList();
        return Ok(new PagedResponse<MatchResponse>(items, safePage, safePageSize, totalCount, skip + items.Count < totalCount));
    }

    [HttpPost("{id}/ghost-check")]
    [ProducesResponseType(typeof(GhostCheckResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GhostCheck(Guid id)
    {
        var userId = this.CurrentUserId();
        var match = await _db.Matches.FindAsync(id);
        if (match is null) return this.NotFoundError("Match not found");
        if (!match.IsParticipant(userId))
            return this.ForbiddenError("You are not a participant in this match");

        await _ghosting.CheckAsync(match);

        return Ok(new GhostCheckResponse(match.Status));
    }

    // The status flip alone is enough to permanently block rematching:
    // GetCandidates excludes anyone with an existing Match row regardless of
    // status, so this row staying around (not deleted) is what keeps it
    // that way forever, for both participants. Block (below) additionally
    // prevents a brand-new match request between the two — see RequestMatch.
    [HttpPost("{id}/unmatch")]
    [ProducesResponseType(typeof(UnmatchResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Unmatch(Guid id)
    {
        var userId = this.CurrentUserId();
        var match = await _db.Matches.FindAsync(id);
        if (match is null) return this.NotFoundError("Match not found");
        if (!match.IsParticipant(userId))
            return this.ForbiddenError("You are not a participant in this match");

        match.Status = "Unmatched";
        await _db.SaveChangesAsync();
        return Ok(new UnmatchResponse(true));
    }

    // Unlike Unmatch, this also prevents the other person from sending a new
    // match request in future (RequestMatch checks BlockedUsers; GetCandidates
    // excludes blocked pairs too, so they stop appearing in Discover). No
    // report/moderation queue yet — see the 2026-07-28 brainstorm.
    [HttpPost("{id}/block")]
    [ProducesResponseType(typeof(UnmatchResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Block(Guid id)
    {
        var userId = this.CurrentUserId();
        var match = await _db.Matches.FindAsync(id);
        if (match is null) return this.NotFoundError("Match not found");
        if (!match.IsParticipant(userId))
            return this.ForbiddenError("You are not a participant in this match");

        var otherId = match.OtherParticipant(userId);
        match.Status = "Unmatched";

        bool alreadyBlocked = await _db.BlockedUsers.AnyAsync(bl => bl.BlockerId == userId && bl.BlockedId == otherId);
        if (!alreadyBlocked)
            _db.BlockedUsers.Add(new BlockedUser { BlockerId = userId, BlockedId = otherId });

        await _db.SaveChangesAsync();
        return Ok(new UnmatchResponse(true));
    }

    private static MatchResponse BuildMatchResponse(Match m, Guid viewerId, string membership, IReadOnlyDictionary<Guid, string> weaverNamesByShipId)
    {
        var other = m.InitiatorId == viewerId ? m.Receiver : m.Initiator;
        int level = RevealService.GetRevealLevel(m);

        return new MatchResponse(
            m.Id, other.Id, m.Status, level, m.MessageCount,
            m.IcebreakerComplete, m.VideoCallUnlocked,
            new PartialUserProfile(
                DisplayName: level >= 1 ? other.DisplayName : null,
                FirstPhoto:  level >= 1 ? other.PhotoUrls.ElementAtOrDefault(0) : null,
                Bio:         level >= 1 ? other.Bio : null,
                Age:         level >= 2 ? other.Age : null,
                SecondPhoto: level >= 2 ? other.PhotoUrls.ElementAtOrDefault(1) : null,
                ThirdPhoto:  level >= 3 ? other.PhotoUrls.ElementAtOrDefault(2) : null,
                District:    level >= 3 ? other.City : null,
                Deep: level >= 4 && membership is "Silver" or "Gold" or "Platinum"
                    ? new UserDeepFields(other.HasKids, other.SmokingHabit, other.DrinkingHabit, other.Religion, other.Lifestyle)
                    : null,
                EquippedFrameId: level >= 1 ? other.EquippedFrameId : null,
                EquippedTitleId: level >= 1 ? other.EquippedTitleId : null,
                IsDeleted: other.IsDeleted),
            m.ShipId.HasValue ? weaverNamesByShipId.GetValueOrDefault(m.ShipId.Value) : null);
    }

    // pg_advisory_xact_lock takes a bigint; order-independent so both users
    // requesting a match with each other at the same time hash to the same key.
    private static long PairLockKey(Guid a, Guid b)
    {
        var (lo, hi) = string.CompareOrdinal(a.ToString(), b.ToString()) <= 0 ? (a, b) : (b, a);
        var hash = System.Security.Cryptography.SHA256.HashData([.. lo.ToByteArray(), .. hi.ToByteArray()]);
        return BitConverter.ToInt64(hash, 0);
    }
}

public record RequestMatchDto(Guid TargetUserId);
public record UnmatchResponse(bool Unmatched);
