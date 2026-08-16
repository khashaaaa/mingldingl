using Microsoft.EntityFrameworkCore;

public record ItemDef(string Id, string NameKey, string Rarity, string ItemType);
public record DroppedItem(string Id, string NameKey, string Rarity, string ItemType);

public class LootService
{
    private readonly AppDbContext _db;
    private readonly ScoreService _score;

    public LootService(AppDbContext db, ScoreService score) { _db = db; _score = score; }

    public static readonly IReadOnlyList<ItemDef> Catalog =
    [
        new("frame_bronze_ring",   "item_frame_bronze",      "Common", "Frame"),
        new("frame_ember_ring",    "item_frame_ember",       "Rare",   "Frame"),
        new("frame_gold_crown",    "item_frame_crown",       "Epic",   "Frame"),
        new("frame_iron_thorns",   "item_frame_thorns",      "Common", "Frame"),
        new("title_wanderer",      "item_title_wanderer",    "Common", "Title"),
        new("title_icebreaker",    "item_title_icebreaker",  "Common", "Title"),
        new("title_flamekeeper",   "item_title_flamekeeper", "Rare",   "Title"),
        new("title_dragonheart",   "item_title_dragonheart", "Epic",   "Title"),
        // Fated Threads milestone titles (1st / 5th / 10th sparked thread —
        // see ShipService.GrantMilestoneTitleIfEarnedAsync). Not exclusive:
        // like every catalog item, these could in principle also be won
        // through the normal random pool (RollDropAsync/GrantGuaranteedAsync)
        // — a cosmetic title having two possible acquisition paths is an
        // accepted simplification, not a currency/economy concern.
        new("title_threadweaver", "item_title_threadweaver", "Common", "Title"),
        new("title_fateseer",     "item_title_fateseer",     "Rare",   "Title"),
        new("title_bondkeeper",   "item_title_bondkeeper",   "Epic",   "Title"),
        new("emblem_torch",        "item_emblem_torch",      "Common", "Emblem"),
        new("emblem_worn_map",     "item_emblem_map",        "Common", "Emblem"),
        new("emblem_lucky_dice",   "item_emblem_dice",       "Rare",   "Emblem"),
        new("emblem_phoenix",      "item_emblem_phoenix",    "Epic",   "Emblem"),
    ];

    // Probabilistic roll on scoring actions (Common 10%, Rare 3%, Epic 0.5%); max 3 drops/day.
    // Best-effort by design: a loot failure must never fail the triggering action.
    public async Task<DroppedItem?> RollDropAsync(Guid userId, string source)
    {
        try
        {
            var today = DateTime.UtcNow.Date;
            int todayCount = await _db.UserItems.CountAsync(i => i.UserId == userId && i.AcquiredAt >= today);
            if (todayCount >= 3) return null;

            double roll = Random.Shared.NextDouble();
            string? rarity = roll < 0.005 ? "Epic" : roll < 0.035 ? "Rare" : roll < 0.135 ? "Common" : null;
            if (rarity is null) return null;
            return await GrantAsync(userId, rarity, source);
        }
        catch
        {
            // Never leave poisoned entities tracked on the shared scoped DbContext.
            _db.ChangeTracker.Clear();
            return null;
        }
    }

    // Guaranteed drop for chests/milestones (Common floor, upgrade chance). Not capped.
    public async Task<DroppedItem?> GrantGuaranteedAsync(Guid userId, string source)
    {
        double roll = Random.Shared.NextDouble();
        string rarity = roll < 0.05 ? "Epic" : roll < 0.25 ? "Rare" : "Common";
        return await GrantAsync(userId, rarity, source);
    }

    // Deterministic grant of one specific catalog item, bypassing the
    // random rarity roll entirely — used for Fated Threads' ship-count
    // milestone titles, where the item earned is a fixed function of the
    // milestone, not a roll.
    public async Task<DroppedItem?> GrantSpecificAsync(Guid userId, string itemId, string source)
    {
        try
        {
            var def = Catalog.FirstOrDefault(c => c.Id == itemId);
            if (def is null) return null;

            bool owned = await _db.UserItems.AnyAsync(i => i.UserId == userId && i.ItemId == itemId);
            if (owned) return null;

            _db.UserItems.Add(new UserItem { UserId = userId, ItemId = itemId, Source = source });
            await _db.SaveChangesAsync();
            return new DroppedItem(def.Id, def.NameKey, def.Rarity, def.ItemType);
        }
        catch
        {
            _db.ChangeTracker.Clear();
            return null;
        }
    }

    // Best-effort by design: a loot failure (e.g. a concurrent duplicate grant hitting
    // the unique (UserId, ItemId) index) must never fail the triggering action.
    private async Task<DroppedItem?> GrantAsync(Guid userId, string rarity, string source)
    {
        try
        {
            var owned = await _db.UserItems.Where(i => i.UserId == userId).Select(i => i.ItemId).ToListAsync();
            var pool = Catalog.Where(c => c.Rarity == rarity && !owned.Contains(c.Id)).ToList();
            if (pool.Count == 0) pool = Catalog.Where(c => !owned.Contains(c.Id)).ToList(); // duplicate → re-roll any rarity
            if (pool.Count == 0)
            {
                await _score.AwardWithDeltaAsync(userId, "DuplicateLoot", 10);              // full collection → +10 XP
                return null;
            }
            var item = pool[Random.Shared.Next(pool.Count)];
            _db.UserItems.Add(new UserItem { UserId = userId, ItemId = item.Id, Source = source });
            await _db.SaveChangesAsync();
            return new DroppedItem(item.Id, item.NameKey, item.Rarity, item.ItemType);
        }
        catch
        {
            // Never leave poisoned (Added/Modified) entities tracked on the shared
            // scoped DbContext for later saves. No drop this time.
            _db.ChangeTracker.Clear();
            return null;
        }
    }
}
