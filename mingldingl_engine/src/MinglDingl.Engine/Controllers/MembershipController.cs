using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("membership")]
[Authorize]
[Produces("application/json")]
public class MembershipController : ControllerBase
{
    // 2026-07-28 audit: this list used to describe perks (profile boost, fun
    // tag pack, priority matching, compatibility %) that were never actually
    // implemented anywhere, while the app's membership screen displayed a
    // *third*, entirely separate hardcoded perk/pricing list that matched
    // neither this nor the real code. Rebuilt from what's actually gated:
    // DailyMatches (ScoreService.DailyMatchBudget's base values) and
    // DeepProfileView (MatchesController.BuildMatchResponse's membership
    // check) are the only two real differentiators today. Gold and Platinum
    // are consequently identical to Silver except for match budget — that's
    // an accurate reflection of current capability, not a placeholder to
    // paper over with invented perks.
    // "basic_profile" only appears on Free: it's the baseline every tier
    // already has, so repeating it on the paid cards read as a bullet that
    // didn't distinguish Silver/Gold/Platinum from each other or from Free —
    // the membership screen renders one row per key, so a key present on
    // every tier shows as an identical, non-upgrading line on every card.
    private static readonly List<MembershipTierResponse> Tiers = [
        new("Free",     5,  false, null,   ["icebreakers_quizzes", "basic_profile"], []),
        new("Silver",   10, true,  5900,   ["icebreakers_quizzes", "deep_profile_view"], MembershipPricing.PriceOptions(5900).ToArray()),
        new("Gold",     15, true,  12900,  ["icebreakers_quizzes", "deep_profile_view"], MembershipPricing.PriceOptions(12900).ToArray()),
        new("Platinum", 20, true,  24900,  ["icebreakers_quizzes", "deep_profile_view"], MembershipPricing.PriceOptions(24900).ToArray()),
    ];

    // Exposed for AdminAnalyticsController (revenue estimate) and
    // AdminOpsController (pricing view) instead of a second hardcoded copy.
    public static IReadOnlyList<MembershipTierResponse> AllTiers => Tiers;

    private readonly AppDbContext _db;
    public MembershipController(AppDbContext db) => _db = db;

    [HttpGet("tiers")]
    [ProducesResponseType(typeof(List<MembershipTierResponse>), StatusCodes.Status200OK)]
    public IActionResult GetTiers() => Ok(Tiers);

    [HttpGet("me")]
    [ProducesResponseType(typeof(MembershipMeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMine()
    {
        var userId = this.CurrentUserId();
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        if (user is null) return this.NotFoundError("User not found");
        return Ok(new MembershipMeResponse(user.MembershipLevel, user.MembershipExpiresAt));
    }

    private static readonly HashSet<string> ValidLevels =
        new(StringComparer.OrdinalIgnoreCase) { "Free", "Silver", "Gold", "Platinum" };

    // Mock charge — always succeeds, no real payment provider involved yet.
    // Exists so the membership flow (and anything gated on tier, like the
    // deep-profile reveal fields) is fully exercisable with seed data before
    // a real gateway gets wired in. Swapping in real payments later means
    // replacing the body of this action, not the contract around it.
    [HttpPost("upgrade")]
    [ProducesResponseType(typeof(MembershipMeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Upgrade([FromBody] UpgradeMembershipDto req)
    {
        var canonicalLevel = ValidLevels.FirstOrDefault(l => string.Equals(l, req.Level, StringComparison.OrdinalIgnoreCase));
        if (canonicalLevel is null)
            return this.BadRequestError("Unknown membership tier");
        if (canonicalLevel != "Free" && !MembershipPricing.AvailableDurations.Contains(req.DurationMonths))
            return this.BadRequestError("Unknown billing duration");

        var userId = this.CurrentUserId();
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return this.NotFoundError("User not found");

        var now = DateTime.UtcNow;
        if (canonicalLevel == "Free")
        {
            user.MembershipLevel = "Free";
            user.MembershipExpiresAt = null;
            _db.Memberships.Add(new Membership
            {
                Id = Guid.NewGuid(), UserId = userId, Level = "Free",
                DurationMonths = 0, PriceMnt = 0, ExpiresAt = null, CreatedAt = now,
            });
        }
        else
        {
            var tier = Tiers.First(t => t.Level == canonicalLevel);
            var priceOption = MembershipPricing.PriceOptions(tier.MonthlyPriceMnt!.Value)
                .First(p => p.DurationMonths == req.DurationMonths);
            var expiresAt = now.AddMonths(req.DurationMonths);

            user.MembershipLevel = canonicalLevel;
            user.MembershipExpiresAt = expiresAt;
            _db.Memberships.Add(new Membership
            {
                Id = Guid.NewGuid(), UserId = userId, Level = canonicalLevel,
                DurationMonths = req.DurationMonths, PriceMnt = priceOption.TotalPriceMnt,
                ExpiresAt = expiresAt, CreatedAt = now,
            });
        }

        await _db.SaveChangesAsync();
        return Ok(new MembershipMeResponse(user.MembershipLevel, user.MembershipExpiresAt));
    }
}
