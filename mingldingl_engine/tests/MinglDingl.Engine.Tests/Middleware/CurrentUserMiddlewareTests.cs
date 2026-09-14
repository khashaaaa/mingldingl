using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using System.Security.Claims;
using MinglDingl.Engine.Tests.Integration;

namespace MinglDingl.Engine.Tests;

public class CurrentUserMiddlewareTests : IntegrationTestBase
{
    private HttpContext BuildContext(ClaimsIdentity identity)
    {
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(identity),
            RequestServices = new ServiceCollection().AddSingleton(Db).BuildServiceProvider(),
        };
        context.Response.Body = new MemoryStream();
        return context;
    }

    [Fact]
    public async Task InvokeAsync_Unauthenticated_PassesThroughWithoutSettingUserId()
    {
        var context = BuildContext(new ClaimsIdentity());
        var nextCalled = false;
        var middleware = new CurrentUserMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });

        await middleware.InvokeAsync(context);

        Assert.True(nextCalled);
        Assert.False(context.Items.ContainsKey("UserId"));
        Assert.Equal(200, context.Response.StatusCode);
    }

    [Fact]
    public async Task InvokeAsync_AuthenticatedWithValidSub_SetsUserIdAndCallsNext()
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var context = BuildContext(new ClaimsIdentity([new Claim("sub", user.Id.ToString())], "Bearer"));
        var nextCalled = false;
        var middleware = new CurrentUserMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });

        await middleware.InvokeAsync(context);

        Assert.True(nextCalled);
        Assert.Equal(user.Id, context.Items["UserId"]);
    }

    /// <summary>
    /// The sweep anonymises a deleted account, but the identity that created it keeps a valid JWT —
    /// letting it through meant POST /users simply refilled the "deleted" account.
    /// </summary>
    [Fact]
    public async Task InvokeAsync_DeletedAccount_ShortCircuitsWith403AccountDeleted()
    {
        var user = NewCompleteUser();
        user.IsDeleted = true;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var context = BuildContext(new ClaimsIdentity([new Claim("sub", user.Id.ToString())], "Bearer"));
        var nextCalled = false;
        await new CurrentUserMiddleware(_ => { nextCalled = true; return Task.CompletedTask; }).InvokeAsync(context);

        Assert.False(nextCalled);
        Assert.Equal(403, context.Response.StatusCode);
        context.Response.Body.Position = 0;
        Assert.Contains("account.deleted", await new StreamReader(context.Response.Body).ReadToEndAsync());
    }

    [Fact]
    public async Task InvokeAsync_BannedUser_ShortCircuitsWith403()
    {
        var user = NewCompleteUser();
        user.IsBanned = true;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var context = BuildContext(new ClaimsIdentity([new Claim("sub", user.Id.ToString())], "Bearer"));
        var nextCalled = false;
        var middleware = new CurrentUserMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });

        await middleware.InvokeAsync(context);

        Assert.False(nextCalled);
        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);
        Assert.False(context.Items.ContainsKey("UserId"));

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        Assert.Contains("suspended", body);
    }

    [Fact]
    public async Task InvokeAsync_AuthenticatedWithNoParseableSub_ShortCircuitsWith401()
    {
        var context = BuildContext(new ClaimsIdentity([], "Bearer"));
        var nextCalled = false;
        var middleware = new CurrentUserMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });

        await middleware.InvokeAsync(context);

        Assert.False(nextCalled);
        Assert.Equal(StatusCodes.Status401Unauthorized, context.Response.StatusCode);
        Assert.False(context.Items.ContainsKey("UserId"));

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        Assert.Contains("Invalid authentication token", body);
    }

    [Fact]
    public void ExtractUserId_WithValidSubClaim_ReturnsParsedGuid()
    {
        var userId = Guid.NewGuid();
        var claims = new[] { new Claim("sub", userId.ToString()) };
        var identity = new ClaimsIdentity(claims, "test");
        var principal = new ClaimsPrincipal(identity);

        var result = CurrentUserMiddleware.ExtractUserId(principal);

        Assert.Equal(userId, result);
    }

    [Fact]
    public void ExtractUserId_WithMissingSubClaim_ReturnsNull()
    {
        var principal = new ClaimsPrincipal();
        var result = CurrentUserMiddleware.ExtractUserId(principal);
        Assert.Null(result);
    }
}
