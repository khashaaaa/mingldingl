using Microsoft.AspNetCore.Mvc;

namespace MinglDingl.Engine.Tests.Integration;

public class ContentControllerIntegrationTests : IntegrationTestBase
{
    [Fact]
    public async Task GetBySlug_Guides_ReturnsSeededBilingualContent()
    {
        var controller = new ContentController(Db);
        var result = Assert.IsType<OkObjectResult>(await controller.GetBySlug("guides"));
        var body = Assert.IsType<ContentPageResponse>(result.Value);

        Assert.Equal("guides", body.Slug);
        Assert.Equal("Guides", body.TitleEn);
        Assert.False(string.IsNullOrWhiteSpace(body.BodyEn));
        Assert.False(string.IsNullOrWhiteSpace(body.BodyMn));
    }

    [Fact]
    public async Task GetBySlug_UnknownSlug_ReturnsNotFound()
    {
        var controller = new ContentController(Db);
        var result = await controller.GetBySlug("does-not-exist");

        Assert.IsType<NotFoundObjectResult>(result);
    }
}
