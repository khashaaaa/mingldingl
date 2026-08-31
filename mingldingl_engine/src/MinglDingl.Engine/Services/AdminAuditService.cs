using System.Security.Claims;

public class AdminAuditService
{
    private readonly AppDbContext _db;
    public AdminAuditService(AppDbContext db) => _db = db;

    public async Task LogAsync(ClaimsPrincipal? admin, string action, string entityType, string? entityId, string? details = null)
    {
        Stage(admin, action, entityType, entityId, details);
        await _db.SaveChangesAsync();
    }

    public void Stage(ClaimsPrincipal? admin, string action, string entityType, string? entityId, string? details = null)
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
    }
}
