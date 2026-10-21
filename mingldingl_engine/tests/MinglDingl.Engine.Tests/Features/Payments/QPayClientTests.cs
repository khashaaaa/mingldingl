using System.Net;
using System.Text;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using MinglDingl.Engine.Features.Payments;

namespace MinglDingl.Engine.Tests.Features.Payments;

/// The real client against a stand-in QPay that answers as developer.qpay.mn documents.
public class QPayClientTests
{
    private sealed class FakeServer : HttpMessageHandler
    {
        public List<string> Calls { get; } = [];
        public long ExpiresAt { get; set; } = DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds();
        public bool RejectNextCall { get; set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var path = request.RequestUri!.AbsolutePath;
            var auth = request.Headers.Authorization!;
            Calls.Add($"{request.Method} {path} {auth.Scheme}");
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            if (RejectNextCall && !path.Contains("/auth/"))
            {
                RejectNextCall = false;
                return Task.FromResult(Json("""{"status_code":401,"error":"UnauthorizedError","message":"UNAUTHORIZED_ERROR"}""", HttpStatusCode.Unauthorized));
            }
            return Task.FromResult(path switch
            {
                "/v2/auth/token" or "/v2/auth/refresh" => Json(
                    $$"""{"token_type":"bearer","access_token":"a{{Calls.Count}}","expires_in":{{ExpiresAt}},"refresh_token":"r","refresh_expires_in":{{now + 86400}},"scope":"get_token","not-before-policy":"0","session_state":"prod"}"""),
                "/v2/invoice" => Json("""{"invoice_id":"q-1","qr_text":"0002010102","qr_image":"iVBOR","qPay_shortUrl":"https://s.qpay.mn/x","urls":[{"name":"Khan bank","description":"Хаан банк","logo":"https://qpay.mn/q/logo/khanbank.png","link":"khanbank://q?qPay_QRcode=x"}]}"""),
                "/v2/payment/check" => Json("""{"count":2,"paid_amount":200,"rows":[{"payment_id":493622150113497,"payment_status":"PAID","payment_amount":"100.00","payment_currency":"MNT","payment_date":"2022-03-11T05:57:47.336Z"},{"payment_id":"2","payment_status":"FAILED","payment_amount":"100.00"}]}"""),
                "/v2/invoice/paid-one" => Json("""{"status_code":400,"error":"ValidationError","message":"INVOICE_PAID"}""", HttpStatusCode.BadRequest),
                _ => Json("""{"status_code":500,"error":"Error","message":"SOMETHING"}""", HttpStatusCode.InternalServerError),
            });
        }

        private static HttpResponseMessage Json(string body, HttpStatusCode status = HttpStatusCode.OK) =>
            new(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
    }

    private static (QPayClient Client, FakeServer Server) Make(QPayTokens? tokens = null)
    {
        var server = new FakeServer();
        var http = new HttpClient(server) { BaseAddress = new Uri("https://merchant.qpay.test/v2/") };
        var settings = new QPaySettings { ClientId = "ID", ClientSecret = "SECRET", InvoiceCode = "ID_INVOICE", CallbackBase = "https://api.test" };
        return (new QPayClient(http, settings, tokens ?? new QPayTokens(), NullLogger<QPayClient>.Instance), server);
    }

    [Fact]
    public async Task One_token_serves_every_call_and_every_client_until_its_timestamp()
    {
        var tokens = new QPayTokens();
        var (first, server) = Make(tokens);
        await first.CreateInvoiceAsync(Guid.NewGuid(), 100, "MingldIngl Hall 1 month", default);
        await first.PaidAsync("q-1", default);
        // A typed client is made per request; the token is shared.
        var second = new QPayClient(new HttpClient(server) { BaseAddress = new Uri("https://merchant.qpay.test/v2/") },
            new QPaySettings { ClientId = "ID", ClientSecret = "SECRET", InvoiceCode = "ID_INVOICE", CallbackBase = "https://api.test" },
            tokens, NullLogger<QPayClient>.Instance);
        await second.PaidAsync("q-1", default);
        server.Calls.Count(c => c.Contains("/auth/")).Should().Be(1);
        server.Calls[0].Should().Be("POST /v2/auth/token Basic");
    }

    [Fact]
    public async Task An_expired_token_is_renewed_by_refresh_not_a_new_sign_in()
    {
        var (client, server) = Make();
        server.ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(30).ToUnixTimeSeconds(); // inside the minute's margin
        await client.PaidAsync("q-1", default);
        await client.PaidAsync("q-1", default);
        server.Calls.Where(c => c.Contains("/auth/")).Should().Equal("POST /v2/auth/token Basic", "POST /v2/auth/refresh Bearer");
    }

    [Fact]
    public async Task A_token_QPay_dropped_early_is_fetched_again_and_the_call_retried_once()
    {
        var (client, server) = Make();
        await client.PaidAsync("q-1", default);
        server.RejectNextCall = true;
        (await client.PaidAsync("q-1", default)).Should().ContainSingle();
        server.Calls.Count(c => c.EndsWith("/payment/check Bearer")).Should().Be(3);
    }

    [Fact]
    public async Task Invoice_and_check_read_QPays_documented_answers()
    {
        var (client, _) = Make();
        var inv = await client.CreateInvoiceAsync(Guid.NewGuid(), 100, "MingldIngl Hall 1 month", default);
        inv.InvoiceId.Should().Be("q-1");
        inv.Links.Should().ContainSingle().Which.Name.Should().Be("Khan bank");

        var paid = (await client.PaidAsync("q-1", default)).Should().ContainSingle().Subject;
        paid.PaymentId.Should().Be("493622150113497");
        paid.Amount.Should().Be(100);
        paid.At.Should().Be(new DateTimeOffset(2022, 3, 11, 5, 57, 47, 336, TimeSpan.Zero));
    }

    [Fact]
    public async Task A_paid_invoice_counts_as_cancelled_and_a_QPay_failure_does_not()
    {
        var (client, _) = Make();
        (await client.CancelAsync("paid-one", default)).Should().BeTrue("INVOICE_PAID: its QR can no longer be paid, the check finds the money");
        (await client.CancelAsync("broken", default)).Should().BeFalse();
    }
}
