using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("admin/config")]
[Authorize(AuthenticationSchemes = "AdminBearer")]
[Produces("application/json")]
public class AdminConfigController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ConfigService _config;
    private readonly AdminAuditService _audit;
    private readonly ScoreService _score;

    public AdminConfigController(AppDbContext db, ConfigService config, AdminAuditService audit, ScoreService score)
    {
        _db = db;
        _config = config;
        _audit = audit;
        _score = score;
    }

    [HttpGet]
    [ProducesResponseType(typeof(List<AdminConfigDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List()
    {
        var entries = await _db.AdminConfigs.AsNoTracking().OrderBy(c => c.Category).ThenBy(c => c.Key).ToListAsync();
        return Ok(entries.Select(ToDto).ToList());
    }

    [HttpPut("{key}")]
    [ProducesResponseType(typeof(AdminConfigDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(string key, [FromBody] UpdateConfigRequest request)
    {
        var entry = await _db.AdminConfigs.FirstOrDefaultAsync(c => c.Key == key);
        if (entry is null) return this.NotFoundError($"Config key '{key}' not found");

        var validationError = ConfigValueValidator.Validate(entry.ValueType, request.Value);
        if (validationError is not null) return this.BadRequestError(validationError);

        await ApplyUpdateAsync(entry, request.Value, isRevert: false);
        return Ok(ToDto(entry));
    }

    [HttpPost("{key}/revert")]
    [ProducesResponseType(typeof(AdminConfigDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Revert(string key)
    {
        var entry = await _db.AdminConfigs.FirstOrDefaultAsync(c => c.Key == key);
        if (entry is null) return this.NotFoundError($"Config key '{key}' not found");

        var lastChange = await _db.AdminAuditLogs
            .Where(l => l.EntityType == "AdminConfig" && l.EntityId == key && l.Action == "UpdateConfig")
            .OrderByDescending(l => l.CreatedAt)
            .FirstOrDefaultAsync();
        if (lastChange?.Details is null)
            return this.ConflictError($"No previous value recorded for '{key}'");

        var change = JsonSerializer.Deserialize<ConfigChangeDetails>(lastChange.Details)!;

        var validationError = ConfigValueValidator.Validate(entry.ValueType, change.OldValue);
        if (validationError is not null) return this.BadRequestError(validationError);

        await ApplyUpdateAsync(entry, change.OldValue, isRevert: true);
        return Ok(ToDto(entry));
    }

    private async Task ApplyUpdateAsync(AdminConfig entry, string newValue, bool isRevert)
    {
        var oldValue = entry.Value;
        entry.Value = newValue;
        entry.UpdatedAt = DateTime.UtcNow;
        entry.UpdatedBy = User?.Identity?.Name ?? "unknown";

        var details = JsonSerializer.Serialize(new ConfigChangeDetails(oldValue, newValue));
        _audit.Stage(User, isRevert ? "RevertConfig" : "UpdateConfig", "AdminConfig", entry.Key, details);
        await _db.SaveChangesAsync();

        _config.Set(entry.Key, newValue);

        if (IsTierThresholdKey(entry.Key))
            await _score.RecomputeAllGemTiersAsync();
    }

    internal static bool IsTierThresholdKey(string key) =>
        key.StartsWith("tier.", StringComparison.Ordinal) && key.EndsWith(".threshold", StringComparison.Ordinal);

    private static AdminConfigDto ToDto(AdminConfig c) =>
        new(c.Key, c.Category, c.ValueType, c.Value, c.Description, c.UpdatedAt, c.UpdatedBy);

    private record ConfigChangeDetails(string OldValue, string NewValue);
}
