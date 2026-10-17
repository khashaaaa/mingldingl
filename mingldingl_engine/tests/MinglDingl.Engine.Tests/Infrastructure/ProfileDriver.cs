using System.Net.Http.Json;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Profile;

namespace MinglDingl.Engine.Tests.Infrastructure;

public static class ProfileDriver
{
    public static readonly DateOnly Adult = new(1998, 3, 14);

    public static async Task<MeView> MeAsync(this HttpClient c) => (await c.GetFromJsonAsync<MeView>("/me"))!;

    public static Task<HttpResponseMessage> CreateAsync(this HttpClient c, string name = "Saruul", DateOnly? birth = null, string locale = "en") =>
        c.PostAsJsonAsync("/me", new CreateProfileRequest(name, birth ?? Adult, locale));

    public static Task<HttpResponseMessage> UpdateAsync(this HttpClient c, UpdateProfileRequest req) =>
        c.PutAsJsonAsync("/me", req);

    public static UpdateProfileRequest Upd(string? name = null, string? gender = null, string? bio = null, string? city = null,
        string? oath = null, string? locale = null, bool? welcomed = null) => new(name, gender, bio, city, oath, locale, welcomed);
}
