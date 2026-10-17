using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Tests.Infrastructure;

namespace MinglDingl.Engine.Tests.Kernel;

public class ErrorMiddlewareTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    private sealed record ErrorBody(string Code, string Message);

    [Fact]
    public async Task Domain_exception_maps_to_its_status_and_code()
    {
        await using var f = new EngineFactory(db).WithEndpoint("/__throw",
            () => { throw new DomainException(409, "test.rule", "Rule broken"); });
        var r = await f.Client().GetAsync("/__throw");
        r.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await r.Content.ReadFromJsonAsync<ErrorBody>()).Should().Be(new ErrorBody("test.rule", "Rule broken"));
    }

    [Fact]
    public async Task Unknown_exception_is_a_generic_500()
    {
        await using var f = new EngineFactory(db).WithEndpoint("/__boom",
            () => { throw new InvalidOperationException("secret detail"); });
        var r = await f.Client().GetAsync("/__boom");
        r.StatusCode.Should().Be(HttpStatusCode.InternalServerError);
        var body = await r.Content.ReadAsStringAsync();
        body.Should().NotContain("secret detail").And.Contain("server.error");
    }

    [Fact]
    public async Task Health_is_ok()
    {
        await using var f = new EngineFactory(db);
        var r = await f.Client().GetAsync("/health");
        r.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
