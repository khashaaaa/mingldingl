using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace MinglDingl.Engine.Tests.Integration;

/// <summary>
/// Whose photos a profile may carry. Every candidate's full photo list is handed out by the
/// discover feed, so validating only the *origin* of a URL let an attacker put someone else's photo
/// on their own profile — wearing that person's face — and then, by dropping it again, run
/// <c>PUT /users/me</c>'s unlink against the victim's real file on disk.
/// </summary>
public class ProfilePhotoOwnershipIntegrationTests : IntegrationTestBase
{
    private static string PhotoOf(Guid ownerId, string file = "a.jpg") =>
        $"http://localhost:5150/uploads/photos/profiles/{ownerId}/{file}";

    private UsersController Controller(Guid userId, LocalFileStorageService storage)
    {
        var httpContext = new DefaultHttpContext();
        httpContext.Items["UserId"] = userId;
        var score = new ScoreService(Db, new ConfigService());
        var honours = new HonourService(Db, NullLogger<HonourService>.Instance);
        var ships = new ShipService(Db, honours, score, new ConfigService(),
            new MilestoneService(Db, NullLogger<MilestoneService>.Instance), BuildTestPush(), BuildTestBroadcast(),
            NullLogger<ShipService>.Instance);
        var oaths = new OathService(Db, new ConfigService(), score,
            new MilestoneService(Db, NullLogger<MilestoneService>.Instance), honours);
        return new UsersController(
            Db, score, new ReferralService(Db, honours, NullLogger<ReferralService>.Instance), ships, oaths,
            BuildUnconfiguredPhoneVerification(Db), storage, new ConfigService())
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext },
        };
    }

    private async Task<(User Attacker, User Victim)> TwoUsersAsync()
    {
        var attacker = NewCompleteUser(gender: "Male");
        var victim = NewCompleteUser();
        victim.PhotoUrls = [PhotoOf(victim.Id)];
        attacker.PhotoUrls = [PhotoOf(attacker.Id)];
        Db.Users.AddRange(attacker, victim);
        await Db.SaveChangesAsync();
        return (attacker, victim);
    }

    [Fact]
    public async Task AnotherUsersPhoto_CannotBeAddedToYourOwnProfile()
    {
        var (attacker, victim) = await TwoUsersAsync();

        var result = await Controller(attacker.Id, BuildTestStorage())
            .Update(new UpdateUserRequest(null, null, [PhotoOf(attacker.Id), PhotoOf(victim.Id)],
                null, null, null, null, null, null, null, null, null, null, null));

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal("profile.photo_not_owned", Assert.IsType<ErrorResponse>(bad.Value).Code);

        Db.ChangeTracker.Clear();
        Assert.Equal([PhotoOf(attacker.Id)], (await Db.Users.FindAsync(attacker.Id))!.PhotoUrls);
    }

    /// <summary>
    /// The destructive half. Even for a stolen URL already sitting on a row from before the check
    /// existed, dropping it must not reach into the other account's files.
    /// </summary>
    [Fact]
    public async Task DroppingAStolenPhotoUrl_NeverDeletesTheOtherUsersFile()
    {
        var (attacker, victim) = await TwoUsersAsync();
        attacker.PhotoUrls = [PhotoOf(attacker.Id), PhotoOf(victim.Id)];
        await Db.SaveChangesAsync();

        var deleted = new List<string>();
        await Controller(attacker.Id, BuildRecordingStorage(deleted))
            .Update(new UpdateUserRequest(null, null, [PhotoOf(attacker.Id)],
                null, null, null, null, null, null, null, null, null, null, null));

        Assert.DoesNotContain(PhotoOf(victim.Id), deleted);
    }

    [Fact]
    public async Task YourOwnDroppedPhoto_IsStillUnlinked()
    {
        var (attacker, _) = await TwoUsersAsync();
        attacker.PhotoUrls = [PhotoOf(attacker.Id), PhotoOf(attacker.Id, "b.jpg")];
        await Db.SaveChangesAsync();

        var deleted = new List<string>();
        await Controller(attacker.Id, BuildRecordingStorage(deleted))
            .Update(new UpdateUserRequest(null, null, [PhotoOf(attacker.Id)],
                null, null, null, null, null, null, null, null, null, null, null));

        Assert.Equal([PhotoOf(attacker.Id, "b.jpg")], deleted);
    }
}
