using Microsoft.AspNetCore.Mvc;

namespace MinglDingl.Engine.Tests.Integration;

public class AdminBusinessControllerIntegrationTests : IntegrationTestBase
{
    private AdminBusinessController BuildController() => new(Db, new AdminAuditService(Db));

    private static AdminCreateBusinessRequest SampleCreateRequest(string name = "Test Cafe") => new(
        name, "Cafe", "Ulaanbaatar", "Khan-Uul", "A nice cafe",
        ["https://example.com/1.jpg"], "9am-9pm", IsVerified: false, IsFeatured: false);

    [Fact]
    public async Task Create_ThenList_IncludesUnverifiedListing()
    {
        await BuildController().Create(SampleCreateRequest());

        var result = Assert.IsType<OkObjectResult>(await BuildController().List(null, 1, 20));
        var page = Assert.IsType<PagedResponse<BusinessResponse>>(result.Value);

        Assert.Contains(page.Items, b => b.Name == "Test Cafe" && !b.IsVerified);
    }

    [Fact]
    public async Task List_FiltersBySearchTerm()
    {
        await BuildController().Create(SampleCreateRequest("Searchable Coffee House"));
        await BuildController().Create(SampleCreateRequest("Something Else"));

        var result = Assert.IsType<OkObjectResult>(await BuildController().List("searchable", 1, 20));
        var page = Assert.IsType<PagedResponse<BusinessResponse>>(result.Value);

        Assert.Contains(page.Items, b => b.Name == "Searchable Coffee House");
        Assert.DoesNotContain(page.Items, b => b.Name == "Something Else");
    }

    [Fact]
    public async Task Update_ChangesFields()
    {
        var createResult = Assert.IsType<OkObjectResult>(await BuildController().Create(SampleCreateRequest()));
        var created = Assert.IsType<BusinessResponse>(createResult.Value);

        var updateReq = new AdminUpdateBusinessRequest(
            "Renamed Cafe", "Cafe", "Ulaanbaatar", "Khan-Uul", "Updated description",
            ["https://example.com/2.jpg"], "8am-10pm", IsVerified: true, IsFeatured: true);
        var result = Assert.IsType<OkObjectResult>(await BuildController().Update(created.Id, updateReq));
        var updated = Assert.IsType<BusinessResponse>(result.Value);

        Assert.Equal("Renamed Cafe", updated.Name);
        Assert.True(updated.IsVerified);
        Assert.True(updated.IsFeatured);
    }

    [Fact]
    public async Task Delete_NoRatings_Succeeds()
    {
        var createResult = Assert.IsType<OkObjectResult>(await BuildController().Create(SampleCreateRequest()));
        var created = Assert.IsType<BusinessResponse>(createResult.Value);

        var result = await BuildController().Delete(created.Id);
        Assert.IsType<NoContentResult>(result);
    }

    [Fact]
    public async Task Delete_WithExistingRatings_ReturnsConflict()
    {
        var createResult = Assert.IsType<OkObjectResult>(await BuildController().Create(SampleCreateRequest()));
        var created = Assert.IsType<BusinessResponse>(createResult.Value);

        var user = NewCompleteUser();
        Db.Users.Add(user);
        Db.BusinessRatings.Add(new BusinessRating
        {
            Id = Guid.NewGuid(),
            BusinessPartnerId = created.Id,
            UserId = user.Id,
            Stars = 5,
        });
        await Db.SaveChangesAsync();

        var result = await BuildController().Delete(created.Id);
        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact]
    public async Task Get_UnknownId_ReturnsNotFound()
    {
        var result = await BuildController().Get(Guid.NewGuid());
        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task BulkUpdate_AppliesVerifiedAndFeaturedToAllGivenIds()
    {
        var a = Assert.IsType<BusinessResponse>(Assert.IsType<OkObjectResult>(await BuildController().Create(SampleCreateRequest("A"))).Value);
        var b = Assert.IsType<BusinessResponse>(Assert.IsType<OkObjectResult>(await BuildController().Create(SampleCreateRequest("B"))).Value);

        var result = await BuildController().BulkUpdate(new AdminBulkUpdateBusinessRequest([a.Id, b.Id], IsVerified: true, IsFeatured: null));
        var ok = Assert.IsType<OkObjectResult>(result);

        var updatedA = await Db.BusinessPartners.FindAsync(a.Id);
        var updatedB = await Db.BusinessPartners.FindAsync(b.Id);
        Assert.True(updatedA!.IsVerified);
        Assert.True(updatedB!.IsVerified);
    }

    [Fact]
    public async Task Export_ReturnsCsvWithHeaderAndRow()
    {
        await BuildController().Create(SampleCreateRequest("CSV Test Cafe"));

        var result = Assert.IsType<FileContentResult>(await BuildController().Export(null));
        var csv = System.Text.Encoding.UTF8.GetString(result.FileContents);

        Assert.StartsWith("Name,Category,City", csv);
        Assert.Contains("CSV Test Cafe", csv);
    }
}
