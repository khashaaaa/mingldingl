namespace MinglDingl.Engine.Tests.Integration;

public class PushNotificationServiceIntegrationTests : IntegrationTestBase
{
    // Captures outbound requests instead of hitting Expo's real push API —
    // lets these tests assert whether NotifyUserAsync's now-single-query
    // PushEnabled+PushTokens lookup actually gates the send correctly,
    // without any network dependency.
    private sealed class CapturingHandler : HttpMessageHandler
    {
        public int RequestCount { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestCount++;
            return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK));
        }
    }

    private (PushNotificationService Service, CapturingHandler Handler) BuildService()
    {
        var handler = new CapturingHandler();
        var http = new HttpClient(handler);
        return (new PushNotificationService(http, Db), handler);
    }

    [Fact]
    public async Task NotifyUserAsync_PushEnabledWithTokens_SendsRequest()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.PushEnabled = true;
        Db.Users.Add(user);
        Db.PushTokens.Add(new PushToken { Id = Guid.NewGuid(), UserId = userId, Token = "ExponentPushToken[abc]", Platform = "ios" });
        await Db.SaveChangesAsync();

        var (service, handler) = BuildService();
        await service.NotifyUserAsync(userId, "Title", "Body");

        Assert.Equal(1, handler.RequestCount);
    }

    [Fact]
    public async Task NotifyUserAsync_PushDisabled_DoesNotSendEvenWithTokens()
    {
        // Regression guard for the two-query -> one-query combine: the
        // PushEnabled check must still short-circuit the send, not just get
        // silently dropped once folded into the same query as the token lookup.
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.PushEnabled = false;
        Db.Users.Add(user);
        Db.PushTokens.Add(new PushToken { Id = Guid.NewGuid(), UserId = userId, Token = "ExponentPushToken[abc]", Platform = "ios" });
        await Db.SaveChangesAsync();

        var (service, handler) = BuildService();
        await service.NotifyUserAsync(userId, "Title", "Body");

        Assert.Equal(0, handler.RequestCount);
    }

    [Fact]
    public async Task NotifyUserAsync_PushEnabledButNoTokens_DoesNotSend()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.PushEnabled = true;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        var (service, handler) = BuildService();
        await service.NotifyUserAsync(userId, "Title", "Body");

        Assert.Equal(0, handler.RequestCount);
    }

    [Fact]
    public async Task NotifyUserAsync_UnknownUser_DoesNotSend()
    {
        var (service, handler) = BuildService();
        await service.NotifyUserAsync(Guid.NewGuid(), "Title", "Body");

        Assert.Equal(0, handler.RequestCount);
    }
}
