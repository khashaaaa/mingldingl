using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Membership;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Kernel.Push;

namespace MinglDingl.Engine.Features.Payments;

/// Money in. The rule this whole file keeps: every payment that reaches QPay ends credited or
/// refunded, and nothing is believed until QPay's own `payment/check` reports it.
public sealed class PaymentService(
    AppDb db, IClock clock, IConfig config, ILiveOutbox live, IPushOutbox push, IQPay qpay, IRevenueCat store,
    MembershipService membership, PhoneVerificationService verifications, GuildAuth guild, ILogger<PaymentService> log)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // —— the web page ——

    /// A proven number that already has a finished, active character gets a guild token. The web never
    /// creates accounts.
    public async Task<GuildSession> GuildSignInAsync(Guid verificationId, CancellationToken ct = default)
    {
        var v = await verifications.RefreshAsync(verificationId, ct);
        if (v.State != VerificationState.Verified) throw new DomainException(409, "auth.not_verified", "Send the code first");
        if (v.ClaimedAt is not null) throw new DomainException(409, "auth.already_claimed", "This code was already used");
        if (clock.UtcNow - v.VerifiedAt > SessionService.ClaimWindow)
            throw new DomainException(409, "auth.verification_expired", "This code is too old — send a new one");
        var who = await (from a in db.Set<Account>()
                         join p in db.Set<Profile.Profile>() on a.Id equals p.AccountId
                         where a.Phone == v.Phone && a.Status == AccountStatus.Active && a.DeleteAt == null && p.WelcomedAt != null
                         select new { a.Id, p.Name }).SingleOrDefaultAsync(ct)
            ?? throw new DomainException(404, "guild.no_character", "No character carries this number — make one in the app first");
        var claimed = await db.Database.ExecuteSqlInterpolatedAsync(
            $"""UPDATE phone_verifications SET "ClaimedAt" = {clock.UtcNow}, "ClaimedByAccountId" = {who.Id} WHERE "Id" = {verificationId} AND "ClaimedAt" IS NULL""", ct);
        if (claimed == 0) throw new DomainException(409, "auth.already_claimed", "This code was already used");
        return guild.Issue(who.Id, who.Name);
    }

    public async Task<GuildMe> GuildMeAsync(Guid me, CancellationToken ct = default)
    {
        var name = await db.Set<Profile.Profile>().Where(p => p.AccountId == me).Select(p => p.Name).SingleOrDefaultAsync(ct) ?? "";
        return new GuildMe(name, await membership.ViewAsync(me, ct), membership.Offers());
    }

    /// The row is written before QPay is asked, so any QR that exists has an invoice behind it. The same
    /// key returns the same invoice (a double tap or a retry never makes two).
    public async Task<InvoiceView> CreateInvoiceAsync(Guid me, InvoiceRequest req, CancellationToken ct = default)
    {
        if (!config.Bool(ConfigKeys.MembershipEnabled)) throw new DomainException(409, "membership.closed", "The coffers are sealed");
        var floor = Floors.Parse(req.Floor) ?? throw new DomainException(400, "membership.floor", "Choose the Hall or the High Table");
        if (!MembershipService.Cycles.Contains(req.Months)) throw new DomainException(400, "membership.months", "One, three or six moons");
        var existing = await db.Set<Invoice>().SingleOrDefaultAsync(i => i.AccountId == me && i.IdempotencyKey == req.Key, ct);
        if (existing is not null) return await ViewAsync(existing, ct);

        var who = await (from a in db.Set<Account>()
                         join p in db.Set<Profile.Profile>() on a.Id equals p.AccountId
                         where a.Id == me && a.Status == AccountStatus.Active && a.DeleteAt == null
                         select new { p.Name }).SingleOrDefaultAsync(ct)
            ?? throw new DomainException(403, "account.deleted", "This character can no longer pay");
        var now = clock.UtcNow;
        var expires = now.AddMinutes(config.Int(ConfigKeys.InvoiceMinutes));
        var inv = new Invoice
        {
            Id = Guid.CreateVersion7(), AccountId = me, Name = who.Name, IdempotencyKey = req.Key, Floor = floor, Months = req.Months,
            Amount = membership.Price(floor, req.Months), State = InvoiceState.Open, CreatedAt = now, ExpiresAt = expires,
            WatchUntil = expires.AddDays(1),
        };
        db.Add(inv);
        Event(inv.Id, "Invoice made", "web page");
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException)
        {
            // Two taps raced with one key: the other made it.
            db.ChangeTracker.Clear();
            return await ViewAsync(await db.Set<Invoice>().SingleAsync(i => i.AccountId == me && i.IdempotencyKey == req.Key, ct), ct);
        }

        try
        {
            var q = await qpay.CreateInvoiceAsync(inv.Id, inv.Amount,
                $"MingldIngl · {(floor == Floor.HighTable ? "High Table" : "Hall")} · {req.Months}", ct);
            inv.QPayInvoiceId = q.InvoiceId;
            inv.QrText = q.QrText;
            inv.QrImage = q.QrImage;
            inv.Links = JsonSerializer.Serialize(q.Links, Json);
            Event(inv.Id, "QR shown", "QPay");
            await db.SaveChangesAsync(ct);
        }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
        {
            log.LogWarning(e, "QPay would not make invoice {Invoice}", inv.Id);
            inv.State = InvoiceState.Closed;
            inv.WatchUntil = now;
            Event(inv.Id, "QPay did not answer; nothing could be paid", "engine");
            await db.SaveChangesAsync(CancellationToken.None);
            throw new DomainException(503, "payments.unavailable", "QPay is not answering — try again in a minute");
        }
        Changed(inv);
        return await ViewAsync(inv, ct);
    }

    /// The page asks while its QR is on screen; an open invoice is checked with QPay first, so a lost
    /// callback costs nothing.
    public async Task<InvoiceView> GuildInvoiceAsync(Guid me, Guid id, CancellationToken ct = default)
    {
        var inv = await db.Set<Invoice>().AsNoTracking().SingleOrDefaultAsync(i => i.Id == id && i.AccountId == me, ct)
            ?? throw new DomainException(404, "payments.not_found", "That invoice is not yours");
        if (inv.State == InvoiceState.Open) await CheckAsync(id, "the page", ct);
        return await ViewAsync(await db.Set<Invoice>().AsNoTracking().SingleAsync(i => i.Id == id, ct), ct);
    }

    // —— finding money ——

    /// Asks QPay what was paid on this invoice and settles anything new: the first full payment from a
    /// live character is credited; anything else waits for the keepers to refund it.
    public async Task CheckAsync(Guid invoiceId, string by, CancellationToken ct = default)
    {
        var qpayId = await db.Set<Invoice>().Where(i => i.Id == invoiceId).Select(i => i.QPayInvoiceId).SingleAsync(ct);
        if (qpayId.Length == 0) return;
        IReadOnlyList<QPayPaid> paid;
        try { paid = await qpay.PaidAsync(qpayId, ct); }
        catch (Exception e) when (e is HttpRequestException or TaskCanceledException)
        {
            log.LogWarning(e, "QPay check failed for invoice {Invoice}; the sweep will ask again", invoiceId);
            return;
        }
        if (paid.Count == 0) return;

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var inv = await db.Set<Invoice>().FromSqlInterpolated($"SELECT * FROM invoices WHERE \"Id\" = {invoiceId} FOR UPDATE").SingleAsync(ct);
        var known = await db.Set<Payment>().Where(p => p.InvoiceId == inv.Id).ToListAsync(ct);
        var credited = known.Any(p => p.State == PaymentState.Credited);
        var now = clock.UtcNow;
        var any = false;
        foreach (var q in paid.Where(q => known.All(k => k.QPayPaymentId != q.PaymentId)))
        {
            any = true;
            var p = new Payment
            {
                Id = Guid.CreateVersion7(), InvoiceId = inv.Id, QPayPaymentId = q.PaymentId, Amount = q.Amount, PaidAt = q.At ?? now,
            };
            db.Add(p);
            Event(inv.Id, $"Paid {q.Amount:N0}₮", by);
            var account = inv.AccountId is { } aid
                ? await db.Set<Account>().Where(a => a.Id == aid).Select(a => new { a.Status, a.DeleteAt }).SingleOrDefaultAsync(ct)
                : null;
            string? why = credited ? "Paid twice"
                : q.Amount < inv.Amount ? "Paid less than asked"
                : account is null ? "Account gone"
                : account.Status != AccountStatus.Active ? "Account cast out"
                : null;
            if (why is null)
            {
                await membership.CreditQPayAsync(inv.AccountId!.Value, inv.Floor, inv.Months, p.Id, ct);
                p.State = PaymentState.Credited;
                p.SettledAt = now;
                credited = true;
                Event(inv.Id, $"The {(inv.Floor == Floor.HighTable ? "High Table" : "Hall")} opened for {inv.Months} moon{(inv.Months == 1 ? "" : "s")}", "engine");
            }
            else
            {
                p.State = PaymentState.NeedsAttention;
                p.Note = why;
                Event(inv.Id, $"Could not credit: {why.ToLowerInvariant()} — on the keepers’ list", "engine");
            }
        }
        if (any)
        {
            inv.State = InvoiceState.Closed;
            Changed(inv);
        }
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    /// The sweep: every invoice still watched is checked; an open one past its time goes cold (QPay's
    /// invoice cancelled so its QR cannot be paid), and is still watched a day for late money.
    public async Task<(int Checked, int Cold)> SweepAsync(CancellationToken ct = default)
    {
        var now = clock.UtcNow;
        var ids = await db.Set<Invoice>().Where(i => i.QPayInvoiceId != "" && (i.State == InvoiceState.Open || i.WatchUntil > now))
            .OrderBy(i => i.CreatedAt).Select(i => i.Id).Take(500).ToListAsync(ct);
        var cold = 0;
        foreach (var id in ids)
        {
            await CheckAsync(id, "the sweep", ct);
            var inv = await db.Set<Invoice>().SingleAsync(i => i.Id == id, ct);
            if (inv.State != InvoiceState.Open || inv.ExpiresAt > now) continue;
            if (await qpay.CancelAsync(inv.QPayInvoiceId, ct))
            {
                // A payment may have landed between the check and the cancel.
                await CheckAsync(id, "the sweep", ct);
                await db.Entry(inv).ReloadAsync(ct);
                if (inv.State != InvoiceState.Open) continue;
                inv.State = InvoiceState.Closed;
                Event(inv.Id, "The code went cold; nothing was paid", "the sweep");
                Changed(inv);
                await db.SaveChangesAsync(ct);
                cold++;
            }
        }
        return (ids.Count, cold);
    }

    // —— the store ——

    /// RevenueCat is asked, never told: the app calls this after a purchase, the webhook calls it on
    /// every store event, and the result is whatever RevenueCat holds.
    public async Task<MembershipView> SyncStoreAsync(Guid accountId, CancellationToken ct = default)
    {
        var entitlements = await store.EntitlementsAsync(accountId, ct);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({StoreLockKey(accountId)})", ct);
        await membership.ReplaceStoreAsync(accountId, entitlements, ct);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await membership.ViewAsync(accountId, ct);
    }

    public async Task WebhookAsync(JsonElement body, CancellationToken ct = default)
    {
        if (!body.TryGetProperty("event", out var e)) return;
        var ids = new List<string>();
        if (e.TryGetProperty("app_user_id", out var u) && u.GetString() is { } one) ids.Add(one);
        if (e.TryGetProperty("transferred_to", out var to) && to.ValueKind == JsonValueKind.Array)
            ids.AddRange(to.EnumerateArray().Select(x => x.GetString() ?? ""));
        if (e.TryGetProperty("transferred_from", out var from) && from.ValueKind == JsonValueKind.Array)
            ids.AddRange(from.EnumerateArray().Select(x => x.GetString() ?? ""));
        foreach (var id in ids.Distinct())
            if (Guid.TryParse(id, out var accountId) && await db.Set<Account>().AnyAsync(a => a.Id == accountId, ct))
                await SyncStoreAsync(accountId, ct);
    }

    // —— the keepers ——

    public async Task<AdminPaymentsView> AdminListAsync(CancellationToken ct = default)
    {
        var now = clock.UtcNow;
        var moonStart = UbDays.Start(new DateOnly(clock.TodayUb.Year, clock.TodayUb.Month, 1));
        var moonTotal = await db.Set<Payment>().Where(p => p.PaidAt >= moonStart && p.State == PaymentState.Credited).SumAsync(p => (int?)p.Amount, ct) ?? 0;
        var refunded = await db.Set<Payment>().CountAsync(p => p.State == PaymentState.Refunded && p.SettledAt >= moonStart, ct);
        var floors = await db.Set<MembershipGrant>().Where(g => g.RevokedAt == null && g.StartsAt <= now && g.EndsAt > now)
            .GroupBy(g => g.AccountId).Select(g => g.Max(x => x.Floor)).ToListAsync(ct);
        var attention = await Rows(db.Set<Payment>().Where(p => p.State == PaymentState.NeedsAttention).OrderBy(p => p.PaidAt), 100, ct);
        var latest = await Rows(db.Set<Payment>().OrderByDescending(p => p.PaidAt), 100, ct);
        var storeRows = await (from g in db.Set<MembershipGrant>().Where(g => g.Source == GrantSource.Store)
                               join p in db.Set<Profile.Profile>() on g.AccountId equals p.AccountId
                               orderby g.StartsAt descending
                               select new { g, p.Name }).Take(100).ToListAsync(ct);
        var merged = latest.Concat(storeRows.Select(x => new AdminPaymentRow(x.g.Id, Guid.Empty, x.g.StartsAt, x.g.AccountId, x.Name,
                Floors.Key(x.g.Floor), 0, 0, "store",
                x.g.RevokedAt is not null ? "refunded" : x.g.EndsAt <= now ? "lapsed" : x.g.Renews ? "renews" : "ends", null)))
            .OrderByDescending(r => r.At).Take(100).ToList();
        return new AdminPaymentsView(moonTotal, floors.Count, floors.Count(f => f == Floor.Hall), floors.Count(f => f == Floor.HighTable),
            attention.Count, refunded, attention, merged);
    }

    public async Task<AdminInvoiceView> AdminInvoiceAsync(Guid invoiceId, CancellationToken ct = default)
    {
        var inv = await db.Set<Invoice>().AsNoTracking().SingleOrDefaultAsync(i => i.Id == invoiceId, ct)
            ?? throw new DomainException(404, "payments.not_found", "No such invoice");
        var payments = await Rows(db.Set<Payment>().Where(p => p.InvoiceId == invoiceId).OrderBy(p => p.PaidAt), 50, ct);
        var events = await db.Set<PaymentEvent>().AsNoTracking().Where(e => e.InvoiceId == invoiceId).OrderBy(e => e.At).ThenBy(e => e.Id)
            .Select(e => new AdminPaymentEvent(e.At, e.What, e.By)).ToListAsync(ct);
        return new AdminInvoiceView(inv.Id, inv.AccountId, inv.Name, Floors.Key(inv.Floor), inv.Months, inv.Amount, await StateOfAsync(inv, ct),
            inv.AccountId is null, payments, events);
    }

    public async Task<AdminUserPayments> AdminUserAsync(Guid accountId, CancellationToken ct = default) =>
        new(await membership.ViewAsync(accountId, ct),
            await Rows(db.Set<Payment>().Where(p => db.Set<Invoice>().Any(i => i.Id == p.InvoiceId && i.AccountId == accountId))
                .OrderByDescending(p => p.PaidAt), 50, ct));

    /// Refund through QPay. Where QPay cannot (a bank-app payment), the keeper is told to return it by
    /// transfer and then record that with `RefundedByHandAsync`.
    public async Task<AdminPaymentRow> RefundAsync(Guid paymentId, CancellationToken ct = default)
    {
        var p = await Settleable(paymentId, ct);
        if (!await qpay.RefundAsync(p.QPayPaymentId, ct))
            throw new DomainException(409, "payments.refund_by_hand",
                "QPay cannot refund this payment — return it by bank transfer, then mark it refunded by hand");
        return await SettleRefundAsync(p, "Refunded through QPay", ct);
    }

    public async Task<AdminPaymentRow> RefundedByHandAsync(Guid paymentId, CancellationToken ct = default) =>
        await SettleRefundAsync(await Settleable(paymentId, ct), "Returned by bank transfer", ct);

    /// A keeper settled it another way (e.g. the person was helped by hand); only for payments on the list.
    public async Task<AdminPaymentRow> HandledAsync(Guid paymentId, CancellationToken ct = default)
    {
        var p = await db.Set<Payment>().SingleOrDefaultAsync(x => x.Id == paymentId, ct)
            ?? throw new DomainException(404, "payments.not_found", "No such payment");
        if (p.State != PaymentState.NeedsAttention) throw new DomainException(409, "payments.settled", "That payment is already settled");
        p.State = PaymentState.Handled;
        p.SettledAt = clock.UtcNow;
        Event(p.InvoiceId, "Marked as handled", "keeper");
        var inv = await db.Set<Invoice>().SingleAsync(i => i.Id == p.InvoiceId, ct);
        Changed(inv);
        await db.SaveChangesAsync(ct);
        return (await Rows(db.Set<Payment>().Where(x => x.Id == paymentId), 1, ct)).Single();
    }

    // —— helpers ——

    private async Task<Payment> Settleable(Guid paymentId, CancellationToken ct)
    {
        var p = await db.Set<Payment>().SingleOrDefaultAsync(x => x.Id == paymentId, ct)
            ?? throw new DomainException(404, "payments.not_found", "No such payment");
        if (p.State is PaymentState.Refunded or PaymentState.Handled)
            throw new DomainException(409, "payments.settled", "That payment is already settled");
        return p;
    }

    private async Task<AdminPaymentRow> SettleRefundAsync(Payment p, string what, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        if (p.State == PaymentState.Credited) await membership.RevokeQPayAsync(p.Id, ct);
        p.State = PaymentState.Refunded;
        p.SettledAt = clock.UtcNow;
        Event(p.InvoiceId, what, "keeper");
        var inv = await db.Set<Invoice>().SingleAsync(i => i.Id == p.InvoiceId, ct);
        if (inv.AccountId is { } aid) push.Send(aid, PushKinds.RefundSent, null, null, $"{p.Amount:N0}₮");
        Changed(inv);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return (await Rows(db.Set<Payment>().Where(x => x.Id == p.Id), 1, ct)).Single();
    }

    private async Task<List<AdminPaymentRow>> Rows(IQueryable<Payment> q, int take, CancellationToken ct) =>
        await (from p in q.Take(take)
               join i in db.Set<Invoice>() on p.InvoiceId equals i.Id
               select new AdminPaymentRow(p.Id, i.Id, p.PaidAt, i.AccountId, i.Name, i.Floor == Floor.HighTable ? "highTable" : "hall",
                   i.Months, p.Amount, "qpay",
                   p.State == PaymentState.Credited ? "credited" : p.State == PaymentState.NeedsAttention ? "needsAttention"
                       : p.State == PaymentState.Refunded ? "refunded" : "handled", p.Note)).AsNoTracking().ToListAsync(ct);

    private async Task<string> StateOfAsync(Invoice inv, CancellationToken ct)
    {
        var states = await db.Set<Payment>().Where(p => p.InvoiceId == inv.Id).Select(p => p.State).ToListAsync(ct);
        if (states.Contains(PaymentState.Credited)) return "paid";
        if (states.Contains(PaymentState.NeedsAttention)) return "refunding";
        if (states.Count > 0) return "refunded";
        // An open invoice past its time stays "open" until the sweep has cancelled it with QPay.
        return inv.State == InvoiceState.Open ? "open" : "cold";
    }

    private async Task<InvoiceView> ViewAsync(Invoice inv, CancellationToken ct)
    {
        var state = await StateOfAsync(inv, ct);
        DateTimeOffset? until = null;
        if (state == "paid" && inv.AccountId is { } aid) until = (await membership.ViewAsync(aid, ct)).Until;
        return new InvoiceView(inv.Id, Floors.Key(inv.Floor), inv.Months, inv.Amount, inv.QrText, inv.QrImage,
            JsonSerializer.Deserialize<List<BankLink>>(inv.Links, Json) ?? [], inv.ExpiresAt, state, until);
    }

    private void Event(Guid invoiceId, string what, string by) =>
        db.Add(new PaymentEvent { Id = Guid.CreateVersion7(), InvoiceId = invoiceId, At = clock.UtcNow, What = what, By = by });

    private void Changed(Invoice inv)
    {
        if (inv.AccountId is { } aid) live.ToAccount(aid, LiveKinds.PaymentUpdated, inv.Id);
        live.ToAdmins(LiveKinds.PaymentUpdated, inv.Id);
    }

    private static long StoreLockKey(Guid accountId) => BitConverter.ToInt64(accountId.ToByteArray(), 0) ^ 0x5354_4F52_4521;
}
