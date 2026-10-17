using FluentAssertions;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Tests.Infrastructure;

namespace MinglDingl.Engine.Tests.Kernel;

public class CorsTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    [Fact]
    public void Production_without_allowed_origins_fails_startup()
    {
        using var f = new EngineFactory(db).WithEnvironment("Production");
        var act = () => f.Client();
        act.Should().Throw<Exception>().Where(e => e.ToString().Contains("Cors:AllowedOrigins"));
    }

    [Fact]
    public void Origins_parse_from_comma_list_or_array()
    {
        CorsOrigins.Parse("https://a.example, https://b.example", []).Should().Equal("https://a.example", "https://b.example");
        CorsOrigins.Parse(null, ["https://c.example"]).Should().Equal("https://c.example");
        CorsOrigins.Parse("", []).Should().BeEmpty();
    }

    [Fact]
    public async Task Allowed_origin_gets_cors_headers()
    {
        await using var f = new EngineFactory(db).WithSetting("Cors:AllowedOrigins", "http://localhost:5173");
        var req = new HttpRequestMessage(HttpMethod.Options, "/admin/auth/login");
        req.Headers.Add("Origin", "http://localhost:5173");
        req.Headers.Add("Access-Control-Request-Method", "POST");
        var r = await f.Client().SendAsync(req);
        r.Headers.GetValues("Access-Control-Allow-Origin").Should().Equal("http://localhost:5173");
    }
}
