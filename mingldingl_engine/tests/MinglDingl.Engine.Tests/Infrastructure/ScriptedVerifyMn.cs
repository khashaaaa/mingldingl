using System.Collections.Concurrent;
using MinglDingl.Engine.Features.Auth;

namespace MinglDingl.Engine.Tests.Infrastructure;

/// A verify.mn the test drives: sessions stay PENDING until the test verifies or expires them.
public sealed class ScriptedVerifyMn(TestClock clock) : IVerifyMnClient
{
    private readonly ConcurrentDictionary<string, (string Phone, string Code, string Status)> _sessions = new();
    private int _n;
    public bool FailOpen { get; set; }
    public int OpenCalls => _n;

    public Task<VerifyMnSession?> OpenAsync(string phone, string code, CancellationToken ct = default)
    {
        if (FailOpen) return Task.FromResult<VerifyMnSession?>(null);
        var id = $"p-{Interlocked.Increment(ref _n)}";
        _sessions[id] = (phone, code, "PENDING");
        return Task.FromResult<VerifyMnSession?>(new VerifyMnSession(id, phone, "144773", code,
            $"sms:144773?body={code}", $"{code} кодыг 144773 дугаарт илгээнэ үү", clock.UtcNow.AddMinutes(10).UtcDateTime));
    }

    public Task<VerifyMnStatus?> ReadAsync(string providerId, CancellationToken ct = default)
    {
        if (!_sessions.TryGetValue(providerId, out var s)) return Task.FromResult<VerifyMnStatus?>(null);
        return Task.FromResult<VerifyMnStatus?>(new VerifyMnStatus(providerId, s.Status, null,
            s.Status == "VERIFIED" ? clock.UtcNow.UtcDateTime : null, clock.UtcNow.AddMinutes(10).UtcDateTime));
    }

    public void VerifyCode(string code) => Set(code, "VERIFIED");
    public void ExpireCode(string code) => Set(code, "EXPIRED");

    private void Set(string code, string status)
    {
        var id = _sessions.Single(kv => kv.Value.Code == code).Key;
        _sessions[id] = _sessions[id] with { Status = status };
    }
}
