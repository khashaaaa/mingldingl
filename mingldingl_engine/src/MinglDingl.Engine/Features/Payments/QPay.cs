using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Serialization;

namespace MinglDingl.Engine.Features.Payments;

public sealed record QPayInvoice(string InvoiceId, string QrText, string? QrImage, IReadOnlyList<BankLink> Links);

public sealed record QPayPaid(string PaymentId, int Amount, DateTimeOffset? At);

/// QPay v2 (merchant.qpay.mn). The callback is only ever a hint: money is believed when
/// `payment/check` reports it.
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

public sealed class QPayClient(HttpClient http, QPaySettings settings, ILogger<QPayClient> log) : IQPay
{
    private string? _token;
    private DateTimeOffset _tokenUntil;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public async Task<QPayInvoice> CreateInvoiceAsync(Guid invoiceId, int amount, string description, CancellationToken ct)
    {
        using var req = await Authed(HttpMethod.Post, "invoice", ct);
        req.Content = JsonContent.Create(new
        {
            invoice_code = settings.InvoiceCode,
            sender_invoice_no = invoiceId.ToString("N"),
            invoice_receiver_code = "terminal",
            invoice_description = description,
            amount,
            callback_url = $"{settings.CallbackBase.TrimEnd('/')}/payments/qpay/callback?invoice={invoiceId}",
        });
        using var res = await http.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
        var body = (await res.Content.ReadFromJsonAsync<InvoiceResponse>(ct))!;
        return new QPayInvoice(body.InvoiceId, body.QrText, body.QrImage,
            [.. (body.Urls ?? []).Select(u => new BankLink(u.Name ?? u.Description ?? "", u.Logo, u.Link ?? ""))]);
    }

    public async Task<IReadOnlyList<QPayPaid>> PaidAsync(string qpayInvoiceId, CancellationToken ct)
    {
        using var req = await Authed(HttpMethod.Post, "payment/check", ct);
        req.Content = JsonContent.Create(new
        {
            object_type = "INVOICE", object_id = qpayInvoiceId, offset = new { page_number = 1, page_limit = 100 },
        });
        using var res = await http.SendAsync(req, ct);
        res.EnsureSuccessStatusCode();
        var body = (await res.Content.ReadFromJsonAsync<CheckResponse>(ct))!;
        return [.. (body.Rows ?? []).Where(r => r.PaymentStatus == "PAID")
            .Select(r => new QPayPaid(r.PaymentId, (int)Math.Round(decimal.Parse(r.PaymentAmount ?? "0", System.Globalization.CultureInfo.InvariantCulture)),
                DateTimeOffset.TryParse(r.PaymentDate, out var at) ? at : null))];
    }

    public async Task<bool> CancelAsync(string qpayInvoiceId, CancellationToken ct)
    {
        using var req = await Authed(HttpMethod.Delete, $"invoice/{qpayInvoiceId}", ct);
        using var res = await http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode) log.LogWarning("QPay would not cancel invoice {Invoice}: {Status}", qpayInvoiceId, res.StatusCode);
        return res.IsSuccessStatusCode;
    }

    public async Task<bool> RefundAsync(string paymentId, CancellationToken ct)
    {
        using var req = await Authed(HttpMethod.Delete, $"payment/refund/{paymentId}", ct);
        using var res = await http.SendAsync(req, ct);
        if (!res.IsSuccessStatusCode) log.LogWarning("QPay would not refund {Payment}: {Status}", paymentId, res.StatusCode);
        return res.IsSuccessStatusCode;
    }

    private async Task<HttpRequestMessage> Authed(HttpMethod method, string path, CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            if (_token is null || DateTimeOffset.UtcNow >= _tokenUntil)
            {
                using var auth = new HttpRequestMessage(HttpMethod.Post, "auth/token");
                auth.Headers.Authorization = new AuthenticationHeaderValue("Basic",
                    Convert.ToBase64String(Encoding.UTF8.GetBytes($"{settings.ClientId}:{settings.ClientSecret}")));
                using var res = await http.SendAsync(auth, ct);
                res.EnsureSuccessStatusCode();
                var t = (await res.Content.ReadFromJsonAsync<TokenResponse>(ct))!;
                _token = t.AccessToken;
                // Renew well before QPay's own expiry.
                _tokenUntil = DateTimeOffset.UtcNow.AddSeconds(Math.Max(60, Math.Min(t.ExpiresIn, 3600) - 120));
            }
        }
        finally { _gate.Release(); }
        var req = new HttpRequestMessage(method, path);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _token);
        return req;
    }

    private sealed record TokenResponse([property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("expires_in")] long ExpiresIn);

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
        [property: JsonPropertyName("payment_id")] string PaymentId,
        [property: JsonPropertyName("payment_status")] string? PaymentStatus,
        [property: JsonPropertyName("payment_amount")] string? PaymentAmount,
        [property: JsonPropertyName("payment_date")] string? PaymentDate);
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
