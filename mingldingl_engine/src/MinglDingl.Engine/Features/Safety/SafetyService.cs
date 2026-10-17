using Microsoft.EntityFrameworkCore;
using MinglDingl.Engine.Features.Auth;
using MinglDingl.Engine.Features.Bonds;
using MinglDingl.Engine.Features.Photos;
using MinglDingl.Engine.Features.Score;
using MinglDingl.Engine.Kernel.Clock;
using MinglDingl.Engine.Kernel.Config;
using MinglDingl.Engine.Kernel.Errors;
using MinglDingl.Engine.Kernel.Live;
using MinglDingl.Engine.Kernel.Persistence;

namespace MinglDingl.Engine.Features.Safety;

public sealed class SafetyService(
    AppDb db, IClock clock, IConfig config, ILiveOutbox live, BondService bonds, ScoreService score, PhotoService photos)
{
    public static readonly IReadOnlySet<string> Reasons = new HashSet<string>(StringComparer.Ordinal)
        { "rude", "money", "notWhoTheyClaim", "under18", "other" };

    /// Either side has cast the other out.
    public IQueryable<Block> Between(Guid x, Guid y) =>
        db.Set<Block>().Where(b => (b.BlockerId == x && b.BlockedId == y) || (b.BlockerId == y && b.BlockedId == x));

    public async Task CastOutAsync(Guid me, Guid other, CancellationToken ct = default)
    {
        if (me == other) throw new DomainException(400, "block.self", "You cannot cast yourself out");
        if (!await db.Set<Account>().AnyAsync(a => a.Id == other, ct))
            throw new DomainException(404, "block.not_found", "No such traveller");
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await bonds.LockPeopleAsync(ct, me, other);
        if (!await db.Set<Block>().AnyAsync(b => b.BlockerId == me && b.BlockedId == other, ct))
            db.Add(new Block { BlockerId = me, BlockedId = other, CreatedAt = clock.UtcNow });
        await bonds.SeverBetweenAsync(me, other, ct);
        live.ToAccount(me, LiveKinds.BlockChanged, other);
        live.ToAccount(me, LiveKinds.SeekChanged, me);
        live.ToAccount(other, LiveKinds.SeekChanged, other);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task LetInAsync(Guid me, Guid other, CancellationToken ct = default)
    {
        var row = await db.Set<Block>().SingleOrDefaultAsync(b => b.BlockerId == me && b.BlockedId == other, ct);
        if (row is null) return;
        db.Remove(row);
        live.ToAccount(me, LiveKinds.BlockChanged, other);
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<BlockedView>> CastOutListAsync(Guid me, CancellationToken ct = default)
    {
        var rows = await (from b in db.Set<Block>().AsNoTracking()
                          join p in db.Set<Profile.Profile>().AsNoTracking() on b.BlockedId equals p.AccountId
                          where b.BlockerId == me
                          orderby b.CreatedAt descending
                          select new { b.BlockedId, p.Name, b.CreatedAt }).Take(500).ToListAsync(ct);
        var ids = rows.Select(r => r.BlockedId).ToList();
        var sealedPairs = await db.Set<Bond>().AsNoTracking()
            .Where(b => (b.AId == me && ids.Contains(b.BId)) || (b.BId == me && ids.Contains(b.AId)))
            .Select(b => new { Other = b.AId == me ? b.BId : b.AId, b.Seals }).ToListAsync(ct);
        var revealed = ids.ToDictionary(id => id, id => sealedPairs.Any(s => s.Other == id && s.Seals >= 1));
        var portraits = await photos.FirstPortraitsAsync(revealed, ct);
        return rows.Select(r => new BlockedView(r.BlockedId, r.Name, portraits.GetValueOrDefault(r.BlockedId), r.CreatedAt)).ToList();
    }

    public async Task ReportAsync(Guid me, ReportRequest req, CancellationToken ct = default)
    {
        if (!Reasons.Contains(req.Reason)) throw new DomainException(400, "report.reason", "Choose what happened");
        if (req.AccountId == me) throw new DomainException(400, "report.self", "You cannot report yourself");
        if (!await db.Set<Account>().AnyAsync(a => a.Id == req.AccountId, ct))
            throw new DomainException(404, "report.not_found", "No such traveller");
        if (req.BondId is { } bondId && !await db.Set<Bond>().AnyAsync(b => b.Id == bondId
                && ((b.AId == me && b.BId == req.AccountId) || (b.BId == me && b.AId == req.AccountId)), ct))
            throw new DomainException(404, "bond.not_found", "That bond does not exist");
        var report = new Report
        {
            ReporterId = me, TargetId = req.AccountId, BondId = req.BondId, Reason = req.Reason,
            Note = string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim(), Status = ReportStatus.Open, CreatedAt = clock.UtcNow,
        };
        db.Add(report);
        live.ToAdmins(LiveKinds.ReportCreated, report.Id);
        await db.SaveChangesAsync(ct);
    }

    // —— Admin ——

    public async Task<AdminReportPage> AdminListAsync(string? status, DateTimeOffset? before, int limit, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 100);
        var q = db.Set<Report>().AsNoTracking();
        if (!string.IsNullOrEmpty(status))
        {
            if (!Enum.TryParse<ReportStatus>(status, true, out var st)) throw new DomainException(400, "admin.bad_status", "Unknown status");
            q = q.Where(r => r.Status == st);
        }
        if (before is { } at) q = q.Where(r => r.CreatedAt < at);
        var rows = await (from r in q
                          join rp in db.Set<Profile.Profile>() on r.ReporterId equals rp.AccountId
                          join tp in db.Set<Profile.Profile>() on r.TargetId equals tp.AccountId
                          orderby r.CreatedAt descending
                          select new AdminReportRow(r.Id, r.ReporterId, rp.Name, r.TargetId, tp.Name, r.Reason, r.Note, r.Status.ToString(),
                              r.CreatedAt, db.Set<Report>().Count(x => x.TargetId == r.TargetId)))
            .Take(limit + 1).ToListAsync(ct);
        return new AdminReportPage(rows.Take(limit).ToList(), rows.Count > limit ? rows[limit - 1].CreatedAt : null);
    }

    public Task<int> ReportsAgainstAsync(Guid accountId, CancellationToken ct = default) =>
        db.Set<Report>().CountAsync(r => r.TargetId == accountId, ct);

    public async Task<AdminReportDetail> AdminDetailAsync(Guid id, CancellationToken ct = default)
    {
        var r = await db.Set<Report>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new DomainException(404, "admin.report_not_found", "No such report");
        var names = await db.Set<Profile.Profile>().AsNoTracking().Where(p => p.AccountId == r.ReporterId || p.AccountId == r.TargetId)
            .ToDictionaryAsync(p => p.AccountId, p => p.Name, ct);
        var status = await db.Set<Account>().Where(a => a.Id == r.TargetId).Select(a => a.Status).SingleAsync(ct);
        var letters = r.BondId is { } bondId
            ? await db.Set<Letter>().AsNoTracking().Where(l => l.BondId == bondId).OrderByDescending(l => l.CreatedAt).Take(20)
                .Select(l => new AdminReportLetter(l.AuthorId == r.TargetId, l.Text, l.CreatedAt)).ToListAsync(ct)
            : [];
        var count = await db.Set<Report>().CountAsync(x => x.TargetId == r.TargetId, ct);
        return new AdminReportDetail(r.Id, r.ReporterId, names.GetValueOrDefault(r.ReporterId, ""), r.TargetId,
            names.GetValueOrDefault(r.TargetId, ""), status.ToString(), r.BondId, r.Reason, r.Note, r.Status.ToString(), r.Resolution,
            r.CreatedAt, r.ResolvedAt, count, letters);
    }

    /// Nothing happens to anyone's points until an admin decides.
    public async Task<AdminReportDetail> ResolveAsync(Guid id, ResolveReportRequest req, CancellationToken ct = default)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var r = await db.Set<Report>().FromSqlInterpolated($"SELECT * FROM reports WHERE \"Id\" = {id} FOR UPDATE").SingleOrDefaultAsync(ct)
            ?? throw new DomainException(404, "admin.report_not_found", "No such report");
        if (r.Status != ReportStatus.Open) throw new DomainException(409, "admin.report_resolved", "This report is already decided");
        switch (req.Action)
        {
            case "dismiss":
                r.Status = ReportStatus.Dismissed;
                break;
            case "penalise":
                r.Status = ReportStatus.Penalised;
                await score.AwardAsync(r.TargetId, DeedKinds.Penalised, -config.Int(ConfigKeys.ScorePenalised), null, ct);
                await score.DockAsync(r.TargetId, config.Int(ConfigKeys.ReputationPenalised), ct);
                break;
            case "castOut":
                r.Status = ReportStatus.CastOut;
                var account = await db.Set<Account>().SingleAsync(a => a.Id == r.TargetId, ct);
                account.Status = AccountStatus.Suspended;
                await bonds.SeverAllAsync(r.TargetId, ct);
                live.ToAccount(r.TargetId, LiveKinds.ProfileUpdated, r.TargetId);
                break;
            default:
                throw new DomainException(400, "admin.bad_action", "Choose dismiss, penalise or castOut");
        }
        r.Resolution = string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim();
        r.ResolvedAt = clock.UtcNow;
        live.ToAdmins(LiveKinds.ReportCreated, r.Id);
        live.ToAdmins(LiveKinds.UserUpdated, r.TargetId);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await AdminDetailAsync(id, ct);
    }
}
