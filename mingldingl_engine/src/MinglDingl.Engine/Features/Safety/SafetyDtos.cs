using System.ComponentModel.DataAnnotations;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Kernel.Validation;

namespace MinglDingl.Engine.Features.Safety;

/// reason: rude | money | notWhoTheyClaim | under18 | other.
public sealed record ReportRequest(
    Guid AccountId, Guid? BondId, [Required, StringLength(20)] string Reason, [StringLength(FieldLimits.ReportNote)] string? Note);

/// portrait: revealed only if your bond with them had broken its first seal.
public sealed record BlockedView(Guid AccountId, string Name, PortraitView? Portrait, DateTimeOffset CastOutAt);

/// action: dismiss | penalise | castOut.
public sealed record ResolveReportRequest([Required, StringLength(10)] string Action, [StringLength(FieldLimits.ReportNote)] string? Note);

public sealed record AdminReportRow(
    Guid Id, Guid ReporterId, string ReporterName, Guid TargetId, string TargetName, string Reason, string? Note, string Status,
    DateTimeOffset CreatedAt, int TargetReports);

public sealed record AdminReportLetter(bool ByTarget, string Text, DateTimeOffset CreatedAt);

public sealed record AdminReportDetail(
    Guid Id, Guid ReporterId, string ReporterName, Guid TargetId, string TargetName, string TargetStatus, Guid? BondId,
    string Reason, string? Note, string Status, string? Resolution, DateTimeOffset CreatedAt, DateTimeOffset? ResolvedAt,
    int TargetReports, IReadOnlyList<AdminReportLetter> LastLetters);

public sealed record AdminReportPage(IReadOnlyList<AdminReportRow> Items, DateTimeOffset? NextBefore);
