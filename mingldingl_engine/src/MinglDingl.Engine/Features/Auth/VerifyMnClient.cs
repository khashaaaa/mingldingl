using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace MinglDingl.Engine.Features.Auth;

public sealed record VerifyMnSession(
    string SessionId, string Phone, string Shortcode, string Text, string SmsUri, string DisplayInstruction, DateTime ExpiresAt);

public sealed record VerifyMnStatus(
    string SessionId, string SessionStatus, string? CallbackStatus, DateTime? VerifiedAt, DateTime ExpiresAt);

/// verify.mn — Mongolia-only Mobile-Originated SMS verification. The person texts our code to
/// shortcode 144773 from the number being claimed; we read the session's status.
public interface IVerifyMnClient
{
    /// Opens a provider session; null when the provider refused or is unreachable.
    Task<VerifyMnSession?> OpenAsync(string phone, string code, CancellationToken ct = default);

    /// Authoritative status; null when unknown to the provider or unreachable.
    Task<VerifyMnStatus?> ReadAsync(string providerId, CancellationToken ct = default);
}

public sealed class VerifyMnClient(HttpClient http, ILogger<VerifyMnClient> log) : IVerifyMnClient
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public async Task<VerifyMnSession?> OpenAsync(string phone, string code, CancellationToken ct = default)
    {
        try
        {
            using var res = await http.PostAsJsonAsync("sessions", new { phone, text = code }, Json, ct);
            if (!res.IsSuccessStatusCode)
            {
                log.LogWarning("verify.mn open failed with {Status}", res.StatusCode); // never the body or key
                return null;
            }
            return await res.Content.ReadFromJsonAsync<VerifyMnSession>(Json, ct);
        }
        catch (HttpRequestException e)
        {
            log.LogWarning(e, "verify.mn unreachable");
            return null;
        }
    }

    public async Task<VerifyMnStatus?> ReadAsync(string providerId, CancellationToken ct = default)
    {
        try
        {
            using var res = await http.GetAsync($"sessions/{Uri.EscapeDataString(providerId)}", ct);
            if (res.StatusCode == HttpStatusCode.NotFound) return null;
            if (!res.IsSuccessStatusCode)
            {
                log.LogWarning("verify.mn status failed with {Status}", res.StatusCode);
                return null;
            }
            return await res.Content.ReadFromJsonAsync<VerifyMnStatus>(Json, ct);
        }
        catch (HttpRequestException e)
        {
            log.LogWarning(e, "verify.mn unreachable");
            return null;
        }
    }
}

/// Development only: no SMS, no 150₮ — a session reads VERIFIED the first time it is read.
/// Program refuses to start with it outside Development.
public sealed class FakeVerifyMnClient : IVerifyMnClient
{
    /// Every other number verifies at once; these two hold the screens only a real text would reach.
    public const string StaysPending = "99000000";
    public const string Expires = "99000001";

    public Task<VerifyMnSession?> OpenAsync(string phone, string code, CancellationToken ct = default) =>
        Task.FromResult<VerifyMnSession?>(new VerifyMnSession(
            $"fake-{phone}-{Guid.NewGuid():N}", phone, "144773", code, $"sms:144773?body={code}",
            $"[DEV] {code} кодыг 144773 дугаарт илгээнэ үү — no SMS needed, it verifies by itself",
            DateTime.UtcNow.AddMinutes(10)));

    public Task<VerifyMnStatus?> ReadAsync(string providerId, CancellationToken ct = default)
    {
        var status = providerId.StartsWith($"fake-{StaysPending}-") ? "PENDING"
            : providerId.StartsWith($"fake-{Expires}-") ? "EXPIRED"
            : "VERIFIED";
        return Task.FromResult<VerifyMnStatus?>(new VerifyMnStatus(providerId, status, null, DateTime.UtcNow, DateTime.UtcNow.AddMinutes(10)));
    }
}
