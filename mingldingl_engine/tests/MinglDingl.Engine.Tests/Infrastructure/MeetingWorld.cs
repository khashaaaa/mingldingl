using MinglDingl.Engine.Kernel.Config;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Infrastructure;

/// A pair at the third seal with a verified place to meet; the Rite is not required unless asked.
public sealed record MeetingWorld(World W, World.Person Bat, World.Person Saruul, Guid Bond, Guid Venue, HttpClient Admin) : IAsyncDisposable
{
    public static async Task<MeetingWorld> CreateAsync(PostgresFixture db, bool riteRequired = false, string name1 = "Bat", string name2 = "Saruul")
    {
        var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync(name1, "Male");
        var saruul = await w.PersonAsync(name2, "Female");
        var bond = (await bat.C.SummonAsync(saruul.Id)).Id;
        await ExchangeAsync(bond, bat.C, saruul.C, 15);
        // The steps before a meeting, done, so the Bond's card points at the meeting.
        (await bat.C.IcebreakerRawAsync(bond, "Terelj")).EnsureSuccessStatusCode();
        (await saruul.C.IcebreakerRawAsync(bond, "Khövsgöl")).EnsureSuccessStatusCode();
        await bat.C.TrialAllAsync(bond, 0, 1, 2, 3, 0);
        await saruul.C.TrialAllAsync(bond, 0, 1, 2, 3, 1);
        await w.SetAsync(ConfigKeys.VideoEnabled, riteRequired ? "true" : "false");
        var admin = await w.F.AdminAsync();
        var venue = (await admin.AddVenueAsync()).Id;
        return new(w, bat, saruul, bond, venue, admin);
    }

    public DateTimeOffset Tomorrow => W.F.Clock.UtcNow.AddDays(1);

    /// Proposed by Bat, pledged by Saruul.
    public async Task<Guid> SwornAsync()
    {
        var m = await Bat.C.ProposeAsync(Bond, Venue, Tomorrow);
        (await Saruul.C.MeetingActRawAsync(Bond, m.Id, "pledge")).EnsureSuccessStatusCode();
        return m.Id;
    }

    /// Sworn, then time moves past the meeting and the sweep asks both "Did they come?".
    public async Task<Guid> AskedAsync()
    {
        var id = await SwornAsync();
        await W.AdvanceAsync(TimeSpan.FromDays(1) + TimeSpan.FromHours(4));
        await W.SweepAsync();
        return id;
    }

    public ValueTask DisposeAsync() => W.DisposeAsync();
}
