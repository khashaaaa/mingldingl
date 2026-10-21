using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using MinglDingl.Engine.Features.Membership;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Features.Seek;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Tests.Infrastructure;
using SkiaSharp;
using static MinglDingl.Engine.Tests.Infrastructure.ProfileDriver;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Photos;

public class FaceProofTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    // One crowd traveller: p02_1 is her face turned to her right (the nose ~0.2 eye spans further to the
    // photo's left than in p02_2), the others look straight on.
    private static readonly string[] Hers = ["Seed/crowd/p02_0.jpg", "Seed/crowd/p02_2.jpg", "Seed/crowd/p02_3.jpg"];
    private static readonly string[] His = ["Seed/crowd/p01_0.jpg", "Seed/crowd/p01_1.jpg", "Seed/crowd/p01_2.jpg"];

    private static byte[] Photo(string file) => File.ReadAllBytes(Path.Combine(AppContext.BaseDirectory, "Seed/crowd", file));

    private static (byte[] Straight, byte[] Turned) HerSelfies() => (Photo("p02_2.jpg"), Photo("p02_1.jpg"));

    [Fact]
    public async Task Her_own_face_turned_as_asked_proves_it_and_the_mark_reaches_her_and_whoever_sees_her()
    {
        await using var w = await World.CreateAsync(db);
        var her = await w.PersonAsync("Anujin", "Female", portraits: Hers);
        var him = await w.PersonAsync("Bat", "Male");
        (await him.C.SeekAsync()).Candidate!.FaceProven.Should().BeFalse();

        var (straight, turned) = HerSelfies();
        var r = await her.C.ProveFaceAsync(straight, turned);
        r.Outcome.Should().Be("proven");
        r.Status.Proven.Should().BeTrue();
        (await her.C.MeAsync()).Profile!.FaceProvenAt.Should().NotBeNull();
        (await him.C.SeekAsync()).Candidate!.FaceProven.Should().BeTrue();
    }

    [Fact]
    public async Task A_new_portrait_takes_the_mark_off()
    {
        await using var w = await World.CreateAsync(db);
        var her = await w.PersonAsync("Anujin", "Female", portraits: Hers);
        var (straight, turned) = HerSelfies();
        (await her.C.ProveFaceAsync(straight, turned)).Outcome.Should().Be("proven");

        (await her.C.UploadRawAsync(Photo("p02_1.jpg"))).EnsureSuccessStatusCode();
        (await her.C.MeAsync()).Profile!.FaceProvenAt.Should().BeNull();
        (await her.C.FaceAsync()).Proven.Should().BeFalse();
    }

    [Fact]
    public async Task Someone_elses_face_does_not_prove_his_portraits()
    {
        await using var w = await World.CreateAsync(db);
        var him = await w.PersonAsync("Bat", "Male", portraits: His);
        var (straight, turned) = HerSelfies();
        (await him.C.ProveFaceAsync(straight, turned)).Outcome.Should().Be("notYou");
        (await him.C.MeAsync()).Profile!.FaceProvenAt.Should().BeNull();
    }

    [Fact]
    public async Task A_second_selfie_that_is_not_turned_is_refused_and_each_try_asks_afresh()
    {
        await using var w = await World.CreateAsync(db);
        await w.SetAsync(ConfigKeys.FaceTriesPerDay, "20");
        var her = await w.PersonAsync("Anujin", "Female", portraits: Hers);
        var (straight, _) = HerSelfies();
        var asked = new HashSet<string>();
        for (var i = 0; i < 12; i++)
        {
            asked.Add((await her.C.FaceAsync()).Turn);
            (await her.C.ProveFaceAsync(straight, Photo("p02_3.jpg"))).Outcome.Should().Be("turn");
        }
        asked.Should().BeEquivalentTo(["left", "right"]);
    }

    [Fact]
    public async Task A_selfie_with_no_face_is_noFace()
    {
        await using var w = await World.CreateAsync(db);
        var her = await w.PersonAsync("Anujin", "Female", portraits: Hers);
        using var bmp = new SKBitmap(600, 800);
        using (var canvas = new SKCanvas(bmp)) canvas.Clear(new SKColor(90, 140, 210));
        var field = SKImage.FromBitmap(bmp).Encode(SKEncodedImageFormat.Jpeg, 90).ToArray();
        (await her.C.ProveFaceAsync(field, field)).Outcome.Should().Be("noFace");
    }

    [Fact]
    public async Task Three_tries_a_day_then_a_new_day_brings_them_back()
    {
        await using var w = await World.CreateAsync(db);
        var her = await w.PersonAsync("Anujin", "Female", portraits: Hers);
        var straight = Photo("p02_2.jpg");
        for (var i = 0; i < 3; i++) (await her.C.ProveFaceAsync(straight, straight)).Status.TriesLeft.Should().Be(2 - i);
        var r = await her.C.ProveFaceRawAsync(straight, straight);
        r.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await CodeOf(r)).Should().Be("face.tries");

        await w.AdvanceAsync(TimeSpan.FromDays(1));
        (await her.C.FaceAsync()).TriesLeft.Should().Be(3);
    }

    [Fact]
    public async Task An_unfinished_character_or_a_closed_check_is_refused()
    {
        await using var w = await World.CreateAsync(db);
        var s = await w.F.SignInAsync(w.Vm);
        var c = w.F.As(s);
        (await c.CreateAsync("Saruul")).EnsureSuccessStatusCode();
        var straight = Photo("p02_2.jpg");
        (await CodeOf(await c.ProveFaceRawAsync(straight, straight))).Should().Be("face.not_ready");

        var her = await w.PersonAsync("Anujin", "Female", portraits: Hers);
        await w.SetAsync(ConfigKeys.FaceCheck, "false");
        (await her.C.FaceAsync()).Open.Should().BeFalse();
        (await CodeOf(await her.C.ProveFaceRawAsync(straight, straight))).Should().Be("face.closed");
    }

    [Fact]
    public async Task A_proven_face_earns_points_once_and_skips_the_newcomers_limit()
    {
        await using var w = await World.CreateAsync(db);
        var her = await w.PersonAsync("Anujin", "Female", portraits: Hers);
        await w.PersonAsync("Bat", "Male");
        var before = await her.C.PointsAsync();
        (await her.C.SeekAsync()).CandlesPerDay.Should().Be(3, "a character finished today is held to the newcomer's summons");

        var (straight, turned) = HerSelfies();
        (await her.C.ProveFaceAsync(straight, turned)).Outcome.Should().Be("proven");
        (await her.C.PointsAsync()).Should().Be(before + 20);
        (await her.C.SeekAsync()).CandlesPerDay.Should().BeGreaterThan(3);

        // A new portrait takes the mark off; proving it again pays nothing more.
        (await her.C.UploadRawAsync(Photo("p02_1.jpg"))).EnsureSuccessStatusCode();
        (await her.C.SeekAsync()).CandlesPerDay.Should().Be(3);
        (await her.C.ProveFaceAsync(straight, turned)).Outcome.Should().Be("proven");
        (await her.C.PointsAsync()).Should().Be(before + 20);
    }

    [Fact]
    public async Task Among_equals_a_proven_face_comes_first_and_a_member_may_ask_for_proven_faces_only()
    {
        await using var w = await World.CreateAsync(db);
        var bat = await w.PersonAsync("Bat", "Male");
        var her = await w.PersonAsync("Anujin", "Female", portraits: Hers);
        await w.AdvanceAsync(TimeSpan.FromMinutes(1));
        var saraa = await w.PersonAsync("Saraa", "Female");
        (await bat.C.SeekAsync()).Candidate!.AccountId.Should().Be(saraa.Id, "the one seen last comes first among equals");

        var (straight, turned) = HerSelfies();
        (await her.C.ProveFaceAsync(straight, turned)).Outcome.Should().Be("proven");
        (await bat.C.SeekAsync()).Candidate!.AccountId.Should().Be(her.Id);
        await w.SetAsync(ConfigKeys.SeekFaceFirst, "false");
        (await bat.C.SeekAsync()).Candidate!.AccountId.Should().Be(saraa.Id);

        (await CodeOf(await bat.C.PutAsJsonAsync("/seek/filters", OnlyProven))).Should().Be("membership.hall");
        await w.FloorAsync(bat, Floor.Hall, days: 30);
        (await bat.C.PutAsJsonAsync("/seek/filters", OnlyProven)).EnsureSuccessStatusCode();
        var seek = await bat.C.SeekAsync();
        seek.Filtered.Should().BeTrue();
        seek.Candidate!.AccountId.Should().Be(her.Id);
        (await bat.C.PostAsync($"/seek/{her.Id}/pass", null)).EnsureSuccessStatusCode();
        (await bat.C.SeekAsync()).State.Should().Be("empty", "nobody else has proven their face");
    }

    private static readonly SeekFilterRequest OnlyProven = new(null, null, null, null, null, null, null, FaceProven: true);
}

public static class FaceDriver
{
    public static async Task<FaceProofView> FaceAsync(this HttpClient c) => (await c.GetFromJsonAsync<FaceProofView>("/me/face"))!;

    public static Task<HttpResponseMessage> ProveFaceRawAsync(this HttpClient c, byte[] straight, byte[] turned)
    {
        var form = new MultipartFormDataContent();
        foreach (var (name, bytes) in new[] { ("straight", straight), ("turned", turned) })
        {
            var part = new ByteArrayContent(bytes);
            part.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
            form.Add(part, name, $"{name}.jpg");
        }
        return c.PostAsync("/me/face", form);
    }

    public static async Task<FaceProofResult> ProveFaceAsync(this HttpClient c, byte[] straight, byte[] turned)
    {
        var r = await c.ProveFaceRawAsync(straight, turned);
        r.EnsureSuccessStatusCode();
        return (await r.Content.ReadFromJsonAsync<FaceProofResult>())!;
    }
}
