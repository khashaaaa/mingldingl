public static class ConfigKeys
{
    private static ConfigKeyDefinition Number(string key, string category, string defaultValue, string description, double min, double max) =>
        new(key, category, "Number", defaultValue, description, min, max);

    private static ConfigKeyDefinition Bool(string key, string category, string defaultValue, string description) =>
        new(key, category, "Bool", defaultValue, description);

    private static IEnumerable<ConfigKeyDefinition> ScoreEvents() =>
        ScoreService.DefaultDeltas.Select(kv => kv.Key switch
        {
            "GhostPenalty" => Number($"score.event.{kv.Key}", "Scoring", kv.Value.ToString(), "Score change for ghosting a match (zero or negative). At 0 the reputation dock and the ghost record still apply. Applies to future events only", -10000, 0),
            "DailyLogin" => Number($"score.event.{kv.Key}", "Scoring", kv.Value.ToString(), "Score per consecutive login day, multiplied by the streak (up to 7); must be at least 1 so a login is always recorded", 1, 10000),
            _ when kv.Value < 0 => Number($"score.event.{kv.Key}", "Scoring", kv.Value.ToString(), $"Score change for a {kv.Key} event (a penalty, so zero or negative). Applies to future events only; history keeps the value it was awarded with", -10000, 0),
            _ => Number($"score.event.{kv.Key}", "Scoring", kv.Value.ToString(), $"Score awarded for a {kv.Key} event. Applies to future events only; history keeps the value it was awarded with", 0, 10000),
        });

    private static IEnumerable<ConfigKeyDefinition> Quests() =>
        QuestService.AllQuests.SelectMany(q => new[]
        {
            Number($"quest.{q.Id}.xp", "Quests", q.Xp.ToString(), $"Score for completing the '{q.Id}' daily quest", 0, 10000),
            Number($"quest.{q.Id}.target", "Quests", q.Target.ToString(), $"Actions needed to complete the '{q.Id}' daily quest (the app copy interpolates this number)", 1, 1000),
        });

    public static readonly IReadOnlyList<ConfigKeyDefinition> All =
    [
        // Scoring — the economy
        ..ScoreEvents(),
        Number("score.streak.weekly_bonus", "Scoring", "50", "Extra score on every seventh consecutive daily login", 0, 10000),
        Number("score.match_reply.daily_cap_per_match", "Scoring", "10",
            "Replies worth score per conversation per day; beyond it the chat still works, it just stops paying", 0, 500),
        Number("score.quest_chest", "Scoring", "30", "Score for opening the bounty chest once all of the day's quests are done (at least 1: the chest's loot is granted with its score)", 1, 10000),
        Number("tier.opal.threshold", "Scoring", "100", "Minimum total score for the Opal gem tier (must stay between Garnet and Amethyst)", 1, 1000000),
        Number("tier.amethyst.threshold", "Scoring", "300", "Minimum total score for the Amethyst gem tier (must stay between Opal and Sapphire)", 1, 1000000),
        Number("tier.sapphire.threshold", "Scoring", "600", "Minimum total score for the Sapphire gem tier (must stay between Amethyst and Ruby)", 1, 1000000),
        Number("tier.ruby.threshold", "Scoring", "1000", "Minimum total score for the Ruby gem tier (must stay between Sapphire and Emerald)", 1, 1000000),
        Number("tier.emerald.threshold", "Scoring", "2000", "Minimum total score for the Emerald gem tier (must stay above Ruby)", 1, 1000000),
        Number("reputation.penalty_dock", "Scoring", "0.1", "ReputationScore removed for a ghost or a repeated no-show (reputation never drops below 0)", 0, 1),

        // Budget — daily match slots
        Number("budget.base.free", "Budget", "5", "Daily match slots a Free member starts with", 0, 1000),
        Number("budget.base.silver", "Budget", "12", "Daily match slots a Silver member starts with", 0, 1000),
        Number("budget.base.gold", "Budget", "20", "Daily match slots a Gold member starts with", 0, 1000),
        Number("budget.cap.free", "Budget", "12", "Most daily match slots a Free member can reach (plus one per gem tier)", 0, 1000),
        Number("budget.cap.silver", "Budget", "25", "Most daily match slots a Silver member can reach (plus one per gem tier)", 0, 1000),
        Number("budget.cap.gold", "Budget", "40", "Most daily match slots a Gold member can reach (plus one per gem tier)", 0, 1000),
        Number("budget.score_divisor", "Budget", "50", "One extra daily match slot per this many total score points", 1, 100000),

        // Membership — pricing
        Number("membership.silver.monthly_mnt", "Membership", "10900", "Silver monthly price in MNT; multi-month totals derive from it", 1, 10000000),
        Number("membership.gold.monthly_mnt", "Membership", "21900", "Gold monthly price in MNT; multi-month totals derive from it", 1, 10000000),
        Number("membership.discount.3mo_pct", "Membership", "10", "Percent off the monthly price when paying for 3 months", 0, 90),
        Number("membership.discount.6mo_pct", "Membership", "20", "Percent off the monthly price when paying for 6 months", 0, 90),

        // Quests — daily board
        ..Quests(),

        // Matching — progressive profile reveal
        ..RevealService.Defaults.Select(d => Number(
            RevealService.ThresholdKey(d.Level), "Matching", d.DefaultMessages.ToString(),
            $"Messages a match must exchange before profile reveal level {d.Level} unlocks; the four thresholds must stay strictly increasing",
            1, 100000)),

        Number("activity.suggestions.messages", "Matching", "15",
            "Messages a match must exchange before activity suggestions (and the pledge that follows) unlock", 1, 100000),

        // Safety
        Number("dating.noshow.threshold", "Safety", "3", "Distinct-match attendance mismatches before ReputationScore is docked", 1, 100),
        Number("dating.attendance_check.delay_hours", "Safety", "48", "Hours after a confirmed date before each side is asked whether the other showed up", 0, 8760),
        Number("dating.flamerite.duration_minutes", "Safety", "5", "Length of the Flame Rite video call, and the TTL of the token minted for it", 1, 120),
        Bool("dating.flamerite.required", "Safety", "true", "When true, a match cannot pledge an encounter until the Flame Rite is complete (ignored while video.enabled is false)"),
        Bool("video.enabled", "Safety", "true", "When false, no video tokens are minted anywhere (Agora bills per minute): the Flame Rite cannot be proposed and stops gating pledges, and Town Square is closed as well"),
        Number("ghosting.stale_hours", "Safety", "48", "Hours of silence after the last message before an active match is marked Ghosted and the silent party is penalised", 1, 8760),
        Number("account.deletion_grace_days", "Safety", "7", "Days between a deletion request and the sweep that anonymises the account and deletes its photos; the app quotes this number in its deletion dialogs", 1, 365),

        // Growth
        Number("oath.proven.encounters", "Scoring", "2", "Confirmed encounters required, since swearing, before an Oath shows as Proven", 1, 100),
        Bool("ships.enabled", "Growth", "true", "When false, weaving a new Fated Thread returns 404 (the app shows a localised 'not open' message); pending threads still resolve"),
        Number("ships.daily.cap", "Growth", "3", "Max Fated Threads a single Weaver can create per day", 0, 100),
        Number("ships.expiry_days", "Growth", "14", "Days a Fated Thread stays Pending before the sweep expires it", 1, 365),
        Bool("townsquare.enabled", "Growth", "true", "When false (or while video.enabled is false), every Town Square endpoint returns 404 (the app tab shows a localised 'closed' message) and the scheduler stops locking rosters and starting sessions; a session already in progress runs out its rounds"),
        Number("townsquare.max_per_side", "Growth", "5", "Most people of each gender admitted to one Town Square session (first RSVPs win)", 1, 50),
        Number("townsquare.round_seconds", "Growth", "240", "Length of each Town Square round in seconds", 30, 3600),
        Bool("campaign.enabled", "Growth", "true", "When false, the per-match campaign (dungeon map) endpoints return 404 and the app hides the map"),
        Number("campaign.room.bonus", "Scoring", "5", "Bonus score for claiming a cleared campaign room (per user, per room)", 0, 10000),
        Number("campaign.boss.bonus", "Scoring", "25", "Bonus score for claiming the campaign boss room (a completed real date with both attended)", 0, 10000),
        Number("campaign.voices.messages", "Growth", "15", "Messages a match needs before the campaign's Voices room counts as cleared", 1, 10000),
    ];

    public static ConfigKeyDefinition? Find(string key) => All.FirstOrDefault(d => d.Key == key);
}

public record ConfigKeyDefinition(string Key, string Category, string ValueType, string DefaultValue, string Description, double? Min = null, double? Max = null);
