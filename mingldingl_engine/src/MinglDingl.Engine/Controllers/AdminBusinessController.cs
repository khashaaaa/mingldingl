using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("admin/business")]
[Authorize(AuthenticationSchemes = "AdminBearer")]
[Produces("application/json")]
public class AdminBusinessController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AdminAuditService _audit;
    public AdminBusinessController(AppDbContext db, AdminAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    private static BusinessResponse ToResponse(BusinessPartner b) => new(
        b.Id, b.Name, b.Category, b.City, b.District, b.Description,
        b.PhotoUrls, b.OperatingHours, b.IsVerified, b.IsFeatured, b.AverageRating, b.RatingCount);

    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<BusinessResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var (safePage, safePageSize, skip) = PagingDefaults.Normalize(page, pageSize);

        var query = _db.BusinessPartners.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{search.Trim()}%";
            query = query.Where(b =>
                EF.Functions.ILike(b.Name, term) ||
                EF.Functions.ILike(b.City, term) ||
                EF.Functions.ILike(b.Category, term));
        }
        query = query.OrderByDescending(b => b.CreatedAt);

        var totalCount = await query.CountAsync();
        var results = await query.Skip(skip).Take(safePageSize).ToListAsync();
        var items = results.Select(ToResponse).ToList();

        return Ok(new PagedResponse<BusinessResponse>(items, safePage, safePageSize, totalCount, skip + items.Count < totalCount));
    }

    [HttpGet("{id}")]
    [ProducesResponseType(typeof(BusinessResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid id)
    {
        var business = await _db.BusinessPartners.AsNoTracking().FirstOrDefaultAsync(b => b.Id == id);
        if (business is null) return this.NotFoundError("Business not found", "business.not_found");
        return Ok(ToResponse(business));
    }

    [HttpPost]
    [ProducesResponseType(typeof(BusinessResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Create([FromBody] AdminCreateBusinessRequest req)
    {
        var business = new BusinessPartner
        {
            Id = Guid.NewGuid(),
            Name = req.Name,
            Category = req.Category,
            City = req.City,
            District = req.District,
            Description = req.Description,
            PhotoUrls = req.PhotoUrls,
            OperatingHours = req.OperatingHours,
            IsVerified = req.IsVerified,
            IsFeatured = req.IsFeatured,
        };
        _db.BusinessPartners.Add(business);
        await _db.SaveChangesAsync();
        await _audit.LogAsync(User, "CreateBusiness", "BusinessPartner", business.Id.ToString(), business.Name);
        return Ok(ToResponse(business));
    }

    [HttpPut("{id}")]
    [ProducesResponseType(typeof(BusinessResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] AdminUpdateBusinessRequest req)
    {
        var business = await _db.BusinessPartners.FirstOrDefaultAsync(b => b.Id == id);
        if (business is null) return this.NotFoundError("Business not found", "business.not_found");

        business.Name = req.Name;
        business.Category = req.Category;
        business.City = req.City;
        business.District = req.District;
        business.Description = req.Description;
        business.PhotoUrls = req.PhotoUrls;
        business.OperatingHours = req.OperatingHours;
        business.IsVerified = req.IsVerified;
        business.IsFeatured = req.IsFeatured;
        await _db.SaveChangesAsync();
        await _audit.LogAsync(User, "UpdateBusiness", "BusinessPartner", id.ToString(), business.Name);

        return Ok(ToResponse(business));
    }

    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var business = await _db.BusinessPartners.FirstOrDefaultAsync(b => b.Id == id);
        if (business is null) return this.NotFoundError("Business not found", "business.not_found");

        var hasRatings = await _db.BusinessRatings.AnyAsync(r => r.BusinessPartnerId == id);
        if (hasRatings) return this.ConflictError("Cannot delete a business with existing reviews.", "business.has_reviews");

        var name = business.Name;
        _db.BusinessPartners.Remove(business);
        await _db.SaveChangesAsync();
        await _audit.LogAsync(User, "DeleteBusiness", "BusinessPartner", id.ToString(), name);
        return NoContent();
    }

    [HttpPost("bulk-update")]
    [ProducesResponseType(typeof(int), StatusCodes.Status200OK)]
    public async Task<IActionResult> BulkUpdate([FromBody] AdminBulkUpdateBusinessRequest req)
    {
        var businesses = await _db.BusinessPartners.Where(b => req.Ids.Contains(b.Id)).ToListAsync();
        foreach (var b in businesses)
        {
            if (req.IsVerified.HasValue) b.IsVerified = req.IsVerified.Value;
            if (req.IsFeatured.HasValue) b.IsFeatured = req.IsFeatured.Value;
        }
        await _db.SaveChangesAsync();
        await _audit.LogAsync(User, "BulkUpdateBusiness", "BusinessPartner", null,
            $"{businesses.Count} businesses (verified={req.IsVerified}, featured={req.IsFeatured})");

        return Ok(new { updated = businesses.Count });
    }

    [HttpGet("export")]
    [Produces("text/csv")]
    public async Task<IActionResult> Export([FromQuery] string? search)
    {
        var query = _db.BusinessPartners.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = $"%{search.Trim()}%";
            query = query.Where(b =>
                EF.Functions.ILike(b.Name, term) ||
                EF.Functions.ILike(b.City, term) ||
                EF.Functions.ILike(b.Category, term));
        }
        var rows = await query.OrderByDescending(b => b.CreatedAt).ToListAsync();

        var csv = CsvWriter.Write(
            ["Name", "Category", "City", "District", "AverageRating", "RatingCount", "IsVerified", "IsFeatured", "CreatedAt"],
            rows.Select(b => new[]
            {
                b.Name, b.Category, b.City, b.District, b.AverageRating.ToString("0.00"),
                b.RatingCount.ToString(), b.IsVerified.ToString(), b.IsFeatured.ToString(), b.CreatedAt.ToString("O"),
            }));

        await _audit.LogAsync(User, "ExportBusiness", "BusinessPartner", null, $"{rows.Count} rows");
        return File(System.Text.Encoding.UTF8.GetBytes(csv), "text/csv", "business-partners.csv");
    }
}
