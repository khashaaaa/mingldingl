namespace MinglDingl.Engine.Tests.Integration;

public class UserPersistenceIntegrationTests : IntegrationTestBase
{
    [Fact]
    public async Task AddingUser_WithPhotoUrls_RoundTripsThroughJsonbColumn()
    {
        // Regression test: Npgsql needs EnableDynamicJson() for List<string> <-> jsonb.
        // Without it, this throws NotSupportedException at SaveChangesAsync.
        var user = NewCompleteUser();
        Db.Users.Add(user);

        await Db.SaveChangesAsync();

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.FindAsync(user.Id);
        Assert.NotNull(reloaded);
        Assert.Equal(user.PhotoUrls, reloaded!.PhotoUrls);
    }

    [Fact]
    public async Task SavingScoreEvent_ForNewlyAddedUser_DoesNotViolateForeignKey()
    {
        // Regression test: a ScoreEvent referencing a User that was only
        // Update()'d (not Add()'d) violates the FK because the user row was
        // never actually inserted. This exercises the real FK constraint.
        var user = NewCompleteUser();
        Db.Users.Add(user);
        Db.ScoreEvents.Add(new ScoreEvent { UserId = user.Id, EventType = "ProfileComplete", Delta = 100 });

        var ex = await Record.ExceptionAsync(() => Db.SaveChangesAsync());

        Assert.Null(ex);
    }

    [Fact]
    public async Task UpdatingExistingUser_WithoutAdd_PersistsChanges()
    {
        var user = NewCompleteUser();
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        user.Bio = "Updated bio";
        Db.Users.Update(user);
        await Db.SaveChangesAsync();

        Db.ChangeTracker.Clear();
        var reloaded = await Db.Users.FindAsync(user.Id);
        Assert.Equal("Updated bio", reloaded!.Bio);
    }
}
