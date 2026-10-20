namespace MinglDingl.Engine.Kernel.Config;

public enum ConfigType { Int, Bool, Text }

public sealed record ConfigKeyDefinition(
    string Key, string Category, string Description, ConfigType Type, string Default, int? Min = null, int? Max = null);

/// Every admin-tunable value and its bounds. The seeder inserts missing keys on boot.
public static class ConfigKeys
{
    public const string PhotosMin = "photos.min";
    public const string PhotosMax = "photos.max";
    public const string SignupsEnabled = "signups.enabled";
    public const string AppMinVersion = "app.minVersion";
    public const string AppMaintenance = "app.maintenance";
    public const string AppRestMinutes = "app.restMinutes";
    public const string AccountDeleteDays = "account.deleteDays";
    public const string WritesPerMinute = "ratelimit.writes.perMinute";

    public const string TierOpal = "tier.opal";
    public const string TierAmethyst = "tier.amethyst";
    public const string TierSapphire = "tier.sapphire";
    public const string TierRuby = "tier.ruby";
    public const string TierEmerald = "tier.emerald";
    public const string ScoreFinished = "score.finished";
    public const string ScoreFirstLetter = "score.firstLetter";
    public const string ScoreReply = "score.reply";
    public const string ScoreReplyDailyCap = "score.reply.dailyCapPerBond";
    public const string ScoreDawn = "score.dawn";
    public const string ScoreDawnStreakCap = "score.dawn.streakCap";
    public const string ScoreSeventhDawn = "score.dawn.seventh";
    public const string ScoreGoneCold = "score.goneCold";
    public const string ScorePenalised = "score.penalised";
    public const string ReputationGoneCold = "reputation.goneCold";
    public const string ReputationPenalised = "reputation.penalised";
    public const string CandlesBase = "seek.candles.base";
    public const string CandlesPerPoints = "seek.candles.perPoints";
    public const string CandlesCap = "seek.candles.cap";
    public const string SeatsBase = "bonds.seats.base";
    public const string Seal1 = "bonds.seal1";
    public const string Seal2 = "bonds.seal2";
    public const string Seal3 = "bonds.seal3";
    public const string Seal4 = "bonds.seal4";
    public const string EmbersHours = "bonds.embersHours";
    public const string ColdHours = "bonds.coldHours";
    public const string UnspokenDays = "bonds.unspokenDays";
    public const string SeekEnabled = "seek.enabled";
    public const string SeekRemeetDays = "seek.remeetDays";
    public const string AwayMaxDays = "away.maxDays";
    public const string AwayEveryDays = "away.everyDays";

    public const string IcebreakerSeal = "encounters.icebreakerSeal";
    public const string TrialSeal = "encounters.trialSeal";
    public const string MeetingSeal = "encounters.meetingSeal";
    public const string VideoEnabled = "video.enabled";
    public const string VideoRequired = "video.required";
    public const string VideoMinutes = "video.minutes";
    public const string VideoMinSeconds = "video.minSeconds";
    public const string VideoReproposeHours = "video.reproposeHours";
    public const string AttendanceAfterHours = "attendance.afterHours";
    public const string AttendanceWindowHours = "attendance.windowHours";
    public const string AttendanceNoShowDays = "attendance.noShowDays";
    public const string AttendanceNoShowsToDock = "attendance.noShowsToDock";
    public const string ReputationNoShow = "reputation.noShow";
    public const string OathProvenEncounters = "oath.provenEncounters";
    public const string ScoreIcebreaker = "score.icebreaker";
    public const string ScoreTrial = "score.trial";
    public const string ScoreRite = "score.rite";
    public const string ScoreMeeting = "score.meeting";
    public const string ScoreOathProven = "score.oathProven";
    public const string QuestLightHearth = "quest.lightHearth";
    public const string QuestAnswerLetters = "quest.answerLetters";
    public const string QuestFirstLetter = "quest.firstLetter";
    public const string QuestSummon = "quest.summon";
    public const string QuestBreakIce = "quest.breakIce";
    public const string QuestTakeTrial = "quest.takeTrial";
    public const string QuestKeepEncounter = "quest.keepEncounter";
    public const string QuestLightRite = "quest.lightRite";
    public const string QuestBreakSeal = "quest.breakSeal";
    public const string ChestPoints = "chest.points";
    public const string ScoreCampaignRoom = "score.campaignRoom";
    public const string ScoreCampaignBoss = "score.campaignBoss";
    public const string ScoreWeeklyTrial = "score.weeklyTrial";
    public const string SpeedGameMinutes = "trial.speedMinutes";
    public const string AllyBounty = "ally.bounty";
    public const string ThreadsEnabled = "threads.enabled";
    public const string ThreadsPerDay = "threads.perDay";
    public const string ThreadsExpireDays = "threads.expireDays";
    public const string ScoreThreadSparked = "score.threadSparked";
    public const string SquareEnabled = "square.enabled";
    public const string WorldSnow = "world.snow";
    public const string SquareDecideSeconds = "square.decideSeconds";
    public const string SquareBreakSeconds = "square.breakSeconds";
    public const string SquareDoorsMinutes = "square.doorsMinutes";
    public const string ScoreSquare = "score.square";
    public const string MembershipEnabled = "membership.enabled";
    public const string PriceHall = "membership.price.hall";
    public const string PriceHighTable = "membership.price.highTable";
    public const string Discount3 = "membership.discount.3";
    public const string Discount6 = "membership.discount.6";
    public const string EndingNoticeDays = "membership.endingNoticeDays";
    public const string InvoiceMinutes = "payments.invoiceMinutes";
    public const string CandlesBaseHall = "seek.candles.base.hall";
    public const string CandlesCapHall = "seek.candles.cap.hall";
    public const string CandlesBaseHighTable = "seek.candles.base.highTable";
    public const string CandlesCapHighTable = "seek.candles.cap.highTable";
    public const string SeatsHallBonus = "bonds.seats.hallBonus";
    public const string SeatsHighTableBonus = "bonds.seats.highTableBonus";
    public const string GerRestsHall = "streak.gerRests.hall";
    public const string GerRestsHighTable = "streak.gerRests.highTable";
    public const string SquareHighTableLeadMinutes = "square.highTableLeadMinutes";
    public const string PhotosRequireFace = "photos.requireFace";
    public const string SafetyHideAfterReporters = "safety.hideAfterReporters";
    public const string SafetyNewDays = "safety.newDays";
    public const string SafetyNewCandles = "safety.newCandles";

    public static readonly IReadOnlyList<string> TierLadder = [TierOpal, TierAmethyst, TierSapphire, TierRuby, TierEmerald];
    public static readonly IReadOnlyList<string> SealLadder = [Seal1, Seal2, Seal3, Seal4];

    public static readonly IReadOnlyList<ConfigKeyDefinition> All =
    [
        new(PhotosMin, "Profile", "Portraits needed to finish onboarding", ConfigType.Int, "3", 1, 6),
        new(PhotosMax, "Profile", "Most portraits a person can keep", ConfigType.Int, "6", 3, 6),
        new(SignupsEnabled, "Kill switches", "New numbers can create an account", ConfigType.Bool, "true"),
        new(AppMinVersion, "App", "Oldest app version allowed in (older builds see Update)", ConfigType.Text, "1.0.0"),
        new(AppMaintenance, "Kill switches", "Everyone sees the maintenance screen", ConfigType.Bool, "false"),
        new(AppRestMinutes, "App", "Minutes of continuous use before \"the fire burns low\" (0: never)", ConfigType.Int, "40", 0, 600),
        new(AccountDeleteDays, "Profile", "Days an abandoned character waits before it is burned", ConfigType.Int, "30", 1, 90),
        new(WritesPerMinute, "Limits", "Writes one person may make per minute", ConfigType.Int, "30", 5, 600),

        new(TierOpal, "Tiers", "Points to reach Opal", ConfigType.Int, "100", 1, 100000),
        new(TierAmethyst, "Tiers", "Points to reach Amethyst (above Opal)", ConfigType.Int, "300", 2, 100000),
        new(TierSapphire, "Tiers", "Points to reach Sapphire (above Amethyst)", ConfigType.Int, "600", 3, 100000),
        new(TierRuby, "Tiers", "Points to reach Ruby (above Sapphire)", ConfigType.Int, "1000", 4, 100000),
        new(TierEmerald, "Tiers", "Points to reach Emerald (above Ruby)", ConfigType.Int, "2000", 5, 100000),

        new(ScoreFinished, "Points", "A finished character (paid once; below Opal, so the first gem is earned)", ConfigType.Int, "50", 0, 1000),
        new(ScoreFirstLetter, "Points", "The first letter of a bond", ConfigType.Int, "10", 0, 1000),
        new(ScoreReply, "Points", "A reply in a bond", ConfigType.Int, "10", 0, 1000),
        new(ScoreReplyDailyCap, "Points", "Replies that pay, per bond per day", ConfigType.Int, "10", 0, 100),
        new(ScoreDawn, "Points", "Returning each day, times the streak", ConfigType.Int, "5", 0, 1000),
        new(ScoreDawnStreakCap, "Points", "Longest streak the daily return multiplies by", ConfigType.Int, "7", 1, 30),
        new(ScoreSeventhDawn, "Points", "Bonus on the seventh dawn in a row", ConfigType.Int, "50", 0, 1000),
        new(ScoreGoneCold, "Points", "Points lost by the side that let a bond go cold", ConfigType.Int, "15", 0, 1000),
        new(ScorePenalised, "Points", "Points lost when an admin penalises a report", ConfigType.Int, "30", 0, 1000),
        new(ReputationGoneCold, "Reputation", "Reputation lost by letting a bond go cold", ConfigType.Int, "5", 0, 100),
        new(ReputationPenalised, "Reputation", "Reputation lost when an admin penalises a report", ConfigType.Int, "10", 0, 100),

        new(CandlesBase, "Seek", "Summons a day for everyone", ConfigType.Int, "5", 1, 100),
        new(CandlesPerPoints, "Seek", "One more summons a day per this many points", ConfigType.Int, "50", 1, 100000),
        new(CandlesCap, "Seek", "Most summons a day (plus the tier index)", ConfigType.Int, "12", 1, 100),
        new(SeekEnabled, "Kill switches", "Seek offers new companions", ConfigType.Bool, "true"),
        new(SeekRemeetDays, "Seek", "Days before a severed or faded pair may meet again in Seek", ConfigType.Int, "90", 1, 3650),
        new(AwayMaxDays, "Bonds", "Longest \"away by the fire\", in days (nothing goes cold meanwhile)", ConfigType.Int, "7", 1, 30),
        new(AwayEveryDays, "Bonds", "Days between one \"away by the fire\" and the next", ConfigType.Int, "30", 1, 365),

        new(SeatsBase, "Bonds", "Live bonds a person may hold (plus the tier index)", ConfigType.Int, "4", 1, 50),
        new(Seal1, "Bonds", "Letters each that break the 1st seal (first portrait, age)", ConfigType.Int, "5", 1, 1000),
        new(Seal2, "Bonds", "Letters each that break the 2nd seal (second portrait)", ConfigType.Int, "10", 2, 1000),
        new(Seal3, "Bonds", "Letters each that break the 3rd seal (third portrait, district)", ConfigType.Int, "15", 3, 1000),
        new(Seal4, "Bonds", "Letters each that break the 4th seal (everything)", ConfigType.Int, "30", 4, 1000),
        new(EmbersHours, "Bonds", "Hours on your turn before the embers warning", ConfigType.Int, "36", 1, 1000),
        new(ColdHours, "Bonds", "Hours on your turn before the bond goes cold", ConfigType.Int, "48", 2, 1000),
        new(UnspokenDays, "Bonds", "Days a bond with no letters lasts before it fades", ConfigType.Int, "7", 1, 365),

        new(IcebreakerSeal, "Encounters", "Seals broken before the icebreaker opens (0: with the bond)", ConfigType.Int, "0", 0, 4),
        new(TrialSeal, "Encounters", "Seals broken before the Trial (quiz) opens", ConfigType.Int, "2", 0, 4),
        new(MeetingSeal, "Encounters", "Seals broken before a meeting can be chosen", ConfigType.Int, "3", 0, 4),
        new(VideoEnabled, "Kill switches", "The Flame Rite (video call) is offered", ConfigType.Bool, "true"),
        new(VideoRequired, "Encounters", "A completed Flame Rite is needed before a meeting", ConfigType.Bool, "true"),
        new(VideoMinutes, "Encounters", "Length of the Flame Rite in minutes", ConfigType.Int, "5", 1, 60),
        new(VideoMinSeconds, "Encounters", "Seconds both must be in the call for the Rite to count", ConfigType.Int, "60", 10, 3600),
        new(VideoReproposeHours, "Encounters", "Hours before a declined Rite may be proposed again", ConfigType.Int, "24", 0, 720),
        new(AttendanceAfterHours, "Encounters", "Hours after a meeting before \"Did they come?\" is asked", ConfigType.Int, "3", 0, 72),
        new(AttendanceWindowHours, "Encounters", "Hours to answer \"Did they come?\"", ConfigType.Int, "48", 1, 720),
        new(AttendanceNoShowDays, "Encounters", "Days a no-show counts against someone", ConfigType.Int, "90", 1, 3650),
        new(AttendanceNoShowsToDock, "Encounters", "No-shows inside that window that cost reputation", ConfigType.Int, "3", 1, 100),
        new(ReputationNoShow, "Reputation", "Reputation lost on a repeated no-show", ConfigType.Int, "10", 0, 100),
        new(OathProvenEncounters, "Encounters", "Kept meetings that prove the Oath", ConfigType.Int, "2", 1, 100),
        new(ScoreIcebreaker, "Points", "Both answered the icebreaker (each)", ConfigType.Int, "20", 0, 1000),
        new(ScoreTrial, "Points", "Both finished the Trial (each)", ConfigType.Int, "15", 0, 1000),
        new(ScoreRite, "Points", "The Flame Rite was completed (each)", ConfigType.Int, "30", 0, 1000),
        new(ScoreMeeting, "Points", "A meeting was sworn (each)", ConfigType.Int, "50", 0, 1000),
        new(ScoreOathProven, "Points", "The Oath was proven (once)", ConfigType.Int, "40", 0, 1000),
        new(QuestLightHearth, "Quests", "Bounty: return today", ConfigType.Int, "20", 0, 1000),
        new(QuestAnswerLetters, "Quests", "Bounty: answer three letters", ConfigType.Int, "30", 0, 1000),
        new(QuestFirstLetter, "Quests", "Bounty: write a first letter", ConfigType.Int, "20", 0, 1000),
        new(QuestSummon, "Quests", "Bounty: summon a companion", ConfigType.Int, "15", 0, 1000),
        new(QuestBreakIce, "Quests", "Bounty: break the ice with someone", ConfigType.Int, "25", 0, 1000),
        new(QuestTakeTrial, "Quests", "Bounty: take a trial", ConfigType.Int, "25", 0, 1000),
        new(QuestKeepEncounter, "Quests", "Weekly bounty: keep a pledged encounter", ConfigType.Int, "50", 0, 1000),
        new(QuestLightRite, "Quests", "Weekly bounty: light the Flame Rite", ConfigType.Int, "40", 0, 1000),
        new(QuestBreakSeal, "Quests", "Weekly bounty: break a seal", ConfigType.Int, "40", 0, 1000),
        new(ChestPoints, "Quests", "Points in a bounty chest (all of a day's quests claimed)", ConfigType.Int, "30", 0, 1000),
        new(ScoreCampaignRoom, "Points", "A Campaign chamber cleared (each)", ConfigType.Int, "5", 0, 1000),
        new(ScoreCampaignBoss, "Points", "The Campaign's boss seal broken by a kept encounter (each)", ConfigType.Int, "25", 0, 1000),
        new(ScoreWeeklyTrial, "Points", "The week's trial answered by both (each, per game)", ConfigType.Int, "25", 0, 1000),
        new(SpeedGameMinutes, "Encounters", "Minutes to answer the Three Games' speed prompt once opened", ConfigType.Int, "60", 1, 1440),
        new(AllyBounty, "Points", "An ally answered a call: to each of the two, when the newcomer finishes", ConfigType.Int, "50", 0, 1000),
        new(ThreadsEnabled, "Kill switches", "Fated Threads can be woven", ConfigType.Bool, "true"),
        new(ThreadsPerDay, "Threads", "Threads one person may weave a day", ConfigType.Int, "2", 0, 50),
        new(ThreadsExpireDays, "Threads", "Days a thread waits for both answers before it is cut", ConfigType.Int, "14", 1, 365),
        new(ScoreThreadSparked, "Points", "A thread you wove sparked (to the weaver)", ConfigType.Int, "40", 0, 1000),
        new(SquareEnabled, "Kill switches", "The Town Square shows its gatherings", ConfigType.Bool, "true"),
        new(WorldSnow, "Kill switches", "Snow falls on the world from the winter solstice to January 20", ConfigType.Bool, "true"),
        new(SquareDecideSeconds, "Town Square", "Seconds to answer at the bell", ConfigType.Int, "30", 10, 300),
        new(SquareBreakSeconds, "Town Square", "Seconds between one bell and the next round", ConfigType.Int, "20", 5, 300),
        new(SquareDoorsMinutes, "Town Square", "Minutes before the first bell the square opens", ConfigType.Int, "10", 1, 120),
        new(ScoreSquare, "Points", "Sat through a round at the Town Square (once a gathering)", ConfigType.Int, "10", 0, 1000),
        new(MembershipEnabled, "Kill switches", "The Guild House sells floors (app and web)", ConfigType.Bool, "true"),
        new(PriceHall, "Membership", "The Hall, one moon on the web (₮)", ConfigType.Int, "10900", 100, 1000000),
        new(PriceHighTable, "Membership", "The High Table, one moon on the web (₮)", ConfigType.Int, "21900", 100, 1000000),
        new(Discount3, "Membership", "Percent off three moons", ConfigType.Int, "10", 0, 90),
        new(Discount6, "Membership", "Percent off six moons", ConfigType.Int, "20", 0, 90),
        new(EndingNoticeDays, "Membership", "Days before a floor ends that the person is told", ConfigType.Int, "3", 0, 30),
        new(InvoiceMinutes, "Membership", "Minutes a QPay code holds before it goes cold", ConfigType.Int, "15", 5, 1440),
        new(CandlesBaseHall, "Membership", "The Hall: summons a night before points and tier", ConfigType.Int, "12", 0, 100),
        new(CandlesCapHall, "Membership", "The Hall: most summons a night (before tier)", ConfigType.Int, "25", 1, 200),
        new(CandlesBaseHighTable, "Membership", "The High Table: summons a night before points and tier", ConfigType.Int, "20", 0, 100),
        new(CandlesCapHighTable, "Membership", "The High Table: most summons a night (before tier)", ConfigType.Int, "40", 1, 200),
        new(SeatsHallBonus, "Membership", "The Hall: more seats at the fire", ConfigType.Int, "2", 0, 20),
        new(SeatsHighTableBonus, "Membership", "The High Table: more seats at the fire", ConfigType.Int, "4", 0, 20),
        new(GerRestsHall, "Membership", "The Hall: missed dawns a ger rest keeps, per moon", ConfigType.Int, "1", 0, 31),
        new(GerRestsHighTable, "Membership", "The High Table: missed dawns a ger rest keeps, per moon", ConfigType.Int, "2", 0, 31),
        new(SquareHighTableLeadMinutes, "Town Square", "Minutes after a bell is rung that only the High Table may sit", ConfigType.Int, "10", 0, 1440),
        new(PhotosRequireFace, "Safety", "A portrait must show a human face (checked on the engine at upload)", ConfigType.Bool, "true"),
        new(SafetyHideAfterReporters, "Safety", "Open reports from this many different people hide someone from Seek until a keeper decides (0: never)", ConfigType.Int, "3", 0, 100),
        new(SafetyNewDays, "Safety", "Days after finishing a character that its summons are held low", ConfigType.Int, "2", 0, 30),
        new(SafetyNewCandles, "Safety", "Most summons a night while a character is new", ConfigType.Int, "3", 1, 100),
    ];

    public static ConfigKeyDefinition? Find(string key) => All.FirstOrDefault(d => d.Key == key);
}
