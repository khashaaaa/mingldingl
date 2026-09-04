using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

public class TownSquareEnabledFilterIntegrationTests : IntegrationTestBase
{
    private ActionExecutingContext Run(ConfigService config)
    {
        var service = new TownSquareService(Db, BuildTestBroadcast(), BuildTestPush(), NullLogger<TownSquareService>.Instance, config);
        var actionContext = new ActionContext(new DefaultHttpContext(), new RouteData(), new ActionDescriptor());
        var context = new ActionExecutingContext(actionContext, [], new Dictionary<string, object?>(), controller: null!);
        new TownSquareEnabledFilter(service).OnActionExecuting(context);
        return context;
    }

    [Fact]
    public void OnActionExecuting_Enabled_LetsTheActionRun()
    {
        Assert.Null(Run(new ConfigService()).Result);
    }

    [Fact]
    public void OnActionExecuting_VideoDisabled_ClosesTownSquareToo()
    {
        var config = new ConfigService();
        config.Set("video.enabled", "false");

        var result = Assert.IsType<NotFoundObjectResult>(Run(config).Result);
        Assert.Equal("square.disabled", Assert.IsType<ErrorResponse>(result.Value).Code);
    }

    [Fact]
    public void OnActionExecuting_DisabledInConfig_ShortCircuitsWithNotFoundAndCode()
    {
        var config = new ConfigService();
        config.Set("townsquare.enabled", "false");

        var result = Assert.IsType<NotFoundObjectResult>(Run(config).Result);
        Assert.Equal("square.disabled", Assert.IsType<ErrorResponse>(result.Value).Code);
    }
}
