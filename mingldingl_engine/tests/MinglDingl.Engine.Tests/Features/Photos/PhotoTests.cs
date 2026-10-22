using System.Net;
using System.Net.Http.Json;
using System.Text;
using FluentAssertions;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;
using SkiaSharp;

namespace MinglDingl.Engine.Tests.Features.Photos;

public class PhotoTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    private static async Task<(EngineFactory F, MemoryPhotoStore Store, HttpClient C, ScriptedWeSend Vm)> Ready(PostgresFixture db)
    {
        var f = new EngineFactory(db);
        var vm = f.UseScriptedWeSend();
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
        // These two fixtures are ink figures, not faces.
        await f.SetConfigAsync(ConfigKeys.PhotosRequireFace, "false");
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
    public async Task A_portrait_with_no_human_face_is_refused_and_nothing_is_stored()
    {
        var (f, store, c, _) = await Ready(db); await using var _f = f;
        var r = await c.UploadRawAsync(await File.ReadAllBytesAsync(PhotoDriver.Fixture("photo-2.jpg")));
        r.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await CodeOf(r)).Should().Be("photos.no_face");
        store.Files.Should().BeEmpty();
        (await c.PhotosAsync()).Should().BeEmpty();

        await f.SetConfigAsync(ConfigKeys.PhotosRequireFace, "false");
        (await c.UploadRawAsync(await File.ReadAllBytesAsync(PhotoDriver.Fixture("photo-2.jpg")))).EnsureSuccessStatusCode();
    }

    [Theory]
    [InlineData("Seed/crowd/p00_0.jpg", true)]
    [InlineData("Seed/crowd/p01_1.jpg", true)]
    [InlineData("Seed/crowd/p02_2.jpg", true)]
    [InlineData("Seed/photos/seed-5.jpg", true)]
    [InlineData("Seed/photos/seed-1.jpg", false)]
    [InlineData("Seed/photos/seed-3.jpg", false)]
    [InlineData("Seed/photos/seed-4.jpg", false)]
    public void Faces_are_found_in_photos_of_people_and_not_in_drawings(string file, bool face)
    {
        var image = ImagePipeline.Process(File.ReadAllBytes(Path.Combine(AppContext.BaseDirectory, file)), findFace: true);
        image.Face.Should().Be(face);
    }

    [Theory]
    [InlineData(0.25f)] // half body
    [InlineData(0.12f)] // full body, a few metres off
    [InlineData(0.09f)] // far off: the face ~2.5% of the photo
    public void A_person_standing_further_off_is_still_found(float scale)
    {
        using var src = SKBitmap.Decode(Path.Combine(AppContext.BaseDirectory, "Seed/crowd/p05_0.jpg"));
        using var bmp = new SKBitmap(src.Width, src.Height);
        using (var canvas = new SKCanvas(bmp))
        using (var image = SKImage.FromBitmap(src))
        {
            canvas.Clear(new SKColor(120, 130, 120));
            var (w, h) = (src.Width * scale, src.Height * scale);
            canvas.DrawImage(image, SKRect.Create((src.Width - w) / 2, src.Height * 0.1f, w, h), new SKSamplingOptions(SKFilterMode.Linear));
        }
        using var jpeg = SKImage.FromBitmap(bmp).Encode(SKEncodedImageFormat.Jpeg, 90);
        ImagePipeline.Process(jpeg.ToArray(), findFace: true).Face.Should().BeTrue();
    }

    [Fact]
    public void A_big_phone_original_decodes_scaled_and_a_picture_too_big_to_scale_is_refused()
    {
        // 24 MP is over MaxPixels, but a JPEG decodes at a fraction straight from the codec.
        using (var big = new SKBitmap(6000, 4000))
        {
            big.Erase(new SKColor(120, 130, 140));
            using var jpeg = SKImage.FromBitmap(big).Encode(SKEncodedImageFormat.Jpeg, 80);
            using var decoded = ImagePipeline.DecodeUpright(jpeg.ToArray());
            decoded.Width.Should().BeInRange(ImagePipeline.MaxSide, 3000);
            ImagePipeline.Process(jpeg.ToArray()).Width.Should().Be(ImagePipeline.MaxSide);
        }
        // A PNG has no scaled decode: past MaxPixels it is never decoded at all.
        using (var wide = new SKBitmap(5000, 4000))
        {
            wide.Erase(new SKColor(120, 130, 140));
            using var png = SKImage.FromBitmap(wide).Encode(SKEncodedImageFormat.Png, 100);
            var act = () => ImagePipeline.Process(png.ToArray());
            act.Should().Throw<MinglDingl.Engine.Kernel.Errors.DomainException>().Where(e => e.Code == "photos.too_large");
        }
    }

    [Fact]
    public void A_plain_field_has_no_face()
    {
        using var bmp = new SKBitmap(900, 1200);
        using (var canvas = new SKCanvas(bmp))
        using (var paint = new SKPaint { Shader = SKShader.CreateLinearGradient(new SKPoint(0, 0), new SKPoint(0, 1200),
                   [new SKColor(90, 140, 210), new SKColor(80, 150, 70)], SKShaderTileMode.Clamp) })
            canvas.DrawRect(0, 0, 900, 1200, paint);
        using var jpeg = SKImage.FromBitmap(bmp).Encode(SKEncodedImageFormat.Jpeg, 90);
        ImagePipeline.Process(jpeg.ToArray(), findFace: true).Face.Should().BeFalse();
    }

    [Fact]
    public async Task The_same_photo_again_is_refused_whether_it_is_yours_or_someone_elses()
    {
        var (f, store, c, vm) = await Ready(db); await using var _f = f;
        await f.SetConfigAsync(ConfigKeys.PhotosRefuseSame, "true");
        // Pictures made here, not fixtures: other tests on this database already stored those.
        await f.SetConfigAsync(ConfigKeys.PhotosRequireFace, "false");
        var bytes = Patchwork();
        (await c.UploadRawAsync(bytes)).EnsureSuccessStatusCode();

        // Re-encoded smaller, as a screenshot or a resend through a chat app would be.
        using var original = SKBitmap.Decode(bytes);
        using var smaller = original.Resize(new SKImageInfo(original.Width * 2 / 3, original.Height * 2 / 3), new SKSamplingOptions(SKCubicResampler.Mitchell));
        using var resent = SKImage.FromBitmap(smaller).Encode(SKEncodedImageFormat.Jpeg, 60);
        var mine = await c.UploadRawAsync(resent.ToArray());
        mine.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await CodeOf(mine)).Should().Be("photos.same");

        var other = f.As(await f.SignInAsync(vm, phone: "99112244"));
        await other.CreateAsync();
        var theirs = await other.UploadRawAsync(bytes);
        theirs.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await CodeOf(theirs)).Should().Be("photos.taken");

        store.Files.Should().HaveCount(1);
        (await other.PhotosAsync()).Should().BeEmpty();

        // A different photo still goes up.
        (await other.UploadRawAsync(Patchwork())).EnsureSuccessStatusCode();
    }

    /// A photo no one has: a 6×8 patchwork of random greys.
    private static byte[] Patchwork()
    {
        var rng = new Random();
        using var bmp = new SKBitmap(900, 1200);
        using (var canvas = new SKCanvas(bmp))
            for (var y = 0; y < 8; y++)
                for (var x = 0; x < 6; x++)
                {
                    var v = (byte)rng.Next(256);
                    using var paint = new SKPaint { Color = new SKColor(v, v, v) };
                    canvas.DrawRect(x * 150, y * 150, 150, 150, paint);
                }
        using var jpeg = SKImage.FromBitmap(bmp).Encode(SKEncodedImageFormat.Jpeg, 90);
        return jpeg.ToArray();
    }

    [Fact]
    public void The_same_photo_hash_holds_through_re_encoding_and_tells_different_photos_apart()
    {
        long HashOf(string fixture, double scale = 1, int quality = 90)
        {
            using var src = SKBitmap.Decode(File.ReadAllBytes(PhotoDriver.Fixture(fixture)));
            using var sized = src.Resize(new SKImageInfo((int)(src.Width * scale), (int)(src.Height * scale)), new SKSamplingOptions(SKCubicResampler.Mitchell));
            using var jpeg = SKImage.FromBitmap(sized).Encode(SKEncodedImageFormat.Jpeg, quality);
            return ImagePipeline.Process(jpeg.ToArray()).SameHash;
        }
        int Bits(long a, long b) => System.Numerics.BitOperations.PopCount((ulong)(a ^ b));

        var three = HashOf("photo-3.jpg");
        Bits(three, HashOf("photo-3.jpg", 0.4, 55)).Should().BeLessThanOrEqualTo(3);
        Bits(three, HashOf("photo-1.jpg")).Should().BeGreaterThan(16);
        Bits(three, HashOf("photo-2.jpg")).Should().BeGreaterThan(16);
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
        (await CodeOf(r)).Should().Be("photos.full");
    }

    [Fact]
    public async Task Non_image_is_400()
    {
        var (f, _, c, _) = await Ready(db); await using var _f = f;
        var r = await c.UploadRawAsync(Encoding.UTF8.GetBytes("not an image at all"));
        r.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await CodeOf(r)).Should().Be("photos.not_image");
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
        (await CodeOf(bad)).Should().Be("photos.order_mismatch");
        var dup = await c.PutAsJsonAsync("/me/photos/order", new ReorderRequest([d.Id, d.Id, a.Id]));
        (await CodeOf(dup)).Should().Be("photos.order_mismatch");
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
        (await CodeOf(r)).Should().Be("photos.min");
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
        var vm = f.UseScriptedWeSend(); f.UseMemoryPhotoStore();
        var s = await f.SignInAsync(vm);
        var c = f.As(s);
        await c.CreateAsync();
        await using var l = await f.ListenAsync(s);
        await c.UploadAsync();
        (await l.WaitForAsync(LiveKinds.PhotosUpdated)).Should().NotBeNull();
    }
}
