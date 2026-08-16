// One row per admin write action, taken from mingldingl_control. Nothing
// recorded who-did-what before this — a real gap for an admin tool meant to
// put the app "under your control." Read-only from the app's perspective;
// only AdminAuditService writes to it.
public class AdminAuditLog
{
    public Guid Id { get; set; }
    public string AdminUsername { get; set; } = "";
    public string Action { get; set; } = ""; // e.g. "UpdateContent", "BanUser"
    public string EntityType { get; set; } = ""; // e.g. "ContentPage", "User"
    public string? EntityId { get; set; }
    public string? Details { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
