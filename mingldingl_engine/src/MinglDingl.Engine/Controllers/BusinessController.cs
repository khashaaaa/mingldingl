using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("business")]
[Authorize]
[Produces("application/json")]
public class BusinessController : ControllerBase
{
    private readonly AppDbContext _db;

    public BusinessController(AppDbContext db) => _db = db;

    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<BusinessResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery] string? city, [FromQuery] string? category,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 0)
    {
        var query = _db.BusinessPartners.AsNoTracking().Where(b => b.IsVerified).AsQueryable();
        if (!string.IsNullOrEmpty(city)) query = query.Where(b => b.City == city);
        if (!string.IsNullOrEmpty(category)) query = query.Where(b => b.Category == category);
        query = query.OrderByDescending(b => b.IsFeatured).ThenByDescending(b => b.AverageRating);

        var (safePage, safePageSize, skip) = PagingDefaults.Normalize(page, pageSize);
        var totalCount = await query.CountAsync();
        var results = await query.Skip(skip).Take(safePageSize).ToListAsync();

        var items = results.Select(ToResponse).ToList();
        return Ok(new PagedResponse<BusinessResponse>(items, safePage, safePageSize, totalCount, skip + items.Count < totalCount));
    }

    [HttpPost("{id}/rate")]
    [ProducesResponseType(typeof(RateBusinessResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Rate(Guid id, [FromBody] RateBusinessRequest req,
        [FromQuery] Guid matchId)
    {
        if (req.Stars < 1 || req.Stars > 5) return this.BadRequestError("Stars must be 1-5");

        var userId = this.CurrentUserId();

        // IDOR guard: rating is only valid in the context of a match the caller
        // actually participated in — without this, anyone could rate any business
        // under any matchId they made up.
        var match = await _db.Matches.FindAsync(matchId);
        if (match is null) return this.NotFoundError("Match not found");
        if (!match.IsParticipant(userId))
            return this.ForbiddenError("You are not a participant in this match");

        var business = await _db.BusinessPartners.FindAsync(id);
        if (business is null) return this.NotFoundError("Business not found");

        _db.BusinessRatings.Add(new BusinessRating
        {
            BusinessPartnerId = id,
            UserId = userId,
            MatchId = matchId,
            Stars = req.Stars,
            Review = req.Review,
            PhotoUrl = req.PhotoUrl,
        });

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (UniqueViolationGuard.IsViolation(
            ex, "IX_BusinessRatings_BusinessPartnerId_UserId_MatchId"))
        {
            // Lost the race, or a flat-out repeat call — same (business, user, match)
            // has already been rated. The check-then-insert above is TOCTOU-racy;
            // this index is the real guard.
            _db.ChangeTracker.Clear();
            return this.ConflictError("You already rated this business for this match");
        }

        // Atomic recompute straight from BusinessRatings — the previous code did a
        // C# read-modify-write (business.RatingCount++; AverageRating = (...) /
        // RatingCount) against in-memory values, which is a lost-update race under
        // concurrent ratings for the same business (the same bug class fixed for
        // Match.MessageCount in MessagesController.SendMessage). Recomputing COUNT/AVG
        // directly from the source-of-truth rows in a single UPDATE removes the
        // read-then-write window entirely — the subqueries and the write happen as
        // one statement, so there's no gap for a concurrent rating to land in between.
        var updateResult = await _db.Database.SqlQuery<BusinessRatingAggregate>(
            $"""
            UPDATE "BusinessPartners" SET
                "RatingCount" = (SELECT COUNT(*) FROM "BusinessRatings" WHERE "BusinessPartnerId" = {id}),
                "AverageRating" = (SELECT AVG("Stars") FROM "BusinessRatings" WHERE "BusinessPartnerId" = {id})
            WHERE "Id" = {id}
            RETURNING "AverageRating", "RatingCount"
            """).ToListAsync();

        // SingleOrDefault, not Single: the business row was already confirmed to
        // exist moments ago (FindAsync above), but a concurrent deletion between
        // then and this UPDATE isn't impossible — treat that race as a clean 404
        // instead of letting Single() throw and surface as a generic 500.
        var aggregate = updateResult.SingleOrDefault();
        if (aggregate is null) return this.NotFoundError("Business not found");
        return Ok(new RateBusinessResponse(aggregate.AverageRating, aggregate.RatingCount));
    }

    // No UserId in the response — deliberately anonymous. This is "what
    // happened here" for someone browsing the business, not a record of
    // who went on a date with whom.
    [HttpGet("{id}/reviews")]
    [ProducesResponseType(typeof(List<BusinessReviewResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetReviews(Guid id)
    {
        var reviews = await _db.BusinessRatings
            .AsNoTracking()
            .Where(r => r.BusinessPartnerId == id && (r.Review != null || r.PhotoUrl != null))
            .OrderByDescending(r => r.CreatedAt)
            .Take(20)
            .Select(r => new BusinessReviewResponse(r.Stars, r.Review, r.PhotoUrl, r.CreatedAt))
            .ToListAsync();

        return Ok(reviews);
    }

    private static BusinessResponse ToResponse(BusinessPartner b) => new(
        b.Id, b.Name, b.Category, b.City, b.District, b.Description,
        b.PhotoUrls, b.OperatingHours, b.IsVerified, b.IsFeatured,
        b.AverageRating, b.RatingCount);
}
