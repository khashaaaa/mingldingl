using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Codex;

public sealed record CodexPageView(string Slug, string Kind, string Title, string Summary, string Body);

public sealed class CodexService(AppDb db)
{
    /// Every page in the reader's language (English where none is written yet), in order.
    public async Task<IReadOnlyList<CodexPageView>> ListAsync(string locale, CancellationToken ct = default)
    {
        var rows = await db.Set<CodexPage>().AsNoTracking()
            .Where(p => p.Locale == locale || p.Locale == "en").ToListAsync(ct);
        return rows.GroupBy(p => p.Slug)
            .Select(g => g.FirstOrDefault(p => p.Locale == locale) ?? g.First())
            .OrderBy(p => p.Kind).ThenBy(p => p.Position)
            .Select(p => new CodexPageView(p.Slug, p.Kind.ToString().ToLowerInvariant(), p.Title, p.Summary, p.Body))
            .ToList();
    }

    public async Task<CodexPageView> GetAsync(string slug, string locale, CancellationToken ct = default) =>
        (await ListAsync(locale, ct)).FirstOrDefault(p => p.Slug == slug)
        ?? throw new DomainException(404, "codex.not_found", "That page is not in the Codex");

    /// The first pages, in English and Mongolian, written at boot where they are missing.
    public static async Task SeedAsync(AppDb db, DateTimeOffset now, CancellationToken ct = default)
    {
        // a first page wherever none is written yet (a later release adds its new guides) — a keeper's
        // own is never replaced
        var english = await db.Set<CodexPage>().Where(p => p.Locale == "en").Select(p => p.Slug).ToListAsync(ct);
        db.AddRange(CodexSeed.Pages.Select((p, i) => (Page: p, Position: i))
            .Where(x => !english.Contains(x.Page.Slug))
            .Select(x => new CodexPage
            {
                Slug = x.Page.Slug, Locale = "en", Kind = x.Page.Kind, Position = x.Position, Title = x.Page.Title,
                Summary = x.Page.Summary, Body = x.Page.Body, UpdatedAt = now,
            }));
        var written = await db.Set<CodexPage>().Where(p => p.Locale == "mn").Select(p => p.Slug).ToListAsync(ct);
        db.AddRange(CodexSeed.Pages.Select((p, i) => (Page: p, Position: i))
            .Where(x => !written.Contains(x.Page.Slug) && CodexSeed.Mn.ContainsKey(x.Page.Slug))
            .Select(x => new CodexPage
            {
                Slug = x.Page.Slug, Locale = "mn", Kind = x.Page.Kind, Position = x.Position,
                Title = CodexSeed.Mn[x.Page.Slug].Title, Summary = CodexSeed.Mn[x.Page.Slug].Summary,
                Body = CodexSeed.Mn[x.Page.Slug].Body, UpdatedAt = now,
            }));
        await db.SaveChangesAsync(ct);
    }
}
