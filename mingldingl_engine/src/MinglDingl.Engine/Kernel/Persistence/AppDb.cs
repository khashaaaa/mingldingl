using Microsoft.EntityFrameworkCore;

namespace MinglDingl.Engine.Kernel.Persistence;

public sealed class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.ApplyConfigurationsFromAssembly(typeof(AppDb).Assembly);
        foreach (var entity in b.Model.GetEntityTypes())
        foreach (var key in entity.GetKeys().Where(k => k.IsPrimaryKey()))
        foreach (var prop in key.Properties.Where(p => p.ClrType == typeof(Guid) && !p.IsForeignKey()))
            prop.SetValueGeneratorFactory((_, _) => new Uuid7Generator());
    }
}

public sealed class Uuid7Generator : Microsoft.EntityFrameworkCore.ValueGeneration.ValueGenerator<Guid>
{
    public override bool GeneratesTemporaryValues => false;
    public override Guid Next(Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry) => Guid.CreateVersion7();
}
