using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using MinglDingl.Engine.Features.Venues;

namespace MinglDingl.Engine.Tests.Infrastructure;

/// Venues, encounters, calls and meetings as the app and the keepers drive them.
public static class EncounterDriver
{
    public static VenueWriteRequest Place(string name = "Nomad Café", string district = "Bayangol", string kind = "Cafe", bool verified = true) =>
        new(name, null, kind, district, "Peace Avenue 14", "09:00–22:00", "Low tables, felt walls.", verified);

    public static async Task<AdminVenueView> AddVenueAsync(this HttpClient admin, VenueWriteRequest? req = null)
    {
        var r = await admin.PostAsJsonAsync("/admin/venues", req ?? Place());
        r.EnsureSuccessStatusCode();
        return (await r.Content.ReadFromJsonAsync<AdminVenueView>())!;
    }

    public static async Task<HttpResponseMessage> AddVenuePhotoRawAsync(this HttpClient admin, Guid venue, string fixture = "photo-1.jpg")
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(await File.ReadAllBytesAsync(PhotoDriver.Fixture(fixture)));
        file.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        form.Add(file, "file", "v.jpg");
        return await admin.PostAsync($"/admin/venues/{venue}/photos", form);
    }

    public static async Task<List<VenueView>> VenuesAsync(this HttpClient c, Guid? bond = null) =>
        (await c.GetFromJsonAsync<List<VenueView>>(bond is null ? "/venues" : $"/venues?bond={bond}"))!;

    public static async Task<T> Read<T>(this HttpResponseMessage r)
    {
        r.IsSuccessStatusCode.Should().BeTrue(await r.Content.ReadAsStringAsync());
        return (await r.Content.ReadFromJsonAsync<T>())!;
    }
}

public static class EncounterSteps
{
    public static async Task<MinglDingl.Engine.Features.Encounters.EncounterView> EncounterAsync(this HttpClient c, Guid bond) =>
        (await c.GetFromJsonAsync<MinglDingl.Engine.Features.Encounters.EncounterView>($"/bonds/{bond}/encounter"))!;

    public static Task<HttpResponseMessage> IcebreakerRawAsync(this HttpClient c, Guid bond, string text) =>
        c.PostAsJsonAsync($"/bonds/{bond}/encounter/icebreaker", new MinglDingl.Engine.Features.Encounters.IcebreakerAnswerRequest(text));

    public static Task<HttpResponseMessage> TrialRawAsync(this HttpClient c, Guid bond, int index, int choice) =>
        c.PostAsJsonAsync($"/bonds/{bond}/encounter/trial", new MinglDingl.Engine.Features.Encounters.TrialAnswerRequest(index, choice));

    public static async Task TrialAllAsync(this HttpClient c, Guid bond, params int[] choices)
    {
        for (var i = 0; i < choices.Length; i++) (await c.TrialRawAsync(bond, i, choices[i])).EnsureSuccessStatusCode();
    }
}

public static class MeetingSteps
{
    public static Task<HttpResponseMessage> ProposeRawAsync(this HttpClient c, Guid bond, Guid venue, DateTimeOffset at) =>
        c.PostAsJsonAsync($"/bonds/{bond}/meeting", new MinglDingl.Engine.Features.Encounters.MeetingProposal(venue, at));

    public static async Task<MinglDingl.Engine.Features.Encounters.MeetingView> ProposeAsync(this HttpClient c, Guid bond, Guid venue, DateTimeOffset at) =>
        (await (await c.ProposeRawAsync(bond, venue, at)).Read<MinglDingl.Engine.Features.Encounters.EncounterView>()).Meeting!.Current!;

    public static Task<HttpResponseMessage> MeetingActRawAsync(this HttpClient c, Guid bond, Guid meeting, string act) =>
        c.PostAsync($"/bonds/{bond}/meeting/{meeting}/{act}", null);

    public static Task<HttpResponseMessage> AttendRawAsync(this HttpClient c, Guid bond, Guid meeting, string answer) =>
        c.PostAsJsonAsync($"/bonds/{bond}/meeting/{meeting}/attendance", new MinglDingl.Engine.Features.Encounters.AttendanceRequest(answer));

    public static Task<HttpResponseMessage> RateRawAsync(this HttpClient c, Guid bond, Guid meeting, int stars) =>
        c.PostAsJsonAsync($"/bonds/{bond}/meeting/{meeting}/rating", new MinglDingl.Engine.Features.Encounters.RatingRequest(stars));
}
