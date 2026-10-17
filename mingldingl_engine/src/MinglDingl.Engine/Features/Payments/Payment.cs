using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Membership;

namespace MinglDingl.Engine.Features.Payments;

/// open: the QR is out; closed: paid or gone cold (QPay's invoice cancelled). Late money is still found.
public enum InvoiceState { Open, Closed }

/// What became of one payment that reached QPay. Every one ends credited or refunded — none is left hanging.
public enum PaymentState { Credited, NeedsAttention, Refunded, Handled }

/// A QPay invoice made on the web page. The row exists before the QR is shown, so a payment can
/// always be traced to it. It outlives the account (payments are records), keeping a name.
public sealed class Invoice
{
    public Guid Id { get; set; }
    public Guid? AccountId { get; set; }
    public string Name { get; set; } = "";
    /// The page's key for "make me an invoice": a retry gets the same invoice, never a second.
    public string IdempotencyKey { get; set; } = "";
    public Floor Floor { get; set; }
    public int Months { get; set; }
    public int Amount { get; set; }
    public string QPayInvoiceId { get; set; } = "";
    public string QrText { get; set; } = "";
    public string? QrImage { get; set; }
    /// Bank app links as JSON ([{ name, logo, link }]).
    public string Links { get; set; } = "[]";
    public InvoiceState State { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    /// Checked with QPay until this (a day past expiry), so late money is still found.
    public DateTimeOffset WatchUntil { get; set; }
}

/// One payment QPay reports for an invoice (QPay's payment id is unique, so a repeated callback or
/// check never credits twice).
public sealed class Payment
{
    public Guid Id { get; set; }
    public Guid InvoiceId { get; set; }
    public string QPayPaymentId { get; set; } = "";
    public int Amount { get; set; }
    public PaymentState State { get; set; }
    public string? Note { get; set; }
    public DateTimeOffset PaidAt { get; set; }
    public DateTimeOffset? SettledAt { get; set; }
}

/// What happened to an invoice, in order — the admin's "What happened".
public sealed class PaymentEvent
{
    public Guid Id { get; set; }
    public Guid InvoiceId { get; set; }
    public DateTimeOffset At { get; set; }
    public string What { get; set; } = "";
    public string By { get; set; } = "";
}

internal sealed class InvoiceMap : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> e)
    {
        e.ToTable("invoices");
        e.Property(x => x.Name).HasMaxLength(Kernel.Validation.FieldLimits.Name);
        e.Property(x => x.IdempotencyKey).HasMaxLength(64);
        e.Property(x => x.Floor).HasConversion<string>().HasMaxLength(10);
        e.Property(x => x.QPayInvoiceId).HasMaxLength(64);
        e.Property(x => x.State).HasConversion<string>().HasMaxLength(8);
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.SetNull);
        e.HasIndex(x => new { x.AccountId, x.IdempotencyKey }).IsUnique();
        e.HasIndex(x => x.WatchUntil);
    }
}

internal sealed class PaymentMap : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> e)
    {
        e.ToTable("payments");
        e.Property(x => x.QPayPaymentId).HasMaxLength(64);
        e.Property(x => x.State).HasConversion<string>().HasMaxLength(16);
        e.Property(x => x.Note).HasMaxLength(200);
        e.HasOne<Invoice>().WithMany().HasForeignKey(x => x.InvoiceId).OnDelete(DeleteBehavior.Restrict);
        e.HasIndex(x => x.QPayPaymentId).IsUnique();
        e.HasIndex(x => new { x.State, x.PaidAt });
    }
}

internal sealed class PaymentEventMap : IEntityTypeConfiguration<PaymentEvent>
{
    public void Configure(EntityTypeBuilder<PaymentEvent> e)
    {
        e.ToTable("payment_events");
        e.Property(x => x.What).HasMaxLength(200);
        e.Property(x => x.By).HasMaxLength(40);
        e.HasOne<Invoice>().WithMany().HasForeignKey(x => x.InvoiceId).OnDelete(DeleteBehavior.Restrict);
        e.HasIndex(x => new { x.InvoiceId, x.At });
    }
}

// —— the web page (/guild) ——

public sealed record GuildSessionRequest(Guid VerificationId);

/// A guild token reaches only the guild endpoints; it lasts half an hour and has no refresh.
public sealed record GuildSession(string Token, DateTimeOffset ExpiresAt, string Name);

public sealed record GuildMe(string Name, MembershipView Membership, IReadOnlyList<FloorOffer> Offers);

public sealed record InvoiceRequest(
    [System.ComponentModel.DataAnnotations.Required] string Floor,
    [System.ComponentModel.DataAnnotations.Range(1, 6)] int Months,
    [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(64, MinimumLength = 8)] string Key);

public sealed record BankLink(string Name, string? Logo, string Link);

/// state: open (scan it) / paid (the floor is yours) / cold (nothing paid, code gone) /
/// refunding (paid but could not be credited; the money is coming back) / refunded.
public sealed record InvoiceView(Guid Id, string Floor, int Months, int Amount, string QrText, string? QrImage,
    IReadOnlyList<BankLink> Links, DateTimeOffset ExpiresAt, string State, DateTimeOffset? PaidUntil);

// —— the keepers ——

public sealed record AdminPaymentRow(Guid Id, Guid InvoiceId, DateTimeOffset At, Guid? AccountId, string Name, string Floor,
    int Months, int Amount, string Channel, string State, string? Note);

public sealed record AdminPaymentsView(int MoonTotal, int Members, int HallMembers, int HighTableMembers, int NeedsAttention,
    int RefundedThisMoon, IReadOnlyList<AdminPaymentRow> Attention, IReadOnlyList<AdminPaymentRow> Latest);

public sealed record AdminPaymentEvent(DateTimeOffset At, string What, string By);

public sealed record AdminInvoiceView(Guid Id, Guid? AccountId, string Name, string Floor, int Months, int Amount, string State,
    bool AccountGone, IReadOnlyList<AdminPaymentRow> Payments, IReadOnlyList<AdminPaymentEvent> Events);

/// A user's floor and payments, for their admin page.
public sealed record AdminUserPayments(MembershipView Membership, IReadOnlyList<AdminPaymentRow> Payments);
