using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace MinglDingl.Engine.Features.Auth;

public enum CodeSent { Sent, TooMany, BadNumber, Unavailable }

/// id and expiresAt are set only when Sent.
public sealed record SentCode(CodeSent Outcome, string? Id = null, DateTimeOffset? ExpiresAt = null);

public enum CodeChecked { Approved, Wrong, TooManyAttempts, Expired, Unavailable }

/// WeSend — Mongolia-only SMS verification. WeSend makes the code, texts it to the number and checks
/// what the person typed; we never hold the code. Sending a new code to a number cancels its last one.
public interface IWeSend
{
    Task<SentCode> SendCodeAsync(string phone, string locale, CancellationToken ct = default);
    Task<CodeChecked> CheckAsync(string providerId, string code, CancellationToken ct = default);

    /// Whether a code to this number goes out as a paid text. One that does not (the review number)
    /// is never counted against the text caps, but its fixed code is guarded by the day instead.
    bool Texts(string phone) => true;
}

public sealed class WeSendClient(HttpClient http, ILogger<WeSendClient> log) : IWeSend
{
    /// Seconds a code lives (WeSend allows 60–600).
    public const int CodeTtl = 600;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private sealed record Verification(string Id, string Status, DateTimeOffset ExpiresAt);
    private sealed record WeSendError(ErrorDetail? Error);
    private sealed record ErrorDetail(string? Code);

    public async Task<SentCode> SendCodeAsync(string phone, string locale, CancellationToken ct = default)
    {
        try
        {
            using var res = await http.PostAsJsonAsync("v1/verify",
                new { to = phone, locale, brand = "MingldIngl", code_length = 6, ttl = CodeTtl }, Json, ct);
            if (res.IsSuccessStatusCode)
            {
                var v = (await res.Content.ReadFromJsonAsync<Verification>(Json, ct))!;
                return new SentCode(CodeSent.Sent, v.Id, v.ExpiresAt);
            }
            var code = await ErrorCodeAsync(res, ct);
            log.LogWarning("WeSend send refused with {Status} {Code}", res.StatusCode, code); // never the number or key
            return code switch
            {
                "recipient_rate_limited" or "max_attempts_reached" => new SentCode(CodeSent.TooMany),
                "unsupported_number" => new SentCode(CodeSent.BadNumber),
                _ => new SentCode(CodeSent.Unavailable),
            };
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
        {
            log.LogWarning(e, "WeSend unreachable");
            return new SentCode(CodeSent.Unavailable);
        }
    }

    public async Task<CodeChecked> CheckAsync(string providerId, string code, CancellationToken ct = default)
    {
        try
        {
            using var res = await http.PostAsJsonAsync($"v1/verify/{Uri.EscapeDataString(providerId)}/check", new { code }, Json, ct);
            if (res.IsSuccessStatusCode) return CodeChecked.Approved;
            var error = await ErrorCodeAsync(res, ct);
            switch (error)
            {
                case "invalid_code": return CodeChecked.Wrong;
                case "max_attempts_reached": return CodeChecked.TooManyAttempts;
                case "verification_expired": return CodeChecked.Expired;
                // "already approved": a retry after a lost answer, so it is ours.
                case "invalid_request" when res.StatusCode == HttpStatusCode.BadRequest: return CodeChecked.Approved;
            }
            log.LogWarning("WeSend check refused with {Status} {Code}", res.StatusCode, error);
            return res.StatusCode == HttpStatusCode.NotFound ? CodeChecked.Expired : CodeChecked.Unavailable;
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
        {
            log.LogWarning(e, "WeSend unreachable");
            return CodeChecked.Unavailable;
        }
    }

    private static async Task<string?> ErrorCodeAsync(HttpResponseMessage res, CancellationToken ct)
    {
        try { return (await res.Content.ReadFromJsonAsync<WeSendError>(Json, ct))?.Error?.Code; }
        catch (JsonException) { return null; }
    }
}

/// Development only: no SMS, no credits. Every code is 000000 (as in WeSend's sandbox); one number
/// keeps the screen only a slow typist reaches. Program refuses to start with it outside Development.
public sealed class FakeWeSend : IWeSend
{
    public const string Code = "000000";
    public const string Expires = "99000001";

    public Task<SentCode> SendCodeAsync(string phone, string locale, CancellationToken ct = default) =>
        Task.FromResult(new SentCode(CodeSent.Sent, $"fake-{phone}-{Guid.NewGuid():N}", DateTimeOffset.UtcNow.AddSeconds(WeSendClient.CodeTtl)));

    /// No text ever goes, so the text caps never stop a day of dev sign-ins.
    public bool Texts(string phone) => false;

    public Task<CodeChecked> CheckAsync(string providerId, string code, CancellationToken ct = default) =>
        Task.FromResult(providerId.StartsWith($"fake-{Expires}-") ? CodeChecked.Expired
            : code == Code ? CodeChecked.Approved
            : CodeChecked.Wrong);
}

/// Store review: the stores' reviewers have no Mongolian SIM, so one number (`Review:Phone`, a
/// landline that can never receive a text) gets no text and passes only with `Review:Code`. Every
/// other number goes to WeSend. Unset = off.
public sealed class ReviewWeSend(IWeSend inner, string phone, string code) : IWeSend
{
    private const string Prefix = "review-";

    public Task<SentCode> SendCodeAsync(string to, string locale, CancellationToken ct = default) =>
        to == phone
            ? Task.FromResult(new SentCode(CodeSent.Sent, $"{Prefix}{Guid.NewGuid():N}", DateTimeOffset.UtcNow.AddSeconds(WeSendClient.CodeTtl)))
            : inner.SendCodeAsync(to, locale, ct);

    public bool Texts(string to) => to != phone && inner.Texts(to);

    public Task<CodeChecked> CheckAsync(string providerId, string typed, CancellationToken ct = default) =>
        providerId.StartsWith(Prefix)
            ? Task.FromResult(CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(typed), Encoding.UTF8.GetBytes(code))
                ? CodeChecked.Approved : CodeChecked.Wrong)
            : inner.CheckAsync(providerId, typed, ct);
}
