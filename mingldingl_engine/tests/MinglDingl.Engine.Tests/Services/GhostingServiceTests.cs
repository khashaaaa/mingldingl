namespace MinglDingl.Engine.Tests;

public class GhostingServiceTests
{
    private static readonly Guid InitiatorId = Guid.NewGuid();
    private static readonly Guid ReceiverId = Guid.NewGuid();

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
        // Legacy match predating LastMessageSenderId, not yet backfilled — skip rather than guess.
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
        Assert.Equal(expected, GhostingService.IsStale(match));
    }
}
