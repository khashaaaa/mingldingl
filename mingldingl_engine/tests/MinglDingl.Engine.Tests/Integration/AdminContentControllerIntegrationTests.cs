using Microsoft.AspNetCore.Mvc;

namespace MinglDingl.Engine.Tests.Integration;

public class AdminContentControllerIntegrationTests : IntegrationTestBase
{
    private AdminContentController BuildController() => new(Db, new AdminAuditService(Db));

    private const string TestSlug = "integration-test-page";

    [Fact]
    public async Task ListPages_ReturnsAllSeededPages()
    {
        Db.ContentPages.Add(new ContentPage { Id = Guid.NewGuid(), Slug = TestSlug, TitleEn = "Terms", TitleMn = "Nөхцөл" });
        await Db.SaveChangesAsync();

        var result = Assert.IsType<OkObjectResult>(await BuildController().ListPages());
        var pages = Assert.IsType<List<ContentPageResponse>>(result.Value);

        Assert.Contains(pages, p => p.Slug == TestSlug);
    }

    [Fact]
    public async Task UpdatePage_ChangesBodyAndUpdatedAt()
    {
        var page = new ContentPage { Id = Guid.NewGuid(), Slug = TestSlug, TitleEn = "Guides", TitleMn = "Заавар", UpdatedAt = DateTime.UtcNow.AddDays(-1) };
        Db.ContentPages.Add(page);
        await Db.SaveChangesAsync();

        var req = new AdminUpdateContentPageRequest("New Title", "Шинэ гарчиг", "New body", "Шинэ агуулга");
        var result = Assert.IsType<OkObjectResult>(await BuildController().UpdatePage(TestSlug, req));
        var updated = Assert.IsType<ContentPageResponse>(result.Value);

        Assert.Equal("New Title", updated.TitleEn);
        Assert.Equal("New body", updated.BodyEn);
        Assert.True(updated.UpdatedAt > DateTime.UtcNow.AddMinutes(-1));
    }

    [Fact]
    public async Task UpdatePage_UnknownSlug_ReturnsNotFound()
    {
        var req = new AdminUpdateContentPageRequest("x", "x", "x", "x");
        var result = await BuildController().UpdatePage("nonexistent", req);
        Assert.IsType<NotFoundObjectResult>(result);
    }
}
