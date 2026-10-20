using System.Net.Http.Json;
using FluentAssertions;
using MinglDingl.Engine.Features.Honours;
using MinglDingl.Engine.Features.Wanderings;
using MinglDingl.Engine.Tests.Features.Encounters;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Wanderings;

public class WanderingTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    private static async Task KeptAsync(MeetingWorld m)
    {
        var id = await m.AskedAsync();
        (await m.Bat.C.AttendRawAsync(m.Bond, id, "Met")).EnsureSuccessStatusCode();
        (await m.Saruul.C.AttendRawAsync(m.Bond, id, "Met")).EnsureSuccessStatusCode();
    }

    private static async Task<WanderingsView> ListAsync(HttpClient c, Guid bond) =>
        (await c.GetFromJsonAsync<WanderingsView>($"/bonds/{bond}/wanderings"))!;

    private static async Task<WanderingView> GetAsync(HttpClient c, Guid bond, string key) =>
        (await c.GetFromJsonAsync<WanderingView>($"/bonds/{bond}/wanderings/{key}"))!;

    private static Task<HttpResponseMessage> PostAsync(HttpClient c, Guid bond, string key, string act, string? line = null) =>
        line is null ? c.PostAsync($"/bonds/{bond}/wanderings/{key}/{act}", null)
            : c.PostAsJsonAsync($"/bonds/{bond}/wanderings/{key}/line", new WanderingLineRequest(line));

    [Fact]
    public async Task The_first_roads_open_after_a_kept_meeting_and_a_Wandering_is_asked_agreed_and_kept_by_two_sealed_lines()
    {
        await using var m = await MeetingWorld.CreateAsync(db);
        var (bat, saruul, bond) = (m.Bat.C, m.Saruul.C, m.Bond);
        var before = await ListAsync(bat, bond);
        before.Items.Should().HaveCount(13).And.OnlyContain(i => i.State == "sealed");
        (await CodeOf(await PostAsync(bat, bond, "songs-of-steppe", "ask"))).Should().Be("wandering.sealed");

        await KeptAsync(m);
        var open = await ListAsync(bat, bond);
        (open.FirstOpen, open.TrustedOpen).Should().Be((true, false));
        open.Items.Where(i => i.Road == "first").Should().OnlyContain(i => i.State == "open");
        (await CodeOf(await PostAsync(bat, bond, "dawn-hill", "ask"))).Should().Be("wandering.sealed", "trusted roads need two");

        (await PostAsync(bat, bond, "songs-of-steppe", "ask")).EnsureSuccessStatusCode();
        (await GetAsync(saruul, bond, "songs-of-steppe")).State.Should().Be("askedOfMe");
        (await CodeOf(await PostAsync(bat, bond, "the-board", "ask"))).Should().Be("wandering.waiting");
        (await CodeOf(await PostAsync(bat, bond, "songs-of-steppe", "yes"))).Should().Be("wandering.no_ask", "the asker cannot answer");
        (await PostAsync(saruul, bond, "songs-of-steppe", "yes")).EnsureSuccessStatusCode();

        (await PostAsync(bat, bond, "songs-of-steppe", "line", "The old man on the fiddle.")).EnsureSuccessStatusCode();
        var hers = await GetAsync(saruul, bond, "songs-of-steppe");
        (hers.State, hers.TheirLineWritten, hers.TheirLine).Should().Be(("going", true, null), "his line stays sealed until she writes");
        (await PostAsync(saruul, bond, "songs-of-steppe", "line", "How quiet the hall went.")).EnsureSuccessStatusCode();
        var his = await GetAsync(bat, bond, "songs-of-steppe");
        (his.State, his.MyLine, his.TheirLine, his.Fellow).Should().Be(("kept", "The old man on the fiddle.", "How quiet the hall went.", 1));
        (await ListAsync(bat, bond)).Taken.Should().Be(1);
        (await CodeOf(await PostAsync(bat, bond, "songs-of-steppe", "ask"))).Should().Be("wandering.taken");
    }

    [Fact]
    public async Task Not_this_one_closes_the_ask_and_three_kept_make_Fellow_Travellers()
    {
        await using var m = await MeetingWorld.CreateAsync(db);
        var (bat, saruul, bond) = (m.Bat.C, m.Saruul.C, m.Bond);
        await KeptAsync(m);
        (await PostAsync(bat, bond, "the-board", "ask")).EnsureSuccessStatusCode();
        (await PostAsync(saruul, bond, "the-board", "no")).EnsureSuccessStatusCode();
        (await GetAsync(bat, bond, "the-board")).State.Should().Be("open", "it may be asked again");

        foreach (var key in new[] { "the-board", "small-things", "stranger-dish" })
        {
            (await PostAsync(bat, bond, key, "ask")).EnsureSuccessStatusCode();
            (await PostAsync(saruul, bond, key, "yes")).EnsureSuccessStatusCode();
            (await PostAsync(bat, bond, key, "line", "one")).EnsureSuccessStatusCode();
            (await PostAsync(saruul, bond, key, "line", "two")).EnsureSuccessStatusCode();
        }
        var honours = (await saruul.GetFromJsonAsync<List<HonourView>>("/me/honours"))!;
        honours.Single(h => h.Key == HonourKeys.FellowTraveller).Earned.Should().BeTrue();
        (await GetAsync(bat, bond, "stranger-dish")).Venues.Should().NotBeEmpty("a verified café suits it");
    }

    [Fact]
    public async Task The_keepers_edit_a_Wanderings_words_and_kinds_of_place()
    {
        await using var w = await World.CreateAsync(db);
        var admin = await w.F.AdminAsync();
        (await admin.GetFromJsonAsync<List<AdminWanderingRow>>("/admin/wanderings"))!.Should().HaveCount(13);
        var page = (await admin.GetFromJsonAsync<AdminWandering>("/admin/wanderings/dawn-hill"))!;
        page.TitleMn.Should().Be("Толгой дээрх үүр");
        WanderingWriteRequest Req(params string[] kinds) => new("Dawn on Zaisan", page.LineEn, page.BodyEn, page.WhereEn,
            page.TitleMn, page.LineMn, page.BodyMn, page.WhereMn, kinds);
        (await CodeOf(await admin.PutAsJsonAsync("/admin/wanderings/dawn-hill", Req("Moon")))).Should().Be("venue.kind");
        (await admin.PutAsJsonAsync("/admin/wanderings/dawn-hill", Req("Outdoor"))).EnsureSuccessStatusCode();
        (await admin.GetFromJsonAsync<AdminWandering>("/admin/wanderings/dawn-hill"))!.TitleEn.Should().Be("Dawn on Zaisan");
    }
}
