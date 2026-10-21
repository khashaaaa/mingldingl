using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using MinglDingl.Engine.Features.Membership;
using MinglDingl.Engine.Features.Payments;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Tests.Infrastructure;

public static class PaymentDriver
{
    public static FakeQPay QPay(this World w) => w.F.Services.GetRequiredService<FakeQPay>();
    public static FakeRevenueCat Store(this World w) => w.F.Services.GetRequiredService<FakeRevenueCat>();

    public static async Task<HttpResponseMessage> GuildRawAsync(this World w, string phone)
    {
        var c = w.F.Client();
        var s = await c.StartAsync(phone);
        await c.CheckAsync(w.Vm, s.VerificationId);
        return await c.PostAsJsonAsync("/guild/session", new GuildSessionRequest(s.VerificationId));
    }

    public static async Task<HttpClient> GuildAsync(this World w, string phone)
    {
        var r = await w.GuildRawAsync(phone);
        r.EnsureSuccessStatusCode();
        var s = (await r.Content.ReadFromJsonAsync<GuildSession>())!;
        var c = w.F.Client();
        c.DefaultRequestHeaders.Authorization = new("Bearer", s.Token);
        return c;
    }

    public static async Task<InvoiceView> InvoiceAsync(this HttpClient web, string floor, int months, string key) =>
        await (await web.PostAsJsonAsync("/guild/invoices", new InvoiceRequest(floor, months, key))).Read<InvoiceView>();

    public static async Task<string> QPayIdAsync(this World w, Guid invoiceId)
    {
        await using var s = w.F.Services.CreateAsyncScope();
        var db = s.ServiceProvider.GetRequiredService<AppDb>();
        return db.Set<Invoice>().Where(i => i.Id == invoiceId).Select(i => i.QPayInvoiceId).Single();
    }

    /// QPay's callback after a payment (anonymous, as QPay calls it).
    public static async Task CallbackAsync(this World w, Guid invoiceId) =>
        (await w.F.Client().PostAsync($"/payments/qpay/callback?invoice={invoiceId}", null)).EnsureSuccessStatusCode();

    public static Task PaymentSweepAsync(this World w) => w.F.Services.GetRequiredService<PaymentSweep>().RunAsync();
}

public static class FloorDriver
{
    /// Puts a person on a floor through the store (the fake RevenueCat), or back in the Yard with null.
    public static async Task FloorAsync(this World w, World.Person p, Floor? floor, int days = 30)
    {
        var now = w.F.Clock.UtcNow;
        w.Store().Accounts[p.Id] = floor is { } f
            ? [new StoreEntitlement(f, $"{Floors.Key(f)}:m1", now.AddMinutes(-1), now.AddDays(days), true, false)]
            : [];
        (await p.C.PostAsync("/me/membership/sync", null)).EnsureSuccessStatusCode();
    }
}
