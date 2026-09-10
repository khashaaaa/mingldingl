using Microsoft.EntityFrameworkCore;

/// <summary>
/// User-to-user reporting. The score economy has carried a <c>ReportPenalty</c> delta since the
/// beginning, but nothing could ever award it: there was no way to report anyone, from anywhere,
/// and no queue for an admin to act on. Blocking was the only lever a person had, and it only
/// reached someone they were already matched with.
/// </summary>
public class ReportService
{
    private readonly AppDbContext _db;
    private readonly ScoreService _score;
    private readonly SupabaseBroadcastService _broadcast;

    public ReportService(AppDbContext db, ScoreService score, SupabaseBroadcastService broadcast)
    {
        _db = db;
        _score = score;
        _broadcast = broadcast;
    }

    /// <summary>
    /// Files a report and, because reporting someone always means wanting them gone, blocks them
    /// and ends any live conversation in the same step. Doing that separately meant the person you
    /// reported could keep messaging you while an admin got round to the queue.
    /// </summary>
    public async Task<UserReport> CreateAsync(Guid reporterId, Guid reportedUserId, string reason, string? details, Guid? matchId)
    {
        if (reporterId == reportedUserId)
            throw new DomainException("You cannot report yourself", "report.self");
        if (!ReportReasons.All.Contains(reason))
            throw new DomainException($"Reason must be one of: {string.Join(", ", ReportReasons.All)}", "report.reason_invalid");

        var reported = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == reportedUserId);
        if (reported is null) throw DomainException.NotFound("User not found", "user.not_found");

        // One open report per pair. Without this the queue is trivially floodable, and twenty rows
        // from one angry person read to a moderator as twenty people with a complaint.
        bool alreadyOpen = await _db.UserReports.AnyAsync(r =>
            r.ReporterId == reporterId
            && r.ReportedUserId == reportedUserId
            && r.Status == ReportOutcomes.Pending);
        if (alreadyOpen)
            throw DomainException.Conflict("You already have an open report about this person", "report.already_open");

        // Only a match the reporter is actually in may be cited, or the report carries a
        // conversation id chosen by the client and the moderator reads someone else's thread.
        Guid? verifiedMatchId = null;
        if (matchId is Guid id)
        {
            var match = await _db.Matches.AsNoTracking().FirstOrDefaultAsync(m => m.Id == id);
            if (match is not null && match.IsParticipant(reporterId) && match.IsParticipant(reportedUserId))
                verifiedMatchId = id;
        }

        var report = new UserReport
        {
            ReporterId = reporterId,
            ReportedUserId = reportedUserId,
            MatchId = verifiedMatchId,
            Reason = reason,
            Details = string.IsNullOrWhiteSpace(details) ? null : details.Trim(),
        };
        _db.UserReports.Add(report);

        bool alreadyBlocked = await _db.BlockedUsers
            .AnyAsync(bl => bl.BlockerId == reporterId && bl.BlockedId == reportedUserId);
        if (!alreadyBlocked)
            _db.BlockedUsers.Add(new BlockedUser { BlockerId = reporterId, BlockedId = reportedUserId });

        var liveMatches = await _db.Matches
            .Where(m => m.Status == "Active"
                && ((m.InitiatorId == reporterId && m.ReceiverId == reportedUserId)
                    || (m.InitiatorId == reportedUserId && m.ReceiverId == reporterId)))
            .ToListAsync();
        foreach (var match in liveMatches) match.Status = "Unmatched";

        await _db.SaveChangesAsync();

        foreach (var match in liveMatches)
        {
            await _broadcast.BroadcastAsync("app-nudges", "match_status_changed",
                new { matchId = match.Id, status = match.Status, userId = reporterId });
        }

        return report;
    }

    /// <summary>
    /// Closes a report. <see cref="ReportOutcomes.Penalised"/> is the only caller of the
    /// <c>ReportPenalty</c> score delta, and it is deliberately an admin decision rather than an
    /// automatic consequence of being reported — otherwise the score economy is something any two
    /// accounts can drive down on anyone.
    /// </summary>
    public async Task<UserReport> ResolveAsync(Guid reportId, string outcome, string? notes, string? reviewedBy)
    {
        if (!ReportOutcomes.Resolutions.Contains(outcome))
            throw new DomainException($"Outcome must be one of: {string.Join(", ", ReportOutcomes.Resolutions)}", "report.outcome_invalid");

        var report = await _db.UserReports.FirstOrDefaultAsync(r => r.Id == reportId);
        if (report is null) throw DomainException.NotFound("Report not found", "report.not_found");
        if (report.Status != ReportOutcomes.Pending)
            throw DomainException.Conflict("This report has already been resolved", "report.already_resolved");

        report.Status = outcome;
        report.ReviewNotes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        report.ReviewedBy = reviewedBy;
        report.ReviewedAt = DateTime.UtcNow;

        if (outcome is ReportOutcomes.Banned)
        {
            var reported = await _db.Users.FirstOrDefaultAsync(u => u.Id == report.ReportedUserId);
            if (reported is not null && !reported.IsBanned)
            {
                reported.IsBanned = true;
                reported.BannedAt = DateTime.UtcNow;
                reported.BanReason = notes ?? $"Upheld report: {report.Reason}";

                var liveMatches = await _db.Matches
                    .Where(m => m.Status == "Active"
                        && (m.InitiatorId == reported.Id || m.ReceiverId == reported.Id))
                    .ToListAsync();
                foreach (var match in liveMatches) match.Status = "Unmatched";
            }
        }

        await _db.SaveChangesAsync();

        if (outcome is ReportOutcomes.Penalised)
            await _score.AwardAsync(report.ReportedUserId, "ReportPenalty");

        return report;
    }
}
