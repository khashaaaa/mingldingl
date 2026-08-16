public record AdminAuditLogDto(
    Guid Id,
    string AdminUsername,
    string Action,
    string EntityType,
    string? EntityId,
    string? Details,
    DateTime CreatedAt);
