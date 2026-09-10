namespace MinglDingl.Engine.Tests.Services;

/// <summary>
/// One rule, used by both discovery and the summon endpoint. Every guard here once lived only in
/// GetCandidates, so a direct POST /matches walked straight past all of them.
/// </summary>
public class MatchEligibilityTests
{
    private static User Suitor(Action<User>? tweak = null)
    {
        var u = new User
        {
            Id = Guid.NewGuid(), DisplayName = "Suitor", Age = 30, Gender = "Male",
            City = "Ulaanbaatar", Bio = "b", AgeMin = 25, AgeMax = 35,
        };
        tweak?.Invoke(u);
        return u;
    }

    private static User Target(Action<User>? tweak = null)
    {
        var u = new User
        {
            Id = Guid.NewGuid(), DisplayName = "Target", Age = 30, Gender = "Female",
            City = "Ulaanbaatar", Bio = "b",
        };
        tweak?.Invoke(u);
        return u;
    }

    private static bool Eligible(User me, User target) =>
        MatchEligibility.IsEligibleFor(me).Compile()(target);

    [Fact]
    public void AnOppositeGenderPersonInsideMyAgeRange_IsEligible() =>
        Assert.True(Eligible(Suitor(), Target()));

    /// <summary>
    /// A ban is only enforced in CurrentUserMiddleware, which stops the banned account's own
    /// requests and nothing else — so without this clause a suspended profile stayed in every
    /// discovery feed and could still be summoned, spending a real daily slot on a dead match.
    /// </summary>
    [Fact]
    public void ABannedPerson_IsNotEligible() =>
        Assert.False(Eligible(Suitor(), Target(u => u.IsBanned = true)));

    [Fact]
    public void MutualEligibility_RequiresBothAgeRangesToAdmitTheOther()
    {
        var me = Suitor(u => { u.Age = 30; u.AgeMin = 25; u.AgeMax = 35; });
        var them = Target(u => { u.Age = 30; u.AgeMin = 40; u.AgeMax = 50; });

        Assert.True(Eligible(me, them));
        Assert.False(MatchEligibility.AreMutuallyEligible(me, them));
    }

    [Fact]
    public void MutualEligibility_SameGenderPair_IsRefused()
    {
        var a = Suitor();
        var b = Suitor();
        Assert.False(MatchEligibility.AreMutuallyEligible(a, b));
    }

    [Fact]
    public void ActiveAccount_ExcludesBannedAndPendingDeletion()
    {
        var isActive = MatchEligibility.IsActiveAccount().Compile();

        Assert.True(isActive(Target()));
        Assert.False(isActive(Target(u => u.IsBanned = true)));
        Assert.False(isActive(Target(u => u.DeletionRequestedAt = DateTime.UtcNow)));
    }

    [Fact]
    public void Myself_IsNotEligible()
    {
        var me = Suitor();
        Assert.False(Eligible(me, me));
    }

    [Fact]
    public void SomeoneWhoRequestedDeletion_IsNotEligible() =>
        Assert.False(Eligible(Suitor(), Target(u => u.DeletionRequestedAt = DateTime.UtcNow)));

    [Fact]
    public void SomeoneWhoPausedTheirAccount_IsNotEligible() =>
        Assert.False(Eligible(Suitor(), Target(u => u.IsPaused = true)));

    [Fact]
    public void SomeoneOlderThanMyStatedRange_IsNotEligible() =>
        Assert.False(Eligible(Suitor(), Target(u => u.Age = 55)));

    [Fact]
    public void SomeoneYoungerThanMyStatedRange_IsNotEligible() =>
        Assert.False(Eligible(Suitor(), Target(u => u.Age = 19)));

    [Fact]
    public void SomeoneOfMyOwnGender_IsNotEligible() =>
        Assert.False(Eligible(Suitor(), Target(u => u.Gender = "Male")));

    [Fact]
    public void AGenderTheLadderDoesNotKnow_MatchesNobody() =>
        Assert.False(Eligible(Suitor(u => u.Gender = "Nonbinary"), Target()));
}
