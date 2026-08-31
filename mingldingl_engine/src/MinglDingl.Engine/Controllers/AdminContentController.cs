using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("admin/content")]
[Authorize(AuthenticationSchemes = "AdminBearer")]
[Produces("application/json")]
public class AdminContentController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly AdminAuditService _audit;
    public AdminContentController(AppDbContext db, AdminAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    private static ContentPageResponse ToResponse(ContentPage p) =>
        new(p.Slug, p.TitleEn, p.TitleMn, p.BodyEn, p.BodyMn, p.UpdatedAt);

    [HttpGet]
    [ProducesResponseType(typeof(List<ContentPageResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListPages()
    {
        var pages = await _db.ContentPages.AsNoTracking().OrderBy(p => p.Slug).ToListAsync();
        return Ok(pages.Select(ToResponse).ToList());
    }

    [HttpPut("{slug}")]
    [ProducesResponseType(typeof(ContentPageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdatePage(string slug, [FromBody] AdminUpdateContentPageRequest req)
    {
        var page = await _db.ContentPages.FirstOrDefaultAsync(p => p.Slug == slug);
        if (page is null) return this.NotFoundError("Content page not found");

        page.TitleEn = req.TitleEn;
        page.TitleMn = req.TitleMn;
        page.BodyEn = req.BodyEn;
        page.BodyMn = req.BodyMn;
        page.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync(User, "UpdateContent", "ContentPage", slug);

        return Ok(ToResponse(page));
    }
}
