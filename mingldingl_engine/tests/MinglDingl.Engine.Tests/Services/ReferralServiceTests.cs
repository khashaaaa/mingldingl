using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Services;

public class ReferralServiceTests : Integration.IntegrationTestBase
{
    private ReferralService BuildService() => new(Db, new LootService(Db, new ScoreService(Db, new ConfigService()), NullLogger<LootService>.Instance), NullLogger<ReferralService>.Instance);

    [Fact]
    public async Task GetOrCreateCodeAsync_FirstCall_GeneratesAndPersistsASixCharCode()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(Integration.IntegrationTestBase.NewCompleteUser(userId));
        await Db.SaveChangesAsync();

        var code = await BuildService().GetOrCreateCodeAsync(userId);

        Assert.Equal(6, code.Length);
        Assert.DoesNotContain(code, c => "0OI1L".Contains(c));
        Db.ChangeTracker.Clear();
        var saved = await Db.Users.FindAsync(userId);
        Assert.Equal(code, saved!.ReferralCode);
    }

    [Fact]
    public async Task GetOrCreateCodeAsync_CalledTwice_ReturnsTheSameCode()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(Integration.IntegrationTestBase.NewCompleteUser(userId));
        await Db.SaveChangesAsync();
        var service = BuildService();

        var first = await service.GetOrCreateCodeAsync(userId);
        var second = await service.GetOrCreateCodeAsync(userId);

        Assert.Equal(first, second);
    }

    [Fact]
    public async Task TryCompleteReferralAsync_ValidCode_GrantsBothSidesAndRecordsReferral()
    {
        var inviterId = Guid.NewGuid();
        var inviteeId = Guid.NewGuid();
        Db.Users.Add(Integration.IntegrationTestBase.NewCompleteUser(inviterId));
        Db.Users.Add(Integration.IntegrationTestBase.NewCompleteUser(inviteeId));
        await Db.SaveChangesAsync();
        var service = BuildService();
        var code = await service.GetOrCreateCodeAsync(inviterId);

        var inviteeReward = await service.TryCompleteReferralAsync(inviteeId, code);

        Assert.NotNull(inviteeReward);
        Db.ChangeTracker.Clear();
        var referral = await Db.Referrals.FirstOrDefaultAsync(r => r.InviteeUserId == inviteeId);
        Assert.NotNull(referral);
        Assert.Equal(inviterId, referral!.InviterUserId);
        Assert.NotNull(referral.InviterRewardItemId);
        Assert.NotNull(referral.InviteeRewardItemId);
    }

    [Fact]
    public async Task TryCompleteReferralAsync_UnknownCode_NoOpsWithoutThrowing()
    {
        var inviteeId = Guid.NewGuid();
        Db.Users.Add(Integration.IntegrationTestBase.NewCompleteUser(inviteeId));
        await Db.SaveChangesAsync();

        var result = await BuildService().TryCompleteReferralAsync(inviteeId, "ZZZZZZ");

        Assert.Null(result);
        Db.ChangeTracker.Clear();
        Assert.Empty(Db.Referrals.Where(r => r.InviteeUserId == inviteeId));
    }

    [Fact]
    public async Task TryCompleteReferralAsync_NullOrBlankCode_NoOps()
    {
        var inviteeId = Guid.NewGuid();
        Db.Users.Add(Integration.IntegrationTestBase.NewCompleteUser(inviteeId));
        await Db.SaveChangesAsync();

        Assert.Null(await BuildService().TryCompleteReferralAsync(inviteeId, null));
        Assert.Null(await BuildService().TryCompleteReferralAsync(inviteeId, ""));
    }

    [Fact]
    public async Task TryCompleteReferralAsync_SelfReferral_Rejected()
    {
        var userId = Guid.NewGuid();
        Db.Users.Add(Integration.IntegrationTestBase.NewCompleteUser(userId));
        await Db.SaveChangesAsync();
        var service = BuildService();
        var code = await service.GetOrCreateCodeAsync(userId);

        var result = await service.TryCompleteReferralAsync(userId, code);

        Assert.Null(result);
        Db.ChangeTracker.Clear();
        Assert.Empty(Db.Referrals);
    }

    [Fact]
    public async Task TryCompleteReferralAsync_InviteeAlreadyReferred_SecondAttemptNoOps()
    {
        var inviterId = Guid.NewGuid();
        var otherInviterId = Guid.NewGuid();
        var inviteeId = Guid.NewGuid();
        Db.Users.Add(Integration.IntegrationTestBase.NewCompleteUser(inviterId));
        Db.Users.Add(Integration.IntegrationTestBase.NewCompleteUser(otherInviterId));
        Db.Users.Add(Integration.IntegrationTestBase.NewCompleteUser(inviteeId));
        await Db.SaveChangesAsync();
        var service = BuildService();
        var code = await service.GetOrCreateCodeAsync(inviterId);
        var otherCode = await service.GetOrCreateCodeAsync(otherInviterId);
        await service.TryCompleteReferralAsync(inviteeId, code);

        var second = await service.TryCompleteReferralAsync(inviteeId, otherCode);

        Assert.Null(second);
        Db.ChangeTracker.Clear();
        Assert.Single(Db.Referrals.Where(r => r.InviteeUserId == inviteeId));
    }

    [Fact]
    public async Task TryCompleteReferralAsync_InviterIsDeleted_NoOpsWithoutThrowing()
    {
        var inviterId = Guid.NewGuid();
        var inviteeId = Guid.NewGuid();
        Db.Users.Add(Integration.IntegrationTestBase.NewCompleteUser(inviterId));
        Db.Users.Add(Integration.IntegrationTestBase.NewCompleteUser(inviteeId));
        await Db.SaveChangesAsync();
        var service = BuildService();
        var code = await service.GetOrCreateCodeAsync(inviterId);

        var inviter = await Db.Users.FindAsync(inviterId);
        inviter!.IsDeleted = true;
        await Db.SaveChangesAsync();

        var result = await service.TryCompleteReferralAsync(inviteeId, code);

        Assert.Null(result);
        Db.ChangeTracker.Clear();
        Assert.Empty(Db.Referrals.Where(r => r.InviteeUserId == inviteeId));
    }

    [Fact]
    public async Task TryCompleteReferralAsync_CodeEnteredLowercase_StillResolves()
    {
        var inviterId = Guid.NewGuid();
        var inviteeId = Guid.NewGuid();
        Db.Users.Add(Integration.IntegrationTestBase.NewCompleteUser(inviterId));
        Db.Users.Add(Integration.IntegrationTestBase.NewCompleteUser(inviteeId));
        await Db.SaveChangesAsync();
        var service = BuildService();
        var code = await service.GetOrCreateCodeAsync(inviterId);

        var result = await service.TryCompleteReferralAsync(inviteeId, code.ToLowerInvariant());

        Assert.NotNull(result);
    }

    [Fact]
    public async Task GetOrCreateCodeAsync_WithExistingShipInviteCodes_AvoidsCollision()
    {
        var userId = Guid.NewGuid();
        var shipperId = Guid.NewGuid();
        Db.Users.Add(Integration.IntegrationTestBase.NewCompleteUser(userId));
        Db.Users.Add(Integration.IntegrationTestBase.NewCompleteUser(shipperId));
        await Db.SaveChangesAsync();

        Db.Ships.Add(new Ship
        {
            ShipperUserId = shipperId,
            SlotAOptIn = "AwaitingUser",
            SlotBOptIn = "AwaitingUser",
            SlotAInviteCode = "SHIPAA",
            SlotBInviteCode = "SHIPBB"
        });
        await Db.SaveChangesAsync();

        var service = BuildService();
        var code = await service.GetOrCreateCodeAsync(userId);

        Assert.NotEqual("SHIPAA", code);
        Assert.NotEqual("SHIPBB", code);

        Db.ChangeTracker.Clear();
        var user = await Db.Users.FindAsync(userId);
        Assert.NotNull(user!.ReferralCode);
        var collidingShip = await Db.Ships.FirstOrDefaultAsync(s =>
            s.SlotAInviteCode == user.ReferralCode ||
            s.SlotBInviteCode == user.ReferralCode);
        Assert.Null(collidingShip);
    }
}
