using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Features.Auth;

namespace MinglDingl.Engine.Features.Threads;

public enum ThreadState { Waiting, Sparked, Cut }

/// A Fated Thread: someone who knows two people asks both, privately, whether they would meet the
/// other. The numbers are the key — whoever holds one (now, or after signing up) answers it.
public sealed class FatedThread
{
    public Guid Id { get; set; }
    public Guid WeaverId { get; set; }
    public string PhoneA { get; set; } = "";
    public string PhoneB { get; set; } = "";
    /// The invitation codes the weaver shares (they only open the app to the thread).
    public string CodeA { get; set; } = "";
    public string CodeB { get; set; } = "";
    public bool? AnswerA { get; set; }
    public bool? AnswerB { get; set; }
    public ThreadState State { get; set; }
    public Guid? BondId { get; set; }
    public DateTimeOffset WovenAt { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }
}

internal sealed class FatedThreadMap : IEntityTypeConfiguration<FatedThread>
{
    public void Configure(EntityTypeBuilder<FatedThread> e)
    {
        e.ToTable("threads");
        e.Property(x => x.PhoneA).HasMaxLength(Kernel.Validation.FieldLimits.Phone);
        e.Property(x => x.PhoneB).HasMaxLength(Kernel.Validation.FieldLimits.Phone);
        e.Property(x => x.CodeA).HasMaxLength(8);
        e.Property(x => x.CodeB).HasMaxLength(8);
        e.Property(x => x.State).HasConversion<string>().HasMaxLength(8);
        e.HasOne<Account>().WithMany().HasForeignKey(x => x.WeaverId).OnDelete(DeleteBehavior.Cascade);
        e.HasIndex(x => new { x.WeaverId, x.WovenAt });
        e.HasIndex(x => x.PhoneA);
        e.HasIndex(x => x.PhoneB);
    }
}

public sealed record WeaveRequest(
    [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(Kernel.Validation.FieldLimits.Phone)] string First,
    [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(Kernel.Validation.FieldLimits.Phone)] string Second);

/// What the weaver gets back: the two invitations to share.
public sealed record WovenView(Guid Id, string FirstCode, string SecondCode);

/// A thread in the weaver's Thread Log. first: the first person's masked number (9911····), whether
/// or not it has a character. state: waiting / oneSaidYes / sparked / cut.
public sealed record WovenRow(Guid Id, string First, string State, DateTimeOffset WovenAt, int Points);

/// A thread woven for me (the Quest Log row and its page): who wove it, whether I answered.
public sealed record InvitationView(Guid Id, string Weaver, bool? MyAnswer, string State, DateTimeOffset WovenAt);

public sealed record ThreadAnswerRequest(bool Yes);

/// code: my call (MNKH-4821); answered: allies who came through it.
public sealed record AllyView(string Code, int Answered, int Bounty);

/// An admin's view of a thread: who wove it, the masked numbers, when, and how it stands.
public sealed record AdminThreadRow(Guid Id, string Weaver, string First, string Second, DateTimeOffset WovenAt, string State);
