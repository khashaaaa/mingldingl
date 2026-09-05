namespace MinglDingl.Engine.Tests;

public class GhostingServiceTests
{
    private static readonly Guid InitiatorId = Guid.NewGuid();
    private static readonly Guid ReceiverId = Guid.NewGuid();

    private static GhostingService CreateService(ConfigService? config = null) =>
        new(null!, null!, null!, null!, config ?? new ConfigService(), null!);

    [Fact]
    public void GetGhostAtFaultUserId_InitiatorSentLastMessage_BlamesReceiver()
    {
        var match = new Match { InitiatorId = InitiatorId, ReceiverId = ReceiverId, LastMessageSenderId = InitiatorId };
        Assert.Equal(ReceiverId, GhostingService.GetGhostAtFaultUserId(match));
    }

    [Fact]
    public void GetGhostAtFaultUserId_ReceiverSentLastMessage_BlamesInitiator()
    {
        var match = new Match { InitiatorId = InitiatorId, ReceiverId = ReceiverId, LastMessageSenderId = ReceiverId };
        Assert.Equal(InitiatorId, GhostingService.GetGhostAtFaultUserId(match));
    }

    [Fact]
    public void GetGhostAtFaultUserId_NoSenderRecorded_ReturnsNull()
    {
        var match = new Match { InitiatorId = InitiatorId, ReceiverId = ReceiverId, LastMessageSenderId = null };
        Assert.Null(GhostingService.GetGhostAtFaultUserId(match));
    }

    [Theory]
    [InlineData("Active", 49, true)]
    [InlineData("Active", 47, false)]
    [InlineData("Ghosted", 49, false)]
    public void IsStale_ChecksStatusAndThreshold(string status, int hoursSinceLastMessage, bool expected)
    {
        var match = new Match
        {
            Status = status,
            LastMessageAt = DateTime.UtcNow.AddHours(-hoursSinceLastMessage),
        };
        Assert.Equal(expected, CreateService().IsStale(match));
    }

    [Fact]
    public void IsStale_ThresholdOverriddenInConfig_UsesConfigHours()
    {
        var config = new ConfigService();
        config.Set("ghosting.stale_hours", "24");
        var service = CreateService(config);

        var match = new Match { Status = "Active", LastMessageAt = DateTime.UtcNow.AddHours(-25) };
        Assert.True(service.IsStale(match));
        Assert.Equal(TimeSpan.FromHours(24), service.StaleAfter);
    }

    [Fact]
    public void StaleAfter_ConfigBelowOneHour_ClampsToOneHour()
    {
        var config = new ConfigService();
        config.Set("ghosting.stale_hours", "0");
        Assert.Equal(TimeSpan.FromHours(1), CreateService(config).StaleAfter);
    }
}
