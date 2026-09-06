using System.ComponentModel.DataAnnotations;

public record AdminConfigDto(
    string Key,
    string Category,
    string ValueType,
    string Value,
    string Description,
    DateTime UpdatedAt,
    string UpdatedBy,
    // The registry bounds the write is checked against. Sent so the panel can show the range up
    // front instead of leaving an admin to discover it by being rejected.
    double? Min,
    double? Max);

public record UpdateConfigRequest(
    [Required, MaxLength(FieldLimits.ConfigValue)] string Value);
