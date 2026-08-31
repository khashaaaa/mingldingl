public record DailyCountDto(DateOnly Date, int Count);

public record EventTypeCountDto(string EventType, int Count);

public record AdminAnalyticsOverviewResponse(
    int TotalUsers,
    int ActiveUsers,
    int PausedUsers,
    int DeletedUsers,
    IReadOnlyDictionary<string, int> UsersByMembership,
    IReadOnlyDictionary<string, int> UsersByGemTier,
    IReadOnlyList<DailyCountDto> SignupsLast30Days,
    int TotalMatches,
    int TotalMessages,
    IReadOnlyList<EventTypeCountDto> ScoreEventsLast30Days,
    int EstimatedMonthlyRevenueMnt,
    int OathSwornUsers,
    int OathProvenUsers,
    int NoShowFlaggedUsers,
    int FlameRitesCompleted,
    int ShipsSparked,
    int TownSquareSessions);
