using Microsoft.AspNetCore.Mvc;

namespace MinglDingl.Engine.Tests.Integration;

public class AdminAuditLogControllerIntegrationTests : IntegrationTestBase
{
    [Fact]
    public async Task List_ReturnsEntriesMostRecentFirst()
    {
        Db.AdminAuditLogs.Add(new AdminAuditLog
        {
            Id = Guid.NewGuid(), AdminUsername = "tester", Action = "OldAction",
            EntityType = "Test", EntityId = "1", CreatedAt = DateTime.UtcNow.AddDays(-1),
        });
        Db.AdminAuditLogs.Add(new AdminAuditLog
        {
            Id = Guid.NewGuid(), AdminUsername = "tester", Action = "NewAction",
            EntityType = "Test", EntityId = "2", CreatedAt = DateTime.UtcNow,
        });
        await Db.SaveChangesAsync();

        var controller = new AdminAuditLogController(Db);
        var result = Assert.IsType<OkObjectResult>(await controller.List(1, 50));
        var page = Assert.IsType<PagedResponse<AdminAuditLogDto>>(result.Value);

        var ours = page.Items.Where(i => i.EntityType == "Test").ToList();
        Assert.Equal(2, ours.Count);
        Assert.Equal("NewAction", ours[0].Action);
        Assert.Equal("tester", ours[0].AdminUsername);
    }

    [Fact]
    public async Task List_RecordsWrittenByAdminAuditService()
    {
        var audit = new AdminAuditService(Db);
        var admin = new System.Security.Claims.ClaimsPrincipal(
            new System.Security.Claims.ClaimsIdentity([new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Name, "tester")], "AdminBearer"));

        await audit.LogAsync(admin, "TestAction", "Test", "42", "some details");

        var controller = new AdminAuditLogController(Db);
        var result = Assert.IsType<OkObjectResult>(await controller.List(1, 50));
        var page = Assert.IsType<PagedResponse<AdminAuditLogDto>>(result.Value);

        var entry = page.Items.Single(i => i.EntityType == "Test" && i.EntityId == "42");
        Assert.Equal("tester", entry.AdminUsername);
        Assert.Equal("some details", entry.Details);
    }
}
