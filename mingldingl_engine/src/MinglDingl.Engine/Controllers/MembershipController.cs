using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("membership")]
[Authorize]
[Produces("application/json")]
public class MembershipController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly MembershipCatalog _catalog;
    private readonly ConfigService _config;
    public MembershipController(AppDbContext db, MembershipCatalog catalog, ConfigService config)
    {
        _db = db;
        _catalog = catalog;
        _config = config;
    }

    [HttpGet("tiers")]
    [ProducesResponseType(typeof(List<MembershipTierResponse>), StatusCodes.Status200OK)]
    public IActionResult GetTiers() => Ok(_catalog.Tiers().ToList());

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

        // No payment rail is wired up yet — QPay and HiPay are both still undecided — so this
        // endpoint hands out Gold for the asking. Closed by default because a deploy that forgets
        // about it is a deploy giving paid tiers away; open it deliberately for a demo, and it
        // becomes redundant once a provider actually charges before this runs. Downgrading to Free
        // is always allowed: that is cancelling, not buying.
        if (canonicalLevel != "Free" && !_config.GetBool("membership.purchase.enabled", false))
            return this.BadRequestError("Memberships are not on sale yet", "membership.purchase_closed");
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
            var tier = _catalog.Find(canonicalLevel)!;
            var priceOption = tier.Prices.First(p => p.DurationMonths == req.DurationMonths);
            // Extend, do not overwrite. Buying again — or moving between paid tiers — used to reset
            // the clock to now, so renewing early threw away every day still left on the old term.
            var from = canonicalLevel == user.MembershipLevel && user.MembershipExpiresAt > now
                ? user.MembershipExpiresAt.Value
                : now;
            var expiresAt = from.AddMonths(req.DurationMonths);

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
