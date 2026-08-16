using System.Security.Claims;

// Single place every admin-mutating endpoint calls to record who did what.
// Keeping the write here (rather than each controller touching
// AdminAuditLogs directly) means the entry shape can't drift between
// controllers.
public class AdminAuditService
{
    private readonly AppDbContext _db;
    public AdminAuditService(AppDbContext db) => _db = db;

    public async Task LogAsync(ClaimsPrincipal? admin, string action, string entityType, string? entityId, string? details = null)
    {
        _db.AdminAuditLogs.Add(new AdminAuditLog
        {
            Id = Guid.NewGuid(),
            AdminUsername = admin?.Identity?.Name ?? "unknown",
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Details = details,
        });
        await _db.SaveChangesAsync();
    }
}
