using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;

/// <summary>
/// Mirrors a value an atomic SQL statement already wrote onto a tracked entity without marking the
/// column modified. Assigning it plainly made the next SaveChanges write that absolute value back,
/// silently overwriting whatever a concurrent request had added in between.
/// </summary>
public static class TrackedColumns
{
    public static void SyncFromDatabase<TEntity, TProperty>(
        this AppDbContext db, TEntity entity, Expression<Func<TEntity, TProperty>> property, TProperty value)
        where TEntity : class
    {
        var entry = db.Entry(entity);
        var prop = entry.Property(property);
        prop.CurrentValue = value;
        if (entry.State is EntityState.Unchanged or EntityState.Modified)
        {
            prop.OriginalValue = value;
            prop.IsModified = false;
        }
    }

    public static TEntity? Tracked<TEntity>(this AppDbContext db, Func<TEntity, bool> match) where TEntity : class =>
        db.ChangeTracker.Entries<TEntity>().FirstOrDefault(e => match(e.Entity))?.Entity;
}
