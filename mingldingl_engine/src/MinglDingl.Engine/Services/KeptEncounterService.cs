using Microsoft.EntityFrameworkCore;

/// <summary>
/// What a kept encounter — a pledged date both sides said the other turned up to — is worth beyond
/// its score: it closes ghosting scars, charts the venue's district on the user's waypoints, and
/// inside a festival season earns that season's honour. Only kept encounters count, never merely
/// confirmed ones: a pledge is a promise, and these reward the promise being honoured.
/// </summary>
public class KeptEncounterService
{
    private readonly AppDbContext _db;
    private readonly ConfigService _config;
    private readonly ScoreService _score;
    private readonly HonourService _honours;
    private readonly SeasonService _seasons;

    public KeptEncounterService(AppDbContext db, ConfigService config, ScoreService score, HonourService honours, SeasonService seasons)
    {
        _db = db; _config = config; _score = score; _honours = honours; _seasons = seasons;
    }

    public int HealNeeded => Math.Max(1, (int)_config.GetNumber("scars.heal.encounters", 2));

    public int CartographerNeeded => Math.Max(1, (int)_config.GetNumber("waypoints.cartographer.districts", 3));

    /// <summary>Called once per participant when an encounter is first known to have been kept.</summary>
    public async Task RecordAsync(Guid userId, DateConfirmation confirmation)
    {
        await HealAsync(userId);

        if (await DistrictsChartedAsync(userId) >= CartographerNeeded)
            await _honours.GrantAsync(userId, "title_cartographer", "waypoints");

        // The season the date was sworn in, not the day the attendance question was answered —
        // that comes days later and would push a Naadam date out of Naadam.
        if (confirmation.CompletedAt is DateTime sworn && _seasons.At(sworn) is { } season)
            await _honours.GrantAsync(userId, season.HonourId, $"season_{season.Id}");
    }

    /// <summary>
    /// Counts one kept encounter toward the oldest open scar, and closes it once enough have been
    /// kept: the scar goes, the reputation its ghosting docked comes back, and the first closed
    /// scar earns Mended. The row is locked for the read so two encounters kept at once each count.
    /// </summary>
    private async Task HealAsync(Guid userId)
    {
        int need = HealNeeded;
        bool healed = await _db.InTransactionAsync(async () =>
        {
            var rows = await _db.Database.SqlQuery<ScarRow>(
                $"""SELECT "OpenScars", "ScarHealProgress" FROM "Users" WHERE "Id" = {userId} FOR UPDATE""").ToListAsync();
            if (rows.Count == 0 || rows[0].OpenScars <= 0) return false;

            int progress = rows[0].ScarHealProgress + 1;
            bool closes = progress >= need;
            decimal restore = closes ? _score.ReputationDock : 0m;
            await _db.Database.ExecuteSqlInterpolatedAsync(
                $"""
                UPDATE "Users" SET
                    "OpenScars" = "OpenScars" - {(closes ? 1 : 0)},
                    "ScarHealProgress" = {(closes ? 0 : progress)},
                    "ReputationScore" = LEAST(1.0, "ReputationScore" + {restore})
                WHERE "Id" = {userId}
                """);
            if (closes)
            {
                _db.ScoreEvents.Add(new ScoreEvent { UserId = userId, EventType = "ScarHealed", Delta = 0 });
                await _db.SaveChangesAsync();
            }
            return closes;
        });

        if (healed) await _honours.GrantAsync(userId, "title_mended", "scar_healed");
    }

    private sealed record ScarRow(int OpenScars, int ScarHealProgress);

    private IQueryable<DateConfirmation> KeptFor(Guid userId) =>
        _db.DateConfirmations.AsNoTracking().Where(c =>
            c.CompletedAt != null && c.InitiatorAttended == true && c.ReceiverAttended == true
            && _db.Matches.Any(m => m.Id == c.MatchId && (m.InitiatorId == userId || m.ReceiverId == userId)));

    /// <summary>Distinct districts of the partner venues this user has kept an encounter at.</summary>
    public Task<int> DistrictsChartedAsync(Guid userId) =>
        KeptFor(userId)
            .Join(_db.ActivitySuggestions, c => c.ActivitySuggestionId, s => s.Id, (c, s) => s.BusinessPartnerId)
            .Join(_db.BusinessPartners, id => id, b => (Guid?)b.Id, (id, b) => b.District)
            .Where(d => d != "")
            .Distinct()
            .CountAsync();
}
