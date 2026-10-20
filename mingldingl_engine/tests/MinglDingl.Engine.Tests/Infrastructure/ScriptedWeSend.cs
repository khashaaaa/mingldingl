using System.Collections.Concurrent;
using MinglDingl.Engine.Features.Auth;

namespace MinglDingl.Engine.Tests.Infrastructure;

/// A WeSend the test drives: it makes a code per send (the test reads it back as if from the phone),
/// cancels a number's last code on a new send, and allows five wrong tries like the real one.
public sealed class ScriptedWeSend(TestClock clock) : IWeSend
{
    private sealed record Sent(string Phone, string Code, string Status, int Wrong);

    private readonly ConcurrentDictionary<string, Sent> _sent = new();
    private int _n;
    private string _last = "";

    public CodeSent FailSend { get; set; } = CodeSent.Sent;
    public int SendCalls => _n;

    /// The code the last text carried, as the person would read it off their phone.
    public string LastCode => _sent[_last].Code;

    public Task<SentCode> SendCodeAsync(string phone, string locale, CancellationToken ct = default)
    {
        if (FailSend != CodeSent.Sent) return Task.FromResult(new SentCode(FailSend));
        var n = Interlocked.Increment(ref _n);
        foreach (var (key, s) in _sent.Where(kv => kv.Value.Phone == phone && kv.Value.Status == "pending"))
            _sent[key] = s with { Status = "canceled" };
        var id = $"w-{n}";
        _sent[id] = new Sent(phone, (100000 + n).ToString(), "pending", 0);
        _last = id;
        return Task.FromResult(new SentCode(CodeSent.Sent, id, clock.UtcNow.AddSeconds(WeSendClient.CodeTtl)));
    }

    public Task<CodeChecked> CheckAsync(string providerId, string code, CancellationToken ct = default)
    {
        var s = _sent[providerId];
        if (s.Status == "approved") return Task.FromResult(CodeChecked.Approved);
        if (s.Status != "pending") return Task.FromResult(CodeChecked.Expired);
        if (s.Code == code)
        {
            _sent[providerId] = s with { Status = "approved" };
            return Task.FromResult(CodeChecked.Approved);
        }
        if (s.Wrong + 1 >= 5)
        {
            _sent[providerId] = s with { Status = "failed" };
            return Task.FromResult(CodeChecked.TooManyAttempts);
        }
        _sent[providerId] = s with { Wrong = s.Wrong + 1 };
        return Task.FromResult(CodeChecked.Wrong);
    }

    public void ExpireLast() => _sent[_last] = _sent[_last] with { Status = "expired" };
}
