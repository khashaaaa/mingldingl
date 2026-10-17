using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MinglDingl.Engine.Features.Auth;

namespace MinglDingl.Engine.Tests.Infrastructure;

public static class AuthDriver
{
    public static ScriptedVerifyMn UseScriptedVerifyMn(this EngineFactory f)
    {
        var fake = new ScriptedVerifyMn(f.Clock);
        f.WithServices(s => { s.RemoveAll<IVerifyMnClient>(); s.AddSingleton<IVerifyMnClient>(fake); });
        return fake;
    }

    public static async Task<StartResponse> StartAsync(this HttpClient c, string phone, Guid? resume = null)
    {
        var r = await c.PostAsJsonAsync("/auth/phone/start", new StartRequest(phone, resume));
        r.EnsureSuccessStatusCode();
        return (await r.Content.ReadFromJsonAsync<StartResponse>())!;
    }

    public static async Task<string> StatusAsync(this HttpClient c, Guid id)
    {
        var r = await c.GetFromJsonAsync<StatusResponse>($"/auth/phone/status/{id}");
        return r!.State;
    }
}

public static class SessionDriver
{
    private static int _phone = 99000000;
    public static string NewPhone() => Interlocked.Increment(ref _phone).ToString();

    public static async Task<HttpResponseMessage> CompleteRawAsync(this HttpClient c, Guid verificationId, string device = "test-phone",
        string? allyCode = null) =>
        await c.PostAsJsonAsync("/auth/phone/complete", new CompleteRequest(verificationId, device, allyCode));

    /// Full sign-in through the scripted verify.mn: start → text the code → status → complete.
    public static async Task<SessionPair> SignInAsync(this EngineFactory f, ScriptedVerifyMn vm, string? phone = null, string device = "test-phone",
        string? allyCode = null)
    {
        var c = f.Client();
        var s = await c.StartAsync(phone ?? NewPhone());
        vm.VerifyCode(s.Code);
        (await c.StatusAsync(s.VerificationId)).Should().Be("verified");
        var r = await c.CompleteRawAsync(s.VerificationId, device, allyCode);
        r.EnsureSuccessStatusCode();
        return (await r.Content.ReadFromJsonAsync<SessionPair>())!;
    }

    public static HttpClient As(this EngineFactory f, SessionPair s)
    {
        var c = f.Client();
        c.DefaultRequestHeaders.Authorization = new("Bearer", s.AccessToken);
        c.DefaultRequestHeaders.Add("X-Test-Refresh", s.RefreshToken); // lets a test refresh the client it holds
        return c;
    }

    public static string RefreshToken(this HttpClient c) => c.DefaultRequestHeaders.GetValues("X-Test-Refresh").Single();

    public static async Task<HttpResponseMessage> RefreshRawAsync(this HttpClient c, string refreshToken) =>
        await c.PostAsJsonAsync("/auth/refresh", new RefreshRequest(refreshToken));
}
