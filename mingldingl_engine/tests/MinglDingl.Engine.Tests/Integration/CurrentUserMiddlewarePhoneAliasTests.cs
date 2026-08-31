using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace MinglDingl.Engine.Tests.Integration;

public class CurrentUserMiddlewarePhoneAliasTests : IntegrationTestBase
{
    private HttpContext BuildContext(Guid authId, string? phone)
    {
        var claims = new List<Claim> { new("sub", authId.ToString()) };
        if (phone is not null) claims.Add(new Claim("user_metadata", $"{{\"phone\":\"{phone}\"}}"));

        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Bearer")),
            RequestServices = new ServiceCollection().AddSingleton(Db).BuildServiceProvider(),
        };
        context.Response.Body = new MemoryStream();
        return context;
    }

    [Fact]
    public async Task InvokeAsync_ReturningPhone_AliasesNewAuthIdToExistingUser()
    {
        var existingId = Guid.NewGuid();
        Db.Users.Add(new User { Id = existingId, PhoneNumber = "88112233", DisplayName = "Returning", Age = 25 });
        await Db.SaveChangesAsync();
        Db.ChangeTracker.Clear();

        var newAuthId = Guid.NewGuid();
        var context = BuildContext(newAuthId, "88112233");
        var middleware = new CurrentUserMiddleware(_ => Task.CompletedTask);

        await middleware.InvokeAsync(context);

        Assert.Equal(existingId, context.Items["UserId"]);
    }

    [Fact]
    public async Task InvokeAsync_UnknownPhone_TreatsAuthIdAsNewUser()
    {
        var newAuthId = Guid.NewGuid();
        var context = BuildContext(newAuthId, "99009900");
        var middleware = new CurrentUserMiddleware(_ => Task.CompletedTask);

        await middleware.InvokeAsync(context);

        Assert.Equal(newAuthId, context.Items["UserId"]);
    }

    [Fact]
    public async Task InvokeAsync_AuthIdAlreadyOwnsAUser_SkipsPhoneLookup()
    {
        var authId = Guid.NewGuid();
        Db.Users.Add(new User { Id = authId, PhoneNumber = "77001122", DisplayName = "Same session", Age = 30 });
        await Db.SaveChangesAsync();
        Db.ChangeTracker.Clear();

        var context = BuildContext(authId, "77001122");
        var middleware = new CurrentUserMiddleware(_ => Task.CompletedTask);

        await middleware.InvokeAsync(context);

        Assert.Equal(authId, context.Items["UserId"]);
    }
}
