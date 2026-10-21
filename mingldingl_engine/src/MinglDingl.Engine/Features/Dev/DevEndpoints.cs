using System.Security.Claims;
using MinglDingl.Engine.Features.Admin;
using MinglDingl.Engine.Kernel;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Auth;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Maintenance;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Dev;

public sealed record DevStateRequest(SeedState State);
public sealed record DevLiveRequest(string Kind);
public sealed record DevStoreRequest(string Floor, int Months);

/// Mapped only in Development (and the test host) — 404 everywhere else.
public sealed class DevEndpoints : IEndpointModule
{
    public void Map(IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/dev").WithTags("Dev");

        g.MapPost("/me/state", async (DevStateRequest req, ClaimsPrincipal u, DevSeeder seeder, CancellationToken ct) =>
        {
            await seeder.ApplyAsync(u.AccountId(), req.State, ct);
            return Results.Ok();
        }).RequireAuthorization().WithName("DevSetMyState");

        g.MapPost("/me/live", async (DevLiveRequest req, ClaimsPrincipal u, ILiveOutbox live, AppDb db) =>
        {
            var me = u.AccountId();
            if (req.Kind == LiveKinds.SessionRevoked) live.ToSession(u.SessionId(), req.Kind, u.SessionId());
            else if (req.Kind == LiveKinds.ConfigUpdated) live.ToAll(req.Kind);
            else live.ToAccount(me, req.Kind, me);
            await ((LiveOutbox)live).FlushAsync();
            return Results.Ok();
        }).RequireAuthorization().WithName("DevSendLive");

        // The store without Google Play: a pretend purchase that RevenueCat (the fake) then reports.
        g.MapPost("/me/store", async (DevStoreRequest req, ClaimsPrincipal u, IServiceProvider sp, Payments.PaymentService pay,
            IClock clock, CancellationToken ct) =>
        {
            if (sp.GetService<Payments.FakeRevenueCat>() is not { } fake) return Results.NotFound();
            var me = u.AccountId();
            var now = clock.UtcNow;
            fake.Accounts[me] = Membership.Floors.Parse(req.Floor) is { } floor
                ? [new Membership.StoreEntitlement(floor, $"{req.Floor}:m{req.Months}", now, now.AddMonths(req.Months), true, false)]
                : [];
            return Results.Ok(await pay.SyncStoreAsync(me, ct));
        }).RequireAuthorization().WithName("DevStorePurchase");

        // The bank app, for the web page on a local engine: pays a QPay invoice in full, and QPay calls back.
        g.MapPost("/qpay/pay/{invoice:guid}", async (Guid invoice, IServiceProvider sp, AppDb db, Payments.PaymentService payments,
            CancellationToken ct) =>
        {
            if (sp.GetService<Payments.FakeQPay>() is not { } fake) return Results.NotFound();
            var qid = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.SingleOrDefaultAsync(
                db.Set<Payments.Invoice>().Where(i => i.Id == invoice).Select(i => i.QPayInvoiceId), ct);
            if (qid is null || !fake.Pay(qid)) return Results.NotFound();
            await payments.CallbackAsync(invoice, ct);
            return Results.Ok();
        }).WithName("DevQPayPay");

        // The admin's write path (bounds, live config.updated) without the admin's password, so a
        // device pass can reach Update required and maintenance on a local engine.
        g.MapPut("/config/{key}", (string key, ConfigWriteRequest req, ConfigWrites writes) =>
            writes.SetAsync(key, req.Value)).WithName("DevSetConfig");

        g.MapPost("/run-sweep", async (DailySweep sweep, Bonds.BondSweep bonds, CancellationToken ct) =>
        {
            await sweep.RunAsync(ct);
            await bonds.RunAsync(ct);
            return Results.Ok();
        }).WithName("DevRunSweep");
    }
}
