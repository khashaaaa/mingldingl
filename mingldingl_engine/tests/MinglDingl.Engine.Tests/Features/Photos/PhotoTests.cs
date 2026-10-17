using System.Net;
using System.Net.Http.Json;
using System.Text;
using FluentAssertions;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Tests.Infrastructure;
using SkiaSharp;

namespace MinglDingl.Engine.Tests.Features.Photos;

public class PhotoTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    private static async Task<string?> Code(HttpResponseMessage r) => (await r.Content.ReadFromJsonAsync<ErrorBody>())?.Code;

    private static async Task<(EngineFactory F, MemoryPhotoStore Store, HttpClient C, ScriptedVerifyMn Vm)> Ready(PostgresFixture db)
    {
        var f = new EngineFactory(db);
        var vm = f.UseScriptedVerifyMn();
        var store = f.UseMemoryPhotoStore();
        var s = await f.SignInAsync(vm);
        var c = f.As(s);
        await c.CreateAsync();
        return (f, store, c, vm);
    }

    [Fact]
    public async Task Upload_strips_metadata_and_caps_size()
    {
        var (f, store, c, _) = await Ready(db); await using var _f = f;
        var big = await c.UploadAsync("photo-1.jpg");
        Math.Max(big.Width, big.Height).Should().Be(1600);
        var withGps = await c.UploadAsync("photo-2.jpg");
        var bytes = store.Files.Single(kv => kv.Key.Contains(withGps.Id.ToString())).Value;
        Encoding.ASCII.GetString(bytes).Should().NotContain("Exif").And.NotContain("FakeCam");
        using var decoded = SKBitmap.Decode(bytes);
        decoded.Width.Should().Be(withGps.Width);
        withGps.ThumbHash.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Upload_is_idempotent_per_client_key()
    {
        var (f, store, c, _) = await Ready(db); await using var _f = f;
        var key = Guid.NewGuid().ToString();
        var a = await c.UploadAsync(key: key);
        var b = await c.UploadAsync(key: key);
        b.Id.Should().Be(a.Id);
        (await c.PhotosAsync()).Should().HaveCount(1);
        store.Files.Should().HaveCount(1);
    }

    [Fact]
    public async Task Concurrent_uploads_with_one_key_store_one_photo()
    {
        var (f, store, c, _) = await Ready(db); await using var _f = f;
        var key = Guid.NewGuid().ToString();
        var bytes = await File.ReadAllBytesAsync(PhotoDriver.Fixture("photo-3.jpg"));
        var rs = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => c.UploadRawAsync(bytes, key)));
        rs.Should().OnlyContain(r => r.StatusCode == HttpStatusCode.OK);
        (await c.PhotosAsync()).Should().HaveCount(1);
    }

    [Fact]
    public async Task Seventh_photo_is_refused()
    {
        var (f, _, c, _) = await Ready(db); await using var _f = f;
        for (var i = 0; i < 6; i++) await c.UploadAsync();
        var r = await c.UploadRawAsync(await File.ReadAllBytesAsync(PhotoDriver.Fixture("photo-3.jpg")));
        r.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await Code(r)).Should().Be("photos.full");
    }

    [Fact]
    public async Task Non_image_is_400()
    {
        var (f, _, c, _) = await Ready(db); await using var _f = f;
        var r = await c.UploadRawAsync(Encoding.UTF8.GetBytes("not an image at all"));
        r.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await Code(r)).Should().Be("photos.not_image");
    }

    [Fact]
    public async Task Missing_idempotency_key_is_400()
    {
        var (f, _, c, _) = await Ready(db); await using var _f = f;
        var form = new MultipartFormDataContent { { new ByteArrayContent(await File.ReadAllBytesAsync(PhotoDriver.Fixture("photo-3.jpg"))), "file", "p.jpg" } };
        (await c.PostAsync("/me/photos", form)).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Reorder_sets_positions_and_must_name_exactly_my_photos()
    {
        var (f, _, c, _) = await Ready(db); await using var _f = f;
        var a = await c.UploadAsync(); var b = await c.UploadAsync(); var d = await c.UploadAsync();
        (await c.PutAsJsonAsync("/me/photos/order", new ReorderRequest([d.Id, a.Id, b.Id]))).StatusCode.Should().Be(HttpStatusCode.OK);
        (await c.PhotosAsync()).Select(p => p.Id).Should().Equal(d.Id, a.Id, b.Id);
        var bad = await c.PutAsJsonAsync("/me/photos/order", new ReorderRequest([d.Id, a.Id]));
        (await Code(bad)).Should().Be("photos.order_mismatch");
        var dup = await c.PutAsJsonAsync("/me/photos/order", new ReorderRequest([d.Id, d.Id, a.Id]));
        (await Code(dup)).Should().Be("photos.order_mismatch");
    }

    [Fact]
    public async Task Delete_removes_the_stored_file_and_closes_the_gap()
    {
        var (f, store, c, _) = await Ready(db); await using var _f = f;
        var a = await c.UploadAsync(); var b = await c.UploadAsync();
        (await c.DeleteAsync($"/me/photos/{a.Id}")).StatusCode.Should().Be(HttpStatusCode.NoContent);
        store.Files.Keys.Should().NotContain(k => k.Contains(a.Id.ToString()));
        var left = await c.PhotosAsync();
        left.Should().ContainSingle().Which.Position.Should().Be(0);
        left[0].Id.Should().Be(b.Id);
    }

    [Fact]
    public async Task A_finished_character_cannot_drop_below_the_minimum()
    {
        var (f, _, c, _) = await Ready(db); await using var _f = f;
        await c.UpdateAsync(ProfileDriver.Upd(gender: "Female"));
        var photos = new List<PhotoView>();
        for (var i = 0; i < 3; i++) photos.Add(await c.UploadAsync());
        await c.UpdateAsync(ProfileDriver.Upd(bio: "Tea after.", city: "Khan-Uul", oath: "Bond"));
        await c.UpdateAsync(ProfileDriver.Upd(welcomed: true));

        var r = await c.DeleteAsync($"/me/photos/{photos[0].Id}");
        r.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await Code(r)).Should().Be("photos.min");
        (await c.PhotosAsync()).Should().HaveCount(3);
        (await c.MeAsync()).OnboardingStep.Should().Be(7);

        await c.UploadAsync();
        (await c.DeleteAsync($"/me/photos/{photos[0].Id}")).StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Another_accounts_photo_id_is_404()
    {
        var (f, _, c, vm) = await Ready(db); await using var _f = f;
        var mine = await c.UploadAsync();
        var other = f.As(await f.SignInAsync(vm));
        await other.CreateAsync("Other");
        (await other.DeleteAsync($"/me/photos/{mine.Id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Repeated_reads_return_the_same_signed_url_until_near_expiry()
    {
        var (f, _, c, _) = await Ready(db); await using var _f = f;
        await c.UploadAsync();
        var first = (await c.PhotosAsync())[0].Url;
        (await c.PhotosAsync())[0].Url.Should().Be(first);
        f.Clock.Advance(TimeSpan.FromMinutes(51));
        var refreshed = (await (await f.Client().RefreshRawAsync(c.RefreshToken())).Content.ReadFromJsonAsync<Engine.Features.Auth.SessionPair>())!;
        (await f.As(refreshed).PhotosAsync())[0].Url.Should().NotBe(first);
    }

    [Fact]
    public async Task Photo_count_moves_onboarding_from_3_to_4()
    {
        var (f, _, c, _) = await Ready(db); await using var _f = f;
        await c.UpdateAsync(ProfileDriver.Upd(gender: "Female"));
        for (var i = 0; i < 2; i++) await c.UploadAsync();
        (await c.MeAsync()).OnboardingStep.Should().Be(3);
        await c.UploadAsync();
        (await c.MeAsync()).OnboardingStep.Should().Be(4);
    }

    [Fact]
    public async Task Upload_publishes_photos_updated()
    {
        var f = new EngineFactory(db);
        await using var _f = f;
        var vm = f.UseScriptedVerifyMn(); f.UseMemoryPhotoStore();
        var s = await f.SignInAsync(vm);
        var c = f.As(s);
        await c.CreateAsync();
        await using var l = await f.ListenAsync(s);
        await c.UploadAsync();
        (await l.WaitForAsync(LiveKinds.PhotosUpdated)).Should().NotBeNull();
    }
}
