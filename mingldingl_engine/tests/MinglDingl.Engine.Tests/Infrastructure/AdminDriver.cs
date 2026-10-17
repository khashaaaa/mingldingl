using System.Net.Http.Json;
using MinglDingl.Engine.Features.Admin;

namespace MinglDingl.Engine.Tests.Infrastructure;

public static class AdminDriver
{
    public const string Password = "correct horse battery staple";

    public static Task<HttpResponseMessage> LoginRawAsync(this HttpClient c, string password = Password, string username = "admin") =>
        c.PostAsJsonAsync("/admin/auth/login", new AdminLoginRequest(username, password));

    public static async Task<HttpClient> AdminAsync(this EngineFactory f)
    {
        var r = await f.Client().LoginRawAsync();
        r.EnsureSuccessStatusCode();
        var token = (await r.Content.ReadFromJsonAsync<AdminLoginResponse>())!.Token;
        var c = f.Client();
        c.DefaultRequestHeaders.Authorization = new("Bearer", token);
        c.DefaultRequestHeaders.Add("X-Test-Admin-Token", token);
        return c;
    }

    public static string AdminToken(this HttpClient c) => c.DefaultRequestHeaders.GetValues("X-Test-Admin-Token").Single();
}
