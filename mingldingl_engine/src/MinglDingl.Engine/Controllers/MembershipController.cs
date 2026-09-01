using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("membership")]
[Authorize]
[Produces("application/json")]
public class MembershipController : ControllerBase
{
    private static readonly List<MembershipTierResponse> Tiers = [
        new("Free",   5,  false, null,  ["icebreakers_quizzes", "basic_profile"], []),
        new("Silver", 12, true,  10900, ["icebreakers_quizzes", "deep_profile_view"], MembershipPricing.PriceOptions(10900).ToArray()),
        new("Gold",   20, true,  21900, ["icebreakers_quizzes", "deep_profile_view", "priority_matching"], MembershipPricing.PriceOptions(21900).ToArray()),
    ];

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
        if (user is null) return this.NotFoundError("User not found", "user.not_found");
        return Ok(new MembershipMeResponse(user.MembershipLevel, user.MembershipExpiresAt));
    }

    private static readonly HashSet<string> ValidLevels =
        new(StringComparer.OrdinalIgnoreCase) { "Free", "Silver", "Gold" };

    [HttpPost("upgrade")]
    [ProducesResponseType(typeof(MembershipMeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Upgrade([FromBody] UpgradeMembershipDto req)
    {
        var canonicalLevel = ValidLevels.FirstOrDefault(l => string.Equals(l, req.Level, StringComparison.OrdinalIgnoreCase));
        if (canonicalLevel is null)
            return this.BadRequestError("Unknown membership tier", "membership.unknown_tier");
        if (canonicalLevel != "Free" && !MembershipPricing.AvailableDurations.Contains(req.DurationMonths))
            return this.BadRequestError("Unknown billing duration", "membership.unknown_duration");

        var userId = this.CurrentUserId();
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return this.NotFoundError("User not found", "user.not_found");

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
