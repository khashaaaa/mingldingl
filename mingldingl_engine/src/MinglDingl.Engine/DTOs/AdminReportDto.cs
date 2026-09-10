public record AdminReportListItemDto(
    Guid Id,
    Guid ReporterId,
    string ReporterDisplayName,
    Guid ReportedUserId,
    string ReportedDisplayName,
    bool ReportedIsBanned,
    string Reason,
    string? Details,
    string Status,
    Guid? MatchId,
    DateTime CreatedAt);

public record AdminReportDetailDto(
    Guid Id,
    Guid ReporterId,
    string ReporterDisplayName,
    Guid ReportedUserId,
    string ReportedDisplayName,
    bool ReportedIsBanned,
    IReadOnlyList<string> ReportedPhotoUrls,
    string Reason,
    string? Details,
    string Status,
    Guid? MatchId,
    string? ReviewNotes,
    string? ReviewedBy,
    DateTime? ReviewedAt,
    DateTime CreatedAt,
    int TotalReportsAgainst,
    int DistinctReportersAgainst,
    int PendingReportsAgainst);

public record PendingReportCountDto(int Pending);

public record AdminResolveReportRequest(
    [System.ComponentModel.DataAnnotations.Required,
     System.ComponentModel.DataAnnotations.MaxLength(FieldLimits.ShortLabel)] string Outcome,
    [System.ComponentModel.DataAnnotations.MaxLength(FieldLimits.Reason)] string? Notes);
