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
    // Projection from the current membership-level mix × MembershipController's
    // listed monthly prices — there is no payment/transaction record anywhere
    // in the engine, so this is NOT recorded revenue, just an estimate of what
    // the current paid-tier mix would be worth per month if everyone renews.
    int EstimatedMonthlyRevenueMnt);
