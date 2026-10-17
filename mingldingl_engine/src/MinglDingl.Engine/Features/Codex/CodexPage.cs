using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MinglDingl.Engine.Features.Codex;

public enum CodexKind { Guide, Legal }

/// One page of the Codex in one language. A page missing in the reader's language falls back to English.
public sealed class CodexPage
{
    public Guid Id { get; set; }
    public string Slug { get; set; } = "";
    public string Locale { get; set; } = "en";
    public CodexKind Kind { get; set; }
    public int Position { get; set; }
    public string Title { get; set; } = "";
    public string Summary { get; set; } = "";
    public string Body { get; set; } = "";
    public DateTimeOffset UpdatedAt { get; set; }
}

internal sealed class CodexPageMap : IEntityTypeConfiguration<CodexPage>
{
    public void Configure(EntityTypeBuilder<CodexPage> e)
    {
        e.ToTable("codex_pages");
        e.Property(x => x.Slug).HasMaxLength(40);
        e.Property(x => x.Locale).HasMaxLength(2);
        e.Property(x => x.Kind).HasConversion<string>().HasMaxLength(8);
        e.Property(x => x.Title).HasMaxLength(Kernel.Validation.FieldLimits.CodexTitle);
        e.Property(x => x.Summary).HasMaxLength(Kernel.Validation.FieldLimits.CodexSummary);
        e.Property(x => x.Body).HasMaxLength(Kernel.Validation.FieldLimits.CodexBody);
        e.HasIndex(x => new { x.Slug, x.Locale }).IsUnique();
    }
}
