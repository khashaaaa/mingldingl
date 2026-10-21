using System.Collections.Concurrent;
using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace MinglDingl.Engine.Features.Payments;

public sealed record QPayInvoice(string InvoiceId, string QrText, string? QrImage, IReadOnlyList<BankLink> Links);

public sealed record QPayPaid(string PaymentId, int Amount, DateTimeOffset? At);

/// QPay v2 (merchant.qpay.mn). The callback is only ever a hint: money is believed when
/// `payment/check` reports it. QPay forbids polling `payment/check` on a timer, so it is asked only
/// after a callback, and once more when an unpaid code is cancelled (a lost callback).
public interface IQPay
{
    Task<QPayInvoice> CreateInvoiceAsync(Guid invoiceId, int amount, string description, CancellationToken ct);
    Task<IReadOnlyList<QPayPaid>> PaidAsync(string qpayInvoiceId, CancellationToken ct);
    /// Cancels an unpaid invoice so its QR can no longer be paid. False when QPay refused.
    Task<bool> CancelAsync(string qpayInvoiceId, CancellationToken ct);
    /// QPay refunds through its API only where the payment allows it (cards); false means the keeper
    /// returns it by bank transfer and records that.
    Task<bool> RefundAsync(string paymentId, CancellationToken ct);
}

public sealed class QPaySettings
{
    public string ClientId { get; init; } = "";
    public string ClientSecret { get; init; } = "";
    public string InvoiceCode { get; init; } = "";
    /// The engine's public address; QPay calls {CallbackBase}/payments/qpay/callback?invoice={id}.
    public string CallbackBase { get; init; } = "";
}

/// QPay's token, shared by every request (the typed client is made per request). QPay asks that a
/// token is not fetched again while it is good: `expires_in` and `refresh_expires_in` are unix
/// timestamps, an expired access token is renewed by `auth/refresh`, and only when that fails is a
/// new one fetched with the client id and secret.
public sealed class QPayTokens
{
    internal readonly SemaphoreSlim Gate = new(1, 1);
    internal string? Access;
    internal DateTimeOffset AccessUntil;
    internal string? Refresh;
    internal DateTimeOffset RefreshUntil;
}

public sealed class QPayClient(HttpClient http, QPaySettings settings, QPayTokens tokens, ILogger<QPayClient> log) : IQPay
{
    public async Task<QPayInvoice> CreateInvoiceAsync(Guid invoiceId, int amount, string description, CancellationToken ct)
    {
        using var res = await SendAsync(HttpMethod.Post, "invoice", new
        {
            invoice_code = settings.InvoiceCode,
            sender_invoice_no = invoiceId.ToString("N"),
            invoice_receiver_code = "terminal",
            invoice_description = description,
            amount,
            callback_url = $"{settings.CallbackBase.TrimEnd('/')}/payments/qpay/callback?invoice={invoiceId}",
        }, ct);
        await EnsureAsync(res, "make invoice " + invoiceId, ct);
        var body = (await res.Content.ReadFromJsonAsync<InvoiceResponse>(ct))!;
        return new QPayInvoice(body.InvoiceId, body.QrText, body.QrImage,
            [.. (body.Urls ?? []).Select(u => new BankLink(u.Name ?? u.Description ?? "", u.Logo, u.Link ?? ""))]);
    }

    public async Task<IReadOnlyList<QPayPaid>> PaidAsync(string qpayInvoiceId, CancellationToken ct)
    {
        using var res = await SendAsync(HttpMethod.Post, "payment/check", new
        {
            object_type = "INVOICE", object_id = qpayInvoiceId, offset = new { page_number = 1, page_limit = 100 },
        }, ct);
        await EnsureAsync(res, "check invoice " + qpayInvoiceId, ct);
        var body = (await res.Content.ReadFromJsonAsync<CheckResponse>(ct))!;
        return [.. (body.Rows ?? []).Where(r => r.PaymentStatus == "PAID")
            .Select(r => new QPayPaid(Text(r.PaymentId), (int)Math.Round(Number(r.PaymentAmount)),
                DateTimeOffset.TryParse(Text(r.PaymentDate), CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal, out var at) ? at : null))];
    }

    /// True once the QR can no longer be paid: cancelled now, already cancelled, already paid (the
    /// check that follows finds the money) or unknown to QPay.
    public async Task<bool> CancelAsync(string qpayInvoiceId, CancellationToken ct)
    {
        using var res = await SendAsync(HttpMethod.Delete, $"invoice/{qpayInvoiceId}", null, ct);
        if (res.IsSuccessStatusCode) return true;
        var why = await ErrorAsync(res, ct);
        if (why is "INVOICE_ALREADY_CANCELED" or "INVOICE_PAID" or "INVOICE_NOTFOUND") return true;
        log.LogWarning("QPay would not cancel invoice {Invoice}: {Status} {Why}", qpayInvoiceId, (int)res.StatusCode, why);
        return false;
    }

    public async Task<bool> RefundAsync(string paymentId, CancellationToken ct)
    {
        using var res = await SendAsync(HttpMethod.Delete, $"payment/refund/{paymentId}", null, ct);
        if (!res.IsSuccessStatusCode)
            log.LogWarning("QPay would not refund {Payment}: {Status} {Why}", paymentId, (int)res.StatusCode, await ErrorAsync(res, ct));
        return res.IsSuccessStatusCode;
    }

    /// One call with the shared token; a 401 (QPay dropped the token early) fetches a fresh one and
    /// tries once more.
    private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, object? body, CancellationToken ct)
    {
        for (var attempt = 0; ; attempt++)
        {
            var token = await TokenAsync(ct);
            using var req = new HttpRequestMessage(method, path);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            if (body is not null) req.Content = JsonContent.Create(body);
            var res = await http.SendAsync(req, ct);
            if (res.StatusCode != System.Net.HttpStatusCode.Unauthorized || attempt > 0) return res;
            res.Dispose();
            await tokens.Gate.WaitAsync(ct);
            try { if (tokens.Access == token) tokens.Access = null; }
            finally { tokens.Gate.Release(); }
        }
    }

    private async Task<string> TokenAsync(CancellationToken ct)
    {
        await tokens.Gate.WaitAsync(ct);
        try
        {
            var now = DateTimeOffset.UtcNow;
            // A minute's margin so a token never expires on the way.
            if (tokens.Access is not null && now < tokens.AccessUntil.AddMinutes(-1)) return tokens.Access;
            TokenResponse? t = null;
            if (tokens.Refresh is not null && now < tokens.RefreshUntil.AddMinutes(-1))
            {
                using var refresh = new HttpRequestMessage(HttpMethod.Post, "auth/refresh");
                refresh.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokens.Refresh);
                using var res = await http.SendAsync(refresh, ct);
                if (res.IsSuccessStatusCode) t = await res.Content.ReadFromJsonAsync<TokenResponse>(ct);
                else log.LogInformation("QPay would not refresh its token ({Status}); signing in again", (int)res.StatusCode);
            }
            if (t is null)
            {
                using var auth = new HttpRequestMessage(HttpMethod.Post, "auth/token");
                auth.Headers.Authorization = new AuthenticationHeaderValue("Basic",
                    Convert.ToBase64String(Encoding.UTF8.GetBytes($"{settings.ClientId}:{settings.ClientSecret}")));
                using var res = await http.SendAsync(auth, ct);
                await EnsureAsync(res, "sign in", ct);
                t = await res.Content.ReadFromJsonAsync<TokenResponse>(ct);
            }
            tokens.Access = t!.AccessToken;
            tokens.AccessUntil = Until(t.ExpiresIn, now);
            if (t.RefreshToken is { Length: > 0 })
            {
                tokens.Refresh = t.RefreshToken;
                tokens.RefreshUntil = Until(t.RefreshExpiresIn, now);
            }
            return tokens.Access;
        }
        finally { tokens.Gate.Release(); }
    }

    /// QPay sends expiry as a unix timestamp; a small number would be seconds from now.
    private static DateTimeOffset Until(long value, DateTimeOffset now) =>
        value > 1_000_000_000 ? DateTimeOffset.FromUnixTimeSeconds(value) : now.AddSeconds(Math.Max(value, 60));

    private async Task EnsureAsync(HttpResponseMessage res, string what, CancellationToken ct)
    {
        if (res.IsSuccessStatusCode) return;
        var why = await ErrorAsync(res, ct);
        log.LogWarning("QPay would not {What}: {Status} {Why}", what, (int)res.StatusCode, why);
        throw new HttpRequestException($"QPay {(int)res.StatusCode} {why}", null, res.StatusCode);
    }

    /// QPay's error body is `{ status_code, error, message }`; the message is its code (INVOICE_PAID…).
    private static async Task<string> ErrorAsync(HttpResponseMessage res, CancellationToken ct)
    {
        var text = await res.Content.ReadAsStringAsync(ct);
        try
        {
            using var doc = JsonDocument.Parse(text);
            if (doc.RootElement.TryGetProperty("message", out var m)) return m.ToString();
        }
        catch (JsonException) { }
        return text.Length > 200 ? text[..200] : text;
    }

    // QPay writes some numbers as strings ("100.00") and some ids as numbers; read either.
    private static string Text(JsonElement e) =>
        e.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null ? "" : e.ToString();

    private static decimal Number(JsonElement e) =>
        e.ValueKind == JsonValueKind.Number ? e.GetDecimal()
        : decimal.TryParse(Text(e), NumberStyles.Number, CultureInfo.InvariantCulture, out var d) ? d : 0;

    private sealed record TokenResponse(
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("expires_in")] long ExpiresIn,
        [property: JsonPropertyName("refresh_token")] string? RefreshToken,
        [property: JsonPropertyName("refresh_expires_in")] long RefreshExpiresIn);

    private sealed record InvoiceResponse(
        [property: JsonPropertyName("invoice_id")] string InvoiceId,
        [property: JsonPropertyName("qr_text")] string QrText,
        [property: JsonPropertyName("qr_image")] string? QrImage,
        [property: JsonPropertyName("urls")] List<UrlRow>? Urls);

    private sealed record UrlRow(
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("description")] string? Description,
        [property: JsonPropertyName("logo")] string? Logo,
        [property: JsonPropertyName("link")] string? Link);

    private sealed record CheckResponse([property: JsonPropertyName("rows")] List<CheckRow>? Rows);

    private sealed record CheckRow(
        [property: JsonPropertyName("payment_id")] JsonElement PaymentId,
        [property: JsonPropertyName("payment_status")] string? PaymentStatus,
        [property: JsonPropertyName("payment_amount")] JsonElement PaymentAmount,
        [property: JsonPropertyName("payment_date")] JsonElement PaymentDate);
}

/// Development and tests: invoices live in memory, and `Pay` plays the bank app.
public sealed class FakeQPay : IQPay
{
    private sealed class Entry
    {
        public int Amount;
        public bool Cancelled;
        public readonly List<QPayPaid> Paid = [];
    }

    private readonly ConcurrentDictionary<string, Entry> _invoices = new();
    public ConcurrentBag<string> Refunded { get; } = [];
    /// Tests: QPay refuses API refunds (a bank-app payment).
    public bool RefundsRefused { get; set; }

    public Task<QPayInvoice> CreateInvoiceAsync(Guid invoiceId, int amount, string description, CancellationToken ct)
    {
        var id = "fake-" + invoiceId.ToString("N");
        _invoices[id] = new Entry { Amount = amount };
        return Task.FromResult(new QPayInvoice(id, "fake-qr:" + id, null, [new BankLink("Khan Bank", null, "khanbank://q?qPay_QRcode=" + id)]));
    }

    /// The bank app pays (again, if called twice — a double payment). False when the code was cancelled.
    public bool Pay(string qpayInvoiceId, int? amount = null)
    {
        if (!_invoices.TryGetValue(qpayInvoiceId, out var e) || e.Cancelled) return false;
        lock (e.Paid) e.Paid.Add(new QPayPaid("pay-" + Guid.NewGuid().ToString("N")[..12], amount ?? e.Amount, DateTimeOffset.UtcNow));
        return true;
    }

    public Task<IReadOnlyList<QPayPaid>> PaidAsync(string qpayInvoiceId, CancellationToken ct)
    {
        if (!_invoices.TryGetValue(qpayInvoiceId, out var e)) return Task.FromResult<IReadOnlyList<QPayPaid>>([]);
        lock (e.Paid) return Task.FromResult<IReadOnlyList<QPayPaid>>([.. e.Paid]);
    }

    public Task<bool> CancelAsync(string qpayInvoiceId, CancellationToken ct)
    {
        if (_invoices.TryGetValue(qpayInvoiceId, out var e))
            lock (e.Paid) if (e.Paid.Count == 0) e.Cancelled = true;
        return Task.FromResult(true);
    }

    public Task<bool> RefundAsync(string paymentId, CancellationToken ct)
    {
        if (RefundsRefused) return Task.FromResult(false);
        Refunded.Add(paymentId);
        return Task.FromResult(true);
    }
}

/// Production before the QPay merchant account exists: no invoice can be made, so no money can be
/// taken; the page says payment is not open. Checks and refunds have nothing to act on.
public sealed class QPayUnavailable : IQPay
{
    public Task<QPayInvoice> CreateInvoiceAsync(Guid invoiceId, int amount, string description, CancellationToken ct) =>
        throw new HttpRequestException("QPay is not configured");

    public Task<IReadOnlyList<QPayPaid>> PaidAsync(string qpayInvoiceId, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<QPayPaid>>([]);

    public Task<bool> CancelAsync(string qpayInvoiceId, CancellationToken ct) => Task.FromResult(true);

    public Task<bool> RefundAsync(string paymentId, CancellationToken ct) => Task.FromResult(false);
}
