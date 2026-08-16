namespace MinglDingl.Engine.Tests.Services;

public class MembershipExpiryTests
{
    private static User User(string level, DateTime? expiresAt) => new()
    {
        Id = Guid.NewGuid(),
        DisplayName = "Test",
        Gender = "Female",
        City = "Ulaanbaatar",
        MembershipLevel = level,
        MembershipExpiresAt = expiresAt,
    };

    [Fact]
    public void HasExpired_PaidTierWithPastExpiry_ReturnsTrue()
    {
        var user = User("Gold", DateTime.UtcNow.AddDays(-1));

        Assert.True(MembershipExpiry.HasExpired(user, DateTime.UtcNow));
    }

    [Fact]
    public void HasExpired_PaidTierWithFutureExpiry_ReturnsFalse()
    {
        var user = User("Gold", DateTime.UtcNow.AddDays(1));

        Assert.False(MembershipExpiry.HasExpired(user, DateTime.UtcNow));
    }

    [Fact]
    public void HasExpired_FreeTier_ReturnsFalse_EvenWithAPastExpiryDate()
    {
        // Shouldn't happen in practice (Free always clears ExpiresAt), but
        // the predicate itself must not treat a Free user as "expired" —
        // there's nothing to revert them from.
        var user = User("Free", DateTime.UtcNow.AddDays(-1));

        Assert.False(MembershipExpiry.HasExpired(user, DateTime.UtcNow));
    }

    [Fact]
    public void HasExpired_PaidTierWithNoExpiryDate_ReturnsFalse()
    {
        var user = User("Gold", null);

        Assert.False(MembershipExpiry.HasExpired(user, DateTime.UtcNow));
    }
}
