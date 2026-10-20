using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using MinglDingl.Engine.Features.Membership;
using MinglDingl.Engine.Features.Payments;
using MinglDingl.Engine.Kernel.Maintenance;
using MinglDingl.Engine.Tests.Infrastructure;
using static MinglDingl.Engine.Tests.Infrastructure.WorldDriver;

namespace MinglDingl.Engine.Tests.Features.Payments;

public class PaymentTests(PostgresFixture db) : IClassFixture<PostgresFixture>
{
    [Fact]
    public async Task The_web_page_signs_in_a_character_pays_by_QPay_and_the_floor_opens_in_the_app()
    {
        await using var w = await World.CreateAsync(db);
        var phone = SessionDriver.NewPhone();
        var bat = await w.PersonAsync("Bat", "Male", phone: phone);
        var web = await w.GuildAsync(phone);

        var me = (await web.GetFromJsonAsync<GuildMe>("/guild/me"))!;
        me.Name.Should().Be("Bat");
        me.Membership.Floor.Should().Be("yard");
        me.Offers.Single(o => o.Floor == "hall" && o.Months == 3).Amount.Should().Be(29_430);

        var inv = await web.InvoiceAsync("hall", 3, "key-one-0001");
        inv.State.Should().Be("open");
        inv.Amount.Should().Be(29_430);
        (await web.InvoiceAsync("hall", 3, "key-one-0001")).Id.Should().Be(inv.Id, "the same key never makes a second invoice");

        w.QPay().Pay(await w.QPayIdAsync(inv.Id)).Should().BeTrue();
        var paid = (await web.GetFromJsonAsync<InvoiceView>($"/guild/invoices/{inv.Id}"))!;
        paid.State.Should().Be("paid");
        paid.PaidUntil.Should().BeCloseTo(w.F.Clock.UtcNow.AddMonths(3), TimeSpan.FromSeconds(5));

        var app = (await bat.C.GetFromJsonAsync<GuildMe>("/me/membership"))!.Membership;
        app.Floor.Should().Be("hall");
        app.Source.Should().Be("qpay");
        app.Renews.Should().BeFalse();
    }

    [Fact]
    public async Task The_web_page_abandons_a_character_as_the_War_Room_does_and_it_leaves_Seek()
    {
        await using var w = await World.CreateAsync(db);
        var phone = SessionDriver.NewPhone();
        var bat = await w.PersonAsync("Bat", "Male");
        var saruul = await w.PersonAsync("Saruul", "Female", phone: phone);
        var web = await w.GuildAsync(phone);

        var r = await web.PostAsync("/guild/abandon", null);
        r.EnsureSuccessStatusCode();
        var gone = (await r.Content.ReadFromJsonAsync<GuildAbandoned>())!;
        gone.DeleteAt.Should().BeCloseTo(w.F.Clock.UtcNow.AddDays(30), TimeSpan.FromSeconds(1));
        (await saruul.C.MeAsync()).DeleteAt.Should().Be(gone.DeleteAt);
        (await bat.C.SeekAsync()).Candidate.Should().BeNull();
        (await saruul.C.PostAsync("/guild/abandon", null)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task A_guild_token_and_an_app_token_are_never_accepted_for_each_other_and_the_web_never_makes_accounts()
    {
        await using var w = await World.CreateAsync(db);
        var phone = SessionDriver.NewPhone();
        var bat = await w.PersonAsync("Bat", "Male", phone: phone);
        var web = await w.GuildAsync(phone);

        (await web.GetAsync("/me/membership")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await web.GetAsync("/me")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await bat.C.GetAsync("/guild/me")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var stranger = SessionDriver.NewPhone();
        var r = await w.GuildRawAsync(stranger);
        (await CodeOf(r)).Should().Be("guild.no_character");
    }

    [Fact]
    public async Task A_lost_callback_costs_nothing_the_sweep_finds_the_money_and_a_repeated_callback_credits_once()
    {
        await using var w = await World.CreateAsync(db);
        var phone = SessionDriver.NewPhone();
        var bat = await w.PersonAsync("Bat", "Male", phone: phone);
        var web = await w.GuildAsync(phone);
        var inv = await web.InvoiceAsync("highTable", 1, "key-lost-0001");
        w.QPay().Pay(await w.QPayIdAsync(inv.Id));

        await w.PaymentSweepAsync();
        (await bat.C.GetFromJsonAsync<GuildMe>("/me/membership"))!.Membership.Floor.Should().Be("highTable");

        var anon = w.F.Client();
        (await anon.PostAsync($"/payments/qpay/callback?invoice={inv.Id}", null)).EnsureSuccessStatusCode();
        (await anon.GetAsync($"/payments/qpay/callback?invoice={inv.Id}")).EnsureSuccessStatusCode();
        var admin = await w.F.AdminAsync();
        var list = (await admin.GetFromJsonAsync<AdminPaymentsView>("/admin/payments"))!;
        list.Latest.Where(r => r.InvoiceId == inv.Id).Should().ContainSingle().Which.State.Should().Be("credited");
        (await bat.C.GetFromJsonAsync<GuildMe>("/me/membership"))!.Membership.Until
            .Should().BeCloseTo(w.F.Clock.UtcNow.AddMonths(1), TimeSpan.FromSeconds(5), "one moon, not two");
    }

    [Fact]
    public async Task A_second_payment_waits_for_the_keepers_who_refund_it_through_QPay_or_by_hand()
    {
        await using var w = await World.CreateAsync(db);
        var phone = SessionDriver.NewPhone();
        var bat = await w.PersonAsync("Bat", "Male", phone: phone);
        var web = await w.GuildAsync(phone);
        await bat.C.PutAsJsonAsync("/me/push-token", new MinglDingl.Engine.Features.Push.PushTokenRequest("ExponentPushToken[bat]"));
        var inv = await web.InvoiceAsync("hall", 1, "key-twice-001");
        var qid = await w.QPayIdAsync(inv.Id);
        w.QPay().Pay(qid);
        w.QPay().Pay(qid);
        await w.PaymentSweepAsync();

        var admin = await w.F.AdminAsync();
        var list = (await admin.GetFromJsonAsync<AdminPaymentsView>("/admin/payments"))!;
        var extra = list.Attention.Should().ContainSingle().Subject;
        extra.Note.Should().Be("Paid twice");
        (await bat.C.GetFromJsonAsync<GuildMe>("/me/membership"))!.Membership.Floor.Should().Be("hall", "the first payment is credited");

        w.QPay().RefundsRefused = true;
        (await CodeOf(await admin.PostAsync($"/admin/payments/{extra.Id}/refund", null))).Should().Be("payments.refund_by_hand");
        (await admin.PostAsync($"/admin/payments/{extra.Id}/refunded-by-hand", null)).EnsureSuccessStatusCode();
        (await admin.GetFromJsonAsync<AdminPaymentsView>("/admin/payments"))!.Attention.Should().BeEmpty();
        (await CodeOf(await admin.PostAsync($"/admin/payments/{extra.Id}/refund", null))).Should().Be("payments.settled");
        (await bat.C.GetFromJsonAsync<GuildMe>("/me/membership"))!.Membership.Floor.Should().Be("hall", "the credited one stays");
        (await w.Push.WaitForAsync(m => m.Data["kind"] == "refundSent")).Should().NotBeNull();

        var detail = (await admin.GetFromJsonAsync<AdminInvoiceView>($"/admin/invoices/{inv.Id}"))!;
        detail.Events.Select(e => e.What).Should().Contain("Returned by bank transfer");
    }

    [Fact]
    public async Task Money_paid_after_the_account_burned_is_refunded_never_kept()
    {
        await using var w = await World.CreateAsync(db);
        var phone = SessionDriver.NewPhone();
        var bat = await w.PersonAsync("Bat", "Male", phone: phone);
        var web = await w.GuildAsync(phone);
        var inv = await web.InvoiceAsync("hall", 6, "key-gone-0001");
        var qid = await w.QPayIdAsync(inv.Id);

        (await bat.C.PostAsync("/me/abandon", null)).EnsureSuccessStatusCode();
        await w.AdvanceAsync(TimeSpan.FromDays(31));
        await w.F.Services.GetRequiredService<DailySweep>().RunAsync();
        w.QPay().Pay(qid);
        await w.PaymentSweepAsync();

        var admin = await w.F.AdminAsync();
        var gone = (await admin.GetFromJsonAsync<AdminPaymentsView>("/admin/payments"))!.Attention.Should().ContainSingle().Subject;
        gone.Note.Should().Be("Account gone");
        gone.Name.Should().Be("Bat");
        (await admin.PostAsync($"/admin/payments/{gone.Id}/refund", null)).EnsureSuccessStatusCode();
        w.QPay().Refunded.Should().ContainSingle();
        (await admin.GetFromJsonAsync<AdminInvoiceView>($"/admin/invoices/{inv.Id}"))!.State.Should().Be("refunded");
    }

    [Fact]
    public async Task An_unpaid_code_goes_cold_and_can_no_longer_be_paid()
    {
        await using var w = await World.CreateAsync(db);
        var phone = SessionDriver.NewPhone();
        await w.PersonAsync("Bat", "Male", phone: phone);
        var web = await w.GuildAsync(phone);
        var inv = await web.InvoiceAsync("hall", 1, "key-cold-0001");
        w.F.Clock.Advance(TimeSpan.FromMinutes(16));
        await w.PaymentSweepAsync();
        w.QPay().Pay(await w.QPayIdAsync(inv.Id)).Should().BeFalse("QPay's invoice was cancelled");
        var web2 = await w.GuildAsync(phone);
        (await web2.GetFromJsonAsync<InvoiceView>($"/guild/invoices/{inv.Id}"))!.State.Should().Be("cold");
    }

    [Fact]
    public async Task Store_and_web_time_stack_the_higher_floor_wins_and_a_store_refund_leaves_web_time()
    {
        await using var w = await World.CreateAsync(db);
        var phone = SessionDriver.NewPhone();
        var bat = await w.PersonAsync("Bat", "Male", phone: phone);
        var now = w.F.Clock.UtcNow;
        var storeEnds = now.AddDays(20);
        w.Store().Accounts[bat.Id] = [new StoreEntitlement(Floor.Hall, "hall_1m", now.AddDays(-10), storeEnds, true, false)];
        var synced = await (await bat.C.PostAsync("/me/membership/sync", null)).Read<MembershipView>();
        synced.Should().Match<MembershipView>(m => m.Floor == "hall" && m.Source == "store" && m.Renews);

        var web = await w.GuildAsync(phone);
        var hall = await web.InvoiceAsync("hall", 1, "key-stack-001");
        w.QPay().Pay(await w.QPayIdAsync(hall.Id));
        await w.PaymentSweepAsync();
        (await bat.C.GetFromJsonAsync<GuildMe>("/me/membership"))!.Membership.Until
            .Should().BeCloseTo(storeEnds.AddMonths(1), TimeSpan.FromSeconds(5), "web Hall time waits behind the store's");

        var high = await web.InvoiceAsync("highTable", 1, "key-stack-002");
        w.QPay().Pay(await w.QPayIdAsync(high.Id));
        await w.PaymentSweepAsync();
        (await bat.C.GetFromJsonAsync<GuildMe>("/me/membership"))!.Membership.Floor.Should().Be("highTable", "a higher floor starts now");

        // The store refunds its Hall: RevenueCat reports it ended at the refund, and the webhook says so.
        w.Store().Accounts[bat.Id] = [new StoreEntitlement(Floor.Hall, "hall_1m", now.AddDays(-10), w.F.Clock.UtcNow, false, true)];
        var anon = w.F.Client();
        var hook = new { @event = new { type = "CANCELLATION", app_user_id = bat.Id.ToString() } };
        (await anon.PostAsJsonAsync("/payments/revenuecat", hook)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        anon.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", "Bearer test-revenuecat-hook");
        (await anon.PostAsJsonAsync("/payments/revenuecat", hook)).EnsureSuccessStatusCode();
        var after = (await bat.C.GetFromJsonAsync<GuildMe>("/me/membership"))!.Membership;
        after.Floor.Should().Be("highTable");
        after.Source.Should().Be("qpay");
    }

    [Fact]
    public async Task A_floor_that_will_not_renew_is_announced_once_three_days_before_it_ends()
    {
        await using var w = await World.CreateAsync(db);
        var phone = SessionDriver.NewPhone();
        var bat = await w.PersonAsync("Bat", "Male", phone: phone);
        await bat.C.PutAsJsonAsync("/me/push-token", new MinglDingl.Engine.Features.Push.PushTokenRequest("ExponentPushToken[bat]"));
        var web = await w.GuildAsync(phone);
        var inv = await web.InvoiceAsync("hall", 1, "key-ends-0001");
        w.QPay().Pay(await w.QPayIdAsync(inv.Id));
        await w.PaymentSweepAsync();

        await w.AdvanceAsync(TimeSpan.FromDays(26));
        await using (var s = w.F.Services.CreateAsyncScope())
            (await s.ServiceProvider.GetRequiredService<MembershipService>().SendEndingNoticesAsync()).Should().Be(0, "four days left");
        await w.AdvanceAsync(TimeSpan.FromDays(2));
        await using (var s = w.F.Services.CreateAsyncScope())
            (await s.ServiceProvider.GetRequiredService<MembershipService>().SendEndingNoticesAsync()).Should().Be(1);
        await using (var s = w.F.Services.CreateAsyncScope())
            (await s.ServiceProvider.GetRequiredService<MembershipService>().SendEndingNoticesAsync()).Should().Be(0, "once");
        (await w.Push.WaitForAsync(m => m.Data["kind"] == "floorEnding")).Should().NotBeNull();
    }
}

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
        var db = s.ServiceProvider.GetRequiredService<MinglDingl.Engine.Kernel.Persistence.AppDb>();
        return db.Set<Invoice>().Where(i => i.Id == invoiceId).Select(i => i.QPayInvoiceId).Single();
    }

    public static Task PaymentSweepAsync(this World w) => w.F.Services.GetRequiredService<PaymentSweep>().RunAsync();
}
