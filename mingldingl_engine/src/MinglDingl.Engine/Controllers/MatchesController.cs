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
    private readonly ConfigService _config;
    private readonly SupabaseBroadcastService _broadcast;

    public MatchesController(AppDbContext db, ScoreService score, GhostingService ghosting, QuestService quests, MilestoneService milestones, PushNotificationService push, ConfigService config, SupabaseBroadcastService broadcast)
    {
        _db = db;
        _score = score;
        _ghosting = ghosting;
        _quests = quests;
        _milestones = milestones;
        _push = push;
        _config = config;
        _broadcast = broadcast;
    }

    [HttpGet("candidates")]
    [ProducesResponseType(typeof(PagedResponse<CandidateResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCandidates([FromQuery] int page = 1, [FromQuery] int pageSize = 0)
    {
        var userId = this.CurrentUserId();
        var me = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        if (me is null) return this.NotFoundError("User not found", "user.not_found");

        var (safePage, safePageSize, skip) = PagingDefaults.Normalize(page, pageSize);

        string? oppositeGender = me.Gender switch
        {
            "Male" => "Female",
            "Female" => "Male",
            _ => null,
        };

        var unmatched = await _db.Users
            .AsNoTracking()
            .Where(u => u.Id != userId
                && u.DeletionRequestedAt == null
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

        const double PriorityCompatibilityBandKm = 15;

        const double NewUserBoostBandKm = 10;

        const double OathAffinityBandKm = 25;
        bool priorityMatching = me.MembershipLevel == "Gold";
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
                OathAffinity = OathService.Affinity(me.Oath, u.Oath),
                BothProven = me.OathProven && u.OathProven,
            });

        var ordered = priorityMatching
            ? projected
                .OrderBy(x => x.DistanceKm.HasValue ? 0 : 1)
                .ThenBy(x => x.DistanceKm.HasValue ? Math.Floor(x.DistanceKm.Value / OathAffinityBandKm) : 0)
                .ThenBy(x => x.OathAffinity.HasValue ? 0 : 1)
                .ThenByDescending(x => x.OathAffinity ?? 0)
                .ThenByDescending(x => x.BothProven)
                .ThenBy(x => x.DistanceKm.HasValue ? Math.Floor(x.DistanceKm.Value / PriorityCompatibilityBandKm) : 0)
                .ThenBy(x => x.Compatibility.HasValue ? 0 : 1)
                .ThenByDescending(x => x.Compatibility ?? 0)
                .ThenBy(x => x.DistanceKm.HasValue ? Math.Floor(x.DistanceKm.Value / NewUserBoostBandKm) : 0)
                .ThenByDescending(x => x.IsUnmatchedElsewhere)
                .ThenBy(x => x.DistanceKm ?? double.MaxValue)
                .ThenBy(x => x.ScoreDiff)
            : projected
                .OrderBy(x => x.DistanceKm.HasValue ? 0 : 1)
                .ThenBy(x => x.DistanceKm.HasValue ? Math.Floor(x.DistanceKm.Value / OathAffinityBandKm) : 0)
                .ThenBy(x => x.OathAffinity.HasValue ? 0 : 1)
                .ThenByDescending(x => x.OathAffinity ?? 0)
                .ThenByDescending(x => x.BothProven)
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
            c.PhotoUrls, c.Bio, c.EquippedFrameId, c.EquippedTitleId,
            c.Oath, c.OathProven)).ToList();

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
        if (me is null) return this.NotFoundError("User not found", "user.not_found");

        if (me.DailyMatchesUsed >= _score.DailyMatchBudget(me))
            return this.BadRequestError("Daily match budget exhausted", "match.daily_budget_spent");

        var (outcome, matchId) = await _db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync();
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"SELECT pg_advisory_xact_lock({MatchPairing.PairLockKey(userId, req.TargetUserId)})");

            if (await MatchPairing.PairAlreadyMatchedAsync(_db, userId, req.TargetUserId))
                return ("conflict", (Guid?)null);

            if (await MatchPairing.IsPairBlockedAsync(_db, userId, req.TargetUserId))
                return ("blocked", (Guid?)null);

            var match = MatchPairing.NewMatch(userId, req.TargetUserId);
            _db.Matches.Add(match);
            await _db.SaveChangesAsync();
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"""UPDATE "Users" SET "DailyMatchesUsed" = "DailyMatchesUsed" + 1 WHERE "Id" = {userId}""");
            await tx.CommitAsync();
            return ("created", (Guid?)match.Id);
        });

        if (outcome == "conflict") return this.ConflictError("Match already exists", "match.already_exists");
        if (outcome == "blocked") return this.ForbiddenError("Cannot match with this user", "match.not_allowed");

        var trackedMe = _db.ChangeTracker.Entries<User>().FirstOrDefault(e => e.Entity.Id == userId)?.Entity;
        if (trackedMe is not null) trackedMe.DailyMatchesUsed++;

        int awarded = await _quests.IncrementAsync(userId, "summons");
        await _milestones.AchieveAsync(userId, "first_match");
        await _milestones.AchieveAsync(req.TargetUserId, "first_match");

        await _push.NotifyUserAsync(
            req.TargetUserId,
            "New Match!",
            $"{me.DisplayName} sent you a summons.",
            new Dictionary<string, object> { ["matchId"] = matchId!.Value.ToString(), ["type"] = "match" });
        await _broadcast.BroadcastAsync("app-nudges", "match_created",
            new { matchId = matchId!.Value, userIds = new[] { userId, req.TargetUserId }, source = "like" });

        return Ok(new CreateMatchResponse(matchId!.Value, awarded));
    }

    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<MatchResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMyMatches([FromQuery] int page = 1, [FromQuery] int pageSize = 0)
    {
        var userId = this.CurrentUserId();
        var me = await _db.Users.FindAsync(userId);
        if (me is null) return this.NotFoundError("Profile not found. Please complete onboarding.", "user.profile_incomplete");

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
        var (match, accessError) = await this.LoadParticipantMatchAsync(_db, id);
        if (accessError is not null) return accessError;

        await _ghosting.CheckAsync(match);

        return Ok(new GhostCheckResponse(match.Status));
    }

    [HttpPost("{id}/unmatch")]
    [ProducesResponseType(typeof(UnmatchResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Unmatch(Guid id)
    {
        var userId = this.CurrentUserId();
        var (match, accessError) = await this.LoadParticipantMatchAsync(_db, id);
        if (accessError is not null) return accessError;

        match.Status = "Unmatched";
        await _db.SaveChangesAsync();

        await _broadcast.BroadcastAsync("app-nudges", "match_status_changed",
            new { matchId = match.Id, status = match.Status, userId });

        return Ok(new UnmatchResponse(true));
    }

    [HttpPost("{id}/block")]
    [ProducesResponseType(typeof(UnmatchResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Block(Guid id)
    {
        var userId = this.CurrentUserId();
        var (match, accessError) = await this.LoadParticipantMatchAsync(_db, id);
        if (accessError is not null) return accessError;

        var otherId = match.OtherParticipant(userId);
        match.Status = "Unmatched";

        bool alreadyBlocked = await _db.BlockedUsers.AnyAsync(bl => bl.BlockerId == userId && bl.BlockedId == otherId);
        if (!alreadyBlocked)
            _db.BlockedUsers.Add(new BlockedUser { BlockerId = userId, BlockedId = otherId });

        await _db.SaveChangesAsync();

        await _broadcast.BroadcastAsync("app-nudges", "match_status_changed",
            new { matchId = match.Id, status = match.Status, userId });

        return Ok(new UnmatchResponse(true));
    }

    private MatchResponse BuildMatchResponse(Match m, Guid viewerId, string membership, IReadOnlyDictionary<Guid, string> weaverNamesByShipId)
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
                Deep: level >= 4 && membership is "Silver" or "Gold"
                    ? new UserDeepFields(other.HasKids, other.SmokingHabit, other.DrinkingHabit, other.Religion, other.Lifestyle)
                    : null,
                EquippedFrameId: level >= 1 ? other.EquippedFrameId : null,
                EquippedTitleId: level >= 1 ? other.EquippedTitleId : null,
                IsDeleted: other.IsDeleted,
                Oath: level >= 1 ? other.Oath : null,
                OathProven: level >= 1 && other.OathProven),
            m.ShipId.HasValue ? weaverNamesByShipId.GetValueOrDefault(m.ShipId.Value) : null,
            m.FlameRiteProposedById,
            m.FlameRiteProposedAt,
            m.FlameRiteAcceptedAt,
            m.FlameRiteCompletedAt,
            (int)_config.GetNumber("dating.flamerite.duration_minutes", 5),
            _config.FlameRiteRequired(),
            _config.GetBool("video.enabled", true));
    }
}

public record RequestMatchDto(Guid TargetUserId);
public record UnmatchResponse(bool Unmatched);
