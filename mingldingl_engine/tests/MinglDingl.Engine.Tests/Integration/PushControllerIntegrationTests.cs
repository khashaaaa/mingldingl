using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MinglDingl.Engine.Tests.Integration;

public class PushControllerIntegrationTests : IntegrationTestBase
{
    private PushController BuildController(Guid userId)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;

        var controller = new PushController(Db)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
        return controller;
    }

    [Fact]
    public async Task Register_MissingToken_ReturnsBadRequest()
    {
        var userId = Guid.NewGuid();
        var controller = BuildController(userId);

        var result = await controller.Register(new RegisterPushTokenDto("   ", "ios"));

        Assert.Equal(400, Assert.IsType<BadRequestObjectResult>(result).StatusCode);
    }

    [Fact]
    public async Task Register_NewToken_CreatesRowOwnedByCaller()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        var result = await controller.Register(new RegisterPushTokenDto("ExponentPushToken[abc]", "ios"));

        Assert.IsType<OkResult>(result);

        var stored = await Db.PushTokens.AsNoTracking().SingleAsync(t => t.Token == "ExponentPushToken[abc]");
        Assert.Equal(userId, stored.UserId);
        Assert.Equal("ios", stored.Platform);
    }

    [Fact]
    public async Task Register_ExistingTokenReRegisteredByDifferentUser_MovesOwnershipToNewCaller()
    {
        // PushController.Register upserts strictly by token, not by (userId, token):
        // the same physical device token re-registering under a different account
        // (e.g. sign-out/sign-in as someone else on the same phone) must move
        // ownership to the new caller rather than leaving the old owner's row in
        // place or creating a duplicate row.
        var originalOwnerId = Guid.NewGuid();
        var newOwnerId = Guid.NewGuid();
        Db.Users.AddRange(NewCompleteUser(originalOwnerId), NewCompleteUser(newOwnerId));
        const string sharedToken = "ExponentPushToken[shared-device]";
        Db.PushTokens.Add(new PushToken { Id = Guid.NewGuid(), UserId = originalOwnerId, Token = sharedToken, Platform = "ios" });
        await Db.SaveChangesAsync();

        var controller = BuildController(newOwnerId);
        var result = await controller.Register(new RegisterPushTokenDto(sharedToken, "android"));

        Assert.IsType<OkResult>(result);

        var rows = await Db.PushTokens.AsNoTracking().Where(t => t.Token == sharedToken).ToListAsync();
        var row = Assert.Single(rows);
        Assert.Equal(newOwnerId, row.UserId);
        Assert.Equal("android", row.Platform);
    }

    [Fact]
    public async Task Register_ExistingTokenReRegisteredWithNullPlatform_KeepsPreviousPlatform()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        const string token = "ExponentPushToken[keep-platform]";
        Db.PushTokens.Add(new PushToken { Id = Guid.NewGuid(), UserId = userId, Token = token, Platform = "ios" });
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        var result = await controller.Register(new RegisterPushTokenDto(token, null));

        Assert.IsType<OkResult>(result);

        var stored = await Db.PushTokens.AsNoTracking().SingleAsync(t => t.Token == token);
        Assert.Equal("ios", stored.Platform);
    }

    [Fact]
    public async Task Unregister_ExistingToken_RemovesRow()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        const string token = "ExponentPushToken[to-remove]";
        Db.PushTokens.Add(new PushToken { Id = Guid.NewGuid(), UserId = userId, Token = token, Platform = "ios" });
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        var result = await controller.Unregister(new RegisterPushTokenDto(token, null));

        Assert.IsType<OkResult>(result);
        Assert.False(await Db.PushTokens.AsNoTracking().AnyAsync(t => t.Token == token));
    }

    [Fact]
    public async Task Unregister_UnknownToken_IsNoopAndStillReturnsOk()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();

        var controller = BuildController(userId);
        var result = await controller.Unregister(new RegisterPushTokenDto("ExponentPushToken[never-registered]", null));

        Assert.IsType<OkResult>(result);
    }
}
