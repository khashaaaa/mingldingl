using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Auth;

/// The day's text budget across every number. Its own class (its own database): the low cap set
/// here must reach no other test.
public class TextCapTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task Past_the_days_budget_no_number_is_texted_until_tomorrow()
    {
        await using var f = new EngineFactory(db); var ws = f.UseScriptedWeSend();
        var c = f.Client();
        await f.SetConfigAsync(ConfigKeys.CodesPerDay, "10");
        for (var i = 0; i < 10; i++) await c.StartAsync(SessionDriver.NewPhone());

        var over = await c.PostAsJsonAsync("/auth/phone/start", new StartRequest(SessionDriver.NewPhone(), null));
        over.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        (await CodeOf(over)).Should().Be("auth.too_many_codes");
        ws.SendCalls.Should().Be(10);

        f.Clock.Advance(TimeSpan.FromDays(1));
        await c.StartAsync(SessionDriver.NewPhone());
    }
}
