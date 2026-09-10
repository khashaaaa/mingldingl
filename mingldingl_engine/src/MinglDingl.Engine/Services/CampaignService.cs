using Microsoft.EntityFrameworkCore;

/// <summary>
/// The per-match campaign (dungeon map). Room state is derived entirely from existing match
/// progression — there is no campaign state machine to advance, so the map can never desync
/// from the ladder and never gates any existing flow. The only writes are per-user honours claims.
/// </summary>
public class CampaignService
{
    public const string BossRoomId = "threshold";

    public static readonly IReadOnlyList<string> RoomOrder =
        ["gate", "echoes", "runes", "voices", "flame", "bridge", "threshold"];


    private readonly AppDbContext _db;
    private readonly ScoreService _score;
    private readonly HonourService _honours;
    private readonly ConfigService _config;

    public CampaignService(AppDbContext db, ScoreService score, HonourService honours, ConfigService config)
    {
        _db = db;
        _score = score;
        _honours = honours;
        _config = config;
    }

    public bool IsEnabled => _config.GetBool("campaign.enabled", true);

    private int RoomBonus => (int)_config.GetNumber("campaign.room.bonus", 5);
    private int VoicesMessageThreshold => Math.Max(1, (int)_config.GetNumber("campaign.voices.messages", 15));
    private int BossBonus => (int)_config.GetNumber("campaign.boss.bonus", 25);

    public async Task<CampaignResponse> GetStateAsync(Match match, Guid userId)
    {
        var cleared = await GetClearedRoomsAsync(match);
        var claimed = await _db.CampaignRoomClaims
            .Where(c => c.MatchId == match.Id && c.UserId == userId)
            .Select(c => c.RoomId)
            .ToListAsync();

        var rooms = RoomOrder
            .Select(roomId => new CampaignRoomResponse(
                roomId,
                cleared.Contains(roomId),
                claimed.Contains(roomId),
                roomId == BossRoomId ? BossBonus : RoomBonus))
            .ToList();

        return new CampaignResponse(rooms, cleared.Count, cleared.Contains(BossRoomId), VoicesMessageThreshold);
    }

    public async Task<ClaimCampaignRoomResponse> ClaimAsync(Match match, Guid userId, string roomId)
    {
        if (!RoomOrder.Contains(roomId))
            throw DomainException.NotFound("Unknown campaign room", "campaign.room_unknown");

        var cleared = await GetClearedRoomsAsync(match);
        if (!cleared.Contains(roomId))
            throw DomainException.Conflict("This room has not been cleared yet", "campaign.room_not_cleared");

        _db.CampaignRoomClaims.Add(new CampaignRoomClaim { MatchId = match.Id, UserId = userId, RoomId = roomId });
        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (UniqueViolationGuard.IsViolation(ex, "IX_CampaignRoomClaims_MatchId_UserId_RoomId"))
        {
            throw DomainException.Conflict("You have already claimed this room's spoils", "campaign.room_already_claimed");
        }

        bool isBoss = roomId == BossRoomId;
        int bonus = isBoss ? BossBonus : RoomBonus;
        await _score.AwardWithDeltaAsync(userId, isBoss ? "CampaignBossBonus" : "CampaignRoomBonus", bonus);
        var drop = isBoss ? await _honours.GrantAsync(userId, "title_sealbreaker", "campaign_boss") : null;

        return new ClaimCampaignRoomResponse(bonus, drop);
    }

    private async Task<HashSet<string>> GetClearedRoomsAsync(Match match)
    {
        var cleared = new HashSet<string> { "gate" };

        if (match.IcebreakerComplete) cleared.Add("echoes");
        // Mutual, not raw: a room is a shared deed, and its bonus is claimable per user, so the
        // raw total let one person clear Voices — and bank the score — by talking into silence.
        if (RevealService.MutualMessageCount(match) >= VoicesMessageThreshold) cleared.Add("voices");
        // Same equivalence the AddFlameRite migration's backfill used for pre-rite matches.
        if (match.FlameRiteCompletedAt is not null || match.VideoRewardClaimed) cleared.Add("flame");

        bool bothQuizzed = await _db.QuizResponses
            .Where(r => r.MatchId == match.Id)
            .GroupBy(r => r.QuizId)
            .AnyAsync(g => g.Select(r => r.UserId).Distinct().Count() >= 2);
        if (bothQuizzed) cleared.Add("runes");

        var completedDates = await _db.DateConfirmations
            .Where(d => d.MatchId == match.Id && d.CompletedAt != null)
            .Select(d => new { d.InitiatorAttended, d.ReceiverAttended })
            .ToListAsync();
        if (completedDates.Count > 0) cleared.Add("bridge");
        if (completedDates.Any(d => d.InitiatorAttended == true && d.ReceiverAttended == true)) cleared.Add(BossRoomId);

        return cleared;
    }
}
