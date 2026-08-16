using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

// Serves admin-editable static pages (Terms of Service, Privacy Policy,
// in-app Guides) that the app fetches instead of bundling — see
// ContentPage.cs for why. No write endpoint yet; rows are seeded via
// migration until an admin dashboard exists to edit them.
[ApiController]
[Route("content")]
[Authorize]
[Produces("application/json")]
public class ContentController : ControllerBase
{
    private readonly AppDbContext _db;
    public ContentController(AppDbContext db) => _db = db;

    [HttpGet("{slug}")]
    [ProducesResponseType(typeof(ContentPageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetBySlug(string slug)
    {
        var page = await _db.ContentPages.AsNoTracking().FirstOrDefaultAsync(p => p.Slug == slug);
        if (page is null) return this.NotFoundError("Content page not found");
        return Ok(new ContentPageResponse(page.Slug, page.TitleEn, page.TitleMn, page.BodyEn, page.BodyMn, page.UpdatedAt));
    }
}
