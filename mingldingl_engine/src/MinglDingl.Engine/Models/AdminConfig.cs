public class AdminConfig
{
    public string Key { get; set; } = "";
    public string Category { get; set; } = "";
    public string ValueType { get; set; } = "";
    public string Value { get; set; } = "";
    public string? SchemaJson { get; set; }
    public string Description { get; set; } = "";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string UpdatedBy { get; set; } = "";
}
