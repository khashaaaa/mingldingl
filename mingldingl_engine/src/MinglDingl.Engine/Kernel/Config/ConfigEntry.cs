using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MinglDingl.Engine.Kernel.Config;

public sealed class ConfigEntry
{
    public string Key { get; set; } = "";
    public string Value { get; set; } = "";
    public string Category { get; set; } = "";
    public string Description { get; set; } = "";
    public ConfigType Type { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

internal sealed class ConfigEntryMap : IEntityTypeConfiguration<ConfigEntry>
{
    public void Configure(EntityTypeBuilder<ConfigEntry> e)
    {
        e.ToTable("config");
        e.HasKey(x => x.Key);
        e.Property(x => x.Key).HasMaxLength(100);
        e.Property(x => x.Value).HasMaxLength(200);
        e.Property(x => x.Type).HasConversion<string>().HasMaxLength(10);
    }
}
