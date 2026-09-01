using System.ComponentModel.DataAnnotations;

public record AdminConfigDto(
    string Key,
    string Category,
    string ValueType,
    string Value,
    string Description,
    DateTime UpdatedAt,
    string UpdatedBy);

public record UpdateConfigRequest(
    [Required, MaxLength(FieldLimits.ConfigValue)] string Value);
