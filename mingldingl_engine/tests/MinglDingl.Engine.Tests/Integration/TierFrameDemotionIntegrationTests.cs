using Microsoft.EntityFrameworkCore;

namespace MinglDingl.Engine.Tests.Integration;

public class TierFrameDemotionIntegrationTests : IntegrationTestBase
{
    [Fact]
    public async Task Penalty_ThatLowersTheTier_TakesOffAFrameNowAboveIt()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.TotalScore = 600;
        user.GemTier = "Sapphire";
        user.EquippedFrameId = "frame_sapphire";
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        await new ScoreService(Db, new ConfigService()).AwardAsync(userId, "GhostPenalty");

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.AsNoTracking().FirstAsync(u => u.Id == userId);
        Assert.Equal("Amethyst", reloaded.GemTier);
        Assert.Null(reloaded.EquippedFrameId);
    }

    [Fact]
    public async Task Penalty_ThatLowersTheTier_KeepsAFrameStillWithinIt()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.TotalScore = 600;
        user.GemTier = "Sapphire";
        user.EquippedFrameId = "frame_garnet";
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        await new ScoreService(Db, new ConfigService()).AwardAsync(userId, "GhostPenalty");

        Db.ChangeTracker.Clear();
        Assert.Equal("frame_garnet", (await Db.Users.AsNoTracking().FirstAsync(u => u.Id == userId)).EquippedFrameId);
    }

    [Fact]
    public async Task Award_NeverTouchesTheFrame()
    {
        var userId = Guid.NewGuid();
        var user = NewCompleteUser(userId);
        user.TotalScore = 600;
        user.GemTier = "Sapphire";
        user.EquippedFrameId = "frame_sapphire";
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        await new ScoreService(Db, new ConfigService()).AwardAsync(userId, "QuizDone");

        Db.ChangeTracker.Clear();
        Assert.Equal("frame_sapphire", (await Db.Users.AsNoTracking().FirstAsync(u => u.Id == userId)).EquippedFrameId);
    }
}
