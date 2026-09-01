using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

/// <summary>
/// Thin client for verify.mn — a Mongolia-only Mobile-Originated SMS verification API.
/// The user sends an SMS containing our code to shortcode 144773; we poll for the result.
/// Docs: https://verify.mn (#api)
/// </summary>
public class VerifyMnClient
{
    private readonly HttpClient _http;
    private readonly ILogger<VerifyMnClient> _logger;
    private readonly bool _configured;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public VerifyMnClient(HttpClient http, IConfiguration config, ILogger<VerifyMnClient> logger)
    {
        _http = http;
        _logger = logger;

        var apiKey = config["VerifyMn:ApiKey"];
        var baseUrl = config["VerifyMn:BaseUrl"] ?? "https://api.verify.mn";
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _configured = false;
            _logger.LogWarning("VerifyMn:ApiKey is not configured; phone verification is disabled");
            return;
        }

        _configured = true;
        _http.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
        _http.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
    }

    public bool IsConfigured => _configured;

    /// <summary>
    /// Creates a verification session. <paramref name="callbackUrl"/> is optional — verify.mn
    /// retries failed callbacks, so it must be omitted rather than faked when unreachable.
    /// </summary>
    public async Task<VerifyMnSession?> CreateSessionAsync(
        string phone, string code, string? callbackUrl, CancellationToken ct = default)
    {
        if (!_configured) return null;

        var payload = JsonSerializer.Serialize(
            new { phone, text = code, callback = callbackUrl }, JsonOptions);

        using var res = await _http.PostAsync(
            "sessions", new StringContent(payload, Encoding.UTF8, "application/json"), ct);

        if (!res.IsSuccessStatusCode)
        {
            // Never log the response body of an auth failure, and never log the key itself.
            _logger.LogWarning("verify.mn create session failed with {Status}", res.StatusCode);
            return null;
        }

        return await JsonSerializer.DeserializeAsync<VerifyMnSession>(
            await res.Content.ReadAsStreamAsync(ct), JsonOptions, ct);
    }

    /// <summary>Authoritative status check. The callback is only a wake-up signal — always re-check here.</summary>
    public async Task<VerifyMnStatus?> GetSessionAsync(string sessionId, CancellationToken ct = default)
    {
        if (!_configured) return null;

        using var res = await _http.GetAsync($"sessions/{Uri.EscapeDataString(sessionId)}", ct);
        if (res.StatusCode == HttpStatusCode.NotFound) return null;
        if (!res.IsSuccessStatusCode)
        {
            _logger.LogWarning("verify.mn status check failed with {Status}", res.StatusCode);
            return null;
        }

        return await JsonSerializer.DeserializeAsync<VerifyMnStatus>(
            await res.Content.ReadAsStreamAsync(ct), JsonOptions, ct);
    }
}

public record VerifyMnSession(
    string SessionId,
    string Phone,
    string Shortcode,
    string Text,
    string SmsUri,
    string DisplayInstruction,
    DateTime ExpiresAt);

public record VerifyMnStatus(
    string SessionId,
    string SessionStatus,
    string? CallbackStatus,
    DateTime? VerifiedAt,
    DateTime ExpiresAt);
