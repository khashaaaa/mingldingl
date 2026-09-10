using Microsoft.EntityFrameworkCore;

public record ItemDef(string Id, string NameKey, string Rarity, string ItemType);
public record DroppedItem(string Id, string NameKey, string Rarity, string ItemType);

/// <summary>
/// Honours are titles, each granted once by one specific deed. Nothing here is rolled — the
/// catalogue replaced the random loot drops on 2026-09-05 so that everything a user can wear says
/// something true about what they did — and nothing here comes with a tier: the tier rings that
/// used to sit beside the honours were retired on 2026-09-10 because the ring only restated the
/// gem badge. `Rarity` survives on the wire for compatibility but carries the Ulzii metal: ember
/// for the honours with stakes (Oath, Rite, boss), gold for the rest.
/// </summary>
public class HonourService
{
    public const string MetalGold = "Gold";
    public const string MetalEmber = "Ember";

    private readonly AppDbContext _db;
    private readonly ILogger<HonourService> _logger;

    public HonourService(AppDbContext db, ILogger<HonourService> logger) { _db = db; _logger = logger; }

    public static readonly IReadOnlyList<ItemDef> Honours =
    [
        new("title_oathkeeper",   "item_title_oathkeeper",   MetalEmber, "Title"),
        new("title_flamekeeper",  "item_title_flamekeeper",  MetalEmber, "Title"),
        new("title_sealbreaker",  "item_title_sealbreaker",  MetalEmber, "Title"),
        new("title_threadweaver", "item_title_threadweaver", MetalGold,  "Title"),
        new("title_fateseer",     "item_title_fateseer",     MetalGold,  "Title"),
        new("title_bondkeeper",   "item_title_bondkeeper",   MetalGold,  "Title"),
        new("title_allycaller",   "item_title_allycaller",   MetalGold,  "Title"),
        new("title_trueword",     "item_title_trueword",     MetalGold,  "Title"),
        new("title_sevendawns",   "item_title_sevendawns",   MetalGold,  "Title"),
    ];

    public static ItemDef? Find(string? id) => id is null ? null : Honours.FirstOrDefault(c => c.Id == id);

    public static DroppedItem? ToDropped(string? id)
    {
        var def = Find(id);
        return def is null ? null : new DroppedItem(def.Id, def.NameKey, def.Rarity, def.ItemType);
    }

    /// <summary>
    /// Grants an honour once. Returns null when the id is unknown or the user already holds it, so
    /// callers can hand the result straight to a response and the toast only fires the first time.
    /// Never throws: an honour is a side effect of a deed that has already been recorded.
    /// </summary>
    public virtual async Task<DroppedItem?> GrantAsync(Guid userId, string honourId, string source)
    {
        UserItem? added = null;
        try
        {
            var def = Find(honourId);
            if (def is null) return null;

            bool owned = await _db.UserItems.AnyAsync(i => i.UserId == userId && i.ItemId == honourId);
            if (owned) return null;

            added = new UserItem { UserId = userId, ItemId = honourId, Source = source };
            _db.UserItems.Add(added);
            await _db.SaveChangesAsync();
            return new DroppedItem(def.Id, def.NameKey, def.Rarity, def.ItemType);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Honour grant of {HonourId} swallowed a failure for user {UserId} (source {Source})", honourId, userId, source);

            // Detach only what this method added. Clearing the whole tracker would silently throw
            // away unsaved work belonging to whoever else is sharing this scoped context.
            if (added is not null) _db.Entry(added).State = EntityState.Detached;
            return null;
        }
    }
}
