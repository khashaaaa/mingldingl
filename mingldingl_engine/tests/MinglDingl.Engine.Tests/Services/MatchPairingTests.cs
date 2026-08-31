namespace MinglDingl.Engine.Tests.Services;

public class MatchPairingTests
{
    [Fact]
    public void PairLockKey_IsOrderIndependent()
    {
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        Assert.Equal(MatchPairing.PairLockKey(a, b), MatchPairing.PairLockKey(b, a));
    }

    [Fact]
    public void PairLockKey_IsDeterministic()
    {
        var a = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var b = Guid.Parse("22222222-2222-2222-2222-222222222222");
        Assert.Equal(MatchPairing.PairLockKey(a, b), MatchPairing.PairLockKey(a, b));
    }

    [Fact]
    public void PairLockKey_DifferentPairs_ProduceDifferentKeys()
    {
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var c = Guid.NewGuid();
        Assert.NotEqual(MatchPairing.PairLockKey(a, b), MatchPairing.PairLockKey(a, c));
    }

    [Fact]
    public void NewMatch_SetsActiveStatusRevealLevelOneAndParticipants()
    {
        var initiator = Guid.NewGuid();
        var receiver = Guid.NewGuid();

        var match = MatchPairing.NewMatch(initiator, receiver);

        Assert.Equal(initiator, match.InitiatorId);
        Assert.Equal(receiver, match.ReceiverId);
        Assert.Equal("Active", match.Status);
        Assert.Equal(1, match.RevealLevel);
        Assert.Null(match.ShipId);
    }

    [Fact]
    public void NewMatch_WithShipId_LinksTheShip()
    {
        var shipId = Guid.NewGuid();
        Assert.Equal(shipId, MatchPairing.NewMatch(Guid.NewGuid(), Guid.NewGuid(), shipId).ShipId);
    }
}
