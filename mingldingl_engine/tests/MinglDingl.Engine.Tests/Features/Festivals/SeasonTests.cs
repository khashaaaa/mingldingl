using System.Net.Http.Json;
using FluentAssertions;
using MinglDingl.Engine.Features.Festivals;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Tests.Infrastructure;

namespace MinglDingl.Engine.Tests.Features.Festivals;

public class SeasonTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task The_season_names_the_festival_today_the_next_one_and_the_next_with_an_honour_and_snows_in_winter()
    {
        await using var w = await World.CreateAsync(db);
        var anyone = w.F.Client(); // the season is public

        // 2026-10-05: nothing on; the Last Bell is next, and Tsagaan Sar the next with an honour.
        var autumn = (await anyone.GetFromJsonAsync<SeasonView>("/season"))!;
        autumn.Now.Should().BeNull();
        autumn.Next.Should().Be(new FestivalView(FestivalKeys.LastBell, new(2026, 12, 30), new(2026, 12, 31)));
        autumn.NextHonour.Should().Be(new FestivalView(FestivalKeys.TsagaanSar, new(2027, 2, 7), new(2027, 2, 9)));
        autumn.Snow.Should().BeFalse();

        w.F.Clock.Now = DateTimeOffset.Parse("2026-12-31T04:00:00Z");
        var winter = (await anyone.GetFromJsonAsync<SeasonView>("/season"))!;
        winter.Now!.Key.Should().Be(FestivalKeys.LastBell);
        winter.Next!.Key.Should().Be(FestivalKeys.TsagaanSar);
        winter.Snow.Should().BeTrue();
        await w.SetAsync(ConfigKeys.WorldSnow, "false");
        (await anyone.GetFromJsonAsync<SeasonView>("/season"))!.Snow.Should().BeFalse("the keepers switched the snow off");
    }
}
