// One row per admin-editable config value — the persisted counterpart to a
// ConfigKeys.All registry entry (see Services/ConfigKeys.cs). ValueType is
// "Bool" | "Number" | "String" | "Json"; SchemaJson is only populated for
// "Json"-typed entries, validated against on every admin write.
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
