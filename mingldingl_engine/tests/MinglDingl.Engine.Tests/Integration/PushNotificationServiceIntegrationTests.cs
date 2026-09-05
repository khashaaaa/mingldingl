using Microsoft.EntityFrameworkCore;
namespace MinglDingl.Engine.Tests.Integration;

public class PushNotificationServiceIntegrationTests : IntegrationTestBase
{
    private sealed class RecordingDispatcher : IPushDispatcher
    {
        public List<PushEnvelope> Envelopes { get; } = [];
        public ValueTask DispatchAsync(PushEnvelope envelope, CancellationToken ct = default)
        {
            Envelopes.Add(envelope);
            return ValueTask.CompletedTask;
        }
    }

    private static string ExpoTickets(params string[] statuses)
    {
        var tickets = statuses.Select(s => s == "ok"
            ? "{\"status\":\"ok\",\"id\":\"ticket\"}"
            : $"{{\"status\":\"error\",\"message\":\"boom\",\"details\":{{\"error\":\"{s}\"}}}}");
        return "{\"data\":[" + string.Join(",", tickets) + "]}";
    }

    private static PushEnvelope Envelope(params string[] tokens) =>
        new(tokens, "Title", "Body", new Dictionary<string, object> { ["type"] = "match" });

    [Fact]
    public async Task NotifyUserAsync_HandsTheEnvelopeToTheDispatcher_AndSendsNothingItself()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();
        var token = await RegisterPushTokenAsync(userId);

        var dispatcher = new RecordingDispatcher();
        var service = new PushNotificationService(Db, dispatcher);
        await service.NotifyUserAsync(userId, PushKind.NewMatch, new Dictionary<string, object> { ["matchId"] = "m1" }, "Bat");

        var envelope = Assert.Single(dispatcher.Envelopes);
        Assert.Equal([token], envelope.Tokens);
        Assert.Equal("New Match!", envelope.Title);
        Assert.Equal("Bat sent you a summons.", envelope.Body);
        Assert.Equal("match", envelope.Data["type"]);
        Assert.Equal("m1", envelope.Data["matchId"]);
    }

    [Fact]
    public async Task NotifyUserAsync_UserPrefersMongolian_SendsTheMongolianCopy()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.PreferredLocale = "mn";
        Db.Users.Add(user);
        await Db.SaveChangesAsync();
        await RegisterPushTokenAsync(userId);

        var (service, handler) = BuildCapturingPush();
        await service.NotifyUserAsync(userId, PushKind.NewMatch, null, "Bat");

        var expected = PushCopy.For(PushKind.NewMatch, "mn", "Bat");
        Assert.NotNull(handler.LastRequestBody);
        var sent = System.Text.Json.JsonDocument.Parse(handler.LastRequestBody!).RootElement[0];
        Assert.Equal(expected.Title, sent.GetProperty("title").GetString());
        Assert.Equal(expected.Body, sent.GetProperty("body").GetString());
        Assert.Contains("Bat", expected.Body);
    }

    [Fact]
    public async Task NotifyUserAsync_UserWithNoPreference_SendsEnglish()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();
        await RegisterPushTokenAsync(userId);

        var (service, handler) = BuildCapturingPush();
        await service.NotifyUserAsync(userId, PushKind.NewMatch, null, "Bat");

        var sent = System.Text.Json.JsonDocument.Parse(handler.LastRequestBody!).RootElement[0];
        Assert.Equal(PushCopy.For(PushKind.NewMatch, "en", "Bat").Title, sent.GetProperty("title").GetString());
        Assert.Equal("New Match!", sent.GetProperty("title").GetString());
    }

    [Fact]
    public async Task NotifyUserAsync_TagsTheDataWithTheKindsWireType()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();
        await RegisterPushTokenAsync(userId);

        var (service, handler) = BuildCapturingPush();
        await service.NotifyUserAsync(userId, PushKind.FlameRiteAccepted, new Dictionary<string, object> { ["matchId"] = "m1" });

        var data = System.Text.Json.JsonDocument.Parse(handler.LastRequestBody!).RootElement[0].GetProperty("data");
        Assert.Equal("flame_rite_accepted", data.GetProperty("type").GetString());
        Assert.Equal("m1", data.GetProperty("matchId").GetString());
    }

    [Fact]
    public void PushCopy_EveryKindHasDistinctMongolianAndEnglishCopy()
    {
        foreach (var kind in Enum.GetValues<PushKind>())
        {
            var en = PushCopy.For(kind, "en", "Arg1", "Arg2");
            var mn = PushCopy.For(kind, "mn", "Arg1", "Arg2");
            Assert.False(string.IsNullOrWhiteSpace(en.Title), $"{kind} has no English title");
            Assert.False(string.IsNullOrWhiteSpace(mn.Body), $"{kind} has no Mongolian body");
            if (kind != PushKind.NewMessage)
                Assert.NotEqual(en.Body, mn.Body);
        }
    }

    [Fact]
    public async Task NotifyUserAsync_PushEnabledWithTokens_SendsRequest()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.PushEnabled = true;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();
        await RegisterPushTokenAsync(userId);

        var (service, handler) = BuildCapturingPush();
        await service.NotifyUserAsync(userId, PushKind.NewMatch, null, "Someone");

        Assert.Equal(1, handler.RequestCount);
    }

    [Fact]
    public async Task NotifyUserAsync_PushDisabled_DoesNotSendEvenWithTokens()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.PushEnabled = false;
        Db.Users.Add(user);
        await Db.SaveChangesAsync();
        await RegisterPushTokenAsync(userId);

        var (service, handler) = BuildCapturingPush();
        await service.NotifyUserAsync(userId, PushKind.NewMatch, null, "Someone");

        Assert.Equal(0, handler.RequestCount);
    }

    [Fact]
    public async Task NotifyUserAsync_PushEnabledButNoTokens_DoesNotSend()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();

        var (service, handler) = BuildCapturingPush();
        await service.NotifyUserAsync(userId, PushKind.NewMatch, null, "Someone");

        Assert.Equal(0, handler.RequestCount);
    }

    [Fact]
    public async Task NotifyUserAsync_UnknownUser_DoesNotSend()
    {
        var (service, handler) = BuildCapturingPush();
        await service.NotifyUserAsync(Guid.NewGuid(), PushKind.NewMatch, null, "Someone");

        Assert.Equal(0, handler.RequestCount);
    }

    [Fact]
    public async Task DeliverAsync_ExpoReportsDeviceNotRegistered_DeletesThatTokenOnly()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();
        var live = await RegisterPushTokenAsync(userId);
        const string dead = "ExponentPushToken[uninstalled]";
        Db.PushTokens.Add(new PushToken { Id = Guid.NewGuid(), UserId = userId, Token = dead, Platform = "android" });
        await Db.SaveChangesAsync();

        var handler = new RecordingHandler { Respond = _ => Json(ExpoTickets("ok", "DeviceNotRegistered")) };
        await BuildPushDispatch(Db, handler).DeliverAsync(Envelope(live, dead), CancellationToken.None);

        Db.ChangeTracker.Clear();
        Assert.True(await Db.PushTokens.AnyAsync(t => t.Token == live));
        Assert.False(await Db.PushTokens.AnyAsync(t => t.Token == dead));
    }

    [Fact]
    public async Task DeliverAsync_ExpoReportsAnotherError_KeepsTheToken()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();
        var token = await RegisterPushTokenAsync(userId);

        var handler = new RecordingHandler { Respond = _ => Json(ExpoTickets("MessageRateExceeded")) };
        await BuildPushDispatch(Db, handler).DeliverAsync(Envelope(token), CancellationToken.None);

        Db.ChangeTracker.Clear();
        Assert.True(await Db.PushTokens.AnyAsync(t => t.Token == token));
    }

    [Fact]
    public async Task DeliverAsync_ExpoUnreachable_SwallowsTheFailureAndKeepsTheToken()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();
        var token = await RegisterPushTokenAsync(userId);

        var handler = new RecordingHandler { Respond = _ => throw new HttpRequestException("down") };
        await BuildPushDispatch(Db, handler).DeliverAsync(Envelope(token), CancellationToken.None);

        Db.ChangeTracker.Clear();
        Assert.True(await Db.PushTokens.AnyAsync(t => t.Token == token));
    }

    [Fact]
    public async Task DispatchAsync_QueuedEnvelopeIsDeliveredByTheBackgroundLoop()
    {
        var handler = new RecordingHandler();
        var service = BuildPushDispatch(Db, handler);
        await service.StartAsync(CancellationToken.None);

        await service.DispatchAsync(Envelope("ExponentPushToken[abc]"));
        var deadline = DateTime.UtcNow.AddSeconds(5);
        while (handler.RequestCount == 0 && DateTime.UtcNow < deadline)
            await Task.Delay(20);
        await service.StopAsync(CancellationToken.None);

        Assert.Equal(1, handler.RequestCount);
        Assert.Contains("ExponentPushToken[abc]", handler.LastRequestBody);
    }

    [Fact]
    public async Task DeliverAsync_ExpoTimesOut_SwallowsTheFailureInsteadOfEscaping()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(NewCompleteUser(userId));
        await Db.SaveChangesAsync();
        var token = await RegisterPushTokenAsync(userId);

        // HttpClient reports its own `Timeout` as a TaskCanceledException, which *is* an
        // OperationCanceledException. Letting that escape faults the background loop.
        var handler = new RecordingHandler { Respond = _ => throw new TaskCanceledException("timed out", new TimeoutException()) };
        await BuildPushDispatch(Db, handler).DeliverAsync(Envelope(token), CancellationToken.None);

        Db.ChangeTracker.Clear();
        Assert.True(await Db.PushTokens.AnyAsync(t => t.Token == token));
    }

    [Fact]
    public async Task DispatchAsync_AfterExpoTimesOut_TheLoopStillDeliversTheNextEnvelope()
    {
        var calls = 0;
        var handler = new RecordingHandler
        {
            Respond = _ => ++calls == 1
                ? throw new TaskCanceledException("timed out", new TimeoutException())
                : new HttpResponseMessage(System.Net.HttpStatusCode.OK),
        };
        var service = BuildPushDispatch(Db, handler);
        await service.StartAsync(CancellationToken.None);

        await service.DispatchAsync(Envelope("ExponentPushToken[slow]"));
        await service.DispatchAsync(Envelope("ExponentPushToken[after]"));
        var deadline = DateTime.UtcNow.AddSeconds(5);
        while (handler.RequestCount < 2 && DateTime.UtcNow < deadline)
            await Task.Delay(20);
        await service.StopAsync(CancellationToken.None);

        Assert.Equal(2, handler.RequestCount);
        Assert.Contains("ExponentPushToken[after]", handler.LastRequestBody);
    }

    private static HttpResponseMessage Json(string body) =>
        new(System.Net.HttpStatusCode.OK) { Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json") };
}
