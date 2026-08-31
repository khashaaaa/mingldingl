using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MinglDingl.Engine.Tests.Integration;

public class HealthControllerIntegrationTests : IntegrationTestBase
{
    private static AppDbContext BuildUnreachableDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=127.0.0.1;Port=1;Database=mingldingl;Username=postgres;Password=1234;Timeout=1")
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.CoreEventId.ManyServiceProvidersCreatedWarning))
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task Get_DatabaseReachable_ReturnsOk()
    {
        var controller = new HealthController(Db);

        var result = await controller.Get();

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = Assert.IsType<HealthResponse>(ok.Value);
        Assert.Equal("ok", body.Status);
    }

    [Fact]
    public async Task Get_DatabaseUnreachable_Returns503Unhealthy()
    {
        await using var brokenDb = BuildUnreachableDb();
        var controller = new HealthController(brokenDb);

        var result = await controller.Get();

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, objectResult.StatusCode);
        var body = Assert.IsType<HealthResponse>(objectResult.Value);
        Assert.Equal("unhealthy", body.Status);
    }
}
