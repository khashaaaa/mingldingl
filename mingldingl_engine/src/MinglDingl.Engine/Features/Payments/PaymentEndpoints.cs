using System.Security.Claims;
using System.Text.Json;
using MinglDingl.Engine.Features.Admin;
using MinglDingl.Engine.Features.Membership;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Auth;

namespace MinglDingl.Engine.Features.Payments;

public sealed class PaymentEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        // The app: its floor, the offers, and "I just bought in the store — look".
        var me = app.MapGroup("/me/membership").WithTags("Membership");
        me.MapGet("", async (ClaimsPrincipal u, MembershipService m, CancellationToken ct) =>
            new GuildMe("", await m.ViewAsync(u.AccountId(), ct), m.Offers())).RequireAuthorization().WithName("GetMembership");
        me.MapPost("/sync", (ClaimsPrincipal u, PaymentService p, CancellationToken ct) => p.SyncStoreAsync(u.AccountId(), ct))
            .AsWrite().WithName("SyncStoreMembership");

        // The web page. Its token is the Guild scheme's and reaches nothing else.
        // Signing in is limited per IP like the app's; the page's reads and its invoice per person.
        var guild = app.MapGroup("/guild").WithTags("Guild");
        guild.MapPost("/session", (GuildSessionRequest req, PaymentService p, CancellationToken ct) =>
            p.GuildSignInAsync(req.VerificationId, ct)).AllowAnonymous().RequireRateLimiting(Kernel.RateLimits.RateLimitPolicies.Auth)
            .WithName("GuildSignIn");
        guild.MapGet("/me", (ClaimsPrincipal u, PaymentService p, CancellationToken ct) => p.GuildMeAsync(u.AccountId(), ct))
            .RequireAuthorization(GuildAuth.Policy).WithName("GuildMe");
        guild.MapPost("/invoices", (InvoiceRequest req, ClaimsPrincipal u, PaymentService p, CancellationToken ct) =>
            p.CreateInvoiceAsync(u.AccountId(), req, ct)).RequireAuthorization(GuildAuth.Policy)
            .RequireRateLimiting(Kernel.RateLimits.RateLimitPolicies.Writes).WithName("GuildCreateInvoice");
        guild.MapGet("/invoices/{id:guid}", (Guid id, ClaimsPrincipal u, PaymentService p, CancellationToken ct) =>
            p.GuildInvoiceAsync(u.AccountId(), id, ct)).RequireAuthorization(GuildAuth.Policy).WithName("GuildInvoice");
        // The stores' "delete your account on the web": the same Abandon as the War Room's.
        guild.MapPost("/abandon", async (ClaimsPrincipal u, Auth.AccountService accounts, CancellationToken ct) =>
            new GuildAbandoned(await accounts.AbandonAsync(u.AccountId(), ct))).RequireAuthorization(GuildAuth.Policy)
            .RequireRateLimiting(Kernel.RateLimits.RateLimitPolicies.Writes).WithName("GuildAbandon");

        // Providers. QPay's callback only prompts a check; RevenueCat's webhook only prompts a sync.
        var hooks = app.MapGroup("/payments").WithTags("Payments").ExcludeFromDescription();
        hooks.MapMethods("/qpay/callback", ["GET", "POST"], async (Guid invoice, PaymentService p, CancellationToken ct) =>
        {
            await p.CheckAsync(invoice, "QPay callback", ct);
            return Results.Text("SUCCESS");
        });
        hooks.MapPost("/revenuecat", async (HttpRequest req, RevenueCatSettings settings, PaymentService p, CancellationToken ct) =>
        {
            var auth = req.Headers.Authorization.ToString();
            if (settings.WebhookAuth.Length == 0 || !System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
                    System.Text.Encoding.UTF8.GetBytes(auth), System.Text.Encoding.UTF8.GetBytes(settings.WebhookAuth)))
                return Results.Unauthorized();
            var body = await JsonSerializer.DeserializeAsync<JsonElement>(req.Body, cancellationToken: ct);
            await p.WebhookAsync(body, ct);
            return Results.Ok();
        });

        // The keepers.
        var admin = app.MapGroup("/admin").WithTags("Admin").RequireAuthorization(AdminEndpoints.Policy);
        admin.MapGet("/payments", (PaymentService p, CancellationToken ct) => p.AdminListAsync(ct)).WithName("AdminPayments");
        admin.MapGet("/invoices/{id:guid}", (Guid id, PaymentService p, CancellationToken ct) => p.AdminInvoiceAsync(id, ct))
            .WithName("AdminInvoice");
        admin.MapGet("/users/{id:guid}/payments", (Guid id, PaymentService p, CancellationToken ct) => p.AdminUserAsync(id, ct))
            .WithName("AdminUserPayments");
        admin.MapPost("/payments/{id:guid}/refund", (Guid id, PaymentService p, CancellationToken ct) => p.RefundAsync(id, ct))
            .WithName("AdminRefundPayment");
        admin.MapPost("/payments/{id:guid}/refunded-by-hand", (Guid id, PaymentService p, CancellationToken ct) =>
            p.RefundedByHandAsync(id, ct)).WithName("AdminRefundedByHand");
        admin.MapPost("/payments/{id:guid}/handled", (Guid id, PaymentService p, CancellationToken ct) => p.HandledAsync(id, ct))
            .WithName("AdminPaymentHandled");
    }
}

/// Every minute: open invoices are checked with QPay, cold ones cancelled, late money found;
/// and once an hour the "your floor ends soon" notices go out.
public sealed class PaymentSweep(IServiceScopeFactory scopes, ILogger<PaymentSweep> log, Stats.OpsClock ops) : BackgroundService
{
    public static readonly TimeSpan Every = TimeSpan.FromMinutes(1);
    private int _ticks;

    public async Task RunAsync(CancellationToken ct = default)
    {
        await using var scope = scopes.CreateAsyncScope();
        var (checkedCount, cold) = await scope.ServiceProvider.GetRequiredService<PaymentService>().SweepAsync(ct);
        var notices = 0;
        if (_ticks++ % 60 == 0)
        {
            await using var s2 = scopes.CreateAsyncScope();
            notices = await s2.ServiceProvider.GetRequiredService<MembershipService>().SendEndingNoticesAsync(ct);
        }
        ops.PaymentSweepAt = DateTimeOffset.UtcNow;
        if (checkedCount + notices > 0)
            log.LogInformation("Payments: {Checked} invoices checked, {Cold} went cold, {Notices} ending notices", checkedCount, cold, notices);
    }

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        using var timer = new PeriodicTimer(Every);
        while (await timer.WaitForNextTickAsync(stop))
        {
            try { await RunAsync(stop); }
            catch (Exception e) when (!stop.IsCancellationRequested) { log.LogError(e, "Payment sweep failed"); }
        }
    }
}
