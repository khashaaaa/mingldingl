using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MinglDingl.Engine.Tests.Integration;

/// <summary>Who may register, keep and drop a device token.</summary>
public class PushRegistrationIntegrationTests : IntegrationTestBase
{
    private const string Token = "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]";

    private PushController Controller(Guid userId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        return new PushController(Db)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
    }

    private async Task<User> UserAsync()
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        await Db.SaveChangesAsync();
        return user;
    }

    /// <summary>
    /// The token is handed to a client, so matching on its value alone let any authenticated
    /// account silence any device whose token it could name.
    /// </summary>
    [Fact]
    public async Task Unregister_CannotDropSomeoneElsesToken()
    {
        var owner = await UserAsync();
        var attacker = await UserAsync();
        await Controller(owner.Id).Register(new RegisterPushTokenDto(Token, "ios"));

        await Controller(attacker.Id).Unregister(new RegisterPushTokenDto(Token, null));

        Assert.True(await Db.PushTokens.AnyAsync(t => t.Token == Token && t.UserId == owner.Id));
    }

    [Fact]
    public async Task Unregister_DropsTheCallersOwnToken()
    {
        var owner = await UserAsync();
        await Controller(owner.Id).Register(new RegisterPushTokenDto(Token, "ios"));

        await Controller(owner.Id).Unregister(new RegisterPushTokenDto(Token, null));

        Assert.False(await Db.PushTokens.AnyAsync(t => t.Token == Token));
    }

    [Theory]
    [InlineData("not-a-token")]
    [InlineData("ExponentPushToken[]")]
    [InlineData("<script>alert(1)</script>")]
    public async Task Register_RefusesAnythingThatIsNotAnExpoToken(string token)
    {
        var user = await UserAsync();
        var result = await Controller(user.Id).Register(new RegisterPushTokenDto(token, "android"));

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("push.token_invalid", Assert.IsType<ErrorResponse>(bad.Value).Code);
        Assert.False(await Db.PushTokens.AnyAsync(t => t.Token == token));
    }

    /// <summary>
    /// Registration is client-driven, so without a cap one account grows the table without bound
    /// and every push it earns fans out across all of it.
    /// </summary>
    [Fact]
    public async Task Register_KeepsOnlyTheMostRecentDevices()
    {
        var user = await UserAsync();
        var controller = Controller(user.Id);
        for (int i = 0; i < 14; i++)
            await controller.Register(new RegisterPushTokenDto($"ExponentPushToken[device{i:D4}xxxxxxxxxxxx]", "android"));

        var mine = await Db.PushTokens.Where(t => t.UserId == user.Id).ToListAsync();
        Assert.Equal(10, mine.Count);
        Assert.Contains(mine, t => t.Token.Contains("device0013"));
        Assert.DoesNotContain(mine, t => t.Token.Contains("device0000"));
    }

    /// <summary>Two people share a phone: the token follows whoever signed in last.</summary>
    [Fact]
    public async Task Register_MovesAnExistingTokenToTheNewOwner()
    {
        var first = await UserAsync();
        var second = await UserAsync();
        await Controller(first.Id).Register(new RegisterPushTokenDto(Token, "ios"));

        await Controller(second.Id).Register(new RegisterPushTokenDto(Token, "ios"));

        var row = await Db.PushTokens.SingleAsync(t => t.Token == Token);
        Assert.Equal(second.Id, row.UserId);
    }

    /// <summary>
    /// A suspended account cannot open the app to act on anything it is told, and a stream of
    /// "you have a new message" to someone who has been thrown out is worse than silence.
    /// </summary>
    [Fact]
    public async Task ABannedUser_IsNotPushed()
    {
        var user = await UserAsync();
        await Controller(user.Id).Register(new RegisterPushTokenDto(Token, "ios"));
        user.IsBanned = true;
        await Db.SaveChangesAsync();

        var (push, handler) = BuildCapturingPush();
        await push.NotifyUserAsync(user.Id, PushKind.NewMatch, null, "Someone");

        Assert.Equal(0, handler.RequestCount);
    }
}
