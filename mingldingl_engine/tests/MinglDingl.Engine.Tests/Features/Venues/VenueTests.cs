using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MinglDingl.Engine.Features.Venues;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.EncounterDriver;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Venues;

public class VenueTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task Keepers_add_edit_and_remove_a_place_and_travellers_see_it_live()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        await using var his = await w.F.ListenAsync(bat.S);
        var admin = await w.F.AdminAsync();

        var v = await admin.AddVenueAsync();
        (await his.WaitForAsync(LiveKinds.VenueUpdated)).Should().NotBeNull();
        (await bat.C.VenuesAsync()).Should().ContainSingle(x => x.Id == v.Id && x.Name == "Nomad Café" && !x.Gone);

        var photo = await (await admin.AddVenuePhotoRawAsync(v.Id)).Read<AdminVenueView>();
        photo.Photos.Should().ContainSingle();
        var edited = await (await admin.PutAsJsonAsync($"/admin/venues/{v.Id}", Place("Nomad Tea House"))).Read<AdminVenueView>();
        edited.Name.Should().Be("Nomad Tea House");
        (await bat.C.VenuesAsync()).Single().Photos.Should().ContainSingle(p => p.Url.Length > 0);

        (await admin.DeleteAsync($"/admin/venues/{v.Id}")).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await bat.C.VenuesAsync()).Should().BeEmpty("a removed place is not offered");
        (await bat.C.GetFromJsonAsync<VenueView>($"/venues/{v.Id}"))!.Gone.Should().BeTrue();
        (await admin.GetFromJsonAsync<List<AdminVenueView>>("/admin/venues"))!.Single().Removed.Should().BeTrue();

        var log = (await admin.GetFromJsonAsync<List<MinglDingl.Engine.Features.Admin.AuditRow>>("/admin/audit"))!;
        log.Should().Contain(r => r.Action == "Venue removed" && r.Target == "Nomad Tea House", "the keeper reads a name, not an id");
    }

    [Fact]
    public async Task Unverified_places_are_never_offered_and_bad_input_is_refused()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var admin = await w.F.AdminAsync();
        await admin.AddVenueAsync(Place(verified: false));
        (await bat.C.VenuesAsync()).Should().BeEmpty();

        (await CodeOf(await admin.PostAsJsonAsync("/admin/venues", Place(kind: "Casino")))).Should().Be("venue.kind");
        (await CodeOf(await admin.PostAsJsonAsync("/admin/venues", Place(district: "Atlantis")))).Should().Be("venue.district");
    }

    [Fact]
    public async Task Places_near_the_pair_come_first()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male", "Bayangol");
        var saruul = await w.PersonAsync("Saruul", "Female", "Chingeltei");
        var admin = await w.F.AdminAsync();
        var far = await admin.AddVenueAsync(Place("Darkhan Inn", "Darkhan"));
        var capital = await admin.AddVenueAsync(Place("Khan-Uul Bar", "Khan-Uul", "Bar"));
        var hers = await admin.AddVenueAsync(Place("Zanabazar Museum", "Chingeltei", "Culture"));
        var bond = await bat.C.SummonAsync(saruul.Id);

        var list = await bat.C.VenuesAsync(bond.Id);
        list.Select(x => x.Id).Should().Equal(hers.Id, capital.Id, far.Id);
        (await bat.C.VenuesAsync()).First().Id.Should().NotBe(hers.Id, "without the bond only my own district counts");
    }

    [Fact]
    public async Task A_traveller_cannot_reach_the_keepers_routes()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        (await bat.C.PostAsJsonAsync("/admin/venues", Place())).StatusCode.Should().BeOneOf(HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden);
        (await bat.C.GetAsync("/admin/venues")).StatusCode.Should().BeOneOf(HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden);
    }
}
