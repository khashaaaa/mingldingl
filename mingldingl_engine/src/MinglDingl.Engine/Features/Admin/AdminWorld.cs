using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MinglDingl.Engine.Features.Codex;
using MinglDingl.Engine.Features.Festivals;
using MinglDingl.Engine.Features.Payments;
using MinglDingl.Engine.Features.Safety;
using MinglDingl.Engine.Features.Venues;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;
using MinglDingl.Engine.Kernel.Validation;

namespace MinglDingl.Engine.Features.Admin;

/// One thing a keeper did: when, who, what, to whom.
public sealed class AuditEntry
{
    public Guid Id { get; set; }
    public DateTimeOffset At { get; set; }
    public string Keeper { get; set; } = "";
    public string Action { get; set; } = "";
    public string? Target { get; set; }
    /// The keeper's reason, for the actions that ask for one.
    public string? Note { get; set; }
}

internal sealed class AuditEntryMap : IEntityTypeConfiguration<AuditEntry>
{
    public void Configure(EntityTypeBuilder<AuditEntry> e)
    {
        e.ToTable("audit_log");
        e.Property(x => x.Keeper).HasMaxLength(40);
        e.Property(x => x.Action).HasMaxLength(200);
        e.Property(x => x.Note).HasMaxLength(Kernel.Validation.FieldLimits.KeeperReason);
        e.Property(x => x.Target).HasMaxLength(80);
        e.HasIndex(x => x.At);
    }
}

public sealed record AuditRow(Guid Id, DateTimeOffset At, string Keeper, string Action, string? Target, string? Note);

/// status: published (both languages) / needsMn (English only).
public sealed record AdminCodexRow(string Slug, string Kind, int Position, string Title, IReadOnlyList<string> Locales,
    DateTimeOffset UpdatedAt, string Status);

public sealed record CodexText(string Title, string Summary, string Body);

public sealed record AdminCodexPage(string Slug, string Kind, int Position, CodexText En, CodexText? Mn);

public sealed record CodexWriteRequest(
    [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(2)] string Locale,
    [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(FieldLimits.CodexTitle)] string Title,
    [System.ComponentModel.DataAnnotations.StringLength(FieldLimits.CodexSummary)] string? Summary,
    [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(FieldLimits.CodexBody)] string Body);

public sealed record FestivalRow(Guid Id, string Key, DateOnly Starts, DateOnly Ends);

public sealed record FestivalWriteRequest(
    [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(16)] string Key,
    DateOnly Starts, DateOnly Ends);

/// The keepers' Codex pages, festival calendar and audit log.
public sealed class AdminWorld(AppDb db, IClock clock, ILiveOutbox live)
{
    public async Task<IReadOnlyList<AdminCodexRow>> CodexAsync(CancellationToken ct = default)
    {
        var rows = await db.Set<CodexPage>().AsNoTracking().ToListAsync(ct);
        return rows.GroupBy(p => p.Slug).Select(g =>
        {
            var en = g.FirstOrDefault(p => p.Locale == "en") ?? g.First();
            var locales = g.Select(p => p.Locale).OrderBy(l => l == "en" ? 0 : 1).ToList();
            return new AdminCodexRow(g.Key, en.Kind.ToString().ToLowerInvariant(), en.Position, en.Title, locales,
                g.Max(p => p.UpdatedAt), locales.Contains("mn") ? "published" : "needsMn");
        }).OrderBy(r => r.Kind).ThenBy(r => r.Position).ToList();
    }

    public async Task<AdminCodexPage> CodexPageAsync(string slug, CancellationToken ct = default)
    {
        var rows = await db.Set<CodexPage>().AsNoTracking().Where(p => p.Slug == slug).ToListAsync(ct);
        var en = rows.FirstOrDefault(p => p.Locale == "en") ?? throw new DomainException(404, "codex.not_found", "That page is not in the Codex");
        var mn = rows.FirstOrDefault(p => p.Locale == "mn");
        return new AdminCodexPage(slug, en.Kind.ToString().ToLowerInvariant(), en.Position, new(en.Title, en.Summary, en.Body),
            mn is null ? null : new(mn.Title, mn.Summary, mn.Body));
    }

    /// Writes one language of a page (English must exist first; Mongolian is added beside it).
    public async Task<AdminCodexPage> SaveCodexAsync(string slug, CodexWriteRequest req, CancellationToken ct = default)
    {
        if (req.Locale is not ("en" or "mn")) throw new DomainException(400, "codex.locale", "English or Mongolian");
        var en = await db.Set<CodexPage>().SingleOrDefaultAsync(p => p.Slug == slug && p.Locale == "en", ct)
            ?? throw new DomainException(404, "codex.not_found", "That page is not in the Codex");
        var page = req.Locale == "en" ? en : await db.Set<CodexPage>().SingleOrDefaultAsync(p => p.Slug == slug && p.Locale == "mn", ct);
        if (page is null)
        {
            page = new CodexPage { Id = Guid.CreateVersion7(), Slug = slug, Locale = "mn", Kind = en.Kind, Position = en.Position };
            db.Add(page);
        }
        page.Title = req.Title.Trim();
        page.Summary = req.Summary?.Trim() ?? "";
        page.Body = req.Body.Trim();
        page.UpdatedAt = clock.UtcNow;
        live.ToAll(LiveKinds.CodexUpdated);
        await db.SaveChangesAsync(ct);
        return await CodexPageAsync(slug, ct);
    }

    public async Task<IReadOnlyList<FestivalRow>> FestivalsAsync(CancellationToken ct = default) =>
        await db.Set<Festival>().AsNoTracking().OrderBy(f => f.Starts)
            .Select(f => new FestivalRow(f.Id, f.Key, f.Starts, f.Ends)).ToListAsync(ct);

    public async Task<FestivalRow> SaveFestivalAsync(Guid? id, FestivalWriteRequest req, CancellationToken ct = default)
    {
        if (req.Ends < req.Starts) throw new DomainException(400, "festival.dates", "A festival ends on or after it starts");
        var f = id is { } x
            ? await db.Set<Festival>().SingleOrDefaultAsync(r => r.Id == x, ct) ?? throw new DomainException(404, "festival.not_found", "No such festival")
            : new Festival { Id = Guid.CreateVersion7(), Key = req.Key };
        if (id is null) db.Add(f);
        f.Starts = req.Starts;
        f.Ends = req.Ends;
        live.ToAll(LiveKinds.FestivalUpdated);
        await db.SaveChangesAsync(ct);
        return new FestivalRow(f.Id, f.Key, f.Starts, f.Ends);
    }

    public async Task<IReadOnlyList<AuditRow>> AuditAsync(DateTimeOffset? before, CancellationToken ct = default)
    {
        var q = db.Set<AuditEntry>().AsNoTracking();
        if (before is { } b) q = q.Where(a => a.At < b);
        return await q.OrderByDescending(a => a.At).ThenByDescending(a => a.Id).Take(100).Select(a => new AuditRow(a.Id, a.At, a.Keeper, a.Action, a.Target, a.Note)).ToListAsync(ct);
    }
}

/// Every keeper write that succeeds becomes one audit row (what, and to whom). Reads and the
/// login are not written, nor the live hub's handshake (`/admin/live/negotiate` is a POST). The
/// row is saved after the change it describes.
public sealed class AuditMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext http, AppDb db, IClock clock, IConfig config, IConfiguration settings, ILiveOutbox live)
    {
        var path = http.Request.Path.Value ?? "";
        var write = path.StartsWith("/admin/", StringComparison.Ordinal) && !path.StartsWith("/admin/auth", StringComparison.Ordinal)
            && !path.StartsWith("/admin/live", StringComparison.Ordinal)
            && !HttpMethods.IsGet(http.Request.Method) && !HttpMethods.IsHead(http.Request.Method);
        if (!write)
        {
            await next(http);
            return;
        }
        var name = http.GetEndpoint()?.Metadata.GetMetadata<EndpointNameMetadata>()?.EndpointName;
        var route = http.Request.RouteValues;
        string? Value(string k) => route.TryGetValue(k, out var v) ? v?.ToString() : null;
        string? Item(string k) => http.Items.TryGetValue(k, out var v) ? v as string : null;
        var oldConfig = name == "AdminSetConfig" && Value("key") is { } key && ConfigKeys.Find(key) is not null ? config.Str(key) : null;

        await next(http);
        if (http.Response.StatusCode is < 200 or >= 300) return;

        var (action, target) = name switch
        {
            "AdminSetConfig" => ($"Config changed: {Value("key")} {oldConfig} → {config.Str(Value("key") ?? "")}", null),
            "AdminResolveReport" => await ReportAsync(db, Value("id")),
            "AdminCreateVenue" => ("Venue added", null),
            "AdminUpdateVenue" => ("Venue edited", await VenueAsync(db, Value("id"))),
            "AdminRemoveVenue" => ("Venue removed", await VenueAsync(db, Value("id"))),
            "AdminRingBell" => ("A bell was rung", null),
            "AdminCancelGathering" => ("A gathering was cancelled", Value("id")),
            "AdminSaveCodex" => ($"Codex page saved: {Value("slug")}", null),
            "AdminSaveFestival" or "AdminAddFestival" => ("Festival calendar changed", null),
            "AdminRefundPayment" => ("Payment refunded through QPay", await PayerAsync(db, Value("id"))),
            "AdminRefundedByHand" => ("Payment returned by bank transfer", await PayerAsync(db, Value("id"))),
            "AdminPaymentHandled" => ("Payment marked as handled", await PayerAsync(db, Value("id"))),
            "AdminRunSweep" => ("Maintenance sweep run by hand", null),
            "AdminEditGathering" => ("A gathering was edited", Value("id")),
            "AdminSuspendUser" => ("Suspended", Item("audit.target")),
            "AdminLiftSuspension" => ("Suspension lifted", Item("audit.target")),
            "AdminSignOutUser" => ("Signed out everywhere", Item("audit.target")),
            "AdminDeleteUserNow" => ("Deleted at once", Item("audit.target")),
            "AdminClearUserText" => ($"Cleared the {Item("audit.what")}", Item("audit.target")),
            "AdminRemoveUserPhoto" => ("Removed a portrait", Item("audit.target")),
            "AdminGiveFloor" => ($"Gave {Item("audit.what")}", Item("audit.target")),
            "AdminAdjustScore" => ($"Adjusted {Item("audit.what")}", Item("audit.target")),
            "AdminClearUserFlag" => ("Cleared the shared-device flag", Item("audit.target")),
            "AdminUnbarNumber" => ("Lifted the bar on a number", Item("audit.target")),
            _ => (name ?? $"{http.Request.Method} {path}", null),
        };
        db.Add(new AuditEntry
        {
            Id = Guid.CreateVersion7(), At = clock.UtcNow, Keeper = settings["Admin:Username"] ?? "keeper",
            Action = action.Length > 200 ? action[..200] : action, Target = target, Note = Item("audit.note"),
        });
        live.ToAdmins(LiveKinds.AuditCreated);
        await db.SaveChangesAsync();
    }

    /// Targets are read by a keeper: the venue's name, not its id (a removed venue keeps its row).
    private static async Task<string?> VenueAsync(AppDb db, string? id) =>
        Guid.TryParse(id, out var vid)
            ? await db.Set<Venue>().AsNoTracking().Where(v => v.Id == vid).Select(v => v.Name).SingleOrDefaultAsync() ?? id
            : id;

    /// Who paid and how much, e.g. "Bold · 19 900₮".
    private static async Task<string?> PayerAsync(AppDb db, string? id)
    {
        if (!Guid.TryParse(id, out var pid)) return id;
        var row = await db.Set<Payment>().AsNoTracking().Where(p => p.Id == pid)
            .Join(db.Set<Invoice>(), p => p.InvoiceId, i => i.Id, (p, i) => new { i.Name, p.Amount })
            .SingleOrDefaultAsync();
        return row is null ? id : $"{row.Name} · {row.Amount.ToString("#,0", System.Globalization.CultureInfo.InvariantCulture).Replace(',', ' ')}₮";
    }

    private static async Task<(string, string?)> ReportAsync(AppDb db, string? id)
    {
        if (!Guid.TryParse(id, out var rid)) return ("Report resolved", null);
        var r = await db.Set<Report>().AsNoTracking().Where(x => x.Id == rid).Select(x => new { x.Status, x.TargetId }).SingleOrDefaultAsync();
        if (r is null) return ("Report resolved", null);
        var name = await db.Set<Profile.Profile>().AsNoTracking().Where(p => p.AccountId == r.TargetId).Select(p => p.Name).SingleOrDefaultAsync();
        return ($"Report resolved — {r.Status.ToString().ToLowerInvariant()}", name);
    }
}
